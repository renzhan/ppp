# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Report Chapter Output Does Not Match Specification
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bugs exist
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples demonstrating that chapters 3-7 and 9 produce incorrect output
  - **Scoped PBT Approach**: For each chapter, scope the property to concrete failing cases:
    - Ch3: Assert prompt template output instructions reference TWO separate tables (传播类 + 效率类) — currently one combined table
    - Ch4: Assert `brand_mind_summary` variable exists in loader output and system_prompt does NOT contain "AIPS模型框架"
    - Ch5: Assert quadrant classification uses engageRate × 投流CPE normalization, not benchmark comparison
    - Ch6: Assert aggregate() output has 12 pipe-separated columns (currently 10)
    - Ch7: Assert traffic_by_note does not contain UUID-format strings as first column; assert `ad_type_summary_table` and `daily_trend_data` variables exist
    - Ch9: Assert system_prompt contains anti-hallucination constraints ("严禁编造")
  - Run test on UNFIXED code - expect FAILURE (this confirms the bugs exist)
  - Document counterexamples: e.g., "Ch5 quadrant uses benchmarkCpm comparison instead of normalized engageRate × CPE"
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.12, 1.13, 1.14, 1.15, 1.16, 1.17, 1.18, 1.19, 1.20, 1.21_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Existing Calculations and Pipeline Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: DataOverviewDataLoader CPM/CPC/CPE/CTR calculations on unfixed code with test data
  - Observe: HighlightsDataLoader KPI completion rate formulas (isCost ? target/actual*100 : actual/target*100)
  - Observe: ContentAnalysisDataLoader grouping logic and existing aggregate columns (篇数|曝光量|阅读量|互动量|TI人群|CPTI|CPE|爆文篇数|爆文率)
  - Observe: TrafficAnalysisDataLoader placement label mapping and GROUP BY aggregation
  - Observe: TraceItem construction format (traceId, chapterNumber, label, sourceTable, sourceQuery, columns, dataRows, calculations)
  - Write property-based tests: for all inputs where isBugCondition returns false (unchanged chapters, existing formulas), verify:
    - Cost formulas: CPM = totalCost/impressions*1000, CPC = totalCost/reads, CPE = totalCost/engagement, CTR = reads/impressions*100
    - Caliber logic: content/traffic cost caliber selection from review_configs.modules
    - Engagement metric: include_follow vs exclude_follow produce same results as before
    - Viral metric: like_only vs like_comment_share thresholds unchanged
    - TraceItem format: all loaders produce traceItems with correct structure
    - Placement mapping: 1=信息流, 2=搜索, 4=全站智投, 7=视频流
  - Verify tests PASS on UNFIXED code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9_

- [x] 3. Fix Chapter 3 - 数据总览 (Data Overview)

  - [x] 3.1 Update prompt template `src/prompts/chapters/chapter-03-data-overview.md`
    - Replace single combined KPI table with TWO separate tables in output instructions
    - Table 1 (传播类指标): 曝光/阅读/互动/爆文率 with columns: KPI目标 | 实际达成(↑ if ≥ target, ↓ if below) | 完成率(green+↑ if ≥100%, red+↓ if <100%)
    - Table 2 (效率类指标): CPM/CPC/CPE/CTR with columns: 实际达成 | 大盘均值区间 | 优于/劣于大盘%(green if better, red if worse)
    - Remove "核心KPI完成率对比" bar chart reference
    - Instruct AI to output structured tables, not prose descriptions
    - _Bug_Condition: chapterNumber==3 AND outputMissesKPIComparisonTables_
    - _Expected_Behavior: Two separate KPI tables with color coding and directional arrows_
    - _Preservation: All existing data variables (kpi_*, *_completion, benchmark_*) remain unchanged_
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.2 Verify data loader `src/pipeline/loaders/chapter-03-data-overview.ts` already computes required variables
    - Confirm all needed template variables exist: kpi_impression, impression_completion, benchmark_cpm, etc.
    - No data loader changes needed for Chapter 3 (data is already available)
    - _Requirements: 3.1, 3.2_

- [x] 4. Fix Chapter 4 - 项目亮点 (Highlights)

  - [x] 4.1 Update prompt template `src/prompts/chapters/chapter-04-highlights.md`
    - Replace AIPS framework ("被看见/被种草/被分享") in system_prompt with numbered highlights format
    - New system_prompt: instruct AI to use 2-5 numbered highlights, each with title + supporting data + benchmark comparison
    - Add "品牌心智数据解读" section referencing `{{brand_mind_summary}}`
    - Update output format to require concrete data (e.g., "亮点1：爆文频出\n爆文率：82.6% KPI：35% 完成率：236%")
    - _Bug_Condition: chapterNumber==4 AND outputUsesAIPSFramework_
    - _Expected_Behavior: Numbered highlights with data support, brand mind summary section_
    - _Preservation: Existing KPI completion formulas, benchmark comparison logic unchanged_
    - _Requirements: 2.5, 2.6, 2.7, 2.8_

  - [x] 4.2 Update data loader `src/pipeline/loaders/chapter-04-highlights.ts`
    - Extract additional lingxi fields: `aipsChange` (本品变化率), `tiChange` (TI本品变化率), `aipsIndustryRank` (人群规模行业排名)
    - Generate `brand_mind_summary` variable: AI-consumable summary from AIPS/TI data for "品牌心智数据解读"
    - Add `lingxi_screenshot_ref` variable: placeholder reference for灵犀 backend screenshots
    - _Bug_Condition: lingxi_data exists but aipsChange/tiChange/aipsIndustryRank not extracted_
    - _Expected_Behavior: brand_mind_summary variable populated with structured AIPS/TI data_
    - _Preservation: Existing KPI highlights, benchmark highlights, viral highlights calculations unchanged (3.3)_
    - _Requirements: 2.7, 2.8, 3.3_

- [x] 5. Fix Chapter 5 - 综合分析/四象限 (Quadrant Analysis) — COMPLETE REWRITE

  - [x] 5.1 Rewrite quadrant classification in `src/pipeline/loaders/chapter-05-quadrant-analysis.ts`
    - Remove ALL benchmark-based classification logic (noteQualityGood/trafficQualityGood comparisons)
    - Read `engageRate` field from notes (Y-axis metric representing content quality/互动率)
    - Compute 投流CPE per note: `juguang.fee / juguang.interaction` (X-axis metric)
    - Normalize Y to 0-1: Y_score = (engageRate - MIN_engageRate) / (MAX_engageRate - MIN_engageRate)
    - Normalize X to 0-1 (inverted): X_score = 1 - (投流CPE - MIN_CPE) / (MAX_CPE - MIN_CPE)
    - Dynamic dividing lines: Y_avg = MEAN(Y_scores), X_avg = MEAN(X_scores)
    - Quadrant assignment: Y≥Yavg AND X≥Xavg → 核心资产; Y≥Yavg AND X<Xavg → 潜力内容; Y<Yavg AND X≥Xavg → 流量消耗; Y<Yavg AND X<Xavg → 淘汰候选
    - Edge cases: interaction=0 → exclude from quadrant (treat as no traffic data); only 1 traffic note → X_score = 0.5
    - Output new variables: `quadrant_cards` (4 cards with count + avg metrics), `scatter_data` (numbered points with coordinates), `detail_table` (编号|创作者昵称|互动率|投流CPE|资源含税成本价|投流消耗|象限归属)
    - _Bug_Condition: quadrantUsesWrongClassification — benchmark comparison produces empty/incorrect quadrants_
    - _Expected_Behavior: Normalized engageRate × 投流CPE classification with dynamic dividing lines_
    - _Preservation: Notes without juguang_data still excluded from quadrant analysis (3.8), traceItem format preserved (3.7)_
    - _Requirements: 2.12, 2.13, 2.14, 3.7, 3.8_

  - [x] 5.2 Update prompt template `src/prompts/chapters/chapter-05-quadrant-analysis.md`
    - Replace benchmark-based quadrant definitions in system_prompt with engageRate × 投流CPE methodology
    - Update quadrant names: 核心资产, 潜力内容, 流量消耗, 淘汰候选
    - Update axis labels: X="投流CPE（投放效率）→ 低" (inverted, lower CPE = better), Y="← 互动率（内容质量）高"
    - Add 4 quadrant summary cards section referencing `{{quadrant_cards}}`
    - Add scatter plot data section referencing `{{scatter_data}}`
    - Update detail table format: 编号|创作者昵称|互动率|投流CPE|资源含税成本价/售价|投流消耗|象限归属
    - _Requirements: 2.12, 2.13_

- [x] 6. Fix Chapter 6 - 内容分析 (Content Analysis)

  - [x] 6.1 Update data loader `src/pipeline/loaders/chapter-06-content-analysis.ts`
    - Add `iUserNum` tracking in EnrichedNote interface (load from juguangMap alongside tiUserNum)
    - Modify `aggregate()` function to include 3 additional columns: CPM (SUM(totalCost)/SUM(impNum)*1000), CPC (SUM(totalCost)/SUM(readNum)), CPI (SUM(totalCost)/SUM(iUserNum))
    - Update aggregate output to produce 12 pipe-separated columns: 维度|篇数|曝光量|阅读量|互动量|爆文数|爆文率|CPM|CPC|CPE|CPI|CPTI
    - _Bug_Condition: tablesMissingColumns — aggregate outputs only 10 columns_
    - _Expected_Behavior: 12 columns in aggregate output matching specification_
    - _Preservation: Existing grouping logic by contentDirection/kolTier/noteType unchanged (3.4), existing CPE/CPTI formulas preserved_
    - _Requirements: 2.9, 3.4_

  - [x] 6.2 Update prompt template `src/prompts/chapters/chapter-06-content-analysis.md`
    - Update all 4 dimension table headers to include 12 columns: 维度|篇数|曝光量|阅读量|互动量|爆文数|爆文率|CPM|CPC|CPE|CPI|CPTI
    - Add table header wrapping CSS instruction for PDF export: instruct AI to use `word-wrap: break-word` or short header labels
    - Restructure TOP5 note analysis format: [封面缩略图] @创作者昵称, 标题, 曝光/互动/CPE, 封面分析, 标题分析, 内容结构(开头→中间→结尾), 成功/失败原因
    - _Bug_Condition: prompt headers show 10 columns and TOP5 lacks structured analysis_
    - _Expected_Behavior: 12-column headers and structured note analysis with cover/title/content analysis_
    - _Requirements: 2.9, 2.10, 2.11_

- [x] 7. Fix Chapter 7 - 投流分析 (Traffic Analysis)

  - [x] 7.1 Update data loader `src/pipeline/loaders/chapter-07-traffic-analysis.ts`
    - Fix kol_nick_name fallback: replace `noteId` fallback with "未知达人" when kolNickName is empty
    - Restructure note table columns: output 创作者昵称|消耗|展现量|点击量|CTR|CPE|CPTI|评价
    - Add `ad_type_summary_table` variable: GROUP BY placement summary table with 消费|展现量|点击量|互动量|CPM|CPC|CTR|CPE|CPI|CPTI + 总计 row
    - Add daily trend aggregation: GROUP BY `time` field from juguangData, compute daily CPM/CPC/CPE, output as `daily_trend_data` JSON for chart rendering
    - Load `launchPhases` from review_configs for investment period background colors (预热期/爆发期/持续期)
    - _Bug_Condition: noteTableShowsRawIds AND missing daily trend AND missing ad type summary_
    - _Expected_Behavior: Creator nicknames displayed, ad_type_summary_table and daily_trend_data variables populated_
    - _Preservation: Existing GROUP BY placement/targetsDetail/keyword aggregation logic unchanged (3.5), placement label mapping preserved_
    - _Requirements: 2.15, 2.16, 2.17, 2.18, 2.19, 3.5_

  - [x] 7.2 Update prompt template `src/prompts/chapters/chapter-07-traffic-analysis.md`
    - Update note table header to: 创作者昵称|消耗|展现量|点击量|CTR|CPE|CPTI|评价
    - Add ad type summary section: reference `{{ad_type_summary_table}}` above note detail with 消费|展现量|点击量|互动量|CPM|CPC|CTR|CPE|CPI|CPTI
    - Add daily trend section: reference `{{daily_trend_data}}` for CPM/CPC/CPE line chart with period background colors
    - Add 数据解读 instruction for traffic overview
    - _Requirements: 2.15, 2.16, 2.17, 2.18, 2.19_

- [x] 8. Fix Chapter 9 - 优化建议 (Optimization Suggestions) — Prompt-Only

  - [x] 8.1 Update prompt template `src/prompts/chapters/chapter-09-optimization-suggestions.md`
    - Add anti-hallucination constraints to system_prompt:
      - "严禁编造任何数据，包括但不限于：LTV倍数、客单价、年龄段占比、具体人群画像百分比"
      - "所有建议必须基于上方提供的实际数据，不得引用未在数据中出现的指标"
      - "不得使用 Lookalike、Retargeting 等具体投放策略术语，除非数据中明确包含相关字段"
      - "如果某维度数据不足以支撑建议，请注明'数据不足，暂无法给出具体建议'"
    - Add explicit data boundary statement listing available variables
    - _Bug_Condition: outputContainsHallucinatedData — AI fabricates LTV, customer unit prices, age demographics_
    - _Expected_Behavior: AI only references data present in input, no fabricated metrics_
    - _Preservation: Existing data variables (underperforming_metrics, content_direction_performance, traffic_efficiency) unchanged (3.6)_
    - _Requirements: 2.20, 2.21, 3.6_

- [x] 9. Implementation verification

  - [x] 9.1 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Report Chapter Output Matches Specification
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms all 6 chapter bugs are fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 2.12, 2.13, 2.14, 2.15, 2.16, 2.17, 2.18, 2.19, 2.20, 2.21_

  - [x] 9.2 Verify preservation tests still pass
    - **Property 2: Preservation** - Existing Calculations and Pipeline Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all cost calculations, caliber logic, engagement/viral metrics, traceItem format unchanged

- [x] 10. Checkpoint - Ensure all tests pass
  - Run full test suite to verify no regressions across all chapters
  - Verify TypeScript compilation succeeds (`npx tsc --noEmit`)
  - Ensure all tests pass, ask the user if questions arise
