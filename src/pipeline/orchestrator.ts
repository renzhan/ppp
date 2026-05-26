import { PrismaClient } from '../../generated/prisma';
import { ChapterDataLoaderRegistry } from './loaders/types';
import { PromptTemplateLoader } from './template-loader';
import { parseResponse, truncateAtParagraphBoundary } from './response-parser';
import type { LLMClient } from '../report/llm-client';
import type { ChatMessage } from '../shared/types';

/**
 * Configuration for the report generation pipeline.
 */
export interface PipelineConfig {
  projectId: string;
  reviewConfigId: string;
  timeout?: number; // per-chapter LLM timeout in ms, default 60000 (60s)
}

/**
 * Result for a single chapter in the generated report.
 */
export interface ChapterResult {
  chapterNumber: number;
  title: string;
  content: string; // HTML-compatible Markdown
  status: 'generated' | 'error';
  generatedAt: string; // ISO 8601
  errorMessage?: string;
}

/**
 * Result of a full pipeline run.
 */
export interface PipelineResult {
  chapters: ChapterResult[];
  versionId: string;
  versionNumber: number;
}

/** Default timeout per LLM call: 60 seconds */
const DEFAULT_TIMEOUT = 60000;

/** Maximum content length before truncation */
const MAX_CONTENT_LENGTH = 2000;

/** Static chapters that don't call LLM */
const STATIC_CHAPTERS = new Set([1, 10]);

/**
 * ReportPipelineOrchestrator orchestrates the full report generation pipeline.
 *
 * For each chapter (1-10):
 * 1. Load chapter data via the data loader registry
 * 2. Load the prompt template
 * 3. Substitute variables into the template
 * 4. Call LLM (or build static content for chapters 1 and 10)
 * 5. Parse the response
 * 6. Store the result
 *
 * After all chapters are generated:
 * - Write complete report to ReviewConfig.reportContent
 * - Create a ReportVersion record
 */
export class ReportPipelineOrchestrator {
  constructor(
    private loaderRegistry: ChapterDataLoaderRegistry,
    private templateLoader: PromptTemplateLoader,
    private llmClient: LLMClient,
    private prisma: PrismaClient,
  ) {}

  /**
   * Generate a full 10-chapter report.
   */
  async generateFullReport(config: PipelineConfig): Promise<PipelineResult> {
    const timeout = config.timeout ?? DEFAULT_TIMEOUT;

    console.log(`[ReportPipeline] generateFullReport started: projectId=${config.projectId}, reviewConfigId=${config.reviewConfigId}, timeout=${timeout}`);

    // Semaphore-based concurrency control (max 5 concurrent)
    const CONCURRENCY = 5;
    const chapterNumbers = Array.from({ length: 10 }, (_, i) => i + 1);
    const chapters: ChapterResult[] = new Array(10);

    const semaphore = { count: 0, queue: [] as (() => void)[] };

    const acquire = (): Promise<void> => {
      if (semaphore.count < CONCURRENCY) {
        semaphore.count++;
        return Promise.resolve();
      }
      return new Promise<void>((resolve) => semaphore.queue.push(resolve));
    };

    const release = () => {
      const next = semaphore.queue.shift();
      if (next) {
        next();
      } else {
        semaphore.count--;
      }
    };

    await Promise.all(
      chapterNumbers.map(async (chapterNumber, idx) => {
        await acquire();
        try {
          chapters[idx] = await this.generateSingleChapter(config.projectId, chapterNumber, timeout);
        } finally {
          release();
        }
      })
    );

    console.log(`[ReportPipeline] all chapters generated: ${chapters.filter(c => c.status === 'generated').length}/10 succeeded`);

    // Mark status as completed
    await this.prisma.reviewConfig.update({
      where: { id: config.reviewConfigId },
      data: {
        reportContent: chapters as any,
        status: 'completed',
      },
    });

    // Determine next version number
    const latestVersion = await this.prisma.reportVersion.findFirst({
      where: { projectId: config.projectId },
      orderBy: { versionNumber: 'desc' },
    });
    const versionNumber = (latestVersion?.versionNumber ?? 0) + 1;

    // Create ReportVersion record
    const reportVersion = await this.prisma.reportVersion.create({
      data: {
        projectId: config.projectId,
        versionNumber,
        content: chapters as any,
        status: 'draft',
      },
    });

    return {
      chapters,
      versionId: reportVersion.id,
      versionNumber,
    };
  }

  /**
   * Regenerate a single chapter, updating only that chapter in the existing content.
   * Returns the newly generated chapter result.
   */
  async regenerateChapter(
    config: PipelineConfig,
    chapterNumber: number,
    existingContent: ChapterResult[],
  ): Promise<ChapterResult> {
    if (chapterNumber < 1 || chapterNumber > 10) {
      throw new Error(`Invalid chapter number: ${chapterNumber}. Must be between 1 and 10.`);
    }

    const timeout = config.timeout ?? DEFAULT_TIMEOUT;

    // Generate the new chapter content
    const newChapter = await this.generateSingleChapter(
      config.projectId,
      chapterNumber,
      timeout,
    );

    // Update the existing content array (replace at index chapterNumber - 1)
    const updatedContent = [...existingContent];
    updatedContent[chapterNumber - 1] = newChapter;

    // Write updated report content to ReviewConfig
    await this.prisma.reviewConfig.update({
      where: { id: config.reviewConfigId },
      data: {
        reportContent: updatedContent as any,
      },
    });

    return newChapter;
  }

  /**
   * Generate content for a single chapter.
   * For chapters 1 and 10, builds static content without calling LLM.
   * For chapters 2-9, calls LLM with the assembled prompt.
   */
  private async generateSingleChapter(
    projectId: string,
    chapterNumber: number,
    timeout: number,
  ): Promise<ChapterResult> {
    console.log(`[ReportPipeline] generateSingleChapter called: chapter=${chapterNumber}, projectId=${projectId}, timeout=${timeout}`);

    // Load template metadata (needed for title and fallback)
    const template = this.templateLoader.loadTemplate(chapterNumber);
    const title = template.metadata.chapter_name;
    const fallbackText = template.metadata.fallback_text;
    console.log(`[ReportPipeline] chapter ${chapterNumber} template loaded: title="${title}"`);

    try {
      // Load chapter data
      const dataContext = await this.loaderRegistry.loadChapterData(chapterNumber, projectId);
      console.log(`[ReportPipeline] chapter ${chapterNumber} data loaded: variables=${Object.keys(dataContext.variables).join(', ')}`);

      // Substitute variables into the user prompt template
      const userPrompt = this.templateLoader.substituteVariables(
        template.userPromptTemplate,
        dataContext.variables,
      );
      console.log(`[ReportPipeline] chapter ${chapterNumber} prompt assembled: length=${userPrompt.length}`);

      // For static chapters (1 and 10), build content directly from the substituted template
      if (STATIC_CHAPTERS.has(chapterNumber)) {
        const content = this.buildStaticContent(userPrompt);
        console.log(`[ReportPipeline] chapter ${chapterNumber} static content built: length=${content.length}`);
        return {
          chapterNumber,
          title,
          content,
          status: 'generated',
          generatedAt: new Date().toISOString(),
        };
      }

      // For LLM chapters (2-9), call the LLM with timeout
      const messages: ChatMessage[] = [];
      if (template.systemPrompt) {
        messages.push({ role: 'system', content: template.systemPrompt });
      }
      messages.push({ role: 'user', content: userPrompt });
      console.log(`[ReportPipeline] chapter ${chapterNumber} calling LLM: messages=${messages.length}, systemPrompt=${!!template.systemPrompt}`);

      const rawResponse = await this.callLLMWithTimeout(messages, timeout);
      console.log(`[ReportPipeline] chapter ${chapterNumber} LLM response received: length=${rawResponse.length}`);

      // Parse the response based on output format
      const parsed = parseResponse(rawResponse, template.metadata.output_format);

      // Truncate if needed
      let content = parsed.html;
      if (content.length > MAX_CONTENT_LENGTH) {
        content = truncateAtParagraphBoundary(content, MAX_CONTENT_LENGTH);
        console.log(`[ReportPipeline] chapter ${chapterNumber} content truncated: ${parsed.html.length} -> ${content.length}`);
      }

      console.log(`[ReportPipeline] chapter ${chapterNumber} completed successfully: contentLength=${content.length}`);
      return {
        chapterNumber,
        title,
        content,
        status: 'generated',
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`[ReportPipeline] chapter ${chapterNumber} FAILED:`, error instanceof Error ? error.message : error);
      // On any failure, use fallback text and mark as error
      return {
        chapterNumber,
        title,
        content: fallbackText,
        status: 'error',
        generatedAt: new Date().toISOString(),
        errorMessage: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Build static content for chapters that don't need LLM (cover, end page).
   * Simply returns the substituted template as HTML-compatible content.
   */
  private buildStaticContent(substitutedTemplate: string): string {
    // The template is already in Markdown format with variables substituted.
    // Parse it as structured format to get proper HTML.
    const parsed = parseResponse(substitutedTemplate, 'structured');
    return parsed.html;
  }

  /**
   * Call the LLM client with a timeout.
   * Throws an error if the call times out or fails.
   */
  private async callLLMWithTimeout(
    messages: ChatMessage[],
    timeout: number,
  ): Promise<string> {
    const result = await this.llmClient.chat(messages, { timeout });

    // The LLM client returns a fallback message on failure internally,
    // but we want to detect actual failures. Check if the response is empty.
    if (!result || result.trim().length === 0) {
      throw new Error('LLM returned empty response');
    }

    return result;
  }
}
