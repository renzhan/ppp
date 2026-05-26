---
chapter_number: 6
chapter_name: "内容分析"
required_data_sources:
  - notes
  - business_annotations
output_format: table
system_prompt: |
  你是一位资深的小红书内容营销分析专家。请基于提供的分组数据进行内容维度分析。
  要求：从内容方向、笔记类型、达人类型三个维度分析效果差异，给出数据支撑的结论。
fallback_text: "内容分析内容生成失败，请重试。"
---

请基于以下分组数据进行内容维度分析：

## 按内容方向分组
{{metrics_by_content_direction}}

## 按笔记类型分组
{{metrics_by_note_type}}

## 按达人类型分组
{{metrics_by_kol_type}}

请输出：
1. 内容方向效果对比（各方向的曝光、互动、CPE对比）
2. 笔记类型效果对比（图文vs视频等）
3. 达人类型效果对比（各层级达人的性价比分析）
4. 最优内容组合建议
