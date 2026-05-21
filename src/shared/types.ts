// ============================================================
// Shared TypeScript Interfaces and Types
// 小红书营销项目复盘报告系统 - 数据模型定义
// ============================================================

// ---- Enums and Type Unions ----

/**
 * KOL层级分类（基于粉丝量）
 * KOC: <10000, 尾部: 10000-49999, 腰尾部: 50000-99999, 腰部: 100000-499999, 头部: >=500000
 */
export type KOLTier = 'KOC' | '尾部' | '腰尾部' | '腰部' | '头部';

/**
 * 报告模块顺序（固定12个模块）
 */
export type ReportModuleOrder = [
  'customer_info',
  'project_review',
  'data_overview',
  'highlights',
  'content_analysis',
  'brand_voice',
  'audience_assets',
  'paid_traffic',
  'conversion_analysis',
  'competitor_benchmark',
  'highlight_summary',
  'optimization_suggestions'
];

/**
 * 报告导出格式
 */
export enum ExportFormat {
  JSON = 'json',
  PDF = 'pdf',
  PPTX = 'pptx',
}

// ---- Configuration Interfaces ----

/**
 * 互动量计算口径配置
 * 默认口径：点赞 + 收藏 + 评论 + 分享 + 关注
 * 可配置去掉分享和/或关注
 */
export interface EngagementConfig {
  includeShare: boolean;   // 是否包含分享，默认true
  includeFollow: boolean;  // 是否包含关注，默认true
}

/**
 * 特殊达人返点规则
 */
export interface SpecialRule {
  kolId: string;
  discount: number;
}

/**
 * 合作政策配置
 */
export interface CooperationPolicy {
  defaultDiscount: number;       // 统一折扣系数 (0-1)
  specialRules: SpecialRule[];   // 特殊达人返点规则
}

// ---- Core Data Interfaces ----

/**
 * 项目信息
 */
export interface Project {
  id: string;
  category: string;              // 品类（必填）
  brand: string;                 // 合作品牌（必填）
  spuName?: string;              // SPU/产品名称
  projectName: string;           // 项目名称（必填）
  startDate: Date;               // 项目开始日期（必填）
  endDate: Date;                 // 项目结束日期（必填）
  engagementConfig: EngagementConfig;
  cooperationPolicy: CooperationPolicy;
}

/**
 * 组件数据（笔记中的正文/互动/评论区组件）
 */
export interface ComponentData {
  componentType: string;         // 组件类型（正文组件/互动组件/评论区组件）
  impressions: number;           // 组件曝光量
  clicks: number;                // 组件点击量
  conversions: number;           // 组件转化量
}

/**
 * 蒲公英笔记数据（金额已转换为元）
 */
export interface PugongyingNote {
  noteId: string;
  brandUserName: string;
  spuName: string;
  kolNickName: string;
  kolId: string;
  kolFanNum: number;
  noteType: 'image' | 'video';
  noteLink: string;
  impNum: number;
  readNum: number;
  engageNum: number;
  likeNum: number;
  favNum: number;
  cmtNum: number;
  shareNum: number;
  followNum: number;
  kolPrice: number;              // 元
  serviceFee: number;            // 元（API total_platform_price → 服务费）
  totalPlatformPrice: number;    // 元（kolPrice + serviceFee，计算得出）
  heatImpNum: number;
  heatReadNum: number;
  isUnderwater: boolean;
  underwaterPrice: number;       // 元
  components?: ComponentData[];
  // 0521 新字段
  notePublishTime?: Date | null;
  cooperateType?: string | null;
  duration?: number | null;
  originImpNum: number;
  originReadNum: number;
  promotionImpNum: number;
  promotionReadNum: number;
  readUv: number;
  engageRate?: number | null;
  readCost: number;
  engageCost: number;
  avgViewTime?: number | null;
  videoPlay5sRate?: number | null;
  picRead3sRate?: number | null;
  finishRate?: number | null;
  cp: number;
  cpRate?: number | null;
  cpcp: number;
  orderId?: string | null;
  effect?: string | null;
}

/**
 * 聚光数据（金额已转换为元）
 */
export interface JuguangNote {
  noteId?: string;
  fee: number;                   // 消耗（元）
  impression: number;
  click: number;
  interaction: number;
  iUserNum: number;
  tiUserNum: number;
  iUserPrice: number;
  tiUserPrice: number;
  searchCmtClick: number;
  searchCmtAfterRead: number;
  searchCmtAfterReadAvg: number;
  searchCmtClickCvr: number;
}

/**
 * 笔记指标（用于计算引擎）
 */
export interface NoteMetrics {
  noteId: string;
  likeNum: number;
  favNum: number;
  cmtNum: number;
  shareNum: number;
  followNum: number;
  impNum: number;
  readNum: number;
}

/**
 * 业务标注数据（底表上传）
 */
export interface BusinessAnnotation {
  noteId: string;
  contentDirection: string;      // 内容方向
  accountType: string;           // 账号类型
  kolType: string;               // KOL类型
  launchPhase: string;           // 投放阶段
  isUnderwater: boolean;         // 水下合作标记
}

// ---- 灵犀数据（底表上传） ----

/**
 * AIPS人群资产数据
 */
export interface AIPSData {
  awareness: number;
  interest: number;
  purchase: number;
  share: number;
  penetrationRate: number;
  flowRates: Record<string, number>; // 各层级间转化率
}

/**
 * 品牌排名数据
 */
export interface BrandRankingData {
  brandName: string;
  rank: number;
  category: string;
  period: string;
}

/**
 * SOC/SOV数据
 */
export interface SOCSOVData {
  soc: number;                   // 内容份额占比
  sov: number;                   // 声量份额占比
  category: string;
  period: string;
}

/**
 * SPU排名数据
 */
export interface SPURankingData {
  spuName: string;
  rank: number;
  category: string;
  period: string;
}

/**
 * 灵犀平台数据（底表上传）
 */
export interface LingxiData {
  aips?: AIPSData;               // 人群资产数据
  brandRanking?: BrandRankingData;
  socSov?: SOCSOVData;
  spuRanking?: SPURankingData;
}

// ---- Calculation Input/Output Interfaces ----

/**
 * 费用计算输入
 */
export interface CostCalculationInput {
  aboveWaterNotes: {
    kolPrice: number;            // 博主报价（元）
    serviceFee: number;          // 服务费（元）
    kolId: string;
  }[];
  underwaterPrices: number[];    // 水下报价列表（元）
  juguangFees: number[];         // 聚光消耗列表（元）
  cooperationPolicy: CooperationPolicy;
}

/**
 * 项目费用结果
 */
export interface ProjectCost {
  aboveWaterCost: number;
  underwaterCost: number;
  juguangCost: number;
  totalCost: number;
}

/**
 * 搜索效果指标
 */
export interface SearchMetrics {
  searchCmtClick: number;        // 搜索组件点击量
  searchCmtAfterRead: number;    // 搜索后阅读量
  searchCmtAfterReadAvg: number; // 搜索后平均阅读量
  searchCmtClickCvr: number;     // 搜索点击转化率
}

/**
 * 投流指标结果
 */
export interface PaidTrafficMetrics {
  impression: number;
  click: number;
  ctr: number | 'N/A';
  cpc: number | 'N/A';
  cpm: number | 'N/A';
  cpe: number | 'N/A';
  iUserNum: number;
  tiUserNum: number;
  iUserPrice: number;
  tiUserPrice: number;
  searchMetrics: SearchMetrics;
}

/**
 * KPI完成率结果
 */
export interface KPIResult {
  completionRate: number | null; // null表示未设定目标
  label: string;
}

/**
 * 自然曝光结果
 */
export interface NaturalExposureResult {
  value: number;                 // 最小为0
  isAnomalous: boolean;          // 计算结果为负时标记
}

/**
 * 大盘对比结果
 */
export interface BenchmarkResult {
  percentageDiff: number;
  isBetterThanBenchmark: boolean;
  label: '优于大盘' | '劣于大盘';
}

/**
 * 亮点
 */
export interface Highlight {
  type: 'kpi_exceeded' | 'above_benchmark' | 'post_better_than_pre' | 'outstanding_group';
  metric: string;
  description: string;
  value: number;
  comparison?: number;
}

/**
 * 组件转化率指标
 */
export interface ComponentMetrics {
  componentType: string;
  impressions: number;
  clicks: number;
  conversions: number;
  clickRate: number | 'N/A';       // clicks / impressions
  conversionRate: number | 'N/A';  // conversions / clicks
}

// ---- Aggregation Interfaces ----

/**
 * 笔记关联KOL信息（用于层级聚合）
 */
export interface NoteWithKOL {
  noteId: string;
  kolId: string;
  kolFanNum: number;
  kolNickName: string;
  impNum: number;
  readNum: number;
  likeNum: number;
  favNum: number;
  cmtNum: number;
  shareNum: number;
  followNum: number;
  kolPrice: number;
  serviceFee: number;
  isUnderwater: boolean;
  underwaterPrice: number;
}

/**
 * 带业务标注的笔记（用于内容分析聚合）
 */
export interface AnnotatedNote {
  noteId: string;
  noteType: 'image' | 'video';
  impNum: number;
  readNum: number;
  likeNum: number;
  favNum: number;
  cmtNum: number;
  shareNum: number;
  followNum: number;
  kolPrice: number;
  serviceFee: number;
  isUnderwater: boolean;
  underwaterPrice: number;
  // 业务标注字段
  contentDirection: string;
  accountType: string;
  kolType: string;
  launchPhase: string;
}

/**
 * 维度聚合结果
 */
export interface DimensionAggregation {
  dimensionValue: string;        // 维度值（如"图文"、"视频"等）
  noteCount: number;
  totalImpressions: number;
  totalReads: number;
  totalEngagement: number;
  cpe: number | 'N/A';
  viralCount: number;
  viralRate: number;
}

/**
 * KOL层级聚合结果
 */
export interface KOLTierAggregation {
  tier: KOLTier;
  noteCount: number;
  totalImpressions: number;
  totalReads: number;
  totalEngagement: number;
  averageCPE: number | 'N/A';
  viralCount: number;
  viralRate: number;
}

// ---- Report Interfaces ----

/**
 * 报告模块数据
 */
export interface ReportModule {
  moduleId: string;
  title: string;
  data: Record<string, unknown>;
}

/**
 * 完整报告
 */
export interface Report {
  projectId: string;
  project: Project;
  modules: ReportModule[];
  generatedAt: Date;
}

/**
 * LLM Vision 图片内容
 */
export interface VisionImageContent {
  type: 'image_url';
  image_url: { url: string };
}

export interface VisionTextContent {
  type: 'text';
  text: string;
}

export type VisionContentPart = VisionImageContent | VisionTextContent;

/**
 * LLM聊天消息
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | VisionContentPart[];
}

/**
 * LLM调用选项
 */
export interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
  timeout?: number;              // 超时时间（毫秒），默认30000
}

// ---- Validation Interfaces ----

/**
 * 验证结果
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

// ---- Manual Input Interfaces ----

/**
 * 人工录入数据
 */
export interface ManualInputData {
  inputType: 'benchmark' | 'kpi_target' | 'brand_search_index' | 'topic_exposure';
  dataContent: Record<string, unknown>;
}

// ---- Project Metrics and Benchmark Interfaces ----

/**
 * KPI目标集合
 */
export interface KPITargets {
  impression?: number;
  read?: number;
  engagement?: number;
  viralCount?: number;
  cpm?: number;
  cpc?: number;
  cpe?: number;
  ctr?: number;
}

/**
 * 大盘基准数据
 */
export interface BenchmarkData {
  cpm?: number;
  cpc?: number;
  cpe?: number;
  ctr?: number;
  viralRate?: number;
}

/**
 * 项目指标汇总（用于亮点识别）
 */
export interface ProjectMetrics {
  totalImpressions: number;
  totalReads: number;
  totalEngagement: number;
  viralCount: number;
  viralRate: number;
  cpm: number | 'N/A';
  cpc: number | 'N/A';
  cpe: number | 'N/A';
  ctr: number | 'N/A';
  totalCost: number;
  // 投前/投后对比数据（可选）
  preCampaign?: Record<string, number>;
  postCampaign?: Record<string, number>;
}

/**
 * 所有指标汇总（用于AI优化建议生成）
 */
export interface AllMetrics {
  projectMetrics: ProjectMetrics;
  kpiResults: Record<string, KPIResult>;
  benchmarkResults: Record<string, BenchmarkResult>;
  kolTierAggregation: KOLTierAggregation[];
  dimensionAggregations: Record<string, DimensionAggregation[]>;
  paidTrafficMetrics?: PaidTrafficMetrics;
  naturalExposure?: NaturalExposureResult;
}

/**
 * 项目背景信息（AI解析策划案输出）
 */
export interface ProjectBackground {
  objective: string;             // 传播目的
  strategy: string;              // 策略回顾
  targetAudience: string;       // 目标人群
  keyMessages: string[];         // 核心传播信息
  budget?: number;               // 预算
  timeline?: string;             // 时间线
}

// ---- Environment Configuration ----

/**
 * 环境配置
 */
export interface EnvConfig {
  DATABASE_URL: string;
  LLM_PROVIDER: 'openai' | 'qwen';
  /** OpenAI 兼容接口配置 */
  LLM_BASE_URL: string;
  LLM_API_KEY: string;
  LLM_MODEL: string;
  /** Qwen (通义千问) 配置 */
  QWEN_BASE_URL: string;
  QWEN_MODEL_API_KEY: string;
  QWEN_MODEL_CHAT: string;
  QWEN_MODEL_LITE: string;
  QWEN_MODEL_BASE: string;
  QWEN_EMBEDDING_MODEL: string;
  /** 派查查 API */
  PAICHACHA_API_KEY: string;
  PAICHACHA_BASE_URL: string;
  /** 蒲公英 API */
  PUGONGYING_NOTE_BASE_URL: string;
  PUGONGYING_COMMENT_BASE_URL: string;
  PUGONGYING_API_KEY: string;
  /** 聚光 API */
  JUGUANG_BASE_URL: string;
  JUGUANG_API_KEY: string;
}
