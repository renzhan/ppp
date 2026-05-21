// ============================================================
// Decision Engine — 模块决策引擎
// ============================================================

import {
  ModuleId,
  ModuleStatus,
  ModuleDecision,
  DecisionInput,
  MetricRating,
  Rating,
  PlatformDecision,
  MODULE_NAMES,
} from './types';

// ---- Module Required Fields ----

/**
 * 每个模块所需的数据字段定义。
 * 用于判断模块是否应降级或隐藏。
 */
export const MODULE_REQUIRED_FIELDS: Record<ModuleId, string[]> = {
  M1: ['totalImpressions', 'totalEngagement', 'totalCost', 'totalNotes'],
  M2: ['projectBackground', 'strategy', 'targetAudience'],
  M3: ['topMetrics'],
  M4: ['underperformingMetrics'],
  M5: ['contentBreakdown', 'notePerformance'],
  M6: ['competitorData', 'marketShare'],
  M7: ['adSpendData', 'adPerformance', 'roi'],
  M8: ['diagnosticData', 'recommendations'],
};

/**
 * 根据数据完整性对模块进行降级判断。
 *
 * 规则：
 * - 如果 currentStatus 已经是 'hide'，保持 'hide'
 * - 如果所有必需字段都存在 → 保持 currentStatus
 * - 如果部分必需字段存在 → 'degraded'，并列出缺失字段
 * - 如果没有任何必需字段存在 → 'hide'
 *
 * @param moduleId - 模块ID
 * @param availableFields - 当前可用的数据字段列表
 * @param currentStatus - 当前模块状态（来自可见性规则）
 * @returns 降级后的状态和缺失字段列表
 */
export function applyDegradation(
  moduleId: ModuleId,
  availableFields: string[],
  currentStatus: ModuleStatus,
): { status: ModuleStatus; degradedFields?: string[] } {
  // If already hidden, keep it hidden
  if (currentStatus === 'hide') {
    return { status: 'hide' };
  }

  const requiredFields = MODULE_REQUIRED_FIELDS[moduleId];
  const presentFields = requiredFields.filter((field) => availableFields.includes(field));
  const missingFields = requiredFields.filter((field) => !availableFields.includes(field));

  // All required fields present → keep current status
  if (missingFields.length === 0) {
    return { status: currentStatus };
  }

  // No required fields present → hide
  if (presentFields.length === 0) {
    return { status: 'hide' };
  }

  // Partial data → degraded with list of missing fields
  return { status: 'degraded', degradedFields: missingFields };
}

// ---- Helper Functions ----

/**
 * 统计评级为 S 或 A 的指标数量。
 *
 * @param ratings - 指标评级数组
 * @returns S 或 A 评级的指标数量
 */
export function countHighRatings(ratings: MetricRating[]): number {
  return ratings.filter(
    (r) => r.finalRating === 'S' || r.finalRating === 'A',
  ).length;
}

/**
 * 统计评级为 C 或 D 的指标数量。
 *
 * @param ratings - 指标评级数组
 * @returns C 或 D 评级的指标数量
 */
export function countLowRatings(ratings: MetricRating[]): number {
  return ratings.filter(
    (r) => r.finalRating === 'C' || r.finalRating === 'D',
  ).length;
}

/**
 * 判断竞品评级中是否存在 S 或 A 评级。
 *
 * @param competitorRatings - 竞品指标评级数组（可选）
 * @returns 是否存在至少一个 S 或 A 评级
 */
export function hasHighCompetitorRating(competitorRatings?: MetricRating[]): boolean {
  if (!competitorRatings || competitorRatings.length === 0) {
    return false;
  }
  return competitorRatings.some(
    (r) => r.finalRating === 'S' || r.finalRating === 'A',
  );
}

/**
 * 判断广告投放费用占比是否显著（> 20%）。
 *
 * @param juguangCost - 聚光广告投放费用
 * @param totalCost - 项目总费用
 * @returns 是否占比超过 20%
 */
export function isAdSpendSignificant(juguangCost: number, totalCost: number): boolean {
  if (totalCost === 0) {
    return false;
  }
  return juguangCost / totalCost > 0.2;
}

// ---- Platform Rating Helpers ----

/**
 * 判断评级是否为高评级（S 或 A）。
 *
 * @param rating - 评级等级
 * @returns 是否为 S 或 A
 */
export function isHighRating(rating: Rating): boolean {
  return rating === 'S' || rating === 'A';
}

/**
 * 判断评级是否为可接受评级（S、A 或 B）。
 *
 * @param rating - 评级等级
 * @returns 是否为 S、A 或 B
 */
export function isAcceptableRating(rating: Rating): boolean {
  return rating === 'S' || rating === 'A' || rating === 'B';
}

// ---- Platform Visibility Rules ----

/**
 * 根据平台数据评级决定各平台数据的显示/隐藏状态。
 *
 * 规则：
 * - 蒲公英（Pugongying）：viralRate ∈ {S,A} AND cpe ∈ {S,A,B} → show
 * - 聚光（Juguang）：searchRate ∈ {S,A} AND ctr ∈ {S,A,B} AND cpeBenchmark=true → show
 * - 千瓜（Qiangua）：brandRank <= 10 → show
 * - 灵犀（Lingxi）：searchGrowth ∈ {S,A} AND audienceGrowth ∈ {S,A,B} AND cptiBenchmark=true → show
 *
 * @param platformRatings - 平台数据评级（来自 DecisionInput）
 * @returns 每个平台的显示决策数组
 */
export function decidePlatformVisibility(
  platformRatings: DecisionInput['platformRatings'],
): PlatformDecision[] {
  const decisions: PlatformDecision[] = [];

  // Pugongying (蒲公英)
  if (platformRatings?.pugongying) {
    const { viralRate, cpe } = platformRatings.pugongying;
    const viralHigh = isHighRating(viralRate);
    const cpeAcceptable = isAcceptableRating(cpe);
    const show = viralHigh && cpeAcceptable;
    decisions.push({
      platform: 'pugongying',
      show,
      reason: show
        ? `蒲公英数据展示：爆文率评级${viralRate}（S/A）且CPE评级${cpe}（S/A/B）`
        : `蒲公英数据隐藏：${!viralHigh ? `爆文率评级${viralRate}（需S/A）` : ''}${!viralHigh && !cpeAcceptable ? '且' : ''}${!cpeAcceptable ? `CPE评级${cpe}（需S/A/B）` : ''}`,
    });
  }

  // Juguang (聚光)
  if (platformRatings?.juguang) {
    const { searchRate, ctr, cpeBenchmark } = platformRatings.juguang;
    const searchHigh = isHighRating(searchRate);
    const ctrAcceptable = isAcceptableRating(ctr);
    const show = searchHigh && ctrAcceptable && cpeBenchmark;
    const reasons: string[] = [];
    if (!searchHigh) reasons.push(`搜索率评级${searchRate}（需S/A）`);
    if (!ctrAcceptable) reasons.push(`CTR评级${ctr}（需S/A/B）`);
    if (!cpeBenchmark) reasons.push('CPE未优于行业基准');
    decisions.push({
      platform: 'juguang',
      show,
      reason: show
        ? `聚光数据展示：搜索率评级${searchRate}（S/A）且CTR评级${ctr}（S/A/B）且CPE优于行业`
        : `聚光数据隐藏：${reasons.join('且')}`,
    });
  }

  // Qiangua (千瓜)
  if (platformRatings?.qiangua) {
    const { brandRank } = platformRatings.qiangua;
    const show = brandRank <= 10;
    decisions.push({
      platform: 'qiangua',
      show,
      reason: show
        ? `千瓜数据展示：品牌排名第${brandRank}（前10）`
        : `千瓜数据隐藏：品牌排名第${brandRank}（未进前10）`,
    });
  }

  // Lingxi (灵犀)
  if (platformRatings?.lingxi) {
    const { searchGrowth, audienceGrowth, cptiBenchmark } = platformRatings.lingxi;
    const searchHigh = isHighRating(searchGrowth);
    const audienceAcceptable = isAcceptableRating(audienceGrowth);
    const show = searchHigh && audienceAcceptable && cptiBenchmark;
    const reasons: string[] = [];
    if (!searchHigh) reasons.push(`搜索增长评级${searchGrowth}（需S/A）`);
    if (!audienceAcceptable) reasons.push(`人群增长评级${audienceGrowth}（需S/A/B）`);
    if (!cptiBenchmark) reasons.push('CPTI未优于行业基准');
    decisions.push({
      platform: 'lingxi',
      show,
      reason: show
        ? `灵犀数据展示：搜索增长评级${searchGrowth}（S/A）且人群增长评级${audienceGrowth}（S/A/B）且CPTI优于行业`
        : `灵犀数据隐藏：${reasons.join('且')}`,
    });
  }

  return decisions;
}

// ---- Orchestrator Functions ----

/**
 * 生成所有模块的显示决策（组合可见性规则 + 降级逻辑）。
 *
 * 流程：
 * 1. 调用 decideModuleVisibility 获取初始可见性决策
 * 2. 对每个模块调用 applyDegradation 应用降级逻辑
 * 3. 组合为 ModuleDecision[] 返回
 *
 * @param input - 决策引擎输入
 * @returns 所有8个模块的决策结果数组
 */
export function decideModules(input: DecisionInput): ModuleDecision[] {
  const visibilityResult = decideModuleVisibility(input);

  const moduleIds: ModuleId[] = ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8'];

  return moduleIds.map((moduleId) => {
    const { status: visibilityStatus, reason } = visibilityResult[moduleId];
    const availableFields = input.dataCompleteness[moduleId] || [];
    const { status: finalStatus, degradedFields } = applyDegradation(
      moduleId,
      availableFields,
      visibilityStatus,
    );

    const decision: ModuleDecision = {
      moduleId,
      moduleName: MODULE_NAMES[moduleId],
      status: finalStatus,
      reason,
      ...(degradedFields ? { degradedFields } : {}),
    };

    return decision;
  });
}

/**
 * 生成平台数据展示决策。
 *
 * 委托给 decidePlatformVisibility 处理。
 *
 * @param input - 决策引擎输入
 * @returns 平台决策数组
 */
export function decidePlatforms(input: DecisionInput): PlatformDecision[] {
  return decidePlatformVisibility(input.platformRatings);
}

// ---- Module Visibility Rules ----

/**
 * 根据输入数据决定所有模块的显示/隐藏状态。
 *
 * 规则：
 * - M1（数据总览）：始终显示
 * - M2（项目回顾）：始终显示
 * - M3（项目亮点）：当 S/A 评级指标 >= 2 时显示
 * - M4（未达预期项）：当 C/D 评级指标 >= 1 时显示
 * - M5（内容分析）：始终显示
 * - M6（竞品洞察）：当竞品评级中存在 S/A 时显示
 * - M7（投流分析）：当聚光费用占比 > 20% 时显示
 * - M8（问题诊断与建议）：当 C/D 评级指标 >= 1 时显示
 *
 * 注意：本函数不处理降级逻辑（Task 2.2）或平台规则（Task 2.3）。
 *
 * @param input - 决策引擎输入
 * @returns 每个模块的状态和原因
 */
export function decideModuleVisibility(
  input: DecisionInput,
): Record<ModuleId, { status: ModuleStatus; reason: string }> {
  const { metricRatings, juguangCost, totalCost, competitorRatings } = input;

  const highCount = countHighRatings(metricRatings);
  const lowCount = countLowRatings(metricRatings);
  const hasCompetitorHigh = hasHighCompetitorRating(competitorRatings);
  const adSpendSignificant = isAdSpendSignificant(juguangCost, totalCost);

  // M1: 数据总览 — 始终显示
  const m1: { status: ModuleStatus; reason: string } = {
    status: 'show',
    reason: '数据总览模块始终显示',
  };

  // M2: 项目回顾 — 始终显示
  const m2: { status: ModuleStatus; reason: string } = {
    status: 'show',
    reason: '项目回顾模块始终显示',
  };

  // M3: 项目亮点 — S/A 评级指标 >= 2
  const m3: { status: ModuleStatus; reason: string } = highCount >= 2
    ? { status: 'show', reason: `存在${highCount}个S/A级指标（≥2），显示项目亮点` }
    : { status: 'hide', reason: `仅${highCount}个S/A级指标（<2），隐藏项目亮点` };

  // M4: 未达预期项 — C/D 评级指标 >= 1
  const m4: { status: ModuleStatus; reason: string } = lowCount >= 1
    ? { status: 'show', reason: `存在${lowCount}个C/D级指标（≥1），显示未达预期项` }
    : { status: 'hide', reason: '无C/D级指标，隐藏未达预期项' };

  // M5: 内容分析 — 始终显示
  const m5: { status: ModuleStatus; reason: string } = {
    status: 'show',
    reason: '内容分析模块始终显示',
  };

  // M6: 竞品洞察 — 竞品评级中存在 S/A
  const m6: { status: ModuleStatus; reason: string } = hasCompetitorHigh
    ? { status: 'show', reason: '竞品对比中存在S/A级表现，显示竞品洞察' }
    : { status: 'hide', reason: '竞品对比中无S/A级表现，隐藏竞品洞察' };

  // M7: 投流分析 — 聚光费用占比 > 20%
  const m7: { status: ModuleStatus; reason: string } = adSpendSignificant
    ? { status: 'show', reason: `聚光费用占比${totalCost > 0 ? ((juguangCost / totalCost) * 100).toFixed(1) : 0}%（>20%），显示投流分析` }
    : { status: 'hide', reason: `聚光费用占比${totalCost > 0 ? ((juguangCost / totalCost) * 100).toFixed(1) : 0}%（≤20%），隐藏投流分析` };

  // M8: 问题诊断与建议 — C/D 评级指标 >= 1
  const m8: { status: ModuleStatus; reason: string } = lowCount >= 1
    ? { status: 'show', reason: `存在${lowCount}个C/D级指标（≥1），显示问题诊断与建议` }
    : { status: 'hide', reason: '无C/D级指标，隐藏问题诊断与建议' };

  return {
    M1: m1,
    M2: m2,
    M3: m3,
    M4: m4,
    M5: m5,
    M6: m6,
    M7: m7,
    M8: m8,
  };
}
