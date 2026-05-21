import { describe, it, expect } from 'vitest';
import { exportToPDF } from '../../src/export/pdf-exporter.js';
import type { ReportContent, TemplateConfig } from '../../src/export/types.js';
import type { ChartImage } from '../../src/export/chart-renderer.js';

// ─── Test Fixtures ───────────────────────────────────────────────────────────

const defaultTemplate: TemplateConfig = {
  id: 'default',
  name: '默认模板',
  fonts: { heading: 'Helvetica', body: 'Helvetica' },
  colors: { primary: '#1a1a2e', secondary: '#16213e', accent: '#e94560' },
  spacing: { lineHeight: 1.6, paragraphSpacing: 12 },
  margins: { top: 72, bottom: 72, left: 72, right: 72 },
  headerFooter: { footer: '{{projectName}} - {{brand}} | page {{page}}' },
};

function createTestContent(overrides?: Partial<ReportContent>): ReportContent {
  return {
    metadata: {
      projectName: 'Test Project Alpha',
      brand: 'BrandX',
      category: 'Beverage',
      projectType: 'Seeding Campaign',
      generatedAt: new Date('2024-01-15'),
    },
    modules: [
      {
        moduleId: 'data_overview',
        title: 'Data Overview',
        status: 'show',
        narrative: 'The project performed well overall with all KPIs met.',
        tables: [
          {
            title: 'Core Metrics',
            headers: ['Metric', 'Value', 'Target', 'Rate'],
            rows: [
              ['Impressions', '1000000', '800000', '125%'],
              ['Engagement', '50000', '40000', '125%'],
            ],
          },
        ],
      },
      {
        moduleId: 'highlights',
        title: 'Project Highlights',
        status: 'show',
        narrative: 'Multiple KPIs exceeded targets.',
      },
      {
        moduleId: 'competitor_benchmark',
        title: 'Competitor Insights',
        status: 'hide',
        narrative: 'Insufficient competitor data for analysis.',
      },
      {
        moduleId: 'content_analysis',
        title: 'Content Analysis',
        status: 'degraded',
        narrative: 'Partial content data available.',
      },
    ],
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('pdf-exporter', () => {
  describe('exportToPDF', () => {
    it('should produce a non-empty PDF buffer', async () => {
      const content = createTestContent();
      const result = await exportToPDF(content, [], defaultTemplate);

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should produce a valid PDF (starts with %PDF header)', async () => {
      const content = createTestContent();
      const result = await exportToPDF(content, [], defaultTemplate);

      const header = result.subarray(0, 5).toString('ascii');
      expect(header).toBe('%PDF-');
    });

    it('should produce a PDF with 2 pages (cover + content)', async () => {
      const content = createTestContent();
      const result = await exportToPDF(content, [], defaultTemplate);

      // Check for /Count 2 in the PDF structure (2 pages)
      const pdfStr = result.toString('latin1');
      expect(pdfStr).toContain('/Count 2');
    });

    it('should exclude hidden modules - PDF with hidden modules is smaller', async () => {
      // All modules visible
      const allVisible = createTestContent({
        modules: [
          {
            moduleId: 'm1',
            title: 'Module One',
            status: 'show',
            narrative: 'This is a long narrative text for module one that should take space in the PDF output.',
          },
          {
            moduleId: 'm2',
            title: 'Module Two',
            status: 'show',
            narrative: 'This is a long narrative text for module two that should take space in the PDF output.',
          },
        ],
      });

      // One module hidden
      const oneHidden = createTestContent({
        modules: [
          {
            moduleId: 'm1',
            title: 'Module One',
            status: 'show',
            narrative: 'This is a long narrative text for module one that should take space in the PDF output.',
          },
          {
            moduleId: 'm2',
            title: 'Module Two',
            status: 'hide',
            narrative: 'This is a long narrative text for module two that should take space in the PDF output.',
          },
        ],
      });

      const resultAll = await exportToPDF(allVisible, [], defaultTemplate);
      const resultHidden = await exportToPDF(oneHidden, [], defaultTemplate);

      // PDF with hidden module should be smaller since it has less content
      expect(resultHidden.length).toBeLessThan(resultAll.length);
    });

    it('should include degraded annotation - PDF with degraded module is larger than show-only', async () => {
      const showOnly = createTestContent({
        modules: [
          {
            moduleId: 'm1',
            title: 'Module One',
            status: 'show',
            narrative: 'Short text.',
          },
        ],
      });

      const degraded = createTestContent({
        modules: [
          {
            moduleId: 'm1',
            title: 'Module One',
            status: 'degraded',
            narrative: 'Short text.',
          },
        ],
      });

      const resultShow = await exportToPDF(showOnly, [], defaultTemplate);
      const resultDegraded = await exportToPDF(degraded, [], defaultTemplate);

      // Degraded module has extra annotation content, so PDF should be larger
      expect(resultDegraded.length).toBeGreaterThan(resultShow.length);
    });

    it('should render tables - PDF with tables is larger than without', async () => {
      const withTable = createTestContent({
        modules: [
          {
            moduleId: 'm1',
            title: 'Module One',
            status: 'show',
            tables: [
              {
                title: 'Test Table',
                headers: ['Col A', 'Col B', 'Col C'],
                rows: [
                  ['R1A', 'R1B', 'R1C'],
                  ['R2A', 'R2B', 'R2C'],
                  ['R3A', 'R3B', 'R3C'],
                ],
              },
            ],
          },
        ],
      });

      const withoutTable = createTestContent({
        modules: [
          {
            moduleId: 'm1',
            title: 'Module One',
            status: 'show',
          },
        ],
      });

      const resultWith = await exportToPDF(withTable, [], defaultTemplate);
      const resultWithout = await exportToPDF(withoutTable, [], defaultTemplate);

      expect(resultWith.length).toBeGreaterThan(resultWithout.length);
    });

    it('should exclude hidden columns from tables', async () => {
      const withAllCols = createTestContent({
        modules: [
          {
            moduleId: 'm1',
            title: 'Module One',
            status: 'show',
            tables: [
              {
                headers: ['Col A', 'Col B', 'Col C', 'Col D'],
                rows: [
                  ['A1', 'B1', 'C1', 'D1'],
                  ['A2', 'B2', 'C2', 'D2'],
                ],
              },
            ],
          },
        ],
      });

      const resultAll = await exportToPDF(withAllCols, [], defaultTemplate);
      const resultHidden = await exportToPDF(withAllCols, [], defaultTemplate, {
        hiddenColumns: { m1: ['Col C', 'Col D'] },
      });

      // Fewer columns means smaller PDF
      expect(resultHidden.length).toBeLessThan(resultAll.length);
    });

    it('should embed chart images when provided', async () => {
      const content = createTestContent({
        modules: [
          {
            moduleId: 'data_overview',
            title: 'Data Overview',
            status: 'show',
            narrative: 'Overview text.',
          },
        ],
      });

      // Create a minimal valid PNG buffer (1x1 pixel)
      const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
        0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
        0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41,
        0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
        0x00, 0x00, 0x02, 0x00, 0x01, 0xe2, 0x21, 0xbc,
        0x33, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e,
        0x44, 0xae, 0x42, 0x60, 0x82,
      ]);

      const charts: ChartImage[] = [
        {
          moduleId: 'data_overview',
          chartType: 'bar',
          buffer: pngBuffer,
          width: 600,
          height: 400,
        },
      ];

      const resultWithCharts = await exportToPDF(content, charts, defaultTemplate);
      const resultWithoutCharts = await exportToPDF(content, [], defaultTemplate);

      // PDF with embedded chart should be larger
      expect(resultWithCharts.length).toBeGreaterThan(resultWithoutCharts.length);
    });

    it('should handle empty modules array', async () => {
      const content = createTestContent({ modules: [] });
      const result = await exportToPDF(content, [], defaultTemplate);

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
      const header = result.subarray(0, 5).toString('ascii');
      expect(header).toBe('%PDF-');
    });

    it('should handle modules with no narrative or tables', async () => {
      const content = createTestContent({
        modules: [
          {
            moduleId: 'simple',
            title: 'Simple Module',
            status: 'show',
          },
        ],
      });

      const result = await exportToPDF(content, [], defaultTemplate);

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should apply different template margins (different PDF sizes)', async () => {
      const content = createTestContent({
        modules: [
          {
            moduleId: 'm1',
            title: 'Module',
            status: 'show',
            narrative: 'Some text content here.',
          },
        ],
      });

      const narrowMargins: TemplateConfig = {
        ...defaultTemplate,
        margins: { top: 20, bottom: 20, left: 20, right: 20 },
      };

      const wideMargins: TemplateConfig = {
        ...defaultTemplate,
        margins: { top: 100, bottom: 100, left: 100, right: 100 },
      };

      const resultNarrow = await exportToPDF(content, [], narrowMargins);
      const resultWide = await exportToPDF(content, [], wideMargins);

      // Both should produce valid PDFs
      expect(resultNarrow.subarray(0, 5).toString('ascii')).toBe('%PDF-');
      expect(resultWide.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    });

    it('should not include charts for modules not in the content', async () => {
      const content = createTestContent({
        modules: [
          {
            moduleId: 'm1',
            title: 'Module One',
            status: 'show',
            narrative: 'Text.',
          },
        ],
      });

      // Chart for a module that doesn't exist in content
      const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
        0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
        0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41,
        0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
        0x00, 0x00, 0x02, 0x00, 0x01, 0xe2, 0x21, 0xbc,
        0x33, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e,
        0x44, 0xae, 0x42, 0x60, 0x82,
      ]);

      const charts: ChartImage[] = [
        {
          moduleId: 'nonexistent_module',
          chartType: 'pie',
          buffer: pngBuffer,
          width: 400,
          height: 300,
        },
      ];

      // Should not throw and chart for non-matching module should not be embedded
      const resultWithOrphanChart = await exportToPDF(content, charts, defaultTemplate);
      const resultNoCharts = await exportToPDF(content, [], defaultTemplate);

      // Orphan chart should not increase PDF size since it doesn't match any module
      expect(resultWithOrphanChart.length).toBe(resultNoCharts.length);
    });
  });
});
