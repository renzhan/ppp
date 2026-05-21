import { describe, it, expect } from 'vitest';
import { calculateComponentConversion } from '../../src/calculation/components';
import type { ComponentData } from '../../src/shared/types';

describe('calculateComponentConversion', () => {
  it('calculates click rate and conversion rate correctly with positive values', () => {
    const components: ComponentData[] = [
      { componentType: '正文组件', impressions: 10000, clicks: 500, conversions: 50 },
    ];

    const result = calculateComponentConversion(components);

    expect(result).toHaveLength(1);
    expect(result[0].componentType).toBe('正文组件');
    expect(result[0].clickRate).toBe(0.05); // 500 / 10000
    expect(result[0].conversionRate).toBe(0.1); // 50 / 500
  });

  it('returns N/A for clickRate when impressions is 0', () => {
    const components: ComponentData[] = [
      { componentType: '互动组件', impressions: 0, clicks: 0, conversions: 0 },
    ];

    const result = calculateComponentConversion(components);

    expect(result[0].clickRate).toBe('N/A');
  });

  it('returns N/A for conversionRate when clicks is 0', () => {
    const components: ComponentData[] = [
      { componentType: '评论区组件', impressions: 5000, clicks: 0, conversions: 0 },
    ];

    const result = calculateComponentConversion(components);

    expect(result[0].clickRate).toBe(0); // 0 / 5000
    expect(result[0].conversionRate).toBe('N/A');
  });

  it('handles multiple components', () => {
    const components: ComponentData[] = [
      { componentType: '正文组件', impressions: 10000, clicks: 1000, conversions: 100 },
      { componentType: '互动组件', impressions: 8000, clicks: 400, conversions: 20 },
      { componentType: '评论区组件', impressions: 6000, clicks: 300, conversions: 30 },
    ];

    const result = calculateComponentConversion(components);

    expect(result).toHaveLength(3);

    // 正文组件
    expect(result[0].clickRate).toBe(0.1); // 1000 / 10000
    expect(result[0].conversionRate).toBe(0.1); // 100 / 1000

    // 互动组件
    expect(result[1].clickRate).toBe(0.05); // 400 / 8000
    expect(result[1].conversionRate).toBe(0.05); // 20 / 400

    // 评论区组件
    expect(result[2].clickRate).toBe(0.05); // 300 / 6000
    expect(result[2].conversionRate).toBe(0.1); // 30 / 300
  });

  it('returns empty array for empty input', () => {
    const result = calculateComponentConversion([]);
    expect(result).toEqual([]);
  });

  it('preserves original data fields in output', () => {
    const components: ComponentData[] = [
      { componentType: '正文组件', impressions: 2000, clicks: 100, conversions: 10 },
    ];

    const result = calculateComponentConversion(components);

    expect(result[0].componentType).toBe('正文组件');
    expect(result[0].impressions).toBe(2000);
    expect(result[0].clicks).toBe(100);
    expect(result[0].conversions).toBe(10);
  });

  it('handles both N/A cases when impressions and clicks are both 0', () => {
    const components: ComponentData[] = [
      { componentType: '互动组件', impressions: 0, clicks: 0, conversions: 5 },
    ];

    const result = calculateComponentConversion(components);

    expect(result[0].clickRate).toBe('N/A');
    expect(result[0].conversionRate).toBe('N/A');
  });

  it('handles decimal results correctly', () => {
    const components: ComponentData[] = [
      { componentType: '正文组件', impressions: 3, clicks: 1, conversions: 1 },
    ];

    const result = calculateComponentConversion(components);

    expect(result[0].clickRate).toBeCloseTo(0.3333, 4); // 1 / 3
    expect(result[0].conversionRate).toBe(1); // 1 / 1
  });
});
