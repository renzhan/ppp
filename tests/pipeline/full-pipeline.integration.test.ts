import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReportPipelineOrchestrator, ChapterResult, PipelineResult } from '../../src/pipeline/orchestrator';
import { ChapterDataLoaderRegistry } from '../../src/pipeline/loaders/types';
import { PromptTemplateLoader } from '../../src/pipeline/template-loader';
import type { LLMClient } from '../../src/report/llm-client';

/**
 * Integration Test: Full Pipeline End-to-End with Mocked LLM
 *
 * Verifies:
 * - All 10 chapters are generated
 * - reportContent is written to ReviewConfig
 * - ReportVersion is created
 *
 * **Validates: Requirements 4.1, 4.4, 4.6**
 */
describe('Full Pipeline Integration (mocked LLM)', () => {
  const chapterNames = [
    '封面', '项目回顾', '数据总览', '项目亮点', '综合分析',
    '内容分析', '投流分析', '人群资产', '优化建议', '尾页',
  ];

  // Chapter 8 (人群资产) is excluded per requirement 7.1
  const activeChapterNumbers = [1, 2, 3, 4, 5, 6, 7, 9, 10];
  const activeChapterCount = activeChapterNumbers.length; // 9

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
        userPromptTemplate: `Template for chapter ${chapterNumber}: {{project_name}}`,
      })),
      substituteVariables: vi.fn((_template: string, _variables: Record<string, string>) => {
        return 'Substituted prompt content';
      }),
    } as unknown as PromptTemplateLoader;
  }

  function createMockLoaderRegistry(): ChapterDataLoaderRegistry {
    return {
      loadChapterData: vi.fn(async () => ({
        variables: { project_name: '测试品牌_日常种草_2025Q1', brand: '测试品牌' },
        missingFields: [],
      })),
    } as unknown as ChapterDataLoaderRegistry;
  }

  function createMockPrisma() {
    const updateMock = vi.fn(async () => ({}));
    const findFirstMock = vi.fn(async () => null);
    const createMock = vi.fn(async () => ({
      id: 'version-abc-123',
      versionNumber: 1,
    }));

    return {
      reviewConfig: { update: updateMock },
      reportVersion: { findFirst: findFirstMock, create: createMock },
      _mocks: { update: updateMock, findFirst: findFirstMock, create: createMock },
    } as any;
  }

  function createMockLLMClient(): LLMClient {
    return {
      chat: vi.fn(async () => {
        return '这是LLM生成的内容。\n\n第二段落，包含数据分析。';
      }),
    };
  }

  describe('Requirement 4.1: Generate all 10 chapters in sequence', () => {
    it('should generate exactly 10 chapters with correct chapter numbers', async () => {
      const templateLoader = createMockTemplateLoader();
      const loaderRegistry = createMockLoaderRegistry();
      const mockPrisma = createMockPrisma();
      const llmClient = createMockLLMClient();

      const orchestrator = new ReportPipelineOrchestrator(
        loaderRegistry,
        templateLoader,
        llmClient,
        mockPrisma,
      );

      const result = await orchestrator.generateFullReport({
        projectId: 'project-001',
        reviewConfigId: 'review-config-001',
      });

      expect(result.chapters).toHaveLength(activeChapterCount);

      for (let i = 0; i < activeChapterCount; i++) {
        expect(result.chapters[i].chapterNumber).toBe(activeChapterNumbers[i]);
        expect(result.chapters[i].title).toBe(chapterNames[activeChapterNumbers[i] - 1]);
        expect(result.chapters[i].status).toBe('generated');
        expect(result.chapters[i].content).toBeTruthy();
        expect(result.chapters[i].generatedAt).toBeTruthy();
        // Verify generatedAt is a valid ISO 8601 timestamp
        expect(new Date(result.chapters[i].generatedAt).toISOString()).toBe(result.chapters[i].generatedAt);
      }
    });

    it('should call data loader for each chapter in order', async () => {
      const templateLoader = createMockTemplateLoader();
      const loaderRegistry = createMockLoaderRegistry();
      const mockPrisma = createMockPrisma();
      const llmClient = createMockLLMClient();

      const orchestrator = new ReportPipelineOrchestrator(
        loaderRegistry,
        templateLoader,
        llmClient,
        mockPrisma,
      );

      await orchestrator.generateFullReport({
        projectId: 'project-001',
        reviewConfigId: 'review-config-001',
      });

      // Data loader should be called for each active chapter
      expect(loaderRegistry.loadChapterData).toHaveBeenCalledTimes(activeChapterCount);

      for (const chNum of activeChapterNumbers) {
        expect(loaderRegistry.loadChapterData).toHaveBeenCalledWith(chNum, 'project-001');
      }
    });
  });

  describe('Requirement 4.4: Write reportContent to ReviewConfig', () => {
    it('should write all 10 chapters to ReviewConfig.reportContent', async () => {
      const templateLoader = createMockTemplateLoader();
      const loaderRegistry = createMockLoaderRegistry();
      const mockPrisma = createMockPrisma();
      const llmClient = createMockLLMClient();

      const orchestrator = new ReportPipelineOrchestrator(
        loaderRegistry,
        templateLoader,
        llmClient,
        mockPrisma,
      );

      await orchestrator.generateFullReport({
        projectId: 'project-001',
        reviewConfigId: 'review-config-001',
      });

      // Verify ReviewConfig.update was called
      expect(mockPrisma.reviewConfig.update).toHaveBeenCalledTimes(1);

      const updateCall = mockPrisma.reviewConfig.update.mock.calls[0][0];
      expect(updateCall.where.id).toBe('review-config-001');
      expect(updateCall.data.reportContent).toHaveLength(activeChapterCount);
      expect(updateCall.data.status).toBe('completed');

      // Verify each chapter in the stored content
      const storedContent = updateCall.data.reportContent as ChapterResult[];
      for (let i = 0; i < activeChapterCount; i++) {
        expect(storedContent[i].chapterNumber).toBe(activeChapterNumbers[i]);
        expect(storedContent[i].title).toBe(chapterNames[activeChapterNumbers[i] - 1]);
        expect(storedContent[i].status).toBe('generated');
      }
    });
  });

  describe('Requirement 4.6: Create ReportVersion record', () => {
    it('should create a ReportVersion with version number 1 for first generation', async () => {
      const templateLoader = createMockTemplateLoader();
      const loaderRegistry = createMockLoaderRegistry();
      const mockPrisma = createMockPrisma();
      const llmClient = createMockLLMClient();

      const orchestrator = new ReportPipelineOrchestrator(
        loaderRegistry,
        templateLoader,
        llmClient,
        mockPrisma,
      );

      const result = await orchestrator.generateFullReport({
        projectId: 'project-001',
        reviewConfigId: 'review-config-001',
      });

      // Verify ReportVersion.create was called
      expect(mockPrisma.reportVersion.create).toHaveBeenCalledTimes(1);

      const createCall = mockPrisma.reportVersion.create.mock.calls[0][0];
      expect(createCall.data.projectId).toBe('project-001');
      expect(createCall.data.versionNumber).toBe(1);
      expect(createCall.data.content).toHaveLength(activeChapterCount);
      expect(createCall.data.status).toBe('draft');

      // Verify result contains version info
      expect(result.versionId).toBe('version-abc-123');
      expect(result.versionNumber).toBe(1);
    });

    it('should increment version number when previous versions exist', async () => {
      const templateLoader = createMockTemplateLoader();
      const loaderRegistry = createMockLoaderRegistry();
      const llmClient = createMockLLMClient();

      const mockPrisma = createMockPrisma();
      // Simulate existing version
      mockPrisma.reportVersion.findFirst = vi.fn(async () => ({
        id: 'version-prev',
        versionNumber: 3,
      }));
      mockPrisma.reportVersion.create = vi.fn(async () => ({
        id: 'version-new',
        versionNumber: 4,
      }));

      const orchestrator = new ReportPipelineOrchestrator(
        loaderRegistry,
        templateLoader,
        llmClient,
        mockPrisma,
      );

      const result = await orchestrator.generateFullReport({
        projectId: 'project-001',
        reviewConfigId: 'review-config-001',
      });

      const createCall = mockPrisma.reportVersion.create.mock.calls[0][0];
      expect(createCall.data.versionNumber).toBe(4);
      expect(result.versionNumber).toBe(4);
    });
  });

  describe('Static chapters (1 and 10) do not call LLM', () => {
    it('should not call LLM for chapters 1 and 10', async () => {
      const templateLoader = createMockTemplateLoader();
      const loaderRegistry = createMockLoaderRegistry();
      const mockPrisma = createMockPrisma();
      const llmClient = createMockLLMClient();

      const orchestrator = new ReportPipelineOrchestrator(
        loaderRegistry,
        templateLoader,
        llmClient,
        mockPrisma,
      );

      await orchestrator.generateFullReport({
        projectId: 'project-001',
        reviewConfigId: 'review-config-001',
      });

      // LLM should be called for non-static chapters only (chapters 2-7, 9 = 7 calls)
      // Chapters 1 and 10 are static, chapter 8 is excluded
      expect(llmClient.chat).toHaveBeenCalledTimes(7);
    });
  });
});
