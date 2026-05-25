# Requirements Document

## Introduction

本需求文档描述"复盘报告生成管线"（Report Generation Pipeline）功能。该功能解决当前系统中 `reportContent` 始终为 null 的核心问题，通过构建完整的数据 Mock → 章节 Prompt 加载 → LLM 生成 → 内容存储 → AI Chat 修改的端到端流程，使审校台能够展示和编辑生成的复盘报告内容。

系统包含 10 个章节（封面、项目回顾、数据总览、项目亮点、综合分析、内容分析、投流分析、人群资产、优化建议、尾页），每个章节有独立的数据需求和 Prompt 模板。生成流程按章节逐一加载对应数据和 Prompt，调用 LLM（通过 Presenton Chat API 或现有叙事引擎）生成内容，最终将结果写入 `ReviewConfig.reportContent` 供审校台消费。

## Glossary

- **Pipeline**: 报告生成管线，指从数据加载到内容生成到存储的完整自动化流程
- **Chapter**: 复盘报告中的一个章节（共 10 章），每章有独立的数据需求和 Prompt
- **Prompt_Template**: 独立的 Markdown 格式提示词文件，包含变量占位符，用于指导 LLM 生成特定章节内容
- **Seed_Script**: 数据库种子脚本，用于填充测试/演示用的模拟数据
- **Review_Config**: 复盘配置记录（`review_configs` 表），其 `reportContent` 字段存储生成的报告内容
- **Report_Version**: 报告版本记录（`report_versions` 表），存储报告内容快照
- **Narrative_Engine**: 现有叙事引擎（`src/engines/narrative.ts`），负责加载 YAML 模板并调用 LLM 生成文案
- **Presenton_Chat_API**: Presenton FastAPI 的 AI 对话接口（`/api/v1/ppt/chat/message/stream`），支持流式响应
- **Proofread_Page**: 审校台页面（`/review/[id]/proofread`），用于展示和编辑报告内容
- **Chapter_Data_Loader**: 章节数据加载器，负责从数据库查询特定章节所需的全部数据
- **LLM_Client**: 大语言模型客户端，封装对 OpenAI 兼容 API 的调用
- **TipTap_Editor**: 审校台中的富文本编辑器组件，支持 Markdown 格式编辑

## Requirements

### Requirement 1: Mock 数据种子脚本

**User Story:** As a developer, I want a seed script that populates the database with realistic test data for a complete project, so that I can test the full report generation pipeline end-to-end without relying on real data uploads.

#### Acceptance Criteria

1. WHEN the Seed_Script is executed, THE Seed_Script SHALL create a Project record with realistic values for category, brand, businessLine, projectName, startDate, endDate, and projectType
2. WHEN the Seed_Script is executed, THE Seed_Script SHALL create at least 30 Note records with varied kolFanNum, impNum, readNum, likeNum, favNum, cmtNum, shareNum, kolPrice, serviceFee, and noteType values
3. WHEN the Seed_Script is executed, THE Seed_Script SHALL create JuguangData records for at least 50% of the Notes, with realistic fee, impression, click, interaction, iUserNum, and tiUserNum values
4. WHEN the Seed_Script is executed, THE Seed_Script SHALL create BusinessAnnotation records for all Notes, with varied contentDirection, accountType, kolType, and launchPhase values
5. WHEN the Seed_Script is executed, THE Seed_Script SHALL create KpiTarget records for metrics including impression, read, engagement, cpm, cpc, cpe, ctr, and viralCount
6. WHEN the Seed_Script is executed, THE Seed_Script SHALL create a ReviewConfig record linked to the Project with benchmark, influencerTiers, kpiTargets, modules, and launchPhases populated
7. WHEN the Seed_Script is executed, THE Seed_Script SHALL create an AiGeneratedContent record with contentType='plan_parse' containing projectObjective, strategy, targetAudience, and coreMessage
8. WHEN the Seed_Script is executed, THE Seed_Script SHALL create LingxiData records with dataType='aips' containing awareness, interest, purchase, and share population counts
9. WHEN the Seed_Script is executed twice, THE Seed_Script SHALL be idempotent by checking for existing data before creating duplicates
10. WHEN the Seed_Script completes, THE Seed_Script SHALL log a summary of all created records with counts per table

### Requirement 2: Independent Chapter Prompt Files

**User Story:** As a developer, I want each chapter's prompt template stored as an independent file, so that prompts can be maintained, versioned, and tested separately from the generation logic.

#### Acceptance Criteria

1. THE Pipeline SHALL store Prompt_Template files in the directory `src/prompts/chapters/` with one file per chapter named `chapter-{number}-{slug}.md` (e.g., `chapter-01-cover.md`, `chapter-03-data-overview.md`)
2. WHEN a Prompt_Template file is loaded, THE Pipeline SHALL parse variable placeholders in the format `{{variable_name}}` from the template content
3. THE Pipeline SHALL provide Prompt_Template files for all 10 chapters: cover, project-review, data-overview, highlights, quadrant-analysis, content-analysis, traffic-analysis, audience-assets, optimization-suggestions, and end-page
4. WHEN a Prompt_Template file contains a `---` YAML front-matter block, THE Pipeline SHALL parse metadata fields including `chapter_number`, `chapter_name`, `required_data_sources`, and `output_format`
5. WHEN a Prompt_Template file references a variable that is not available in the data context, THE Pipeline SHALL substitute an empty string and log a warning identifying the missing variable
6. THE Pipeline SHALL support a `system_prompt` field in the front-matter that provides the LLM system role context for that chapter

### Requirement 3: Chapter Data Loader

**User Story:** As a developer, I want a data loader that fetches all required database data for a specific chapter, so that the generation pipeline can assemble the correct context for each chapter's prompt.

#### Acceptance Criteria

1. WHEN the Chapter_Data_Loader is invoked for Chapter 1 (Cover), THE Chapter_Data_Loader SHALL return project category, brand, businessLine, projectName, startDate, and endDate from the projects table
2. WHEN the Chapter_Data_Loader is invoked for Chapter 2 (Project Review), THE Chapter_Data_Loader SHALL return the plan_parse content from ai_generated_content and launchPhases from review_configs
3. WHEN the Chapter_Data_Loader is invoked for Chapter 3 (Data Overview), THE Chapter_Data_Loader SHALL return aggregated metrics including totalImpressions, totalReads, totalEngagement, totalCost, viralCount, viralRate, cpm, cpc, cpe, ctr, and KPI completion rates from notes, juguang_data, and kpi_targets
4. WHEN the Chapter_Data_Loader is invoked for Chapter 4 (Highlights), THE Chapter_Data_Loader SHALL return KPI exceeded metrics, above-benchmark metrics, AIPS data from lingxi_data, and viral note details
5. WHEN the Chapter_Data_Loader is invoked for Chapter 6 (Content Analysis), THE Chapter_Data_Loader SHALL return aggregated metrics grouped by contentDirection, noteType, and kolType from notes joined with business_annotations
6. WHEN the Chapter_Data_Loader is invoked for Chapter 7 (Traffic Analysis), THE Chapter_Data_Loader SHALL return aggregated paid traffic metrics including totalFee, totalImpression, totalClick, totalInteraction, iUserNum, tiUserNum, and derived CPM/CPC/CPE/CTR from juguang_data
7. WHEN the Chapter_Data_Loader is invoked for Chapter 8 (Audience Assets), THE Chapter_Data_Loader SHALL return AIPS population data and flow rates from lingxi_data where dataType='aips'
8. IF the Chapter_Data_Loader cannot find required data for a chapter, THEN THE Chapter_Data_Loader SHALL return a partial result with available data and a list of missing data fields
9. WHEN the Chapter_Data_Loader is invoked for Chapter 5 (Quadrant Analysis), THE Chapter_Data_Loader SHALL return per-note metrics including note-level CPE, CPM, CPC, CTR and corresponding juguang metrics for quadrant classification

### Requirement 4: Report Generation Pipeline Orchestration

**User Story:** As a developer, I want a pipeline that orchestrates the generation of all chapters sequentially, so that a complete report can be generated with a single API call.

#### Acceptance Criteria

1. WHEN the Pipeline receives a generation request with a projectId and reviewConfigId, THE Pipeline SHALL generate content for all 10 chapters in sequence from Chapter 1 to Chapter 10
2. WHEN generating a chapter, THE Pipeline SHALL invoke the Chapter_Data_Loader for that chapter, load the corresponding Prompt_Template, substitute data variables into the template, and call the LLM_Client with the assembled prompt
3. WHEN the LLM_Client returns generated content for a chapter, THE Pipeline SHALL store the content in a structured format with chapter number, title, and generated HTML/Markdown content
4. WHEN all chapters have been generated, THE Pipeline SHALL write the complete report content to `ReviewConfig.reportContent` as a JSON array of chapter objects
5. IF the LLM_Client fails or times out for a specific chapter, THEN THE Pipeline SHALL use a fallback text from the Prompt_Template metadata and continue generating subsequent chapters
6. WHEN the Pipeline completes, THE Pipeline SHALL also create a ReportVersion record with the full report content for version history
7. WHEN the Pipeline is invoked for a project that already has reportContent, THE Pipeline SHALL overwrite the existing content with the newly generated content
8. THE Pipeline SHALL expose an API endpoint at `POST /api/generate-report/[reviewConfigId]` that triggers the full generation flow

### Requirement 5: Chapter Content Generation via LLM

**User Story:** As a developer, I want each chapter's content generated by calling the LLM with chapter-specific data and prompts, so that the report contains contextually relevant AI-generated narratives.

#### Acceptance Criteria

1. WHEN generating Chapter 1 (Cover), THE Pipeline SHALL produce a structured object containing brand, projectName, subtitle ("小红书种草项目复盘"), and projectPeriod without calling the LLM
2. WHEN generating Chapters 2-9, THE Pipeline SHALL call the LLM_Client with the chapter's system prompt and the data-substituted user prompt
3. WHEN the LLM_Client returns content, THE Pipeline SHALL parse the response into structured sections (paragraphs, bullet points, or table data) based on the chapter's output_format specification
4. WHEN generating Chapter 3 (Data Overview), THE Pipeline SHALL include a KPI completion table with metric name, target value, actual value, and completion percentage for each KPI
5. WHEN generating Chapter 10 (End Page), THE Pipeline SHALL produce a fixed "THANKS" content with the project period without calling the LLM
6. WHILE generating content for any chapter, THE Pipeline SHALL enforce a 60-second timeout per LLM call
7. WHEN the LLM response exceeds 2000 characters for a single chapter, THE Pipeline SHALL truncate at the nearest paragraph boundary

### Requirement 6: Report Content Storage Format

**User Story:** As a developer, I want the generated report stored in a structured JSON format, so that the proofread page can render each chapter independently and support editing.

#### Acceptance Criteria

1. THE Pipeline SHALL store reportContent as a JSON array where each element has the shape `{ chapterNumber: number, title: string, content: string, status: 'generated' | 'edited' | 'error', generatedAt: string }`
2. WHEN the Proofread_Page loads reportContent, THE Proofread_Page SHALL render each chapter as a separate editable section in the TipTap_Editor
3. WHEN a chapter has status 'error', THE Proofread_Page SHALL display the error message and a "Regenerate" button for that chapter
4. THE Pipeline SHALL store chapter content as HTML-compatible Markdown that the TipTap_Editor can parse and render
5. WHEN reportContent is null or empty, THE Proofread_Page SHALL display a "Generate Report" button that triggers the Pipeline

### Requirement 7: AI Chat Content Modification

**User Story:** As a user, I want to use the AI Chat in the proofread page to modify generated chapter content, so that I can refine the report without manually rewriting text.

#### Acceptance Criteria

1. WHEN the user sends a message in the AI Chat panel while viewing a specific chapter, THE Proofread_Page SHALL include the current chapter title and content as context in the chat request
2. WHEN the AI Chat returns a content suggestion, THE Proofread_Page SHALL display an "Apply" button that replaces the current chapter content in the TipTap_Editor with the suggested content
3. WHEN the user applies an AI suggestion, THE Proofread_Page SHALL update the chapter's status to 'edited' and persist the change to ReviewConfig.reportContent via the PUT API
4. WHILE the AI Chat is streaming a response, THE Proofread_Page SHALL display the response incrementally in the chat panel
5. WHEN the user sends a modification request (e.g., "make it more concise", "add more data"), THE AI Chat SHALL generate a revised version of the chapter content that incorporates the requested change
6. IF the Presenton_Chat_API is unavailable, THEN THE Proofread_Page SHALL display an error message "AI 服务暂时不可用，请稍后重试" and disable the send button

### Requirement 8: Single Chapter Regeneration

**User Story:** As a user, I want to regenerate a single chapter without regenerating the entire report, so that I can quickly iterate on specific sections.

#### Acceptance Criteria

1. WHEN the user clicks "Regenerate" on a specific chapter in the Proofread_Page, THE Pipeline SHALL re-invoke the Chapter_Data_Loader and LLM generation for only that chapter
2. WHEN a single chapter is regenerated, THE Pipeline SHALL update only that chapter's entry in the reportContent array without affecting other chapters
3. WHEN a single chapter is regenerated, THE Pipeline SHALL update the chapter's generatedAt timestamp and reset its status to 'generated'
4. THE Proofread_Page SHALL display a loading indicator on the specific chapter being regenerated while the LLM call is in progress

