/**
 * Unit tests for fillNotesFromNoteBase — concrete examples
 *
 * Feature: schema-restructure
 * Validates: Requirements 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7
 *
 * Tests the actual PrismaDataPersistenceService.fillNotesFromNoteBase method
 * with mocked Prisma client to verify the two-step data flow behavior.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the shared db module before importing the service
vi.mock('../../shared/db.js', () => {
  const mockPrisma = {
    noteBase: {
      findMany: vi.fn(),
    },
    note: {
      upsert: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  return { prisma: mockPrisma, getPrismaClient: () => mockPrisma };
});

import { PrismaDataPersistenceService } from '../persistence-service.js';
import { prisma } from '../../shared/db.js';

const mockPrisma = prisma as unknown as {
  noteBase: { findMany: ReturnType<typeof vi.fn> };
  note: { upsert: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};

describe('fillNotesFromNoteBase unit tests', () => {
  let service: PrismaDataPersistenceService;
  const projectId = 'project-001';

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PrismaDataPersistenceService();
    // $transaction executes the array of operations passed to it
    mockPrisma.$transaction.mockImplementation(async (ops: unknown[]) => ops);
  });

  /**
   * Test Step 1 alone: official cooperation notes keep their existing metrics.
   * 2 notes, both in allNoteIds, neither in missingNoteIds.
   *
   * Validates: Requirements 13.1, 13.2, 13.4, 13.6
   */
  it('Step 1 alone: official notes get only 5 required fields, metrics untouched', async () => {
    const allNoteIds = ['note-A', 'note-B'];
    const missingNoteIds: string[] = []; // Both are official — pugongying has data

    mockPrisma.noteBase.findMany.mockResolvedValue([
      {
        noteId: 'note-A',
        projectId,
        noteLink: 'https://www.xiaohongshu.com/explore/aaa',
        contentDirection: '种草',
        kolType: '图文',
        contentCost: 5000,
        contentSettlement: 6000,
        totalCost: 8000,
        cooperationForm: '报备',
        metrics: { impNum: 10000, readNum: 5000, engageNum: 800, likeNum: 300, favNum: 200, cmtNum: 100, shareNum: 50 },
      },
      {
        noteId: 'note-B',
        projectId,
        noteLink: 'https://www.xiaohongshu.com/explore/bbb',
        contentDirection: '测评',
        kolType: '视频',
        contentCost: 3000,
        contentSettlement: 4000,
        totalCost: 5000,
        cooperationForm: '非报备',
        metrics: { impNum: 20000, readNum: 8000, engageNum: 1200, likeNum: 500, favNum: 400, cmtNum: 200, shareNum: 100 },
      },
    ]);

    // upsert returns a placeholder (the operation object is what gets passed to $transaction)
    mockPrisma.note.upsert.mockReturnValue({ _tag: 'upsert' });

    await service.fillNotesFromNoteBase(projectId, allNoteIds, missingNoteIds);

    // Step 1: should call upsert for both notes
    expect(mockPrisma.note.upsert).toHaveBeenCalledTimes(2);

    // Verify note-A upsert args: only 5 required fields
    expect(mockPrisma.note.upsert).toHaveBeenCalledWith({
      where: { projectId_noteId: { projectId, noteId: 'note-A' } },
      create: {
        projectId,
        noteId: 'note-A',
        noteLink: 'https://www.xiaohongshu.com/explore/aaa',
        contentDirection: '种草',
        noteType: '图文',
        kolPrice: 5000,
        serviceFee: 6000,
      },
      update: {
        noteLink: 'https://www.xiaohongshu.com/explore/aaa',
        contentDirection: '种草',
        noteType: '图文',
        kolPrice: 5000,
        serviceFee: 6000,
      },
    });

    // Verify note-B upsert args
    expect(mockPrisma.note.upsert).toHaveBeenCalledWith({
      where: { projectId_noteId: { projectId, noteId: 'note-B' } },
      create: {
        projectId,
        noteId: 'note-B',
        noteLink: 'https://www.xiaohongshu.com/explore/bbb',
        contentDirection: '测评',
        noteType: '视频',
        kolPrice: 3000,
        serviceFee: 4000,
      },
      update: {
        noteLink: 'https://www.xiaohongshu.com/explore/bbb',
        contentDirection: '测评',
        noteType: '视频',
        kolPrice: 3000,
        serviceFee: 4000,
      },
    });

    // Step 2 should NOT execute: $transaction called only once (Step 1)
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);

    // update should never be called (Step 2 not triggered)
    expect(mockPrisma.note.update).not.toHaveBeenCalled();
  });

  /**
   * Test Step 2: non-official notes get full data from note_base.
   * 1 note in both allNoteIds and missingNoteIds.
   *
   * Validates: Requirements 13.1, 13.3, 13.5, 13.7
   */
  it('Step 2: non-official note gets Step 1 upsert + Step 2 update with metrics and dataSource', async () => {
    const allNoteIds = ['note-X'];
    const missingNoteIds = ['note-X']; // Non-official — pugongying has no data

    mockPrisma.noteBase.findMany.mockResolvedValue([
      {
        noteId: 'note-X',
        projectId,
        noteLink: 'https://www.xiaohongshu.com/explore/xxx',
        contentDirection: '品宣',
        kolType: '图文',
        contentCost: 2000,
        contentSettlement: 2500,
        totalCost: 3500,
        cooperationForm: '置换',
        metrics: { impNum: 15000, readNum: 6000, engageNum: 900, likeNum: 400, favNum: 250, cmtNum: 150, shareNum: 80 },
      },
    ]);

    mockPrisma.note.upsert.mockReturnValue({ _tag: 'upsert' });
    mockPrisma.note.update.mockReturnValue({ _tag: 'update' });

    await service.fillNotesFromNoteBase(projectId, allNoteIds, missingNoteIds);

    // Step 1: upsert called once
    expect(mockPrisma.note.upsert).toHaveBeenCalledTimes(1);
    expect(mockPrisma.note.upsert).toHaveBeenCalledWith({
      where: { projectId_noteId: { projectId, noteId: 'note-X' } },
      create: {
        projectId,
        noteId: 'note-X',
        noteLink: 'https://www.xiaohongshu.com/explore/xxx',
        contentDirection: '品宣',
        noteType: '图文',
        kolPrice: 2000,
        serviceFee: 2500,
      },
      update: {
        noteLink: 'https://www.xiaohongshu.com/explore/xxx',
        contentDirection: '品宣',
        noteType: '图文',
        kolPrice: 2000,
        serviceFee: 2500,
      },
    });

    // Step 2: update called once with metrics + dataSource
    expect(mockPrisma.note.update).toHaveBeenCalledTimes(1);
    expect(mockPrisma.note.update).toHaveBeenCalledWith({
      where: { projectId_noteId: { projectId, noteId: 'note-X' } },
      data: {
        totalCost: 3500,
        cooperationForm: '置换',
        impNum: 15000,
        readNum: 6000,
        engageNum: 900,
        likeNum: 400,
        favNum: 250,
        cmtNum: 150,
        shareNum: 80,
        dataSource: 'note_base',
      },
    });

    // $transaction called twice: once for Step 1, once for Step 2
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(2);
  });

  /**
   * Mixed scenario: some official, some non-official in same project.
   * 3 notes - note1 is official (in allNoteIds only),
   * note2 and note3 are non-official (in both allNoteIds and missingNoteIds).
   *
   * Validates: Requirements 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7
   */
  it('Mixed scenario: official notes get Step 1 only, non-official get both steps', async () => {
    const allNoteIds = ['note-1', 'note-2', 'note-3'];
    const missingNoteIds = ['note-2', 'note-3']; // note-1 is official

    mockPrisma.noteBase.findMany.mockResolvedValue([
      {
        noteId: 'note-1',
        projectId,
        noteLink: 'https://www.xiaohongshu.com/explore/111',
        contentDirection: '种草',
        kolType: '图文',
        contentCost: 10000,
        contentSettlement: 12000,
        totalCost: 15000,
        cooperationForm: '报备',
        metrics: { impNum: 50000, readNum: 20000, engageNum: 3000, likeNum: 1500, favNum: 800, cmtNum: 400, shareNum: 200 },
      },
      {
        noteId: 'note-2',
        projectId,
        noteLink: 'https://www.xiaohongshu.com/explore/222',
        contentDirection: '测评',
        kolType: '视频',
        contentCost: 4000,
        contentSettlement: 5000,
        totalCost: 6000,
        cooperationForm: '非报备',
        metrics: { impNum: 8000, readNum: 3000, engageNum: 500, likeNum: 200, favNum: 150, cmtNum: 80, shareNum: 40 },
      },
      {
        noteId: 'note-3',
        projectId,
        noteLink: null,
        contentDirection: null,
        kolType: null,
        contentCost: null,
        contentSettlement: null,
        totalCost: 2000,
        cooperationForm: '赠品',
        metrics: { impNum: 5000, readNum: 2000, engageNum: 300, likeNum: 100, favNum: 80, cmtNum: 50, shareNum: 20 },
      },
    ]);

    mockPrisma.note.upsert.mockReturnValue({ _tag: 'upsert' });
    mockPrisma.note.update.mockReturnValue({ _tag: 'update' });

    await service.fillNotesFromNoteBase(projectId, allNoteIds, missingNoteIds);

    // Step 1: all 3 notes get upsert
    expect(mockPrisma.note.upsert).toHaveBeenCalledTimes(3);

    // Verify note-1 (official) upsert — only 5 fields
    expect(mockPrisma.note.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { projectId_noteId: { projectId, noteId: 'note-1' } },
        update: {
          noteLink: 'https://www.xiaohongshu.com/explore/111',
          contentDirection: '种草',
          noteType: '图文',
          kolPrice: 10000,
          serviceFee: 12000,
        },
      })
    );

    // Step 2: only note-2 and note-3 get update (non-official)
    expect(mockPrisma.note.update).toHaveBeenCalledTimes(2);

    // Verify note-2 update has metrics + dataSource
    expect(mockPrisma.note.update).toHaveBeenCalledWith({
      where: { projectId_noteId: { projectId, noteId: 'note-2' } },
      data: {
        totalCost: 6000,
        cooperationForm: '非报备',
        impNum: 8000,
        readNum: 3000,
        engageNum: 500,
        likeNum: 200,
        favNum: 150,
        cmtNum: 80,
        shareNum: 40,
        dataSource: 'note_base',
      },
    });

    // Verify note-3 update (null fields mapped correctly)
    expect(mockPrisma.note.update).toHaveBeenCalledWith({
      where: { projectId_noteId: { projectId, noteId: 'note-3' } },
      data: {
        totalCost: 2000,
        cooperationForm: '赠品',
        impNum: 5000,
        readNum: 2000,
        engageNum: 300,
        likeNum: 100,
        favNum: 80,
        cmtNum: 50,
        shareNum: 20,
        dataSource: 'note_base',
      },
    });

    // note-1 should NOT have an update call (official — no Step 2)
    const updateCalls = mockPrisma.note.update.mock.calls;
    const updatedNoteIds = updateCalls.map(
      (call: unknown[]) => (call[0] as { where: { projectId_noteId: { noteId: string } } }).where.projectId_noteId.noteId
    );
    expect(updatedNoteIds).not.toContain('note-1');
  });

  /**
   * Edge case: note_base has no metrics (null) for a non-official note.
   * All metric values should default to 0.
   *
   * Validates: Requirements 13.3, 13.5
   */
  it('Edge case: null metrics for non-official note defaults all metric fields to 0', async () => {
    const allNoteIds = ['note-Z'];
    const missingNoteIds = ['note-Z'];

    mockPrisma.noteBase.findMany.mockResolvedValue([
      {
        noteId: 'note-Z',
        projectId,
        noteLink: 'https://www.xiaohongshu.com/explore/zzz',
        contentDirection: '引流',
        kolType: '视频',
        contentCost: 1000,
        contentSettlement: 1500,
        totalCost: null,
        cooperationForm: null,
        metrics: null, // No metrics data at all
      },
    ]);

    mockPrisma.note.upsert.mockReturnValue({ _tag: 'upsert' });
    mockPrisma.note.update.mockReturnValue({ _tag: 'update' });

    await service.fillNotesFromNoteBase(projectId, allNoteIds, missingNoteIds);

    // Step 1 still runs normally
    expect(mockPrisma.note.upsert).toHaveBeenCalledTimes(1);

    // Step 2: all metrics default to 0
    expect(mockPrisma.note.update).toHaveBeenCalledTimes(1);
    expect(mockPrisma.note.update).toHaveBeenCalledWith({
      where: { projectId_noteId: { projectId, noteId: 'note-Z' } },
      data: {
        totalCost: null,
        cooperationForm: undefined,
        impNum: 0,
        readNum: 0,
        engageNum: 0,
        likeNum: 0,
        favNum: 0,
        cmtNum: 0,
        shareNum: 0,
        dataSource: 'note_base',
      },
    });
  });
});
