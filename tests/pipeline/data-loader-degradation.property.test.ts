import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
  ChapterDataLoaderRegistry,
  BaseChapterDataLoader,
  ChapterDataContext,
} from '../../src/pipeline/loaders/types';
import { CoverDataLoader } from '../../src/pipeline/loaders/chapter-01-cover';
import { ProjectReviewDataLoader } from '../../src/pipeline/loaders/chapter-02-project-review';
import { DataOverviewDataLoader } from '../../src/pipeline/loaders/chapter-03-data-overview';
import { HighlightsDataLoader } from '../../src/pipeline/loaders/chapter-04-highlights';
import { QuadrantAnalysisDataLoader } from '../../src/pipeline/loaders/chapter-05-quadrant-analysis';
import { ContentAnalysisDataLoader } from '../../src/pipeline/loaders/chapter-06-content-analysis';
import { TrafficAnalysisDataLoader } from '../../src/pipeline/loaders/chapter-07-traffic-analysis';
import { AudienceAssetsDataLoader } from '../../src/pipeline/loaders/chapter-08-audience-assets';
import { OptimizationDataLoader } from '../../src/pipeline/loaders/chapter-09-optimization';
import { EndPageDataLoader } from '../../src/pipeline/loaders/chapter-10-end-page';

/**
 * Property 3: Data loader graceful degradation
 * Validates: Requirements 3.8
 *
 * For any chapter number (1-10) and for any subset of available data in the database,
 * the Chapter_Data_Loader SHALL return a ChapterDataContext where `variables` contains
 * all loadable fields and `missingFields` lists all fields that could not be loaded,
 * with `variables` keys and `missingFields` being disjoint and their union equaling
 * the full set of required fields for that chapter.
 */
describe('Feature: report-generation-pipeline, Property 3: Data loader graceful degradation', () => {
  // Suppress console.warn during tests
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  /**
   * Creates a mock PrismaClient that returns data based on the provided availability map.
   * Each data source can be either available (returns mock data) or unavailable (returns null/empty).
   */
  function createMockPrisma(availableData: {
    project?: boolean;
    notes?: boolean;
    juguangData?: boolean;
    kpiTargets?: boolean;
    aiGeneratedContent?: boolean;
    reviewConfig?: boolean;
    lingxiData?: boolean;
    businessAnnotations?: boolean;
  }) {
    const mockProject = availableData.project
      ? {
          id: 'test-project-id',
          category: '美妆护肤',
          brand: '测试品牌',
          businessLine: '日常种草',
          projectName: '测试项目',
          startDate: new Date('2025-01-01'),
          endDate: new Date('2025-03-31'),
        }
      : null;

    const mockNotes = availableData.notes
      ? [
          {
            noteId: 'note-1',
            kolNickName: 'KOL1',
            noteType: '图文',
            impNum: 5000,
            readNum: 2000,
            engageNum: 300,
            likeNum: 200,
            favNum: 50,
            cmtNum: 30,
            shareNum: 20,
            kolPrice: { toNumber: () => 1000, toString: () => '1000' },
            serviceFee: { toNumber: () => 100, toString: () => '100' },
            followNum: 5,
          },
          {
            noteId: 'note-2',
            kolNickName: 'KOL2',
            noteType: '视频',
            impNum: 10000,
            readNum: 4000,
            engageNum: 600,
            likeNum: 400,
            favNum: 100,
            cmtNum: 60,
            shareNum: 40,
            kolPrice: { toNumber: () => 2000, toString: () => '2000' },
            serviceFee: { toNumber: () => 200, toString: () => '200' },
            followNum: 10,
          },
        ]
      : [];

    const mockJuguangData = availableData.juguangData
      ? [
          {
            noteId: 'note-1',
            fee: { toNumber: () => 500, toString: () => '500' },
            impression: 3000,
            click: 800,
            interaction: 150,
            iUserNum: 50,
            tiUserNum: 20,
          },
        ]
      : [];

    const mockKpiTargets = availableData.kpiTargets
      ? [
          { metricName: 'impression', targetValue: { toNumber: () => 10000, toString: () => '10000' } },
          { metricName: 'read', targetValue: { toNumber: () => 5000, toString: () => '5000' } },
          { metricName: 'engagement', targetValue: { toNumber: () => 800, toString: () => '800' } },
        ]
      : [];

    const mockAiContent = availableData.aiGeneratedContent
      ? {
          generatedContent: JSON.stringify({
            projectObjective: '提升品牌知名度',
            strategy: '种草策略',
            targetAudience: '18-35岁女性',
            coreMessage: '品质生活',
          }),
          editedContent: null,
          isEdited: false,
        }
      : null;

    const mockReviewConfig = availableData.reviewConfig
      ? {
          launchPhases: [{ name: '预热期', startDate: '2025-01-01', endDate: '2025-01-15' }],
          benchmark: { cpm: 30, cpc: 2, cpe: 5 },
        }
      : null;

    const mockLingxiData = availableData.lingxiData
      ? [
          {
            dataContent: { awareness: 100000, interest: 50000, purchase: 10000, share: 5000 },
            periodStart: new Date('2025-01-01'),
            periodEnd: new Date('2025-03-31'),
          },
        ]
      : [];

    const mockBusinessAnnotations = availableData.businessAnnotations
      ? [
          { noteId: 'note-1', contentDirection: '产品测评', kolType: 'KOC', accountType: '素人' },
          { noteId: 'note-2', contentDirection: '日常分享', kolType: 'KOL', accountType: '达人' },
        ]
      : [];

    return {
      project: {
        findUnique: vi.fn().mockResolvedValue(mockProject),
      },
      note: {
        findMany: vi.fn().mockResolvedValue(mockNotes),
      },
      noteBase: {
        count: vi.fn().mockResolvedValue(availableData.notes ? 2 : 0),
      },
      juguangData: {
        findMany: vi.fn().mockResolvedValue(mockJuguangData),
        aggregate: vi.fn().mockResolvedValue({
          _sum: availableData.juguangData
            ? { fee: 500, impression: 3000, click: 800, interaction: 150, tiUserNum: 20 }
            : { fee: null, impression: null, click: null, interaction: null, tiUserNum: null },
        }),
      },
      kpiTarget: {
        findMany: vi.fn().mockResolvedValue(mockKpiTargets),
      },
      aiGeneratedContent: {
        findFirst: vi.fn().mockResolvedValue(mockAiContent),
      },
      reviewConfig: {
        findFirst: vi.fn().mockResolvedValue(mockReviewConfig),
      },
      lingxiData: {
        findMany: vi.fn().mockResolvedValue(mockLingxiData),
        findFirst: vi.fn().mockResolvedValue(mockLingxiData.length > 0 ? mockLingxiData[0] : null),
      },
      businessAnnotation: {
        findMany: vi.fn().mockResolvedValue(mockBusinessAnnotations),
      },
      $queryRaw: vi.fn().mockResolvedValue(availableData.notes ? [{ cnt: BigInt(2), cs: 1100, ads: 0 }] : [{ cnt: BigInt(0), cs: 0, ads: 0 }]),
    } as any;
  }

  /**
   * Get a loader instance for the given chapter number with the provided mock prisma.
   */
  function getLoaderForChapter(chapterNumber: number, mockPrisma: any): BaseChapterDataLoader {
    switch (chapterNumber) {
      case 1: return new CoverDataLoader(mockPrisma);
      case 2: return new ProjectReviewDataLoader(mockPrisma);
      case 3: return new DataOverviewDataLoader(mockPrisma);
      case 4: return new HighlightsDataLoader(mockPrisma);
      case 5: return new QuadrantAnalysisDataLoader(mockPrisma);
      case 6: return new ContentAnalysisDataLoader(mockPrisma);
      case 7: return new TrafficAnalysisDataLoader(mockPrisma);
      case 8: return new AudienceAssetsDataLoader(mockPrisma);
      case 9: return new OptimizationDataLoader(mockPrisma);
      case 10: return new EndPageDataLoader(mockPrisma);
      default: throw new Error(`Invalid chapter number: ${chapterNumber}`);
    }
  }

  // Generator for chapter numbers (1-10)
  const chapterNumberArb = fc.integer({ min: 1, max: 10 });

  // Generator for data availability (random subset of data sources)
  const dataAvailabilityArb = fc.record({
    project: fc.boolean(),
    notes: fc.boolean(),
    juguangData: fc.boolean(),
    kpiTargets: fc.boolean(),
    aiGeneratedContent: fc.boolean(),
    reviewConfig: fc.boolean(),
    lingxiData: fc.boolean(),
    businessAnnotations: fc.boolean(),
  });

  it('variables keys and missingFields should be disjoint', async () => {
    await fc.assert(
      fc.asyncProperty(
        chapterNumberArb,
        dataAvailabilityArb,
        async (chapterNumber, availability) => {
          const mockPrisma = createMockPrisma(availability);
          const loader = getLoaderForChapter(chapterNumber, mockPrisma);
          const result = await loader.load('test-project-id');

          // Variables keys and missingFields must be disjoint
          const variableKeys = Object.keys(result.variables);
          const overlap = variableKeys.filter((k) => result.missingFields.includes(k));
          expect(overlap).toEqual([]);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('union of variables keys and missingFields should equal requiredFields', async () => {
    await fc.assert(
      fc.asyncProperty(
        chapterNumberArb,
        dataAvailabilityArb,
        async (chapterNumber, availability) => {
          const mockPrisma = createMockPrisma(availability);
          const loader = getLoaderForChapter(chapterNumber, mockPrisma);
          const result = await loader.load('test-project-id');

          // All requiredFields should appear in either variables or missingFields
          const variableKeys = Object.keys(result.variables);
          const union = new Set([...variableKeys, ...result.missingFields]);

          for (const field of loader.requiredFields) {
            expect(union.has(field)).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('missingFields should contain no duplicates', async () => {
    await fc.assert(
      fc.asyncProperty(
        chapterNumberArb,
        dataAvailabilityArb,
        async (chapterNumber, availability) => {
          const mockPrisma = createMockPrisma(availability);
          const loader = getLoaderForChapter(chapterNumber, mockPrisma);
          const result = await loader.load('test-project-id');

          // missingFields should have no duplicates
          const uniqueMissing = [...new Set(result.missingFields)];
          expect(result.missingFields.length).toBe(uniqueMissing.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('all three properties hold simultaneously for any chapter and data subset', async () => {
    await fc.assert(
      fc.asyncProperty(
        chapterNumberArb,
        dataAvailabilityArb,
        async (chapterNumber, availability) => {
          const mockPrisma = createMockPrisma(availability);
          const loader = getLoaderForChapter(chapterNumber, mockPrisma);
          const result = await loader.load('test-project-id');

          const variableKeys = Object.keys(result.variables);

          // (1) Disjoint: no key appears in both variables and missingFields
          const overlap = variableKeys.filter((k) => result.missingFields.includes(k));
          expect(overlap).toEqual([]);

          // (2) All requiredFields appear in variables or missingFields
          const union = new Set([...variableKeys, ...result.missingFields]);
          for (const field of loader.requiredFields) {
            expect(union.has(field)).toBe(true);
          }

          // (3) No duplicates in missingFields
          const uniqueMissing = [...new Set(result.missingFields)];
          expect(result.missingFields.length).toBe(uniqueMissing.length);

          // (4) All variable values are non-empty strings
          for (const [key, value] of Object.entries(result.variables)) {
            expect(typeof value).toBe('string');
            expect(value.length).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
