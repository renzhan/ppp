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

  关键说明：
  - 报备笔记 = 内容形式 IN (视频报备, 图文报备)，数据来自蒲公英平台API
  - 非报备笔记 = 内容形式 IN (视频软文, 图文软文)，数据来自业务底表
  - 合并值 = 报备 + 非报备，效率指标使用合并分子÷合并分母计算（非加权平均）
fallback_text: "数据总览内容生成失败，请重试。"
---

基于以下数据生成「{{project_name}}」（品牌：{{brand}}，执行周期：{{start_date}} ~ {{end_date}}）的数据总览解读：

## 一、整体投放数据
- 总发布数量：{{note_count}}篇
  - 报备笔记：{{registered_note_count}}篇
  - 非报备笔记：{{unregistered_note_count}}篇
- 总消费：{{total_cost}}元
  - 报备消费：{{registered_cost}}元
  - 非报备消费：{{unregistered_cost}}元
  - 内容金额口径：{{content_cost_caliber}}
- 互动统计口径：{{engagement_metric}}
- 爆文统计口径：{{viral_metric}}

## 二、核心KPI达成（合并报备+非报备）
| 指标 | KPI目标 | 实际达成 | 完成率 |
|------|---------|----------|--------|
| 总曝光 | {{kpi_impression}} | {{total_impressions}} | {{impression_completion}}% |
| 总阅读 | {{kpi_read}} | {{total_reads}} | {{read_completion}}% |
| 总互动 | {{kpi_engagement}} | {{total_engagement}} | {{engagement_completion}}% |
| 爆文数 | {{kpi_viral_count}} | {{viral_count}}篇 | — |
| 爆文率 | {{kpi_viral_rate}}% | {{viral_rate}}% | {{viral_rate_completion}}% |
| CPM | {{kpi_cpm}} | {{cpm}} | {{cpm_completion}}% |
| CPC | {{kpi_cpc}} | {{cpc}} | {{cpc_completion}}% |
| CPE | {{kpi_cpe}} | {{cpe}} | {{cpe_completion}}% |
| CTR | {{kpi_ctr}}% | {{ctr}}% | {{ctr_completion}}% |

## 三、报备 vs 非报备拆分
| 维度 | 报备 | 非报备 | 合并 |
|------|------|--------|------|
| 发布数量 | {{registered_note_count}} | {{unregistered_note_count}} | {{note_count}} |
| 消费 | {{registered_cost}} | {{unregistered_cost}} | {{total_cost}} |
| 曝光量 | {{reg_impressions}} | {{unreg_impressions}} | {{total_impressions}} |
| 阅读量 | {{reg_reads}} | {{unreg_reads}} | {{total_reads}} |
| 互动量 | {{reg_engagement}} | {{unreg_engagement}} | {{total_engagement}} |
| 爆文数 | {{reg_viral_count}} | {{unreg_viral_count}} | {{viral_count}} |

注：
- 报备数据来源：蒲公英平台API（imp_num, read_num, like_num, fav_num, cmt_num, share_num）
- 非报备数据来源：业务底表（曝光量, 阅读量, 点赞量, 收藏量, 评论量, 分享量, 关注量）
- 合并CPM/CPC/CPE = 合并消费 / 合并对应指标（非分别计算后加权平均）

## 四、互动明细
- 点赞：{{total_likes}}
- 收藏：{{total_favs}}
- 评论：{{total_comments}}
- 分享：{{total_shares}}
- 关注：{{total_follows}}
- 总互动（按口径）：{{total_engagement}}

## 五、自然流 vs 投流拆分（仅报备笔记）
| 维度 | 自然流 | 投流（聚光） | 报备合计 |
|------|--------|-------------|------|
| 曝光 | {{natural_impressions}} | {{juguang_impression}} | {{reg_impressions}} |
| 阅读/点击 | {{natural_reads}} | {{juguang_click}} | {{reg_reads}} |
| 互动 | {{natural_engagement}} | {{juguang_interaction}} | {{reg_engagement}} |
| CPM | {{natural_cpm}} | — | — |
| CPC | {{natural_cpc}} | — | — |
| CPE | {{natural_cpe}} | — | — |
| CTR | {{natural_ctr}}% | — | — |

## 六、投流数据（聚光）
- 投流消耗：{{juguang_fee}}元
- 投流曝光：{{juguang_impression}}
- 投流点击：{{juguang_click}}
- 投流互动：{{juguang_interaction}}
- 新增深度种草人群（TI）：{{juguang_ti_user_num}}

## 七、人群资产（灵犀）
- 品牌AIPS人群总数：{{aips_brand}}
- 品牌TI人群数：{{ti_brand}}
- SPU AIPS人群总数：{{aips_spu}}
- SPU TI人群数：{{ti_spu}}

## 八、大盘对比
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
4. 报备vs非报备效率对比解读（各自的CPM/CPE水平比较）
5. 自然流vs投流效率对比解读（哪个渠道效率更高，为什么）
6. 大盘对比解读（优于/劣于大盘的指标，差异幅度）
7. 综合评价（50字内，整体投入产出是否合理）
