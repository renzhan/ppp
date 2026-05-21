# Design Document

## Overview

本设计文档描述前端Web应用及三大智能引擎的技术架构。系统在已有后端基础设施（Prisma ORM + PostgreSQL、计算引擎纯函数、数据采集层、报告组装器、LLM客户端）之上，构建：

1. **Next.js前端应用**（`web/`目录）：完整的项目管理、数据上传、报告生成、审校编辑界面
2. **数据评级引擎**（`src/engines/rating.ts`）：对所有指标进行S/A/B/C/D五级评级
3. **模块决策引擎**（`src/engines/decision.ts`）：决定8个报告模块的显示/隐藏/降级状态
4. **叙事策略引擎**（`src/engines/narrative.ts`）：AI驱动的叙事文案生成，基于YAML Prompt模板

**核心设计原则：**
- 引擎层为纯函数（rating + decision），叙事引擎为带LLM副作用的薄层
- 前端通过Next.js API Route Handlers调用后端服务，不直接暴露数据库
- YAML Prompt模板按项目类型×模块×语气强度组织，支持热更新
- 审校台采用三栏布局，支持实时编辑和AI问答
- 使用Recharts进行图表渲染，docx包进行Word导出

**技术选型：**
- Next.js 14+ (App Router) + TypeScript
- Tailwind CSS + shadcn/ui 组件库
- React Query (TanStack Query) 管理服务端状态
- Recharts 图表渲染
- `docx` 包生成Word文件，`@react-pdf/renderer` 生成PDF
- Vitest + fast-check 用于引擎层属性测试
- Playwright 用于E2E测试

## Architecture

```mermaid
graph TB
    subgraph Frontend["前端层 (web/)"]
        Pages[Next.js Pages<br/>App Router]
        Components[React Components<br/>shadcn/ui + Tailwind]
        Charts[Recharts<br/>数据可视化]
        State[React Query<br/>状态管理]
    end

    subgraph APILayer["API层 (web/app/api/)"]
        ProjectAPI[/api/projects/*]
        UploadAPI[/api/upload/*]
        GenerateAPI[/api/generate/*]
        ReviewAPI[/api/review/*]
        ExportAPI[/api/export/*]
        ChatAPI[/api/chat/*]
    end

    subgraph Engines["智能引擎层 (src/engines/)"]
        RatingEngine[Rating Engine<br/>S/A/B/C/D评级]
        DecisionEngine[Decision Engine<br/>模块显示/隐藏/降级]
        NarrativeEngine[Narrative Engine<br/>AI叙事文案生成]
    end

    subgraph Prompts["Prompt模板 (prompts/)"]
        YAMLPrompts[YAML Prompt Files<br/>按项目类型×模块×语气]
    end

    subgraph ExistingBackend["已有后端 (src/)"]
        Calculation[Calculation Engine<br/>纯函数计算]
        Ingestion[Data Ingestion<br/>API + 底表解析]
        Report[Report Generator<br/>组装 + LLM + 导出]
        SharedDB[Prisma + PostgreSQL]
    end

    Pages --> State
    State --> APILayer
    Components --> Charts

    APILayer --> Engines
    APILayer --> ExistingBackend

    RatingEngine --> Calculation
    DecisionEngine --> RatingEngine
    NarrativeEngine --> YAMLPrompts
    NarrativeEngine --> Report

    Engines --> SharedDB
    ExistingBackend --> SharedDB
```

**架构决策说明：**

1. **Monorepo结构**：Next.js应用放在`web/`子目录，通过tsconfig path aliases引用根目录的`src/`代码。共享同一个`node_modules`和Prisma客户端。

2. **引擎层独立于前端**：三大引擎放在`src/engines/`，可被API路由调用，也可被CLI或测试直接调用。Rating和Decision引擎为纯函数，Narrative引擎依赖LLM客户端。

3. **API路由作为薄层**：Next.js Route Handlers仅做请求验证、调用引擎/后端服务、返回响应。不包含业务逻辑。

4. **YAML Prompt外置**：Prompt模板存储在`prompts/`目录，运行时加载。支持热更新无需重启。

5. **图表选型Recharts**：相比ECharts，Recharts是React原生组件，SSR支持更好，bundle更小，与Next.js集成更自然。

## Components and Interfaces

### 1. Rating Engine（数据评级引擎）

```typescript
// src/engines/rating.ts

/** 评级等级 */
export type Rating = 'S' | 'A' | 'B' | 'C' | 'D';

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

/** 评级引擎接口 */
export interface IRatingEngine {
  /** 对单个指标进行三维度评级 */
  rateMetric(input: RatingInput): MetricRating;

  /** 对项目所有指标批量评级 */
  rateAllMetrics(inputs: RatingInput[]): MetricRating[];

  /** 根据比率计算评级等级 */
  ratioToRating(ratio: number): Rating;
}

/**
 * 评级阈值（纯函数）：
 * - ratio >= 1.5 → S
 * - ratio >= 1.2 → A
 * - ratio >= 1.0 → B
 * - ratio >= 0.8 → C
 * - ratio < 0.8  → D
 *
 * 成本类指标反向：ratio = target/actual 或 benchmark/actual
 * 非成本类指标正向：ratio = actual/target 或 actual/benchmark
 */
```

### 2. Decision Engine（模块决策引擎）

```typescript
// src/engines/decision.ts

/** 项目类型 */
export type ProjectType = '新品上市' | '日常种草' | '节点营销' | '竞品防御';

/** 模块显示状态 */
export type ModuleStatus = 'show' | 'hide' | 'degraded';

/** 模块ID（8个报告模块） */
export type ModuleId = 'M1' | 'M2' | 'M3' | 'M4' | 'M5' | 'M6' | 'M7' | 'M8';

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

/** 决策引擎接口 */
export interface IDecisionEngine {
  /** 生成所有模块的显示决策 */
  decideModules(input: DecisionInput): ModuleDecision[];

  /** 生成平台数据展示决策 */
  decidePlatforms(input: DecisionInput): PlatformDecision[];
}
```

### 3. Narrative Engine（叙事策略引擎）

```typescript
// src/engines/narrative.ts

/** 语气强度 */
export type ToneIntensity = 'positive' | 'standard' | 'conservative';

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

/** 叙事引擎接口 */
export interface INarrativeEngine {
  /** 生成模块叙事文案 */
  generateNarrative(request: NarrativeRequest): Promise<NarrativeResult>;

  /** 重新生成单个段落（切换语气） */
  regenerateParagraph(
    paragraphId: string,
    newTone: ToneIntensity,
    context: NarrativeRequest
  ): Promise<NarrativeParagraph>;

  /** 应用"问题转机会"转换 */
  transformProblemToOpportunity(
    paragraph: NarrativeParagraph,
    context: NarrativeRequest
  ): Promise<NarrativeParagraph>;

  /** 加载YAML Prompt模板 */
  loadTemplate(
    projectType: ProjectType,
    moduleId: ModuleId,
    tone: ToneIntensity
  ): PromptTemplate;

  /** AI问答（归因分析、数据查询、优化建议） */
  chat(
    messages: { role: 'user' | 'assistant'; content: string }[],
    context: { projectId: string; moduleId?: ModuleId }
  ): Promise<string>;
}
```

### 4. API Route Handlers

```typescript
// web/app/api/ 路由规范

/** 项目管理 */
// GET  /api/projects          - 项目列表（分页、筛选、搜索）
// POST /api/projects          - 创建项目
// GET  /api/projects/[id]     - 项目详情
// PUT  /api/projects/[id]     - 更新项目

/** 数据上传 */
// POST /api/upload/execution   - 上传执行底表
// POST /api/upload/ad-spend    - 上传广告投放底表
// POST /api/upload/external    - 上传外部平台数据
// POST /api/upload/manual      - 人工录入数据

/** 报告生成 */
// POST /api/generate/[projectId]         - 触发报告生成
// GET  /api/generate/[projectId]/status  - 生成进度查询
// GET  /api/generate/[projectId]/config  - 获取生成配置（模块开关）

/** 审校台 */
// GET  /api/review/[versionId]           - 获取报告版本内容
// PUT  /api/review/[versionId]/module/[moduleId] - 更新模块内容
// POST /api/review/[versionId]/regenerate/[moduleId] - 重新生成模块
// PUT  /api/review/[versionId]/tone      - 切换语气强度
// PUT  /api/review/[versionId]/columns   - 更新数据列显示

/** AI问答 */
// POST /api/chat/[projectId]   - AI对话（归因分析、数据查询、优化建议）

/** 导出 */
// POST /api/export/[versionId] - 导出报告（Word/PDF）

/** 版本管理 */
// GET  /api/versions/[projectId]         - 版本列表
// POST /api/versions/[projectId]/copy/[versionId] - 基于版本创建副本
// GET  /api/versions/diff/[v1]/[v2]      - 版本差异对比
```

### 5. Frontend Page Components

```typescript
// web/app/ 页面结构

/** 项目列表页 */
// web/app/page.tsx
// - ProjectListPage
//   - FilterBar (品牌/品类/类型/状态筛选)
//   - SearchInput (模糊搜索)
//   - ProjectTable (分页表格)
//   - Pagination

/** 项目创建向导 */
// web/app/projects/new/page.tsx
// - ProjectWizard
//   - Step1BasicInfo (基本信息表单)
//   - Step2PlanUpload (策划案上传)
//   - Step3Confirm (确认摘要)
//   - WizardNavigation (步骤导航)

/** 项目详情页 */
// web/app/projects/[id]/page.tsx
// - ProjectDetailPage
//   - ProjectHeader (项目基本信息)
//   - ProgressTracker (数据上传/报告生成进度)
//   - ActionCards (快捷操作入口)

/** 数据上传页 */
// web/app/projects/[id]/upload/page.tsx
// - DataUploadPage
//   - UploadTabs (4种上传入口切换)
//   - ExecutionUpload (执行底表)
//   - AdSpendUpload (广告投放底表)
//   - ExternalDataUpload (外部平台数据)
//   - ManualInputForm (人工录入)
//   - UploadResultSummary (上传结果摘要)

/** 报告生成配置页 */
// web/app/projects/[id]/generate/page.tsx
// - GenerateConfigPage
//   - ModuleToggleList (8个模块开关)
//   - ToneSelector (全局语气选择)
//   - GenerateButton (生成按钮)
//   - ProgressIndicator (生成进度)

/** 审校台 */
// web/app/projects/[id]/review/[versionId]/page.tsx
// - ReviewPlatform
//   - LeftPanel
//     - ModuleNavigationTree (模块导航树)
//     - ModuleStatusIndicator (状态指示器)
//   - CenterPanel
//     - ContentPreview (富文本预览)
//     - InlineChart (内嵌图表)
//     - EditableSection (可编辑区域)
//     - ToneToggle (段落级语气切换)
//   - RightPanel
//     - AIChatPanel (AI问答面板)
//     - ChatHistory (对话历史)
//     - InsertButton (一键插入)
//   - Toolbar
//     - ToneIntensitySelector (全局语气)
//     - ExportButton (导出按钮)
//     - VersionInfo (版本信息)
//     - ColumnManager (数据列管理)

/** 版本管理页 */
// web/app/projects/[id]/versions/page.tsx
// - VersionManagementPage
//   - VersionList (版本列表)
//   - VersionDiff (版本对比)
//   - CopyVersionButton (复制版本)
```

### 6. YAML Prompt Schema

```yaml
# prompts/{project_type}/{module_id}/{tone}.yaml
# 示例: prompts/新品上市/M3_highlights/positive.yaml

name: "新品上市-项目亮点-积极版"
version: "1.0.0"
projectType: "新品上市"
moduleId: "M3"
toneIntensity: "positive"

variables:
  - metric_name        # 指标名称
  - metric_value       # 指标实际值
  - kpi_target         # KPI目标值
  - completion_rate    # 完成率
  - benchmark_diff     # 与大盘差异
  - attribution        # 归因策略

prompt: |
  你是一位资深的小红书营销复盘专家。请基于以下数据为"新品上市"类型项目生成项目亮点模块的叙事文案。

  ## 数据上下文
  - 指标: {{metric_name}}
  - 实际值: {{metric_value}}
  - KPI目标: {{kpi_target}}
  - 完成率: {{completion_rate}}
  - 与大盘对比: {{benchmark_diff}}

  ## 归因策略
  请使用"市场突破"归因角度，强调品牌在新品上市阶段的突破性表现。

  ## 语气要求
  使用积极、自信的语气，突出成就和突破。

  ## 输出格式
  请输出1-2段专业的复盘文案，每段50-100字。

fallbackText: "该指标表现优异，超额完成预设目标，体现了本次新品上市营销策略的有效性。"

changelog:
  - "1.0.0: 初始版本"
```

```
prompts/
├── 新品上市/
│   ├── M1_overview/
│   │   ├── positive.yaml
│   │   ├── standard.yaml
│   │   └── conservative.yaml
│   ├── M2_review/
│   ├── M3_highlights/
│   ├── M4_underperform/
│   ├── M5_content/
│   ├── M6_competitor/
│   ├── M7_traffic/
│   └── M8_diagnosis/
├── 日常种草/
│   └── ... (同结构)
├── 节点营销/
│   └── ... (同结构)
└── 竞品防御/
    └── ... (同结构)
```

## Data Models

### 新增Prisma Schema（数据库扩展）

```prisma
// 在现有schema.prisma基础上新增

// 项目类型字段（扩展现有projects表）
// ALTER TABLE projects ADD COLUMN project_type VARCHAR(50) DEFAULT '日常种草';

model Project {
  // ... 现有字段 ...
  projectType       String   @default("日常种草") @map("project_type") @db.VarChar(50)

  // 新增关联
  reportVersions    ReportVersion[]
  moduleDecisions   ModuleDecision[]
  metricRatings     MetricRatingRecord[]
  reviewEdits       ReviewEdit[]
}

// 报告版本表
model ReportVersion {
  id              String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  projectId       String   @map("project_id") @db.Uuid
  versionNumber   Int      @map("version_number")
  generatedAt     DateTime @default(now()) @map("generated_at") @db.Timestamptz()
  config          Json     @default("{}") // 生成配置（模块开关、语气等）
  content         Json     @default("{}") // 完整报告内容快照
  status          String   @default("draft") @db.VarChar(20) // draft | reviewing | finalized
  createdBy       String?  @map("created_by") @db.VarChar(100)

  // Relations
  project         Project  @relation(fields: [projectId], references: [id])
  moduleDecisions ModuleDecision[]
  reviewEdits     ReviewEdit[]

  @@unique([projectId, versionNumber])
  @@index([projectId])
  @@map("report_versions")
}

// 模块决策表
model ModuleDecision {
  id              String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  projectId       String   @map("project_id") @db.Uuid
  versionId       String   @map("version_id") @db.Uuid
  moduleId        String   @map("module_id") @db.VarChar(10) // M1-M8
  moduleName      String   @map("module_name") @db.VarChar(100)
  status          String   @db.VarChar(20) // show | hide | degraded
  reason          String?  @db.Text
  degradedFields  Json?    @map("degraded_fields") // 降级时缺失的字段列表
  isOverridden    Boolean  @default(false) @map("is_overridden") // 用户是否手动覆盖
  overriddenAt    DateTime? @map("overridden_at") @db.Timestamptz()

  // Relations
  project         Project       @relation(fields: [projectId], references: [id])
  version         ReportVersion @relation(fields: [versionId], references: [id])

  @@unique([versionId, moduleId])
  @@index([projectId])
  @@index([versionId])
  @@map("module_decisions")
}

// 指标评级表
model MetricRatingRecord {
  id              String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  projectId       String   @map("project_id") @db.Uuid
  metricName      String   @map("metric_name") @db.VarChar(50)
  isCostMetric    Boolean  @default(false) @map("is_cost_metric")
  vsKpiRatio      Decimal? @map("vs_kpi_ratio") @db.Decimal(10, 4)
  vsKpiRating     String?  @map("vs_kpi_rating") @db.VarChar(5) // S/A/B/C/D or null
  vsBenchmarkRatio Decimal? @map("vs_benchmark_ratio") @db.Decimal(10, 4)
  vsBenchmarkRating String? @map("vs_benchmark_rating") @db.VarChar(5)
  vsPreRatio      Decimal? @map("vs_pre_ratio") @db.Decimal(10, 4)
  vsPreRating     String?  @map("vs_pre_rating") @db.VarChar(5)
  finalRating     String   @map("final_rating") @db.VarChar(5) // 综合评级
  calculatedAt    DateTime @default(now()) @map("calculated_at") @db.Timestamptz()

  // Relations
  project         Project  @relation(fields: [projectId], references: [id])

  @@unique([projectId, metricName])
  @@index([projectId])
  @@map("metric_ratings")
}

// 审校编辑记录表
model ReviewEdit {
  id              String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  projectId       String   @map("project_id") @db.Uuid
  versionId       String   @map("version_id") @db.Uuid
  moduleId        String   @map("module_id") @db.VarChar(10)
  editType        String   @map("edit_type") @db.VarChar(50) // tone_change | manual_edit | regenerate | column_hide | transform
  previousContent Json?    @map("previous_content")
  newContent      Json?    @map("new_content")
  editedAt        DateTime @default(now()) @map("edited_at") @db.Timestamptz()
  editedBy        String?  @map("edited_by") @db.VarChar(100)

  // Relations
  project         Project       @relation(fields: [projectId], references: [id])
  version         ReportVersion @relation(fields: [versionId], references: [id])

  @@index([versionId])
  @@index([projectId])
  @@map("review_edits")
}
```

### TypeScript 新增类型

```typescript
// src/engines/types.ts - 引擎层共享类型

export type Rating = 'S' | 'A' | 'B' | 'C' | 'D';
export type ProjectType = '新品上市' | '日常种草' | '节点营销' | '竞品防御';
export type ToneIntensity = 'positive' | 'standard' | 'conservative';
export type ModuleStatus = 'show' | 'hide' | 'degraded';
export type ModuleId = 'M1' | 'M2' | 'M3' | 'M4' | 'M5' | 'M6' | 'M7' | 'M8';

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

export const RATING_THRESHOLDS = {
  S: 1.5,   // >= 150%
  A: 1.2,   // >= 120%
  B: 1.0,   // >= 100%
  C: 0.8,   // >= 80%
  // D: < 80%
} as const;
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Ratio-to-Rating Threshold Mapping

*For any* ratio value (positive number), `ratioToRating(ratio)` SHALL return:
- 'S' if ratio >= 1.5
- 'A' if 1.2 <= ratio < 1.5
- 'B' if 1.0 <= ratio < 1.2
- 'C' if 0.8 <= ratio < 1.0
- 'D' if ratio < 0.8

This mapping SHALL be identical regardless of which dimension (vs KPI, vs benchmark, vs pre-campaign) the ratio originates from.

**Validates: Requirements 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9**

### Property 2: Cost Metric Ratio Inversion

*For any* cost metric (CPE, CPM, CPC) with actual value > 0 and a comparison value > 0:
- vs KPI: ratio = kpiTarget / actualValue
- vs benchmark: ratio = benchmarkValue / actualValue
- vs pre-campaign: ratio = preCampaignValue / actualValue

*For any* non-cost metric with actual value > 0 and a comparison value > 0:
- vs KPI: ratio = actualValue / kpiTarget
- vs benchmark: ratio = actualValue / benchmarkValue
- vs pre-campaign: ratio = actualValue / preCampaignValue

The rating engine SHALL correctly apply the inverted formula for cost metrics and the standard formula for non-cost metrics.

**Validates: Requirements 4.12, 18.1, 18.2, 18.3, 18.4**

### Property 3: Final Rating is Best of Available Dimensions

*For any* metric with 1 to 3 dimension ratings (some may be null due to missing data), the final rating SHALL equal the highest (best) rating among the non-null dimensions, where S > A > B > C > D.

**Validates: Requirements 4.11**

### Property 4: Missing Dimension Yields Null Rating

*For any* rating input where a comparison value (kpiTarget, benchmarkValue, or preCampaignValue) is undefined/null, the corresponding dimension rating SHALL be null. The final rating SHALL only consider non-null dimensions.

**Validates: Requirements 4.10**

### Property 5: M1 Data Overview Always Shown

*For any* valid DecisionInput (regardless of project type, metric ratings, costs, or data completeness), the Decision Engine SHALL always output M1 with status 'show'.

**Validates: Requirements 5.2**

### Property 6: Module Visibility Decision Rules

*For any* set of metric ratings and cost values:
- M3 (项目亮点) status SHALL be 'show' if and only if count of metrics with rating S or A >= 2
- M6 (竞品洞察) status SHALL be 'show' if and only if at least one competitor metric has rating S or A
- M7 (投流分析) status SHALL be 'show' if and only if juguangCost / totalCost > 0.2

**Validates: Requirements 5.3, 5.4, 5.5, 5.6, 5.7, 5.8**

### Property 7: Module Degradation on Partial Data

*For any* module where the required data fields are partially available (some present, some missing), the Decision Engine SHALL set that module's status to 'degraded' and list the missing fields in `degradedFields`. A module with all required data SHALL NOT be degraded. A module with no required data available SHALL be 'hide'.

**Validates: Requirements 5.10**

### Property 8: Platform Data Show/Hide Rules

*For any* combination of platform-specific ratings:
- Pugongying: show if and only if viralRate rating ∈ {S, A} AND cpe rating ∈ {S, A, B}
- Juguang: show if and only if searchRate rating ∈ {S, A} AND ctr rating ∈ {S, A, B} AND cpeBenchmark is true (better than industry)
- Qiangua: show if and only if brandRank <= 10
- Lingxi: show if and only if searchGrowth rating ∈ {S, A} AND audienceGrowth rating ∈ {S, A, B} AND cptiBenchmark is true

**Validates: Requirements 11.1, 11.2, 11.3, 11.4**

### Property 9: Rating-to-Tone Mapping

*For any* metric rating, the Narrative Engine's tone selection SHALL follow:
- Rating S or A → ToneIntensity 'positive'
- Rating B → ToneIntensity 'standard'
- Rating C or D → ToneIntensity 'conservative'

Additionally, for C/D ratings, the `isTransformed` flag SHALL be set to true (problem-to-opportunity transformation applied).

**Validates: Requirements 6.3, 6.4, 6.5, 6.9**

### Property 10: Project Type to Attribution Strategy Mapping

*For any* project type, the Narrative Engine SHALL select the corresponding attribution strategy set:
- '新品上市' → strategy contains '市场突破' and '用户认知建立'
- '日常种草' → strategy contains '持续渗透' and '口碑积累'
- '节点营销' → strategy contains '节点爆发' and '流量转化'
- '竞品防御' → strategy contains '份额保卫' and '差异化优势'

**Validates: Requirements 12.1, 12.2, 12.3, 12.4**

### Property 11: YAML Template Lookup Correctness

*For any* valid combination of (projectType, moduleId, toneIntensity), the template loader SHALL return a PromptTemplate where:
- template.projectType === projectType
- template.moduleId === moduleId
- template.toneIntensity === toneIntensity
- template.prompt is a non-empty string
- template.variables is a non-empty array
- template.fallbackText is a non-empty string

*For any* invalid combination (non-existent file), the loader SHALL throw a descriptive error.

**Validates: Requirements 17.2, 17.3**

### Property 12: Project List Filtering Correctness

*For any* list of projects and any filter criteria (brand, category, projectType, status), the filtered result SHALL contain only projects where every specified filter field matches. Projects not matching any active filter SHALL be excluded.

**Validates: Requirements 1.2**

### Property 13: Pagination Slice Correctness

*For any* list of N items and page parameters (page number P, page size S = 20), the returned page SHALL contain items at indices [(P-1)*S, min(P*S, N)), and the total page count SHALL equal ceil(N / S).

**Validates: Requirements 1.5**

## Error Handling

### 引擎层错误处理

| 错误场景 | 处理策略 | 输出 |
|---------|---------|------|
| Rating Engine: 实际值为0（成本类指标） | 返回所有维度为null | finalRating基于可用维度 |
| Rating Engine: 所有维度数据缺失 | 返回finalRating为'C'（默认中性） | 标记为"数据不足" |
| Decision Engine: 评级数据为空 | M1始终显示，其余默认隐藏 | 返回保守决策 |
| Decision Engine: totalCost为0 | M7隐藏（无法计算占比） | reason说明原因 |
| Narrative Engine: YAML模板文件不存在 | 使用通用模板降级 | 日志警告 |
| Narrative Engine: YAML解析失败 | 使用fallbackText | 日志错误 |
| Narrative Engine: LLM调用失败 | 使用YAML中的fallbackText | 标记为"模板文案" |
| Narrative Engine: LLM超时（30s） | 降级使用fallbackText | 标记为"模板文案" |
| Narrative Engine: LLM返回格式异常 | 尝试提取有效内容，失败则降级 | 日志警告 |

### API层错误处理

| 错误场景 | HTTP状态码 | 响应格式 |
|---------|-----------|---------|
| 请求参数验证失败 | 400 | `{ error: string, fields: Record<string, string> }` |
| 项目不存在 | 404 | `{ error: "Project not found" }` |
| 文件格式不支持 | 415 | `{ error: string, supportedFormats: string[] }` |
| 文件解析失败 | 422 | `{ error: string, details: { row: number, column: string, reason: string }[] }` |
| 报告生成中（重复请求） | 409 | `{ error: "Generation in progress", status: string }` |
| LLM服务不可用 | 503 | `{ error: string, fallbackUsed: true }` |
| 数据库连接失败 | 500 | `{ error: "Internal server error" }` |
| 导出生成失败 | 500 | `{ error: string, retryable: true }` |

### 前端错误处理

| 错误场景 | 处理策略 |
|---------|---------|
| API请求失败 | React Query自动重试（3次），显示错误Toast |
| 页面加载失败 | Next.js Error Boundary显示友好错误页 |
| 文件上传超时 | 显示进度条，超时后提示重试 |
| WebSocket断开（AI问答） | 自动重连，显示连接状态 |
| 图表渲染失败 | 显示"图表加载失败"占位符 |
| 乐观更新失败 | 自动回滚UI状态，显示错误提示 |

## Testing Strategy

### 测试框架

- **引擎层单元测试 + 属性测试**: Vitest + fast-check
- **前端组件测试**: Vitest + React Testing Library
- **E2E测试**: Playwright
- **API路由测试**: Vitest（直接调用Route Handler函数）

### 属性测试（Property-Based Testing）

使用 `fast-check` 库，每个Property对应一个属性测试，最少100次迭代。

**标签格式**: `Feature: frontend-and-engines, Property {N}: {title}`

| Property | 测试文件 | 测试内容 |
|----------|---------|---------|
| 1 | `tests/engines/rating.property.test.ts` | 生成随机ratio，验证阈值映射 |
| 2 | `tests/engines/rating.property.test.ts` | 生成随机成本/非成本指标，验证ratio方向 |
| 3 | `tests/engines/rating.property.test.ts` | 生成随机维度评级组合，验证final=max |
| 4 | `tests/engines/rating.property.test.ts` | 生成随机缺失维度，验证null处理 |
| 5 | `tests/engines/decision.property.test.ts` | 生成随机输入，验证M1始终show |
| 6 | `tests/engines/decision.property.test.ts` | 生成随机评级集，验证M3/M6/M7规则 |
| 7 | `tests/engines/decision.property.test.ts` | 生成随机数据完整度，验证降级逻辑 |
| 8 | `tests/engines/decision.property.test.ts` | 生成随机平台评级，验证show/hide规则 |
| 9 | `tests/engines/narrative.property.test.ts` | 生成随机评级，验证tone选择 |
| 10 | `tests/engines/narrative.property.test.ts` | 生成随机项目类型，验证策略映射 |
| 11 | `tests/engines/narrative.property.test.ts` | 遍历所有有效组合，验证模板加载 |
| 12 | `tests/engines/filtering.property.test.ts` | 生成随机项目列表和筛选条件，验证过滤 |
| 13 | `tests/engines/filtering.property.test.ts` | 生成随机列表长度和页码，验证分页 |

### 单元测试

**Rating Engine:**
- 边界值：ratio恰好等于阈值（0.8, 1.0, 1.2, 1.5）
- 极端值：ratio为0、极大值
- 所有维度缺失时的默认行为
- 成本类指标列表正确性（CPE, CPM, CPC）

**Decision Engine:**
- 恰好2个S/A评级时M3显示
- 恰好1个S/A评级时M3隐藏
- 投放占比恰好20%时M7的边界行为
- 所有模块数据完整时无降级
- 空评级列表时的默认决策

**Narrative Engine:**
- YAML模板加载和变量替换
- LLM失败时的fallback行为
- 问题转机会转换的输出格式

### E2E测试（Playwright）

- 项目创建向导完整流程
- 数据上传（各类型文件）
- 报告生成触发和进度展示
- 审校台三栏布局交互
- 模块开关切换
- 语气强度切换
- AI问答对话
- 报告导出下载
- 版本管理操作

### 集成测试

- API路由 → 引擎调用 → 数据库读写
- 报告生成全流程：Rating → Decision → Narrative → 组装
- 文件上传 → 解析 → 持久化 → 评级计算
- 版本创建和对比

