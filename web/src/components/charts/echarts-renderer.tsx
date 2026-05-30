'use client';

import { useEffect, useRef, useCallback } from 'react';
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

/**
 * Hook: 在指定容器内查找 .chart-placeholder 元素，
 * 解析 data-chart-* 属性并用 ECharts 渲染图表。
 *
 * 用于审校台分章节显示时，将 LLM 生成的图表占位符渲染为真实图表。
 */
export function useChartRenderer(containerRef: React.RefObject<HTMLElement | null>, content: string) {
  const chartsRef = useRef<echarts.ECharts[]>([]);

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
        option = {
          title: { text: chartTitle, left: 'center', textStyle: { fontSize: 14, color: '#334155' } },
          tooltip: { trigger: 'axis' },
          xAxis: { type: 'category', data: (chartData.labels as string[]) || [] },
          yAxis: { type: 'value' },
          series: [{ type: 'line', data: (chartData.values as number[]) || [], smooth: true, itemStyle: { color: '#3b82f6' } }],
          grid: { left: 60, right: 20, bottom: 40, top: 50 },
        };
      }

      chart.setOption(option);
      chartsRef.current.push(chart);
    });
  }, [containerRef]);

  // Re-render charts when content changes
  useEffect(() => {
    // Small delay to ensure DOM is updated after dangerouslySetInnerHTML
    const timer = setTimeout(renderCharts, 100);
    return () => {
      clearTimeout(timer);
      chartsRef.current.forEach((chart) => chart.dispose());
      chartsRef.current = [];
    };
  }, [content, renderCharts]);

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
