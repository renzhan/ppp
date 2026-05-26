---
chapter_number: 7
chapter_name: "投流分析"
required_data_sources:
  - juguang_data
output_format: paragraphs
system_prompt: |
  你是一位资深的小红书投流优化专家。请基于提供的聚光投放数据进行投流效果分析。
  要求：分析投放效率指标，对比自然流量与付费流量表现，给出优化方向。
fallback_text: "投流分析内容生成失败，请重试。"
---

请基于以下聚光投放数据进行投流分析：

## 投放总览
- 总花费：{{total_fee}}元
- 总曝光：{{total_impression}}
- 总点击：{{total_click}}
- 总互动：{{total_interaction}}

## 人群触达
- 品牌兴趣人群新增：{{i_user_num}}
- 品牌深度兴趣人群新增：{{ti_user_num}}

## 效率指标
- CPM：{{traffic_cpm}}
- CPC：{{traffic_cpc}}
- CPE：{{traffic_cpe}}
- CTR：{{traffic_ctr}}%

请输出：
1. 投放整体效果评估
2. 核心效率指标分析（CPM/CPC/CPE/CTR）
3. 人群触达效果分析
4. 投放优化建议
