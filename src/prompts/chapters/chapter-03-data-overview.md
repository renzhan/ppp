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
fallback_text: "数据总览内容生成失败，请重试。"
---

基于以下数据生成「{{project_name}}」（品牌：{{brand}}）的数据总览解读：

## 一、整体投放数据
- 总笔记篇数：{{note_count}}篇
- 总费用：{{total_cost}}元（内容费用{{total_content_cost}}元 + 投流费用{{juguang_fee}}元）
- 互动率口径：{{engagement_metric}}

## 二、核心KPI达成
| 指标 | KPI目标 | 实际达成 | 完成率 |
|------|---------|----------|--------|
| 总曝光 | {{kpi_impression}} | {{total_impressions}} | {{impression_completion}}% |
| 总阅读 | {{kpi_read}} | {{total_reads}} | {{read_completion}}% |
| 总互动 | {{kpi_engagement}} | {{total_engagement}} | {{engagement_completion}}% |
| 爆文率 | {{kpi_viral_rate}}% | {{viral_rate}}%（{{viral_count}}篇） | {{viral_rate_completion}}% |
| CPM | {{kpi_cpm}} | {{cpm}} | {{cpm_completion}}% |
| CPC | {{kpi_cpc}} | {{cpc}} | {{cpc_completion}}% |
| CPE | {{kpi_cpe}} | {{cpe}} | {{cpe_completion}}% |
| CTR | {{kpi_ctr}}% | {{ctr}}% | {{ctr_completion}}% |

## 三、互动明细
- 点赞：{{total_likes}}，收藏：{{total_favs}}，评论：{{total_comments}}，分享：{{total_shares}}

## 四、自然流 vs 投流拆分
| 维度 | 自然流 | 投流（聚光） |
|------|--------|-------------|
| 曝光 | {{natural_impressions}} | {{juguang_impression}} |
| 阅读/点击 | {{natural_reads}} | {{juguang_click}} |
| 互动 | {{natural_engagement}} | {{juguang_interaction}} |
| CPM | {{natural_cpm}} | {{juguang_cpm}} |
| CPC | {{natural_cpc}} | {{juguang_cpc}} |
| CPE | {{natural_cpe}} | {{juguang_cpe}} |
| CTR | {{natural_ctr}}% | {{juguang_ctr}}% |

## 五、投流种草人群
- 新增种草人群：{{juguang_i_user_num}}
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

请输出：
1. 整体数据表现概述（80字内，概括投放规模和核心成果）
2. 核心亮点指标（完成率>100%的指标，说明超额完成多少）
3. 需关注指标（完成率<100%的指标，分析可能原因）
4. 自然流vs投流效率对比解读
5. 综合评价与建议（50字内）
