# Implementation Plan: Review Config Optimization

## Overview

本实现计划将设计文档拆分为可执行的编码任务，覆盖数据模型扩展、前端 UI 调整、后端 API 变更、计算层重构和 SSE 实时进度展示。任务按依赖顺序排列，每一步构建在前一步之上，最终通过集成测试串联所有模块。

## Tasks

- [x] 1. Database migration: add viralThreshold and advertiserIds to ReviewConfig
  - Add `viralThreshold Int? @map("viral_threshold")` field to ReviewConfig model in `prisma/schema.prisma`
  - Add `advertiserIds Json @default("[]") @map("advertiser_ids")` field to ReviewConfig model in `prisma/schema.prisma`
  - Create migration SQL file: `ALTER TABLE review_configs ADD COLUMN viral_threshold INTEGER, ADD COLUMN advertiser_ids JSONB NOT NULL DEFAULT '[]'::jsonb;`
  - Run `npx prisma generate` to regenerate the Prisma client
  - _Requirements: 4.6, 5.4_

- [ ] 2. Calculation layer: parameterize viral threshold in viral.ts
  - [x] 2.1 Refactor `isViralNote` in `src/calculation/viral.ts`
    - Change signature to `isViralNote(note: NoteMetrics, threshold?: number): boolean`
    - Keep classification logic as `likeNum + favNum + cmtNum >= threshold` (unchanged formula, only threshold becomes configurable)
    - Add `DEFAULT_VIRAL_THRESHOLD = 1000` constant, use as fallback when threshold is undefined/null
    - Update `calculateViralRate` to accept optional threshold parameter and pass through
    - _Requirements: 4.3, 4.4, 4.5_

  - [x] 2.2 Write property test for viral threshold classification (Property 1)
    - **Property 1: Viral threshold classification correctness**
    - Generate random NoteMetrics (likeNum, favNum, cmtNum: 0–100000) and random threshold (1–50000)
    - Verify `isViralNote(note, threshold)` returns true iff `note.likeNum + note.favNum + note.cmtNum >= threshold`
    - Verify `isViralNote(note)` (no threshold) behaves as if threshold is 1000
    - Use `fast-check` in `src/calculation/__tests__/viral.property.test.ts`
    - **Validates: Requirements 4.3, 4.4, 4.5**

- [ ] 3. Calculation layer: add KOL exposure rate classification in kol-tier.ts
  - [x] 3.1 Implement `classifyKOLByExposureRate` in `src/calculation/kol-tier.ts`
    - Define `ExposureRateTierConfig` interface: `{ name: string; lowerBound: number; upperBound: number }`
    - Implement function: calculate `exposureRate = impressions / fanCount`, match against tier ranges `[lowerBound, upperBound)`
    - Return `"未分类"` if fanCount <= 0 or no tier range matches
    - Keep existing `classifyKOLTier(fanCount)` for backward compatibility
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 3.2 Write property test for KOL tier classification (Property 3)
    - **Property 3: KOL tier classification via exposure rate**
    - Generate random non-overlapping tier configs (1–5 tiers) and random (impressions, fanCount) pairs
    - Verify classification matches expected tier based on `impressions / fanCount` falling in `[lowerBound, upperBound)`
    - Verify fanCount <= 0 returns "未分类"
    - Use `fast-check` in `src/calculation/__tests__/kol-tier.property.test.ts`
    - **Validates: Requirements 7.2, 7.3, 7.4**

- [x] 4. Module toggle: remove audienceAnalysis from REPORT_MODULE_KEYS
  - In `web/src/lib/module-toggle.ts`, remove `'audienceAnalysis'` from the `REPORT_MODULE_KEYS` array
  - _Requirements: 3.1_

- [x] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Frontend: ReviewConfigForm UI changes
  - [x] 6.1 Update KPI label and section titles in `web/src/app/review/new/page.tsx`
    - Change the viral rate KPI field label to "爆文率(%)"
    - Rename section title from "金额口径与总费用" to "金额口径"
    - Remove the "总费用（实时计算）" display block (the `costData` query and related rendering)
    - _Requirements: 1.1, 2.3, 2.4_

  - [x] 6.2 Restructure cost caliber section in `web/src/app/review/new/page.tsx`
    - Remove `costCaliberType` state and its radio toggle (content/traffic switch)
    - Display "内容金额口径" and "投流金额口径" as two simultaneously visible independent sub-sections
    - Each sub-section shows "消耗" / "结算" radio options using existing `contentCostCaliber` and `trafficCostCaliber` state
    - _Requirements: 2.1, 2.2_

  - [x] 6.3 Update REPORT_MODULES constant in `web/src/app/review/new/page.tsx`
    - Remove `audienceAnalysis` entry from the REPORT_MODULES array
    - Remove `projectManagement` and `endPage` entries if present
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 6.4 Add viral threshold input in `web/src/app/review/new/page.tsx`
    - Add `viralThreshold` state (`useState<string>('1000')`)
    - Add numeric input field in the viral metric configuration section, label "爆文阈值（点赞数）", min=1
    - Include in submit payload as `viralThreshold: viralThreshold ? parseInt(viralThreshold) : null`
    - _Requirements: 4.1, 4.2_

  - [x] 6.5 Add advertiser IDs input in `web/src/app/review/new/page.tsx`
    - Add `advertiserIds` state (`useState<string[]>([])`)
    - Show "广告主ID" input section only when `modules.launchAnalysis` is enabled
    - Support adding up to 5 IDs with pattern validation (`/^\d+$/`)
    - Show validation error if user tries to add more than 5
    - Include in submit payload as `advertiserIds: advertiserIds.filter(Boolean)`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 7. Backend API: POST/PUT reviews with viralThreshold, advertiserIds, and ingestion trigger
  - [x] 7.1 Update POST /api/reviews route handler
    - Extract `viralThreshold` and `advertiserIds` from request body
    - Write both fields to ReviewConfig on create
    - After successful create, if `advertiserIds` is non-empty, call `DataIngestionService.ingestJuguangData(projectId, advertiserIds, reviewConfig.id)`
    - Do not block response on ingestion failure — log error and continue
    - _Requirements: 4.2, 5.4, 6.1, 6.4_

  - [x] 7.2 Update PUT /api/reviews/[id] route handler
    - Extract `advertiserIds` from request body
    - Compare old and new `advertiserIds` (JSON.stringify equality)
    - If changed, trigger `DataIngestionService.ingestJuguangData`; if unchanged, skip
    - _Requirements: 6.2, 6.3_

  - [x] 7.3 Write property test for ingestion trigger change detection (Property 2)
    - **Property 2: Ingestion trigger change detection**
    - Generate random advertiser ID array pairs (0–10 elements each)
    - Verify trigger decision: trigger iff arrays differ in content
    - Verify both empty → no trigger; create with non-empty → always trigger
    - Use `fast-check` in `web/src/app/api/reviews/__tests__/ingestion-trigger.property.test.ts`
    - **Validates: Requirements 6.1, 6.2, 6.3**

- [x] 8. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. SSE stream: add progress event with token counting
  - [x] 9.1 Add progress event emission in `web/src/app/api/generate-report/[reviewConfigId]/stream/route.ts`
    - In `processChapter`, track token usage via LLM response metadata or string length approximation
    - Emit `{ type: 'progress', chapterId: string, tokensUsed: number }` periodically (every ~50 tokens or on chapter start)
    - Emit initial progress event with `tokensUsed: 0` when chapter generation begins
    - Emit final progress event with total tokens when chapter completes
    - _Requirements: 8.6, 8.7, 8.8_

- [ ] 10. Frontend: Proofread page chapter status tracking
  - [x] 10.1 Add chapter status state in `web/src/app/review/[id]/proofread/page.tsx`
    - Define `ChapterStatus` type: `{ id: string; title: string; number: number; status: 'pending' | 'generating' | 'completed' | 'error'; tokensUsed?: number }`
    - Initialize `chapterStatuses` from CHAPTER_DEFS with all chapters set to `pending` when generation starts
    - _Requirements: 8.1_

  - [x] 10.2 Handle SSE progress events in `web/src/app/review/[id]/proofread/page.tsx`
    - In `onmessage` handler, add case for `data.type === 'progress'`
    - Update matching chapter status to `generating` with `tokensUsed` from event data
    - When `data.type === 'chapter'` is received, update that chapter's status to `completed`
    - _Requirements: 8.2, 8.3, 8.6_

  - [x] 10.3 Show loading state for in-progress chapters in `web/src/app/review/[id]/proofread/page.tsx`
    - When user clicks a chapter with status `generating`, show a loading placeholder in the main content area
    - _Requirements: 8.4_

- [ ] 11. Frontend: ReportChapterNav component status rendering
  - [x] 11.1 Update `ReportChapterNav` interface and rendering in `web/src/components/proofread/report-chapter-nav.tsx`
    - Add `chapterStatuses` prop to component interface (array of `ChapterStatus`)
    - Render status indicator per chapter: `pending` → gray circle, `generating` → Loader2 spinner + token count text, `completed` → green checkmark, `error` → red × icon
    - Remove the single `isGenerating` prop and global loading indicator at the bottom
    - Show all chapter entries immediately (from `chapterStatuses`) rather than only showing received chapters
    - _Requirements: 8.1, 8.2, 8.3, 8.5_

- [x] 12. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties defined in the design document (fast-check)
- The existing `classifyKOLTier(fanCount)` function is preserved for backward compatibility
- The ingestion trigger logic should be extracted into a testable utility function for Property 2 testing
