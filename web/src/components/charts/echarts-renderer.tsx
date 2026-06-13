'use client';

import { useEffect, useRef, useCallback } from 'react';
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

/**
 * 多折线趋势图配置构建器（双Y轴 + 阶段背景色块）
 *
 * 数据格式（直接数组）：
 * [{date: "2025-01-15", cpm: 52.3, cpc: 1.8, cpe: 18.2, fee: 5000, period: "预热期"}]
 *
 * 或对象格式：
 * {data: [...同上], phases: [{name: "预热期", startDate: "2025-01-15", endDate: "2025-01-20"}]}
 */
const PHASE_COLORS = [
  'rgba(254, 243, 199, 0.4)',  // 黄色 - 预热期
  'rgba(220, 252, 231, 0.4)',  // 绿色 - 爆发期
  'rgba(219, 234, 254, 0.4)',  // 蓝色 - 持续期
  'rgba(243, 232, 255, 0.4)',  // 紫色
  'rgba(255, 228, 230, 0.4)',  // 粉色
];

function buildMultiLineTrendOption(
  chartTitle: string,
  chartData: Record<string, unknown>,
): echarts.EChartsCoreOption {
  // 支持两种数据格式
  let dataPoints: Array<{ date: string; cpm: number; cpc: number; cpe: number; fee?: number; period?: string }>;

  if (Array.isArray(chartData)) {
    dataPoints = chartData as typeof dataPoints;
  } else if (chartData.data && Array.isArray(chartData.data)) {
    dataPoints = chartData.data as typeof dataPoints;
  } else {
    // 尝试解析 — 如果 chartData 本身就是包含 date 字段的数组格式
    dataPoints = [];
  }

  if (dataPoints.length === 0) return {};

  const dates = dataPoints.map((d) => {
    // 简化日期显示：M/D 格式
    const parts = d.date.split('-');
    return parts.length >= 3 ? `${parseInt(parts[1])}/${parseInt(parts[2])}` : d.date;
  });
  const cpmValues = dataPoints.map((d) => d.cpm ?? 0);
  const cpcValues = dataPoints.map((d) => d.cpc ?? 0);
  const cpeValues = dataPoints.map((d) => d.cpe ?? 0);

  // 提取阶段色块数据
  const markAreaData: Array<[Record<string, unknown>, Record<string, unknown>]> = [];
  const phases = new Map<string, { start: number; end: number }>();

  dataPoints.forEach((d, idx) => {
    if (d.period && d.period !== '其他') {
      const existing = phases.get(d.period);
      if (existing) {
        existing.end = idx;
      } else {
        phases.set(d.period, { start: idx, end: idx });
      }
    }
  });

  let phaseIdx = 0;
  for (const [name, range] of phases) {
    const color = PHASE_COLORS[phaseIdx % PHASE_COLORS.length];
    markAreaData.push([
      {
        xAxis: dates[range.start],
        itemStyle: { color },
        label: {
          show: true,
          position: 'insideTop',
          formatter: name,
          fontSize: 11,
          color: '#64748b',
          fontWeight: 'bold',
        },
      },
      { xAxis: dates[range.end] },
    ]);
    phaseIdx++;
  }

  return {
    title: { text: chartTitle, left: 'center', top: 10, textStyle: { fontSize: 14, color: '#334155' } },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
    },
    legend: {
      top: 40,
      data: ['CPM（元/千次展现）', 'CPC（元/次点击）', 'CPE（元/次互动）'],
    },
    grid: { left: 60, right: 60, bottom: 40, top: 80 },
    xAxis: {
      type: 'category',
      data: dates,
      axisLabel: { fontSize: 10, rotate: dates.length > 15 ? 30 : 0 },
      boundaryGap: false,
    },
    yAxis: [
      {
        type: 'value',
        name: 'CPM / CPE（元）',
        nameTextStyle: { fontSize: 11, color: '#64748b' },
        axisLabel: {
          fontSize: 10,
          formatter: (v: number) => `${v}元`,
        },
        splitLine: { lineStyle: { type: 'dashed', color: '#e2e8f0' } },
      },
      {
        type: 'value',
        name: 'CPC（元）',
        nameTextStyle: { fontSize: 11, color: '#64748b' },
        axisLabel: {
          fontSize: 10,
          formatter: (v: number) => `${v}元`,
        },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: 'CPM（元/千次展现）',
        type: 'line',
        data: cpmValues,
        smooth: true,
        yAxisIndex: 0,
        lineStyle: { width: 2, color: '#3b82f6' },
        itemStyle: { color: '#3b82f6' },
        markArea: markAreaData.length > 0 ? { silent: true, data: markAreaData } : undefined,
      },
      {
        name: 'CPC（元/次点击）',
        type: 'line',
        data: cpcValues,
        smooth: true,
        yAxisIndex: 1,
        lineStyle: { width: 2, color: '#16a34a', type: 'dashed' },
        itemStyle: { color: '#16a34a' },
      },
      {
        name: 'CPE（元/次互动）',
        type: 'line',
        data: cpeValues,
        smooth: true,
        yAxisIndex: 0,
        lineStyle: { width: 2, color: '#b45309' },
        itemStyle: { color: '#b45309' },
      },
    ],
  };
}

/**
 * 四象限散点图配置构建器
 *
 * 数据格式：
 * {
 *   points: [{ x: number, y: number, label: string, index: number, quadrant: string }],
 *   xAvg: number,   // X轴分界线（均值）
 *   yAvg: number,   // Y轴分界线（均值）
 *   quadrants: [{ name: string, count: number, avgCpe: number }]  // 四象限汇总
 * }
 */
const QUADRANT_COLORS: Record<string, string> = {
  '核心资产': '#16a34a',  // green
  '潜力内容': '#3b82f6',  // blue
  '流量消耗': '#f97316',  // orange
  '淘汰候选': '#6b7280',  // gray
};

const CIRCLE_NUMBERS = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩',
  '⑪', '⑫', '⑬', '⑭', '⑮', '⑯', '⑰', '⑱', '⑲', '⑳',
  '㉑', '㉒', '㉓', '㉔', '㉕', '㉖', '㉗', '㉘', '㉙', '㉚'];

function buildQuadrantScatterOption(
  chartTitle: string,
  chartData: Record<string, unknown>,
): echarts.EChartsCoreOption {
  const points = (chartData.points as Array<{
    x: number; y: number; label: string; index: number; quadrant: string;
  }>) || [];
  const xAvg = (chartData.xAvg as number) ?? 0.5;
  const yAvg = (chartData.yAvg as number) ?? 0.5;

  // 按象限分组
  const seriesMap: Record<string, Array<[number, number, string, number]>> = {
    '核心资产': [],
    '潜力内容': [],
    '流量消耗': [],
    '淘汰候选': [],
  };

  for (const p of points) {
    const key = seriesMap[p.quadrant] ? p.quadrant : '淘汰候选';
    seriesMap[key].push([p.x, p.y, p.label, p.index]);
  }

  const series = Object.entries(seriesMap).map(([name, data]) => ({
    name,
    type: 'scatter' as const,
    data,
    symbolSize: 36,
    itemStyle: { color: QUADRANT_COLORS[name] || '#6b7280' },
    label: {
      show: true,
      formatter: (params: { data: [number, number, string, number] }) => {
        const idx = params.data[3] - 1;
        return idx < CIRCLE_NUMBERS.length ? CIRCLE_NUMBERS[idx] : `${params.data[3]}`;
      },
      fontSize: 13,
      fontWeight: 'bold' as const,
      color: '#fff',
    },
  }));

  // 添加分割线作为第一个series的markLine
  if (series.length > 0) {
    (series[0] as Record<string, unknown>).markLine = {
      silent: true,
      lineStyle: { type: 'dashed', color: '#94a3b8', width: 1 },
      label: { show: false },
      data: [
        { xAxis: xAvg },
        { yAxis: yAvg },
      ],
    };

    // 添加四象限区域标注
    (series[0] as Record<string, unknown>).markArea = {
      silent: true,
      data: [
        // 右上 - 核心资产（浅绿）
        [{
          xAxis: xAvg, yAxis: yAvg,
          itemStyle: { color: 'rgba(22, 163, 74, 0.04)' },
        }, {
          xAxis: 1.05, yAxis: 1.05,
        }],
        // 左上 - 潜力内容（浅蓝）
        [{
          xAxis: -0.05, yAxis: yAvg,
          itemStyle: { color: 'rgba(59, 130, 246, 0.04)' },
        }, {
          xAxis: xAvg, yAxis: 1.05,
        }],
        // 右下 - 流量消耗（浅橙）
        [{
          xAxis: xAvg, yAxis: -0.05,
          itemStyle: { color: 'rgba(249, 115, 22, 0.04)' },
        }, {
          xAxis: 1.05, yAxis: yAvg,
        }],
        // 左下 - 淘汰候选（浅灰）
        [{
          xAxis: -0.05, yAxis: -0.05,
          itemStyle: { color: 'rgba(107, 114, 128, 0.04)' },
        }, {
          xAxis: xAvg, yAxis: yAvg,
        }],
      ],
    };
  }

  return {
    title: { text: chartTitle, left: 'center', top: 10, textStyle: { fontSize: 14, color: '#334155' } },
    tooltip: {
      trigger: 'item',
      formatter: (params: { data: [number, number, string, number] }) => {
        const [x, y, label, idx] = params.data;
        return `<b>${CIRCLE_NUMBERS[idx - 1] || idx} ${label}</b><br/>投流效率: ${x.toFixed(3)}<br/>内容质量: ${y.toFixed(3)}`;
      },
    },
    legend: {
      bottom: 10,
      data: ['核心资产', '潜力内容', '流量消耗', '淘汰候选'],
    },
    grid: { left: 70, right: 30, bottom: 60, top: 80 },
    xAxis: {
      type: 'value',
      name: '投流效率（X，越右CPE越低=越省钱）',
      nameLocation: 'center',
      nameGap: 30,
      nameTextStyle: { fontSize: 12, color: '#64748b' },
      min: -0.05,
      max: 1.05,
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      name: '内容质量（Y，越上互动率越高）',
      nameLocation: 'center',
      nameGap: 45,
      nameTextStyle: { fontSize: 12, color: '#64748b' },
      min: -0.05,
      max: 1.05,
      splitLine: { show: false },
    },
    series,
  };
}

/**
 * Hook: 在指定容器内查找 .chart-placeholder 元素，
 * 解析 data-chart-* 属性并用 ECharts 渲染图表。
 *
 * 用于审校台分章节显示时，将 LLM 生成的图表占位符渲染为真实图表。
 *
 * 使用 MutationObserver 监听 DOM 变化，确保在 dangerouslySetInnerHTML
 * 更新完成后再渲染图表，避免 setTimeout 导致的时序竞争问题。
 */
export function useChartRenderer(containerRef: React.RefObject<HTMLElement | null>, content: string) {
  const chartsRef = useRef<echarts.ECharts[]>([]);
  const renderScheduledRef = useRef(false);

  const renderCharts = useCallback(() => {
    // Dispose previous charts
    chartsRef.current.forEach((chart) => chart.dispose());
    chartsRef.current = [];

    if (!containerRef.current) return;

    // Remove any previously rendered chart containers
    const existingCharts = containerRef.current.querySelectorAll('.echarts-rendered-chart');
    existingCharts.forEach((el) => el.remove());

    // Reset hidden placeholders
    const hiddenPlaceholders = containerRef.current.querySelectorAll('.chart-placeholder[style*="display: none"]');
    hiddenPlaceholders.forEach((el) => {
      (el as HTMLElement).style.display = '';
    });

    const placeholders = containerRef.current.querySelectorAll('.chart-placeholder');
    if (placeholders.length === 0) return;

    placeholders.forEach((el, idx) => {
      const chartType = el.getAttribute('data-chart-type') || 'bar';
      const chartTitle = el.getAttribute('data-chart-title') || '';
      const rawData = el.getAttribute('data-chart-data');

      let chartData: Record<string, unknown>;
      try {
        chartData = JSON.parse(rawData || '{}');
      } catch {
        return;
      }

      // Create a chart container and insert it before the placeholder
      const container = document.createElement('div');
      container.style.width = '100%';
      container.style.height = '360px';
      container.style.margin = '12px 0';
      container.className = 'echarts-rendered-chart';
      container.id = `echart-${idx}-${Date.now()}`;

      // Insert chart container before the placeholder, then hide placeholder
      el.parentNode?.insertBefore(container, el);
      (el as HTMLElement).style.display = 'none';

      // Initialize ECharts
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
        };
      } else if (chartType === 'line') {
        // 检查是否为多折线趋势数据格式（[{date, cpm, cpc, cpe, ...}]）
        if (Array.isArray(chartData) && chartData.length > 0 && 'date' in (chartData[0] as Record<string, unknown>)) {
          // 转发到 multiline 处理
          option = buildMultiLineTrendOption(chartTitle, chartData as unknown as Record<string, unknown>);
          container.style.height = '420px';
        } else {
          option = {
            title: { text: chartTitle, left: 'center', textStyle: { fontSize: 14, color: '#334155' } },
            tooltip: { trigger: 'axis' },
            xAxis: { type: 'category', data: (chartData.labels as string[]) || [] },
            yAxis: { type: 'value' },
            series: [{ type: 'line', data: (chartData.values as number[]) || [], smooth: true, itemStyle: { color: '#3b82f6' } }],
            grid: { left: 60, right: 20, bottom: 40, top: 50 },
          };
        }
      } else if (chartType === 'scatter') {
        // 四象限散点图
        // 数据格式: { points: [{x, y, label, quadrant}], xAvg, yAvg, quadrants: [{name, count, avgCpe}] }
        option = buildQuadrantScatterOption(chartTitle, chartData);
        // 四象限散点图需要更大的高度
        container.style.height = '480px';
      } else if (chartType === 'multiline' || chartType === 'trend') {
        // 多折线趋势图（双Y轴 + 阶段背景色块）
        // 数据格式: [{date, cpm, cpc, cpe, fee?, period?}] 或 {data: [...], phases: [...]}
        option = buildMultiLineTrendOption(chartTitle, chartData);
        container.style.height = '420px';
      }

      chart.setOption(option);
      chartsRef.current.push(chart);
    });
  }, [containerRef]);

  /**
   * 使用 requestAnimationFrame 调度渲染，确保在浏览器下一帧绘制前
   * DOM 已经稳定，同时通过 renderScheduledRef 去重避免重复渲染。
   */
  const scheduleRender = useCallback(() => {
    if (renderScheduledRef.current) return;
    renderScheduledRef.current = true;
    requestAnimationFrame(() => {
      renderScheduledRef.current = false;
      renderCharts();
    });
  }, [renderCharts]);

  // 使用 MutationObserver 监听容器 DOM 变化，发现 placeholder 后渲染
  useEffect(() => {
    if (!containerRef.current) return;

    // 初始渲染：DOM 已就绪时立即检查
    scheduleRender();

    // 监听容器内的 DOM 变化（innerHTML 更新会触发 childList 变化）
    const observer = new MutationObserver((mutations) => {
      // 检查是否有新增的 chart-placeholder 节点
      const hasNewPlaceholders = mutations.some((mutation) => {
        for (const node of Array.from(mutation.addedNodes)) {
          if (node instanceof HTMLElement) {
            if (
              node.classList?.contains('chart-placeholder') ||
              node.querySelector?.('.chart-placeholder')
            ) {
              return true;
            }
          }
        }
        return false;
      });

      if (hasNewPlaceholders) {
        scheduleRender();
      }
    });

    observer.observe(containerRef.current, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
      chartsRef.current.forEach((chart) => chart.dispose());
      chartsRef.current = [];
    };
  }, [content, containerRef, scheduleRender]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      chartsRef.current.forEach((chart) => chart.resize());
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return { renderCharts };
}
