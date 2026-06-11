# Bugfix Requirements Document

## Introduction

小红书营销复盘报告生成系统存在6个章节的数据展示和逻辑缺陷，导致生成的报告无法满足客户复盘需求。核心问题包括：数据总览缺少KPI对比表格、项目亮点使用非标准框架且缺乏数据支撑、内容分析表格缺列且缺少笔记结构分析、四象限分析使用错误的分类逻辑导致全部空白、投流分析显示creator ID而非昵称且缺少关键字段、优化建议存在严重的数据幻觉。这些缺陷影响报告的专业性、可信度和客户决策价值。

## Bug Analysis

### Current Behavior (Defect)

**Bug 1: 数据总览 (Chapter 3)**

1.1 WHEN the data overview chapter is generated THEN the system only shows actual values (e.g., "总曝光 644w") without KPI targets, completion rates, or benchmark comparisons, making it impossible for users to judge project performance

1.2 WHEN 传播类指标 (曝光/阅读/互动/爆文率) are displayed THEN the system does not present them in a structured 3-column table (KPI目标 | 实际达成 with ↑/↓ arrow | 完成率 with green/red color coding)

1.3 WHEN 效率类指标 (CPM/CPC/CPE/CTR) are displayed THEN the system does not present them in a separate 3-column table (实际达成 | 大盘均值区间 | 优于/劣于大盘百分比 with green/red color coding)

1.4 WHEN the data overview is rendered THEN the system includes an unnecessary "核心KPI完成率对比" bar chart that should be removed

**Bug 2: 项目亮点 (Chapter 4)**

1.5 WHEN the highlights chapter is generated THEN the system uses "被看见/被种草/被分享" AIPS framework (non-standard marketing terms) instead of a numbered highlights format

1.6 WHEN each highlight dimension is displayed THEN the system only shows text descriptions without real data support, benchmark comparison, KPI completion rate, or data source citation

1.7 WHEN 人群资产 data (AIPS/TI) is available THEN the system does not include 灵犀 backend screenshots as evidence, nor display AIPS本品变化率, TI本品变化率, or AIPS人群规模行业排名

1.8 WHEN AIPS/TI data exists THEN the system does not generate a "品牌心智数据解读" AI summary based on the actual AIPS/TI data

**Bug 3: 内容分析 (Chapter 6)**

1.9 WHEN the content direction table and influencer tier table are generated THEN the system is missing columns (should have: 篇数 | 曝光量 | 阅读量 | 互动量 | 爆文数 | 爆文率 | CPM | CPC | CPE | CPI | CPTI)

1.10 WHEN quality/problem note analysis is displayed THEN the system only shows text descriptions without cover images, creator nicknames, titles, metrics (曝光/互动/CPE), cover analysis, title analysis, content structure (开头→中间→结尾), or success/failure reason

1.11 WHEN table headers contain long text THEN the system does not allow header wrapping, causing horizontal scrolling issues in PDF export

**Bug 4: 综合分析/四象限 (Chapter 5)**

1.12 WHEN the quadrant analysis chapter is generated THEN the system shows blank results (empty scatter chart, empty quadrant summary cards, empty note detail table) in all test projects

1.13 WHEN quadrant classification is performed THEN the system uses benchmark-based quadrant classification (comparing each note's CPM/CPE/CTR against industry benchmarks) instead of the required normalized engage_rate × 投流CPE methodology

1.14 WHEN only 1 note has traffic data or a note has juguang interaction=0 THEN the system does not handle these edge cases (should use X score=0.5 for single-note case, treat interaction=0 as no traffic data)

**Bug 5: 投流分析 (Chapter 7)**

1.15 WHEN the note-level traffic table is generated THEN the system displays raw creator IDs (e.g., "6a2273d4...b9fb") instead of kol_nick_name from the database

1.16 WHEN the note-level traffic table is generated THEN the system is missing 展现量 and 点击量 absolute value columns (only shows derived metrics)

1.17 WHEN the traffic overview section is rendered THEN many fields show blank, missing: 总消耗, 投流总展现量, 投流总点击量, 投流总互动, 投流总CTR, 投流总CPM, 投流总CPC, 投流总CPE, 投流总新增种草人群及成本, 投流总新增深度种草人群及成本, 数据解读

1.18 WHEN traffic data is available THEN the system does not generate a CPM/CPC/CPE daily trend line chart with investment period background colors (预热期/爆发期/持续期)

1.19 WHEN ad type analysis is generated THEN the system does not show a summary table above note detail grouped by 广告类型 with 消费/展现量/点击量/互动量/CPM/CPC/CTR/CPE/CPI/CPTI

**Bug 6: 优化建议 (Chapter 9)**

1.20 WHEN the optimization suggestions chapter is generated THEN the system fabricates data that does not exist in the database, including: LTV multiples, customer unit prices, age group percentages, and specific execution strategies (Lookalike expansion, Retargeting)

1.21 WHEN optimization suggestions are generated THEN the prompt template does not contain sufficient anti-hallucination constraints, allowing the AI to generate fabricated metrics and strategies

### Expected Behavior (Correct)

**Bug 1: 数据总览 (Chapter 3)**

2.1 WHEN the data overview chapter is generated THEN the system SHALL display both KPI targets and actual values with completion rates, enabling users to judge whether project targets were met

2.2 WHEN 传播类指标 (曝光/阅读/互动/爆文率) are displayed THEN the system SHALL present them in a structured table with 3 columns: KPI目标 | 实际达成 (with ↑ if exceeded, ↓ if below) | 完成率 (green+↑ if ≥100%, red+↓ if <100%)

2.3 WHEN 效率类指标 (CPM/CPC/CPE/CTR) are displayed THEN the system SHALL present them in a separate table with 3 columns: 实际达成 | 大盘均值区间 | 优于/劣于大盘百分比 (green if better, red if worse)

2.4 WHEN the data overview is rendered THEN the system SHALL NOT include the "核心KPI完成率对比" bar chart, and SHALL instruct the AI to output two separate structured tables

**Bug 2: 项目亮点 (Chapter 4)**

2.5 WHEN the highlights chapter is generated THEN the system SHALL use a numbered highlights format (2-5 items), each with: title + supporting data + benchmark comparison, dynamically generated based on project performance

2.6 WHEN each highlight item is displayed THEN the system SHALL include concrete data support, example format: "亮点1：爆文频出，爆文率远超KPI" with "爆文率：82.6% KPI：35% 完成率：236%"

2.7 WHEN 人群资产 data (AIPS/TI) is available THEN the system SHALL include 灵犀 backend screenshot references as evidence, and SHALL display AIPS本品变化率, TI本品变化率, AIPS人群规模行业排名 fields

2.8 WHEN AIPS/TI data exists THEN the system SHALL generate a "品牌心智数据解读" section with AI-generated summary text based on the actual AIPS/TI data from lingxi_data

**Bug 3: 内容分析 (Chapter 6)**

2.9 WHEN the content direction table and influencer tier table are generated THEN the system SHALL include complete columns: 内容方向/达人层级 | 篇数 | 曝光量 | 阅读量 | 互动量 | 爆文数 | 爆文率 | CPM | CPC | CPE | CPI | CPTI

2.10 WHEN each note analysis is displayed THEN the system SHALL show: [cover thumbnail] @creator nickname, title, metrics (曝光/互动/CPE), cover analysis, title analysis, content structure (开头→中间→结尾), success/failure reason

2.11 WHEN table headers are rendered THEN the system SHALL allow header text wrapping (via prompt instruction or CSS guidance) to avoid horizontal scrolling in PDF export

**Bug 4: 综合分析/四象限 (Chapter 5)**

2.12 WHEN the quadrant analysis chapter is generated THEN the system SHALL display: 4 quadrant summary cards above the chart, a scatter plot with numbered data points, and a detail table below with actual data

2.13 WHEN quadrant classification is performed THEN the system SHALL use engage_rate (Y-axis, content quality) and 投流CPE (X-axis, traffic efficiency) as core metrics, normalize both to 0-1 range within the project, with X-axis formula: 1 - (投流CPE - MIN) / (MAX - MIN) [inverted], Y-axis formula: (engage_rate - MIN) / (MAX - MIN), and dividing lines = AVG of normalized scores

2.14 WHEN only 1 note has traffic data THEN the system SHALL set its X score to 0.5; WHEN a note has juguang interaction=0 THEN the system SHALL treat it as having no traffic data and exclude from quadrant analysis

**Bug 5: 投流分析 (Chapter 7)**

2.15 WHEN the note-level traffic table is generated THEN the system SHALL display creator nicknames (using kol_nick_name field from notes table) instead of raw creator IDs

2.16 WHEN the note-level traffic table is generated THEN the system SHALL include columns: 创作者昵称 | 消耗 | 展现量 | 点击量 | CTR | CPE | CPTI | 评价

2.17 WHEN the traffic overview section is rendered THEN the system SHALL show all fields: 总消耗, 投流总展现量, 投流总点击量, 投流总互动, 投流总CTR, 投流总CPM, 投流总CPC, 投流总CPE, 投流总新增种草人群及成本, 投流总新增深度种草人群及成本, followed by a 数据解读 AI summary

2.18 WHEN traffic data is available THEN the system SHALL provide data for a CPM/CPC/CPE daily trend line chart with investment period background colors (预热期/爆发期/持续期), sourcing the period definitions from review_configs

2.19 WHEN ad type analysis is generated THEN the system SHALL include a summary table grouped by 广告类型 with columns: 消费 | 展现量 | 点击量 | 互动量 | CPM | CPC | CTR | CPE | CPI | CPTI, placed above the note-level detail

**Bug 6: 优化建议 (Chapter 9)**

2.20 WHEN the optimization suggestions chapter is generated THEN the system SHALL ONLY reference data that actually exists in the database (from previous chapter outputs), and SHALL NOT fabricate LTV multiples, customer unit prices, age demographics, or specific execution strategies not grounded in data

2.21 WHEN optimization suggestions are generated THEN the prompt template SHALL include explicit anti-hallucination constraints instructing the AI to: (a) only cite metrics present in the provided data, (b) never invent numerical values, (c) ground all recommendations in actual project performance from earlier chapters

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the data overview loader (chapter-03) calculates total cost, CPM, CPC, CPE, CTR THEN the system SHALL CONTINUE TO use the same formulas (totalCost/impressions*1000, totalCost/reads, totalCost/engagement, reads/impressions*100) and caliber logic (content/traffic cost caliber settings from review_configs)

3.2 WHEN the data overview loader reads notes, juguang_data, and lingxi_data THEN the system SHALL CONTINUE TO aggregate data from the same database tables using the same Prisma queries and field mappings

3.3 WHEN the highlights loader calculates KPI completion rates and benchmark comparisons THEN the system SHALL CONTINUE TO use the same comparison formulas (isCost ? target/actual*100 : actual/target*100) and normalizeBenchmarkValue utility

3.4 WHEN the content analysis loader groups notes by contentDirection, kolTier, noteType THEN the system SHALL CONTINUE TO use the same grouping logic and include the existing fields (篇数, 曝光量, 阅读量, 互动量, TI人群, CPTI, CPE, 爆文篇数, 爆文率)

3.5 WHEN the traffic analysis loader aggregates juguang_data by note, placement, targetsDetail, keyword THEN the system SHALL CONTINUE TO use the same GROUP BY aggregation logic and placement label mapping (1=信息流, 2=搜索, 4=全站智投, 7=视频流)

3.6 WHEN the optimization loader provides data to the AI THEN the system SHALL CONTINUE TO pass underperforming metrics, content direction performance, and traffic efficiency data from the database

3.7 WHEN traceability items are constructed by any loader THEN the system SHALL CONTINUE TO generate traceItems with sourceTable, sourceQuery, columns, dataRows, and calculations in the same format

3.8 WHEN notes with no juguang_data exist THEN the system SHALL CONTINUE TO exclude them from traffic-dependent analyses (quadrant, traffic per-note) as currently implemented

3.9 WHEN the system renders report chapters THEN the system SHALL CONTINUE TO use the same prompt template → data loader → AI generation → HTML rendering pipeline architecture
