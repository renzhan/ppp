# Report Chapter Fixes Bugfix Design

## Overview

Six report chapters (3, 4, 5, 6, 7, 9) produce incorrect or incomplete output due to mismatches between prompt templates, data loaders, and the expected report specification. The core issues are: (1) prompt templates not instructing the AI to output the correct table structures, (2) data loaders not computing/exposing required metrics, (3) a completely wrong classification algorithm in the quadrant chapter, and (4) missing anti-hallucination guardrails. The fix approach targets each chapter's `.ts` data loader and `.md` prompt template while preserving the existing pipeline architecture and all unchanged behaviors.

## Glossary

- **Bug_Condition (C)**: Any report generation request where the chapter output does not match the specification — missing tables, wrong columns, incorrect classification logic, hallucinated data, or blank fields
- **Property (P)**: Each chapter SHALL produce output matching its specification: correct tables, accurate calculations, grounded-in-data text, and proper formatting
- **Preservation**: Existing calculation formulas (CPM/CPC/CPE/CTR), database query patterns, traceability item structure, caliber logic, and the prompt→loader→AI→HTML pipeline remain unchanged
- **Data Loader (.ts)**: TypeScript class in `src/pipeline/loaders/` that queries the database and computes variables for the prompt template
- **Prompt Template (.md)**: Markdown file in `src/prompts/chapters/` containing system instructions and data placeholders that guide AI generation
- **engageRate**: The `notes.engageRate` field from 蒲公英, representing content quality (互动率)
- **投流CPE**: `juguang_data.fee / juguang_data.interaction` per note, representing traffic cost efficiency
- **launchPhases**: JSON field in `review_configs` containing investment period definitions (预热期/爆发期/持续期)

## Bug Details

### Bug Condition

The bugs manifest across six chapters when the report generation pipeline produces output that does not match the required specification. Each chapter has distinct trigger conditions but they share a common architecture pattern: the data loader computes variables that are interpolated into a prompt template, which then guides AI text generation.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { chapterNumber: number, projectData: ProjectData }
  OUTPUT: boolean
  
  RETURN (input.chapterNumber == 3 AND outputMissesKPIComparisonTables(input))
         OR (input.chapterNumber == 4 AND outputUsesAIPSFramework(input))
         OR (input.chapterNumber == 5 AND quadrantUsesWrongClassification(input))
         OR (input.chapterNumber == 6 AND tablesMissingColumns(input))
         OR (input.chapterNumber == 7 AND noteTableShowsRawIds(input))
         OR (input.chapterNumber == 9 AND outputContainsHallucinatedData(input))
END FUNCTION
```

### Examples

- **Chapter 3**: AI outputs "总曝光 644w" without showing KPI target of 500w, completion rate of 128.8%, or ↑ indicator
- **Chapter 4**: AI uses "被看见：品牌声量增长" framework instead of "亮点1：爆文频出，爆文率远超KPI\n爆文率：82.6% KPI：35% 完成率：236%"
- **Chapter 5**: Scatter chart is completely empty because benchmark-based classification produces no valid quadrants when benchmark values are missing or all notes fall on same side
- **Chapter 6**: Content direction table shows 10 columns but specification requires 12 (missing CPM, CPC, CPI)
- **Chapter 7**: Note table displays "6a2273d4...b9fb" instead of "@小红书达人昵称"
- **Chapter 9**: AI fabricates "LTV倍数达到3.2x" and "18-24岁占比47%" when neither metric exists in database

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- All existing cost calculation formulas (CPM = totalCost/impressions*1000, CPC = totalCost/reads, CPE = totalCost/engagement, CTR = reads/impressions*100)
- Content/traffic cost caliber selection logic from review_configs.modules
- Engagement metric caliber (include_follow vs exclude_follow) logic
- Viral metric and threshold logic (like_only vs like_comment_share)
- Database query patterns using Prisma ORM (findMany, aggregate, $queryRaw)
- TraceItem construction format (traceId, chapterNumber, label, sourceTable, sourceQuery, columns, dataRows, calculations)
- Pipeline architecture: prompt template → data loader → AI generation → HTML rendering
- Placement label mapping (1=信息流, 2=搜索, 4=全站智投, 7=视频流)
- Notes without juguang_data excluded from traffic-dependent analyses
- normalizeBenchmarkValue utility for range parsing

**Scope:**
All non-affected chapters (1, 2, 8, 10) and all existing calculation logic within affected chapters must produce identical results. Only the output format, additional computed fields, classification algorithm (ch5), and prompt instructions change.

## Hypothesized Root Cause

Based on the bug description, the root causes are:

1. **Chapter 3 — Prompt template outputs a single combined table**: The current prompt template (`chapter-03-data-overview.md`) places all metrics (传播类 + 效率类) in one table and does not instruct the AI to use color coding or arrows. The data loader already computes all necessary values (KPI targets, completions, benchmarks), so the fix is primarily in the prompt template output instructions.

2. **Chapter 4 — Prompt enforces AIPS framework**: The system_prompt explicitly says "采用AIPS模型框架组织亮点：Awareness（被看见）…" forcing the AI into this structure. Additionally, the data loader does not extract `AIPS本品变化率`, `TI本品变化率`, or `AIPS人群规模行业排名` from lingxi_data, and does not generate a `品牌心智数据解读` summary variable.

3. **Chapter 5 — Wrong classification algorithm**: The current loader uses benchmark-based quadrant classification comparing each note's CPM/CPE/CTR against industry benchmark midpoints. When benchmarks are 0 or missing, classification fails entirely (all notes go to one quadrant or none). The required algorithm uses project-internal normalization of `engageRate` (Y-axis) and `投流CPE` (X-axis) with dynamic dividing lines at AVG of normalized scores.

4. **Chapter 6 — aggregate() function missing columns**: The `aggregate()` helper in `chapter-06-content-analysis.ts` only outputs 10 columns (维度|篇数|曝光量|阅读量|互动量|TI人群|CPTI|CPE|爆文篇数|爆文率) but is missing CPM, CPC, CPI. Also, the TOP5 note analysis in the prompt doesn't request the structured format (cover + creator + content structure analysis).

5. **Chapter 7 — kolNickName fallback to noteId**: The code already resolves kolNickName via notesMap lookup but uses `noteId` as fallback. The real issue is the prompt template's note table header doesn't match the required column order. Additionally, no daily trend aggregation or ad type summary table is computed.

6. **Chapter 9 — No anti-hallucination constraints**: The prompt template's system_prompt is minimal ("建议必须基于数据洞察") without explicit prohibitions on fabricating data, citing non-existent metrics, or using specific strategy terms not grounded in data.

## Correctness Properties

Property 1: Bug Condition - Chapter Output Matches Specification

_For any_ report generation request where the bug condition holds (chapters 3-7, 9 with current code), the fixed system SHALL produce output matching the specified format: Chapter 3 outputs two separate KPI tables with color coding; Chapter 4 uses numbered highlights with data support; Chapter 5 uses engage_rate × 投流CPE normalized classification; Chapter 6 includes all 12 table columns; Chapter 7 shows creator nicknames and complete column set; Chapter 9 only references data present in the input.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 2.12, 2.13, 2.14, 2.15, 2.16, 2.17, 2.18, 2.19, 2.20, 2.21**

Property 2: Preservation - Existing Calculations and Pipeline Unchanged

_For any_ input that does NOT trigger the bug condition (non-affected chapters, existing calculation formulas, database query patterns, traceability items), the fixed system SHALL produce the same result as the original system, preserving all cost formulas, caliber logic, engagement/viral metric calculations, Prisma query patterns, and pipeline architecture.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `src/prompts/chapters/chapter-03-data-overview.md`

**Specific Changes**:
1. **Restructure output instructions**: Replace the single KPI table with two separate tables:
   - Table 1 (传播类指标): 曝光/阅读/互动/爆文率 with columns KPI目标 | 实际达成(↑/↓) | 完成率(green≥100%/red<100%)
   - Table 2 (效率类指标): CPM/CPC/CPE/CTR with columns 实际达成 | 大盘均值区间 | 优于/劣于大盘%(green/red)
2. **Remove bar chart instruction**: Delete any "核心KPI完成率对比" bar chart reference from the prompt

---

**File**: `src/prompts/chapters/chapter-04-highlights.md`

**Specific Changes**:
1. **Replace AIPS framework**: Change system_prompt from "采用AIPS模型框架" to "使用2-5个编号亮点，每个亮点包含：标题 + 支撑数据 + 大盘对比"
2. **Update output format**: Instruct AI to output numbered highlights with concrete data (e.g., "亮点1：爆文频出，爆文率远超KPI\n爆文率：82.6% KPI：35%")
3. **Add 品牌心智数据解读 section**: Reference new `{{brand_mind_summary}}` variable

**File**: `src/pipeline/loaders/chapter-04-highlights.ts`

**Specific Changes**:
1. **Extract additional lingxi fields**: Read `aipsChange` (本品变化率), `tiChange` (TI本品变化率), `aipsIndustryRank` (人群规模行业排名) from lingxi_data.dataContent
2. **Generate brand_mind_summary variable**: Build AI-consumable summary string from AIPS/TI data for "品牌心智数据解读" section
3. **Add lingxi_screenshot_ref variable**: Provide placeholder reference for screenshot evidence

---

**File**: `src/pipeline/loaders/chapter-05-quadrant-analysis.ts`

**Function**: `load()`

**Specific Changes** (COMPLETE REWRITE of classification logic):
1. **Replace benchmark-based classification**: Remove all benchmark comparison logic
2. **Read engageRate from notes**: Use `notes.engageRate` field (already in schema) as Y-axis metric
3. **Compute 投流CPE per note**: Calculate `juguang.fee / juguang.interaction` per note as X-axis metric
4. **Normalize to 0-1**: Y score = (engageRate - MIN) / (MAX - MIN) from ALL notes; X score = 1 - (投流CPE - MIN) / (MAX - MIN) from traffic notes only (inverted)
5. **Dynamic dividing lines**: Y dividing line = AVG(Y scores); X dividing line = AVG(X scores)
6. **Quadrant assignment**: Y≥Yavg AND X≥Xavg → 核心资产; Y≥Yavg AND X<Xavg → 潜力内容; Y<Yavg AND X≥Xavg → 流量消耗; Y<Yavg AND X<Xavg → 淘汰候选
7. **Edge cases**: interaction=0 → exclude from quadrant; only 1 traffic note → X score = 0.5, skip quadrant assignment
8. **Output new variables**: quadrant_cards (count + avg CPE per quadrant), scatter_data (numbered points), detail_table (编号|创作者昵称|互动率|投流CPE|资源含税成本价/售价|投流消耗|象限归属)

**File**: `src/prompts/chapters/chapter-05-quadrant-analysis.md`

**Specific Changes**:
1. **Update system_prompt**: Replace benchmark-based quadrant definitions with engage_rate × 投流CPE methodology
2. **Update output structure**: Add 4 quadrant summary cards, scatter plot description, new detail table format
3. **Update axis labels**: X="投流CPE（投放效率）→ 低", Y="← 互动率（内容质量）高"

---

**File**: `src/pipeline/loaders/chapter-06-content-analysis.ts`

**Function**: `aggregate()`

**Specific Changes**:
1. **Add missing columns to aggregate function**: Include CPM (SUM(totalCost)/SUM(impNum)*1000), CPC (SUM(totalCost)/SUM(readNum)), CPI (SUM(totalCost)/SUM(iUserNum)) in output
2. **Track iUserNum in EnrichedNote**: Load and aggregate `iUserNum` from juguang_data per note (already loading tiUserNum, add iUserNum)
3. **Update table header row**: Reflect 12 columns

**File**: `src/prompts/chapters/chapter-06-content-analysis.md`

**Specific Changes**:
1. **Update table headers**: Add CPM, CPC, CPI, CPTI columns to all dimension tables
2. **Add table header wrapping instruction**: Add CSS/formatting note for PDF export compatibility
3. **Restructure note analysis format**: Change TOP5 to include [封面缩略图] @创作者昵称, 标题, 曝光/互动/CPE, 封面分析, 标题分析, 内容结构(开头→中间→结尾), 成功/失败原因

---

**File**: `src/pipeline/loaders/chapter-07-traffic-analysis.ts`

**Specific Changes**:
1. **Fix kol_nick_name display**: Ensure fallback shows empty string or "未知达人" instead of raw noteId
2. **Restructure note table columns**: Output 创作者昵称|消耗|展现量|点击量|CTR|CPE|CPTI|评价
3. **Add ad type summary table**: Compute GROUP BY placement summary with 消费|展现量|点击量|互动量|CPM|CPC|CTR|CPE|CPI|CPTI + 总计 row, stored as new `ad_type_summary_table` variable
4. **Add daily trend aggregation**: GROUP BY `time` field (stat_date), compute daily CPM/CPC/CPE, output as structured JSON for chart rendering
5. **Load launchPhases from review_configs**: Read period definitions for chart background colors

**File**: `src/prompts/chapters/chapter-07-traffic-analysis.md`

**Specific Changes**:
1. **Update note table header**: Change column order to 创作者昵称|消耗|展现量|点击量|CTR|CPE|CPTI|评价
2. **Add ad type summary section**: Reference `{{ad_type_summary_table}}` above note detail
3. **Add daily trend section**: Reference `{{daily_trend_data}}` for CPM/CPC/CPE line chart with period colors

---

**File**: `src/prompts/chapters/chapter-09-optimization-suggestions.md`

**Specific Changes**:
1. **Add anti-hallucination constraints to system_prompt**:
   - "严禁编造任何数据，包括但不限于：LTV倍数、客单价、年龄段占比、具体人群画像百分比"
   - "所有建议必须基于上方提供的实际数据，不得引用未在数据中出现的指标"
   - "不得使用 Lookalike、Retargeting 等具体投放策略术语，除非数据中明确包含相关字段"
2. **Add data boundary statement**: Explicitly list what data is available and instruct the AI to only reference those fields

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that invoke each data loader with mock project data and assert the output variables match the expected specification format. Run these on UNFIXED code to observe failures.

**Test Cases**:
1. **Chapter 3 Table Structure Test**: Invoke DataOverviewDataLoader, assert output variables contain data for TWO separate tables (will fail — current code outputs single table data)
2. **Chapter 4 Framework Test**: Invoke HighlightsDataLoader, check that `brand_mind_summary` variable exists and lingxi fields include aipsChange/tiChange (will fail — fields not extracted)
3. **Chapter 5 Classification Test**: Invoke QuadrantAnalysisDataLoader with notes that have engageRate and juguang interaction data, assert quadrant assignment uses normalized scores (will fail — uses benchmark comparison)
4. **Chapter 6 Columns Test**: Check aggregate() output string has 12 pipe-separated columns (will fail — only 10 columns)
5. **Chapter 7 Display Name Test**: Invoke TrafficAnalysisDataLoader, check traffic_by_note does not contain UUID-format strings (may fail — depends on kolNickName availability)
6. **Chapter 9 Prompt Constraints Test**: Read prompt template, assert system_prompt contains "严禁编造" string (will fail — no such constraint exists)

**Expected Counterexamples**:
- Chapter 5 produces empty quadrants when benchmark values are 0 or close to actual values
- Chapter 6 tables only have 10 columns instead of 12
- Chapter 9 prompt has no anti-hallucination text

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := fixedLoader(input)
  ASSERT matchesSpecification(result, input.chapterNumber)
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT originalLoader(input).calculations = fixedLoader(input).calculations
  ASSERT originalLoader(input).traceItems.format = fixedLoader(input).traceItems.format
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain (varying note counts, metric values, caliber settings)
- It catches edge cases that manual unit tests might miss (e.g., zero impressions, null engageRate)
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for calculation outputs (CPM/CPC/CPE/CTR values, cost calculations), then write property-based tests capturing that behavior persists after fix.

**Test Cases**:
1. **Cost Calculation Preservation**: Verify totalCost, contentCost, trafficCost calculations produce same values before/after fix for all caliber combinations
2. **Engagement Calculation Preservation**: Verify total engagement calculation is unchanged for both include_follow and exclude_follow calibers
3. **Viral Count Preservation**: Verify viral count and rate remain unchanged for both like_only and like_comment_share metrics
4. **TraceItem Format Preservation**: Verify all trace items maintain same structure (traceId, chapterNumber, columns, calculations format)

### Unit Tests

- Test chapter-05 quadrant classification with known engageRate and CPE values — verify correct quadrant assignment
- Test chapter-05 edge cases: single traffic note → X=0.5; interaction=0 → excluded
- Test chapter-06 aggregate() function produces 12 columns
- Test chapter-07 daily trend aggregation groups by `time` field correctly
- Test chapter-09 prompt template contains anti-hallucination text

### Property-Based Tests

- Generate random note sets with varying engageRate (0-100%) and juguang fee/interaction values, verify quadrant normalization produces scores in [0,1] range and assignments are consistent
- Generate random sets of notes with varying metrics, verify CPM/CPC/CPE/CTR calculations in chapter-03 and chapter-06 loaders remain unchanged
- Generate random review_configs with various benchmark ranges and caliber settings, verify preservation of existing cost/engagement calculations

### Integration Tests

- Full pipeline test: invoke each fixed loader with realistic mock data, feed output into prompt template interpolation, verify the interpolated prompt contains correct table structures
- Test chapter-05 end-to-end with a project that has 10+ notes with traffic data — verify scatter plot data and quadrant cards are populated
- Test chapter-07 with notes where kolNickName is null — verify graceful fallback (not raw UUID)
