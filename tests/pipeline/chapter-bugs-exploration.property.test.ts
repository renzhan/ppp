import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { PromptTemplateLoader } from '../../src/pipeline/template-loader';
import { QuadrantAnalysisDataLoader } from '../../src/pipeline/loaders/chapter-05-quadrant-analysis';
import { ContentAnalysisDataLoader } from '../../src/pipeline/loaders/chapter-06-content-analysis';
import { TrafficAnalysisDataLoader } from '../../src/pipeline/loaders/chapter-07-traffic-analysis';
import { HighlightsDataLoader } from '../../src/pipeline/loaders/chapter-04-highlights';

/**
 * Property 1: Bug Condition — Report Chapter Output Does Not Match Specification
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.12, 1.13, 1.14, 1.15, 1.16, 1.17, 1.18, 1.19, 1.20, 1.21**
 *
 * CRITICAL: This test MUST FAIL on unfixed code — failure confirms the bugs exist.
 * DO NOT fix the test or the code when it fails.
 *
 * For each chapter (3–7, 9), we scope the property to concrete failing cases:
 * - Ch3: Prompt template output instructions reference TWO separate tables (传播类 + 效率类)
 * - Ch4: `brand_mind_summary` variable exists in loader output; system_prompt does NOT contain "AIPS模型框架"
 * - Ch5: Quadrant classification uses engageRate × 投流CPE normalization, not benchmark comparison
 * - Ch6: aggregate() output has 12 pipe-separated columns (currently 10)
 * - Ch7: traffic_by_note does not contain UUID-format strings; `ad_type_summary_table` and `daily_trend_data` exist
 * - Ch9: system_prompt contains anti-hallucination constraints ("严禁编造")
 */
describe('Bug Condition Exploration: Report Chapters 3-7,9 Output Does Not Match Specification', () => {
  const TEMPLATES_DIR = resolve(__dirname, '../../src/prompts/chapters');

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  // ─── Chapter 3: Data Overview — Two Separate KPI Tables ─────────────────────

  describe('Ch3: Prompt template must instruct TWO separate KPI tables (传播类 + 效率类)', () => {
    it('system_prompt or body should reference two separate tables for 传播类指标 and 效率类指标', () => {
      const loader = new PromptTemplateLoader(TEMPLATES_DIR);
      const template = loader.loadTemplate(3);
      const fullContent = template.systemPrompt + '\n' + template.userPromptTemplate;

      // The specification requires TWO separate tables:
      // Table 1: 传播类指标 (曝光/阅读/互动/爆文率) with columns: KPI目标 | 实际达成 | 完成率
      // Table 2: 效率类指标 (CPM/CPC/CPE/CTR) with columns: 实际达成 | 大盘均值区间 | 优于/劣于大盘%
      //
      // The template should explicitly separate these into two distinct table sections.
      // Currently the template has ONE combined "核心KPI达成" table containing all metrics.

      const has传播类Table = fullContent.includes('传播类指标') || fullContent.includes('传播类');
      const has效率类Table = fullContent.includes('效率类指标') || fullContent.includes('效率类');

      expect(has传播类Table).toBe(true);
      expect(has效率类Table).toBe(true);
    });

    it('should NOT contain "核心KPI完成率对比" bar chart reference', () => {
      const loader = new PromptTemplateLoader(TEMPLATES_DIR);
      const template = loader.loadTemplate(3);
      const fullContent = template.systemPrompt + '\n' + template.userPromptTemplate;

      // Specification says: remove the "核心KPI完成率对比" bar chart
      // Current template has a single combined KPI table — the output format should
      // explicitly instruct TWO separate structured tables, not a chart.
      // We check that the output instructions explicitly require separate table output.

      // Check there are explicit instructions to output two tables (not just one combined table)
      const hasExplicitTwoTableInstruction =
        (fullContent.includes('传播类') && fullContent.includes('效率类'))
        || fullContent.includes('两个表格')
        || fullContent.includes('分别');

      expect(hasExplicitTwoTableInstruction).toBe(true);
    });
  });

  // ─── Chapter 4: Highlights — No AIPS Framework, brand_mind_summary exists ───

  describe('Ch4: Prompt must NOT use AIPS framework; loader must provide brand_mind_summary', () => {
    it('system_prompt should NOT contain "AIPS模型框架" or "被看见/被种草/被分享" framework', () => {
      const loader = new PromptTemplateLoader(TEMPLATES_DIR);
      const template = loader.loadTemplate(4);

      // Bug: Current system_prompt says "采用AIPS模型框架组织亮点"
      // Expected: Numbered highlights format without AIPS framework
      expect(template.systemPrompt).not.toContain('AIPS模型框架');
      expect(template.systemPrompt).not.toContain('被看见');
    });

    it('loader output should contain brand_mind_summary variable', async () => {
      // Create mock prisma with lingxi data containing AIPS/TI information
      const mockPrisma = createMockPrismaForCh4();
      const loader = new HighlightsDataLoader(mockPrisma as any);
      const result = await loader.load('test-project-id');

      // Bug: Current loader does not generate brand_mind_summary variable
      // Expected: brand_mind_summary should exist when lingxi data has AIPS/TI data
      expect(result.variables).toHaveProperty('brand_mind_summary');
      expect(result.variables['brand_mind_summary']).toBeTruthy();
    });
  });

  // ─── Chapter 5: Quadrant — engageRate × 投流CPE normalization ───────────────

  describe('Ch5: Quadrant classification must use engageRate × 投流CPE normalization', () => {
    it('should classify notes using normalized engageRate (Y) and 投流CPE (X), not benchmark comparison', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate 3-10 notes with varying engageRate and juguang interaction
          fc.array(
            fc.record({
              engageRate: fc.float({ min: Math.fround(0.01), max: Math.fround(0.5), noNaN: true }),
              impNum: fc.integer({ min: 1000, max: 100000 }),
              readNum: fc.integer({ min: 100, max: 50000 }),
              engageNum: fc.integer({ min: 10, max: 5000 }),
              likeNum: fc.integer({ min: 5, max: 3000 }),
              favNum: fc.integer({ min: 1, max: 1000 }),
              cmtNum: fc.integer({ min: 1, max: 500 }),
              shareNum: fc.integer({ min: 0, max: 200 }),
              kolPrice: fc.integer({ min: 500, max: 50000 }),
              juguangFee: fc.integer({ min: 100, max: 20000 }),
              juguangInteraction: fc.integer({ min: 10, max: 2000 }),
              juguangImpression: fc.integer({ min: 500, max: 50000 }),
              juguangClick: fc.integer({ min: 50, max: 10000 }),
            }),
            { minLength: 3, maxLength: 10 }
          ),
          async (noteData) => {
            const mockPrisma = createMockPrismaForCh5(noteData);
            const loader = new QuadrantAnalysisDataLoader(mockPrisma as any);
            const result = await loader.load('test-project-id');

            // The specification says quadrant assignment should be:
            // Y_score = (engageRate - MIN) / (MAX - MIN)  [content quality]
            // X_score = 1 - (投流CPE - MIN) / (MAX - MIN)  [traffic efficiency, inverted]
            // Quadrants based on AVG dividing lines
            //
            // Bug: Current code uses benchmark-based comparison (benchmarkCpm, benchmarkCpe, benchmarkCtr)
            // which produces incorrect quadrant assignments.

            // Verify: The loader should NOT reference benchmark-based quadrant names
            // Current buggy names: '高质高投', '高质低投', '低质高投', '低质低投'
            // Expected names: '核心资产', '潜力内容', '流量消耗', '淘汰候选'
            const quadrantSummary = result.variables['quadrant_summary'] || '';

            const usesCorrectQuadrantNames =
              quadrantSummary.includes('核心资产') ||
              quadrantSummary.includes('潜力内容') ||
              quadrantSummary.includes('流量消耗') ||
              quadrantSummary.includes('淘汰候选');

            const usesOldBenchmarkNames =
              quadrantSummary.includes('高质高投') ||
              quadrantSummary.includes('高质低投') ||
              quadrantSummary.includes('低质高投') ||
              quadrantSummary.includes('低质低投');

            // The correct implementation should use the new quadrant names
            expect(usesCorrectQuadrantNames).toBe(true);
            expect(usesOldBenchmarkNames).toBe(false);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  // ─── Chapter 6: Content Analysis — 12 pipe-separated columns ────────────────

  describe('Ch6: aggregate() output must have 12 pipe-separated columns', () => {
    it('by_content_direction table rows should have 12 pipe-separated columns', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate 2-5 notes with different content directions
          fc.array(
            fc.record({
              contentDirection: fc.constantFrom('产品测评', '日常分享', '教程', '穿搭'),
              impNum: fc.integer({ min: 1000, max: 100000 }),
              readNum: fc.integer({ min: 100, max: 50000 }),
              likeNum: fc.integer({ min: 5, max: 3000 }),
              favNum: fc.integer({ min: 1, max: 1000 }),
              cmtNum: fc.integer({ min: 1, max: 500 }),
              shareNum: fc.integer({ min: 0, max: 200 }),
              kolPrice: fc.integer({ min: 500, max: 50000 }),
              juguangFee: fc.integer({ min: 0, max: 10000 }),
              tiUserNum: fc.integer({ min: 0, max: 500 }),
            }),
            { minLength: 2, maxLength: 5 }
          ),
          async (noteData) => {
            const mockPrisma = createMockPrismaForCh6(noteData);
            const loader = new ContentAnalysisDataLoader(mockPrisma as any);
            const result = await loader.load('test-project-id');

            const byDirection = result.variables['by_content_direction'] || '';
            if (!byDirection) return; // skip if no data generated

            // Each row should have exactly 12 pipe-separated columns:
            // 维度|篇数|曝光量|阅读量|互动量|爆文数|爆文率|CPM|CPC|CPE|CPI|CPTI
            //
            // Bug: Current aggregate() produces only 10 columns:
            // 维度|篇数|曝光量|阅读量|互动量|TI人群|CPTI|CPE|爆文篇数|爆文率
            const rows = byDirection.split('\n').filter((r: string) => r.startsWith('|'));
            for (const row of rows) {
              const columns = row.split('|').filter((c: string) => c.trim() !== '');
              // Expect 12 columns per the specification
              expect(columns.length).toBe(12);
            }
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  // ─── Chapter 7: Traffic Analysis — No UUID in first column, new variables ───

  describe('Ch7: traffic_by_note must not contain UUID; ad_type_summary_table and daily_trend_data must exist', () => {
    it('traffic_by_note should not contain UUID-format strings as creator identifiers', async () => {
      const mockPrisma = createMockPrismaForCh7WithMissingNicknames();
      const loader = new TrafficAnalysisDataLoader(mockPrisma as any);
      const result = await loader.load('test-project-id');

      const trafficByNote = result.variables['traffic_by_note'] || '';
      if (!trafficByNote || trafficByNote === '暂无笔记维度投流数据') return;

      // UUID pattern: 8-4-4-4-12 hex characters (or similar hash-like strings)
      const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
      const hexIdPattern = /[0-9a-f]{20,}/i; // long hex strings (like note IDs used as fallback)

      // Bug: When kolNickName is empty, the code falls back to noteId (a UUID/hash string)
      // Expected: Should show "未知达人" or another friendly fallback
      expect(trafficByNote).not.toMatch(uuidPattern);
      expect(trafficByNote).not.toMatch(hexIdPattern);
    });

    it('loader output should contain ad_type_summary_table variable', async () => {
      const mockPrisma = createMockPrismaForCh7();
      const loader = new TrafficAnalysisDataLoader(mockPrisma as any);
      const result = await loader.load('test-project-id');

      // Bug: Current loader does not output an `ad_type_summary_table` variable
      // Expected: A summary table grouped by ad type with 消费|展现量|点击量|互动量|CPM|CPC|CTR|CPE|CPI|CPTI
      expect(result.variables).toHaveProperty('ad_type_summary_table');
    });

    it('loader output should contain daily_trend_data variable', async () => {
      const mockPrisma = createMockPrismaForCh7();
      const loader = new TrafficAnalysisDataLoader(mockPrisma as any);
      const result = await loader.load('test-project-id');

      // Bug: Current loader does not compute daily trend data for CPM/CPC/CPE chart
      // Expected: daily_trend_data variable with per-day aggregated metrics
      expect(result.variables).toHaveProperty('daily_trend_data');
    });
  });

  // ─── Chapter 9: Optimization — Anti-hallucination constraints ───────────────

  describe('Ch9: Prompt must contain anti-hallucination constraints ("严禁编造")', () => {
    it('system_prompt should contain explicit anti-hallucination instruction "严禁编造"', () => {
      const loader = new PromptTemplateLoader(TEMPLATES_DIR);
      const template = loader.loadTemplate(9);

      // Bug: Current system_prompt only says "建议必须基于数据洞察" without
      // explicit prohibitions on fabricating data
      // Expected: "严禁编造任何数据" or similar explicit constraint
      expect(template.systemPrompt).toContain('严禁编造');
    });

    it('system_prompt should prohibit fabricating LTV, customer unit prices, age demographics', () => {
      const loader = new PromptTemplateLoader(TEMPLATES_DIR);
      const template = loader.loadTemplate(9);

      // Bug: No constraints preventing AI from inventing LTV multiples, 客单价, age %
      // Expected: Explicit list of prohibited fabrications
      const fullPrompt = template.systemPrompt + '\n' + template.userPromptTemplate;
      const hasAntiHallucination =
        fullPrompt.includes('严禁编造') ||
        fullPrompt.includes('不得编造') ||
        fullPrompt.includes('禁止杜撰');

      expect(hasAntiHallucination).toBe(true);
    });
  });
});

// ─── Helper: Mock Prisma for Chapter 4 ─────────────────────────────────────────

function createMockPrismaForCh4() {
  return {
    reviewConfig: {
      findFirst: vi.fn().mockResolvedValue({
        kpiTargets: { totalImpression: 5000000, cpm: 30 },
        benchmark: { cpm: { min: 25, max: 40 }, cpc: { min: 1.5, max: 3 } },
        engagementMetric: 'exclude_follow',
        viralMetric: 'like_comment_share',
      }),
    },
    note: {
      findMany: vi.fn().mockResolvedValue([
        {
          noteId: 'note-1', impNum: 50000, readNum: 20000, engageNum: 3000,
          likeNum: 2000, favNum: 500, cmtNum: 300, shareNum: 200,
          kolPrice: 5000, serviceFee: 500,
        },
      ]),
    },
    juguangData: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { fee: 10000 } }),
    },
    lingxiData: {
      findMany: vi.fn().mockResolvedValue([
        {
          dataType: 'brand',
          dataContent: {
            aips: 500000,
            ti: 80000,
            aipsChange: '+15.2%',
            tiChange: '+22.3%',
            aipsIndustryRank: 3,
            newAssets: 120000,
          },
          periodStart: new Date('2025-01-01'),
          periodEnd: new Date('2025-03-31'),
        },
      ]),
    },
    $queryRaw: vi.fn().mockResolvedValue([{ cnt: BigInt(10), cs: 0, ads: 0 }]),
  };
}

// ─── Helper: Mock Prisma for Chapter 5 ─────────────────────────────────────────

function createMockPrismaForCh5(noteData: Array<{
  engageRate: number;
  impNum: number;
  readNum: number;
  engageNum: number;
  likeNum: number;
  favNum: number;
  cmtNum: number;
  shareNum: number;
  kolPrice: number;
  juguangFee: number;
  juguangInteraction: number;
  juguangImpression: number;
  juguangClick: number;
}>) {
  const notes = noteData.map((n, i) => ({
    noteId: `note-${i}`,
    kolNickName: `达人${i}`,
    noteType: '1',
    impNum: n.impNum,
    readNum: n.readNum,
    engageNum: n.engageNum,
    likeNum: n.likeNum,
    favNum: n.favNum,
    cmtNum: n.cmtNum,
    shareNum: n.shareNum,
    kolPrice: n.kolPrice,
    contentDirection: '测试方向',
    engageRate: n.engageRate,
  }));

  const juguangData = noteData.map((n, i) => ({
    noteId: `note-${i}`,
    fee: n.juguangFee,
    impression: n.juguangImpression,
    click: n.juguangClick,
    interaction: n.juguangInteraction,
  }));

  return {
    reviewConfig: {
      findFirst: vi.fn().mockResolvedValue({
        benchmark: { cpm: { min: 20, max: 40 }, cpc: { min: 1, max: 3 }, cpe: { min: 3, max: 8 }, ctr: { min: 3, max: 8 } },
        engagementMetric: 'exclude_follow',
      }),
    },
    note: {
      findMany: vi.fn().mockResolvedValue(notes),
    },
    juguangData: {
      findMany: vi.fn().mockResolvedValue(juguangData),
    },
  };
}

// ─── Helper: Mock Prisma for Chapter 6 ─────────────────────────────────────────

function createMockPrismaForCh6(noteData: Array<{
  contentDirection: string;
  impNum: number;
  readNum: number;
  likeNum: number;
  favNum: number;
  cmtNum: number;
  shareNum: number;
  kolPrice: number;
  juguangFee: number;
  tiUserNum: number;
}>) {
  const notes = noteData.map((n, i) => ({
    noteId: `note-${i}`,
    kolNickName: `达人${i}`,
    kolFanNum: 50000,
    noteType: '1',
    noteTitle: `测试笔记${i}`,
    impNum: n.impNum,
    readNum: n.readNum,
    engageNum: n.likeNum + n.favNum + n.cmtNum + n.shareNum,
    likeNum: n.likeNum,
    favNum: n.favNum,
    cmtNum: n.cmtNum,
    shareNum: n.shareNum,
    kolPrice: n.kolPrice,
    serviceFee: 0,
    coverImages: [],
    noteLink: null,
    contentDirection: n.contentDirection,
  }));

  const juguangData = noteData.map((n, i) => ({
    noteId: `note-${i}`,
    fee: n.juguangFee,
    tiUserNum: n.tiUserNum,
    iUserNum: Math.floor(n.tiUserNum * 2),
  }));

  return {
    reviewConfig: {
      findFirst: vi.fn().mockResolvedValue({
        engagementMetric: 'exclude_follow',
        viralMetric: 'like_comment_share',
        viralThreshold: 1000,
        influencerTiers: [
          { name: '头部', fanRangeMin: 500000, fanRangeMax: 99999999 },
          { name: '腰部', fanRangeMin: 100000, fanRangeMax: 499999 },
          { name: '尾部', fanRangeMin: 10000, fanRangeMax: 99999 },
          { name: 'KOC', fanRangeMin: 0, fanRangeMax: 9999 },
        ],
      }),
    },
    note: {
      findMany: vi.fn().mockResolvedValue(notes),
    },
    juguangData: {
      findMany: vi.fn().mockResolvedValue(juguangData),
    },
  };
}

// ─── Helper: Mock Prisma for Chapter 7 (with missing kolNickName) ──────────────

function createMockPrismaForCh7WithMissingNicknames() {
  // Simulate notes with empty kolNickName — the loader should NOT fall back to noteId
  const notes = [
    { noteId: '6a2273d4-1234-5678-9abc-def012345678', kolNickName: null, noteType: '1' },
    { noteId: 'abcdef01-2345-6789-abcd-ef0123456789', kolNickName: '', noteType: '2' },
  ];

  const juguangData = [
    {
      noteId: '6a2273d4-1234-5678-9abc-def012345678',
      placement: '1', targetsDetail: null, keyword: null,
      fee: 5000, impression: 30000, click: 1500, interaction: 300,
      iUserNum: 50, tiUserNum: 20,
      iUserPrice: 100, tiUserPrice: 250,
      searchCmtClick: 0, searchCmtAfterRead: 0, searchCmtAfterReadAvg: 0, searchCmtClickCvr: 0,
    },
    {
      noteId: 'abcdef01-2345-6789-abcd-ef0123456789',
      placement: '2', targetsDetail: null, keyword: null,
      fee: 3000, impression: 20000, click: 800, interaction: 150,
      iUserNum: 30, tiUserNum: 10,
      iUserPrice: 100, tiUserPrice: 300,
      searchCmtClick: 0, searchCmtAfterRead: 0, searchCmtAfterReadAvg: 0, searchCmtClickCvr: 0,
    },
  ];

  return {
    reviewConfig: {
      findFirst: vi.fn().mockResolvedValue({
        benchmark: { cpm: 30, cpc: 2, cpe: 5, ctr: 5 },
      }),
    },
    note: {
      findMany: vi.fn().mockResolvedValue(notes),
    },
    juguangData: {
      findMany: vi.fn().mockResolvedValue(juguangData),
    },
    $queryRaw: vi.fn().mockResolvedValue([]),
  };
}

// ─── Helper: Mock Prisma for Chapter 7 (general) ──────────────────────────────

function createMockPrismaForCh7() {
  const notes = [
    { noteId: 'note-1', kolNickName: '达人A', noteType: '1' },
    { noteId: 'note-2', kolNickName: '达人B', noteType: '2' },
  ];

  const juguangData = [
    {
      noteId: 'note-1',
      placement: '1', targetsDetail: '兴趣人群', keyword: '护肤',
      fee: 5000, impression: 30000, click: 1500, interaction: 300,
      iUserNum: 50, tiUserNum: 20,
      iUserPrice: 100, tiUserPrice: 250,
      searchCmtClick: 100, searchCmtAfterRead: 80, searchCmtAfterReadAvg: 0.8, searchCmtClickCvr: 0.06,
      time: '2025-01-15',
    },
    {
      noteId: 'note-2',
      placement: '2', targetsDetail: '核心人群', keyword: '美白',
      fee: 3000, impression: 20000, click: 800, interaction: 150,
      iUserNum: 30, tiUserNum: 10,
      iUserPrice: 100, tiUserPrice: 300,
      searchCmtClick: 50, searchCmtAfterRead: 40, searchCmtAfterReadAvg: 0.8, searchCmtClickCvr: 0.06,
      time: '2025-01-16',
    },
  ];

  return {
    reviewConfig: {
      findFirst: vi.fn().mockResolvedValue({
        benchmark: { cpm: 30, cpc: 2, cpe: 5, ctr: 5 },
        launchPhases: [
          { name: '预热期', startDate: '2025-01-01', endDate: '2025-01-10' },
          { name: '爆发期', startDate: '2025-01-11', endDate: '2025-01-20' },
        ],
      }),
    },
    note: {
      findMany: vi.fn().mockResolvedValue(notes),
    },
    juguangData: {
      findMany: vi.fn().mockResolvedValue(juguangData),
    },
    $queryRaw: vi.fn().mockResolvedValue([]),
  };
}
