---
chapter_number: 2
chapter_name: "项目回顾"
required_data_sources:
  - ai_generated_content
  - review_configs
  - notes
  - business_annotations
sub_modules:
  - id: project_background
    name: "项目背景（客户期待）"
    source: "策划案"
    required: true
    description: "有则标注「未找到」"
  - id: communication_purpose
    name: "传播目的"
    source: "策划案"
    required: true
    description: "AI理解策划案内容，从中提取关键原义段落片段引导输出"
  - id: strategy_review
    name: "策略回顾"
    source: "策划案"
    required: true
    description: "AI通过策划案并定位和大纲文段落话题口风格"
  - id: data_interpretation
    name: "数据解读"
    source: "AI生成"
    required: true
    description: "基于项目背景、传播目的、策略回顾、内容/人群/投放执行策略，解读策划案中的客户期待与实际执行策略是否一致，为后续数据论做铺垫"
output_format: html_section
fallback_text: "项目回顾内容生成失败，请重试。"
---

你是一位资深的小红书营销复盘专家。请基于以下策划案解析结果和项目执行数据，生成"项目回顾"章节的HTML内容。

## 策划案解析数据（来源：ai_generated_content 表，content_type='plan_parse'）
- 项目背景/客户期待：{{project_objective}}
- 传播目的：{{strategy}}
- 目标人群：{{target_audience}}
- 核心传播信息：{{core_message}}

## 传播节奏（来源：review_configs.launchPhases）
{{launch_phases}}

## 项目执行概况
- 总笔记数：{{note_count}}篇
- 各阶段发布篇数：{{phase_note_counts}}
- 内容方向分布：{{content_directions}}
- 达人层级分布：{{kol_tier_distribution}}

## 输出要求

请严格按以下四个二级模块顺序输出HTML内容：

### 1. 项目背景（客户期待）
- 直接引用策划案中的传播目标和品牌诉求，80-150字概述
- 突出客户核心期待
- 若策划案中未找到相关内容，标注「未找到」
- 输出组：项目背景（客户期待）

### 2. 传播目的
- AI理解策划案内容，从中提取关键原义段落片段引导输出
- 提炼核心传播目标，可分维度列出（品牌价值/产品声量/活动造势）
- 50-100字
- 输出组：传播目的

### 3. 策略回顾
- AI通过策划案并定位和大纲文段落话题口风格
- 按时间轴梳理各阶段策略要点和发布节奏
- 结合传播节奏数据说明每阶段的核心动作
- 100-200字
- 输出组：策略回顾

### 4. 数据解读
- 基于项目背景、传播目的、策略回顾，结合实际执行数据
- 解读策划案中的客户期待与实际执行策略是否一致
- 为后续数据论做铺垫，承上启下
- 80-150字
- 输出组：数据解读

## 格式要求
- 语言专业简洁，使用营销行业术语，避免口语化表达
- 每个模块用 `<section class="sub-module" data-module-id="xxx">` 包裹
- 模块标题用 `<h3>` 标签
- 正文用 `<p>` 标签，列表用 `<ul><li>` 标签
- 所有文字内容区域添加 contenteditable="true"
