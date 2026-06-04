import type { BenchmarkResult, BenchmarkRange } from '../shared/types';
import { normalizeBenchmarkValue } from '../shared/types';

/**
 * 大盘对比计算（区间格式）
 * 判断实际值是否落在大盘基准区间 [min, max] 内，并标记优劣
 *
 * 对于非成本指标（CTR、互动率等，越高越好）：
 *   - actual < min → 劣于大盘
 *   - actual in [min, max] → 持平大盘
 *   - actual > max → 优于大盘
 *
 * 对于成本指标（CPM、CPC、CPE，越低越好）：
 *   - actual < min → 优于大盘
 *   - actual in [min, max] → 持平大盘
 *   - actual > max → 劣于大盘
 *
 * @param actual - 实际指标值
 * @param benchmark - 大盘基准值（支持单值 number 或区间 { min, max }）
 * @param isCostMetric - 是否为成本类指标（成本越低越好）
 * @returns BenchmarkResult 包含百分比差异、是否优于大盘、标签
 */
export function calculateBenchmarkComparison(
  actual: number,
  benchmark: number | BenchmarkRange,
  isCostMetric: boolean
): BenchmarkResult {
  // Normalize benchmark to range format (backward compatible)
  const range = normalizeBenchmarkValue(benchmark)!;

  // Determine if actual falls within, below, or above the range
  if (actual >= range.min && actual <= range.max) {
    // Within range → 持平大盘
    // percentageDiff is 0 when within range (midpoint-based for reference)
    const midpoint = (range.min + range.max) / 2;
    const percentageDiff = midpoint !== 0
      ? (isCostMetric
          ? ((midpoint - actual) / midpoint) * 100
          : ((actual - midpoint) / midpoint) * 100)
      : 0;

    return {
      percentageDiff,
      isBetterThanBenchmark: false,
      label: '持平大盘',
    };
  }

  if (actual < range.min) {
    // Below range
    const percentageDiff = range.min !== 0
      ? (isCostMetric
          ? ((range.min - actual) / range.min) * 100
          : ((actual - range.min) / range.min) * 100)
      : 0;

    if (isCostMetric) {
      // Cost metric: lower is better → 优于大盘
      return {
        percentageDiff: Math.abs(percentageDiff),
        isBetterThanBenchmark: true,
        label: '优于大盘',
      };
    } else {
      // Non-cost metric: lower is worse → 劣于大盘
      return {
        percentageDiff,
        isBetterThanBenchmark: false,
        label: '劣于大盘',
      };
    }
  }

  // actual > range.max
  const percentageDiff = range.max !== 0
    ? (isCostMetric
        ? ((range.max - actual) / range.max) * 100
        : ((actual - range.max) / range.max) * 100)
    : 0;

  if (isCostMetric) {
    // Cost metric: higher is worse → 劣于大盘
    return {
      percentageDiff,
      isBetterThanBenchmark: false,
      label: '劣于大盘',
    };
  } else {
    // Non-cost metric: higher is better → 优于大盘
    return {
      percentageDiff: Math.abs(percentageDiff),
      isBetterThanBenchmark: true,
      label: '优于大盘',
    };
  }
}
