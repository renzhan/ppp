// ============================================================
// Engine Shared Types and Constants
// 智能引擎层共享类型定义
// ============================================================

// ---- Core Type Aliases ----

/** 评级等级: S(超预期) > A(优秀) > B(达标) > C(待改善) > D(不达标) */
export type Rating = 'S' | 'A' | 'B' | 'C' | 'D';

/** 项目类型 */
export type ProjectType = '新品上市' | '日常种草' | '节点营销' | '竞品防御';

/** 叙事语气强度 */
export type ToneIntensity = 'positive' | 'standard' | 'conservative';

/** 模块显示状态 */
export type ModuleStatus = 'show' | 'hide' | 'degraded';

/** 模块ID（8个报告模块） */
export type ModuleId = 'M1' | 'M2' | 'M3' | 'M4' | 'M5' | 'M6' | 'M7' | 'M8';

// ---- Constants ----

/** 模块名称映射 */
export const MODULE_NAMES: Record<ModuleId, string> = {
  M1: '数据总览',
  M2: '项目回顾',
  M3: '项目亮点',
  M4: '未达预期项',
  M5: '内容分析',
  M6: '竞品洞察',
  M7: '投流分析',
  M8: '问题诊断与建议',
};

/**
 * 评级阈值（纯函数）：
 * - ratio >= 1.5 → S
 * - ratio >= 1.2 → A
 * - ratio >= 1.0 → B
 * - ratio >= 0.8 → C
 * - ratio < 0.8  → D
 */
export const RATING_THRESHOLDS = {
  S: 1.5,
  A: 1.2,
  B: 1.0,
  C: 0.8,
} as const;

// ---- Rating Engine Interfaces ----

/** 单维度评级结果 */
export interface DimensionRating {
  dimension: 'vs_kpi' | 'vs_benchmark' | 'vs_pre_campaign';
  ratio: number;          // 评级比率
  rating: Rating | null;  // null表示该维度无数据
}

/** 指标评级结果 */
export interface MetricRating {
  metricName: string;
  isCostMetric: boolean;
  dimensions: DimensionRating[];
  finalRating: Rating;    // 取三个维度中最高评级
}

/** 评级引擎输入 */
export interface RatingInput {
  metricName: string;
  actualValue: number;
  isCostMetric: boolean;
  kpiTarget?: number;           // 来自策划案KPI
  benchmarkValue?: number;      // 行业基准
  preCampaignValue?: number;    // 投前数据
}

// ---- Decision Engine Interfaces ----

/** 模块决策结果 */
export interface ModuleDecision {
  moduleId: ModuleId;
  moduleName: string;
  status: ModuleStatus;
  reason: string;           // 决策原因
  degradedFields?: string[]; // 降级时缺失的字段
}

/** 平台数据展示决策 */
export interface PlatformDecision {
  platform: 'pugongying' | 'juguang' | 'qiangua' | 'lingxi';
  show: boolean;
  reason: string;
}

/** 决策引擎输入 */
export interface DecisionInput {
  projectType: ProjectType;
  metricRatings: MetricRating[];
  totalCost: number;
  juguangCost: number;
  competitorRatings?: MetricRating[];  // 竞品对比评级
  dataCompleteness: Record<ModuleId, string[]>; // 每个模块已有的数据字段
  // 平台数据评级
  platformRatings?: {
    pugongying?: { viralRate: Rating; cpe: Rating };
    juguang?: { searchRate: Rating; ctr: Rating; cpeBenchmark: boolean };
    qiangua?: { brandRank: number };
    lingxi?: { searchGrowth: Rating; audienceGrowth: Rating; cptiBenchmark: boolean };
  };
}

// ---- Narrative Engine Interfaces ----

/** 叙事生成请求 */
export interface NarrativeRequest {
  projectType: ProjectType;
  moduleId: ModuleId;
  metricRatings: MetricRating[];
  toneIntensity: ToneIntensity;
  dataContext: Record<string, unknown>;  // 模块相关数据
  attributionStrategy?: string;          // 指定归因策略
}

/** 叙事生成结果 */
export interface NarrativeResult {
  moduleId: ModuleId;
  paragraphs: NarrativeParagraph[];
  toneUsed: ToneIntensity;
  attributionUsed: string;
}

/** 叙事段落 */
export interface NarrativeParagraph {
  id: string;
  content: string;
  tone: ToneIntensity;
  relatedMetrics: string[];
  isTransformed: boolean;  // 是否经过"问题转机会"转换
}

/** YAML Prompt模板结构 */
export interface PromptTemplate {
  name: string;
  version: string;
  projectType: ProjectType;
  moduleId: ModuleId;
  toneIntensity: ToneIntensity;
  prompt: string;
  variables: string[];
  fallbackText: string;     // LLM失败时的降级文案
  changelog?: string[];
}
