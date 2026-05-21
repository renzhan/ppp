# Design Document

## Overview

本系统为小红书营销项目复盘报告自动生成系统，采用分层架构设计。系统核心流程为：多源数据采集 → PostgreSQL持久化 → 指标计算 → AI辅助分析 → 报告组装。

**核心基础设施：**
- **数据库**: PostgreSQL on Supabase（真实数据库，无mock）
- **LLM**: gpt-5.1 via OpenAI-compatible gateway（`https://aiop-gateway.item.com/proxy/openai/v1`）
- **数据采集**: 派查查API（蒲公英/聚光）+ 底表上传（灵犀/业务标注）
- **无OCR模块**: 灵犀数据和业务标注数据均通过结构化底表上传

**设计目标：**
- 所有数据持久化到PostgreSQL，支持项目级数据隔离
- 计算引擎为纯函数，输入从数据库读取，输出写回数据库
- 真实LLM调用用于策划案解析和优化建议生成
- 货币转换（分→元）在数据入库前完成
- 底表上传替代OCR，灵犀和业务标注数据均为结构化数据

**技术选型决策：**
- TypeScript / Node.js 作为主要开发语言
- PostgreSQL (Supabase) 作为唯一数据存储
- Prisma 作为 ORM（类型安全、迁移管理）
- OpenAI SDK 连接自定义网关调用 gpt-5.1
- Vitest + fast-check 用于测试（测试直接操作真实数据库）

## Architecture

```mermaid
graph TB
    subgraph DataSources["数据源层"]
        A[派查查API<br/>蒲公英+聚光数据]
        B[人工录入<br/>KPI目标/Benchmark]
        C[底表上传<br/>灵犀平台数据]
        D[底表上传<br/>业务标注数据]
    end

    subgraph Ingestion["数据采集层 Data_Ingestion_Module"]
        API_Client[派查查API客户端<br/>含分→元转换]
        Manual_Input[人工录入接口]
        Spreadsheet_Parser[底表解析器<br/>Excel/CSV解析]
        Normalizer[数据标准化器<br/>字段映射/校验]
    end

    subgraph Storage["数据存储层 PostgreSQL (Supabase)"]
        DB[(PostgreSQL)]
    end

    subgraph Calculation["计算引擎层 Calculation_Engine"]
        CostCalc[费用计算模块]
        MetricsCalc[效果指标计算<br/>CPE/CPM/CPC/CTR]
        ViralCalc[爆文判定模块]
        KPICalc[KPI完成率模块]
        TierCalc[达人层级分类]
        TrafficCalc[投流分析模块]
        ContentCalc[内容分析模块]
        HighlightCalc[亮点识别模块]
    end

    subgraph Report["报告生成层 Report_Generator"]
        Assembler[报告组装器]
        LLM[gpt-5.1 via Gateway<br/>策划案解析/优化建议]
        Exporter[报告导出器]
    end

    A --> API_Client
    B --> Manual_Input
    C --> Spreadsheet_Parser
    D --> Spreadsheet_Parser

    API_Client --> Normalizer
    Manual_Input --> Normalizer
    Spreadsheet_Parser --> Normalizer

    Normalizer --> DB

    DB --> Calculation
    Calculation --> DB
    DB --> Report
    LLM --> Assembler
    Assembler --> Exporter
```

**架构决策说明：**
1. **PostgreSQL持久化**: 所有数据存储在Supabase PostgreSQL中，支持事务、索引和复杂查询。测试直接操作真实数据库（使用测试专用schema或事务回滚）。
2. **无Mock设计**: 核心功能测试使用真实数据库和真实LLM。属性测试针对纯计算函数（不需要外部依赖）。集成测试使用真实基础设施。
3. **底表上传替代OCR**: 灵犀平台数据和业务标注数据通过Excel/CSV底表上传，系统解析结构化数据后入库。无需图像识别模块。
4. **计算引擎纯函数化**: 计算逻辑为纯函数，从数据库读取输入数据，计算后将结果写回。纯函数设计使属性测试无需数据库依赖。
5. **真实LLM调用**: 通过OpenAI-compatible API调用gpt-5.1，用于策划案解析和优化建议生成。

## Components and Interfaces

### 1. Data_Ingestion_Module（数据采集模块）

```typescript
// 派查查API客户端
interface PaichachaClient {
  // 获取蒲公英平台数据（返回金额已转换为元）
  fetchPugongyingData(noteIds: string[]): Promise<PugongyingNote[]>;
  
  // 获取聚光平台数据（返回金额已转换为元）
  fetchJuguangData(noteIds: string[]): Promise<JuguangNote[]>;
}

// 金额转换（分→元）
function normalizeAmount(amountInFen: number): number;

// 底表解析器
interface SpreadsheetParser {
  // 解析灵犀平台底表
  parseLingxiSheet(file: Buffer, format: 'xlsx' | 'csv'): LingxiData;
  
  // 解析业务标注底表
  parseAnnotationSheet(file: Buffer, format: 'xlsx' | 'csv'): BusinessAnnotation[];
}

// 数据入库服务
interface DataPersistenceService {
  // 保存蒲公英数据到PostgreSQL
  savePugongyingNotes(projectId: string, notes: PugongyingNote[]): Promise<void>;
  
  // 保存聚光数据到PostgreSQL
  saveJuguangData(projectId: string, data: JuguangNote[]): Promise<void>;
  
  // 保存灵犀数据到PostgreSQL
  saveLingxiData(projectId: string, data: LingxiData): Promise<void>;
  
  // 保存业务标注到PostgreSQL
  saveAnnotations(projectId: string, annotations: BusinessAnnotation[]): Promise<void>;
  
  // 保存人工录入数据
  saveManualInput(projectId: string, input: ManualInputData): Promise<void>;
}
```

### 2. Calculation_Engine（计算引擎 - 纯函数）

```typescript
interface CalculationEngine {
  // 费用计算
  calculateProjectTotalCost(params: CostCalculationInput): ProjectCost;
  
  // 核心效果指标（有机流量）
  calculateCPE(totalCost: number, totalEngagement: number): number | 'N/A';
  calculateCPM(totalCost: number, totalImpressions: number): number | 'N/A';
  calculateCPC(totalCost: number, totalReads: number): number | 'N/A';
  calculateCTR(totalReads: number, totalImpressions: number): number | 'N/A';
  
  // 投流效果指标
  calculatePaidTrafficMetrics(juguangData: JuguangAggregated): PaidTrafficMetrics;
  
  // 互动量计算（可配置口径）
  calculateEngagement(note: NoteMetrics, config: EngagementConfig): number;
  
  // 爆文判定（固定口径：点赞+收藏+评论≥1000）
  isViralNote(note: NoteMetrics): boolean;
  calculateViralRate(notes: NoteMetrics[]): { viralCount: number; viralRate: number };
  
  // KPI完成率
  calculateKPICompletion(actual: number, target: number, isReversed: boolean): KPIResult;
  
  // 达人层级分类
  classifyKOLTier(fanCount: number): KOLTier;
  
  // 达人层级聚合
  aggregateByKOLTier(notes: NoteWithKOL[]): KOLTierAggregation[];
  
  // 自然曝光计算
  calculateNaturalExposure(pugongyingImpressions: number, juguangImpressions: number): NaturalExposureResult;
  
  // 内容分析聚合
  aggregateByDimension(notes: AnnotatedNote[], dimension: string): DimensionAggregation[];
  
  // 大盘对比
  calculateBenchmarkComparison(actual: number, benchmark: number, isCostMetric: boolean): BenchmarkResult;
  
  // 亮点识别
  identifyHighlights(metrics: ProjectMetrics, benchmarks: BenchmarkData, kpiTargets: KPITargets): Highlight[];
  
  // 组件转化率
  calculateComponentConversion(components: ComponentData[]): ComponentMetrics[];
}
```

### 3. Report_Generator（报告生成模块）

```typescript
interface ReportGenerator {
  // 组装完整报告（从数据库读取所有数据）
  assembleReport(projectId: string): Promise<Report>;
  
  // AI解析策划案（真实LLM调用）
  parsePlanDocument(document: Buffer): Promise<ProjectBackground>;
  
  // AI生成优化建议（真实LLM调用）
  generateOptimizationSuggestions(metrics: AllMetrics, highlights: Highlight[]): Promise<string>;
  
  // 保存编辑后的优化建议
  saveEditedSuggestions(projectId: string, content: string): Promise<void>;
  
  // 导出报告
  exportReport(report: Report, format: ExportFormat): Promise<Buffer>;
}
```

### 4. LLM Client（AI客户端）

```typescript
interface LLMClient {
  // 通过OpenAI-compatible API调用gpt-5.1
  chat(messages: ChatMessage[], options?: LLMOptions): Promise<string>;
}

interface LLMConfig {
  baseURL: string;    // https://aiop-gateway.item.com/proxy/openai/v1
  model: string;      // gpt-5.1
  apiKey: string;     // from .env
}
```

### 5. Configuration

```typescript
interface EngagementConfig {
  includeShare: boolean;   // 是否包含分享，默认true
  includeFollow: boolean;  // 是否包含关注，默认true
}

interface CooperationPolicy {
  defaultDiscount: number;       // 统一折扣系数 (0-1)
  specialRules: SpecialRule[];   // 特殊达人返点规则
}

interface SpecialRule {
  kolId: string;
  discount: number;
}

// 环境配置 (.env)
interface EnvConfig {
  DATABASE_URL: string;          // postgresql://...supabase.co:5432/postgres
  LLM_BASE_URL: string;         // https://aiop-gateway.item.com/proxy/openai/v1
  LLM_API_KEY: string;
  LLM_MODEL: string;            // gpt-5.1
  PAICHACHA_API_KEY: string;
  PAICHACHA_BASE_URL: string;
}
```

## Data Models

### PostgreSQL Schema

```sql
-- 项目表
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category VARCHAR(100) NOT NULL,          -- 品类
  brand VARCHAR(200) NOT NULL,             -- 合作品牌
  spu_name VARCHAR(200),                   -- SPU/产品名称
  project_name VARCHAR(200) NOT NULL,      -- 项目名称
  start_date DATE NOT NULL,                -- 项目开始日期
  end_date DATE NOT NULL,                  -- 项目结束日期
  engagement_config JSONB NOT NULL DEFAULT '{"includeShare": true, "includeFollow": true}',
  cooperation_policy JSONB NOT NULL DEFAULT '{"defaultDiscount": 1, "specialRules": []}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 笔记表（蒲公英数据）
CREATE TABLE notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  note_id VARCHAR(100) NOT NULL,           -- 小红书笔记ID
  brand_user_name VARCHAR(200),
  spu_name VARCHAR(200),
  kol_nick_name VARCHAR(200),
  kol_id VARCHAR(100),
  kol_fan_num INTEGER,
  note_type VARCHAR(20) CHECK (note_type IN ('image', 'video')),
  note_link TEXT,
  imp_num INTEGER DEFAULT 0,               -- 曝光量
  read_num INTEGER DEFAULT 0,              -- 阅读量
  engage_num INTEGER DEFAULT 0,            -- 平台互动量
  like_num INTEGER DEFAULT 0,              -- 点赞数
  fav_num INTEGER DEFAULT 0,               -- 收藏数
  cmt_num INTEGER DEFAULT 0,               -- 评论数
  share_num INTEGER DEFAULT 0,             -- 分享数
  follow_num INTEGER DEFAULT 0,            -- 关注数
  kol_price NUMERIC(12,2) DEFAULT 0,       -- 博主报价（元）
  service_fee NUMERIC(12,2) DEFAULT 0,     -- 服务费（元）
  total_platform_price NUMERIC(12,2) DEFAULT 0, -- 平台总价（元）
  heat_imp_num INTEGER DEFAULT 0,          -- 加热曝光
  heat_read_num INTEGER DEFAULT 0,         -- 加热阅读
  is_underwater BOOLEAN DEFAULT FALSE,     -- 水下合作标记
  underwater_price NUMERIC(12,2) DEFAULT 0, -- 水下报价（元）
  components JSONB,                        -- 组件数据
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, note_id)
);

-- 聚光数据表
CREATE TABLE juguang_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  note_id VARCHAR(100),                    -- 关联笔记ID（可选）
  fee NUMERIC(12,2) DEFAULT 0,             -- 消耗（元）
  impression INTEGER DEFAULT 0,            -- 展现量
  click INTEGER DEFAULT 0,                 -- 点击量
  interaction INTEGER DEFAULT 0,           -- 互动量
  i_user_num INTEGER DEFAULT 0,            -- 新增种草人群
  ti_user_num INTEGER DEFAULT 0,           -- 新增深度种草人群
  i_user_price NUMERIC(12,4) DEFAULT 0,    -- 种草单价
  ti_user_price NUMERIC(12,4) DEFAULT 0,   -- 深度种草单价
  search_cmt_click INTEGER DEFAULT 0,      -- 搜索组件点击量
  search_cmt_after_read INTEGER DEFAULT 0, -- 搜索后阅读量
  search_cmt_after_read_avg NUMERIC(10,2) DEFAULT 0, -- 搜索后平均阅读量
  search_cmt_click_cvr NUMERIC(8,4) DEFAULT 0, -- 搜索点击转化率
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 业务标注表（底表上传）
CREATE TABLE business_annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  note_id VARCHAR(100) NOT NULL,
  content_direction VARCHAR(100),          -- 内容方向
  account_type VARCHAR(100),               -- 账号类型
  kol_type VARCHAR(100),                   -- KOL类型
  launch_phase VARCHAR(100),               -- 投放阶段
  is_underwater BOOLEAN DEFAULT FALSE,     -- 水下合作标记
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, note_id)
);

-- 灵犀数据表（底表上传）
CREATE TABLE lingxi_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  data_type VARCHAR(50) NOT NULL,          -- aips/brand_ranking/soc_sov/spu_ranking
  data_content JSONB NOT NULL,             -- 结构化数据内容
  period_start DATE,                       -- 数据周期开始
  period_end DATE,                         -- 数据周期结束
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 人工录入数据表
CREATE TABLE manual_inputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  input_type VARCHAR(50) NOT NULL,         -- benchmark/kpi_target/brand_search_index/topic_exposure
  data_content JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- KPI目标表
CREATE TABLE kpi_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  metric_name VARCHAR(50) NOT NULL,        -- impression/read/engagement/viral_count/cpm/cpc/cpe/ctr
  target_value NUMERIC(15,4) NOT NULL,
  is_cost_metric BOOLEAN DEFAULT FALSE,    -- 成本类指标标记
  UNIQUE(project_id, metric_name)
);

-- 计算结果缓存表
CREATE TABLE calculated_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  metric_type VARCHAR(100) NOT NULL,
  metric_value JSONB NOT NULL,
  calculated_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI生成内容表
CREATE TABLE ai_generated_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  content_type VARCHAR(50) NOT NULL,       -- plan_background/optimization_suggestions
  generated_content TEXT,                  -- AI生成的原始内容
  edited_content TEXT,                     -- 人工编辑后的内容
  is_edited BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 竞品数据表
CREATE TABLE competitor_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  competitor_name VARCHAR(200) NOT NULL,
  metrics JSONB NOT NULL,                  -- 竞品指标数据
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_notes_project_id ON notes(project_id);
CREATE INDEX idx_juguang_project_id ON juguang_data(project_id);
CREATE INDEX idx_annotations_project_id ON business_annotations(project_id);
CREATE INDEX idx_lingxi_project_id ON lingxi_data(project_id);
CREATE INDEX idx_manual_inputs_project_id ON manual_inputs(project_id);
CREATE INDEX idx_kpi_targets_project_id ON kpi_targets(project_id);
CREATE INDEX idx_calculated_metrics_project_id ON calculated_metrics(project_id);
```

### TypeScript 数据模型

```typescript
// 项目信息
interface Project {
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

// 蒲公英笔记数据（已转换为元）
interface PugongyingNote {
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
  kolPrice: number;              // 元（已从分转换）
  serviceFee: number;            // 元
  totalPlatformPrice: number;    // 元（已从分转换）
  heatImpNum: number;
  heatReadNum: number;
  isUnderwater: boolean;
  underwaterPrice: number;       // 元
  components?: ComponentData[];
}

// 聚光数据（已转换为元）
interface JuguangNote {
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

// 笔记指标（用于计算引擎）
interface NoteMetrics {
  noteId: string;
  likeNum: number;
  favNum: number;
  cmtNum: number;
  shareNum: number;
  followNum: number;
  impNum: number;
  readNum: number;
}

// 业务标注数据（底表上传）
interface BusinessAnnotation {
  noteId: string;
  contentDirection: string;      // 内容方向
  accountType: string;           // 账号类型
  kolType: string;               // KOL类型
  launchPhase: string;           // 投放阶段
  isUnderwater: boolean;         // 水下合作标记
}

// 灵犀数据（底表上传）
interface LingxiData {
  aips?: AIPSData;               // 人群资产数据
  brandRanking?: BrandRankingData;
  socSov?: SOCSOVData;
  spuRanking?: SPURankingData;
}

interface AIPSData {
  awareness: number;
  interest: number;
  purchase: number;
  share: number;
  penetrationRate: number;
  flowRates: Record<string, number>; // 各层级间转化率
}

// KOL层级枚举
type KOLTier = 'KOC' | '尾部' | '腰尾部' | '腰部' | '头部';

// 费用计算输入
interface CostCalculationInput {
  aboveWaterNotes: {
    kolPrice: number;            // 博主报价（元）
    serviceFee: number;          // 服务费（元）
    kolId: string;
  }[];
  underwaterPrices: number[];    // 水下报价列表（元）
  juguangFees: number[];         // 聚光消耗列表（元）
  cooperationPolicy: CooperationPolicy;
}

// 项目费用结果
interface ProjectCost {
  aboveWaterCost: number;
  underwaterCost: number;
  juguangCost: number;
  totalCost: number;
}

// 投流指标结果
interface PaidTrafficMetrics {
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

// KPI完成率结果
interface KPIResult {
  completionRate: number | null; // null表示未设定目标
  label: string;
}

// 自然曝光结果
interface NaturalExposureResult {
  value: number;                 // 最小为0
  isAnomalous: boolean;          // 计算结果为负时标记
}

// 大盘对比结果
interface BenchmarkResult {
  percentageDiff: number;
  isBetterThanBenchmark: boolean;
  label: '优于大盘' | '劣于大盘';
}

// 亮点
interface Highlight {
  type: 'kpi_exceeded' | 'above_benchmark' | 'post_better_than_pre' | 'outstanding_group';
  metric: string;
  description: string;
  value: number;
  comparison?: number;
}

// 报告模块顺序
type ReportModuleOrder = [
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
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Currency Conversion Correctness（货币转换正确性）

*For any* non-negative integer value representing an amount in 分 (fen), `normalizeAmount(x)` SHALL produce `x / 100` rounded to exactly 2 decimal places, and for any non-integer input, validation SHALL reject it.

**Validates: Requirements 2.3, 18.1**

### Property 2: Project Total Cost Calculation（项目总费用计算）

*For any* set of above-water notes (each with kolPrice, serviceFee, and kolId), a cooperation policy (with defaultDiscount and specialRules), a list of underwater prices, and a list of juguang fees, `calculateProjectTotalCost` SHALL produce a total equal to: `SUM((kolPrice + serviceFee) × applicableDiscount(kolId)) + SUM(underwaterPrices) + SUM(juguangFees)`, where `applicableDiscount` returns the special discount for a KOL if one exists, otherwise the default discount. Underwater prices SHALL never have discounts applied.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 1.3**

### Property 3: Cost Metrics Formula Correctness（成本指标公式正确性）

*For any* positive project total cost and positive metric totals (impressions, reads, engagement), the calculation engine SHALL produce: CPE = cost / engagement, CPM = cost / impressions × 1000, CPC = cost / reads, CTR = reads / impressions. *For any* juguang aggregated data with positive values: 投流CTR = click / impression, 投流CPC = fee / click, 投流CPM = fee / impression × 1000, 投流CPE = fee / interaction. When any denominator is zero, the result SHALL be 'N/A'.

**Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.6, 8.2, 18.2**

### Property 4: Configurable Engagement Calculation（可配置互动量计算）

*For any* note with metrics (likeNum, favNum, cmtNum, shareNum, followNum) and *any* engagement configuration (includeShare: boolean, includeFollow: boolean), `calculateEngagement` SHALL return the sum of: likeNum + favNum + cmtNum + (shareNum if includeShare) + (followNum if includeFollow). When the configuration changes, all derived metrics (CPE, total engagement, KPI completion rates) SHALL be recalculated using the new engagement values.

**Validates: Requirements 4.5, 17.1, 17.2, 17.3**

### Property 5: Viral Note Detection Independence（爆文判定独立性）

*For any* note with metrics and *any* engagement configuration, `isViralNote` SHALL return `true` if and only if `likeNum + favNum + cmtNum >= 1000`. The result SHALL be identical regardless of the engagement configuration. The viral rate for any set of notes SHALL equal `count(viral notes) / count(all notes)`.

**Validates: Requirements 5.1, 5.2, 5.3, 5.4, 17.4**

### Property 6: KPI Completion Rate with Cost Reversal（KPI完成率含成本反向计算）

*For any* actual metric value and positive KPI target value, `calculateKPICompletion` SHALL return `actual / target` for non-cost metrics (曝光量, 阅读量, 互动量, 爆文数, CTR) and `target / actual` for cost metrics (CPM, CPC, CPE). When target is zero or unset, the result SHALL be null with label "未设定目标".

**Validates: Requirements 6.1, 6.3, 6.4**

### Property 7: KOL Tier Classification（达人层级分类）

*For any* non-negative fan count, `classifyKOLTier` SHALL return: 'KOC' if fanCount < 10000, '尾部' if 10000 ≤ fanCount < 50000, '腰尾部' if 50000 ≤ fanCount < 100000, '腰部' if 100000 ≤ fanCount < 500000, '头部' if fanCount ≥ 500000. Tier aggregation SHALL correctly group notes and compute per-tier metrics (note count, total impressions, reads, engagement, average CPE, viral count, viral rate).

**Validates: Requirements 7.1, 7.2**

### Property 8: Natural Exposure with Boundary Handling（自然曝光边界处理）

*For any* pugongying total impressions and juguang total impressions, `calculateNaturalExposure` SHALL return `max(0, pugongyingImpressions - juguangImpressions)` as the value, and SHALL set `isAnomalous = true` when the raw difference is negative.

**Validates: Requirements 8.1, 18.4**

### Property 9: Content Analysis Aggregation（内容分析聚合）

*For any* set of notes with type annotations (图文/视频) and business annotations (content direction, account type, KOL type, launch phase), grouping by any dimension and computing aggregates (total impressions, reads, engagement, CPE, viral rate) SHALL produce values equal to the sum/average of the individual notes in each group, and groups SHALL be sorted by the specified metric in descending order.

**Validates: Requirements 9.1, 9.2, 9.3**

### Property 10: Benchmark Comparison and Labeling（大盘对比与标记）

*For any* actual metric value and benchmark value, the percentage difference SHALL equal `(actual - benchmark) / benchmark × 100` for non-cost metrics and `(benchmark - actual) / benchmark × 100` for cost metrics. A metric SHALL be labeled "优于大盘" when the percentage difference is positive.

**Validates: Requirements 13.3, 13.4**

### Property 11: Highlight Identification Completeness（亮点识别完整性）

*For any* set of project metrics, KPI targets, and benchmark data, `identifyHighlights` SHALL include a highlight for every metric where: KPI completion rate > 100%, OR actual value is better than benchmark, OR post-campaign value exceeds pre-campaign value. No metric meeting these criteria SHALL be omitted, and no metric failing all criteria SHALL be included.

**Validates: Requirements 14.1**

### Property 12: Report Module Ordering（报告模块顺序）

*For any* valid project data, the assembled report SHALL contain modules in exactly this order: 客户信息 → 项目回顾 → 数据总览 → 项目亮点 → 内容分析 → 品牌声量分析 → 人群资产分析 → 投流分析 → 小程序/转化分析 → 竞品/行业对标 → 亮点总结 → 优化建议.

**Validates: Requirements 16.1**

### Property 13: Missing Data Placeholder（缺失数据占位符）

*For any* report field where the underlying data is null, undefined, or not yet collected, the report generator SHALL display "数据待补充" in that position rather than empty string, zero, or null.

**Validates: Requirements 16.3**

### Property 14: Required Field Validation（必填字段验证）

*For any* project creation input, validation SHALL reject the input if and only if any of the required fields (品类, 合作品牌, 项目名称, 项目周期) is missing or empty. All other fields are optional and their absence SHALL not cause rejection.

**Validates: Requirements 1.2**

### Property 15: Spreadsheet Data Upload Round-Trip（底表数据上传往返）

*For any* valid structured Lingxi data or business annotation data, uploading via spreadsheet parser and then reading back from PostgreSQL SHALL produce data equivalent to the original input (field values preserved, no data loss).

**Validates: Requirements 2.5, 2.6**

### Property 16: Component Conversion Rate Calculation（组件转化率计算）

*For any* set of component data with click and impression values, the calculation engine SHALL produce click_rate = clicks / impressions and conversion_rate = conversions / clicks for each component type. When any denominator is zero, the result SHALL be 'N/A'.

**Validates: Requirements 12.1, 12.2, 12.3, 12.4**

## Error Handling

### 数据采集层错误处理

| 错误场景 | 处理策略 | 用户反馈 |
|---------|---------|---------|
| 派查查API调用失败 | 记录错误日志，标记失败数据源，重试（最多3次，指数退避） | 通知用户具体失败的数据源和字段 |
| API返回数据格式异常 | 验证数据结构，拒绝不合规数据 | 提示数据格式错误，建议重试 |
| 金额字段非整数 | 拒绝该条数据 | 标记异常数据，提示人工核查 |
| 底表格式错误 | 解析失败时返回详细错误位置 | 提示具体行列的格式问题 |
| 底表字段缺失 | 标记缺失字段，允许部分导入 | 列出缺失字段，提示补充 |
| 网络超时 | 重试机制（最多3次，指数退避） | 超时后通知用户 |
| 数据库连接失败 | 连接池重试，记录错误 | 提示系统暂时不可用 |

### 计算引擎层错误处理

| 错误场景 | 处理策略 | 输出值 |
|---------|---------|--------|
| 分母为零（CPE/CPM/CPC/CTR等） | 返回特殊标记 | 'N/A' |
| KPI目标值为零或未设置 | 返回null完成率 | label: "未设定目标" |
| 自然曝光计算为负数 | 设为0，标记异常 | value: 0, isAnomalous: true |
| 互动量所有组件为0 | 正常返回0 | 0（合法值） |
| 笔记列表为空 | 返回空结果集 | 各聚合指标为0或空数组 |

### 报告生成层错误处理

| 错误场景 | 处理策略 | 输出 |
|---------|---------|------|
| 数据未采集 | 占位符替代 | "数据待补充" |
| LLM调用失败 | 重试1次，仍失败则降级为模板文案 | 使用预设模板并标记"AI生成失败，使用模板" |
| LLM响应超时 | 30秒超时，降级处理 | 使用预设模板 |
| 导出格式错误 | 捕获异常，提示用户 | 错误提示 |
| 数据库查询失败 | 记录错误，返回部分报告 | 标记失败模块为"数据加载失败" |

## Testing Strategy

### 测试框架选择

- **单元测试**: Vitest
- **属性测试**: fast-check（TypeScript生态最成熟的PBT库）
- **集成测试**: Vitest（直接操作真实PostgreSQL数据库）
- **无Mock原则**: 核心功能测试使用真实数据库和真实LLM，不使用MSW或mock

### 测试数据库策略

- 测试使用同一Supabase PostgreSQL实例
- 每个测试用例在事务中执行，测试结束后回滚（保证隔离性）
- 或使用独立的test schema，测试前后清理数据
- 属性测试（纯计算函数）不需要数据库连接

### 属性测试（Property-Based Testing）

每个Correctness Property对应一个属性测试，使用fast-check实现：

- 最少100次迭代
- 每个测试标注对应的Property编号
- 标签格式: `Feature: marketing-review-system, Property {N}: {title}`

**属性测试覆盖（纯函数，无需外部依赖）：**
1. 货币转换正确性（Property 1）- 生成随机整数验证转换精度
2. 项目总费用计算（Property 2）- 生成随机费用结构验证公式
3. 成本指标公式（Property 3）- 生成随机正数验证CPE/CPM/CPC/CTR及投流指标
4. 可配置互动量（Property 4）- 生成随机指标和配置验证求和
5. 爆文判定独立性（Property 5）- 生成随机笔记验证阈值和配置无关性
6. KPI完成率（Property 6）- 生成随机实际值和目标值验证正向/反向计算
7. 达人层级分类（Property 7）- 生成随机粉丝数验证分类边界
8. 自然曝光边界（Property 8）- 生成随机曝光值验证max(0, diff)
9. 内容分析聚合（Property 9）- 生成随机笔记集验证分组聚合
10. 大盘对比（Property 10）- 生成随机指标和基准验证差异计算
11. 亮点识别（Property 11）- 生成随机指标验证识别规则
12. 报告模块顺序（Property 12）- 生成随机数据验证模块顺序
13. 缺失数据占位（Property 13）- 生成含null字段的数据验证占位符
14. 必填字段验证（Property 14）- 生成随机输入验证必填校验
15. 底表数据往返（Property 15）- 生成随机结构化数据验证解析+存储往返
16. 组件转化率（Property 16）- 生成随机组件数据验证转化率计算

### 单元测试（具体示例和边界条件）

- 金额转换边界：0分、1分、99分、100分、最大安全整数
- 爆文判定边界：999（非爆文）、1000（爆文）
- 达人层级边界：9999/10000、49999/50000、99999/100000、499999/500000
- 除零场景：所有计算函数的分母为0情况
- 空数据场景：空笔记列表、空聚光数据

### 集成测试（真实基础设施）

- **数据库集成**: 项目CRUD → PostgreSQL读写验证
- **派查查API集成**: 真实API调用 → 数据入库 → 验证存储正确性
- **底表上传集成**: Excel/CSV文件解析 → 数据入库 → 验证数据完整性
- **LLM集成**: 真实gpt-5.1调用 → 策划案解析 → 验证输出结构
- **LLM集成**: 真实gpt-5.1调用 → 优化建议生成 → 验证输出可用性
- **端到端流程**: 数据采集 → 计算 → 报告生成 → 验证完整报告结构
- **费用计算端到端**: 从数据库读取笔记数据 → 计算总费用 → 验证结果

### .env 配置文件

```env
# PostgreSQL (Supabase)
DATABASE_URL=postgresql://postgres:v7%40Hypj5v6bM7F4x@db.bzlkyanfzrmhiemhssas.supabase.co:5432/postgres

# LLM (gpt-5.1 via custom gateway)
LLM_BASE_URL=https://aiop-gateway.item.com/proxy/openai/v1
LLM_API_KEY=<your-api-key>
LLM_MODEL=gpt-5.1

# 派查查API
PAICHACHA_API_KEY=<your-paichacha-key>
PAICHACHA_BASE_URL=<paichacha-api-base-url>
```
