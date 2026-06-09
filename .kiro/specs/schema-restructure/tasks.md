# Implementation Plan: Schema Restructure

## Overview

本实现计划将PPP复盘报告系统三大核心数据模型的表头/字段重构从设计落地为代码。按照"数据库层 → 后端逻辑 → 前端展示"的顺序推进，确保每一步都可增量验证。

## Tasks

- [x] 1. Database: Add phone field to User model
  - [x] 1.1 Add `phone` field to Prisma schema and run migration
    - Add `phone String? @unique @db.VarChar(20)` to `User` model in `prisma/schema.prisma`
    - Run `npx prisma migrate dev --name add_user_phone` to generate migration
    - Verify partial unique index is created for non-null phone values
    - _Requirements: 1.1, 1.2_

  - [x] 1.2 Regenerate Prisma client and verify existing code compiles
    - Run `npx prisma generate`
    - Ensure no type errors in existing code that references User model
    - _Requirements: 1.1_

- [x] 2. Auth: Implement phone-based login with backward compatibility
  - [x] 2.1 Add phone validation utility function
    - Create `web/src/lib/phone-validator.ts` with `isValidPhone(input: string): boolean`
    - Validation regex: `/^1[3-9]\d{9}$/`
    - Export for reuse in auth, user import, and frontend
    - _Requirements: 3.3, 4.4_

  - [x] 2.2 Write property test for phone validation (Property 4)
    - **Property 4: Phone number format validation**
    - **Validates: Requirements 3.3, 4.4**
    - Create `web/src/lib/__tests__/phone-validation.property.test.ts`
    - Use fast-check to generate arbitrary strings and verify only valid 11-digit Chinese mobile numbers pass

  - [x] 2.3 Modify login route to accept phone field
    - Update `web/src/app/api/auth/login/route.ts` to accept `{ phone, password, rememberMe }` request body
    - Primary lookup: `prisma.user.findUnique({ where: { phone } })`
    - Fallback: if `phone` is absent but `username` is present, lookup by username (backward compat)
    - Return unified error message "手机号或密码错误" for all auth failures
    - _Requirements: 2.1, 2.2, 2.4_

  - [x] 2.4 Update JWT payload to include phone
    - Modify `web/src/lib/auth.ts` to include `phone` field in JWTPayload interface and token generation
    - Ensure `/api/auth/me` returns phone in user info
    - _Requirements: 2.3_

  - [x] 2.5 Write property tests for auth login (Properties 1, 2, 3)
    - **Property 1: Phone login authentication**
    - **Property 2: JWT payload contains phone and username**
    - **Property 3: Legacy username login backward compatibility**
    - **Validates: Requirements 2.1, 2.3, 2.4**
    - Create `web/src/lib/__tests__/auth-login.property.test.ts`
    - Test phone login success, JWT payload structure, and username fallback

  - [x] 2.6 Write unit tests for login route
    - Test phone login success/failure, username fallback, disabled account rejection
    - Test unified error messages for security (no user enumeration)
    - _Requirements: 2.1, 2.2, 2.4_

- [x] 3. Checkpoint - Auth and database migration
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. User Import: Add phone column mapping and validation
  - [x] 4.1 Update user import route with phone column mapping
    - Modify `web/src/app/api/admin/import/users/route.ts`
    - Add "手机号" and "phone" to COLUMN_MAP → maps to `phone` field
    - Add phone format validation using `isValidPhone()` from phone-validator
    - Add phone uniqueness check: `prisma.user.findUnique({ where: { phone } })`
    - Record row errors for invalid format ("第X行: 手机号格式不正确") and duplicates ("第X行: 手机号已存在")
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 4.2 Write property test for user import phone mapping (Property 5)
    - **Property 5: User import phone column mapping**
    - **Validates: Requirements 3.2**
    - Create `web/src/app/api/admin/import/__tests__/users-import.property.test.ts`
    - Test that valid phone values in "手机号"/"phone" columns are correctly mapped to user records

  - [x] 4.3 Write unit tests for user import phone validation
    - Test valid phone import, invalid format rejection, duplicate phone rejection
    - _Requirements: 3.3, 3.4_

- [x] 5. Project Import: Update column mapping, createdBy resolution, and upsert
  - [x] 5.1 Update project import column mapping and make businessLine optional
    - Modify `web/src/app/api/admin/import/project-base/route.ts`
    - Update column mapping: "品牌简称"→brand, "品牌行业类目"→category, "品牌业务线"→businessLine, "项目名称"→projectName, "创建者"→createdBy
    - Remove businessLine from REQUIRED_FIELDS (keep only category, brand, projectName)
    - _Requirements: 5.3, 5.4, 7.3_

  - [x] 5.2 Implement createdBy realName-to-UUID resolution
    - Add `resolveCreatedBy(realName: string)` function in project-base import route
    - Query `prisma.user.findMany({ where: { realName } })` to find matching users
    - If exactly 1 match → return userId; if 0 or >1 match → return null + warning message
    - Store resolved UUID (or null) in project's createdBy field
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 5.3 Implement project upsert on unique constraint conflict
    - Use Prisma `upsert` with where clause on (category, brand, businessLine, projectName)
    - On conflict: update existing record instead of creating duplicate
    - Handle PostgreSQL NULL semantics for businessLine (NULL != NULL in unique constraint)
    - _Requirements: 12.1, 12.2, 12.3_

  - [x] 5.4 Write property tests for project import (Properties 6, 7, 12)
    - **Property 6: Project import new column mapping**
    - **Property 7: CreatedBy realName resolution**
    - **Property 12: Project upsert on import conflict**
    - **Validates: Requirements 5.4, 6.1, 6.2, 6.3, 6.4, 12.3**
    - Create `web/src/app/api/admin/import/__tests__/project-import.property.test.ts`

  - [x] 5.5 Write unit tests for project import
    - Test businessLine optional behavior, createdBy resolution (1 match, 0 matches, multiple matches), upsert behavior
    - _Requirements: 5.3, 5.4, 6.1–6.4, 12.3_

- [x] 6. Checkpoint - Import services complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. NoteBase Parser: New 18-column header mapping and header row detection
  - [x] 7.1 Add new column name mappings to NoteBase parser (required vs optional)
    - Modify `web/src/lib/note-base-parser.ts`
    - **必带字段（Required for ALL notes）映射:**
      - "发布链接"→noteLink, "内容方向"→contentDirection, "笔记类型"→kolType, "资源含税成本价"→contentCost, "资源含税售价"→contentSettlement
    - **非官方合作字段（Optional）映射:**
      - "内容形式"→cooperationForm, "总消耗"→totalCost
      - Metric columns (曝光量, 阅读量, 点赞量, 收藏量, 评论量, 转发量, 互动量, CPM, CPC, CPE, CTR) → metrics JSON fields
    - Add to DISPLAY_ONLY_COLUMN_MAP: "转发量"→shareNum
    - Add required column validation: if any of 5 mandatory columns missing from header → return parse error
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9_

  - [x] 7.2 Implement header row auto-detection
    - Add logic to `parseNoteBaseExcel` to check if row 1 contains known column names
    - If row 1 matches → use row 1 as header
    - If row 1 does not match but row 2 does → skip row 1, use row 2 as header
    - If neither matches → return parse error "未识别到有效表头"
    - _Requirements: 10.1, 10.2, 10.3_

  - [x] 7.3 Ensure backward compatibility with old headers and default values
    - Keep existing old column mappings (博主昵称, 博主粉丝量, 合作形式, 是否报备, 达人类型, 对应SPU, 内容实际消耗金额, 投流实际消耗) unchanged
    - When old columns are absent in new-format Excel, apply defaults: kolNickName=null, kolFanNum=0, isRegistered=false, spuName=null, adSpend=0
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x] 7.4 Write property tests for NoteBase parser (Properties 8, 9, 10)
    - **Property 8: NoteBase new 18-column header mapping with required vs optional distinction**
    - **Property 9: NoteBase backward compatibility and default values**
    - **Property 10: Header row auto-detection**
    - **Validates: Requirements 8.1–8.9, 9.1–9.5, 10.1–10.3**
    - Update or create `web/src/lib/note-base-parser.property.test.ts`
    - Test that missing required columns trigger parse error
    - Test that missing optional columns do NOT trigger parse error

  - [x] 7.5 Write unit tests for NoteBase parser changes
    - Test new 18-column parsing, old header parsing, mixed scenarios, header row detection (row 1 vs row 2 vs error)
    - _Requirements: 8.1–8.8, 9.1–9.5, 10.1–10.3_

- [x] 8. Checkpoint - Parser changes complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. fillNotesFromNoteBase: Two-step data flow logic
  - [x] 9.1 Add contentDirection, cooperationForm, totalCost fields to Note model
    - Add `contentDirection String?` to Note model in `prisma/schema.prisma`
    - Add `cooperationForm String?` to Note model in `prisma/schema.prisma`
    - Add `totalCost Decimal?` to Note model in `prisma/schema.prisma` (if not already present)
    - Run `npx prisma migrate dev --name add_note_content_fields`
    - _Requirements: 13.1, 13.5_

  - [x] 9.2 Refactor fillNotesFromNoteBase to accept allNoteIds and missingNoteIds
    - Modify `src/ingestion/persistence-service.ts`
    - Change function signature: `fillNotesFromNoteBase(projectId: string, allNoteIds: string[], missingNoteIds: string[]): Promise<void>`
    - **Step 1 (ALL notes)**: For allNoteIds, upsert into notes table with only the 5 required fields:
      - noteLink, contentDirection (new), noteType (from kolType), kolPrice (from contentCost), serviceFee (from contentSettlement)
      - On update: only overwrite these 5 fields, DO NOT touch metric fields or dataSource
    - **Step 2 (Non-official only)**: For missingNoteIds, additionally write:
      - totalCost, cooperationForm, impNum, readNum, engageNum, likeNum, favNum, cmtNum, shareNum
      - Set dataSource = 'note_base'
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7_

  - [x] 9.3 Update ingestion caller to pass both allNoteIds and missingNoteIds
    - Modify `src/ingestion/index.ts`
    - Change call site: pass `ctx.noteIds` as allNoteIds and `missingNoteIds` (蒲公英未返回的) as second param
    - Update log message to reflect two-step behavior
    - _Requirements: 13.1, 13.2_

  - [x] 9.4 Update PersistenceService interface
    - Modify the interface in `src/ingestion/persistence-service.ts` to match new signature
    - Update JSDoc to describe two-step behavior
    - _Requirements: 13.1_

  - [x] 9.5 Write property test for fillNotesFromNoteBase two-step logic (Property 13)
    - **Property 13: fillNotesFromNoteBase two-step data flow**
    - **Validates: Requirements 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7**
    - Create `src/ingestion/__tests__/fill-notes.property.test.ts`
    - Test Step 1 invariant: all notes get required fields
    - Test Step 2 invariant: only missing notes get metrics
    - Test non-overwrite invariant: existing API data not overwritten by Step 1

  - [x] 9.6 Write unit tests for fillNotesFromNoteBase
    - Test Step 1 alone (official cooperation notes keep their existing metrics)
    - Test Step 2 (non-official notes get full data from note_base)
    - Test mixed scenario (some official, some non-official in same project)
    - Test edge case: note_base has no metrics for a non-official note (defaults to 0)
    - _Requirements: 13.1–13.7_

- [x] 10. Report Generation: Adapt to read from notes table only
  - [x] 10.1 Update data overview loader to read exclusively from notes table
    - Modify `src/pipeline/loaders/chapter-03-data-overview.ts`
    - Remove direct query to `note_base` table for COUNT(*), SUM(content_settlement), SUM(ad_spend)
    - Replace with: note count from `notes` table COUNT(*), content settlement from SUM(serviceFee)
    - Compute CPM/CPC/CPE/CTR from notes table fields (totalCost / volume metrics)
    - Use `kolPrice` for per-note content cost (consumption caliber), `serviceFee` for settlement caliber
    - ⚠️ `adSpend` (投流结算口径) no longer available — see ISSUE-007; default to consumption caliber (juguang_data.fee)
    - _Requirements: 11.1, 11.2, 11.4, 11.5, 11.6, 11.8, 11.9, 11.10_

  - [x] 10.2 Update quadrant analysis loader to read from notes table
    - Modify `src/pipeline/loaders/chapter-05-quadrant-analysis.ts`
    - Remove direct query to `note_base` for content_cost and content_direction
    - Read `kolPrice` (content cost) and `contentDirection` from notes table instead
    - Per-note cost calculation: `notes.kolPrice + juguang.fee`
    - _Requirements: 11.1, 11.7_

  - [x] 10.3 Update content analysis loader to use notes table fields
    - Modify `src/pipeline/loaders/chapter-06-content-analysis.ts`
    - Remove direct query to `note_base` for content_direction, kol_type, content_cost
    - Read `contentDirection`, `noteType` (kolType), and `kolPrice` from notes table
    - Group notes by `contentDirection` (内容方向) for analysis
    - Handle null values by placing them in "未分类" group
    - _Requirements: 11.1, 11.3_

  - [x] 10.4 Write property test for report reads from notes table (Property 11)
    - **Property 11: Report reads exclusively from notes table**
    - **Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9**
    - Create `src/pipeline/loaders/__tests__/data-overview.property.test.ts`
    - Test that report loader queries notes table only and never queries note_base directly

  - [x] 10.5 Write unit tests for report generation changes
    - Test CPM/CPC/CPE/CTR computation from notes table fields
    - Test contentDirection/cooperationForm grouping from notes table
    - Test quadrant analysis reads kolPrice from notes table
    - Test null handling for grouping fields
    - Test note count from notes table matches expected
    - _Requirements: 11.1–11.10_

- [x] 11. Frontend: Login form update
  - [x] 11.1 Update login page to use phone field
    - Modify `web/src/app/login/page.tsx`
    - Change input label from "用户名" to "手机号"
    - Add input placeholder with phone format hint
    - Change submitted field from `username` to `phone`
    - Add client-side phone format validation (11 digits, starts with 1)
    - _Requirements: 2.1_

- [x] 12. Frontend: User management updates
  - [x] 12.1 Add phone column to user list and forms
    - Modify user list page in `web/src/app/admin/users/` to display phone column in table
    - Update user create/edit forms to include phone input (required for new users, with 11-digit validation)
    - Add uniqueness validation feedback on phone field
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 12.2 Update Users API to handle phone in CRUD operations
    - Modify `web/src/app/api/admin/users/` routes to accept and return phone field
    - Add phone uniqueness check on create/update
    - _Requirements: 4.2, 4.3_

- [x] 13. Frontend: Project list table restructure
  - [x] 13.1 Update project list to display new 5-column layout
    - Modify project list page in `web/src/app/projects/` components
    - Display columns: 项目名称 → 品牌名称 → 品牌业务线 → 品牌行业类目 → 创建者
    - Remove columns: 笔记数量, 项目结束日期, 参与者
    - Resolve createdBy UUID to realName for display (join or eager load)
    - _Requirements: 5.2, 6.5, 7.4_

  - [x] 13.2 Update projects API to return createdBy as realName
    - Modify `web/src/app/api/projects/route.ts` to include user relation for createdBy display
    - Return `createdByName` field alongside UUID for frontend display
    - _Requirements: 6.5_

- [x] 14. Final checkpoint - All tests pass and feature complete
  - Ensure all tests pass, ask the user if questions arise.
  - Verify Prisma migration applies cleanly
  - Verify login flow works with phone and username fallback
  - Verify import routes handle new column mappings correctly
  - Verify fillNotesFromNoteBase correctly populates notes table in two steps
  - Verify report generation reads exclusively from notes table

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- Database migration is non-destructive (adds nullable column, no data loss)
- All old column mappings and fields are preserved for backward compatibility
- **Task 9 (fillNotesFromNoteBase)** is the critical data flow change: it ensures reports can read exclusively from notes table
- **Task 10 (Report Generation)** depends on Task 9 being complete — reports assume notes table is fully populated
- Field mapping: contentCost → kolPrice, contentSettlement → serviceFee (confirmed by user)
