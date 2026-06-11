import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { DataOverviewDataLoader } from '../../src/pipeline/loaders/chapter-03-data-overview';
import { HighlightsDataLoader } from '../../src/pipeline/loaders/chapter-04-highlights';
import { ContentAnalysisDataLoader } from '../../src/pipeline/loaders/chapter-06-content-analysis';
import { TrafficAnalysisDataLoader } from '../../src/pipeline/loaders/chapter-07-traffic-analysis';

/**
 * Property 2: Preservation — Existing Calculations and Pipeline Unchanged
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9**
 *
 * These tests verify that existing behaviors are preserved on unfixed code.
 * They MUST PASS before and after the fix — ensuring no regressions.
 *
 * Observation-first methodology:
 * - Cost formulas: CPM = totalCost/impressions*1000, CPC = totalCost/reads, CPE = totalCost/engagement, CTR = reads/impressions*100
 * - Caliber logic: content/traffic cost caliber selection from review_configs.modules
 * - Engagement metric: include_follow vs exclude_follow
 * - Viral metric: like_only vs like_comment_share thresholds
 * - TraceItem format: traceId, chapterNumber, label, sourceTable, sourceQuery, columns, dataRows, calculations
 * - Placement mapping: 1=信息流, 2=搜索, 4=全站智投, 7=视频流
 */
describe('Preservation: Existing Calculations and Pipeline Unchanged', () => {

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  // ─── Cost Formula Preservation (Ch3) ─────────────────────────────────────────

  describe('Cost Formulas: CPM/CPC/CPE/CTR calculations remain unchanged', () => {
    it('should compute CPM = totalCost/impressions*1000, CPC = totalCost/reads, CPE = totalCost/engagement, CTR = reads/impressions*100', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              noteId: fc.string({ minLength: 5, maxLength: 10 }),
              impNum: fc.integer({ min: 100, max: 500000 }),
              readNum: fc.integer({ min: 10, max: 100000 }),
              engageNum: fc.integer({ min: 10, max: 50000 }),
              likeNum: fc.integer({ min: 5, max: 20000 }),
              favNum: fc.integer({ min: 1, max: 10000 }),
              cmtNum: fc.integer({ min: 1, max: 5000 }),
              shareNum: fc.integer({ min: 0, max: 2000 }),
              followNum: fc.integer({ min: 0, max: 500 }),
              kolPrice: fc.integer({ min: 500, max: 50000 }),
              serviceFee: fc.integer({ min: 0, max: 5000 }),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          fc.integer({ min: 0, max: 30000 }), // juguang fee
          async (noteData, jgFee) => {
            const mockPrisma = createMockPrismaForCh3(noteData, jgFee);
            const loader = new DataOverviewDataLoader(mockPrisma as any);
            const result = await loader.load('test-project-id');

            // Compute expected values manually
            const totalImpressions = noteData.reduce((s, n) => s + n.impNum, 0);
            const totalReads = noteData.reduce((s, n) => s + n.readNum, 0);
            // exclude_follow (default): like + fav + cmt + share
            const totalEngagement = noteData.reduce((s, n) => s + n.likeNum + n.favNum + n.cmtNum + n.shareNum, 0);
            const kolPriceSum = noteData.reduce((s, n) => s + n.kolPrice, 0);
            const serviceFeeSum = noteData.reduce((s, n) => s + n.serviceFee, 0);
            // Default caliber: consumption → contentCost = kolPrice + serviceFee
            const contentCost = kolPriceSum + serviceFeeSum;
            const trafficCost = jgFee;
            const totalCost = contentCost + trafficCost;

            const expectedCpm = totalImpressions > 0 ? (totalCost / totalImpressions) * 1000 : 0;
            const expectedCpc = totalReads > 0 ? totalCost / totalReads : 0;
            const expectedCpe = totalEngagement > 0 ? totalCost / totalEngagement : 0;
            const expectedCtr = totalImpressions > 0 ? (totalReads / totalImpressions) * 100 : 0;

            // Verify formulas match
            expect(result.variables['cpm']).toBe(expectedCpm.toFixed(2));
            expect(result.variables['cpc']).toBe(expectedCpc.toFixed(2));
            expect(result.variables['cpe']).toBe(expectedCpe.toFixed(2));
            expect(result.variables['ctr']).toBe(expectedCtr.toFixed(2));
            expect(result.variables['total_cost']).toBe(totalCost.toFixed(2));
            expect(result.variables['content_cost']).toBe(contentCost.toFixed(2));
            expect(result.variables['traffic_cost']).toBe(trafficCost.toFixed(2));
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  // ─── Caliber Logic Preservation ──────────────────────────────────────────────

  describe('Caliber Logic: content/traffic cost caliber selection from review_configs.modules', () => {
    it('settlement caliber uses serviceFee only for content cost', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              noteId: fc.string({ minLength: 5, maxLength: 10 }),
              impNum: fc.integer({ min: 100, max: 500000 }),
              readNum: fc.integer({ min: 10, max: 100000 }),
              engageNum: fc.integer({ min: 10, max: 50000 }),
              likeNum: fc.integer({ min: 5, max: 20000 }),
              favNum: fc.integer({ min: 1, max: 10000 }),
              cmtNum: fc.integer({ min: 1, max: 5000 }),
              shareNum: fc.integer({ min: 0, max: 2000 }),
              followNum: fc.integer({ min: 0, max: 500 }),
              kolPrice: fc.integer({ min: 500, max: 50000 }),
              serviceFee: fc.integer({ min: 100, max: 5000 }),
            }),
            { minLength: 1, maxLength: 3 }
          ),
          fc.integer({ min: 100, max: 30000 }), // juguang fee
          async (noteData, jgFee) => {
            const mockPrisma = createMockPrismaForCh3WithCaliber(noteData, jgFee, 'settlement', 'consumption');
            const loader = new DataOverviewDataLoader(mockPrisma as any);
            const result = await loader.load('test-project-id');

            // Settlement caliber → contentCost = serviceFee only (not kolPrice)
            const serviceFeeSum = noteData.reduce((s, n) => s + n.serviceFee, 0);
            const contentCost = serviceFeeSum;
            const trafficCost = jgFee;
            const totalCost = contentCost + trafficCost;

            expect(result.variables['content_cost']).toBe(contentCost.toFixed(2));
            expect(result.variables['traffic_cost']).toBe(trafficCost.toFixed(2));
            expect(result.variables['total_cost']).toBe(totalCost.toFixed(2));
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  // ─── Engagement Metric Preservation ──────────────────────────────────────────

  describe('Engagement Metric: include_follow vs exclude_follow produce correct results', () => {
    it('exclude_follow uses like+fav+cmt+share; include_follow uses engageNum', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              noteId: fc.string({ minLength: 5, maxLength: 10 }),
              impNum: fc.integer({ min: 100, max: 500000 }),
              readNum: fc.integer({ min: 10, max: 100000 }),
              engageNum: fc.integer({ min: 100, max: 50000 }),
              likeNum: fc.integer({ min: 5, max: 20000 }),
              favNum: fc.integer({ min: 1, max: 10000 }),
              cmtNum: fc.integer({ min: 1, max: 5000 }),
              shareNum: fc.integer({ min: 0, max: 2000 }),
              followNum: fc.integer({ min: 0, max: 500 }),
              kolPrice: fc.integer({ min: 500, max: 50000 }),
              serviceFee: fc.integer({ min: 0, max: 5000 }),
            }),
            { minLength: 1, maxLength: 4 }
          ),
          fc.constantFrom('include_follow', 'exclude_follow'),
          async (noteData, engagementMetric) => {
            const mockPrisma = createMockPrismaForCh3WithEngagement(noteData, engagementMetric);
            const loader = new DataOverviewDataLoader(mockPrisma as any);
            const result = await loader.load('test-project-id');

            let expectedEngagement: number;
            if (engagementMetric === 'include_follow') {
              expectedEngagement = noteData.reduce((s, n) => s + n.engageNum, 0);
            } else {
              expectedEngagement = noteData.reduce((s, n) => s + n.likeNum + n.favNum + n.cmtNum + n.shareNum, 0);
            }

            expect(result.variables['total_engagement']).toBe(String(expectedEngagement));
            expect(result.variables['engagement_metric']).toBe(engagementMetric);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  // ─── Viral Metric Preservation ───────────────────────────────────────────────

  describe('Viral Metric: like_only vs like_comment_share thresholds unchanged', () => {
    it('like_only counts notes where likeNum >= threshold; like_comment_share counts like+fav+cmt >= threshold', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              noteId: fc.string({ minLength: 5, maxLength: 10 }),
              impNum: fc.integer({ min: 100, max: 500000 }),
              readNum: fc.integer({ min: 10, max: 100000 }),
              engageNum: fc.integer({ min: 10, max: 50000 }),
              likeNum: fc.integer({ min: 0, max: 5000 }),
              favNum: fc.integer({ min: 0, max: 3000 }),
              cmtNum: fc.integer({ min: 0, max: 2000 }),
              shareNum: fc.integer({ min: 0, max: 1000 }),
              followNum: fc.integer({ min: 0, max: 500 }),
              kolPrice: fc.integer({ min: 500, max: 50000 }),
              serviceFee: fc.integer({ min: 0, max: 5000 }),
            }),
            { minLength: 2, maxLength: 8 }
          ),
          fc.constantFrom('like_only', 'like_comment_share'),
          fc.integer({ min: 500, max: 2000 }), // viral threshold
          async (noteData, viralMetric, viralThreshold) => {
            const mockPrisma = createMockPrismaForCh3WithViral(noteData, viralMetric, viralThreshold);
            const loader = new DataOverviewDataLoader(mockPrisma as any);
            const result = await loader.load('test-project-id');

            let expectedViralCount: number;
            if (viralMetric === 'like_only') {
              expectedViralCount = noteData.filter(n => n.likeNum >= viralThreshold).length;
            } else {
              expectedViralCount = noteData.filter(n => n.likeNum + n.favNum + n.cmtNum >= viralThreshold).length;
            }

            const expectedViralRate = noteData.length > 0 ? (expectedViralCount / noteData.length) * 100 : 0;

            expect(result.variables['viral_count']).toBe(String(expectedViralCount));
            expect(result.variables['viral_rate']).toBe(expectedViralRate.toFixed(1));
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  // ─── TraceItem Format Preservation ───────────────────────────────────────────

  describe('TraceItem Format: all loaders produce traceItems with correct structure', () => {
    it('Ch3 DataOverviewDataLoader produces traceItems with required fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              noteId: fc.string({ minLength: 5, maxLength: 10 }),
              impNum: fc.integer({ min: 100, max: 500000 }),
              readNum: fc.integer({ min: 10, max: 100000 }),
              engageNum: fc.integer({ min: 10, max: 50000 }),
              likeNum: fc.integer({ min: 5, max: 20000 }),
              favNum: fc.integer({ min: 1, max: 10000 }),
              cmtNum: fc.integer({ min: 1, max: 5000 }),
              shareNum: fc.integer({ min: 0, max: 2000 }),
              followNum: fc.integer({ min: 0, max: 500 }),
              kolPrice: fc.integer({ min: 500, max: 50000 }),
              serviceFee: fc.integer({ min: 0, max: 5000 }),
            }),
            { minLength: 1, maxLength: 3 }
          ),
          async (noteData) => {
            const mockPrisma = createMockPrismaForCh3(noteData, 5000);
            const loader = new DataOverviewDataLoader(mockPrisma as any);
            const result = await loader.load('test-project-id');

            // Verify traceItems structure
            expect(result.traceItems.length).toBeGreaterThan(0);
            for (const item of result.traceItems) {
              expect(item).toHaveProperty('traceId');
              expect(item).toHaveProperty('chapterNumber');
              expect(item).toHaveProperty('label');
              expect(item).toHaveProperty('sourceTable');
              expect(item).toHaveProperty('sourceQuery');
              expect(item).toHaveProperty('columns');
              expect(item).toHaveProperty('dataRows');
              expect(item.chapterNumber).toBe(3);
              expect(typeof item.traceId).toBe('string');
              expect(typeof item.label).toBe('string');
              expect(typeof item.sourceTable).toBe('string');
              expect(typeof item.sourceQuery).toBe('string');
              expect(Array.isArray(item.columns)).toBe(true);
              expect(Array.isArray(item.dataRows)).toBe(true);

              // Each column has key, label, type
              for (const col of item.columns) {
                expect(col).toHaveProperty('key');
                expect(col).toHaveProperty('label');
                expect(col).toHaveProperty('type');
              }

              // Calculations if present
              if (item.calculations) {
                for (const calc of item.calculations) {
                  expect(calc).toHaveProperty('metric');
                  expect(calc).toHaveProperty('formula');
                  expect(calc).toHaveProperty('inputs');
                  expect(calc).toHaveProperty('result');
                }
              }
            }
          }
        ),
        { numRuns: 15 }
      );
    });

    it('Ch7 TrafficAnalysisDataLoader produces traceItems with correct structure', async () => {
      const mockPrisma = createMockPrismaForCh7WithRecords();
      const loader = new TrafficAnalysisDataLoader(mockPrisma as any);
      const result = await loader.load('test-project-id');

      expect(result.traceItems.length).toBeGreaterThan(0);
      for (const item of result.traceItems) {
        expect(item).toHaveProperty('traceId');
        expect(item).toHaveProperty('chapterNumber');
        expect(item).toHaveProperty('label');
        expect(item).toHaveProperty('sourceTable');
        expect(item).toHaveProperty('sourceQuery');
        expect(item).toHaveProperty('columns');
        expect(item).toHaveProperty('dataRows');
        expect(item.chapterNumber).toBe(7);
        expect(Array.isArray(item.columns)).toBe(true);
        expect(Array.isArray(item.dataRows)).toBe(true);

        if (item.calculations) {
          for (const calc of item.calculations) {
            expect(calc).toHaveProperty('metric');
            expect(calc).toHaveProperty('formula');
            expect(calc).toHaveProperty('inputs');
            expect(calc).toHaveProperty('result');
          }
        }
      }
    });
  });

  // ─── Placement Mapping Preservation ──────────────────────────────────────────

  describe('Placement Mapping: 1=信息流, 2=搜索, 4=全站智投, 7=视频流', () => {
    it('ad_type_analysis should map placement codes to correct Chinese labels', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('1', '2', '4', '7'),
          fc.integer({ min: 100, max: 50000 }),   // fee
          fc.integer({ min: 1000, max: 100000 }), // impression
          fc.integer({ min: 100, max: 50000 }),   // click
          fc.integer({ min: 10, max: 5000 }),     // interaction
          async (placement, fee, impression, click, interaction) => {
            const expectedLabel: Record<string, string> = {
              '1': '信息流',
              '2': '搜索',
              '4': '全站智投',
              '7': '视频流',
            };

            const mockPrisma = createMockPrismaForCh7WithPlacement(placement, fee, impression, click, interaction);
            const loader = new TrafficAnalysisDataLoader(mockPrisma as any);
            const result = await loader.load('test-project-id');

            const adTypeAnalysis = result.variables['ad_type_analysis'] || '';
            // The ad_type_analysis should contain the correct Chinese label for the placement code
            expect(adTypeAnalysis).toContain(expectedLabel[placement]);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  // ─── Content Analysis Grouping Preservation ──────────────────────────────────

  describe('Content Analysis: grouping logic and existing aggregate columns preserved', () => {
    it('aggregate output contains correct columns: 篇数|曝光量|阅读量|互动量|爆文数|爆文率|CPM|CPC|CPE|CPI|CPTI', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              contentDirection: fc.constantFrom('产品测评', '日常分享', '教程', '穿搭', '开箱'),
              impNum: fc.integer({ min: 1000, max: 100000 }),
              readNum: fc.integer({ min: 100, max: 50000 }),
              likeNum: fc.integer({ min: 5, max: 3000 }),
              favNum: fc.integer({ min: 1, max: 1000 }),
              cmtNum: fc.integer({ min: 1, max: 500 }),
              shareNum: fc.integer({ min: 0, max: 200 }),
              kolPrice: fc.integer({ min: 500, max: 50000 }),
              serviceFee: fc.integer({ min: 0, max: 2000 }),
              tiUserNum: fc.integer({ min: 0, max: 500 }),
              iUserNum: fc.integer({ min: 0, max: 500 }),
              kolFanNum: fc.integer({ min: 1000, max: 1000000 }),
            }),
            { minLength: 2, maxLength: 6 }
          ),
          async (noteData) => {
            const mockPrisma = createMockPrismaForCh6(noteData);
            const loader = new ContentAnalysisDataLoader(mockPrisma as any);
            const result = await loader.load('test-project-id');

            const byDirection = result.variables['by_content_direction'] || '';
            if (!byDirection) return; // skip if empty

            // Updated implementation produces 12 pipe-separated columns per row:
            // | 维度 | 篇数 | 曝光量 | 阅读量 | 互动量 | 爆文数 | 爆文率 | CPM | CPC | CPE | CPI | CPTI |
            const rows = byDirection.split('\n').filter((r: string) => r.startsWith('|'));
            expect(rows.length).toBeGreaterThan(0);

            for (const row of rows) {
              const columns = row.split('|').filter((c: string) => c.trim() !== '');
              // Updated aggregate() produces exactly 12 columns
              expect(columns.length).toBe(12);
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    it('grouping by contentDirection produces one row per unique direction', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              contentDirection: fc.constantFrom('产品测评', '日常分享', '教程'),
              impNum: fc.integer({ min: 1000, max: 100000 }),
              readNum: fc.integer({ min: 100, max: 50000 }),
              likeNum: fc.integer({ min: 5, max: 3000 }),
              favNum: fc.integer({ min: 1, max: 1000 }),
              cmtNum: fc.integer({ min: 1, max: 500 }),
              shareNum: fc.integer({ min: 0, max: 200 }),
              kolPrice: fc.integer({ min: 500, max: 50000 }),
              serviceFee: fc.integer({ min: 0, max: 2000 }),
              tiUserNum: fc.integer({ min: 0, max: 500 }),
              kolFanNum: fc.integer({ min: 1000, max: 1000000 }),
            }),
            { minLength: 2, maxLength: 8 }
          ),
          async (noteData) => {
            const mockPrisma = createMockPrismaForCh6(noteData);
            const loader = new ContentAnalysisDataLoader(mockPrisma as any);
            const result = await loader.load('test-project-id');

            const byDirection = result.variables['by_content_direction'] || '';
            if (!byDirection) return;

            const rows = byDirection.split('\n').filter((r: string) => r.startsWith('|'));
            const uniqueDirections = new Set(noteData.map(n => n.contentDirection));

            // One row per unique direction
            expect(rows.length).toBe(uniqueDirections.size);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  // ─── Highlights KPI Completion Rate Preservation ─────────────────────────────

  describe('Highlights: KPI completion rate formulas (isCost ? target/actual*100 : actual/target*100)', () => {
    it('cost metrics use target/actual*100; volume metrics use actual/target*100', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            impNum: fc.integer({ min: 10000, max: 500000 }),
            readNum: fc.integer({ min: 1000, max: 100000 }),
            likeNum: fc.integer({ min: 100, max: 20000 }),
            favNum: fc.integer({ min: 50, max: 10000 }),
            cmtNum: fc.integer({ min: 10, max: 5000 }),
            shareNum: fc.integer({ min: 5, max: 2000 }),
            kolPrice: fc.integer({ min: 500, max: 50000 }),
            serviceFee: fc.integer({ min: 0, max: 5000 }),
          }),
          fc.integer({ min: 100, max: 20000 }), // jgFee
          fc.record({
            totalImpression: fc.integer({ min: 50000, max: 1000000 }),
            cpm: fc.integer({ min: 10, max: 100 }),
          }),
          async (noteInput, jgFee, kpiTargets) => {
            const noteData = [{ noteId: 'note-1', ...noteInput, engageNum: noteInput.likeNum + noteInput.favNum + noteInput.cmtNum + noteInput.shareNum, followNum: 0 }];
            const mockPrisma = createMockPrismaForCh4WithKPI(noteData, jgFee, kpiTargets);
            const loader = new HighlightsDataLoader(mockPrisma as any);
            const result = await loader.load('test-project-id');

            const kpiHighlights = result.variables['kpi_highlights'] || '';

            // Calculate expected: impression is volume (actual/target*100)
            const totalImpressions = noteInput.impNum;
            const impressionCompletion = (totalImpressions / kpiTargets.totalImpression) * 100;

            // Calculate expected: cpm is cost (target/actual*100)
            const totalCost = (noteInput.kolPrice + noteInput.serviceFee) + jgFee;
            const actualCpm = totalImpressions > 0 ? (totalCost / totalImpressions) * 1000 : 0;
            const cpmCompletion = actualCpm > 0 ? (kpiTargets.cpm / actualCpm) * 100 : 0;

            // If impression exceeds KPI, it should appear in highlights
            if (impressionCompletion > 100) {
              expect(kpiHighlights).toContain('总曝光');
            }
            // If CPM completion > 100 (actual below KPI target = good for cost), it should appear
            if (cpmCompletion > 100) {
              expect(kpiHighlights).toContain('CPM');
            }
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  // ─── Traffic Analysis GROUP BY Preservation ──────────────────────────────────

  describe('Traffic Analysis: GROUP BY aggregation and placement labels preserved', () => {
    it('buildGroupAnalysis correctly computes SUM for each group metric', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              placement: fc.constantFrom('1', '2', '4', '7'),
              fee: fc.integer({ min: 100, max: 50000 }),
              impression: fc.integer({ min: 1000, max: 100000 }),
              click: fc.integer({ min: 50, max: 20000 }),
              interaction: fc.integer({ min: 10, max: 5000 }),
              iUserNum: fc.integer({ min: 0, max: 1000 }),
              tiUserNum: fc.integer({ min: 0, max: 500 }),
            }),
            { minLength: 2, maxLength: 8 }
          ),
          async (records) => {
            const mockPrisma = createMockPrismaForCh7WithMultiplePlacements(records);
            const loader = new TrafficAnalysisDataLoader(mockPrisma as any);
            const result = await loader.load('test-project-id');

            const adTypeAnalysis = result.variables['ad_type_analysis'] || '';
            if (adTypeAnalysis.includes('暂无')) return;

            // Group and verify totals
            const groups = new Map<string, { fee: number; impression: number; click: number; interaction: number }>();
            for (const r of records) {
              const existing = groups.get(r.placement);
              if (existing) {
                existing.fee += r.fee;
                existing.impression += r.impression;
                existing.click += r.click;
                existing.interaction += r.interaction;
              } else {
                groups.set(r.placement, { fee: r.fee, impression: r.impression, click: r.click, interaction: r.interaction });
              }
            }

            // Verify each placement group appears with correct total fee
            const placementLabels: Record<string, string> = { '1': '信息流', '2': '搜索', '4': '全站智投', '7': '视频流' };
            for (const [placement, data] of groups) {
              const label = placementLabels[placement];
              expect(adTypeAnalysis).toContain(label);
              // Verify the fee value appears in the row (as integer)
              expect(adTypeAnalysis).toContain(String(Math.round(data.fee)));
            }
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Helper Mock Functions
// ═══════════════════════════════════════════════════════════════════════════════

function createMockPrismaForCh3(
  noteData: Array<{ noteId: string; impNum: number; readNum: number; engageNum: number; likeNum: number; favNum: number; cmtNum: number; shareNum: number; followNum: number; kolPrice: number; serviceFee: number }>,
  jgFee: number,
) {
  return {
    reviewConfig: {
      findFirst: vi.fn().mockResolvedValue({
        engagementMetric: 'exclude_follow',
        viralMetric: 'like_comment_share',
        viralThreshold: 1000,
        kpiTargets: {},
        benchmark: {},
        modules: { contentCostCaliber: 'consumption', trafficCostCaliber: 'consumption' },
      }),
    },
    project: {
      findUnique: vi.fn().mockResolvedValue({ projectName: 'Test', brand: 'TestBrand', startDate: new Date(), endDate: new Date(), executionStartDate: null }),
    },
    note: {
      findMany: vi.fn().mockResolvedValue(noteData.map(n => ({
        ...n,
        kolPrice: BigInt(n.kolPrice),
        serviceFee: BigInt(n.serviceFee),
      }))),
    },
    juguangData: {
      aggregate: vi.fn().mockResolvedValue({
        _sum: { fee: jgFee, impression: 0, click: 0, interaction: 0, tiUserNum: 0 },
      }),
    },
    lingxiData: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  };
}

function createMockPrismaForCh3WithCaliber(
  noteData: Array<{ noteId: string; impNum: number; readNum: number; engageNum: number; likeNum: number; favNum: number; cmtNum: number; shareNum: number; followNum: number; kolPrice: number; serviceFee: number }>,
  jgFee: number,
  contentCostCaliber: string,
  trafficCostCaliber: string,
) {
  return {
    reviewConfig: {
      findFirst: vi.fn().mockResolvedValue({
        engagementMetric: 'exclude_follow',
        viralMetric: 'like_comment_share',
        viralThreshold: 1000,
        kpiTargets: {},
        benchmark: {},
        modules: { contentCostCaliber, trafficCostCaliber },
      }),
    },
    project: {
      findUnique: vi.fn().mockResolvedValue({ projectName: 'Test', brand: 'TestBrand', startDate: new Date(), endDate: new Date(), executionStartDate: null }),
    },
    note: {
      findMany: vi.fn().mockResolvedValue(noteData.map(n => ({
        ...n,
        kolPrice: BigInt(n.kolPrice),
        serviceFee: BigInt(n.serviceFee),
      }))),
    },
    juguangData: {
      aggregate: vi.fn().mockResolvedValue({
        _sum: { fee: jgFee, impression: 0, click: 0, interaction: 0, tiUserNum: 0 },
      }),
    },
    lingxiData: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  };
}

function createMockPrismaForCh3WithEngagement(
  noteData: Array<{ noteId: string; impNum: number; readNum: number; engageNum: number; likeNum: number; favNum: number; cmtNum: number; shareNum: number; followNum: number; kolPrice: number; serviceFee: number }>,
  engagementMetric: string,
) {
  return {
    reviewConfig: {
      findFirst: vi.fn().mockResolvedValue({
        engagementMetric,
        viralMetric: 'like_comment_share',
        viralThreshold: 1000,
        kpiTargets: {},
        benchmark: {},
        modules: { contentCostCaliber: 'consumption', trafficCostCaliber: 'consumption' },
      }),
    },
    project: {
      findUnique: vi.fn().mockResolvedValue({ projectName: 'Test', brand: 'TestBrand', startDate: new Date(), endDate: new Date(), executionStartDate: null }),
    },
    note: {
      findMany: vi.fn().mockResolvedValue(noteData.map(n => ({
        ...n,
        kolPrice: BigInt(n.kolPrice),
        serviceFee: BigInt(n.serviceFee),
      }))),
    },
    juguangData: {
      aggregate: vi.fn().mockResolvedValue({
        _sum: { fee: 0, impression: 0, click: 0, interaction: 0, tiUserNum: 0 },
      }),
    },
    lingxiData: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  };
}

function createMockPrismaForCh3WithViral(
  noteData: Array<{ noteId: string; impNum: number; readNum: number; engageNum: number; likeNum: number; favNum: number; cmtNum: number; shareNum: number; followNum: number; kolPrice: number; serviceFee: number }>,
  viralMetric: string,
  viralThreshold: number,
) {
  return {
    reviewConfig: {
      findFirst: vi.fn().mockResolvedValue({
        engagementMetric: 'exclude_follow',
        viralMetric,
        viralThreshold,
        kpiTargets: {},
        benchmark: {},
        modules: { contentCostCaliber: 'consumption', trafficCostCaliber: 'consumption' },
      }),
    },
    project: {
      findUnique: vi.fn().mockResolvedValue({ projectName: 'Test', brand: 'TestBrand', startDate: new Date(), endDate: new Date(), executionStartDate: null }),
    },
    note: {
      findMany: vi.fn().mockResolvedValue(noteData.map(n => ({
        ...n,
        kolPrice: BigInt(n.kolPrice),
        serviceFee: BigInt(n.serviceFee),
      }))),
    },
    juguangData: {
      aggregate: vi.fn().mockResolvedValue({
        _sum: { fee: 0, impression: 0, click: 0, interaction: 0, tiUserNum: 0 },
      }),
    },
    lingxiData: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  };
}

function createMockPrismaForCh4WithKPI(
  noteData: Array<{ noteId: string; impNum: number; readNum: number; engageNum: number; likeNum: number; favNum: number; cmtNum: number; shareNum: number; followNum: number; kolPrice: number; serviceFee: number }>,
  jgFee: number,
  kpiTargets: Record<string, number>,
) {
  return {
    reviewConfig: {
      findFirst: vi.fn().mockResolvedValue({
        engagementMetric: 'exclude_follow',
        viralMetric: 'like_comment_share',
        kpiTargets,
        benchmark: {},
      }),
    },
    note: {
      findMany: vi.fn().mockResolvedValue(noteData.map(n => ({
        ...n,
        kolPrice: BigInt(n.kolPrice),
        serviceFee: BigInt(n.serviceFee),
      }))),
    },
    juguangData: {
      aggregate: vi.fn().mockResolvedValue({
        _sum: { fee: jgFee },
      }),
    },
    lingxiData: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    $queryRaw: vi.fn().mockResolvedValue([{ cnt: BigInt(noteData.length), cs: 0, ads: 0 }]),
  };
}

function createMockPrismaForCh6(
  noteData: Array<{ contentDirection: string; impNum: number; readNum: number; likeNum: number; favNum: number; cmtNum: number; shareNum: number; kolPrice: number; serviceFee: number; tiUserNum: number; iUserNum?: number; kolFanNum: number }>,
) {
  const notes = noteData.map((n, i) => ({
    noteId: `note-${i}`,
    kolNickName: `达人${i}`,
    kolFanNum: n.kolFanNum,
    noteType: '1',
    noteTitle: `测试笔记${i}`,
    impNum: n.impNum,
    readNum: n.readNum,
    engageNum: n.likeNum + n.favNum + n.cmtNum + n.shareNum,
    likeNum: n.likeNum,
    favNum: n.favNum,
    cmtNum: n.cmtNum,
    shareNum: n.shareNum,
    kolPrice: BigInt(n.kolPrice),
    serviceFee: BigInt(n.serviceFee),
    coverImages: [],
    noteLink: null,
    contentDirection: n.contentDirection,
  }));

  const juguangData = noteData.map((n, i) => ({
    noteId: `note-${i}`,
    fee: BigInt(100),
    tiUserNum: n.tiUserNum,
    iUserNum: n.iUserNum ?? 0,
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

function createMockPrismaForCh7WithRecords() {
  const juguangRecords = [
    {
      noteId: 'note-1', placement: '1', targetsDetail: '兴趣人群', keyword: '护肤',
      fee: BigInt(5000), impression: 30000, click: 1500, interaction: 300,
      iUserNum: 50, tiUserNum: 20, iUserPrice: BigInt(100), tiUserPrice: BigInt(250),
      searchCmtClick: 100, searchCmtAfterRead: 80, searchCmtAfterReadAvg: 0.8, searchCmtClickCvr: 0.06,
    },
  ];

  return {
    reviewConfig: {
      findFirst: vi.fn().mockResolvedValue({ benchmark: {} }),
    },
    juguangData: {
      findMany: vi.fn().mockResolvedValue(juguangRecords),
    },
    note: {
      findMany: vi.fn().mockResolvedValue([
        { noteId: 'note-1', kolNickName: '达人A', noteType: '1' },
      ]),
    },
    $queryRaw: vi.fn().mockResolvedValue([]),
  };
}

function createMockPrismaForCh7WithPlacement(
  placement: string,
  fee: number,
  impression: number,
  click: number,
  interaction: number,
) {
  const juguangRecords = [
    {
      noteId: 'note-1', placement, targetsDetail: null, keyword: null,
      fee: BigInt(fee), impression, click, interaction,
      iUserNum: 10, tiUserNum: 5, iUserPrice: BigInt(0), tiUserPrice: BigInt(0),
      searchCmtClick: 0, searchCmtAfterRead: 0, searchCmtAfterReadAvg: 0, searchCmtClickCvr: 0,
    },
  ];

  return {
    reviewConfig: {
      findFirst: vi.fn().mockResolvedValue({ benchmark: {} }),
    },
    juguangData: {
      findMany: vi.fn().mockResolvedValue(juguangRecords),
    },
    note: {
      findMany: vi.fn().mockResolvedValue([
        { noteId: 'note-1', kolNickName: '达人A', noteType: '1' },
      ]),
    },
    $queryRaw: vi.fn().mockResolvedValue([]),
  };
}

function createMockPrismaForCh7WithMultiplePlacements(
  records: Array<{ placement: string; fee: number; impression: number; click: number; interaction: number; iUserNum: number; tiUserNum: number }>,
) {
  const juguangRecords = records.map((r, i) => ({
    noteId: `note-${i}`,
    placement: r.placement,
    targetsDetail: null,
    keyword: null,
    fee: BigInt(r.fee),
    impression: r.impression,
    click: r.click,
    interaction: r.interaction,
    iUserNum: r.iUserNum,
    tiUserNum: r.tiUserNum,
    iUserPrice: BigInt(0),
    tiUserPrice: BigInt(0),
    searchCmtClick: 0,
    searchCmtAfterRead: 0,
    searchCmtAfterReadAvg: 0,
    searchCmtClickCvr: 0,
  }));

  const notes = records.map((_, i) => ({
    noteId: `note-${i}`,
    kolNickName: `达人${i}`,
    noteType: '1',
  }));

  return {
    reviewConfig: {
      findFirst: vi.fn().mockResolvedValue({ benchmark: {} }),
    },
    juguangData: {
      findMany: vi.fn().mockResolvedValue(juguangRecords),
    },
    note: {
      findMany: vi.fn().mockResolvedValue(notes),
    },
    $queryRaw: vi.fn().mockResolvedValue([]),
  };
}
