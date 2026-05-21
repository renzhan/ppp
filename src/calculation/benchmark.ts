import type { BenchmarkResult } from '../shared/types';

/**
 * 大盘对比计算
 * 计算实际值与大盘基准值的百分比差异，并标记优劣
 *
 * @param actual - 实际指标值
 * @param benchmark - 大盘基准值
 * @param isCostMetric - 是否为成本类指标（成本越低越好）
 * @returns BenchmarkResult 包含百分比差异、是否优于大盘、标签
 */
export function calculateBenchmarkComparison(
  actual: number,
  benchmark: number,
  isCostMetric: boolean
): BenchmarkResult {
  // For non-cost metrics (higher is better): (actual - benchmark) / benchmark × 100
  // For cost metrics (lower is better): (benchmark - actual) / benchmark × 100
  const percentageDiff = isCostMetric
    ? ((benchmark - actual) / benchmark) * 100
    : ((actual - benchmark) / benchmark) * 100;

  const isBetterThanBenchmark = percentageDiff > 0;
  const label: '优于大盘' | '劣于大盘' = isBetterThanBenchmark ? '优于大盘' : '劣于大盘';

  return {
    percentageDiff,
    isBetterThanBenchmark,
    label,
  };
}
