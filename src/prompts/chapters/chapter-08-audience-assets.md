---
chapter_number: 8
chapter_name: "人群资产"
required_data_sources:
  - lingxi_data
output_format: bullets
system_prompt: |
  你是一位资深的小红书人群运营专家。请基于提供的AIPS人群资产数据进行分析。
  要求：分析各层级人群规模和流转效率，给出人群运营建议。
fallback_text: "人群资产内容生成失败，请重试。"
---

请基于以下AIPS人群资产数据进行分析：

## 人群规模
{{aips_population_data}}

## 人群流转率
{{aips_flow_rates}}

请输出：
1. 各层级人群规模概述（A-认知、I-兴趣、P-购买、S-忠诚）
2. 人群流转效率分析（各层级间转化率）
3. 人群资产健康度评估
4. 人群运营优化建议
