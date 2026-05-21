import type { KPIResult } from '../shared/types';

/**
 * 计算KPI完成率
 *
 * - 非成本类指标（曝光量、阅读量、互动量、爆文数、CTR）: completionRate = actual / target
 * - 成本类指标（CPM、CPC、CPE）: completionRate = target / actual（目标越低越好）
 * - 目标为0或未设定时: 返回 null + "未设定目标"
 * - 成本类指标实际值为0时: 返回 null + "实际值为零"（避免除零）
 */
export function calculateKPICompletion(
  actual: number,
  target: number | null | undefined,
  isReversed: boolean
): KPIResult {
  // Target is 0, null, or undefined → "未设定目标"
  if (target === null || target === undefined || target === 0) {
    return { completionRate: null, label: '未设定目标' };
  }

  // Cost metrics (isReversed=true): completionRate = target / actual
  if (isReversed) {
    // Avoid division by zero when actual is 0 for reversed metrics
    if (actual === 0) {
      return { completionRate: null, label: '实际值为零' };
    }
    const completionRate = target / actual;
    return { completionRate, label: `${(completionRate * 100).toFixed(1)}%` };
  }

  // Non-cost metrics: completionRate = actual / target
  const completionRate = actual / target;
  return { completionRate, label: `${(completionRate * 100).toFixed(1)}%` };
}
