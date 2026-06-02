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
          })),
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
            launchPhases: ['预热期', '爆发期', '长尾期'],
          })),
        },
      } as any;

      const loader = new ProjectReviewDataLoader(mockPrisma);
      const result = await loader.load(PROJECT_ID);

      expect(result.variables['project_objective']).toBe('提升品牌知名度');
      expect(result.variables['strategy']).toBe('多维度种草');
      expect(result.variables['target_audience']).toBe('18-35岁女性');
      expect(result.variables['core_message']).toBe('天然护肤');
      expect(result.variables['launch_phases']).toBe(JSON.stringify(['预热期', '爆发期', '长尾期']));
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
          })),
        },
        note: {
          findMany: vi.fn(async () => [
            { impNum: 5000, readNum: 1500, engageNum: 300, likeNum: 200, favNum: 50, cmtNum: 30, shareNum: 20, kolPrice: 1000, serviceFee: 100 },
            { impNum: 8000, readNum: 2000, engageNum: 500, likeNum: 350, favNum: 80, cmtNum: 50, shareNum: 20, kolPrice: 2000, serviceFee: 200 },
            { impNum: 3000, readNum: 800, engageNum: 150, likeNum: 100, favNum: 30, cmtNum: 15, shareNum: 5, kolPrice: 500, serviceFee: 50 },
          ]),
        },
        kpiTarget: {
          findMany: vi.fn(async () => [
            { metricName: 'impression', targetValue: 10000 },
            { metricName: 'read', targetValue: 3000 },
            { metricName: 'engagement', targetValue: 800 },
          ]),
        },
      } as any;

      const loader = new DataOverviewDataLoader(mockPrisma);
      const result = await loader.load(PROJECT_ID);

      // Verify aggregated metrics
      expect(result.variables['note_count']).toBe('3');
      expect(result.variables['total_impressions']).toBe('16000');
      expect(result.variables['total_reads']).toBe('4300');
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
        note: { findMany: vi.fn(async () => []) },
        kpiTarget: { findMany: vi.fn(async () => []) },
      } as any;

      const loader = new DataOverviewDataLoader(mockPrisma);
      await loader.load(PROJECT_ID);

      expect(mockPrisma.note.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { projectId: PROJECT_ID } }),
      );
      expect(mockPrisma.kpiTarget.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { projectId: PROJECT_ID } }),
      );
    });
  });

  describe('Requirement 3.4: Chapter 4 (Highlights) - HighlightsDataLoader', () => {
    it('should return KPI exceeded metrics, viral notes, benchmark, and AIPS data', async () => {
      const mockPrisma = {
        note: {
          findMany: vi.fn(async () => [
            { noteId: 'n1', kolNickName: 'KOL_A', noteType: 'image', impNum: 10000, readNum: 3000, engageNum: 800, likeNum: 500, favNum: 200, cmtNum: 80, shareNum: 20, kolPrice: 1000, serviceFee: 100 },
            { noteId: 'n2', kolNickName: 'KOL_B', noteType: 'video', impNum: 5000, readNum: 500, engageNum: 100, likeNum: 60, favNum: 20, cmtNum: 15, shareNum: 5, kolPrice: 800, serviceFee: 80 },
          ]),
        },
        kpiTarget: {
          findMany: vi.fn(async () => [
            { metricName: 'impression', targetValue: 10000 },
            { metricName: 'read', targetValue: 5000 },
            { metricName: 'engagement', targetValue: 1000 },
          ]),
        },
        reviewConfig: {
          findFirst: vi.fn(async () => ({
            benchmark: { cpm: 50, cpc: 2, cpe: 10, ctr: 5 },
          })),
        },
        lingxiData: {
          findFirst: vi.fn(async () => ({
            dataContent: { awareness: 100000, interest: 50000, purchase: 10000, share: 5000 },
          })),
        },
      } as any;

      const loader = new HighlightsDataLoader(mockPrisma);
      const result = await loader.load(PROJECT_ID);

      // Verify KPI exceeded metrics (impression: 15000 > 10000)
      expect(result.variables['kpi_exceeded_metrics']).toBeDefined();
      const exceededMetrics = JSON.parse(result.variables['kpi_exceeded_metrics']!);
      expect(exceededMetrics.length).toBeGreaterThan(0);
      expect(exceededMetrics[0].metric).toBe('曝光');

      // Verify viral notes (readNum >= 1000)
      expect(result.variables['viral_notes_details']).toBeDefined();
      const viralNotes = JSON.parse(result.variables['viral_notes_details']!);
      expect(viralNotes.length).toBe(1); // Only n1 has readNum >= 1000
      expect(viralNotes[0].noteId).toBe('n1');

      // Verify benchmark data
      expect(result.variables['above_benchmark_metrics']).toBeDefined();

      // Verify AIPS data
      expect(result.variables['aips_data']).toBeDefined();
      const aips = JSON.parse(result.variables['aips_data']!);
      expect(aips.awareness).toBe(100000);
    });
  });

  describe('Requirement 3.9: Chapter 5 (Quadrant Analysis) - QuadrantAnalysisDataLoader', () => {
    it('should return per-note metrics and quadrant summary', async () => {
      const mockPrisma = {
        note: {
          findMany: vi.fn(async () => [
            { noteId: 'n1', kolNickName: 'KOL_A', noteType: 'image', impNum: 10000, readNum: 3000, engageNum: 800, kolPrice: 1000, serviceFee: 100 },
            { noteId: 'n2', kolNickName: 'KOL_B', noteType: 'video', impNum: 5000, readNum: 1000, engageNum: 200, kolPrice: 2000, serviceFee: 200 },
          ]),
        },
        juguangData: {
          findMany: vi.fn(async () => [
            { noteId: 'n1', fee: 500, impression: 8000, click: 2000, interaction: 400 },
          ]),
        },
      } as any;

      const loader = new QuadrantAnalysisDataLoader(mockPrisma);
      const result = await loader.load(PROJECT_ID);

      // Verify per-note metrics
      expect(result.variables['per_note_metrics']).toBeDefined();
      const perNoteMetrics = JSON.parse(result.variables['per_note_metrics']!);
      expect(perNoteMetrics).toHaveLength(2);
      expect(perNoteMetrics[0].noteId).toBe('n1');
      expect(perNoteMetrics[0].hasPaidTraffic).toBe(true);
      expect(perNoteMetrics[1].hasPaidTraffic).toBe(false);

      // Verify each note has CPE, CPM, CPC, CTR
      for (const note of perNoteMetrics) {
        expect(note.cpm).toBeDefined();
        expect(note.cpc).toBeDefined();
        expect(note.cpe).toBeDefined();
        expect(note.ctr).toBeDefined();
      }

      // Verify quadrant summary
      expect(result.variables['quadrant_summary']).toBeDefined();
      const quadrants = JSON.parse(result.variables['quadrant_summary']!);
      expect(quadrants.highEngLowCost).toBeDefined();
      expect(quadrants.highEngHighCost).toBeDefined();
      expect(quadrants.lowEngLowCost).toBeDefined();
      expect(quadrants.lowEngHighCost).toBeDefined();
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
        expect.objectContaining({ where: { projectId: PROJECT_ID } }),
      );
    });
  });

  describe('Requirement 3.5: Chapter 6 (Content Analysis) - ContentAnalysisDataLoader', () => {
    it('should return metrics grouped by contentDirection, noteType, kolType', async () => {
      const mockPrisma = {
        note: {
          findMany: vi.fn(async () => [
            { noteId: 'n1', noteType: 'image', impNum: 10000, readNum: 3000, engageNum: 800, kolPrice: 1000, serviceFee: 100 },
            { noteId: 'n2', noteType: 'video', impNum: 5000, readNum: 1500, engageNum: 400, kolPrice: 800, serviceFee: 80 },
            { noteId: 'n3', noteType: 'image', impNum: 8000, readNum: 2000, engageNum: 600, kolPrice: 1200, serviceFee: 120 },
          ]),
        },
        businessAnnotation: {
          findMany: vi.fn(async () => [
            { noteId: 'n1', contentDirection: '产品测评', kolType: '美妆博主' },
            { noteId: 'n2', contentDirection: '日常分享', kolType: '生活博主' },
            { noteId: 'n3', contentDirection: '产品测评', kolType: '美妆博主' },
          ]),
        },
      } as any;

      const loader = new ContentAnalysisDataLoader(mockPrisma);
      const result = await loader.load(PROJECT_ID);

      // Verify by_content_direction
      expect(result.variables['by_content_direction']).toBeDefined();
      const byDirection = JSON.parse(result.variables['by_content_direction']!);
      expect(byDirection.length).toBeGreaterThan(0);
      const testEval = byDirection.find((d: any) => d.name === '产品测评');
      expect(testEval).toBeDefined();
      expect(testEval.count).toBe(2);

      // Verify by_note_type
      expect(result.variables['by_note_type']).toBeDefined();
      const byNoteType = JSON.parse(result.variables['by_note_type']!);
      expect(byNoteType.length).toBe(2); // image and video
      const imageType = byNoteType.find((t: any) => t.name === 'image');
      expect(imageType).toBeDefined();
      expect(imageType.count).toBe(2);

      // Verify by_kol_type
      expect(result.variables['by_kol_type']).toBeDefined();
      const byKolType = JSON.parse(result.variables['by_kol_type']!);
      expect(byKolType.length).toBe(2); // 美妆博主 and 生活博主

      // Verify each group has derived metrics
      for (const group of byDirection) {
        expect(group.cpm).toBeDefined();
        expect(group.cpc).toBeDefined();
        expect(group.cpe).toBeDefined();
        expect(group.ctr).toBeDefined();
      }
    });

    it('should query notes and business_annotations tables', async () => {
      const mockPrisma = {
        note: { findMany: vi.fn(async () => []) },
        businessAnnotation: { findMany: vi.fn(async () => []) },
      } as any;

      const loader = new ContentAnalysisDataLoader(mockPrisma);
      await loader.load(PROJECT_ID);

      expect(mockPrisma.note.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { projectId: PROJECT_ID } }),
      );
      expect(mockPrisma.businessAnnotation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { projectId: PROJECT_ID } }),
      );
    });
  });

  describe('Requirement 3.6: Chapter 7 (Traffic Analysis) - TrafficAnalysisDataLoader', () => {
    it('should return aggregated paid traffic metrics with derived CPM/CPC/CPE/CTR', async () => {
      const mockPrisma = {
        juguangData: {
          findMany: vi.fn(async () => [
            { fee: 1000, impression: 50000, click: 5000, interaction: 1000, iUserNum: 200, tiUserNum: 50 },
            { fee: 2000, impression: 80000, click: 8000, interaction: 2000, iUserNum: 300, tiUserNum: 80 },
          ]),
        },
        reviewConfig: {
          findFirst: vi.fn(async () => ({
            benchmark: { ctr: { min: 2, max: 5 }, cpm: { min: 20, max: 35 }, cpc: { min: 0.5, max: 1.5 }, cpe: { min: 2, max: 6 }, engagementRate: { min: 3, max: 8 } },
          })),
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

      expect(result.missingFields).toHaveLength(0);
    });

    it('should query juguang_data table', async () => {
      const mockPrisma = {
        juguangData: { findMany: vi.fn(async () => []) },
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
