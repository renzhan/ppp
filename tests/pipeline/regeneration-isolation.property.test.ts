import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import { ReportPipelineOrchestrator, ChapterResult } from '../../src/pipeline/orchestrator';
import { ChapterDataLoaderRegistry } from '../../src/pipeline/loaders/types';
import { PromptTemplateLoader } from '../../src/pipeline/template-loader';
import type { LLMClient } from '../../src/report/llm-client';

/**
 * Property 8: Single chapter regeneration isolation
 * Validates: Requirements 8.1, 8.2, 8.3
 *
 * For any chapter index N (1-10) and any existing reportContent array of 10 chapters,
 * after regenerating chapter N:
 * (a) only the element at index N-1 is modified,
 * (b) all other 9 elements remain byte-for-byte identical,
 * (c) the regenerated chapter has a generatedAt timestamp newer than its previous value, and
 * (d) the regenerated chapter has status: 'generated'.
 */
describe('Feature: report-generation-pipeline, Property 8: Single chapter regeneration isolation', () => {
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
      substituteVariables: vi.fn(() => 'Regenerated substituted content'),
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
    } as any;
  }

  // Use a fixed past timestamp to ensure the regenerated one is always newer
  const pastTimestamp = new Date('2024-01-01T00:00:00.000Z').toISOString();

  // Generator for a valid ChapterResult with content that differs from what regeneration produces
  const chapterResultArb = (chapterNumber: number): fc.Arbitrary<ChapterResult> =>
    fc.record({
      chapterNumber: fc.constant(chapterNumber),
      title: fc.constant(chapterNames[chapterNumber - 1]),
      content: fc.constant(`Original content for chapter ${chapterNumber}`),
      status: fc.constant('generated' as const),
      generatedAt: fc.constant(pastTimestamp),
    });

  // Generator for a full 10-chapter existing report content
  const existingContentArb: fc.Arbitrary<ChapterResult[]> = fc.tuple(
    chapterResultArb(1),
    chapterResultArb(2),
    chapterResultArb(3),
    chapterResultArb(4),
    chapterResultArb(5),
    chapterResultArb(6),
    chapterResultArb(7),
    chapterResultArb(8),
    chapterResultArb(9),
    chapterResultArb(10),
  ).map((chapters) => chapters);

  it('should only modify the target chapter (property a & b)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }),
        existingContentArb,
        async (targetChapter, existingContent) => {
          const templateLoader = createMockTemplateLoader();
          const loaderRegistry = createMockLoaderRegistry();
          const mockPrisma = createMockPrisma();

          const llmClient: LLMClient = {
            chat: vi.fn(async () => 'Newly regenerated content.\n\nSecond paragraph.'),
          };

          const orchestrator = new ReportPipelineOrchestrator(
            loaderRegistry,
            templateLoader,
            llmClient,
            mockPrisma,
          );

          // Deep copy existing content for comparison
          const originalContent = JSON.parse(JSON.stringify(existingContent));

          await orchestrator.regenerateChapter(
            { projectId: 'p-1', reviewConfigId: 'rc-1' },
            targetChapter,
            existingContent,
          );

          // Verify the Prisma update was called with the correct data
          const updateCall = mockPrisma.reviewConfig.update.mock.calls[0][0];
          const updatedContent = updateCall.data.reportContent as ChapterResult[];

          // (b) All other 9 elements remain byte-for-byte identical
          for (let i = 0; i < 10; i++) {
            if (i !== targetChapter - 1) {
              expect(JSON.stringify(updatedContent[i])).toBe(
                JSON.stringify(originalContent[i])
              );
            }
          }

          // (a) The element at index N-1 has been modified (at least generatedAt changed)
          expect(updatedContent[targetChapter - 1].generatedAt).not.toBe(
            originalContent[targetChapter - 1].generatedAt
          );
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should have a newer generatedAt timestamp (property c)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }),
        existingContentArb,
        async (targetChapter, existingContent) => {
          const templateLoader = createMockTemplateLoader();
          const loaderRegistry = createMockLoaderRegistry();
          const mockPrisma = createMockPrisma();

          const llmClient: LLMClient = {
            chat: vi.fn(async () => 'Regenerated content.\n\nMore text.'),
          };

          const orchestrator = new ReportPipelineOrchestrator(
            loaderRegistry,
            templateLoader,
            llmClient,
            mockPrisma,
          );

          const previousTimestamp = existingContent[targetChapter - 1].generatedAt;

          const regeneratedChapter = await orchestrator.regenerateChapter(
            { projectId: 'p-1', reviewConfigId: 'rc-1' },
            targetChapter,
            existingContent,
          );

          // (c) The regenerated chapter has a generatedAt timestamp newer than its previous value
          const previousDate = new Date(previousTimestamp);
          const newDate = new Date(regeneratedChapter.generatedAt);
          expect(newDate.getTime()).toBeGreaterThan(previousDate.getTime());
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should have status generated for the regenerated chapter (property d)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }),
        existingContentArb,
        async (targetChapter, existingContent) => {
          const templateLoader = createMockTemplateLoader();
          const loaderRegistry = createMockLoaderRegistry();
          const mockPrisma = createMockPrisma();

          const llmClient: LLMClient = {
            chat: vi.fn(async () => 'Fresh content.\n\nAnother paragraph.'),
          };

          const orchestrator = new ReportPipelineOrchestrator(
            loaderRegistry,
            templateLoader,
            llmClient,
            mockPrisma,
          );

          const regeneratedChapter = await orchestrator.regenerateChapter(
            { projectId: 'p-1', reviewConfigId: 'rc-1' },
            targetChapter,
            existingContent,
          );

          // (d) The regenerated chapter has status: 'generated'
          expect(regeneratedChapter.status).toBe('generated');
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should satisfy all isolation properties simultaneously', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }),
        existingContentArb,
        async (targetChapter, existingContent) => {
          const templateLoader = createMockTemplateLoader();
          const loaderRegistry = createMockLoaderRegistry();
          const mockPrisma = createMockPrisma();

          const llmClient: LLMClient = {
            chat: vi.fn(async () => 'Complete regenerated content.\n\nWith paragraphs.'),
          };

          const orchestrator = new ReportPipelineOrchestrator(
            loaderRegistry,
            templateLoader,
            llmClient,
            mockPrisma,
          );

          // Deep copy for comparison
          const originalContent = JSON.parse(JSON.stringify(existingContent));
          const previousTimestamp = existingContent[targetChapter - 1].generatedAt;

          const regeneratedChapter = await orchestrator.regenerateChapter(
            { projectId: 'p-1', reviewConfigId: 'rc-1' },
            targetChapter,
            existingContent,
          );

          // Get the updated content from the Prisma update call
          const updateCall = mockPrisma.reviewConfig.update.mock.calls[0][0];
          const updatedContent = updateCall.data.reportContent as ChapterResult[];

          // (a) The element at index N-1 is modified
          expect(updatedContent[targetChapter - 1].generatedAt).not.toBe(
            originalContent[targetChapter - 1].generatedAt
          );

          // (b) All other 9 elements remain byte-for-byte identical
          for (let i = 0; i < 10; i++) {
            if (i !== targetChapter - 1) {
              expect(JSON.stringify(updatedContent[i])).toBe(
                JSON.stringify(originalContent[i])
              );
            }
          }

          // (c) Newer timestamp
          const newDate = new Date(regeneratedChapter.generatedAt);
          const prevDate = new Date(previousTimestamp);
          expect(newDate.getTime()).toBeGreaterThan(prevDate.getTime());

          // (d) Status is 'generated'
          expect(regeneratedChapter.status).toBe('generated');
        }
      ),
      { numRuns: 20 }
    );
  });
});
