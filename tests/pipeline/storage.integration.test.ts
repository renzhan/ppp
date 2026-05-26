import { describe, it, expect, vi } from 'vitest';
import { ReportPipelineOrchestrator, ChapterResult } from '../../src/pipeline/orchestrator';
import { ChapterDataLoaderRegistry } from '../../src/pipeline/loaders/types';
import { PromptTemplateLoader } from '../../src/pipeline/template-loader';
import type { LLMClient } from '../../src/report/llm-client';

/**
 * Integration Test: ReviewConfig.reportContent Storage
 *
 * Verifies the JSON structure written to ReviewConfig.reportContent
 * matches the ChapterResult[] schema.
 *
 * **Validates: Requirements 6.1**
 */
describe('ReviewConfig.reportContent Storage Integration', () => {
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
        systemPrompt: chapterNumber === 1 || chapterNumber === 10 ? '' : '你是一位营销复盘专家。',
        userPromptTemplate: `Template for chapter ${chapterNumber}`,
      })),
      substituteVariables: vi.fn(() => 'Substituted content'),
    } as unknown as PromptTemplateLoader;
  }

  function createMockLoaderRegistry(): ChapterDataLoaderRegistry {
    return {
      loadChapterData: vi.fn(async () => ({
        variables: { project_name: '测试项目', brand: '测试品牌' },
        missingFields: [],
      })),
    } as unknown as ChapterDataLoaderRegistry;
  }

  function createMockLLMClient(): LLMClient {
    return {
      chat: vi.fn(async () => '生成的报告内容。\n\n包含多个段落的分析。'),
    };
  }

  describe('Requirement 6.1: reportContent JSON structure matches ChapterResult[] schema', () => {
    it('should store reportContent as a JSON array of exactly 10 ChapterResult elements', async () => {
      let storedContent: any = null;

      const mockPrisma = {
        reviewConfig: {
          update: vi.fn(async (args: any) => {
            storedContent = args.data.reportContent;
            return {};
          }),
        },
        reportVersion: {
          findFirst: vi.fn(async () => null),
          create: vi.fn(async () => ({ id: 'v1', versionNumber: 1 })),
        },
      } as any;

      const orchestrator = new ReportPipelineOrchestrator(
        createMockLoaderRegistry(),
        createMockTemplateLoader(),
        createMockLLMClient(),
        mockPrisma,
      );

      await orchestrator.generateFullReport({
        projectId: 'project-001',
        reviewConfigId: 'review-config-001',
      });

      // Verify it's an array of exactly 10 elements
      expect(Array.isArray(storedContent)).toBe(true);
      expect(storedContent).toHaveLength(10);
    });

    it('should have each element with required ChapterResult fields', async () => {
      let storedContent: ChapterResult[] = [];

      const mockPrisma = {
        reviewConfig: {
          update: vi.fn(async (args: any) => {
            storedContent = args.data.reportContent;
            return {};
          }),
        },
        reportVersion: {
          findFirst: vi.fn(async () => null),
          create: vi.fn(async () => ({ id: 'v1', versionNumber: 1 })),
        },
      } as any;

      const orchestrator = new ReportPipelineOrchestrator(
        createMockLoaderRegistry(),
        createMockTemplateLoader(),
        createMockLLMClient(),
        mockPrisma,
      );

      await orchestrator.generateFullReport({
        projectId: 'project-001',
        reviewConfigId: 'review-config-001',
      });

      for (const chapter of storedContent) {
        // chapterNumber: integer 1-10
        expect(typeof chapter.chapterNumber).toBe('number');
        expect(chapter.chapterNumber).toBeGreaterThanOrEqual(1);
        expect(chapter.chapterNumber).toBeLessThanOrEqual(10);
        expect(Number.isInteger(chapter.chapterNumber)).toBe(true);

        // title: non-empty string
        expect(typeof chapter.title).toBe('string');
        expect(chapter.title.length).toBeGreaterThan(0);

        // content: string
        expect(typeof chapter.content).toBe('string');

        // status: 'generated' | 'error'
        expect(['generated', 'error']).toContain(chapter.status);

        // generatedAt: valid ISO 8601 timestamp
        expect(typeof chapter.generatedAt).toBe('string');
        const parsedDate = new Date(chapter.generatedAt);
        expect(parsedDate.toISOString()).toBe(chapter.generatedAt);
      }
    });

    it('should have unique, sequential chapter numbers from 1 to 10', async () => {
      let storedContent: ChapterResult[] = [];

      const mockPrisma = {
        reviewConfig: {
          update: vi.fn(async (args: any) => {
            storedContent = args.data.reportContent;
            return {};
          }),
        },
        reportVersion: {
          findFirst: vi.fn(async () => null),
          create: vi.fn(async () => ({ id: 'v1', versionNumber: 1 })),
        },
      } as any;

      const orchestrator = new ReportPipelineOrchestrator(
        createMockLoaderRegistry(),
        createMockTemplateLoader(),
        createMockLLMClient(),
        mockPrisma,
      );

      await orchestrator.generateFullReport({
        projectId: 'project-001',
        reviewConfigId: 'review-config-001',
      });

      const chapterNumbers = storedContent.map((c) => c.chapterNumber);
      expect(chapterNumbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    });

    it('should store non-empty content for all successfully generated chapters', async () => {
      let storedContent: ChapterResult[] = [];

      const mockPrisma = {
        reviewConfig: {
          update: vi.fn(async (args: any) => {
            storedContent = args.data.reportContent;
            return {};
          }),
        },
        reportVersion: {
          findFirst: vi.fn(async () => null),
          create: vi.fn(async () => ({ id: 'v1', versionNumber: 1 })),
        },
      } as any;

      const orchestrator = new ReportPipelineOrchestrator(
        createMockLoaderRegistry(),
        createMockTemplateLoader(),
        createMockLLMClient(),
        mockPrisma,
      );

      await orchestrator.generateFullReport({
        projectId: 'project-001',
        reviewConfigId: 'review-config-001',
      });

      for (const chapter of storedContent) {
        if (chapter.status === 'generated') {
          expect(chapter.content.length).toBeGreaterThan(0);
        }
      }
    });

    it('should include errorMessage field only for chapters with error status', async () => {
      // Create an LLM client that fails for chapter 3
      let callCount = 0;
      const failingLLMClient: LLMClient = {
        chat: vi.fn(async () => {
          callCount++;
          if (callCount === 2) { // ch3 is the 2nd LLM call (ch2=1st, ch3=2nd)
            throw new Error('LLM timeout');
          }
          return '正常生成的内容。\n\n第二段。';
        }),
      };

      let storedContent: ChapterResult[] = [];

      const mockPrisma = {
        reviewConfig: {
          update: vi.fn(async (args: any) => {
            storedContent = args.data.reportContent;
            return {};
          }),
        },
        reportVersion: {
          findFirst: vi.fn(async () => null),
          create: vi.fn(async () => ({ id: 'v1', versionNumber: 1 })),
        },
      } as any;

      const orchestrator = new ReportPipelineOrchestrator(
        createMockLoaderRegistry(),
        createMockTemplateLoader(),
        failingLLMClient,
        mockPrisma,
      );

      await orchestrator.generateFullReport({
        projectId: 'project-001',
        reviewConfigId: 'review-config-001',
      });

      // Chapter 3 should have error status with errorMessage
      const ch3 = storedContent[2];
      expect(ch3.status).toBe('error');
      expect(ch3.errorMessage).toBeDefined();
      expect(ch3.errorMessage!.length).toBeGreaterThan(0);

      // Other chapters should not have errorMessage (or it should be undefined)
      for (const chapter of storedContent) {
        if (chapter.status === 'generated') {
          expect(chapter.errorMessage).toBeUndefined();
        }
      }
    });

    it('should store content that is JSON-serializable', async () => {
      let storedContent: ChapterResult[] = [];

      const mockPrisma = {
        reviewConfig: {
          update: vi.fn(async (args: any) => {
            storedContent = args.data.reportContent;
            return {};
          }),
        },
        reportVersion: {
          findFirst: vi.fn(async () => null),
          create: vi.fn(async () => ({ id: 'v1', versionNumber: 1 })),
        },
      } as any;

      const orchestrator = new ReportPipelineOrchestrator(
        createMockLoaderRegistry(),
        createMockTemplateLoader(),
        createMockLLMClient(),
        mockPrisma,
      );

      await orchestrator.generateFullReport({
        projectId: 'project-001',
        reviewConfigId: 'review-config-001',
      });

      // Verify the content can be serialized and deserialized without loss
      const serialized = JSON.stringify(storedContent);
      const deserialized = JSON.parse(serialized) as ChapterResult[];

      expect(deserialized).toHaveLength(10);
      for (let i = 0; i < 10; i++) {
        expect(deserialized[i].chapterNumber).toBe(storedContent[i].chapterNumber);
        expect(deserialized[i].title).toBe(storedContent[i].title);
        expect(deserialized[i].content).toBe(storedContent[i].content);
        expect(deserialized[i].status).toBe(storedContent[i].status);
        expect(deserialized[i].generatedAt).toBe(storedContent[i].generatedAt);
      }
    });
  });
});
