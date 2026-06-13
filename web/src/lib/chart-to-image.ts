/**
 * Chart to Image Utility
 *
 * 将章节 HTML 中的 .chart-placeholder 元素渲染为 ECharts 图表，
 * 然后转为 base64 图片嵌入到 HTML 中，用于 Word 导出。
 */

import * as echarts from 'echarts/core';
import { BarChart, PieChart, LineChart, ScatterChart } from 'echarts/charts';
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  MarkAreaComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

// Register ECharts components
echarts.use([
  BarChart,
  PieChart,
  LineChart,
  ScatterChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  MarkAreaComponent,
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
    } else if (chartType === 'scatter') {
      container.style.height = '480px';
      option = buildScatterOptionForExport(chartTitle, chartData);
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
 * Build ECharts option for quadrant scatter chart (used in image export)
 */
const QUADRANT_COLORS_EXPORT: Record<string, string> = {
  '核心资产': '#16a34a',
  '潜力内容': '#3b82f6',
  '流量消耗': '#f97316',
  '淘汰候选': '#6b7280',
};

const CIRCLE_NUMBERS_EXPORT = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩',
  '⑪', '⑫', '⑬', '⑭', '⑮', '⑯', '⑰', '⑱', '⑲', '⑳',
  '㉑', '㉒', '㉓', '㉔', '㉕', '㉖', '㉗', '㉘', '㉙', '㉚'];

function buildScatterOptionForExport(
  chartTitle: string,
  chartData: Record<string, unknown>,
): echarts.EChartsCoreOption {
  const points = (chartData.points as Array<{
    x: number; y: number; label: string; index: number; quadrant: string;
  }>) || [];
  const xAvg = (chartData.xAvg as number) ?? 0.5;
  const yAvg = (chartData.yAvg as number) ?? 0.5;

  const seriesMap: Record<string, Array<[number, number, string, number]>> = {
    '核心资产': [], '潜力内容': [], '流量消耗': [], '淘汰候选': [],
  };

  for (const p of points) {
    const key = seriesMap[p.quadrant] ? p.quadrant : '淘汰候选';
    seriesMap[key].push([p.x, p.y, p.label, p.index]);
  }

  const series = Object.entries(seriesMap).map(([name, data]) => ({
    name,
    type: 'scatter' as const,
    data,
    symbolSize: 32,
    itemStyle: { color: QUADRANT_COLORS_EXPORT[name] || '#6b7280' },
    label: {
      show: true,
      formatter: (params: { data: [number, number, string, number] }) => {
        const idx = params.data[3] - 1;
        return idx < CIRCLE_NUMBERS_EXPORT.length ? CIRCLE_NUMBERS_EXPORT[idx] : `${params.data[3]}`;
      },
      fontSize: 12,
      fontWeight: 'bold' as const,
      color: '#fff',
    },
  }));

  if (series.length > 0) {
    (series[0] as Record<string, unknown>).markLine = {
      silent: true,
      lineStyle: { type: 'dashed', color: '#94a3b8', width: 1 },
      label: { show: false },
      data: [{ xAxis: xAvg }, { yAxis: yAvg }],
      animation: false,
    };
  }

  return {
    title: { text: chartTitle, left: 'center', top: 10, textStyle: { fontSize: 14, color: '#334155' } },
    legend: { bottom: 10, data: ['核心资产', '潜力内容', '流量消耗', '淘汰候选'] },
    grid: { left: 70, right: 30, bottom: 60, top: 80 },
    xAxis: {
      type: 'value', name: '投流效率（X，越右CPE越低）', nameLocation: 'center', nameGap: 30,
      min: -0.05, max: 1.05, splitLine: { show: false },
    },
    yAxis: {
      type: 'value', name: '内容质量（Y，越上互动率越高）', nameLocation: 'center', nameGap: 45,
      min: -0.05, max: 1.05, splitLine: { show: false },
    },
    series,
    animation: false,
  };
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
