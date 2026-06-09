/**
 * Property-based tests for report data loaders — Property 11
 *
 * Feature: schema-restructure, Property 11: Report reads exclusively from notes table
 *
 * Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9
 *
 * Strategy:
 * 1. Verify that the requiredDataSources of Ch3, Ch5, Ch6 loaders do NOT include 'note_base'
 * 2. Mock Prisma client to intercept all calls and verify that noteBase is never queried
 * 3. Generate arbitrary notes data and verify the loaders produce correct outputs derived
 *    from notes table fields (kolPrice, serviceFee, contentDirection, noteType)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { DataOverviewDataLoader } from '../chapter-03-data-overview';
import { QuadrantAnalysisDataLoader } from '../chapter-05-quadrant-analysis';
import { ContentAnalysisDataLoader } from '../chapter-06-content-analysis';

// ─── Mock Prisma Client Builder ───

/**
 * Creates a mock PrismaClient that tracks which models are accessed.
 * Throws if `noteBase` is ever accessed for querying.
 */
function createMockPrisma(options: {
  notes: Array<Record<string, any>>;
  juguangData?: Array<Record<string, any>>;
  reviewConfig?: Record<string, any> | null;
  project?: Record<string, any> | null;
  lingxiData?: Array<Record<string, any>>;
}) {
  const accessedModels = new Set<string>();

  const mockNote = {
    findMany: vi.fn().mockResolvedValue(options.notes),
    count: vi.fn().mockResolvedValue(options.notes.length),
  };

  const mockJuguangData = {
    findMany: vi.fn().mockResolvedValue(options.juguangData ?? []),
    aggregate: vi.fn().mockResolvedValue({
      _sum: {
        fee: (options.juguangData ?? []).reduce((s, j) => s + Number(j.fee ?? 0), 0) || null,
        impression: (options.juguangData ?? []).reduce((s, j) => s + (j.impression ?? 0), 0) || null,
        click: (options.juguangData ?? []).reduce((s, j) => s + (j.click ?? 0), 0) || null,
        interaction: (options.juguangData ?? []).reduce((s, j) => s + (j.interaction ?? 0), 0) || null,
        tiUserNum: (options.juguangData ?? []).reduce((s, j) => s + (j.tiUserNum ?? 0), 0) || null,
      },
    }),
  };

  const mockReviewConfig = {
    findFirst: vi.fn().mockResolvedValue(options.reviewConfig ?? null),
  };

  const mockProject = {
    findUnique: vi.fn().mockResolvedValue(options.project ?? null),
  };

  const mockLingxiData = {
    findMany: vi.fn().mockResolvedValue(options.lingxiData ?? []),
  };

  // noteBase should NEVER be accessed — we use a proxy to detect access
  const noteBaseTrap = new Proxy({}, {
    get(_target, prop) {
      accessedModels.add('noteBase');
      throw new Error(`PROPERTY VIOLATION: noteBase.${String(prop)} was called — report loaders must NOT query note_base`);
    },
  });

  const prisma = new Proxy({} as any, {
    get(_target, prop: string) {
      accessedModels.add(prop);
      switch (prop) {
        case 'note':
          return mockNote;
        case 'juguangData':
          return mockJuguangData;
        case 'reviewConfig':
          return mockReviewConfig;
        case 'project':
          return mockProject;
        case 'lingxiData':
          return mockLingxiData;
        case 'noteBase':
          return noteBaseTrap;
        default:
          return {};
      }
    },
  });

  return { prisma, accessedModels, mockNote, mockJuguangData };
}

// ─── Arbitraries ───

const noteIdArb = fc.hexaString({ minLength: 10, maxLength: 24 });

const contentDirectionArb = fc.constantFrom('种草', '测评', '品宣', '引流', '日常分享', null);

const noteTypeArb = fc.constantFrom('图文', '视频', '1', '2', null);

const metricValueArb = fc.integer({ min: 0, max: 100000 });

const costArb = fc.integer({ min: 0, max: 50000 });

/**
 * Generates a single Note record as returned by prisma.note.findMany.
 */
const noteRecordArb = fc.record({
  noteId: noteIdArb,
  kolNickName: fc.oneof(fc.string({ minLength: 1, maxLength: 10 }), fc.constant(null)),
  kolFanNum: fc.oneof(fc.integer({ min: 0, max: 5000000 }), fc.constant(null)),
  noteType: noteTypeArb,
  noteTitle: fc.oneof(fc.string({ minLength: 1, maxLength: 20 }), fc.constant(null)),
  impNum: metricValueArb,
  readNum: metricValueArb,
  engageNum: metricValueArb,
  likeNum: metricValueArb,
  favNum: metricValueArb,
  cmtNum: metricValueArb,
  shareNum: metricValueArb,
  followNum: fc.integer({ min: 0, max: 10000 }),
  kolPrice: costArb,
  serviceFee: costArb,
  contentDirection: contentDirectionArb,
  cooperationForm: fc.oneof(fc.constantFrom('报备', '非报备', '置换'), fc.constant(null)),
  totalCost: fc.oneof(costArb, fc.constant(null)),
  coverImages: fc.constant([]),
  noteLink: fc.oneof(
    fc.hexaString({ minLength: 10, maxLength: 24 }).map((id) => `https://www.xiaohongshu.com/explore/${id}`),
    fc.constant(null)
  ),
});

/**
 * Generates a list of notes with unique noteIds.
 */
const notesListArb = fc
  .array(noteRecordArb, { minLength: 1, maxLength: 15 })
  .map((notes) => {
    // Ensure unique noteIds
    const seen = new Set<string>();
    return notes.filter((n) => {
      if (seen.has(n.noteId)) return false;
      seen.add(n.noteId);
      return true;
    });
  })
  .filter((notes) => notes.length > 0);

// Feature: schema-restructure, Property 11: Report reads exclusively from notes table
describe('Feature: schema-restructure, Property 11: Report reads exclusively from notes table', () => {
  /**
   * **Validates: Requirements 11.1**
   *
   * Static check: The requiredDataSources arrays of Ch3, Ch5, Ch6 loaders
   * do NOT include 'note_base'. They read only from 'notes' and other tables.
   */
  describe('requiredDataSources does not include note_base', () => {
    it('Ch3 DataOverviewDataLoader does not include note_base in requiredDataSources', () => {
      const { prisma } = createMockPrisma({ notes: [] });
      const loader = new DataOverviewDataLoader(prisma);
      expect(loader.requiredDataSources).not.toContain('note_base');
      expect(loader.requiredDataSources).toContain('notes');
    });

    it('Ch5 QuadrantAnalysisDataLoader does not include note_base in requiredDataSources', () => {
      const { prisma } = createMockPrisma({ notes: [] });
      const loader = new QuadrantAnalysisDataLoader(prisma);
      expect(loader.requiredDataSources).not.toContain('note_base');
      expect(loader.requiredDataSources).toContain('notes');
    });

    it('Ch6 ContentAnalysisDataLoader does not include note_base in requiredDataSources', () => {
      const { prisma } = createMockPrisma({ notes: [] });
      const loader = new ContentAnalysisDataLoader(prisma);
      expect(loader.requiredDataSources).not.toContain('note_base');
      expect(loader.requiredDataSources).toContain('notes');
    });
  });

  /**
   * **Validates: Requirements 11.1, 11.2, 11.4, 11.5, 11.6, 11.8**
   *
   * Property: For any set of notes, Ch3 DataOverviewDataLoader never queries
   * noteBase and correctly derives note_count, kolPrice sum, serviceFee sum,
   * and efficiency metrics (CPM/CPC/CPE/CTR) from notes table fields.
   */
  it('Ch3 DataOverviewDataLoader reads exclusively from notes table and computes metrics correctly', async () => {
    await fc.assert(
      fc.asyncProperty(notesListArb, async (notes) => {
        const { prisma, accessedModels } = createMockPrisma({
          notes,
          project: { projectName: 'Test', brand: 'TestBrand', startDate: null, endDate: null, executionStartDate: null },
          reviewConfig: null,
          juguangData: [],
          lingxiData: [],
        });

        const loader = new DataOverviewDataLoader(prisma);
        const result = await loader.load('test-project-id');

        // noteBase must NEVER have been accessed
        expect(accessedModels.has('noteBase')).toBe(false);

        // note_count from notes table COUNT(*)
        expect(result.variables['note_count']).toBe(String(notes.length));

        // Total impressions/reads from notes table
        const expectedImpressions = notes.reduce((s, n) => s + n.impNum, 0);
        const expectedReads = notes.reduce((s, n) => s + n.readNum, 0);
        expect(result.variables['total_impressions']).toBe(String(expectedImpressions));
        expect(result.variables['total_reads']).toBe(String(expectedReads));

        // Total engagement (default: exclude_follow = like+fav+cmt+share)
        const expectedEngagement = notes.reduce(
          (s, n) => s + n.likeNum + n.favNum + n.cmtNum + n.shareNum,
          0
        );
        expect(result.variables['total_engagement']).toBe(String(expectedEngagement));

        // Content cost = kolPrice + serviceFee (default consumption caliber)
        const kolPriceSum = notes.reduce((s, n) => s + Number(n.kolPrice), 0);
        const serviceFeeSum = notes.reduce((s, n) => s + Number(n.serviceFee), 0);
        const expectedContentCost = kolPriceSum + serviceFeeSum;
        expect(result.variables['content_cost']).toBe(expectedContentCost.toFixed(2));

        // CPM = totalCost / impressions * 1000 (traffic cost = 0 since no juguang data)
        const totalCost = expectedContentCost; // no traffic cost
        const expectedCpm = expectedImpressions > 0
          ? (totalCost / expectedImpressions) * 1000
          : 0;
        expect(result.variables['cpm']).toBe(expectedCpm.toFixed(2));

        // CPC = totalCost / reads
        const expectedCpc = expectedReads > 0
          ? totalCost / expectedReads
          : 0;
        expect(result.variables['cpc']).toBe(expectedCpc.toFixed(2));

        // CPE = totalCost / engagement
        const expectedCpe = expectedEngagement > 0
          ? totalCost / expectedEngagement
          : 0;
        expect(result.variables['cpe']).toBe(expectedCpe.toFixed(2));

        // CTR = reads / impressions * 100
        const expectedCtr = expectedImpressions > 0
          ? (expectedReads / expectedImpressions) * 100
          : 0;
        expect(result.variables['ctr']).toBe(expectedCtr.toFixed(2));
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 11.1, 11.7**
   *
   * Property: For any set of notes with juguang data, Ch5 QuadrantAnalysisDataLoader
   * never queries noteBase. It reads kolPrice and contentDirection from notes table
   * and uses them for quadrant cost calculations.
   */
  it('Ch5 QuadrantAnalysisDataLoader reads exclusively from notes table', async () => {
    await fc.assert(
      fc.asyncProperty(notesListArb, async (notes) => {
        // Create juguang data for some notes so quadrant analysis has data to work with
        const juguangData = notes.slice(0, Math.ceil(notes.length / 2)).map((n) => ({
          noteId: n.noteId,
          projectId: 'test-project-id',
          fee: 1000,
          impression: 5000,
          click: 200,
          interaction: 100,
          tiUserNum: 50,
        }));

        const { prisma, accessedModels } = createMockPrisma({
          notes,
          juguangData,
          reviewConfig: {
            benchmark: { cpm: 50, cpc: 2, cpe: 10, ctr: 5 },
            engagementMetric: 'exclude_follow',
          },
        });

        const loader = new QuadrantAnalysisDataLoader(prisma);
        const result = await loader.load('test-project-id');

        // noteBase must NEVER have been accessed
        expect(accessedModels.has('noteBase')).toBe(false);

        // The loader should produce quadrant variables
        // Notes with juguang data should be analyzed
        const analyzedCount = Number(result.variables['total_analyzed_notes'] ?? '0');
        const excludedCount = Number(result.variables['excluded_notes'] ?? '0');
        expect(analyzedCount + excludedCount).toBe(notes.length);

        // Verify the loader used kolPrice from notes (not note_base)
        // by checking the output references notes table fields
        expect(accessedModels.has('note')).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 11.1, 11.3**
   *
   * Property: For any set of notes, Ch6 ContentAnalysisDataLoader never queries
   * noteBase. It reads contentDirection and noteType from notes table and uses
   * them for grouping/aggregation.
   */
  it('Ch6 ContentAnalysisDataLoader reads exclusively from notes table and groups by contentDirection', async () => {
    await fc.assert(
      fc.asyncProperty(notesListArb, async (notes) => {
        const { prisma, accessedModels } = createMockPrisma({
          notes,
          juguangData: [],
          reviewConfig: {
            engagementMetric: 'exclude_follow',
            viralMetric: 'like_comment_share',
            viralThreshold: 1000,
            influencerTiers: [
              { name: '头部', fanRangeMin: 500000, fanRangeMax: 99999999 },
              { name: '腰部', fanRangeMin: 100000, fanRangeMax: 499999 },
              { name: '尾部', fanRangeMin: 10000, fanRangeMax: 99999 },
              { name: 'KOC', fanRangeMin: 0, fanRangeMax: 9999 },
            ],
          },
        });

        const loader = new ContentAnalysisDataLoader(prisma);
        const result = await loader.load('test-project-id');

        // noteBase must NEVER have been accessed
        expect(accessedModels.has('noteBase')).toBe(false);

        // The loader should produce by_content_direction variables
        // by_content_direction uses notes.contentDirection for grouping
        expect(result.variables).toHaveProperty('by_content_direction');
        expect(result.variables).toHaveProperty('by_kol_type');
        expect(result.variables).toHaveProperty('total_notes');

        // total_notes should match the notes count from notes table
        expect(result.variables['total_notes']).toBe(String(notes.length));

        // Verify note model was accessed (reading from notes table)
        expect(accessedModels.has('note')).toBe(true);

        // Verify contentDirection grouping works correctly:
        // Count the distinct contentDirection values in our generated notes
        const directions = new Set(notes.map((n) => n.contentDirection || '未分类'));
        // The by_content_direction output should contain entries for each direction
        const outputLines = (result.variables['by_content_direction'] ?? '').split('\n').filter(Boolean);
        // Number of output rows should match number of distinct directions
        expect(outputLines.length).toBe(directions.size);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 11.4, 11.5, 11.9**
   *
   * Property: For any set of notes, the Ch3 loader uses notes.kolPrice for content
   * cost (consumption caliber) and notes.serviceFee for settlement caliber.
   * Note count uses COUNT(*) from notes table.
   */
  it('Ch3 uses kolPrice and serviceFee from notes table for cost calculations', async () => {
    await fc.assert(
      fc.asyncProperty(notesListArb, async (notes) => {
        // Test with settlement caliber
        const { prisma, accessedModels } = createMockPrisma({
          notes,
          project: { projectName: 'Test', brand: 'TestBrand', startDate: null, endDate: null, executionStartDate: null },
          reviewConfig: {
            kpiTargets: null,
            benchmark: null,
            engagementMetric: 'exclude_follow',
            viralMetric: 'like_comment_share',
            viralThreshold: 1000,
            modules: { contentCostCaliber: 'settlement', trafficCostCaliber: 'consumption' },
          },
          juguangData: [],
          lingxiData: [],
        });

        const loader = new DataOverviewDataLoader(prisma);
        const result = await loader.load('test-project-id');

        // noteBase must NEVER have been accessed
        expect(accessedModels.has('noteBase')).toBe(false);

        // Settlement caliber: content cost = SUM(serviceFee) only
        const serviceFeeSum = notes.reduce((s, n) => s + Number(n.serviceFee), 0);
        expect(result.variables['content_cost']).toBe(serviceFeeSum.toFixed(2));

        // Note count from notes table COUNT(*)
        expect(result.variables['note_count']).toBe(String(notes.length));
      }),
      { numRuns: 100 }
    );
  });
});
