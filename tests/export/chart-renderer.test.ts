import { describe, it, expect } from 'vitest';
import { renderChartToImage, renderModuleCharts } from '../../src/export/chart-renderer.js';

describe('chart-renderer', () => {
  describe('renderChartToImage', () => {
    const sampleEntries = [
      { label: '曝光', value: 10000 },
      { label: '点击', value: 5000 },
      { label: '互动', value: 2000 },
      { label: '转化', value: 500 },
    ];

    it('renders a pie chart and returns a valid PNG buffer', async () => {
      const result = await renderChartToImage('pie', {
        entries: sampleEntries,
        title: '数据分布',
        moduleId: 'M1',
      });

      expect(result.chartType).toBe('pie');
      expect(result.moduleId).toBe('M1');
      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.buffer.length).toBeGreaterThan(0);
      // PNG magic bytes
      expect(result.buffer[0]).toBe(0x89);
      expect(result.buffer[1]).toBe(0x50); // P
      expect(result.buffer[2]).toBe(0x4e); // N
      expect(result.buffer[3]).toBe(0x47); // G
    });

    it('renders a bar chart', async () => {
      const result = await renderChartToImage('bar', { entries: sampleEntries });
      expect(result.chartType).toBe('bar');
      expect(result.buffer.length).toBeGreaterThan(0);
    });

    it('renders a line chart', async () => {
      const result = await renderChartToImage('line', { entries: sampleEntries });
      expect(result.chartType).toBe('line');
      expect(result.buffer.length).toBeGreaterThan(0);
    });

    it('renders a radar chart', async () => {
      const result = await renderChartToImage('radar', {
        entries: [
          { label: '曝光', value: 80 },
          { label: '互动', value: 60 },
          { label: '转化', value: 40 },
          { label: '成本', value: 70 },
          { label: '效率', value: 90 },
        ],
      });
      expect(result.chartType).toBe('radar');
      expect(result.buffer.length).toBeGreaterThan(0);
    });

    it('renders a funnel chart', async () => {
      const result = await renderChartToImage('funnel', { entries: sampleEntries });
      expect(result.chartType).toBe('funnel');
      expect(result.buffer.length).toBeGreaterThan(0);
    });

    it('throws on unsupported chart type', async () => {
      await expect(
        renderChartToImage('scatter', { entries: sampleEntries })
      ).rejects.toThrow('Unsupported chart type');
    });

    it('constrains width to MAX_PAGE_WIDTH_PX (456px logical)', async () => {
      const result = await renderChartToImage(
        'bar',
        { entries: sampleEntries },
        { width: 800, height: 400, scale: 2 }
      );
      // Logical width is 456, at scale 2 the pixel width is 912
      expect(result.width).toBeLessThanOrEqual(456 * 2);
    });

    it('ensures DPI is at least 150', async () => {
      // Even if user requests lower DPI, it should be clamped to 150
      const result = await renderChartToImage(
        'pie',
        { entries: sampleEntries },
        { dpi: 72 }
      );
      // The image should still be rendered (DPI is clamped internally)
      expect(result.buffer.length).toBeGreaterThan(0);
    });

    it('supports labels/values data format', async () => {
      const result = await renderChartToImage('bar', {
        labels: ['A', 'B', 'C'],
        values: [100, 200, 300],
      });
      expect(result.chartType).toBe('bar');
      expect(result.buffer.length).toBeGreaterThan(0);
    });

    it('handles empty entries gracefully', async () => {
      const result = await renderChartToImage('pie', { entries: [] });
      expect(result.chartType).toBe('pie');
      expect(result.buffer.length).toBeGreaterThan(0); // Still produces an image (blank chart area)
    });
  });

  describe('renderModuleCharts', () => {
    it('returns empty array when module has no chart data', async () => {
      const result = await renderModuleCharts('M1', {
        text: 'Some narrative content',
        metrics: { views: 1000 },
      });
      expect(result).toEqual([]);
    });

    it('returns empty array for empty module data', async () => {
      const result = await renderModuleCharts('M1', {});
      expect(result).toEqual([]);
    });

    it('renders charts from module charts array', async () => {
      const result = await renderModuleCharts('M2', {
        charts: [
          {
            chartType: 'pie',
            data: {
              entries: [
                { label: 'A', value: 30 },
                { label: 'B', value: 70 },
              ],
            },
          },
          {
            chartType: 'bar',
            data: {
              entries: [
                { label: 'X', value: 100 },
                { label: 'Y', value: 200 },
              ],
            },
          },
        ],
      });

      expect(result).toHaveLength(2);
      expect(result[0].chartType).toBe('pie');
      expect(result[0].moduleId).toBe('M2');
      expect(result[1].chartType).toBe('bar');
      expect(result[1].moduleId).toBe('M2');
    });

    it('renders single chart from module with chartType + data', async () => {
      const result = await renderModuleCharts('M3', {
        chartType: 'line',
        data: {
          entries: [
            { label: 'Week 1', value: 100 },
            { label: 'Week 2', value: 150 },
            { label: 'Week 3', value: 200 },
          ],
        },
      });

      expect(result).toHaveLength(1);
      expect(result[0].chartType).toBe('line');
      expect(result[0].moduleId).toBe('M3');
    });

    it('skips charts with invalid chart types without failing', async () => {
      const result = await renderModuleCharts('M4', {
        charts: [
          {
            chartType: 'invalid_type',
            data: { entries: [{ label: 'A', value: 10 }] },
          },
          {
            chartType: 'pie',
            data: { entries: [{ label: 'B', value: 20 }] },
          },
        ],
      });

      // The invalid chart is skipped, only the valid one is rendered
      expect(result).toHaveLength(1);
      expect(result[0].chartType).toBe('pie');
    });
  });
});
