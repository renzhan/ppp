# Implementation Plan: Report Generation Pipeline

## Overview

本实现计划将复盘报告生成管线从设计转化为可执行的编码任务。按照 Prompt 模板 → 模板加载器 → 数据加载器 → 响应解析器 → 管线编排器 → API 路由 → 种子脚本 → 前端集成 → 测试 的顺序逐步构建，确保每一步都可独立验证。

## Tasks

- [x] 1. Create prompt template files for all 10 chapters
  - [x] 1.1 Create `src/prompts/chapters/chapter-01-cover.md` with YAML front-matter (chapter_number, chapter_name, required_data_sources, output_format: structured, fallback_text) and template body with `{{brand}}`, `{{project_name}}`, `{{start_date}}`, `{{end_date}}` variables
    - Cover chapter does not call LLM; template is used for metadata only
    - _Requirements: 2.1, 2.3, 2.4, 2.6, 5.1_
  - [x] 1.2 Create `src/prompts/chapters/chapter-02-project-review.md` with system_prompt for project review expert, variables for `{{project_objective}}`, `{{strategy}}`, `{{target_audience}}`, `{{core_message}}`, `{{launch_phases}}`
    - _Requirements: 2.1, 2.3, 2.4, 2.6, 3.2_
  - [x] 1.3 Create `src/prompts/chapters/chapter-03-data-overview.md` with system_prompt for data analysis expert, variables for aggregated metrics (`{{total_impressions}}`, `{{total_reads}}`, `{{total_engagement}}`, `{{total_cost}}`, `{{cpm}}`, `{{cpc}}`, `{{cpe}}`, `{{ctr}}`, `{{viral_count}}`, `{{viral_rate}}`, KPI completion variables)
    - _Requirements: 2.1, 2.3, 2.4, 2.6, 3.3, 5.4_
  - [x] 1.4 Create `src/prompts/chapters/chapter-04-highlights.md` with variables for KPI exceeded metrics, above-benchmark metrics, AIPS data, viral note details
    - _Requirements: 2.1, 2.3, 2.4, 2.6, 3.4_
  - [x] 1.5 Create `src/prompts/chapters/chapter-05-quadrant-analysis.md` with variables for per-note CPE, CPM, CPC, CTR and juguang metrics
    - _Requirements: 2.1, 2.3, 2.4, 2.6, 3.9_
  - [x] 1.6 Create `src/prompts/chapters/chapter-06-content-analysis.md` with variables for metrics grouped by contentDirection, noteType, kolType
    - _Requirements: 2.1, 2.3, 2.4, 2.6, 3.5_
  - [x] 1.7 Create `src/prompts/chapters/chapter-07-traffic-analysis.md` with variables for paid traffic metrics (totalFee, totalImpression, totalClick, totalInteraction, iUserNum, tiUserNum, derived CPM/CPC/CPE/CTR)
    - _Requirements: 2.1, 2.3, 2.4, 2.6, 3.6_
  - [x] 1.8 Create `src/prompts/chapters/chapter-08-audience-assets.md` with variables for AIPS population data and flow rates
    - _Requirements: 2.1, 2.3, 2.4, 2.6, 3.7_
  - [x] 1.9 Create `src/prompts/chapters/chapter-09-optimization-suggestions.md` with variables for underperforming metrics, content direction performance, traffic efficiency
    - _Requirements: 2.1, 2.3, 2.4, 2.6_
  - [x] 1.10 Create `src/prompts/chapters/chapter-10-end-page.md` with YAML front-matter (output_format: structured, fallback_text) and template body with `{{start_date}}`, `{{end_date}}`
    - End page does not call LLM; template is used for metadata only
    - _Requirements: 2.1, 2.3, 2.4, 2.6, 5.5_

- [x] 2. Create template loader with YAML front-matter parsing and variable substitution
  - [x] 2.1 Create `src/pipeline/template-loader.ts` implementing `PromptTemplateLoader` class with `loadTemplate(chapterNumber)`, `substituteVariables(template, variables)`, and `parseYAMLFrontMatter(content)` methods
    - Parse `---` delimited YAML front-matter to extract metadata (chapter_number, chapter_name, required_data_sources, output_format, system_prompt, fallback_text)
    - Substitute `{{variable_name}}` placeholders with data context values
    - Replace missing variables with empty string and log a warning
    - _Requirements: 2.2, 2.4, 2.5, 2.6_
  - [x] 2.2 Write property test for template variable substitution completeness
    - **Property 1: Template variable substitution completeness**
    - **Validates: Requirements 2.2, 2.5**
    - File: `tests/pipeline/template-substitution.property.test.ts`
  - [x] 2.3 Write property test for YAML front-matter round-trip parsing
    - **Property 2: YAML front-matter round-trip parsing**
    - **Validates: Requirements 2.4**
    - File: `tests/pipeline/frontmatter-parsing.property.test.ts`

- [x] 3. Create chapter data loaders
  - [x] 3.1 Create `src/pipeline/loaders/types.ts` defining `ChapterDataContext`, `ChapterDataLoader` interface, and `ChapterDataLoaderRegistry` class
    - Registry maps chapter numbers to loader instances
    - _Requirements: 3.8_
  - [x] 3.2 Create `src/pipeline/loaders/chapter-01-cover.ts` — loads project category, brand, businessLine, projectName, startDate, endDate
    - _Requirements: 3.1_
  - [x] 3.3 Create `src/pipeline/loaders/chapter-02-project-review.ts` — loads plan_parse from ai_generated_content and launchPhases from review_configs
    - _Requirements: 3.2_
  - [x] 3.4 Create `src/pipeline/loaders/chapter-03-data-overview.ts` — loads aggregated metrics (totalImpressions, totalReads, totalEngagement, totalCost, viralCount, viralRate, cpm, cpc, cpe, ctr) and KPI completion rates from notes, juguang_data, kpi_targets
    - _Requirements: 3.3_
  - [x] 3.5 Create `src/pipeline/loaders/chapter-04-highlights.ts` — loads KPI exceeded metrics, above-benchmark metrics, AIPS data, viral note details
    - _Requirements: 3.4_
  - [x] 3.6 Create `src/pipeline/loaders/chapter-05-quadrant-analysis.ts` — loads per-note CPE, CPM, CPC, CTR and juguang metrics for quadrant classification
    - _Requirements: 3.9_
  - [x] 3.7 Create `src/pipeline/loaders/chapter-06-content-analysis.ts` — loads metrics grouped by contentDirection, noteType, kolType from notes joined with business_annotations
    - _Requirements: 3.5_
  - [x] 3.8 Create `src/pipeline/loaders/chapter-07-traffic-analysis.ts` — loads paid traffic metrics (totalFee, totalImpression, totalClick, totalInteraction, iUserNum, tiUserNum, derived CPM/CPC/CPE/CTR) from juguang_data
    - _Requirements: 3.6_
  - [x] 3.9 Create `src/pipeline/loaders/chapter-08-audience-assets.ts` — loads AIPS population data and flow rates from lingxi_data where dataType='aips'
    - _Requirements: 3.7_
  - [x] 3.10 Create `src/pipeline/loaders/chapter-09-optimization.ts` and `src/pipeline/loaders/chapter-10-end-page.ts` — optimization loads underperforming data; end page loads project dates
    - _Requirements: 3.1_
  - [x] 3.11 Create `src/pipeline/loaders/index.ts` that registers all 10 loaders into the `ChapterDataLoaderRegistry`
    - _Requirements: 3.8_
  - [x] 3.12 Write property test for data loader graceful degradation
    - **Property 3: Data loader graceful degradation**
    - **Validates: Requirements 3.8**
    - File: `tests/pipeline/data-loader-degradation.property.test.ts`

- [x] 4. Create response parser
  - [x] 4.1 Create `src/pipeline/response-parser.ts` implementing `parseResponse(rawText, outputFormat)` and `truncateAtParagraphBoundary(content, maxLength)` functions
    - Parse LLM response into HTML-compatible Markdown based on output_format (paragraphs, bullets, table, structured)
    - Truncate at nearest `\n\n` paragraph boundary when content exceeds 2000 characters
    - _Requirements: 5.3, 5.7_
  - [x] 4.2 Write property test for LLM response parsing preserves content structure
    - **Property 5: LLM response parsing preserves content structure**
    - **Validates: Requirements 5.3**
    - File: `tests/pipeline/response-parsing.property.test.ts`
  - [x] 4.3 Write property test for content truncation at paragraph boundary
    - **Property 6: Content truncation at paragraph boundary**
    - **Validates: Requirements 5.7**
    - File: `tests/pipeline/truncation.property.test.ts`

- [x] 5. Create pipeline orchestrator
  - [x] 5.1 Create `src/pipeline/orchestrator.ts` implementing `ReportPipelineOrchestrator` class with `generateFullReport(config)` and `regenerateChapter(config, chapterNumber, existingContent)` methods
    - Iterate chapters 1-10 sequentially: load data → load template → substitute variables → call LLM (or build static for ch1/ch10) → parse response → store result
    - Enforce 60s timeout per LLM call; use fallback_text on failure
    - Write complete report to `ReviewConfig.reportContent` as JSON array of ChapterResult objects
    - Create `ReportVersion` record with full content
    - For single chapter regeneration: update only the target chapter in the existing array
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 5.1, 5.2, 5.5, 5.6, 6.1, 8.1, 8.2, 8.3_
  - [x] 5.2 Write property test for pipeline resilience on LLM failure
    - **Property 4: Pipeline resilience on LLM failure**
    - **Validates: Requirements 4.5**
    - File: `tests/pipeline/pipeline-resilience.property.test.ts`
  - [x] 5.3 Write property test for report content structural invariant
    - **Property 7: Report content structural invariant**
    - **Validates: Requirements 4.3, 6.1**
    - File: `tests/pipeline/report-structure.property.test.ts`
  - [x] 5.4 Write property test for single chapter regeneration isolation
    - **Property 8: Single chapter regeneration isolation**
    - **Validates: Requirements 8.1, 8.2, 8.3**
    - File: `tests/pipeline/regeneration-isolation.property.test.ts`

- [x] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Create API route handlers
  - [x] 7.1 Create `web/src/app/api/generate-report/[reviewConfigId]/route.ts` — POST handler that triggers full report generation via the orchestrator
    - Validate reviewConfigId exists, resolve projectId, invoke `generateFullReport`, return `{ success, versionId }`
    - Return 404 if ReviewConfig or Project not found
    - _Requirements: 4.8_
  - [x] 7.2 Create `web/src/app/api/generate-report/[reviewConfigId]/chapter/[chapterNumber]/route.ts` — POST handler that triggers single chapter regeneration
    - Load existing reportContent, invoke `regenerateChapter`, update reportContent in DB, return updated chapter
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 8. Create seed script
  - [x] 8.1 Create `prisma/seeds/report-pipeline-seed.ts` implementing idempotent seed script that creates: Project, 30+ Notes with varied metrics, JuguangData for 60% of notes, BusinessAnnotation for all notes, KpiTarget records, ReviewConfig, AiGeneratedContent (plan_parse), LingxiData (aips)
    - Check for existing data before creating duplicates (idempotent)
    - Log summary of created records with counts per table
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10_
  - [x] 8.2 Write property test for seed script idempotence
    - **Property 9: Seed script idempotence**
    - **Validates: Requirements 1.9**
    - File: `tests/pipeline/seed-idempotence.property.test.ts`

- [x] 9. Update proofread page for report rendering and generation
  - [x] 9.1 Update the proofread page component to display a "生成报告" button when `reportContent` is null or empty, triggering POST to `/api/generate-report/[reviewConfigId]`
    - Show loading state during generation
    - _Requirements: 6.5_
  - [x] 9.2 Render each chapter from `reportContent` as a separate editable section in the TipTap editor, with chapter title and content
    - Display "重新生成" button on chapters with `status: 'error'`
    - Trigger single chapter regeneration via POST to `/api/generate-report/[reviewConfigId]/chapter/[chapterNumber]`
    - Show loading indicator on the specific chapter being regenerated
    - _Requirements: 6.2, 6.3, 6.4, 8.4_
  - [x] 9.3 Integrate AI Chat panel to pass current chapter title and content as context, display "Apply" button for suggestions, update chapter status to 'edited' on apply, and persist changes via PUT API
    - Handle Presenton Chat API unavailability with error message "AI 服务暂时不可用，请稍后重试"
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

- [x] 10. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Write integration tests
  - [x] 11.1 Write integration test for full pipeline end-to-end with mocked LLM
    - File: `tests/pipeline/full-pipeline.integration.test.ts`
    - Verify all 10 chapters generated, reportContent written, ReportVersion created
    - _Requirements: 4.1, 4.4, 4.6_
  - [x] 11.2 Write integration test for chapter data loaders querying correct tables
    - File: `tests/pipeline/data-loaders.integration.test.ts`
    - Verify each loader returns expected data shape from seeded database
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.9_
  - [x] 11.3 Write integration test for ReviewConfig.reportContent storage
    - File: `tests/pipeline/storage.integration.test.ts`
    - Verify JSON structure matches ChapterResult[] schema
    - _Requirements: 6.1_
  - [x] 11.4 Write integration test for AI Chat context passing
    - File: `tests/pipeline/chat-context.integration.test.ts`
    - Verify chapter title and content included in chat request
    - _Requirements: 7.1_

- [x] 12. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The project uses `vitest` for testing and `fast-check` for property-based tests
- All code is TypeScript; the existing `src/report/llm-client.ts` is reused for LLM calls
