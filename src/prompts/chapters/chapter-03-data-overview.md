---
chapter_number: 3
chapter_name: "数据总览"
required_data_sources:
  - note_base
  - notes
  - juguang_data
  - review_configs
  - lingxi_data
output_format: paragraphs
system_prompt: |
  你是一位资深的小红书营销复盘专家。请基于提供的数据生成专业的数据总览解读。
  要求：语言简洁专业，必须引用具体数据，使用量化对比。
  成本类指标（CPM/CPC/CPE）越低越好，实际值低于大盘均值表示表现优秀。
  输出格式要求：必须严格输出结构化表格，不要将表格内容转为纯文字叙述。
  传播类指标（曝光/阅读/互动/爆文率）按KPI达成维度分析，使用完成率+箭头+颜色标注。
  效率类指标（CPM/CPC/CPE/CTR）按大盘对比维度分析，使用优于/劣于大盘百分比+颜色标注。
  向客户说明整体项目花了多少钱、达到了什么量级的传播效果，各KPI完成率如何。
  重点突出超额完成的指标，对未完成的指标给出客观原因，说明整体投入产出是否合理。

  关键说明：
  - 报备笔记 = 内容形式 IN (视频报备, 图文报备)，数据来自蒲公英平台API
  - 非报备笔记 = 内容形式 IN (视频软文, 图文软文)，数据来自业务底表
  - 总消费 = 内容费用(报备+非报备) + 投流费用(聚光fee)
  - CPM/CPC/CPE 的分子 = 总消费（含投流），分母 = 合并对应指标
  - 合并值 = 报备 + 非报备，效率指标使用合并分子÷合并分母计算（非加权平均）
fallback_text: "数据总览内容生成失败，请重试。"
---

基于以下数据生成「{{project_name}}」（品牌：{{brand}}，执行周期：{{start_date}} ~ {{end_date}}）的数据总览解读：

## 一、整体投放数据
- 总笔记篇数：{{note_count}}篇（报备：{{registered_note_count}}篇，非报备：{{unregistered_note_count}}篇）
- 总消费：{{total_cost}}元（内容费用 + 投流费用）
  - 内容费用：{{content_cost}}元（口径：{{content_cost_caliber}}）
    - 报备费用：{{registered_cost}}元
    - 非报备费用：{{unregistered_cost}}元
  - 投流消耗（聚光）：{{traffic_cost}}元
- 互动统计口径：{{engagement_metric}}
- 爆文统计口径：{{viral_metric}}

## 二、核心KPI达成

### 表1：传播类指标
| 指标 | KPI目标 | 实际达成 | 完成率 |
|------|---------|----------|--------|
| 总曝光 | {{kpi_impression}} | {{total_impressions}} | {{impression_completion}}% |
| 总阅读 | {{kpi_read}} | {{total_reads}} | {{read_completion}}% |
| 总互动 | {{kpi_engagement}} | {{total_engagement}} | {{engagement_completion}}% |
| 爆文数 | {{kpi_viral_count}} | {{viral_count}}篇 | {{viral_count_completion}}% |
| 爆文率 | {{kpi_viral_rate}}% | {{viral_rate}}% | {{viral_rate_completion}}% |

### 表2：效率类指标（与大盘对比）
| 指标 | 实际达成 | 大盘均值区间 | 对比大盘 |
|------|----------|-------------|----------|
| CPM | {{cpm}} | {{benchmark_cpm}} | — |
| CPC | {{cpc}} | {{benchmark_cpc}} | — |
| CPE | {{cpe}} | {{benchmark_cpe}} | — |
| CTR | {{ctr}}% | {{benchmark_ctr}}% | — |

补充参考（效率类KPI目标）：
- CPM目标：{{kpi_cpm}}，完成率：{{cpm_completion}}%
- CPC目标：{{kpi_cpc}}，完成率：{{cpc_completion}}%
- CPE目标：{{kpi_cpe}}，完成率：{{cpe_completion}}%
- CTR目标：{{kpi_ctr}}%，完成率：{{ctr_completion}}%

注：
- 报备数据来源：蒲公英平台API（imp_num, read_num, like_num, fav_num, cmt_num, share_num）
- 非报备数据来源：业务底表（曝光量, 阅读量, 点赞量, 收藏量, 评论量, 分享量, 关注量）
- 总消费 = 内容费用（报备+非报备）+ 投流费用（聚光fee）
- CPM/CPC/CPE = 总消费(含投流) / 合并对应指标（非分别计算后加权平均）

## 三、互动明细
- 点赞：{{total_likes}}
- 收藏：{{total_favs}}
- 评论：{{total_comments}}
- 分享：{{total_shares}}
- 关注：{{total_follows}}
- 总互动（按口径）：{{total_engagement}}

## 四、自然流 vs 投流拆分
| 维度 | 自然流 | 投流（聚光） | 合计 |
|------|--------|-------------|------|
| 曝光 | {{natural_impressions}} | {{juguang_impression}} | {{total_impressions}} |
| 阅读/点击 | {{natural_reads}} | {{juguang_click}} | {{total_reads}} |
| 互动 | {{natural_engagement}} | {{juguang_interaction}} | {{total_engagement}} |
| CPM | {{natural_cpm}} | — | {{cpm}} |
| CPC | {{natural_cpc}} | — | {{cpc}} |
| CPE | {{natural_cpe}} | — | {{cpe}} |
| CTR | {{natural_ctr}}% | — | {{ctr}}% |

注：自然流CPM/CPC/CPE的分子为总费用（内容+投流），分母为自然流量部分。

## 五、投流数据（聚光）
- 投流消耗：{{juguang_fee}}元
- 投流曝光：{{juguang_impression}}
- 投流点击：{{juguang_click}}
- 投流互动：{{juguang_interaction}}
- 新增深度种草人群（TI）：{{juguang_ti_user_num}}

## 六、人群资产（灵犀）
- 品牌AIPS人群总数：{{aips_brand}}
- 品牌TI人群数：{{ti_brand}}
- SPU AIPS人群总数：{{aips_spu}}
- SPU TI人群数：{{ti_spu}}

## 七、大盘对比
| 指标 | 实际值 | 大盘均值 | 对比 |
|------|--------|----------|------|
| CTR | {{ctr}}% | {{benchmark_ctr}}% | — |
| CPM | {{cpm}} | {{benchmark_cpm}} | — |
| CPC | {{cpc}} | {{benchmark_cpc}} | — |
| CPE | {{cpe}} | {{benchmark_cpe}} | — |
| 互动率 | — | {{benchmark_engagement_rate}}% | — |

请严格按照以下HTML格式输出（不要输出markdown表格，必须输出HTML标签）：

### 输出1：整体数据表现概述
用 `<p>` 标签输出80-120字概述，概括投放规模、总费用、核心成果。

### 输出2：传播类指标KPI达成表
必须输出如下HTML表格结构（5列：指标、KPI目标、实际达成、完成率、状态）：

```html
<h3>核心KPI达成情况</h3>
<table class="report-table" data-trace-id="ch3_kpi_table">
  <thead>
    <tr><th>指标</th><th>KPI目标</th><th>实际达成</th><th>完成率</th><th>状态</th></tr>
  </thead>
  <tbody>
    <tr>
      <td>总曝光</td>
      <td>245,243</td>
      <td>6,552,077</td>
      <td><span class="text-green">2671.7%</span></td>
      <td><span class="text-green">亮点</span></td>
    </tr>
    <tr>
      <td>总阅读</td>
      <td>2,452,345</td>
      <td>1,053,849</td>
      <td><span class="text-red">43.0%</span></td>
      <td><span class="text-red">需关注</span></td>
    </tr>
  </tbody>
</table>
```

规则：
- 包含指标行：总曝光、总阅读、总互动、爆文数、爆文率
- 完成率 ≥100%：用 `<span class="text-green">X%</span>`，状态列显示 `<span class="text-green">亮点</span>`
- 完成率 <100%：用 `<span class="text-red">X%</span>`，状态列显示 `<span class="text-red">需关注</span>`
- 爆文数和爆文率如果没有KPI目标，KPI目标列显示"—"，完成率和状态列也显示"—"
- 数字使用千分位格式（如 6,552,077）
### 输出3：效率类指标大盘对比表
必须输出如下HTML表格结构（5列：指标、KPI目标、实际达成、完成率、状态）：

```html
<h3>效率类指标达成情况</h3>
<table class="report-table" data-trace-id="ch3_efficiency_table">
  <thead>
    <tr><th>指标</th><th>KPI目标</th><th>实际达成</th><th>完成率</th><th>状态</th></tr>
  </thead>
  <tbody>
    <tr>
      <td>CPM (千次曝光成本)</td>
      <td>2,452,345</td>
      <td>28.00</td>
      <td><span class="text-green">8757467.8%</span></td>
      <td><span class="text-green">亮点</span></td>
    </tr>
  </tbody>
</table>
```

规则：
- 包含指标行：CPM (千次曝光成本)、CPC (单次点击成本)、CPE (单次互动成本)、CTR (点击率)
- 成本类指标（CPM/CPC/CPE）：完成率 = KPI目标 / 实际值 × 100%（越低越好，KPI是目标上限）
  - 完成率 ≥100%（即实际成本低于KPI目标）：用 `<span class="text-green">X%</span>`，状态=亮点
  - 完成率 <100%（即实际成本高于KPI目标）：用 `<span class="text-red">X%</span>`，状态=需关注
- CTR：完成率 = 实际值 / KPI目标 × 100%
  - 完成率 ≥100%：亮点（绿色）
  - 完成率 <100%：需关注（红色）
- 如果某指标没有KPI目标，该行KPI目标列显示"—"，完成率和状态也显示"—"

### 输出4：自然流vs投流效率对比解读
用 `<p>` 标签输出分析，说明哪个渠道效率更高、为什么，引用具体数据对比。

### 输出5：综合评价
用 `<p>` 标签输出50字内的整体投入产出评价。

【重要】不要输出"核心KPI完成率对比"柱状图或任何 chart-placeholder。只输出上述HTML表格+文字分析。
