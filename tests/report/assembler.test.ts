import { describe, it, expect, vi } from 'vitest';
import { REPORT_MODULE_ORDER, fillPlaceholders } from '../../src/report/assembler.js';

/**
 * Unit tests for the report assembler.
 * Tests module ordering and placeholder logic without requiring a database connection.
 */

// Mock the Prisma client at module level
const mockFindUniqueOrThrow = vi.fn();

vi.mock('../../src/shared/db.js', () => ({
  getPrismaClient: () => ({
    project: {
      findUniqueOrThrow: mockFindUniqueOrThrow,
    },
  }),
}));

describe('Report Assembler', () => {
  describe('REPORT_MODULE_ORDER', () => {
    it('should contain exactly 10 modules', () => {
      expect(REPORT_MODULE_ORDER).toHaveLength(10);
    });

    it('should have modules in the exact required order', () => {
      const expectedOrder = [
        'customer_info',
        'project_review',
        'data_overview',
        'highlights',
        'content_analysis',
        'brand_voice',
        'paid_traffic',
        'conversion_analysis',
        'highlight_summary',
        'optimization_suggestions',
      ];

      const actualOrder = REPORT_MODULE_ORDER.map((m) => m.moduleId);
      expect(actualOrder).toEqual(expectedOrder);
    });

    it('should have correct Chinese titles for each module', () => {
      const expectedTitles: Record<string, string> = {
        customer_info: '客户信息',
        project_review: '项目回顾',
        data_overview: '数据总览',
        highlights: '项目亮点',
        content_analysis: '内容分析',
        brand_voice: '品牌声量分析',
        paid_traffic: '投流分析',
        conversion_analysis: '小程序/转化分析',
        highlight_summary: '亮点总结',
        optimization_suggestions: '优化建议',
      };

      for (const mod of REPORT_MODULE_ORDER) {
        expect(mod.title).toBe(expectedTitles[mod.moduleId]);
      }
    });

    it('should have unique module IDs', () => {
      const ids = REPORT_MODULE_ORDER.map((m) => m.moduleId);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe('fillPlaceholders', () => {
    it('should replace null values with "数据待补充"', () => {
      const data = { field1: null, field2: 'value' };
      const result = fillPlaceholders(data);
      expect(result.field1).toBe('数据待补充');
      expect(result.field2).toBe('value');
    });

    it('should replace undefined values with "数据待补充"', () => {
      const data = { field1: undefined, field2: 42 };
      const result = fillPlaceholders(data);
      expect(result.field1).toBe('数据待补充');
      expect(result.field2).toBe(42);
    });

    it('should recursively handle nested objects', () => {
      const data = {
        outer: {
          inner: null,
          valid: 'ok',
        },
      };
      const result = fillPlaceholders(data);
      expect(result.outer).toEqual({
        inner: '数据待补充',
        valid: 'ok',
      });
    });

    it('should not modify arrays', () => {
      const data = { items: [1, 2, 3] };
      const result = fillPlaceholders(data);
      expect(result.items).toEqual([1, 2, 3]);
    });

    it('should preserve non-null primitive values', () => {
      const data = {
        str: 'hello',
        num: 123,
        bool: true,
        zero: 0,
        emptyStr: '',
      };
      const result = fillPlaceholders(data);
      expect(result.str).toBe('hello');
      expect(result.num).toBe(123);
      expect(result.bool).toBe(true);
      expect(result.zero).toBe(0);
      expect(result.emptyStr).toBe('');
    });

    it('should handle empty object', () => {
      const result = fillPlaceholders({});
      expect(result).toEqual({});
    });

    it('should handle all-null data', () => {
      const data = { a: null, b: null, c: null };
      const result = fillPlaceholders(data);
      expect(result).toEqual({
        a: '数据待补充',
        b: '数据待补充',
        c: '数据待补充',
      });
    });
  });

  describe('assembleReport (mocked Prisma)', () => {
    it('should produce modules in the correct order when called', async () => {
      const mockProject = {
        id: 'test-project-id',
        category: '美妆',
        brand: '测试品牌',
        spuName: null,
        projectName: '测试项目',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-03-31'),
        engagementConfig: { includeShare: true, includeFollow: true },
        cooperationPolicy: { defaultDiscount: 1, specialRules: [] },
        notes: [],
        juguangData: [],
        lingxiData: [],
        manualInputs: [],
        kpiTargets: [],
        calculatedMetrics: [],
        aiGeneratedContent: [],
        competitorData: [],
      };

      mockFindUniqueOrThrow.mockResolvedValue(mockProject);

      const { assembleReport } = await import('../../src/report/assembler.js');
      const report = await assembleReport('test-project-id');

      // Verify module count
      expect(report.modules).toHaveLength(10);

      // Verify exact module order
      const moduleIds = report.modules.map((m) => m.moduleId);
      expect(moduleIds).toEqual([
        'customer_info',
        'project_review',
        'data_overview',
        'highlights',
        'content_analysis',
        'brand_voice',
        'paid_traffic',
        'conversion_analysis',
        'highlight_summary',
        'optimization_suggestions',
      ]);

      // Verify project info is set
      expect(report.projectId).toBe('test-project-id');
      expect(report.project.brand).toBe('测试品牌');
      expect(report.generatedAt).toBeInstanceOf(Date);
    });

    it('should fill placeholders for missing data fields', async () => {
      const mockProject = {
        id: 'test-project-id',
        category: '美妆',
        brand: '测试品牌',
        spuName: null,
        projectName: '测试项目',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-03-31'),
        engagementConfig: { includeShare: true, includeFollow: true },
        cooperationPolicy: { defaultDiscount: 1, specialRules: [] },
        notes: [],
        juguangData: [],
        lingxiData: [],
        manualInputs: [],
        kpiTargets: [],
        calculatedMetrics: [],
        aiGeneratedContent: [],
        competitorData: [],
      };

      mockFindUniqueOrThrow.mockResolvedValue(mockProject);

      const { assembleReport } = await import('../../src/report/assembler.js');
      const report = await assembleReport('test-project-id');

      // customer_info module should have spuName as placeholder since it's null
      const customerInfo = report.modules.find((m) => m.moduleId === 'customer_info');
      expect(customerInfo?.data.spuName).toBe('数据待补充');

      // project_review should have placeholders for missing AI content
      const projectReview = report.modules.find((m) => m.moduleId === 'project_review');
      expect(projectReview?.data.planBackground).toBe('数据待补充');
      expect(projectReview?.data.objective).toBe('数据待补充');
      expect(projectReview?.data.strategy).toBe('数据待补充');

      // highlights should have placeholder
      const highlights = report.modules.find((m) => m.moduleId === 'highlights');
      expect(highlights?.data.highlights).toBe('数据待补充');
    });

    it('should assemble benchmark range data for data_overview module (new range format)', async () => {
      const mockProject = {
        id: 'test-project-id',
        category: '美妆',
        brand: '测试品牌',
        spuName: null,
        projectName: '测试项目',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-03-31'),
        engagementConfig: { includeShare: true, includeFollow: true },
        cooperationPolicy: { defaultDiscount: 1, specialRules: [] },
        notes: [],
        juguangData: [],
        lingxiData: [],
        manualInputs: [
          {
            inputType: 'benchmark',
            dataContent: {
              ctr: { min: 10.59, max: 15.36 },
              cpm: { min: 20, max: 35 },
              cpc: { min: 0.5, max: 1.2 },
              cpe: { min: 2.0, max: 5.5 },
              engagementRate: { min: 3.0, max: 8.0 },
            },
          },
        ],
        kpiTargets: [],
        calculatedMetrics: [],
        aiGeneratedContent: [],
        competitorData: [],
      };

      mockFindUniqueOrThrow.mockResolvedValue(mockProject);

      const { assembleReport } = await import('../../src/report/assembler.js');
      const report = await assembleReport('test-project-id');

      const dataOverview = report.modules.find((m) => m.moduleId === 'data_overview');
      expect(dataOverview?.data.benchmark_ctr_min).toBe(10.59);
      expect(dataOverview?.data.benchmark_ctr_max).toBe(15.36);
      expect(dataOverview?.data.benchmark_ctr_range).toBe('10.59%~15.36%');
      expect(dataOverview?.data.benchmark_cpm_min).toBe(20);
      expect(dataOverview?.data.benchmark_cpm_max).toBe(35);
      expect(dataOverview?.data.benchmark_cpm_range).toBe('20~35');
      expect(dataOverview?.data.benchmark_cpc_min).toBe(0.5);
      expect(dataOverview?.data.benchmark_cpc_max).toBe(1.2);
      expect(dataOverview?.data.benchmark_cpc_range).toBe('0.5~1.2');
      expect(dataOverview?.data.benchmark_cpe_min).toBe(2.0);
      expect(dataOverview?.data.benchmark_cpe_max).toBe(5.5);
      expect(dataOverview?.data.benchmark_cpe_range).toBe('2~5.5');
      expect(dataOverview?.data.benchmark_engagement_rate_min).toBe(3.0);
      expect(dataOverview?.data.benchmark_engagement_rate_max).toBe(8.0);
      expect(dataOverview?.data.benchmark_engagement_rate_range).toBe('3%~8%');
    });

    it('should handle old single-value benchmark format with backward compatibility', async () => {
      const mockProject = {
        id: 'test-project-id',
        category: '美妆',
        brand: '测试品牌',
        spuName: null,
        projectName: '测试项目',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-03-31'),
        engagementConfig: { includeShare: true, includeFollow: true },
        cooperationPolicy: { defaultDiscount: 1, specialRules: [] },
        notes: [],
        juguangData: [],
        lingxiData: [],
        manualInputs: [
          {
            inputType: 'benchmark',
            dataContent: {
              ctr: 12.5,
              cpm: 25,
            },
          },
        ],
        kpiTargets: [],
        calculatedMetrics: [],
        aiGeneratedContent: [],
        competitorData: [],
      };

      mockFindUniqueOrThrow.mockResolvedValue(mockProject);

      const { assembleReport } = await import('../../src/report/assembler.js');
      const report = await assembleReport('test-project-id');

      const dataOverview = report.modules.find((m) => m.moduleId === 'data_overview');
      // Old single-value format should be normalized to min === max
      expect(dataOverview?.data.benchmark_ctr_min).toBe(12.5);
      expect(dataOverview?.data.benchmark_ctr_max).toBe(12.5);
      // When min === max, display as single value with suffix
      expect(dataOverview?.data.benchmark_ctr).toBe('12.5%');
      expect(dataOverview?.data.benchmark_ctr_range).toBe('12.5%~12.5%');
      expect(dataOverview?.data.benchmark_cpm_min).toBe(25);
      expect(dataOverview?.data.benchmark_cpm_max).toBe(25);
      expect(dataOverview?.data.benchmark_cpm).toBe('25');
    });
  });
});
