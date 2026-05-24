import type { Highlight, ProjectMetrics, BenchmarkData, KPITargets } from '../shared/types';

/**
 * 亮点识别模块
 * 自动识别项目亮点：KPI超额完成、优于大盘、投后优于投前
 *
 * @param metrics - 项目指标汇总
 * @param benchmarks - 大盘基准数据
 * @param kpiTargets - KPI目标集合
 * @returns Highlight[] 识别到的亮点列表
 */
export function identifyHighlights(
  metrics: ProjectMetrics,
  benchmarks: BenchmarkData,
  kpiTargets: KPITargets
): Highlight[] {
  const highlights: Highlight[] = [];

  // 1. KPI exceeded highlights
  highlights.push(...identifyKPIExceeded(metrics, kpiTargets));

  // 2. Above benchmark highlights
  highlights.push(...identifyAboveBenchmark(metrics, benchmarks));

  // 3. Post better than pre highlights
  highlights.push(...identifyPostBetterThanPre(metrics));

  return highlights;
}

/**
 * 识别KPI超额完成的指标
 * 非成本类指标: actual / target > 1
 * 成本类指标: target / actual > 1 (lower actual is better)
 */
function identifyKPIExceeded(metrics: ProjectMetrics, kpiTargets: KPITargets): Highlight[] {
  const highlights: Highlight[] = [];

  // Non-cost metrics mapping: KPI target key → actual value from metrics
  const nonCostMetrics: { key: keyof KPITargets; actual: number | 'N/A'; label: string }[] = [
    { key: 'impression', actual: metrics.totalImpressions, label: '曝光量' },
    { key: 'read', actual: metrics.totalReads, label: '阅读量' },
    { key: 'engagement', actual: metrics.totalEngagement, label: '互动量' },
    { key: 'viralCount', actual: metrics.viralCount, label: '爆文数' },
    { key: 'ctr', actual: metrics.ctr, label: 'CTR' },
  ];

  // Cost metrics mapping (lower actual is better)
  const costMetrics: { key: keyof KPITargets; actual: number | 'N/A'; label: string }[] = [
    { key: 'cpm', actual: metrics.cpm, label: 'CPM' },
    { key: 'cpc', actual: metrics.cpc, label: 'CPC' },
    { key: 'cpe', actual: metrics.cpe, label: 'CPE' },
  ];

  // Check non-cost metrics: actual / target > 1
  for (const { key, actual, label } of nonCostMetrics) {
    const target = kpiTargets[key];
    if (!target || target === 0) continue;
    if (actual === 'N/A') continue;

    const completionRate = actual / target;
    if (completionRate > 1) {
      highlights.push({
        type: 'kpi_exceeded',
        metric: label,
        description: `${label}超额完成KPI，完成率${(completionRate * 100).toFixed(1)}%`,
        value: actual,
        comparison: target,
      });
    }
  }

  // Check cost metrics: target / actual > 1 (lower actual is better)
  for (const { key, actual, label } of costMetrics) {
    const target = kpiTargets[key];
    if (!target || target === 0) continue;
    if (actual === 'N/A') continue;
    if (actual === 0) continue; // avoid division by zero

    const completionRate = target / actual;
    if (completionRate > 1) {
      highlights.push({
        type: 'kpi_exceeded',
        metric: label,
        description: `${label}优于KPI目标，完成率${(completionRate * 100).toFixed(1)}%`,
        value: actual,
        comparison: target,
      });
    }
  }

  return highlights;
}

/**
 * 识别优于大盘的指标
 * 非成本类指标 (ctr, viralRate): actual > benchmark
 * 成本类指标 (cpm, cpc, cpe): actual < benchmark (lower is better)
 */
function identifyAboveBenchmark(metrics: ProjectMetrics, benchmarks: BenchmarkData): Highlight[] {
  const highlights: Highlight[] = [];

  // Non-cost benchmark metrics (higher is better)
  const nonCostBenchmarks: { key: keyof BenchmarkData; actual: number | 'N/A'; label: string }[] = [
    { key: 'ctr', actual: metrics.ctr, label: 'CTR' },
    { key: 'viralRate', actual: metrics.viralRate, label: '爆文率' },
  ];

  // Cost benchmark metrics (lower is better)
  const costBenchmarks: { key: keyof BenchmarkData; actual: number | 'N/A'; label: string }[] = [
    { key: 'cpm', actual: metrics.cpm, label: 'CPM' },
    { key: 'cpc', actual: metrics.cpc, label: 'CPC' },
    { key: 'cpe', actual: metrics.cpe, label: 'CPE' },
  ];

  // Check non-cost benchmarks: actual > benchmark
  for (const { key, actual, label } of nonCostBenchmarks) {
    const benchmark = benchmarks[key];
    if (benchmark === undefined || benchmark === null) continue;
    if (actual === 'N/A') continue;

    if (actual > benchmark) {
      highlights.push({
        type: 'above_benchmark',
        metric: label,
        description: `${label}优于大盘基准`,
        value: actual,
        comparison: benchmark,
      });
    }
  }

  // Check cost benchmarks: actual < benchmark (lower is better)
  for (const { key, actual, label } of costBenchmarks) {
    const benchmark = benchmarks[key];
    if (benchmark === undefined || benchmark === null) continue;
    if (actual === 'N/A') continue;

    if (actual < benchmark) {
      highlights.push({
        type: 'above_benchmark',
        metric: label,
        description: `${label}优于大盘基准`,
        value: actual,
        comparison: benchmark,
      });
    }
  }

  return highlights;
}

/**
 * 识别投后优于投前的指标
 * 对于preCampaign和postCampaign中都存在的指标，post > pre 则为亮点
 */
function identifyPostBetterThanPre(metrics: ProjectMetrics): Highlight[] {
  const highlights: Highlight[] = [];

  if (!metrics.preCampaign || !metrics.postCampaign) {
    return highlights;
  }

  for (const metricKey of Object.keys(metrics.postCampaign)) {
    if (!(metricKey in metrics.preCampaign)) continue;

    const preValue = metrics.preCampaign[metricKey];
    const postValue = metrics.postCampaign[metricKey];

    if (postValue > preValue) {
      highlights.push({
        type: 'post_better_than_pre',
        metric: metricKey,
        description: `${metricKey}投后优于投前`,
        value: postValue,
        comparison: preValue,
      });
    }
  }

  return highlights;
}
