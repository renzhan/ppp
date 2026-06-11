import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import { ReportPipelineOrchestrator, ChapterResult } from '../../src/pipeline/orchestrator';
import { ChapterDataLoaderRegistry } from '../../src/pipeline/loaders/types';
import { PromptTemplateLoader } from '../../src/pipeline/template-loader';
import type { LLMClient } from '../../src/report/llm-client';

/**
 * Property 7: Report content structural invariant
 * Validates: Requirements 4.3, 6.1
 *
 * For any successfully generated report, reportContent SHALL be a JSON array
 * of exactly 10 elements where each element has:
 * - chapterNumber (integer 1-10, unique, sequential)
 * - title (non-empty string)
 * - content (string)
 * - status ('generated' | 'error')
 * - generatedAt (valid ISO 8601 timestamp)
 */
describe('Feature: report-generation-pipeline, Property 7: Report content structural invariant', () => {
  // Chapter metadata
  const chapterNames = [
    '封面', '项目回顾', '数据总览', '项目亮点', '综合分析',
    '内容分析', '投流分析', '人群资产', '优化建议', '尾页',
  ];

  function createMockTemplateLoader(): PromptTemplateLoader {
    return {
      loadTemplate: vi.fn((chapterNumber: number) => ({
        metadata: {
          chapter_number: chapterNumber,
          chapter_name: chapterNames[chapterNumber - 1],
          required_data_sources: ['projects'],
          output_format: 'paragraphs' as const,
          fallback_text: `${chapterNames[chapterNumber - 1]}内容生成失败，请重试。`,
        },
        systemPrompt: chapterNumber === 1 || chapterNumber === 10 ? '' : 'You are an expert.',
        userPromptTemplate: `Template for chapter ${chapterNumber}`,
      })),
      substituteVariables: vi.fn(() => 'Substituted content'),
    } as unknown as PromptTemplateLoader;
  }

  function createMockLoaderRegistry(): ChapterDataLoaderRegistry {
    return {
      loadChapterData: vi.fn(async () => ({
        variables: { project_name: 'Test', brand: 'Brand' },
        missingFields: [],
      })),
    } as unknown as ChapterDataLoaderRegistry;
  }

  function createMockPrisma() {
    return {
      reviewConfig: {
        update: vi.fn(async () => ({})),
      },
      reportVersion: {
        findFirst: vi.fn(async () => null),
        create: vi.fn(async () => ({ id: 'v-1', versionNumber: 1 })),
      },
    } as any;
  }

  // Generator for LLM response content (non-empty paragraphs)
  const llmResponseArb = fc.array(
    fc.string({ minLength: 5, maxLength: 100 }).filter((s) => s.trim().length > 0),
    { minLength: 1, maxLength: 3 }
  ).map((paragraphs) => paragraphs.join('\n\n'));

  // Generator for a set of chapters that should fail (subset of active non-static chapters: 2-7, 9)
  const failingChaptersArb = fc.subarray(
    [2, 3, 4, 5, 6, 7, 9],
    { minLength: 0, maxLength: 4 }
  );

  // Active chapters (chapter 8 excluded per requirement 7.1)
  const activeChapterNumbers = [1, 2, 3, 4, 5, 6, 7, 9, 10];
  const activeChapterCount = activeChapterNumbers.length; // 9

  it('should always produce exactly 10 chapters in the report', async () => {
    await fc.assert(
      fc.asyncProperty(
        failingChaptersArb,
        llmResponseArb,
        async (failingChapters, llmResponse) => {
          const templateLoader = createMockTemplateLoader();
          const loaderRegistry = createMockLoaderRegistry();
          const mockPrisma = createMockPrisma();

          let callCount = 0;
          const llmClient: LLMClient = {
            chat: vi.fn(async () => {
              callCount++;
              const currentChapter = callCount + 1;
              if (failingChapters.includes(currentChapter)) {
                throw new Error('LLM failure');
              }
              return llmResponse;
            }),
          };

          const orchestrator = new ReportPipelineOrchestrator(
            loaderRegistry,
            templateLoader,
            llmClient,
            mockPrisma,
          );

          const result = await orchestrator.generateFullReport({
            projectId: 'p-1',
            reviewConfigId: 'rc-1',
          });

          // Exactly 9 chapters (chapter 8 excluded)
          expect(result.chapters).toHaveLength(activeChapterCount);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should have sequential chapter numbers 1-10, each unique', async () => {
    await fc.assert(
      fc.asyncProperty(
        failingChaptersArb,
        llmResponseArb,
        async (failingChapters, llmResponse) => {
          const templateLoader = createMockTemplateLoader();
          const loaderRegistry = createMockLoaderRegistry();
          const mockPrisma = createMockPrisma();

          let callCount = 0;
          const llmClient: LLMClient = {
            chat: vi.fn(async () => {
              callCount++;
              const currentChapter = callCount + 1;
              if (failingChapters.includes(currentChapter)) {
                throw new Error('LLM failure');
              }
              return llmResponse;
            }),
          };

          const orchestrator = new ReportPipelineOrchestrator(
            loaderRegistry,
            templateLoader,
            llmClient,
            mockPrisma,
          );

          const result = await orchestrator.generateFullReport({
            projectId: 'p-1',
            reviewConfigId: 'rc-1',
          });

          // Chapter numbers should match active chapters (chapter 8 excluded)
          const chapterNumbers = result.chapters.map((c) => c.chapterNumber);
          expect(chapterNumbers).toEqual(activeChapterNumbers);

          // All unique
          const uniqueNumbers = new Set(chapterNumbers);
          expect(uniqueNumbers.size).toBe(activeChapterCount);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should have non-empty title for every chapter', async () => {
    await fc.assert(
      fc.asyncProperty(
        failingChaptersArb,
        llmResponseArb,
        async (failingChapters, llmResponse) => {
          const templateLoader = createMockTemplateLoader();
          const loaderRegistry = createMockLoaderRegistry();
          const mockPrisma = createMockPrisma();

          let callCount = 0;
          const llmClient: LLMClient = {
            chat: vi.fn(async () => {
              callCount++;
              const currentChapter = callCount + 1;
              if (failingChapters.includes(currentChapter)) {
                throw new Error('LLM failure');
              }
              return llmResponse;
            }),
          };

          const orchestrator = new ReportPipelineOrchestrator(
            loaderRegistry,
            templateLoader,
            llmClient,
            mockPrisma,
          );

          const result = await orchestrator.generateFullReport({
            projectId: 'p-1',
            reviewConfigId: 'rc-1',
          });

          for (const chapter of result.chapters) {
            expect(typeof chapter.title).toBe('string');
            expect(chapter.title.length).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should have valid status and content for every chapter', async () => {
    await fc.assert(
      fc.asyncProperty(
        failingChaptersArb,
        llmResponseArb,
        async (failingChapters, llmResponse) => {
          const templateLoader = createMockTemplateLoader();
          const loaderRegistry = createMockLoaderRegistry();
          const mockPrisma = createMockPrisma();

          let callCount = 0;
          const llmClient: LLMClient = {
            chat: vi.fn(async () => {
              callCount++;
              const currentChapter = callCount + 1;
              if (failingChapters.includes(currentChapter)) {
                throw new Error('LLM failure');
              }
              return llmResponse;
            }),
          };

          const orchestrator = new ReportPipelineOrchestrator(
            loaderRegistry,
            templateLoader,
            llmClient,
            mockPrisma,
          );

          const result = await orchestrator.generateFullReport({
            projectId: 'p-1',
            reviewConfigId: 'rc-1',
          });

          for (const chapter of result.chapters) {
            // Status must be one of the valid values
            expect(['generated', 'error']).toContain(chapter.status);

            // Content must be a string
            expect(typeof chapter.content).toBe('string');

            // generatedAt must be a valid ISO 8601 timestamp
            expect(typeof chapter.generatedAt).toBe('string');
            const date = new Date(chapter.generatedAt);
            expect(date.toISOString()).toBe(chapter.generatedAt);
            expect(isNaN(date.getTime())).toBe(false);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should satisfy all structural invariants simultaneously', async () => {
    await fc.assert(
      fc.asyncProperty(
        failingChaptersArb,
        llmResponseArb,
        async (failingChapters, llmResponse) => {
          const templateLoader = createMockTemplateLoader();
          const loaderRegistry = createMockLoaderRegistry();
          const mockPrisma = createMockPrisma();

          let callCount = 0;
          const llmClient: LLMClient = {
            chat: vi.fn(async () => {
              callCount++;
              const currentChapter = callCount + 1;
              if (failingChapters.includes(currentChapter)) {
                throw new Error('LLM failure');
              }
              return llmResponse;
            }),
          };

          const orchestrator = new ReportPipelineOrchestrator(
            loaderRegistry,
            templateLoader,
            llmClient,
            mockPrisma,
          );

          const result = await orchestrator.generateFullReport({
            projectId: 'p-1',
            reviewConfigId: 'rc-1',
          });

          // Exactly 9 elements (chapter 8 excluded)
          expect(result.chapters).toHaveLength(activeChapterCount);

          for (let i = 0; i < activeChapterCount; i++) {
            const chapter = result.chapters[i];

            // chapterNumber matches active chapter numbers
            expect(chapter.chapterNumber).toBe(activeChapterNumbers[i]);
            expect(Number.isInteger(chapter.chapterNumber)).toBe(true);

            // title is non-empty string
            expect(typeof chapter.title).toBe('string');
            expect(chapter.title.length).toBeGreaterThan(0);

            // content is string
            expect(typeof chapter.content).toBe('string');

            // status is valid
            expect(['generated', 'error']).toContain(chapter.status);

            // generatedAt is valid ISO 8601
            const date = new Date(chapter.generatedAt);
            expect(isNaN(date.getTime())).toBe(false);
            expect(chapter.generatedAt).toBe(date.toISOString());
          }
        }
      ),
      { numRuns: 20 }
    );
  });
});
