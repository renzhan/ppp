/**
 * Unit tests for report generation changes — schema-restructure
 *
 * Validates: Requirements 11.1–11.10
 *
 * Concrete examples verifying:
 * 1. CPM/CPC/CPE/CTR computation from notes table fields
 * 2. contentDirection grouping from notes table (with null → "未分类")
 * 3. Quadrant analysis uses kolPrice from notes table
 * 4. Note count from notes table matches expected
 */

import { describe, it, expect, vi } from 'vitest';
import { DataOverviewDataLoader } from '../chapter-03-data-overview';
import { QuadrantAnalysisDataLoader } from '../chapter-05-quadrant-analysis';
import { ContentAnalysisDataLoader } from '../chapter-06-content-analysis';

function createMockPrisma(options: {
  notes: Array<Record<string, any>>;
  juguangData?: Array<Record<string, any>>;
  reviewConfig?: Record<string, any> | null;
  project?: Record<string, any> | null;
  lingxiData?: Array<Record<string, any>>;
}) {
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
  const mockReviewConfig = { findFirst: vi.fn().mockResolvedValue(options.reviewConfig ?? null) };
  const mockProject = { findUnique: vi.fn().mockResolvedValue(options.project ?? null) };
  const mockLingxiData = { findMany: vi.fn().mockResolvedValue(options.lingxiData ?? []) };

  const prisma = new Proxy({} as any, {
    get(_target, prop: string) {
      switch (prop) {
        case 'note': return mockNote;
        case 'juguangData': return mockJuguangData;
        case 'reviewConfig': return mockReviewConfig;
        case 'project': return mockProject;
        case 'lingxiData': return mockLingxiData;
        default: return {};
      }
    },
  });
  return prisma;
}

describe('Report Generation: reads from notes table', () => {
  // ── Test 1: CPM/CPC/CPE/CTR computation with known values ──
  it('computes CPM/CPC/CPE/CTR from notes table fields', async () => {
    const notes = [
      { noteId: 'n1', impNum: 1000, readNum: 200, engageNum: 100, likeNum: 40, favNum: 30, cmtNum: 20, shareNum: 10, followNum: 5, kolPrice: 500, serviceFee: 100 },
      { noteId: 'n2', impNum: 2000, readNum: 400, engageNum: 200, likeNum: 80, favNum: 60, cmtNum: 40, shareNum: 20, followNum: 10, kolPrice: 1000, serviceFee: 200 },
      { noteId: 'n3', impNum: 3000, readNum: 600, engageNum: 300, likeNum: 120, favNum: 90, cmtNum: 60, shareNum: 30, followNum: 15, kolPrice: 1500, serviceFee: 300 },
    ];
    const prisma = createMockPrisma({
      notes,
      project: { projectName: 'Test', brand: 'B', startDate: null, endDate: null, executionStartDate: null },
    });

    const loader = new DataOverviewDataLoader(prisma);
    const result = await loader.load('proj-1');

    // totalCost = (500+100) + (1000+200) + (1500+300) = 3600 (no traffic)
    // impressions = 6000, reads = 1200, engagement = (40+30+20+10)+(80+60+40+20)+(120+90+60+30) = 600
    expect(result.variables['cpm']).toBe(((3600 / 6000) * 1000).toFixed(2)); // 600.00
    expect(result.variables['cpc']).toBe((3600 / 1200).toFixed(2));           // 3.00
    expect(result.variables['cpe']).toBe((3600 / 600).toFixed(2));            // 6.00
    expect(result.variables['ctr']).toBe(((1200 / 6000) * 100).toFixed(2));   // 20.00
  });

  // ── Test 2: contentDirection grouping with null → "未分类" ──
  it('groups by contentDirection with null placed in "未分类"', async () => {
    const notes = [
      { noteId: 'a', kolNickName: 'A', kolFanNum: 1000, noteType: '1', noteTitle: 't', impNum: 100, readNum: 50, engageNum: 20, likeNum: 10, favNum: 5, cmtNum: 3, shareNum: 2, kolPrice: 100, serviceFee: 0, coverImages: [], noteLink: null, contentDirection: '种草' },
      { noteId: 'b', kolNickName: 'B', kolFanNum: 2000, noteType: '1', noteTitle: 't', impNum: 200, readNum: 80, engageNum: 30, likeNum: 15, favNum: 8, cmtNum: 5, shareNum: 2, kolPrice: 200, serviceFee: 0, coverImages: [], noteLink: null, contentDirection: '种草' },
      { noteId: 'c', kolNickName: 'C', kolFanNum: 500, noteType: '2', noteTitle: 't', impNum: 300, readNum: 120, engageNum: 50, likeNum: 20, favNum: 10, cmtNum: 8, shareNum: 12, kolPrice: 300, serviceFee: 0, coverImages: [], noteLink: null, contentDirection: null },
    ];
    const prisma = createMockPrisma({
      notes,
      reviewConfig: { engagementMetric: 'exclude_follow', viralMetric: 'like_comment_share', viralThreshold: 1000, influencerTiers: [{ name: 'KOC', fanRangeMin: 0, fanRangeMax: 9999 }] },
    });

    const loader = new ContentAnalysisDataLoader(prisma);
    const result = await loader.load('proj-1');

    const rows = result.variables['by_content_direction'].split('\n').filter(Boolean);
    expect(rows.length).toBe(2); // "种草" and "未分类"
    expect(rows.some((r: string) => r.includes('种草') && r.includes('| 2 |'))).toBe(true);
    expect(rows.some((r: string) => r.includes('未分类') && r.includes('| 1 |'))).toBe(true);
  });

  // ── Test 3: Quadrant analysis uses engageRate × 投流CPE classification ──
  it('quadrant analysis reads engageRate and computes 投流CPE for classification', async () => {
    const notes = [
      { noteId: 'q1', kolNickName: 'KOL1', engageRate: 0.08, kolPrice: 2000 },
    ];
    const juguangData = [
      { noteId: 'q1', projectId: 'proj-1', fee: 3000, interaction: 200 },
    ];
    const prisma = createMockPrisma({
      notes,
      juguangData,
    });

    const loader = new QuadrantAnalysisDataLoader(prisma);
    const result = await loader.load('proj-1');

    // Only 1 traffic note → X_score=0.5, Y_score=0.5, quadrant='数据不足'
    expect(result.variables['total_analyzed_notes']).toBe('1');
    expect(result.variables['excluded_notes']).toBe('0');
    // detail_table should contain this note's info
    expect(result.variables['detail_table']).toContain('KOL1');
    expect(result.variables['detail_table']).toContain('2000');
  });

  // ── Test 4: Note count from notes table matches expected ──
  it('note_count equals notes array length', async () => {
    const notes = Array.from({ length: 7 }, (_, i) => ({
      noteId: `note-${i}`, impNum: 100, readNum: 50, engageNum: 20,
      likeNum: 10, favNum: 5, cmtNum: 3, shareNum: 2, followNum: 0,
      kolPrice: 100, serviceFee: 50,
    }));
    const prisma = createMockPrisma({
      notes,
      project: { projectName: 'P', brand: 'B', startDate: null, endDate: null, executionStartDate: null },
    });

    const loader = new DataOverviewDataLoader(prisma);
    const result = await loader.load('proj-1');

    expect(result.variables['note_count']).toBe('7');
  });

  // ── Test 5: Null contentDirection → "未分类" ──
  it('null contentDirection in notes produces "未分类" group', async () => {
    const notes = [
      { noteId: 'x1', kolNickName: 'X', kolFanNum: 500, noteType: '1', noteTitle: '', impNum: 50, readNum: 20, engageNum: 10, likeNum: 5, favNum: 3, cmtNum: 1, shareNum: 1, kolPrice: 50, serviceFee: 0, coverImages: [], noteLink: null, contentDirection: null },
    ];
    const prisma = createMockPrisma({
      notes,
      reviewConfig: { engagementMetric: 'exclude_follow', viralMetric: 'like_comment_share', viralThreshold: 1000, influencerTiers: [{ name: 'KOC', fanRangeMin: 0, fanRangeMax: 9999 }] },
    });

    const loader = new ContentAnalysisDataLoader(prisma);
    const result = await loader.load('proj-1');

    const rows = result.variables['by_content_direction'].split('\n').filter(Boolean);
    expect(rows.length).toBe(1);
    expect(rows[0]).toContain('未分类');
  });
});
