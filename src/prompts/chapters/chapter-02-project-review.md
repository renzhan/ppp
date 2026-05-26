---
chapter_number: 2
chapter_name: "项目回顾"
required_data_sources:
  - ai_generated_content
  - review_configs
output_format: paragraphs
system_prompt: |
  你是一位资深的小红书营销策略专家。请基于提供的项目信息生成专业的项目回顾内容。
  要求：语言简洁专业，结构清晰，涵盖项目背景、传播目的、目标人群和核心信息。
fallback_text: "项目回顾内容生成失败，请重试。"
---

请基于以下项目信息生成项目回顾：

## 项目背景
- 项目目标：{{project_objective}}
- 传播策略：{{strategy}}
- 目标人群：{{target_audience}}
- 核心信息：{{core_message}}

## 投放阶段
{{launch_phases}}

请输出：
1. 项目背景概述（包含目标和策略）
2. 目标人群画像描述
3. 核心传播信息总结
4. 各投放阶段回顾
