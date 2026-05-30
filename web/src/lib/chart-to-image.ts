/**
 * Chart to Image Utility
 *
 * 将章节 HTML 中的 .chart-placeholder 元素渲染为 ECharts 图表，
 * 然后转为 base64 图片嵌入到 HTML 中，用于 Word 导出。
 */

import * as echarts from 'echarts/core';
import { BarChart, PieChart, LineChart } from 'echarts/charts';
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

// Register ECharts components
echarts.use([
  BarChart,
  PieChart,
  LineChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  CanvasRenderer,
]);

interface ChapterData {
  id: string;
  title: string;
  number: number;
  content: string;
}

/**
 * 将章节中的 chart-placeholder 渲染为 base64 图片，
 * 替换原始 placeholder 为 <img> 标签。
 */
export async function renderChartsToImages(chapters: ChapterData[]): Promise<ChapterData[]> {
  return chapters.map((chapter) => {
    const content = replaceChartPlaceholdersWithImages(chapter.content);
    return { ...chapter, content };
  });
}

/**
 * 解析 HTML 中的 chart-placeholder，渲染为 canvas 并转为 base64 img 标签
 */
function replaceChartPlaceholdersWithImages(html: string): string {
  // Match chart-placeholder divs and replace with rendered images
  const placeholderRegex = /<div class="chart-placeholder"([^>]*)>[\s\S]*?<\/div>/g;

  return html.replace(placeholderRegex, (match, attrs: string) => {
    const chartType = extractAttr(attrs, 'data-chart-type') || 'bar';
    const chartTitle = extractAttr(attrs, 'data-chart-title') || '';
    const rawData = extractAttr(attrs, 'data-chart-data');

    let chartData: Record<string, unknown>;
    try {
      chartData = JSON.parse(rawData || '{}');
    } catch {
      return match; // Keep original if data is invalid
    }

    // Render chart to canvas using ECharts SSR-like approach (offscreen canvas)
    const base64 = renderChartToBase64(chartType, chartTitle, chartData);
    if (!base64) return match;

    return `<div class="chart-image"><img src="${base64}" alt="${chartTitle}" style="max-width:100%;height:auto;" /></div>`;
  });
}

/**
 * 使用 ECharts 离屏渲染图表并返回 base64 PNG
 */
function renderChartToBase64(
  chartType: string,
  chartTitle: string,
  chartData: Record<string, unknown>
): string | null {
  try {
    // Create an offscreen container
    const container = document.createElement('div');
    container.style.width = '700px';
    container.style.height = '360px';
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '-9999px';
    document.body.appendChild(container);

    const chart = echarts.init(container);
    let option: echarts.EChartsCoreOption = {};

    if (chartType === 'bar') {
      option = {
        title: { text: chartTitle, left: 'center', textStyle: { fontSize: 14, color: '#334155' } },
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'category', data: (chartData.labels as string[]) || [], axisLabel: { fontSize: 11 } },
        yAxis: { type: 'value' },
        series: [{ type: 'bar', data: (chartData.values as number[]) || [], itemStyle: { color: '#3b82f6' } }],
        grid: { left: 60, right: 20, bottom: 40, top: 50 },
        animation: false,
      };
    } else if (chartType === 'pie') {
      const items = (chartData.items as Array<{ name: string; value: number }>) ||
        ((chartData.labels as string[]) || []).map((l: string, i: number) => ({
          name: l,
          value: ((chartData.values as number[]) || [])[i],
        }));
      option = {
        title: { text: chartTitle, left: 'center', textStyle: { fontSize: 14, color: '#334155' } },
        tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
        series: [{
          type: 'pie',
          radius: ['30%', '60%'],
          data: items,
          label: { fontSize: 11 },
        }],
        animation: false,
      };
    } else if (chartType === 'line') {
      option = {
        title: { text: chartTitle, left: 'center', textStyle: { fontSize: 14, color: '#334155' } },
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'category', data: (chartData.labels as string[]) || [] },
        yAxis: { type: 'value' },
        series: [{ type: 'line', data: (chartData.values as number[]) || [], smooth: true, itemStyle: { color: '#3b82f6' } }],
        grid: { left: 60, right: 20, bottom: 40, top: 50 },
        animation: false,
      };
    }

    chart.setOption(option);

    // Get base64 image from canvas
    const base64 = chart.getDataURL({
      type: 'png',
      pixelRatio: 2,
      backgroundColor: '#fff',
    });

    // Cleanup
    chart.dispose();
    document.body.removeChild(container);

    return base64;
  } catch {
    return null;
  }
}

/**
 * Extract attribute value from an HTML attributes string
 */
function extractAttr(attrs: string, name: string): string {
  // Handle both single and double quotes, and escaped quotes in JSON
  const singleQuoteRegex = new RegExp(`${name}='([^']*)'`);
  const doubleQuoteRegex = new RegExp(`${name}="([^"]*)"`);
  const match = attrs.match(singleQuoteRegex) || attrs.match(doubleQuoteRegex);
  if (match) {
    return (match[1] || '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  }
  return '';
}
