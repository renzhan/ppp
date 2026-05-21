import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parsePlanDocument, generateOptimizationSuggestions, saveEditedSuggestions } from '../../src/report/ai-service.js';
import type { LLMClient } from '../../src/report/llm-client.js';
import type { AllMetrics, Highlight } from '../../src/shared/types.js';

// Mock the db module
vi.mock('../../src/shared/db.js', () => {
  const mockPrisma = {
    aiGeneratedContent: {
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
  };
  return {
    getPrismaClient: () => mockPrisma,
    prisma: mockPrisma,
  };
});

function createMockLLMClient(response: string): LLMClient {
  return {
    chat: vi.fn().mockResolvedValue(response),
  };
}

describe('parsePlanDocument', () => {
  it('should parse a valid JSON response from LLM', async () => {
    const llmResponse = JSON.stringify({
      objective: '提升品牌知名度',
      strategy: '通过KOL种草实现品牌曝光',
      targetAudience: '18-35岁女性用户',
      keyMessages: ['天然成分', '高性价比'],
      budget: 500000,
      timeline: '2024年Q1',
    });

    const client = createMockLLMClient(llmResponse);
    const document = Buffer.from('这是一份策划案文档内容');

    const result = await parsePlanDocument(document, client);

    expect(result.objective).toBe('提升品牌知名度');
    expect(result.strategy).toBe('通过KOL种草实现品牌曝光');
    expect(result.targetAudience).toBe('18-35岁女性用户');
    expect(result.keyMessages).toEqual(['天然成分', '高性价比']);
    expect(result.budget).toBe(500000);
    expect(result.timeline).toBe('2024年Q1');
  });

  it('should handle JSON wrapped in markdown code block', async () => {
    const llmResponse = '```json\n{"objective": "品牌推广", "strategy": "社交媒体营销", "targetAudience": "年轻女性", "keyMessages": ["美白"], "budget": null, "timeline": null}\n```';

    const client = createMockLLMClient(llmResponse);
    const document = Buffer.from('策划案');

    const result = await parsePlanDocument(document, client);

    expect(result.objective).toBe('品牌推广');
    expect(result.strategy).toBe('社交媒体营销');
    expect(result.targetAudience).toBe('年轻女性');
    expect(result.keyMessages).toEqual(['美白']);
    expect(result.budget).toBeUndefined();
    expect(result.timeline).toBeUndefined();
  });

  it('should return fallback when LLM returns fallback message', async () => {
    const client = createMockLLMClient('AI生成失败，请稍后重试');
    const document = Buffer.from('策划案');

    const result = await parsePlanDocument(document, client);

    expect(result.objective).toBe('数据待补充');
    expect(result.strategy).toBe('数据待补充');
    expect(result.targetAudience).toBe('数据待补充');
    expect(result.keyMessages).toEqual([]);
  });

  it('should return fallback when LLM returns invalid JSON', async () => {
    const client = createMockLLMClient('这不是有效的JSON响应');
    const document = Buffer.from('策划案');

    const result = await parsePlanDocument(document, client);

    expect(result.objective).toBe('数据待补充');
    expect(result.strategy).toBe('数据待补充');
    expect(result.targetAudience).toBe('数据待补充');
    expect(result.keyMessages).toEqual([]);
  });

  it('should handle partial/malformed fields gracefully', async () => {
    const llmResponse = JSON.stringify({
      objective: '品牌推广',
      strategy: 123, // wrong type
      targetAudience: null, // null
      keyMessages: 'not an array', // wrong type
    });

    const client = createMockLLMClient(llmResponse);
    const document = Buffer.from('策划案');

    const result = await parsePlanDocument(document, client);

    expect(result.objective).toBe('品牌推广');
    expect(result.strategy).toBe('数据待补充');
    expect(result.targetAudience).toBe('数据待补充');
    expect(result.keyMessages).toEqual([]);
  });

  it('should pass document text to LLM as user message', async () => {
    const mockChat = vi.fn().mockResolvedValue(JSON.stringify({
      objective: 'test',
      strategy: 'test',
      targetAudience: 'test',
      keyMessages: [],
    }));
    const client: LLMClient = { chat: mockChat };
    const documentContent = '这是策划案的具体内容';
    const document = Buffer.from(documentContent);

    await parsePlanDocument(document, client);

    expect(mockChat).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ role: 'system' }),
        expect.objectContaining({ role: 'user', content: documentContent }),
      ]),
      expect.objectContaining({ temperature: 0.3 }),
    );
  });
});

describe('generateOptimizationSuggestions', () => {
  const sampleMetrics: AllMetrics = {
    projectMetrics: {
      totalImpressions: 1000000,
      totalReads: 200000,
      totalEngagement: 50000,
      viralCount: 5,
      viralRate: 0.25,
      cpm: 50,
      cpc: 2.5,
      cpe: 10,
      ctr: 0.2,
      totalCost: 50000,
    },
    kpiResults: {
      impression: { completionRate: 1.2, label: '120%' },
      engagement: { completionRate: 0.8, label: '80%' },
    },
    benchmarkResults: {
      cpm: { percentageDiff: -10, isBetterThanBenchmark: true, label: '优于大盘' },
      cpe: { percentageDiff: 5, isBetterThanBenchmark: false, label: '劣于大盘' },
    },
    kolTierAggregation: [
      {
        tier: '腰部',
        noteCount: 10,
        totalImpressions: 500000,
        totalReads: 100000,
        totalEngagement: 25000,
        averageCPE: 8,
        viralCount: 3,
        viralRate: 0.3,
      },
    ],
    dimensionAggregations: {},
  };

  const sampleHighlights: Highlight[] = [
    {
      type: 'kpi_exceeded',
      metric: 'impression',
      description: '曝光量超额完成KPI目标',
      value: 1200000,
      comparison: 1000000,
    },
  ];

  it('should return LLM-generated suggestions', async () => {
    const suggestions = '## 优化建议\n\n1. 增加腰部达人投放比例...';
    const client = createMockLLMClient(suggestions);

    const result = await generateOptimizationSuggestions(sampleMetrics, sampleHighlights, client);

    expect(result).toBe(suggestions);
  });

  it('should return fallback template when LLM returns fallback message', async () => {
    const client = createMockLLMClient('AI生成失败，请稍后重试');

    const result = await generateOptimizationSuggestions(sampleMetrics, sampleHighlights, client);

    expect(result).toContain('优化建议');
    expect(result).toContain('内容策略优化');
    expect(result).toContain('达人组合优化');
    expect(result).toContain('投流策略优化');
    expect(result).toContain('AI生成失败');
  });

  it('should pass metrics and highlights to LLM', async () => {
    const mockChat = vi.fn().mockResolvedValue('建议内容');
    const client: LLMClient = { chat: mockChat };

    await generateOptimizationSuggestions(sampleMetrics, sampleHighlights, client);

    expect(mockChat).toHaveBeenCalledTimes(1);
    const [messages, options] = mockChat.mock.calls[0];
    expect(messages[0].role).toBe('system');
    expect(messages[1].role).toBe('user');
    expect(messages[1].content).toContain('1000000'); // totalImpressions
    expect(messages[1].content).toContain('曝光量超额完成KPI目标');
    expect(options.temperature).toBe(0.7);
  });
});

describe('saveEditedSuggestions', () => {
  let mockPrisma: any;

  beforeEach(async () => {
    const dbModule = await import('../../src/shared/db.js');
    mockPrisma = (dbModule as any).getPrismaClient();
    mockPrisma.aiGeneratedContent.findFirst.mockReset();
    mockPrisma.aiGeneratedContent.update.mockReset();
    mockPrisma.aiGeneratedContent.create.mockReset();
  });

  it('should update existing record when one exists', async () => {
    const existingRecord = {
      id: 'existing-id-123',
      projectId: 'project-1',
      contentType: 'optimization_suggestions',
      generatedContent: '原始内容',
      editedContent: null,
      isEdited: false,
    };

    mockPrisma.aiGeneratedContent.findFirst.mockResolvedValue(existingRecord);
    mockPrisma.aiGeneratedContent.update.mockResolvedValue({});

    await saveEditedSuggestions('project-1', '编辑后的优化建议');

    expect(mockPrisma.aiGeneratedContent.findFirst).toHaveBeenCalledWith({
      where: {
        projectId: 'project-1',
        contentType: 'optimization_suggestions',
      },
    });
    expect(mockPrisma.aiGeneratedContent.update).toHaveBeenCalledWith({
      where: { id: 'existing-id-123' },
      data: expect.objectContaining({
        editedContent: '编辑后的优化建议',
        isEdited: true,
      }),
    });
  });

  it('should create new record when none exists', async () => {
    mockPrisma.aiGeneratedContent.findFirst.mockResolvedValue(null);
    mockPrisma.aiGeneratedContent.create.mockResolvedValue({});

    await saveEditedSuggestions('project-2', '新的优化建议');

    expect(mockPrisma.aiGeneratedContent.create).toHaveBeenCalledWith({
      data: {
        projectId: 'project-2',
        contentType: 'optimization_suggestions',
        editedContent: '新的优化建议',
        isEdited: true,
      },
    });
  });
});
