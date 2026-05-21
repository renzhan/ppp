# Implementation Plan: Frontend & Engines

## Overview

This plan implements the three intelligent engines (Rating, Decision, Narrative), extends the database schema, sets up the YAML prompt template system, creates the Next.js frontend application, and wires everything together. Tasks are ordered bottom-up: pure engine functions first (independently testable), then database extensions, then prompt templates, then frontend infrastructure, then pages and API routes, and finally integration.

## Tasks

- [ ] 1. Implement Rating Engine (pure functions)
  - [x] 1.1 Create engine shared types and constants
    - Create `src/engines/types.ts` with Rating, ProjectType, ToneIntensity, ModuleStatus, ModuleId types
    - Define RATING_THRESHOLDS, MODULE_NAMES constants
    - Export all shared types used across engines
    - _Requirements: 4.1, 4.2_

  - [x] 1.2 Implement ratioToRating threshold mapping
    - Create `src/engines/rating.ts`
    - Implement `ratioToRating(ratio: number): Rating` with thresholds S≥1.5, A≥1.2, B≥1.0, C≥0.8, D<0.8
    - Handle edge cases: ratio=0, negative values, extremely large values
    - _Requirements: 4.3, 4.4, 4.5, 4.6, 4.7_

  - [x] 1.3 Implement cost metric ratio inversion logic
    - Implement ratio calculation: for cost metrics use target/actual or benchmark/actual
    - For non-cost metrics use actual/target or actual/benchmark
    - Handle division by zero (actual=0) by returning null dimension
    - _Requirements: 4.12, 18.1, 18.2, 18.3, 18.4_

  - [x] 1.4 Implement rateMetric and rateAllMetrics functions
    - Implement `rateMetric(input: RatingInput): MetricRating` computing all 3 dimensions
    - Implement `rateAllMetrics(inputs: RatingInput[]): MetricRating[]` for batch processing
    - Final rating = best (highest) of non-null dimension ratings
    - Handle missing comparison values (null dimensions)
    - _Requirements: 4.1, 4.8, 4.9, 4.10, 4.11_

  - [ ]* 1.5 Write property tests for Rating Engine (Properties 1-4)
    - **Property 1: Ratio-to-Rating Threshold Mapping** — generate random ratios, verify correct rating
    - **Property 2: Cost Metric Ratio Inversion** — generate random cost/non-cost metrics, verify ratio direction
    - **Property 3: Final Rating is Best of Available Dimensions** — generate random dimension combos, verify final=max
    - **Property 4: Missing Dimension Yields Null Rating** — generate random missing dimensions, verify null handling
    - Create `tests/engines/rating.property.test.ts` using fast-check with min 100 iterations
    - **Validates: Requirements 4.3-4.12, 18.1-18.4**

  - [ ]* 1.6 Write unit tests for Rating Engine
    - Create `tests/engines/rating.test.ts`
    - Test boundary values: ratio exactly at thresholds (0.8, 1.0, 1.2, 1.5)
    - Test extreme values: ratio=0, very large ratio
    - Test all dimensions missing → default finalRating='C'
    - Test cost metric list correctness (CPE, CPM, CPC)
    - _Requirements: 4.3-4.12_

- [ ] 2. Implement Decision Engine (pure functions)
  - [x] 2.1 Implement module visibility decision rules
    - Create `src/engines/decision.ts`
    - M1 always 'show'
    - M3 'show' iff count(metrics with rating S or A) >= 2
    - M6 'show' iff at least one competitor metric has rating S or A
    - M7 'show' iff juguangCost / totalCost > 0.2
    - Implement remaining module rules (M2, M4, M5, M8)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9_

  - [x] 2.2 Implement module degradation logic
    - For each module, define required data fields
    - If all required fields present → 'show'; partial → 'degraded' with degradedFields list; none → 'hide'
    - _Requirements: 5.10_

  - [x] 2.3 Implement platform data show/hide rules
    - Pugongying: show iff viralRate ∈ {S,A} AND cpe ∈ {S,A,B}
    - Juguang: show iff searchRate ∈ {S,A} AND ctr ∈ {S,A,B} AND cpeBenchmark=true
    - Qiangua: show iff brandRank <= 10
    - Lingxi: show iff searchGrowth ∈ {S,A} AND audienceGrowth ∈ {S,A,B} AND cptiBenchmark=true
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [x] 2.4 Implement decideModules and decidePlatforms orchestrator functions
    - Wire module rules + degradation + platform rules into `decideModules()` and `decidePlatforms()`
    - Return ModuleDecision[] and PlatformDecision[] with reasons
    - _Requirements: 5.1-5.11_

  - [ ]* 2.5 Write property tests for Decision Engine (Properties 5-8)
    - **Property 5: M1 Data Overview Always Shown** — generate random inputs, verify M1 always 'show'
    - **Property 6: Module Visibility Decision Rules** — generate random ratings, verify M3/M6/M7 rules
    - **Property 7: Module Degradation on Partial Data** — generate random data completeness, verify degradation
    - **Property 8: Platform Data Show/Hide Rules** — generate random platform ratings, verify show/hide
    - Create `tests/engines/decision.property.test.ts` using fast-check
    - **Validates: Requirements 5.2-5.10, 11.1-11.4**

  - [ ]* 2.6 Write unit tests for Decision Engine
    - Create `tests/engines/decision.test.ts`
    - Test exactly 2 S/A ratings → M3 show; exactly 1 → M3 hide
    - Test juguangCost/totalCost exactly 0.2 boundary
    - Test totalCost=0 → M7 hide
    - Test empty ratings list → conservative defaults
    - _Requirements: 5.2-5.11_

- [ ] 3. Implement Narrative Engine (LLM-dependent thin layer)
  - [x] 3.1 Implement YAML prompt template loader
    - Create `src/engines/narrative.ts`
    - Implement `loadTemplate(projectType, moduleId, tone): PromptTemplate`
    - Parse YAML files from `prompts/` directory
    - Validate template structure (name, version, prompt, variables, fallbackText)
    - Throw descriptive error for missing/invalid templates
    - _Requirements: 17.1, 17.2, 17.3, 17.4_

  - [x] 3.2 Implement tone selection and attribution strategy mapping
    - Rating S/A → 'positive'; B → 'standard'; C/D → 'conservative'
    - Map project types to attribution strategies:
      - 新品上市 → 市场突破 + 用户认知建立
      - 日常种草 → 持续渗透 + 口碑积累
      - 节点营销 → 节点爆发 + 流量转化
      - 竞品防御 → 份额保卫 + 差异化优势
    - _Requirements: 6.3, 6.4, 6.5, 6.6, 12.1, 12.2, 12.3, 12.4_

  - [x] 3.3 Implement generateNarrative and regenerateParagraph
    - Implement variable substitution in prompt templates
    - Call LLM client with assembled prompt
    - Handle LLM failure: fallback to template's fallbackText
    - Handle LLM timeout (30s): fallback to fallbackText
    - Implement `regenerateParagraph` for single paragraph re-generation with new tone
    - _Requirements: 6.1, 6.2, 6.7, 6.8, 6.10_

  - [x] 3.4 Implement problem-to-opportunity transformation
    - Implement `transformProblemToOpportunity()` for C/D rated metrics
    - Set `isTransformed=true` flag on transformed paragraphs
    - Use LLM to reframe negative data as improvement direction
    - _Requirements: 6.5, 6.9, 9.7_

  - [x] 3.5 Implement AI chat function for review platform
    - Implement `chat()` for attribution analysis, data queries, optimization suggestions
    - Accept message history and project context
    - Return LLM-generated response
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [ ]* 3.6 Write property tests for Narrative Engine (Properties 9-11)
    - **Property 9: Rating-to-Tone Mapping** — generate random ratings, verify tone selection and isTransformed flag
    - **Property 10: Project Type to Attribution Strategy Mapping** — generate random project types, verify strategy sets
    - **Property 11: YAML Template Lookup Correctness** — iterate valid combos, verify template fields
    - Create `tests/engines/narrative.property.test.ts` using fast-check
    - **Validates: Requirements 6.3-6.5, 6.9, 12.1-12.4, 17.2-17.3**

  - [ ]* 3.7 Write unit tests for Narrative Engine
    - Create `tests/engines/narrative.test.ts`
    - Test YAML template loading and variable substitution
    - Test LLM failure fallback behavior
    - Test problem-to-opportunity output format
    - _Requirements: 6.1-6.10, 17.1-17.5_

- [ ] 4. Implement filtering and pagination utilities
  - [x] 4.1 Create project filtering and pagination functions
    - Create `src/engines/filtering.ts`
    - Implement `filterProjects(projects, filters)` — filter by brand, category, projectType, status
    - Implement `paginateItems(items, page, pageSize)` — return correct slice and total pages
    - _Requirements: 1.2, 1.5_

  - [ ]* 4.2 Write property tests for filtering and pagination (Properties 12-13)
    - **Property 12: Project List Filtering Correctness** — generate random projects and filters, verify inclusion/exclusion
    - **Property 13: Pagination Slice Correctness** — generate random list lengths and page params, verify slice bounds
    - Create `tests/engines/filtering.property.test.ts` using fast-check
    - **Validates: Requirements 1.2, 1.5**

- [x] 5. Checkpoint - Ensure all engine tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Extend database schema with new Prisma models
  - [x] 6.1 Add projectType field to existing Project model
    - Add `projectType String @default("日常种草") @map("project_type") @db.VarChar(50)` to Project model
    - Add relation fields for new models
    - _Requirements: 2.2, 2.3_

  - [x] 6.2 Create ReportVersion model
    - Add `report_versions` table with id, projectId, versionNumber, generatedAt, config (Json), content (Json), status, createdBy
    - Add unique constraint on [projectId, versionNumber]
    - _Requirements: 7.7, 14.1, 14.2, 14.6_

  - [x] 6.3 Create ModuleDecision model
    - Add `module_decisions` table with id, projectId, versionId, moduleId, moduleName, status, reason, degradedFields, isOverridden, overriddenAt
    - Add unique constraint on [versionId, moduleId]
    - _Requirements: 5.11, 7.2_

  - [x] 6.4 Create MetricRatingRecord model
    - Add `metric_ratings` table with id, projectId, metricName, isCostMetric, vsKpiRatio/Rating, vsBenchmarkRatio/Rating, vsPreRatio/Rating, finalRating, calculatedAt
    - Add unique constraint on [projectId, metricName]
    - _Requirements: 4.1, 4.2_

  - [x] 6.5 Create ReviewEdit model
    - Add `review_edits` table with id, projectId, versionId, moduleId, editType, previousContent, newContent, editedAt, editedBy
    - _Requirements: 9.9, 14.1_

  - [x] 6.6 Run Prisma migration and generate client
    - Run `prisma migrate dev --name add-engines-frontend-models`
    - Run `prisma generate` to update generated client
    - Verify all relations compile correctly
    - _Requirements: 16.4_

- [ ] 7. Create YAML Prompt template structure
  - [x] 7.1 Create prompts directory structure
    - Create `prompts/` directory with subdirectories for each project type (新品上市, 日常种草, 节点营销, 竞品防御)
    - Under each project type, create module subdirectories (M1_overview through M8_diagnosis)
    - _Requirements: 17.1_

  - [x] 7.2 Create initial YAML prompt templates
    - Create at least one complete set of templates for one project type (新品上市)
    - Each template includes: name, version, projectType, moduleId, toneIntensity, prompt, variables, fallbackText
    - Create positive.yaml, standard.yaml, conservative.yaml for each module
    - _Requirements: 17.2, 17.3, 17.5_

  - [x] 7.3 Create template for remaining project types
    - Create templates for 日常种草, 节点营销, 竞品防御
    - Ensure attribution strategies match project type requirements
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

- [x] 8. Checkpoint - Ensure engines, schema, and templates are complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Set up Next.js frontend project
  - [x] 9.1 Initialize Next.js application in web/ directory
    - Create `web/` directory with Next.js 14+ App Router
    - Configure TypeScript, Tailwind CSS
    - Set up tsconfig path aliases to reference root `src/` code
    - Configure shared Prisma client access
    - _Requirements: 16.1, 16.2_

  - [x] 9.2 Install and configure frontend dependencies
    - Install shadcn/ui, React Query (TanStack Query), Recharts, docx, @react-pdf/renderer
    - Configure shadcn/ui components and theme
    - Set up React Query provider in root layout
    - _Requirements: 16.2, 16.3, 15.1_

  - [x] 9.3 Create shared layout and navigation components
    - Create root layout with sidebar navigation
    - Create reusable page header, loading states, error boundaries
    - Set up Tailwind theme with rating color coding (S=深绿, A=浅绿, B=蓝色, C=橙色, D=红色)
    - _Requirements: 16.5, 15.3_

- [ ] 10. Implement API Route Handlers
  - [x] 10.1 Implement project management API routes
    - Create `web/app/api/projects/route.ts` — GET (list with pagination/filters) and POST (create)
    - Create `web/app/api/projects/[id]/route.ts` — GET (detail) and PUT (update)
    - Validate request params, call Prisma, return JSON responses
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.7_

  - [x] 10.2 Implement data upload API routes
    - Create `web/app/api/upload/execution/route.ts` — POST (execution spreadsheet)
    - Create `web/app/api/upload/ad-spend/route.ts` — POST (ad spend spreadsheet)
    - Create `web/app/api/upload/external/route.ts` — POST (external platform data)
    - Create `web/app/api/upload/manual/route.ts` — POST (manual input)
    - Call existing SpreadsheetParser and DataPersistenceService
    - Return upload result summary (success/failure counts)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [x] 10.3 Implement report generation API routes
    - Create `web/app/api/generate/[projectId]/route.ts` — POST (trigger generation)
    - Create `web/app/api/generate/[projectId]/status/route.ts` — GET (progress)
    - Create `web/app/api/generate/[projectId]/config/route.ts` — GET (module config)
    - Orchestrate: Rating Engine → Decision Engine → Narrative Engine → Report Assembler
    - Create new ReportVersion record on completion
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [x] 10.4 Implement review and editing API routes
    - Create `web/app/api/review/[versionId]/route.ts` — GET (version content)
    - Create `web/app/api/review/[versionId]/module/[moduleId]/route.ts` — PUT (update module)
    - Create `web/app/api/review/[versionId]/regenerate/[moduleId]/route.ts` — POST (regenerate)
    - Create `web/app/api/review/[versionId]/tone/route.ts` — PUT (switch tone)
    - Create `web/app/api/review/[versionId]/columns/route.ts` — PUT (column visibility)
    - Save ReviewEdit records for all changes
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9_

  - [x] 10.5 Implement AI chat API route
    - Create `web/app/api/chat/[projectId]/route.ts` — POST (chat message)
    - Call Narrative Engine's chat function with project context
    - Support multi-turn conversation with message history
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.7_

  - [x] 10.6 Implement export API route
    - Create `web/app/api/export/[versionId]/route.ts` — POST (export Word/PDF)
    - Use docx package for Word generation, @react-pdf/renderer for PDF
    - Apply all review edits before export
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6_

  - [x] 10.7 Implement version management API routes
    - Create `web/app/api/versions/[projectId]/route.ts` — GET (version list)
    - Create `web/app/api/versions/[projectId]/copy/[versionId]/route.ts` — POST (copy version)
    - Create `web/app/api/versions/diff/[v1]/[v2]/route.ts` — GET (diff)
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6_

- [ ] 11. Implement frontend pages - Project List and Creation
  - [x] 11.1 Implement project list page
    - Create `web/app/page.tsx` with ProjectListPage component
    - Implement FilterBar (brand, category, projectType, status filters)
    - Implement SearchInput (fuzzy search by project name)
    - Implement ProjectTable with pagination (20 items per page)
    - Use React Query for data fetching and caching
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [x] 11.2 Implement project creation wizard
    - Create `web/app/projects/new/page.tsx` with 3-step wizard
    - Step 1: Basic info form (name, brand, category, SPU, dates, project type)
    - Step 2: Plan document upload (PDF/Word) with AI parsing
    - Step 3: Confirmation summary
    - Implement form validation with red error messages for required fields
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

  - [x] 11.3 Implement project detail page
    - Create `web/app/projects/[id]/page.tsx`
    - Show project header with basic info
    - Show progress tracker (upload → generate → review)
    - Show action cards for quick navigation
    - _Requirements: 1.4_

- [ ] 12. Implement frontend pages - Data Upload
  - [x] 12.1 Implement data upload page
    - Create `web/app/projects/[id]/upload/page.tsx`
    - Implement tab-based UI for 4 upload types
    - ExecutionUpload: xlsx/csv file upload with drag-and-drop
    - AdSpendUpload: xlsx/csv file upload for juguang data
    - ExternalDataUpload: lingxi platform data upload
    - ManualInputForm: form for KPI targets, benchmarks, brand search index, topic exposure
    - Show upload result summary (success/failure counts with error details)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

- [ ] 13. Implement frontend pages - Report Generation
  - [x] 13.1 Implement report generation config page
    - Create `web/app/projects/[id]/generate/page.tsx`
    - Show 8 module toggles (pre-set by Decision Engine)
    - Allow manual override of module show/hide
    - Global tone intensity selector (positive/standard/conservative)
    - Generate button with progress indicator (rating → decision → narrative → assembly)
    - Auto-redirect to review platform on completion
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

- [ ] 14. Implement frontend pages - Review Platform
  - [x] 14.1 Implement review platform three-panel layout
    - Create `web/app/projects/[id]/review/[versionId]/page.tsx`
    - Left panel: module navigation tree with status indicators
    - Center panel: content preview area (scrollable)
    - Right panel: AI chat panel
    - Responsive layout with collapsible panels
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [x] 14.2 Implement center panel content editing
    - Rich text preview with inline charts (Recharts)
    - Editable sections with confirm/regenerate/edit actions per module
    - Paragraph-level tone toggle (positive/standard/conservative)
    - "Problem to opportunity" one-click transformation
    - Data column visibility management (hide C/D rated columns)
    - Auto-save on edit
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 19.1, 19.2, 19.3, 19.4, 19.5_

  - [x] 14.3 Implement AI chat sidebar
    - Chat interface with multi-turn conversation
    - Support attribution analysis, data queries, optimization suggestions
    - "Insert to report" button for AI-generated text snippets
    - Preserve conversation history
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_

  - [x] 14.4 Implement toolbar and export functionality
    - Global tone intensity selector in toolbar
    - Export button (Word/PDF format selection)
    - Version info display
    - Column manager for data table visibility
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 19.1-19.5_

- [ ] 15. Implement chart components and version management
  - [x] 15.1 Implement Recharts chart components
    - Create reusable chart components: BarChart (KPI comparison), LineChart (trends), PieChart (distribution), RadarChart (multi-dimension), FunnelChart (conversion)
    - Apply rating color coding (S=深绿, A=浅绿, B=蓝色, C=橙色, D=红色)
    - Support real-time re-rendering on config changes
    - _Requirements: 15.1, 15.2, 15.3, 15.4_

  - [x] 15.2 Implement version management page
    - Create `web/app/projects/[id]/versions/page.tsx`
    - Version list sorted by generation time (descending)
    - Version diff view with highlighted changes
    - Copy version button to create new version from existing
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6_

- [ ] 16. Integration wiring and end-to-end flow
  - [x] 16.1 Wire report generation pipeline
    - Connect API route → Rating Engine → Decision Engine → Narrative Engine → Report Assembler
    - Persist MetricRatingRecord, ModuleDecision, ReportVersion to database
    - Implement progress tracking (status updates during generation)
    - _Requirements: 7.4, 7.5, 7.7_

  - [x] 16.2 Wire review platform to engines
    - Connect tone switch → Narrative Engine regeneration → save ReviewEdit
    - Connect module toggle → Decision override → persist isOverridden flag
    - Connect column hide → update report content → re-render charts
    - Connect AI chat → Narrative Engine chat → display response
    - _Requirements: 9.1-9.9, 10.1-10.7, 11.6, 19.1-19.5_

  - [x] 16.3 Wire export pipeline
    - Connect export button → apply all edits → generate Word/PDF → download
    - Ensure charts render correctly in exported documents
    - Handle export errors with retry suggestion
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 15.5_

- [x] 17. Checkpoint - Ensure full integration works
  - Ensure all tests pass, ask the user if questions arise.

- [ ]* 18. Write E2E tests with Playwright
  - [ ]* 18.1 Set up Playwright in web/ directory
    - Install Playwright and configure for Next.js
    - Create test fixtures and helpers
    - _Requirements: 16.1_

  - [ ]* 18.2 Write E2E tests for project creation flow
    - Test project wizard complete flow (3 steps)
    - Test form validation (required fields)
    - _Requirements: 2.1-2.8_

  - [ ]* 18.3 Write E2E tests for data upload flow
    - Test file upload for each type
    - Test upload result display
    - _Requirements: 3.1-3.8_

  - [ ]* 18.4 Write E2E tests for report generation and review
    - Test generation trigger and progress display
    - Test review platform three-panel interactions
    - Test tone switching and module toggling
    - Test AI chat interaction
    - Test export download
    - _Requirements: 7.1-7.8, 8.1-8.6, 9.1-9.9, 10.1-10.7, 13.1-13.6_

- [x] 19. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The engine layer (tasks 1-4) is pure functions and can be developed/tested independently of the frontend
- The Next.js app in `web/` shares the same Prisma client and `src/` code via tsconfig path aliases
- YAML prompt templates in `prompts/` are loaded at runtime and support hot-reload
