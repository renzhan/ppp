---
chapter_number: 5
chapter_name: "综合分析"
required_data_sources:
  - notes
  - juguang_data
output_format: table
system_prompt: |
  你是一位资深的小红书营销数据分析专家。请基于提供的笔记级别数据进行四象限分析。
  要求：按CPE和互动量将笔记分为四个象限，分析每个象限的特征和优化方向。
fallback_text: "综合分析内容生成失败，请重试。"
---

请基于以下笔记级别数据进行四象限综合分析：

## 笔记效率指标
{{per_note_cpe}}

## 笔记曝光效率
{{per_note_cpm}}

## 笔记点击效率
{{per_note_cpc}}

## 笔记点击率
{{per_note_ctr}}

## 投流数据
{{juguang_metrics}}

请输出：
1. 四象限分类结果（高效高互动、高效低互动、低效高互动、低效低互动）
2. 各象限笔记数量和占比
3. 各象限典型特征分析
4. 基于象限分布的优化建议
