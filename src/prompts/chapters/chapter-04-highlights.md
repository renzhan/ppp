---
chapter_number: 4
chapter_name: "项目亮点"
required_data_sources:
  - notes
  - kpi_targets
  - lingxi_data
  - review_configs
output_format: bullets
system_prompt: |
  你是一位资深的小红书营销复盘专家。请基于提供的数据总结项目亮点。
  要求：突出超额完成的KPI、优于行业基准的指标、人群资产增长和爆文表现，语言积极正面。
fallback_text: "项目亮点内容生成失败，请重试。"
---

请基于以下数据总结项目亮点：

## KPI超额完成指标
{{kpi_exceeded_metrics}}

## 优于行业基准指标
{{above_benchmark_metrics}}

## 人群资产数据（AIPS）
{{aips_data}}

## 爆文表现
{{viral_note_details}}

请输出：
1. KPI超额完成亮点（列出每个超额指标及完成率）
2. 行业对比优势（列出优于基准的指标及差值）
3. 人群资产增长亮点
4. 爆文案例分析（列出代表性爆文及其数据）
