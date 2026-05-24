// ============================================================
// Rating Engine — 数据评级引擎
// ============================================================

import { Rating, RatingInput, MetricRating, DimensionRating, RATING_THRESHOLDS } from './types';

// ---- Constants ----

/** 成本类指标列表（越低越好） */
export const COST_METRICS = ['CPE', 'CPM', 'CPC'] as const;

// ---- Functions ----

/**
 * 将比率值映射为评级等级。
 *
 * 阈值规则：
 * - ratio >= 1.5 → S
 * - ratio >= 1.2 → A
 * - ratio >= 1.0 → B
 * - ratio >= 0.8 → C
 * - ratio < 0.8  → D
 *
 * 边界情况：
 * - ratio = 0 → D（低于0.8）
 * - 负数 → D（低于0.8）
 * - 极大值 → S（超过1.5）
 */
export function ratioToRating(ratio: number): Rating {
  if (ratio >= RATING_THRESHOLDS.S) return 'S';
  if (ratio >= RATING_THRESHOLDS.A) return 'A';
  if (ratio >= RATING_THRESHOLDS.B) return 'B';
  if (ratio >= RATING_THRESHOLDS.C) return 'C';
  return 'D';
}

/**
 * 计算评级比率，根据指标是否为成本类进行方向反转。
 *
 * 成本类指标（CPE, CPM, CPC）：ratio = comparisonValue / actualValue
 *   - 实际值越低越好，所以用对比值除以实际值
 *   - 如果 actualValue = 0，无法计算，返回 null
 *
 * 非成本类指标：ratio = actualValue / comparisonValue
 *   - 实际值越高越好，所以用实际值除以对比值
 *   - 如果 comparisonValue = 0，无法计算，返回 null
 *
 * @param actualValue - 指标实际值
 * @param comparisonValue - 对比值（KPI目标、行业基准或投前数据）
 * @param isCostMetric - 是否为成本类指标
 * @returns 比率值，或 null（除数为零时）
 */
export function computeRatio(
  actualValue: number,
  comparisonValue: number,
  isCostMetric: boolean,
): number | null {
  if (isCostMetric) {
    // 成本类：ratio = comparisonValue / actualValue
    if (actualValue === 0) return null;
    return comparisonValue / actualValue;
  } else {
    // 非成本类：ratio = actualValue / comparisonValue
    if (comparisonValue === 0) return null;
    return actualValue / comparisonValue;
  }
}

// ---- Rating Order (for "best of" comparison) ----

/** Rating priority: S > A > B > C > D */
const RATING_ORDER: Record<Rating, number> = {
  S: 5,
  A: 4,
  B: 3,
  C: 2,
  D: 1,
};

/**
 * 对单个指标进行三维度评级。
 *
 * 三个维度：
 * - vs_kpi: 与KPI目标对比
 * - vs_benchmark: 与行业基准对比
 * - vs_pre_campaign: 与投前数据对比
 *
 * 对于每个维度：
 * - 如果对比值为 undefined/null，该维度 rating 为 null
 * - 否则调用 computeRatio 计算比率，再调用 ratioToRating 得到评级
 *
 * 最终评级 = 所有非 null 维度中最高的评级（S > A > B > C > D）
 * 如果所有维度均为 null，默认 finalRating = 'C'
 */
export function rateMetric(input: RatingInput): MetricRating {
  const { metricName, actualValue, isCostMetric, kpiTarget, benchmarkValue, preCampaignValue } = input;

  const dimensionConfigs: Array<{
    dimension: DimensionRating['dimension'];
    comparisonValue: number | undefined;
  }> = [
    { dimension: 'vs_kpi', comparisonValue: kpiTarget },
    { dimension: 'vs_benchmark', comparisonValue: benchmarkValue },
    { dimension: 'vs_pre_campaign', comparisonValue: preCampaignValue },
  ];

  const dimensions: DimensionRating[] = dimensionConfigs.map(({ dimension, comparisonValue }) => {
    if (comparisonValue == null) {
      return { dimension, ratio: 0, rating: null };
    }

    const ratio = computeRatio(actualValue, comparisonValue, isCostMetric);
    if (ratio === null) {
      return { dimension, ratio: 0, rating: null };
    }

    return { dimension, ratio, rating: ratioToRating(ratio) };
  });

  // Final rating = best (highest) of non-null dimension ratings
  const nonNullRatings = dimensions
    .map((d) => d.rating)
    .filter((r): r is Rating => r !== null);

  let finalRating: Rating;
  if (nonNullRatings.length === 0) {
    finalRating = 'C'; // Default when all dimensions are null
  } else {
    finalRating = nonNullRatings.reduce((best, current) =>
      RATING_ORDER[current] > RATING_ORDER[best] ? current : best,
    );
  }

  return {
    metricName,
    isCostMetric,
    dimensions,
    finalRating,
  };
}

/**
 * 对多个指标进行批量评级。
 *
 * @param inputs - 评级输入数组
 * @returns 每个指标的评级结果数组
 */
export function rateAllMetrics(inputs: RatingInput[]): MetricRating[] {
  return inputs.map(rateMetric);
}
