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
  要求：语言简洁专业，必须引用具体数据，使用量化对比。对于KPI完成率>100%的标记为亮点，<100%的标记为需关注。
  成本类指标（CPM/CPC/CPE）越低越好，完成率>100%表示实际成本低于目标（好）。
  向客户说明整体项目花了多少钱、达到了什么量级的传播效果，各KPI完成率如何。
  重点突出超额完成的指标，对未完成的指标给出客观原因，说明整体投入产出是否合理。
fallback_text: "数据总览内容生成失败，请重试。"
---

基于以下数据生成「{{project_name}}」（品牌：{{brand}}，执行周期：{{start_date}} ~ {{end_date}}）的数据总览解读：

## 一、整体投放数据
- 总笔记篇数：{{note_count}}篇
- 总费用：{{total_cost}}元
  - 内容费用：{{content_cost}}元（口径：{{content_cost_caliber}}）
  - 投流费用：{{traffic_cost}}元（口径：{{traffic_cost_caliber}}）
- 互动统计口径：{{engagement_metric}}
- 爆文统计口径：{{viral_metric}}

## 二、核心KPI达成
| 指标 | KPI目标 | 实际达成 | 完成率 |
|------|---------|----------|--------|
| 总曝光 | {{kpi_impression}} | {{total_impressions}} | {{impression_completion}}% |
| 总阅读 | {{kpi_read}} | {{total_reads}} | {{read_completion}}% |
| 总互动 | {{kpi_engagement}} | {{total_engagement}} | {{engagement_completion}}% |
| 爆文率 | {{kpi_viral_rate}}% | {{viral_rate}}%（{{viral_count}}篇爆文） | {{viral_rate_completion}}% |
| CPM | {{kpi_cpm}} | {{cpm}} | {{cpm_completion}}% |
| CPC | {{kpi_cpc}} | {{cpc}} | {{cpc_completion}}% |
| CPE | {{kpi_cpe}} | {{cpe}} | {{cpe_completion}}% |
| CTR | {{kpi_ctr}}% | {{ctr}}% | {{ctr_completion}}% |

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

请输出：
1. 整体数据表现概述（80-120字，概括投放规模、总费用、核心成果）
2. 核心亮点指标（完成率>100%的指标，说明超额完成多少，用具体数据）
3. 需关注指标（完成率<100%的指标，分析可能原因，给出客观解释）
4. 自然流vs投流效率对比解读（哪个渠道效率更高，为什么）
5. 大盘对比解读（优于/劣于大盘的指标，差异幅度）
6. 综合评价（50字内，整体投入产出是否合理）
