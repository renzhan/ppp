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
  noteId: string;                 // 笔记id，不会为空
  brandUserName: string;          // 报备品牌名称
  spuName: string;                // SPU名称
  kolNickName: string;            // 博主昵称
  kolId: string;                  // 博主userId
  kolFanNum: number;              // 博主粉丝量
  noteType: 'image' | 'video';    // 笔记类型 — 1图文/2视频
  noteLink: string;               // 笔记链接，不会为空
  noteTitle?: string | null;      // 笔记标题，视频笔记可能为空
  impNum: number;                 // 曝光量
  readNum: number;                // 阅读量
  engageNum: number;              // 互动量
  likeNum: number;                // 点赞量
  favNum: number;                 // 收藏量
  cmtNum: number;                 // 评论量
  shareNum: number;               // 分享量
  followNum: number;              // 关注量（API不提供，默认0）
  kolPrice: number;               // 博主报价（元）— API原单位分
  serviceFee: number;             // 服务费金额（元）— API字段名为total_platform_price
  totalPlatformPrice: number;     // 平台总价（元）— kolPrice + serviceFee
  heatImpNum: number;             // 加热曝光量
  heatReadNum: number;            // 加热阅读量
  isUnderwater: boolean;          // 是否水下合作 — 来自业务标注
  underwaterPrice: number;        // 水下报价（元）— 来自业务标注
  components?: ComponentData[];   // 组件数据（评论区/正文/底栏/互动）
  notePublishTime?: Date | null;  // 笔记发布日期
  cooperateType?: string | null;  // 笔记来源 — 0定制/1共创/2招募/3新芽/30用户授权
  duration?: number | null;       // 视频笔记总时长（秒）
  originImpNum: number;           // 自然流量曝光量
  originReadNum: number;          // 自然流量阅读量
  promotionImpNum: number;        // 推广曝光量
  promotionReadNum: number;       // 推广阅读量
  readUv: number;                 // 阅读UV
  engageRate?: number | null;     // 互动率（%）
  readCost: number;               // 阅读单价（元）— API原单位分
  engageCost: number;             // 互动单价（元）— API原单位分
  avgViewTime?: number | null;    // 平均浏览时长（秒）
  videoPlay5sRate?: number | null;// 5s播放率（%）— 仅视频笔记
  picRead3sRate?: number | null;  // 3s阅读率（%）— 仅图文笔记
  finishRate?: number | null;     // 视频完播率（%）
  cp: number;                     // 消费意向
  cpRate?: number | null;         // 消费意向转化率（%）
  cpcp: number;                   // 消费意向单价（元）— API原单位分
  orderId?: string | null;        // 订单id
  effect?: string | null;         // 是否为优效模式 — true为优效
}

/**
 * 聚光数据（金额已转换为元）
 */
export interface JuguangNote {
  noteId?: string;                // 笔记id
  fee: number;                    // 消费（元）— 推广消费金额
  impression: number;             // 展现量 — 推广展现量
  click: number;                  // 点击量 — 推广点击量，视频流中「观看视频5s」记做一次点击
  interaction: number;            // 互动量 — 点赞、收藏、关注、评论、分享5个互动行为指标之和
  iUserNum: number;               // 新增种草人群 — 用户点击推广后转化为相应SPU的I或TI人群的总人数
  tiUserNum: number;              // 新增深度种草人群 — 用户点击推广后转化为相应SPU的TI人群的总人数
  iUserPrice: number;             // 新增种草人群成本（元）— 推广消费/新增种草人群
  tiUserPrice: number;            // 新增深度种草人群成本（元）— 推广消费/新增深度种草人群
  searchCmtClick: number;         // 搜索组件点击量 — 点击推广搜索组件的次数
  searchCmtAfterRead: number;     // 搜后阅读量 — 点击组件后的搜索场景阅读量
  searchCmtAfterReadAvg: number;  // 平均搜后阅读笔记篇数 — 搜后阅读量/搜索组件点击量
  searchCmtClickCvr: number;      // 搜索组件点击转化率 — 搜索组件点击量/点击量
  acp: number;                    // 平均点击成本（元）— 推广消费/推广点击量
  cpm: number;                    // 平均千次展现费用（元）— 推广消费/推广展现量*1000
  cpi: number;                    // 平均互动成本（元）— 消费/互动量
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

// ---- 灵犀数据 ----

/**
 * 灵犀-品牌数据
 */
export interface BrandData {
  aips: number;                    // 品牌-AIPS人群总数
  ti: number;                      // 品牌-TI人群数
  penetrationRate?: number;        // 人群渗透率（%），后续扩展
  monthlySearchVolume?: number;    // 月搜索指数，后续扩展
  period: string;                  // 周期
}

/**
 * 灵犀-SPU数据
 */
export interface SpuData {
  spuName: string;                 // SPU名称
  aips: number;                    // SPU-AIPS人群资产规模
  ti?: number;                     // SPU-TI人群数，后续扩展
  period: string;                  // 周期
}

/**
 * 灵犀-关键词数据
 */
export interface KeywordData {
  keyword: string;                 // 搜索关键词
  searchVolume: number;            // 月搜索指数
  upstreamRank?: number;           // 上游搜索排名，后续扩展
  downstreamRank?: number;         // 下游搜索排名，后续扩展
  period: string;                  // 周期
}

/**
 * 灵犀-截图数据
 */
export interface ScreenshotData {
  type: string;                    // soc_sov / audience / mind
  period: string;                  // 周期
  filePath: string;                // 截图文件路径
}

/**
 * 灵犀平台数据（按 dataType 分片存储）
 */
export interface LingxiData {
  brand?: BrandData;               // 品牌级，一行
  spu?: SpuData[];                 // SPU级，多行
  keyword?: KeywordData[];         // 关键词级，多行
  screenshot?: ScreenshotData[];   // 截图
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
  /** 灵犀 API */
  LINGXI_BASE_URL: string;
  LINGXI_API_KEY: string;
}
