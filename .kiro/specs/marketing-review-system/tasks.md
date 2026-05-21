# Implementation Plan: Marketing Review System (营销项目复盘系统)

## Overview

本实现计划将设计文档中的分层架构转化为可执行的编码任务。采用自底向上的实现策略：项目基础设施 → 数据库层 → 数据采集层 → 计算引擎（纯函数）→ 报告生成层 → 集成联调。每个任务增量构建，确保无孤立代码。

## Tasks

- [x] 1. Set up project structure and core configuration
  - [x] 1.1 Initialize TypeScript project with dependencies
    - Initialize npm project with TypeScript, Prisma, Vitest, fast-check, OpenAI SDK, xlsx (for spreadsheet parsing)
    - Configure `tsconfig.json` with strict mode, ES2022 target, path aliases
    - Configure `vitest.config.ts` with test setup for database transaction rollback
    - Create `.env.example` with all required environment variables (DATABASE_URL, LLM_BASE_URL, LLM_API_KEY, LLM_MODEL, PAICHACHA_API_KEY, PAICHACHA_BASE_URL)
    - Create project directory structure: `src/ingestion/`, `src/calculation/`, `src/report/`, `src/config/`, `src/shared/`, `tests/`
    - _Requirements: 1.1, 2.1_

  - [x] 1.2 Create shared TypeScript interfaces and types
    - Define all interfaces from design: `Project`, `PugongyingNote`, `JuguangNote`, `NoteMetrics`, `BusinessAnnotation`, `LingxiData`, `EngagementConfig`, `CooperationPolicy`, `CostCalculationInput`, `ProjectCost`, `PaidTrafficMetrics`, `KPIResult`, `NaturalExposureResult`, `BenchmarkResult`, `Highlight`, `KOLTier`, `ComponentData`, `ComponentMetrics`
    - Define enums: `KOLTier`, `ReportModuleOrder`, `ExportFormat`
    - Place in `src/shared/types.ts`
    - _Requirements: 1.1, 4.5, 7.1_

  - [x] 1.3 Create configuration module
    - Implement `src/config/env.ts` to load and validate environment variables using dotenv
    - Implement `src/config/defaults.ts` for default engagement config and cooperation policy
    - Export typed `EnvConfig` object with runtime validation (throw on missing required vars)
    - _Requirements: 17.1, 17.2_

- [x] 2. Database schema and Prisma setup
  - [x] 2.1 Create Prisma schema and run migrations
    - Initialize Prisma with PostgreSQL provider pointing to Supabase
    - Define all 9 tables from design: `projects`, `notes`, `juguang_data`, `business_annotations`, `lingxi_data`, `manual_inputs`, `kpi_targets`, `calculated_metrics`, `ai_generated_content`, `competitor_data`
    - Add all indexes from design document
    - Add unique constraints: `(project_id, note_id)` on notes and business_annotations, `(project_id, metric_name)` on kpi_targets
    - Generate Prisma client and run migration against Supabase
    - _Requirements: 1.1, 2.1, 2.2_

  - [x] 2.2 Create database utility helpers
    - Implement `src/shared/db.ts` with Prisma client singleton
    - Implement test helper `tests/helpers/db-transaction.ts` for wrapping tests in transactions with rollback
    - Verify connection to Supabase PostgreSQL
    - _Requirements: 1.1_

- [x] 3. Checkpoint - Verify project setup
  - Ensure TypeScript compiles without errors, Prisma client generates successfully, database connection works. Ask the user if questions arise.

- [x] 4. Data ingestion layer
  - [x] 4.1 Implement currency conversion utility
    - Implement `normalizeAmount(amountInFen: number): number` in `src/ingestion/currency.ts`
    - Validate input is a non-negative integer, throw on invalid input
    - Convert fen to yuan by dividing by 100, round to exactly 2 decimal places
    - _Requirements: 2.3, 18.1_

  - [ ]* 4.2 Write property test for currency conversion (Property 1)
    - **Property 1: Currency Conversion Correctness**
    - Generate random non-negative integers, verify `normalizeAmount(x) === x / 100` rounded to 2 decimals
    - Generate non-integer inputs, verify validation rejects them
    - **Validates: Requirements 2.3, 18.1**

  - [x] 4.3 Implement Paichacha API client
    - Implement `src/ingestion/paichacha-client.ts` with `PaichachaClient` interface
    - `fetchPugongyingData(noteIds: string[])`: call real Paichacha API, apply `normalizeAmount` to kol_price and total_platform_price before returning
    - `fetchJuguangData(noteIds: string[])`: call real Paichacha API, apply `normalizeAmount` to fee fields before returning
    - Implement retry logic (max 3 retries, exponential backoff) for API failures
    - Implement response validation (reject malformed data)
    - _Requirements: 2.1, 2.2, 2.3, 2.7, 18.1_

  - [x] 4.4 Implement spreadsheet parser
    - Implement `src/ingestion/spreadsheet-parser.ts` with `SpreadsheetParser` interface
    - `parseLingxiSheet(file: Buffer, format: 'xlsx' | 'csv')`: parse Lingxi platform data (AIPS, brand ranking, SOC/SOV, SPU ranking) from structured spreadsheet
    - `parseAnnotationSheet(file: Buffer, format: 'xlsx' | 'csv')`: parse business annotations (content direction, account type, KOL type, launch phase, underwater mark)
    - Implement field validation with detailed error messages (row/column location)
    - Support partial import when non-critical fields are missing
    - _Requirements: 2.5, 2.6_

  - [x] 4.5 Implement data persistence service
    - Implement `src/ingestion/persistence-service.ts` with `DataPersistenceService` interface
    - `savePugongyingNotes(projectId, notes)`: upsert notes to PostgreSQL
    - `saveJuguangData(projectId, data)`: insert juguang records
    - `saveLingxiData(projectId, data)`: insert lingxi records with data_type classification
    - `saveAnnotations(projectId, annotations)`: upsert business annotations
    - `saveManualInput(projectId, input)`: insert manual input records (benchmark, KPI targets, brand search index, topic exposure)
    - All operations use Prisma transactions for atomicity
    - _Requirements: 2.1, 2.2, 2.4, 2.5, 2.6_

  - [ ]* 4.6 Write property test for spreadsheet data round-trip (Property 15)
    - **Property 15: Spreadsheet Data Upload Round-Trip**
    - Generate random valid LingxiData and BusinessAnnotation arrays
    - Parse → persist → read back from DB → verify equivalence
    - Uses real PostgreSQL with transaction rollback
    - **Validates: Requirements 2.5, 2.6**

- [x] 5. Checkpoint - Verify data ingestion
  - Ensure data ingestion compiles, currency conversion tests pass, persistence service can write/read from Supabase. Ask the user if questions arise.

- [x] 6. Calculation engine - Cost and core metrics
  - [x] 6.1 Implement project total cost calculation
    - Implement `calculateProjectTotalCost(params: CostCalculationInput): ProjectCost` in `src/calculation/cost.ts`
    - Apply cooperation policy: use special discount for KOL if exists, otherwise default discount
    - Sum above-water costs with discounts, underwater costs without discounts, juguang fees
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ]* 6.2 Write property test for project total cost (Property 2)
    - **Property 2: Project Total Cost Calculation**
    - Generate random fee structures, cooperation policies, verify formula correctness
    - Verify underwater prices never have discounts applied
    - Verify special rules override default discount
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 1.3**

  - [x] 6.3 Implement core metrics calculations (CPE, CPM, CPC, CTR)
    - Implement in `src/calculation/metrics.ts`:
    - `calculateCPE(totalCost, totalEngagement)`: cost / engagement, return 'N/A' if denominator is 0
    - `calculateCPM(totalCost, totalImpressions)`: cost / impressions × 1000, return 'N/A' if denominator is 0
    - `calculateCPC(totalCost, totalReads)`: cost / reads, return 'N/A' if denominator is 0
    - `calculateCTR(totalReads, totalImpressions)`: reads / impressions, return 'N/A' if denominator is 0
    - `calculatePaidTrafficMetrics(juguangData)`: compute all paid traffic metrics with same zero-division handling
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.6, 8.2, 18.2_

  - [ ]* 6.4 Write property test for cost metrics formulas (Property 3)
    - **Property 3: Cost Metrics Formula Correctness**
    - Generate random positive costs and metric totals, verify formula outputs
    - Generate zero denominators, verify 'N/A' returned
    - Test both organic and paid traffic metric formulas
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.6, 8.2, 18.2**

  - [x] 6.5 Implement configurable engagement calculation
    - Implement `calculateEngagement(note: NoteMetrics, config: EngagementConfig): number` in `src/calculation/engagement.ts`
    - Sum: likeNum + favNum + cmtNum + (shareNum if includeShare) + (followNum if includeFollow)
    - _Requirements: 4.5, 17.1, 17.2, 17.3_

  - [ ]* 6.6 Write property test for configurable engagement (Property 4)
    - **Property 4: Configurable Engagement Calculation**
    - Generate random note metrics and all 4 config combinations
    - Verify sum matches expected formula for each config
    - **Validates: Requirements 4.5, 17.1, 17.2, 17.3**

- [x] 7. Calculation engine - Viral, KPI, KOL tier
  - [x] 7.1 Implement viral note detection
    - Implement in `src/calculation/viral.ts`:
    - `isViralNote(note: NoteMetrics): boolean`: true if likeNum + favNum + cmtNum >= 1000
    - `calculateViralRate(notes: NoteMetrics[])`: return { viralCount, viralRate }
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [ ]* 7.2 Write property test for viral note detection (Property 5)
    - **Property 5: Viral Note Detection Independence**
    - Generate random notes, verify threshold is exactly 1000 (like+fav+cmt)
    - Verify result is independent of engagement config (share/follow don't affect it)
    - Verify viral rate = viralCount / totalCount
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 17.4**

  - [x] 7.3 Implement KPI completion rate
    - Implement `calculateKPICompletion(actual, target, isReversed): KPIResult` in `src/calculation/kpi.ts`
    - Non-cost metrics: actual / target
    - Cost metrics (isReversed=true): target / actual
    - Return null with "未设定目标" when target is 0 or unset
    - _Requirements: 6.1, 6.3, 6.4_

  - [ ]* 7.4 Write property test for KPI completion rate (Property 6)
    - **Property 6: KPI Completion Rate with Cost Reversal**
    - Generate random actual/target values, verify forward and reverse calculations
    - Generate zero targets, verify null result
    - **Validates: Requirements 6.1, 6.3, 6.4**

  - [x] 7.5 Implement KOL tier classification
    - Implement in `src/calculation/kol-tier.ts`:
    - `classifyKOLTier(fanCount: number): KOLTier`: classify based on fan count boundaries
    - `aggregateByKOLTier(notes: NoteWithKOL[])`: group notes by tier, compute per-tier metrics
    - _Requirements: 7.1, 7.2_

  - [ ]* 7.6 Write property test for KOL tier classification (Property 7)
    - **Property 7: KOL Tier Classification**
    - Generate random fan counts, verify correct tier assignment at boundaries
    - Generate note sets, verify aggregation sums match individual notes
    - **Validates: Requirements 7.1, 7.2**

- [x] 8. Calculation engine - Traffic, content, highlights
  - [x] 8.1 Implement natural exposure calculation
    - Implement `calculateNaturalExposure(pugongyingImpressions, juguangImpressions): NaturalExposureResult` in `src/calculation/traffic.ts`
    - Return max(0, pugongying - juguang) as value
    - Set isAnomalous = true when raw difference is negative
    - _Requirements: 8.1, 18.4_

  - [ ]* 8.2 Write property test for natural exposure (Property 8)
    - **Property 8: Natural Exposure with Boundary Handling**
    - Generate random impression pairs, verify max(0, diff) and anomaly flag
    - **Validates: Requirements 8.1, 18.4**

  - [x] 8.3 Implement content analysis aggregation
    - Implement `aggregateByDimension(notes: AnnotatedNote[], dimension: string): DimensionAggregation[]` in `src/calculation/content.ts`
    - Group notes by specified dimension (note type, content direction, account type, KOL type, launch phase)
    - Compute per-group: total impressions, reads, engagement, CPE, viral rate
    - Sort groups by specified metric descending
    - _Requirements: 9.1, 9.2, 9.3_

  - [ ]* 8.4 Write property test for content analysis aggregation (Property 9)
    - **Property 9: Content Analysis Aggregation**
    - Generate random annotated note sets, verify group sums equal individual sums
    - Verify sorting order is correct
    - **Validates: Requirements 9.1, 9.2, 9.3**

  - [x] 8.5 Implement benchmark comparison
    - Implement `calculateBenchmarkComparison(actual, benchmark, isCostMetric): BenchmarkResult` in `src/calculation/benchmark.ts`
    - Non-cost: (actual - benchmark) / benchmark × 100
    - Cost: (benchmark - actual) / benchmark × 100
    - Label "优于大盘" when positive, "劣于大盘" when negative
    - _Requirements: 13.3, 13.4_

  - [ ]* 8.6 Write property test for benchmark comparison (Property 10)
    - **Property 10: Benchmark Comparison and Labeling**
    - Generate random actual/benchmark pairs, verify percentage calculation and labeling
    - Test both cost and non-cost metrics
    - **Validates: Requirements 13.3, 13.4**

  - [x] 8.7 Implement highlight identification
    - Implement `identifyHighlights(metrics, benchmarks, kpiTargets): Highlight[]` in `src/calculation/highlights.ts`
    - Include highlight for: KPI completion > 100%, better than benchmark, post > pre
    - No false positives (metric not meeting criteria must not be included)
    - No false negatives (metric meeting criteria must be included)
    - _Requirements: 14.1_

  - [ ]* 8.8 Write property test for highlight identification (Property 11)
    - **Property 11: Highlight Identification Completeness**
    - Generate random metrics/benchmarks/KPI targets
    - Verify all qualifying metrics are included, no non-qualifying metrics included
    - **Validates: Requirements 14.1**

  - [x] 8.9 Implement component conversion rate calculation
    - Implement `calculateComponentConversion(components: ComponentData[]): ComponentMetrics[]` in `src/calculation/components.ts`
    - Calculate click_rate = clicks / impressions, conversion_rate = conversions / clicks
    - Return 'N/A' when denominator is zero
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

  - [ ]* 8.10 Write property test for component conversion (Property 16)
    - **Property 16: Component Conversion Rate Calculation**
    - Generate random component data, verify rate calculations
    - Generate zero denominators, verify 'N/A'
    - **Validates: Requirements 12.1, 12.2, 12.3, 12.4**

- [x] 9. Checkpoint - Verify calculation engine
  - Ensure all calculation functions compile, all property tests pass for pure functions. Ask the user if questions arise.

- [x] 10. Validation and required field checking
  - [x] 10.1 Implement project input validation
    - Implement `validateProjectInput(input: Partial<Project>): ValidationResult` in `src/shared/validation.ts`
    - Reject if any required field is missing or empty: 品类(category), 合作品牌(brand), 项目名称(projectName), 项目周期(startDate, endDate)
    - All other fields are optional
    - _Requirements: 1.2_

  - [ ]* 10.2 Write property test for required field validation (Property 14)
    - **Property 14: Required Field Validation**
    - Generate random inputs with various missing/present field combinations
    - Verify rejection iff required fields are missing
    - **Validates: Requirements 1.2**

- [x] 11. Report generator
  - [x] 11.1 Implement LLM client
    - Implement `src/report/llm-client.ts` with `LLMClient` interface
    - Use OpenAI SDK configured with custom baseURL (`https://aiop-gateway.item.com/proxy/openai/v1`) and model (`gpt-5.1`)
    - Implement `chat(messages, options)`: call real gpt-5.1 via gateway
    - Implement retry (1 retry on failure), 30-second timeout, fallback to template text on failure
    - _Requirements: 15.1, 15.3_

  - [x] 11.2 Implement report assembler
    - Implement `src/report/assembler.ts` with `assembleReport(projectId): Promise<Report>`
    - Read all project data from PostgreSQL via Prisma
    - Assemble modules in exact order: customer_info → project_review → data_overview → highlights → content_analysis → brand_voice → audience_assets → paid_traffic → conversion_analysis → competitor_benchmark → highlight_summary → optimization_suggestions
    - For any null/undefined data field, output "数据待补充" placeholder
    - _Requirements: 16.1, 16.2, 16.3_

  - [ ]* 11.3 Write property test for report module ordering (Property 12)
    - **Property 12: Report Module Ordering**
    - Generate random project data, verify assembled report has modules in correct order
    - **Validates: Requirements 16.1**

  - [ ]* 11.4 Write property test for missing data placeholder (Property 13)
    - **Property 13: Missing Data Placeholder**
    - Generate data with random null fields, verify "数据待补充" appears for each
    - **Validates: Requirements 16.3**

  - [x] 11.5 Implement AI-powered plan parsing and optimization suggestions
    - Implement `parsePlanDocument(document: Buffer): Promise<ProjectBackground>` using real LLM
    - Implement `generateOptimizationSuggestions(metrics, highlights): Promise<string>` using real LLM
    - Implement `saveEditedSuggestions(projectId, content)`: save human-edited version to `ai_generated_content` table
    - Implement fallback template when LLM fails
    - _Requirements: 15.1, 15.3, 15.4_

  - [x] 11.6 Implement report exporter
    - Implement `exportReport(report: Report, format: ExportFormat): Promise<Buffer>` in `src/report/exporter.ts`
    - Support at least one export format (e.g., JSON structured output)
    - _Requirements: 16.4_

- [x] 12. Checkpoint - Verify report generator
  - Ensure report generator compiles, LLM client connects to gateway, assembler produces correct module order. Ask the user if questions arise.

- [x] 13. Integration wiring and end-to-end flow
  - [x] 13.1 Wire data ingestion pipeline
    - Create `src/ingestion/index.ts` orchestrating: API fetch → currency conversion → normalization → persistence
    - Create `src/ingestion/spreadsheet-upload.ts` orchestrating: file parse → validation → persistence
    - Expose unified ingestion interface for both API and spreadsheet paths
    - _Requirements: 2.1, 2.2, 2.3, 2.5, 2.6_

  - [x] 13.2 Wire calculation pipeline
    - Create `src/calculation/index.ts` orchestrating: read from DB → run all calculations → write results to `calculated_metrics` table
    - Implement recalculation trigger when engagement config changes
    - _Requirements: 3.1, 4.1, 5.1, 6.1, 7.1, 8.1, 9.1, 17.3_

  - [x] 13.3 Wire report generation pipeline
    - Create `src/report/index.ts` orchestrating: read calculated metrics → assemble report → AI suggestions → export
    - Connect all layers: ingestion → calculation → report
    - _Requirements: 14.1, 15.3, 16.1_

  - [ ]* 13.4 Write integration tests for end-to-end flow
    - Test full pipeline: create project → ingest data → calculate metrics → generate report
    - Use real PostgreSQL with transaction rollback
    - Verify report structure and data integrity
    - _Requirements: 1.1, 2.1, 3.1, 4.1, 16.1_

- [x] 14. Final checkpoint - Ensure all tests pass
  - Ensure all property tests pass, all unit tests pass, integration tests pass against real Supabase PostgreSQL. Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- All monetary values from API are in 分 (fen) and MUST be converted to 元 (yuan) before storage
- Property tests target pure calculation functions only (no DB dependency needed)
- Integration tests use real Supabase PostgreSQL with transaction rollback for isolation
- LLM calls use real gpt-5.1 via custom gateway - no mocks
- No OCR module - Lingxi and annotation data come from structured spreadsheet uploads (底表上传)
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation throughout implementation
