# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - 项目保存校验过严与同步无条件触发
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bugs exist
  - **Scoped PBT Approach**: Scope properties to concrete failing cases:
    - Case A: NoteBasePreview CORE_COLUMNS contains '博主昵称' instead of '笔记Id'
    - Case B: validate() rejects a form with only 品类+品牌+业务线+项目名称+创建者 filled (reports missing executionStartDate)
    - Case C1: ingestBaseData is called when noteIds=[] after note-base upload
    - Case C2: Lingxi sync is triggered when lingxiAccountId is set but dates are missing
  - Test that:
    - NoteBasePreview displays final-spec headers (笔记Id, 内容形式, 内容方向, 笔记类型, 资源含税成本价, 资源含税售价) for any parsed data
    - validate() returns no errors when all 5 required fields are filled (品类, 品牌, 业务线, 项目名称, 创建者)
    - Pugongying sync is NOT triggered when parsed noteIds is empty
    - Lingxi sync is NOT triggered unless ALL conditions are met (lingxiAccountId + industry + startDate + endDate + noteCount > 0)
  - Run test on UNFIXED code - expect FAILURE (this confirms the bugs exist)
  - Document counterexamples found (e.g., "CORE_COLUMNS[0].label === '博主昵称'", "validate() returns error for missing executionStartDate")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.3, 1.4, 1.5, 1.6_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - 既有校验行为保留
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs:
    - Observe: uploading non-.xlsx file returns "仅支持.xlsx格式文件" error
    - Observe: note-base missing required columns (发布链接, 内容形式, 内容方向, 笔记类型) returns parse error
    - Observe: saving project without 品类 or 品牌 or 项目名称 returns validation error
    - Observe: duplicate project name returns 409 conflict
    - Observe: creating review when noteCount=0 returns error
    - Observe: rows with empty 发布链接 are skipped during parsing
  - Write property-based tests:
    - For all form states missing any of (品类, 品牌, 项目名称), validate() returns corresponding error
    - For all note-base files missing required columns, parser returns column-missing error
    - For any review creation where project.noteCount === 0, API returns error
  - Verify tests PASS on UNFIXED code
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [ ] 3. Fix for 项目导入校验修复

  - [x] 3.1 Update NoteBasePreview component headers
    - Update CORE_COLUMNS from old names (博主昵称, 笔记ID, 是否报备, 合作形式, 内容方向) to final spec (笔记Id, 内容形式, 内容方向, 笔记类型)
    - Update COST_COLUMNS from old names (达人金额, 投流金额, 总消耗) to final spec (资源含税成本价, 资源含税售价)
    - Adjust getValue logic to map to correct parsed data fields
    - _Bug_Condition: isBugCondition(input) where input.action == 'preview' AND previewHeaders != FINAL_SPEC_HEADERS_
    - _Expected_Behavior: NoteBasePreview displays 笔记Id, 内容形式, 内容方向, 笔记类型, 资源含税成本价, 资源含税售价_
    - _Preservation: Parser behavior unchanged, file format validation unchanged_
    - _Requirements: 2.1_

  - [x] 3.2 Update template download file
    - Regenerate `web/public/down/projects-template.xlsx` with final spec headers: 发布链接（必须是长链接）、内容形式、内容方向、笔记类型、资源含税成本价、资源含税售价、曝光量、阅读量、点赞量、收藏量、评论量、分享量、关注量、互动量
    - _Bug_Condition: template headers do not match final spec_
    - _Expected_Behavior: Downloaded template has correct 14-column headers matching final spec_
    - _Requirements: 2.2_

  - [x] 3.3 Reduce frontend validate() to 5 required fields only
    - Remove validation for executionStartDate, endDate, lingxiTaxonomy.accountId, pendingNoteFile
    - Add businessLine (业务线) as required field in validate()
    - Retain date-range logic check (endDate > startDate) only when both dates are filled
    - File: `web/src/app/projects/new/page.tsx`
    - _Bug_Condition: isBugCondition(input) where input.action == 'save' AND validationRequires(executionStartDate) OR validationRequires(endDate) OR validationRequires(lingxiAccountId) OR validationRequires(noteBase)_
    - _Expected_Behavior: validate() only requires 品类, 品牌, 业务线, 项目名称, 创建者_
    - _Preservation: 品类/品牌/项目名称 required validation unchanged_
    - _Requirements: 2.3, 2.4_

  - [x] 3.4 Add Pugongying sync condition check in backend
    - In `/api/upload/note-base/[projectId]` route, check parsed noteIds.length > 0 before calling ingestBaseData for Pugongying
    - Skip Pugongying sync if no noteIds parsed from uploaded base table
    - File: `web/src/app/api/upload/note-base/[projectId]/route.ts`
    - _Bug_Condition: isBugCondition(input) where input.action == 'uploadNoteBase' AND triggersPugongyingSync WITHOUT checking noteIds exist_
    - _Expected_Behavior: Pugongying sync only triggers when noteIds.length > 0_
    - _Preservation: Normal upload with valid noteIds still triggers Pugongying sync_
    - _Requirements: 2.6, 2.7_

  - [x] 3.5 Add Lingxi sync condition check in backend
    - In project save API (POST/PUT), add condition check before triggering Lingxi sync
    - ALL conditions must be met: lingxiAccountId provided in this request + lingxiTaxonomyPath non-empty + executionStartDate filled + endDate filled + noteCount > 0
    - Skip Lingxi sync if any condition is missing
    - File: `web/src/app/api/projects/route.ts` and `web/src/app/api/projects/[id]/route.ts`
    - _Bug_Condition: isBugCondition(input) where triggersLingxiSync WITHOUT checking all conditions_
    - _Expected_Behavior: Lingxi sync only triggers when ALL 5 conditions are satisfied_
    - _Preservation: Projects with all conditions filled still trigger Lingxi sync normally_
    - _Requirements: 2.8, 2.9, 2.10_

  - [x] 3.6 Add review creation pre-validation
    - In POST `/api/reviews` route, query Project for executionStartDate, endDate, lingxiAccountId, noteCount
    - Return error if project is missing dates, lingxiId, or noteCount === 0
    - Provide clear error message indicating which fields need to be filled in project settings
    - File: `web/src/app/api/reviews/route.ts` or `web/src/app/api/reviews/[id]/route.ts`
    - _Bug_Condition: N/A (new validation for review creation)_
    - _Expected_Behavior: Review creation fails with descriptive error when project lacks required data_
    - _Preservation: Review creation with complete project data continues to work_
    - _Requirements: 2.5_

  - [x] 3.7 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - 项目保存校验与同步条件正确
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bugs are fixed)
    - _Requirements: 2.1, 2.3, 2.4, 2.6, 2.7, 2.8, 2.9_

  - [x] 3.8 Verify preservation tests still pass
    - **Property 2: Preservation** - 既有校验行为保留
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all preservation tests still pass after fix (no regressions)
    - _Requirements: 3.1, 3.2, 3.3, 3.5, 3.6, 3.7_

- [x] 4. Checkpoint - Ensure all tests pass
  - Run full test suite to confirm all bug condition and preservation tests pass
  - Verify no regressions in existing test coverage
  - Ask the user if questions arise
