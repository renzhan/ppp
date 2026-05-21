import { describe, it, expect } from 'vitest';
import { exportReport } from '../../src/report/exporter.js';
import { ExportFormat, Report } from '../../src/shared/types.js';

function createSampleReport(): Report {
  return {
    projectId: 'test-project-123',
    project: {
      id: 'test-project-123',
      category: '美妆',
      brand: '测试品牌',
      spuName: '测试产品',
      projectName: '2024春季推广',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-03-31'),
      engagementConfig: { includeShare: true, includeFollow: true },
      cooperationPolicy: { defaultDiscount: 0.9, specialRules: [] },
    },
    modules: [
      {
        moduleId: 'customer_info',
        title: '客户信息',
        data: { category: '美妆', brand: '测试品牌' },
      },
      {
        moduleId: 'data_overview',
        title: '数据总览',
        data: { totalImpressions: 100000, totalReads: 50000 },
      },
    ],
    generatedAt: new Date('2024-04-01T00:00:00.000Z'),
  };
}

describe('Report Exporter', () => {
  describe('exportReport - JSON format', () => {
    it('should return a Buffer for JSON format', async () => {
      const report = createSampleReport();
      const result = await exportReport(report, ExportFormat.JSON);

      expect(result).toBeInstanceOf(Buffer);
    });

    it('should produce valid JSON content', async () => {
      const report = createSampleReport();
      const result = await exportReport(report, ExportFormat.JSON);
      const jsonString = result.toString('utf-8');

      const parsed = JSON.parse(jsonString);
      expect(parsed.projectId).toBe('test-project-123');
      expect(parsed.project.brand).toBe('测试品牌');
      expect(parsed.modules).toHaveLength(2);
    });

    it('should preserve all report fields in the JSON output', async () => {
      const report = createSampleReport();
      const result = await exportReport(report, ExportFormat.JSON);
      const parsed = JSON.parse(result.toString('utf-8'));

      expect(parsed.project.category).toBe('美妆');
      expect(parsed.project.projectName).toBe('2024春季推广');
      expect(parsed.project.engagementConfig.includeShare).toBe(true);
      expect(parsed.project.cooperationPolicy.defaultDiscount).toBe(0.9);
      expect(parsed.modules[0].moduleId).toBe('customer_info');
      expect(parsed.modules[1].data.totalImpressions).toBe(100000);
    });

    it('should produce formatted (pretty-printed) JSON', async () => {
      const report = createSampleReport();
      const result = await exportReport(report, ExportFormat.JSON);
      const jsonString = result.toString('utf-8');

      // Pretty-printed JSON contains newlines and indentation
      expect(jsonString).toContain('\n');
      expect(jsonString).toContain('  ');
    });

    it('should handle a report with empty modules array', async () => {
      const report: Report = {
        projectId: 'empty-project',
        project: {
          id: 'empty-project',
          category: '食品',
          brand: '空品牌',
          projectName: '空项目',
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-31'),
          engagementConfig: { includeShare: false, includeFollow: false },
          cooperationPolicy: { defaultDiscount: 1, specialRules: [] },
        },
        modules: [],
        generatedAt: new Date('2024-02-01T00:00:00.000Z'),
      };

      const result = await exportReport(report, ExportFormat.JSON);
      const parsed = JSON.parse(result.toString('utf-8'));

      expect(parsed.modules).toEqual([]);
      expect(parsed.projectId).toBe('empty-project');
    });
  });

  describe('exportReport - unsupported formats', () => {
    it('should throw an error for PDF format', async () => {
      const report = createSampleReport();
      await expect(exportReport(report, ExportFormat.PDF)).rejects.toThrow(
        'PDF export format is not yet supported'
      );
    });

    it('should throw an error for PPTX format', async () => {
      const report = createSampleReport();
      await expect(exportReport(report, ExportFormat.PPTX)).rejects.toThrow(
        'PPTX export format is not yet supported'
      );
    });
  });
});
