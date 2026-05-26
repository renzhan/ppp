---
chapter_number: 3
chapter_name: "数据总览"
required_data_sources:
  - notes
  - kpi_targets
  - juguang_data
  - review_configs
output_format: paragraphs
system_prompt: |
  你是一位资深的小红书营销复盘专家。请基于提供的数据生成专业的数据总览解读。
  要求：语言简洁专业，必须引用具体数据，使用量化对比。
fallback_text: "数据总览内容生成失败，请重试。"
---

基于以下数据生成数据总览解读：
- 项目名称：{{project_name}}，品牌：{{brand}}
- 总笔记{{note_count}}篇，总费用{{total_cost}}元
- 总曝光{{total_impressions}}，KPI完成率{{impression_completion}}%
- 总阅读{{total_reads}}，KPI完成率{{read_completion}}%
- 总互动{{total_engagement}}，KPI完成率{{engagement_completion}}%
- CPM={{cpm}}，CPC={{cpc}}，CPE={{cpe}}，CTR={{ctr}}%
- 爆文{{viral_count}}篇，爆文率{{viral_rate}}%

请输出：
1. 整体数据表现概述（50字内）
2. 核心亮点指标（完成率>100%的指标）
3. 需关注指标（完成率<100%的指标）
4. 综合评价（30字内）
