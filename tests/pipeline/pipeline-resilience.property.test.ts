import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { ReportPipelineOrchestrator, ChapterResult } from '../../src/pipeline/orchestrator';
import { ChapterDataLoaderRegistry } from '../../src/pipeline/loaders/types';
import { PromptTemplateLoader } from '../../src/pipeline/template-loader';
import type { LLMClient } from '../../src/report/llm-client';

/**
 * Property 4: Pipeline resilience on LLM failure
 * Validates: Requirements 4.5
 *
 * For any chapter index N (non-static, non-excluded) where the LLM call fails or times out,
 * the pipeline SHALL still produce a complete report where
 * chapter N has status: 'error' with fallback content, and all other
 * chapters have their independently generated content unaffected.
 */
describe('Feature: report-generation-pipeline, Property 4: Pipeline resilience on LLM failure', () => {
  // Chapter metadata for all 10 chapters
  const chapterMetadata: Array<{ number: number; name: string; fallback: string }> = [
    { number: 1, name: '封面', fallback: '封面内容生成失败，请重试。' },
    { number: 2, name: '项目回顾', fallback: '项目回顾内容生成失败，请重试。' },
    { number: 3, name: '数据总览', fallback: '数据总览内容生成失败，请重试。' },
    { number: 4, name: '项目亮点', fallback: '项目亮点内容生成失败，请重试。' },
    { number: 5, name: '综合分析', fallback: '综合分析内容生成失败，请重试。' },
    { number: 6, name: '内容分析', fallback: '内容分析内容生成失败，请重试。' },
    { number: 7, name: '投流分析', fallback: '投流分析内容生成失败，请重试。' },
    { number: 8, name: '人群资产', fallback: '人群资产内容生成失败，请重试。' },
    { number: 9, name: '优化建议', fallback: '优化建议内容生成失败，请重试。' },
    { number: 10, name: '尾页', fallback: '尾页内容生成失败，请重试。' },
  ];

  // Active chapters (chapter 8 excluded per requirement 7.1)
  const activeChapterNumbers = [1, 2, 3, 4, 5, 6, 7, 9, 10];
  const activeChapterCount = activeChapterNumbers.length; // 9
  // LLM chapters = active non-static chapters
  const llmChapters = [2, 3, 4, 5, 6, 7, 9]; // chapters that call LLM

  // Mock template loader
  function createMockTemplateLoader(): PromptTemplateLoader {
    const loader = {
      loadTemplate: vi.fn((chapterNumber: number) => {
        const meta = chapterMetadata[chapterNumber - 1];
        return {
          metadata: {
            chapter_number: chapterNumber,
            chapter_name: meta.name,
            required_data_sources: ['projects'],
            output_format: 'paragraphs' as const,
            fallback_text: meta.fallback,
          },
          systemPrompt: chapterNumber === 1 || chapterNumber === 10 ? '' : 'You are an expert.',
          userPromptTemplate: `Chapter ${chapterNumber} content template`,
        };
      }),
      substituteVariables: vi.fn((_template: string, _variables: Record<string, string>) => {
        return 'Substituted content';
      }),
    } as unknown as PromptTemplateLoader;
    return loader;
  }

  // Mock data loader registry
  function createMockLoaderRegistry(): ChapterDataLoaderRegistry {
    const registry = {
      loadChapterData: vi.fn(async () => ({
        variables: { project_name: 'Test Project', brand: 'Test Brand' },
        missingFields: [],
      })),
    } as unknown as ChapterDataLoaderRegistry;
    return registry;
  }

  // Mock Prisma client
  function createMockPrisma() {
    return {
      reviewConfig: {
        update: vi.fn(async () => ({})),
      },
      reportVersion: {
        findFirst: vi.fn(async () => null),
        create: vi.fn(async () => ({ id: 'version-123', versionNumber: 1 })),
      },
    } as any;
  }

  it('should produce a complete 10-chapter report even when a chapter LLM call fails', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate a random LLM chapter that will fail
        fc.constantFrom(...llmChapters),
        async (failingChapter) => {
          const templateLoader = createMockTemplateLoader();
          const loaderRegistry = createMockLoaderRegistry();
          const mockPrisma = createMockPrisma();

          // Track which chapter is being generated (using concurrent-safe approach)
          const generatedChaptersSet = new Set<number>();
          const llmClient: LLMClient = {
            chat: vi.fn(async (_messages: any) => {
              // Due to concurrency, determine current chapter from template content
              const callIdx = (llmClient.chat as any).mock.calls.length;
              // The orchestrator calls chapters in order but concurrently
              // We'll determine which chapter based on call order within llmChapters
              const currentChapter = llmChapters[callIdx - 1];
              if (currentChapter === failingChapter) {
                throw new Error(`LLM timeout for chapter ${failingChapter}`);
              }
              generatedChaptersSet.add(currentChapter);
              return `Generated content for chapter ${currentChapter}.\n\nThis is a paragraph.`;
            }),
          };

          const orchestrator = new ReportPipelineOrchestrator(
            loaderRegistry,
            templateLoader,
            llmClient,
            mockPrisma,
          );

          const result = await orchestrator.generateFullReport({
            projectId: 'project-1',
            reviewConfigId: 'review-config-1',
          });

          // The pipeline should produce exactly 9 chapters (chapter 8 excluded)
          expect(result.chapters).toHaveLength(activeChapterCount);

          // The failing chapter should have status 'error' with fallback content
          const failedChapter = result.chapters.find(c => c.chapterNumber === failingChapter);
          expect(failedChapter).toBeDefined();
          expect(failedChapter!.status).toBe('error');
          expect(failedChapter!.content).toBe(chapterMetadata[failingChapter - 1].fallback);

          // All other chapters should have status 'generated'
          for (const chapter of result.chapters) {
            if (chapter.chapterNumber !== failingChapter) {
              expect(chapter.status).toBe('generated');
            }
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should use fallback_text from template metadata when LLM fails', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...llmChapters),
        async (failingChapter) => {
          const templateLoader = createMockTemplateLoader();
          const loaderRegistry = createMockLoaderRegistry();
          const mockPrisma = createMockPrisma();

          const llmClient: LLMClient = {
            chat: vi.fn(async () => {
              const callIdx = (llmClient.chat as any).mock.calls.length;
              const currentChapter = llmChapters[callIdx - 1];
              if (currentChapter === failingChapter) {
                throw new Error('Connection timeout');
              }
              return `Content for chapter ${currentChapter}.\n\nAnother paragraph.`;
            }),
          };

          const orchestrator = new ReportPipelineOrchestrator(
            loaderRegistry,
            templateLoader,
            llmClient,
            mockPrisma,
          );

          const result = await orchestrator.generateFullReport({
            projectId: 'project-1',
            reviewConfigId: 'review-config-1',
          });

          const failedResult = result.chapters.find(c => c.chapterNumber === failingChapter);
          const expectedFallback = chapterMetadata[failingChapter - 1].fallback;

          expect(failedResult).toBeDefined();
          expect(failedResult!.content).toBe(expectedFallback);
          expect(failedResult!.errorMessage).toBeDefined();
          expect(failedResult!.errorMessage!.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should not affect other chapters when one chapter fails', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...llmChapters),
        async (failingChapter) => {
          const templateLoader = createMockTemplateLoader();
          const loaderRegistry = createMockLoaderRegistry();
          const mockPrisma = createMockPrisma();

          // Track which chapters were successfully generated
          const generatedChapters: number[] = [];

          const llmClient: LLMClient = {
            chat: vi.fn(async () => {
              const callIdx = (llmClient.chat as any).mock.calls.length;
              const currentChapter = llmChapters[callIdx - 1];
              if (currentChapter === failingChapter) {
                throw new Error('Timeout');
              }
              generatedChapters.push(currentChapter);
              return `Unique content for chapter ${currentChapter}.\n\nParagraph two.`;
            }),
          };

          const orchestrator = new ReportPipelineOrchestrator(
            loaderRegistry,
            templateLoader,
            llmClient,
            mockPrisma,
          );

          const result = await orchestrator.generateFullReport({
            projectId: 'project-1',
            reviewConfigId: 'review-config-1',
          });

          // All LLM chapters except the failing one should have been generated
          const expectedLLMChapters = llmChapters.filter(
            (n) => n !== failingChapter
          );
          expect(generatedChapters.sort()).toEqual(expectedLLMChapters.sort());

          // Static chapters (1, 10) should always be generated
          const ch1 = result.chapters.find(c => c.chapterNumber === 1);
          const ch10 = result.chapters.find(c => c.chapterNumber === 10);
          expect(ch1!.status).toBe('generated');
          expect(ch10!.status).toBe('generated');
        }
      ),
      { numRuns: 20 }
    );
  });
});
