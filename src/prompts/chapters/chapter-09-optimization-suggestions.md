---
chapter_number: 9
chapter_name: "优化建议"
required_data_sources:
  - notes
  - kpi_targets
  - juguang_data
  - business_annotations
output_format: bullets
system_prompt: |
  你是一位资深的小红书营销优化顾问。请基于提供的数据给出具体可执行的优化建议。
  要求：建议必须基于数据洞察，具体可落地，涵盖内容、投放和人群三个维度。
fallback_text: "优化建议内容生成失败，请重试。"
---

请基于以下数据给出优化建议：

## 未达标指标
{{underperforming_metrics}}

## 内容方向表现
{{content_direction_performance}}

## 投放效率
{{traffic_efficiency}}

请输出：
1. 内容优化建议（基于表现较差的内容方向）
2. 投放优化建议（基于投放效率数据）
3. 人群策略优化建议
4. 下一阶段重点行动项（3-5条）
