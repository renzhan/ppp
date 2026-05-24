import type { ComponentData, ComponentMetrics } from '../shared/types';

/**
 * 计算组件转化率指标
 *
 * 为每个组件计算：
 * - clickRate = clicks / impressions（点击率）
 * - conversionRate = conversions / clicks（转化率）
 *
 * 当分母为零时返回 'N/A'
 *
 * @param components - 组件数据数组
 * @returns 带有计算指标的组件数据数组
 */
export function calculateComponentConversion(components: ComponentData[]): ComponentMetrics[] {
  return components.map((component) => {
    const clickRate: number | 'N/A' = component.impressions === 0
      ? 'N/A'
      : component.clicks / component.impressions;

    const conversionRate: number | 'N/A' = component.clicks === 0
      ? 'N/A'
      : component.conversions / component.clicks;

    return {
      componentType: component.componentType,
      impressions: component.impressions,
      clicks: component.clicks,
      conversions: component.conversions,
      clickRate,
      conversionRate,
    };
  });
}
