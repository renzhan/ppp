# 复盘报告遗留问题清单

> 最后更新：2026-06-09

---

## 已修复问题（本次迭代）

| # | 问题 | 修复文件 |
|---|------|---------|
| 1 | KPI `viralPosts1k` 映射错误：比对的是爆文率（%），应该是爆文篇数 | `src/pipeline/loaders/chapter-03-data-overview.ts` |
| 2 | 爆文阈值硬编码 1000，未读取 `reviewConfig.viralThreshold` 配置 | `chapter-03`, `chapter-06`, `kol-tier.ts`, `content.ts` |
| 3 | `aggregateByKOLTier()` 硬编码粉丝层级，与 chapter-06 读取自定义配置不一致 | `src/calculation/kol-tier.ts` |

---

## 遗留问题

### ISSUE-001：投流周期未用于数据筛选和分阶段分析

**严重程度**：中

**现状描述**：

用户在创建复盘配置时可设置投流周期（如预热期、爆发期、延续期），包含每个阶段的开始/结束日期。但当前报告生成流程中：

- `launchPhases` 仅在 Chapter 2（项目回顾）中以文字形式展示传播节奏
- `business_annotations.launchPhase` 可按阶段分组统计笔记篇数
- **Chapter 7 投流分析完全不使用阶段信息**，所有投流指标都是全项目维度的聚合

**根本原因**：

`juguang_data` 表没有日期/时间字段，无法将投流数据关联到具体阶段。

**影响范围**：

- 投流 CPM/CPC/CPE/CTR 无法按阶段拆分对比
- 无法展示"预热期花了多少钱、爆发期花了多少钱"
- 无法分析不同阶段的投流效率差异

**解决方案建议**：

1. 给 `juguang_data` 表增加 `start_date` / `end_date` 字段（或 `campaign_date`）
2. 数据导入时从 Excel 中解析日期信息写入该字段
3. Chapter 7 loader 加载数据时，根据 `launchPhases` 的日期区间筛选聚光数据
4. 输出分阶段的投流指标表格（每阶段的消耗/曝光/点击/互动/CPX）
5. 备选方案：通过笔记发布时间 `notePublishTime` 间接关联（但不够精确，一篇笔记可能跨阶段投流）

**涉及文件**：

- `prisma/schema.prisma` — 增加字段
- `src/ingestion/spreadsheet-parser.ts` — 解析日期
- `src/pipeline/loaders/chapter-07-traffic-analysis.ts` — 分阶段聚合
- 前端 Excel 上传模板需适配

---

### ISSUE-002：`viralMetric` 字段名 `like_comment_share` 有误导性

**严重程度**：低

**现状描述**：

配置值 `like_comment_share` 暗示口径包含「分享」，但实际计算公式是 `赞 + 藏 + 评 >= 阈值`，**不含 share**。

**影响**：

- 开发者容易误解爆文口径
- 前端展示为"转评赞"是正确的，但后端枚举值命名不一致

**建议修复**：

将枚举值改为 `like_fav_comment` 或添加代码注释说明。由于需要数据库迁移（已有数据使用该值），建议优先加注释，或在下次大版本中做枚举重命名迁移。

---

### ISSUE-003：Chapter 2 达人层级分类与 chapter-06 配置不一致

**严重程度**：低

**现状描述**：

`chapter-02-project-review.ts` 中的 `classifyTier()` 函数硬编码了 5 级分类（头部/腰部/腰尾部/尾部/KOC），没有读取 `reviewConfig.influencerTiers` 自定义配置。

**影响**：

如果用户自定义了非标准层级划分（如只分3级），Chapter 2 的达人层级分布和 Chapter 6 的分析结果可能不一致。

**建议修复**：

Chapter 2 loader 也从 `reviewConfig.influencerTiers` 读取配置，若未配置则回退到默认值。

---

### ISSUE-004：`kol-tier.ts` 中 `classifyKOLTier()` 仍为硬编码

**严重程度**：低

**现状描述**：

虽然 `aggregateByKOLTier()` 已支持自定义 `tierConfig` 参数，但独立的 `classifyKOLTier()` 函数仍使用硬编码 5 级分类。如果有其他调用方直接使用该函数，仍会得到硬编码结果。

**建议修复**：

为 `classifyKOLTier()` 增加可选的 `tierConfig` 参数，或标记为 `@deprecated` 建议使用新的配置化方式。

---

### ISSUE-005：`pipeline.ts` 中 `calculateViralRate()` 未传入自定义阈值

**严重程度**：中

**现状描述**：

`src/calculation/pipeline.ts` 中调用 `calculateViralRate(noteMetricsList)` 时没有传入 `viralThreshold` 参数，仍使用默认值 1000。虽然 chapter-03 和 chapter-06 loader 已修复为读取配置，但 pipeline 完整计算流程（写入 `calculated_metrics` 表）仍使用硬编码阈值。

**影响**：

通过 pipeline 预计算存储到 DB 的爆文数据与实时生成报告时的结果可能不一致。

**建议修复**：

`runCalculationPipeline()` 应从 `ReviewConfig` 读取 `viralThreshold` 和 `viralMetric`，传给 `calculateViralRate()`。

---

### ISSUE-006：自然流 CPX 计算分子使用"总费用"而非"内容费用"

**严重程度**：低（需确认业务方）

**现状描述**：

Chapter 3 中自然流 CPM/CPC/CPE 的计算公式：
```
自然流CPM = 总费用 / 自然曝光 * 1000
自然流CPC = 总费用 / 自然阅读
自然流CPE = 总费用 / 自然互动
```

其中分子是 `totalCost`（内容费用 + 投流费用）。

**疑问**：

自然流的效率成本是否应该只除以"内容费用"部分？投流费用的效果体现在付费流量上，把投流费用也算进自然流成本，逻辑上可能不合理。

**建议**：

与业务方确认自然流 CPX 分子应该用"总费用"还是仅"内容费用"。

---

### ISSUE-007：笔记底表18列重构后「投流结算口径」无法计算

**严重程度**：高

**关联变更**：schema-restructure（笔记底表表头从旧格式变更为18列新格式）

**现状描述**：

新版笔记底表表头为：发布链接 | 内容方向 | 笔记类型 | 资源含税成本价 | 资源含税售价 | 内容形式 | 总消耗 | 曝光量 | 阅读量 | 点赞量 | 收藏量 | 评论量 | 转发量 | 互动量 | CPM | CPC | CPE | CTR

旧表头中的「投流实际消耗」（映射字段 `adSpend`）和「投流实际结算金额」（映射字段 `adSettlement`）列被移除。

**影响范围**：

Chapter 3 数据总览中，投流费用的计算逻辑为：
```typescript
if (trafficCostCaliber === 'settlement') {
  trafficCost = adSpendSettlement; // 来自 SUM(note_base.ad_spend)
} else {
  trafficCost = jgFee;             // 来自聚光数据 SUM(juguang_data.fee)
}
```

- 当用户选择 `trafficCostCaliber = 'settlement'`（结算口径）时，`ad_spend` 字段无数据来源，投流费用将为 0
- 导致 `totalCost`（总费用 = 内容费用 + 投流费用）偏低
- 进而影响 CPM/CPC/CPE 计算结果、自然流 CPX 计算结果
- Chapter 5 四象限分析中每篇笔记的 totalCost 也会受影响（取决于是否涉及投流结算口径）

**受影响的计算项**：

| 计算项 | 所在章节 | 影响说明 |
|--------|---------|---------|
| 投流结算口径金额 | Ch3 数据总览 | `SUM(note_base.ad_spend)` 无数据，结果为 0 |
| 总费用（结算口径含投流部分） | Ch3, Ch5 | totalCost 偏低 |
| 自然流 CPM/CPC/CPE（结算口径） | Ch3 | 分子 totalCost 偏低导致效率指标偏低 |

**不受影响的计算项**：

- `trafficCostCaliber = 'consumption'`（消耗口径）时投流费用从 `juguang_data.fee` 取值，不受影响
- 内容费用两种口径均不受影响（`contentCost` 对应"资源含税成本价"保留，`contentSettlement` 对应"资源含税售价"保留）
- 曝光/阅读/互动等指标来自 notes 表，不受影响

**可选解决方案**：

1. **强制使用消耗口径**：移除投流"结算口径"选项，投流费用统一从聚光数据取
2. **从"总消耗"反推**：投流部分 = 总消耗 - 资源含税成本价（`totalCost - contentCost`）
3. **底表增加"投流消耗"列**：变为19列，但与业务方确定的18列规格冲突

**待确认**：与业务方确认投流结算口径是否仍需支持，若需要则选择方案2或3。

---

### ISSUE-008：笔记底表18列重构后「是否报备」字段缺失

**严重程度**：低

**关联变更**：schema-restructure

**现状描述**：

新版18列表头中不包含「是否报备」列（旧字段 `isRegistered`）。

**影响范围**：

- `fillNotesFromNoteBase` 中使用 `isRegistered` 标记水下笔记（`isUnderwater = !isRegistered`）
- 新导入的笔记底表无法区分报备/未报备笔记
- 当前报告生成未直接使用此字段进行计算，影响有限

**解决方案**：

- `isRegistered` 字段默认为 false（已在 spec 中定义）
- 如业务需要区分报备/未报备，后续可通过蒲公英数据中的合作状态推断

---

### ISSUE-009：笔记底表18列重构后「博主昵称」「博主粉丝量」字段缺失对非官方合作笔记的影响

**严重程度**：中

**关联变更**：schema-restructure

**现状描述**：

新版18列表头中不包含「博主昵称」（kolNickName）和「博主粉丝量」（kolFanNum）列。

**影响范围**：

- **官方合作笔记**：不受影响，这两个字段从蒲公英爬取数据获得
- **非官方合作笔记**（蒲公英未爬到的）：
  - `kolNickName` 将为 null — Chapter 5/6 笔记表格中博主昵称显示为空
  - `kolFanNum` 将为 0 — Chapter 6 达人层级分类中，这些笔记会被归入最低层级（KOC）而非真实层级
  
**影响程度**：

如果项目中非官方合作笔记数量较少，影响有限。如果大量笔记为非官方合作，达人层级分布数据可能失真。

**解决方案建议**：

1. 非官方合作笔记不参与达人层级分组分析（排除 kolFanNum=0 的笔记）
2. 或在 Chapter 6 中对 kolFanNum=0 的笔记单独归入"未知层级"分组
3. 业务方确认非官方合作笔记是否需要参与达人层级分析
