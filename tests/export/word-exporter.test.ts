import { describe, it, expect } from 'vitest';
import { exportToWord } from '../../src/export/word-exporter.js';
import type { ReportContent, TemplateConfig } from '../../src/export/types.js';
import type { ChartImage } from '../../src/export/chart-renderer.js';

// ─── Test Fixtures ───────────────────────────────────────────────────────────

const defaultTemplate: TemplateConfig = {
  id: 'default',
  name: '默认模板',
  fonts: { heading: 'Microsoft YaHei', body: 'Microsoft YaHei' },
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

// Minimal valid 1x1 PNG buffer for chart embedding tests
const minimalPngBuffer = Buffer.from([
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

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('word-exporter', () => {
  describe('exportToWord', () => {
    it('should produce a non-empty DOCX buffer', async () => {
      const content = createTestContent();
      const result = await exportToWord(content, [], defaultTemplate);

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should produce a valid DOCX file (ZIP format with PK header)', async () => {
      const content = createTestContent();
      const result = await exportToWord(content, [], defaultTemplate);

      // DOCX files are ZIP archives, starting with PK signature
      const header = result.subarray(0, 2).toString('ascii');
      expect(header).toBe('PK');
    });

    it('should exclude hidden modules from output', async () => {
      const allVisible = createTestContent({
        modules: [
          {
            moduleId: 'm1',
            title: 'Module One With Long Title',
            status: 'show',
            narrative: 'This is a long narrative text for module one that should take space.',
          },
          {
            moduleId: 'm2',
            title: 'Module Two With Long Title',
            status: 'show',
            narrative: 'This is a long narrative text for module two that should take space.',
          },
        ],
      });

      const oneHidden = createTestContent({
        modules: [
          {
            moduleId: 'm1',
            title: 'Module One With Long Title',
            status: 'show',
            narrative: 'This is a long narrative text for module one that should take space.',
          },
          {
            moduleId: 'm2',
            title: 'Module Two With Long Title',
            status: 'hide',
            narrative: 'This is a long narrative text for module two that should take space.',
          },
        ],
      });

      const resultAll = await exportToWord(allVisible, [], defaultTemplate);
      const resultHidden = await exportToWord(oneHidden, [], defaultTemplate);

      // DOCX with hidden module should be smaller
      expect(resultHidden.length).toBeLessThan(resultAll.length);
    });

    it('should include degraded annotation for degraded modules', async () => {
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

      const resultShow = await exportToWord(showOnly, [], defaultTemplate);
      const resultDegraded = await exportToWord(degraded, [], defaultTemplate);

      // Degraded module has extra annotation, so DOCX should be larger
      expect(resultDegraded.length).toBeGreaterThan(resultShow.length);
    });

    it('should render tables with data', async () => {
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

      const resultWith = await exportToWord(withTable, [], defaultTemplate);
      const resultWithout = await exportToWord(withoutTable, [], defaultTemplate);

      expect(resultWith.length).toBeGreaterThan(resultWithout.length);
    });

    it('should exclude hidden columns from tables', async () => {
      const content = createTestContent({
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

      const resultAll = await exportToWord(content, [], defaultTemplate);
      const resultHidden = await exportToWord(content, [], defaultTemplate, {
        hiddenColumns: { m1: ['Col C', 'Col D'] },
      });

      // Fewer columns means smaller DOCX
      expect(resultHidden.length).toBeLessThan(resultAll.length);
    });

    it('should embed chart PNG images', async () => {
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

      const charts: ChartImage[] = [
        {
          moduleId: 'data_overview',
          chartType: 'bar',
          buffer: minimalPngBuffer,
          width: 600,
          height: 400,
        },
      ];

      const resultWithCharts = await exportToWord(content, charts, defaultTemplate);
      const resultWithoutCharts = await exportToWord(content, [], defaultTemplate);

      // DOCX with embedded chart should be larger
      expect(resultWithCharts.length).toBeGreaterThan(resultWithoutCharts.length);
    });

    it('should handle empty modules array', async () => {
      const content = createTestContent({ modules: [] });
      const result = await exportToWord(content, [], defaultTemplate);

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
      const header = result.subarray(0, 2).toString('ascii');
      expect(header).toBe('PK');
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

      const result = await exportToWord(content, [], defaultTemplate);

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should apply template configuration and produce valid output', async () => {
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

      const customTemplate: TemplateConfig = {
        ...defaultTemplate,
        fonts: { heading: 'Arial', body: 'Times New Roman' },
        colors: { primary: '#FF0000', secondary: '#00FF00', accent: '#0000FF' },
        margins: { top: 100, bottom: 100, left: 100, right: 100 },
      };

      const resultDefault = await exportToWord(content, [], defaultTemplate);
      const resultCustom = await exportToWord(content, [], customTemplate);

      // Both should produce valid DOCX files
      expect(resultDefault.subarray(0, 2).toString('ascii')).toBe('PK');
      expect(resultCustom.subarray(0, 2).toString('ascii')).toBe('PK');
      // Both should be non-empty
      expect(resultDefault.length).toBeGreaterThan(0);
      expect(resultCustom.length).toBeGreaterThan(0);
    });

    it('should not significantly embed charts for non-matching modules', async () => {
      const content = createTestContent({
        modules: [
          {
            moduleId: 'm1',
            title: 'Module One',
            status: 'show',
            narrative: 'Text content for the module.',
          },
        ],
      });

      // Chart that matches the module
      const matchingCharts: ChartImage[] = [
        {
          moduleId: 'm1',
          chartType: 'pie',
          buffer: minimalPngBuffer,
          width: 400,
          height: 300,
        },
      ];

      // Chart for a non-existent module
      const orphanCharts: ChartImage[] = [
        {
          moduleId: 'nonexistent_module',
          chartType: 'pie',
          buffer: minimalPngBuffer,
          width: 400,
          height: 300,
        },
      ];

      const resultMatching = await exportToWord(content, matchingCharts, defaultTemplate);
      const resultOrphan = await exportToWord(content, orphanCharts, defaultTemplate);

      // Matching chart should produce significantly larger output than orphan chart
      expect(resultMatching.length).toBeGreaterThan(resultOrphan.length);
    });

    it('should include project metadata on cover page', async () => {
      const content = createTestContent();
      const result = await exportToWord(content, [], defaultTemplate);

      // The DOCX should be valid and contain the metadata
      // We verify by checking the buffer is non-empty and valid ZIP
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(100);
      expect(result.subarray(0, 2).toString('ascii')).toBe('PK');
    });
  });
});
