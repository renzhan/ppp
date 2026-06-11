import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CoverDataLoader } from '../../src/pipeline/loaders/chapter-01-cover';
import { ProjectReviewDataLoader } from '../../src/pipeline/loaders/chapter-02-project-review';
import { DataOverviewDataLoader } from '../../src/pipeline/loaders/chapter-03-data-overview';
import { HighlightsDataLoader } from '../../src/pipeline/loaders/chapter-04-highlights';
import { QuadrantAnalysisDataLoader } from '../../src/pipeline/loaders/chapter-05-quadrant-analysis';
import { ContentAnalysisDataLoader } from '../../src/pipeline/loaders/chapter-06-content-analysis';
import { TrafficAnalysisDataLoader } from '../../src/pipeline/loaders/chapter-07-traffic-analysis';
import { AudienceAssetsDataLoader } from '../../src/pipeline/loaders/chapter-08-audience-assets';
import type { ChapterDataContext } from '../../src/pipeline/loaders/types';

/**
 * Integration Test: Chapter Data Loaders
 *
 * Verifies each loader returns expected data shape from a mocked Prisma client.
 * Tests that loaders query the correct tables and return properly structured data.
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.9**
 */
describe('Chapter Data Loaders Integration', () => {
  const PROJECT_ID = 'project-test-001';

  describe('Requirement 3.1: Chapter 1 (Cover) - CoverDataLoader', () => {
    it('should return project category, brand, businessLine, projectName, startDate, endDate', async () => {
      const mockPrisma = {
        project: {
          findUnique: vi.fn(async () => ({
            category: '美妆护肤',
            brand: '测试品牌',
            businessLine: '小红书种草',
            projectName: '测试品牌_日常种草_2025Q1',
            startDate: new Date('2025-01-01'),
            endDate: new Date('2025-03-31'),
            executionStartDate: new Date('2025-01-01'),
          })),
        },
        reviewConfig: {
          findFirst: vi.fn(async () => ({
            benchmark: { ctr: 5, cpm: 30, cpc: 1.5, cpe: 8 },
            engagementMetric: 'exclude_follow',
          })),
        },
      } as any;

      const loader = new CoverDataLoader(mockPrisma);
      const result = await loader.load(PROJECT_ID);

      expect(result.variables['category']).toBe('美妆护肤');
      expect(result.variables['brand']).toBe('测试品牌');
      expect(result.variables['business_line']).toBe('小红书种草');
      expect(result.variables['project_name']).toBe('测试品牌_日常种草_2025Q1');
      expect(result.variables['start_date']).toBe('2025-01-01');
      expect(result.variables['end_date']).toBe('2025-03-31');
      expect(result.missingFields).toHaveLength(0);
    });

    it('should report missing fields when project data is incomplete', async () => {
      const mockPrisma = {
        project: {
          findUnique: vi.fn(async () => ({
            category: '美妆护肤',
            brand: null,
            businessLine: null,
            projectName: '测试项目',
            startDate: new Date('2025-01-01'),
            endDate: null,
            executionStartDate: null,
          })),
        },
        reviewConfig: {
          findFirst: vi.fn(async () => null),
        },
      } as any;

      const loader = new CoverDataLoader(mockPrisma);
      const result = await loader.load(PROJECT_ID);

      expect(result.variables['category']).toBe('美妆护肤');
      expect(result.variables['project_name']).toBe('测试项目');
      expect(result.missingFields).toContain('brand');
      expect(result.missingFields).toContain('business_line');
      expect(result.missingFields).toContain('end_date');
    });

    it('should query the projects table with the correct projectId', async () => {
      const mockPrisma = {
        project: {
          findUnique: vi.fn(async () => null),
        },
        reviewConfig: {
          findFirst: vi.fn(async () => null),
        },
      } as any;

      const loader = new CoverDataLoader(mockPrisma);
      await loader.load(PROJECT_ID);

      expect(mockPrisma.project.findUnique).toHaveBeenCalledWith({
        where: { id: PROJECT_ID },
        select: {
          category: true,
          brand: true,
          businessLine: true,
          projectName: true,
          startDate: true,
          endDate: true,
          executionStartDate: true,
        },
      });
    });
  });

  describe('Requirement 3.2: Chapter 2 (Project Review) - ProjectReviewDataLoader', () => {
    it('should return plan_parse content and launchPhases', async () => {
      const mockPrisma = {
        aiGeneratedContent: {
          findFirst: vi.fn(async () => ({
            generatedContent: JSON.stringify({
              projectObjective: '提升品牌知名度',
              strategy: '多维度种草',
              targetAudience: '18-35岁女性',
              coreMessage: '天然护肤',
            }),
            editedContent: null,
            isEdited: false,
          })),
        },
        reviewConfig: {
          findFirst: vi.fn(async () => ({
            launchPhases: [
              { name: '预热期', startDate: '2025-01-01', endDate: '2025-01-15' },
              { name: '爆发期', startDate: '2025-01-16', endDate: '2025-02-15' },
              { name: '长尾期', startDate: '2025-02-16', endDate: '2025-03-31' },
            ],
          })),
        },
        noteBase: {
          count: vi.fn(async () => 10),
        },
        businessAnnotation: {
          findMany: vi.fn(async () => [
            { noteId: 'n1', contentDirection: '产品测评', launchPhase: '预热期' },
            { noteId: 'n2', contentDirection: '日常分享', launchPhase: '爆发期' },
          ]),
        },
        note: {
          findMany: vi.fn(async () => [
            { kolFanNum: 200000 },
            { kolFanNum: 50000 },
          ]),
        },
      } as any;

      const loader = new ProjectReviewDataLoader(mockPrisma);
      const result = await loader.load(PROJECT_ID);

      expect(result.variables['project_objective']).toBe('提升品牌知名度');
      expect(result.variables['strategy']).toBe('多维度种草');
      expect(result.variables['target_audience']).toBe('18-35岁女性');
      expect(result.variables['core_message']).toBe('天然护肤');
      // launch_phases is now formatted as markdown text
      expect(result.variables['launch_phases']).toContain('预热期');
      expect(result.variables['launch_phases']).toContain('爆发期');
      expect(result.variables['launch_phases']).toContain('长尾期');
      expect(result.missingFields).toHaveLength(0);
    });

    it('should query ai_generated_content and review_configs tables', async () => {
      const mockPrisma = {
        aiGeneratedContent: {
          findFirst: vi.fn(async () => null),
        },
        reviewConfig: {
          findFirst: vi.fn(async () => null),
        },
        noteBase: {
          count: vi.fn(async () => 0),
        },
        businessAnnotation: {
          findMany: vi.fn(async () => []),
        },
        note: {
          findMany: vi.fn(async () => []),
        },
      } as any;

      const loader = new ProjectReviewDataLoader(mockPrisma);
      await loader.load(PROJECT_ID);

      expect(mockPrisma.aiGeneratedContent.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { projectId: PROJECT_ID, contentType: 'plan_parse' },
        }),
      );
      expect(mockPrisma.reviewConfig.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { projectId: PROJECT_ID },
        }),
      );
    });
  });

  describe('Requirement 3.3: Chapter 3 (Data Overview) - DataOverviewDataLoader', () => {
    it('should return aggregated metrics and KPI completion rates', async () => {
      const mockPrisma = {
        project: {
          findUnique: vi.fn(async () => ({
            projectName: '测试项目',
            brand: '测试品牌',
            startDate: new Date('2025-01-01'),
            endDate: new Date('2025-03-31'),
            executionStartDate: null,
          })),
        },
        reviewConfig: {
          findFirst: vi.fn(async () => ({
            kpiTargets: { totalImpression: 10000, totalRead: 3000, totalEngagement: 800 },
            benchmark: {},
            engagementMetric: 'exclude_follow',
            viralMetric: 'like_comment_share',
            viralThreshold: 1000,
            modules: {},
          })),
        },
        note: {
          findMany: vi.fn(async () => [
            { noteId: 'n1', impNum: 5000, readNum: 1500, engageNum: 300, likeNum: 200, favNum: 50, cmtNum: 30, shareNum: 20, followNum: 0, kolPrice: 1000, serviceFee: 100 },
            { noteId: 'n2', impNum: 8000, readNum: 2000, engageNum: 500, likeNum: 350, favNum: 80, cmtNum: 50, shareNum: 20, followNum: 0, kolPrice: 2000, serviceFee: 200 },
            { noteId: 'n3', impNum: 3000, readNum: 800, engageNum: 150, likeNum: 100, favNum: 30, cmtNum: 15, shareNum: 5, followNum: 0, kolPrice: 500, serviceFee: 50 },
          ]),
        },
        juguangData: {
          aggregate: vi.fn(async () => ({
            _sum: { fee: 0, impression: 0, click: 0, interaction: 0, tiUserNum: 0 },
          })),
        },
        lingxiData: {
          findMany: vi.fn(async () => []),
        },
      } as any;

      const loader = new DataOverviewDataLoader(mockPrisma);
      const result = await loader.load(PROJECT_ID);

      // Verify aggregated metrics
      expect(result.variables['note_count']).toBe('3');
      expect(result.variables['total_impressions']).toBe('16000');
      expect(result.variables['total_reads']).toBe('4300');
      // engagement = likeNum + favNum + cmtNum + shareNum (exclude_follow)
      // = (200+50+30+20) + (350+80+50+20) + (100+30+15+5) = 300 + 500 + 150 = 950
      expect(result.variables['total_engagement']).toBe('950');
      expect(result.variables['project_name']).toBe('测试项目');
      expect(result.variables['brand']).toBe('测试品牌');

      // Verify derived metrics exist
      expect(result.variables['cpm']).toBeDefined();
      expect(result.variables['cpc']).toBeDefined();
      expect(result.variables['cpe']).toBeDefined();
      expect(result.variables['ctr']).toBeDefined();

      // Verify KPI completion rates
      expect(result.variables['impression_completion']).toBeDefined();
      expect(result.variables['read_completion']).toBeDefined();
      expect(result.variables['engagement_completion']).toBeDefined();

      // Verify numeric values are reasonable
      expect(parseFloat(result.variables['impression_completion']!)).toBeGreaterThan(100); // 16000/10000 > 100%
      expect(parseFloat(result.variables['read_completion']!)).toBeGreaterThan(100); // 4300/3000 > 100%
      expect(parseFloat(result.variables['engagement_completion']!)).toBeGreaterThan(100); // 950/800 > 100%
    });

    it('should query notes and kpi_targets tables', async () => {
      const mockPrisma = {
        project: { findUnique: vi.fn(async () => null) },
        reviewConfig: { findFirst: vi.fn(async () => null) },
        note: { findMany: vi.fn(async () => []) },
        juguangData: {
          aggregate: vi.fn(async () => ({
            _sum: { fee: 0, impression: 0, click: 0, interaction: 0, tiUserNum: 0 },
          })),
        },
        lingxiData: { findMany: vi.fn(async () => []) },
      } as any;

      const loader = new DataOverviewDataLoader(mockPrisma);
      await loader.load(PROJECT_ID);

      expect(mockPrisma.note.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { projectId: PROJECT_ID } }),
      );
      // KPI targets now come from reviewConfig.findFirst
      expect(mockPrisma.reviewConfig.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { projectId: PROJECT_ID } }),
      );
    });
  });

  describe('Requirement 3.4: Chapter 4 (Highlights) - HighlightsDataLoader', () => {
    it('should return KPI exceeded metrics, viral notes, benchmark, and AIPS data', async () => {
      const mockPrisma = {
        reviewConfig: {
          findFirst: vi.fn(async () => ({
            kpiTargets: { totalImpression: 10000, totalRead: 5000, totalEngagement: 1000 },
            benchmark: { cpm: 50, cpc: 2, cpe: 10, ctr: 5 },
            engagementMetric: 'exclude_follow',
            viralMetric: 'like_comment_share',
          })),
        },
        note: {
          findMany: vi.fn(async () => [
            { noteId: 'n1', impNum: 10000, readNum: 3000, engageNum: 800, likeNum: 500, favNum: 200, cmtNum: 80, shareNum: 20, kolPrice: 1000, serviceFee: 100 },
            { noteId: 'n2', impNum: 5000, readNum: 500, engageNum: 100, likeNum: 60, favNum: 20, cmtNum: 15, shareNum: 5, kolPrice: 800, serviceFee: 80 },
          ]),
        },
        $queryRaw: vi.fn(async () => [{ cnt: BigInt(2), cs: 0, ads: 0 }]),
        juguangData: {
          aggregate: vi.fn(async () => ({
            _sum: { fee: 0 },
          })),
        },
        lingxiData: {
          findMany: vi.fn(async () => [
            {
              dataType: 'brand',
              dataContent: { aips: 100000, ti: 50000, aipsChange: '+15%', tiChange: '+8%', aipsIndustryRank: '3' },
              periodStart: new Date('2025-03-01'),
              periodEnd: new Date('2025-03-31'),
            },
          ]),
        },
      } as any;

      const loader = new HighlightsDataLoader(mockPrisma);
      const result = await loader.load(PROJECT_ID);

      // Verify KPI highlights exist (impression 15000 > 10000)
      expect(result.variables['kpi_highlights']).toBeDefined();
      expect(result.variables['kpi_highlights']).toContain('总曝光');

      // Verify viral highlights
      expect(result.variables['viral_highlights']).toBeDefined();

      // Verify benchmark highlights
      expect(result.variables['benchmark_highlights']).toBeDefined();

      // Verify AIPS highlights
      expect(result.variables['aips_highlights']).toBeDefined();
      expect(result.variables['aips_highlights']).toContain('AIPS');

      // Verify brand_mind_summary
      expect(result.variables['brand_mind_summary']).toBeDefined();
      expect(result.variables['brand_mind_summary']).toContain('AIPS');
    });
  });

  describe('Requirement 3.9: Chapter 5 (Quadrant Analysis) - QuadrantAnalysisDataLoader', () => {
    it('should return quadrant classification using engageRate × 投流CPE normalization', async () => {
      const mockPrisma = {
        note: {
          findMany: vi.fn(async () => [
            { noteId: 'n1', kolNickName: 'KOL_A', engageRate: 0.08, kolPrice: 1000 },
            { noteId: 'n2', kolNickName: 'KOL_B', engageRate: 0.03, kolPrice: 2000 },
            { noteId: 'n3', kolNickName: 'KOL_C', engageRate: 0.12, kolPrice: 1500 },
          ]),
        },
        juguangData: {
          findMany: vi.fn(async () => [
            { noteId: 'n1', fee: 500, interaction: 400 },   // CPE = 1.25
            { noteId: 'n2', fee: 3000, interaction: 100 },  // CPE = 30
            { noteId: 'n3', fee: 1000, interaction: 200 },  // CPE = 5
          ]),
        },
      } as any;

      const loader = new QuadrantAnalysisDataLoader(mockPrisma);
      const result = await loader.load(PROJECT_ID);

      // Verify total analyzed notes (all 3 have interaction > 0 and engageRate)
      expect(result.variables['total_analyzed_notes']).toBe('3');

      // Verify quadrant summary uses new quadrant names
      expect(result.variables['quadrant_summary']).toBeDefined();
      const summary = result.variables['quadrant_summary']!;
      expect(summary).toContain('核心资产');
      expect(summary).toContain('潜力内容');
      expect(summary).toContain('流量消耗');
      expect(summary).toContain('淘汰候选');

      // Verify scatter_data has numbered points
      expect(result.variables['scatter_data']).toBeDefined();
      expect(result.variables['scatter_data']).toContain('1.');

      // Verify detail_table has correct columns
      expect(result.variables['detail_table']).toBeDefined();
      expect(result.variables['detail_table']).toContain('创作者昵称');
      expect(result.variables['detail_table']).toContain('互动率');
      expect(result.variables['detail_table']).toContain('投流CPE');

      // Verify quadrant_cards exist
      expect(result.variables['quadrant_cards']).toBeDefined();
    });

    it('should exclude notes with interaction=0 from quadrant analysis', async () => {
      const mockPrisma = {
        note: {
          findMany: vi.fn(async () => [
            { noteId: 'n1', kolNickName: 'KOL_A', engageRate: 0.08, kolPrice: 1000 },
            { noteId: 'n2', kolNickName: 'KOL_B', engageRate: 0.05, kolPrice: 2000 },
          ]),
        },
        juguangData: {
          findMany: vi.fn(async () => [
            { noteId: 'n1', fee: 500, interaction: 400 },
            { noteId: 'n2', fee: 3000, interaction: 0 },  // interaction=0 → excluded
          ]),
        },
      } as any;

      const loader = new QuadrantAnalysisDataLoader(mockPrisma);
      const result = await loader.load(PROJECT_ID);

      // Only 1 note should be analyzed (n2 excluded due to interaction=0)
      expect(result.variables['total_analyzed_notes']).toBe('1');
      expect(result.variables['excluded_notes']).toBe('1');
    });

    it('should set X_score=0.5 when only 1 traffic note exists', async () => {
      const mockPrisma = {
        note: {
          findMany: vi.fn(async () => [
            { noteId: 'n1', kolNickName: 'KOL_A', engageRate: 0.08, kolPrice: 1000 },
          ]),
        },
        juguangData: {
          findMany: vi.fn(async () => [
            { noteId: 'n1', fee: 500, interaction: 200 },
          ]),
        },
      } as any;

      const loader = new QuadrantAnalysisDataLoader(mockPrisma);
      const result = await loader.load(PROJECT_ID);

      expect(result.variables['total_analyzed_notes']).toBe('1');
      // Single note → X=0.5, Y=0.5, quadrant='数据不足'
      expect(result.variables['scatter_data']).toContain('X=0.500');
      expect(result.variables['scatter_data']).toContain('Y=0.500');
    });

    it('should query notes and juguang_data tables', async () => {
      const mockPrisma = {
        note: { findMany: vi.fn(async () => []) },
        juguangData: { findMany: vi.fn(async () => []) },
      } as any;

      const loader = new QuadrantAnalysisDataLoader(mockPrisma);
      await loader.load(PROJECT_ID);

      expect(mockPrisma.note.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { projectId: PROJECT_ID } }),
      );
      expect(mockPrisma.juguangData.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ projectId: PROJECT_ID }) }),
      );
    });
  });

  describe('Requirement 3.5: Chapter 6 (Content Analysis) - ContentAnalysisDataLoader', () => {
    it('should return metrics grouped by contentDirection, noteType, kolType', async () => {
      const mockPrisma = {
        reviewConfig: {
          findFirst: vi.fn(async () => ({
            engagementMetric: 'exclude_follow',
            viralMetric: 'like_comment_share',
            viralThreshold: 1000,
            influencerTiers: null,
          })),
        },
        note: {
          findMany: vi.fn(async () => [
            { noteId: 'n1', kolNickName: 'KOL_A', kolFanNum: 200000, noteType: 'image', noteTitle: '测试1', impNum: 10000, readNum: 3000, engageNum: 800, likeNum: 500, favNum: 200, cmtNum: 80, shareNum: 20, kolPrice: 1000, serviceFee: 100, coverImages: [], noteLink: null, contentDirection: '产品测评' },
            { noteId: 'n2', kolNickName: 'KOL_B', kolFanNum: 50000, noteType: 'video', noteTitle: '测试2', impNum: 5000, readNum: 1500, engageNum: 400, likeNum: 250, favNum: 80, cmtNum: 50, shareNum: 20, kolPrice: 800, serviceFee: 80, coverImages: [], noteLink: null, contentDirection: '日常分享' },
            { noteId: 'n3', kolNickName: 'KOL_C', kolFanNum: 300000, noteType: 'image', noteTitle: '测试3', impNum: 8000, readNum: 2000, engageNum: 600, likeNum: 400, favNum: 120, cmtNum: 60, shareNum: 20, kolPrice: 1200, serviceFee: 120, coverImages: [], noteLink: null, contentDirection: '产品测评' },
          ]),
        },
        juguangData: {
          findMany: vi.fn(async () => []),
        },
      } as any;

      const loader = new ContentAnalysisDataLoader(mockPrisma);
      const result = await loader.load(PROJECT_ID);

      // Verify by_content_direction (now pipe-separated table format)
      expect(result.variables['by_content_direction']).toBeDefined();
      const byDirection = result.variables['by_content_direction']!;
      expect(byDirection).toContain('产品测评');
      // Should have 12 columns: name | count | imp | read | engage | viral | rate | CPM | CPC | CPE | CPI | CPTI
      const directionLines = byDirection.split('\n');
      expect(directionLines.length).toBeGreaterThan(0);
      // Each line has 12 pipe-separated values (14 pipes including leading/trailing)
      const firstLinePipes = directionLines[0].split('|').filter(s => s.trim() !== '');
      expect(firstLinePipes.length).toBe(12);

      // Verify by_note_type
      expect(result.variables['by_kol_type']).toBeDefined();

      // Verify by_kol_tier
      expect(result.variables['by_kol_tier']).toBeDefined();

      // Verify by_content_form
      expect(result.variables['by_content_form']).toBeDefined();

      // Verify top5_notes
      expect(result.variables['top5_notes']).toBeDefined();
    });

    it('should query notes and juguang_data tables', async () => {
      const mockPrisma = {
        reviewConfig: { findFirst: vi.fn(async () => null) },
        note: { findMany: vi.fn(async () => []) },
        juguangData: { findMany: vi.fn(async () => []) },
      } as any;

      const loader = new ContentAnalysisDataLoader(mockPrisma);
      await loader.load(PROJECT_ID);

      expect(mockPrisma.note.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { projectId: PROJECT_ID } }),
      );
      expect(mockPrisma.juguangData.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ projectId: PROJECT_ID }) }),
      );
    });
  });

  describe('Requirement 3.6: Chapter 7 (Traffic Analysis) - TrafficAnalysisDataLoader', () => {
    it('should return aggregated paid traffic metrics with derived CPM/CPC/CPE/CTR', async () => {
      const mockPrisma = {
        reviewConfig: {
          findFirst: vi.fn(async () => ({
            benchmark: { ctr: { min: 2, max: 5 }, cpm: { min: 20, max: 35 }, cpc: { min: 0.5, max: 1.5 }, cpe: { min: 2, max: 6 }, engagementRate: { min: 3, max: 8 } },
            launchPhases: [],
          })),
        },
        juguangData: {
          findMany: vi.fn(async () => [
            { noteId: 'n1', placement: '1', targetsDetail: null, keyword: null, fee: 1000, impression: 50000, click: 5000, interaction: 1000, iUserNum: 200, tiUserNum: 50, iUserPrice: 0, tiUserPrice: 0, searchCmtClick: 0, searchCmtAfterRead: 0, searchCmtAfterReadAvg: 0, searchCmtClickCvr: 0, time: '2025-03-01' },
            { noteId: 'n2', placement: '2', targetsDetail: null, keyword: null, fee: 2000, impression: 80000, click: 8000, interaction: 2000, iUserNum: 300, tiUserNum: 80, iUserPrice: 0, tiUserPrice: 0, searchCmtClick: 0, searchCmtAfterRead: 0, searchCmtAfterReadAvg: 0, searchCmtClickCvr: 0, time: '2025-03-02' },
          ]),
        },
        $queryRaw: vi.fn(async () => []),
        note: {
          findMany: vi.fn(async () => [
            { noteId: 'n1', kolNickName: 'KOL_A', noteType: 'image' },
            { noteId: 'n2', kolNickName: 'KOL_B', noteType: 'video' },
          ]),
        },
      } as any;

      const loader = new TrafficAnalysisDataLoader(mockPrisma);
      const result = await loader.load(PROJECT_ID);

      expect(result.variables['total_fee']).toBe('3000.00');
      expect(result.variables['total_impression']).toBe('130000');
      expect(result.variables['total_click']).toBe('13000');
      expect(result.variables['total_interaction']).toBe('3000');
      expect(result.variables['total_i_user_num']).toBe('500');
      expect(result.variables['total_ti_user_num']).toBe('130');

      // Verify derived metrics
      expect(result.variables['paid_cpm']).toBeDefined();
      expect(result.variables['paid_cpc']).toBeDefined();
      expect(result.variables['paid_cpe']).toBeDefined();
      expect(result.variables['paid_ctr']).toBeDefined();

      // Verify calculations: CPM = (3000/130000)*1000 ≈ 23.08
      expect(parseFloat(result.variables['paid_cpm']!)).toBeCloseTo(23.08, 1);
      // CPC = 3000/13000 ≈ 0.23
      expect(parseFloat(result.variables['paid_cpc']!)).toBeCloseTo(0.23, 1);

      // Verify benchmark range variables
      expect(result.variables['benchmark_ctr_range']).toBe('2%~5%');
      expect(result.variables['benchmark_cpm_range']).toBe('20~35');
      expect(result.variables['benchmark_cpc_range']).toBe('0.5~1.5');
      expect(result.variables['benchmark_cpe_range']).toBe('2~6');
      expect(result.variables['benchmark_engagement_rate_range']).toBe('3%~8%');

      // Verify ad_type_summary_table and daily_trend_data exist
      expect(result.variables['ad_type_summary_table']).toBeDefined();
      expect(result.variables['daily_trend_data']).toBeDefined();

      expect(result.missingFields).toHaveLength(0);
    });

    it('should query juguang_data table', async () => {
      const mockPrisma = {
        reviewConfig: { findFirst: vi.fn(async () => null) },
        juguangData: { findMany: vi.fn(async () => []) },
        $queryRaw: vi.fn(async () => []),
        note: { findMany: vi.fn(async () => []) },
      } as any;

      const loader = new TrafficAnalysisDataLoader(mockPrisma);
      await loader.load(PROJECT_ID);

      expect(mockPrisma.juguangData.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { projectId: PROJECT_ID } }),
      );
    });
  });

  describe('Requirement 3.7: Chapter 8 (Audience Assets) - AudienceAssetsDataLoader', () => {
    it('should return AIPS population data and flow rates from lingxi_data', async () => {
      const mockPrisma = {
        lingxiData: {
          findMany: vi.fn(async () => [
            {
              dataContent: { awareness: 150000, interest: 80000, purchase: 20000, share: 8000 },
              periodStart: new Date('2025-03-01'),
              periodEnd: new Date('2025-03-31'),
            },
            {
              dataContent: { awareness: 120000, interest: 60000, purchase: 15000, share: 6000 },
              periodStart: new Date('2025-02-01'),
              periodEnd: new Date('2025-02-28'),
            },
          ]),
        },
      } as any;

      const loader = new AudienceAssetsDataLoader(mockPrisma);
      const result = await loader.load(PROJECT_ID);

      expect(result.variables['aips_awareness']).toBe('150000');
      expect(result.variables['aips_interest']).toBe('80000');
      expect(result.variables['aips_purchase']).toBe('20000');
      expect(result.variables['aips_share']).toBe('8000');

      // Verify flow rates (growth from period 2 to period 1)
      expect(result.variables['aips_flow_rates']).toBeDefined();
      const flowRates = JSON.parse(result.variables['aips_flow_rates']!);
      expect(flowRates.awareness_growth).toBeDefined();
      // awareness growth: (150000-120000)/120000 * 100 = 25.0
      expect(parseFloat(flowRates.awareness_growth)).toBeCloseTo(25.0, 0);

      expect(result.missingFields).toHaveLength(0);
    });

    it('should query lingxi_data table with dataType=aips filter', async () => {
      const mockPrisma = {
        lingxiData: { findMany: vi.fn(async () => []) },
      } as any;

      const loader = new AudienceAssetsDataLoader(mockPrisma);
      await loader.load(PROJECT_ID);

      expect(mockPrisma.lingxiData.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { projectId: PROJECT_ID, dataType: 'aips' },
        }),
      );
    });
  });
});
