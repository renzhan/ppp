import { describe, it, expect } from 'vitest';
import { classifyKOLTier, aggregateByKOLTier } from '../../src/calculation/kol-tier';
import type { NoteWithKOL } from '../../src/shared/types';

function makeNoteWithKOL(overrides: Partial<NoteWithKOL> = {}): NoteWithKOL {
  return {
    noteId: 'note-001',
    kolId: 'kol-001',
    kolFanNum: 5000,
    kolNickName: 'TestKOL',
    impNum: 1000,
    readNum: 200,
    likeNum: 50,
    favNum: 30,
    cmtNum: 20,
    shareNum: 10,
    followNum: 5,
    kolPrice: 500,
    serviceFee: 100,
    isUnderwater: false,
    underwaterPrice: 0,
    ...overrides,
  };
}

describe('classifyKOLTier', () => {
  it('classifies fanCount 0 as KOC', () => {
    expect(classifyKOLTier(0)).toBe('KOC');
  });

  it('classifies fanCount 9999 as KOC', () => {
    expect(classifyKOLTier(9999)).toBe('KOC');
  });

  it('classifies fanCount 10000 as 尾部', () => {
    expect(classifyKOLTier(10000)).toBe('尾部');
  });

  it('classifies fanCount 49999 as 尾部', () => {
    expect(classifyKOLTier(49999)).toBe('尾部');
  });

  it('classifies fanCount 50000 as 腰尾部', () => {
    expect(classifyKOLTier(50000)).toBe('腰尾部');
  });

  it('classifies fanCount 99999 as 腰尾部', () => {
    expect(classifyKOLTier(99999)).toBe('腰尾部');
  });

  it('classifies fanCount 100000 as 腰部', () => {
    expect(classifyKOLTier(100000)).toBe('腰部');
  });

  it('classifies fanCount 499999 as 腰部', () => {
    expect(classifyKOLTier(499999)).toBe('腰部');
  });

  it('classifies fanCount 500000 as 头部', () => {
    expect(classifyKOLTier(500000)).toBe('头部');
  });

  it('classifies fanCount 1000000 as 头部', () => {
    expect(classifyKOLTier(1000000)).toBe('头部');
  });
});

describe('aggregateByKOLTier', () => {
  it('returns empty array for empty notes', () => {
    const result = aggregateByKOLTier([]);
    expect(result).toEqual([]);
  });

  it('groups notes by tier and computes noteCount', () => {
    const notes: NoteWithKOL[] = [
      makeNoteWithKOL({ noteId: 'n1', kolFanNum: 5000 }),   // KOC
      makeNoteWithKOL({ noteId: 'n2', kolFanNum: 8000 }),   // KOC
      makeNoteWithKOL({ noteId: 'n3', kolFanNum: 20000 }),  // 尾部
    ];
    const result = aggregateByKOLTier(notes);
    const kocTier = result.find(r => r.tier === 'KOC');
    const tailTier = result.find(r => r.tier === '尾部');
    expect(kocTier?.noteCount).toBe(2);
    expect(tailTier?.noteCount).toBe(1);
  });

  it('computes totalImpressions correctly', () => {
    const notes: NoteWithKOL[] = [
      makeNoteWithKOL({ noteId: 'n1', kolFanNum: 5000, impNum: 1000 }),
      makeNoteWithKOL({ noteId: 'n2', kolFanNum: 8000, impNum: 2000 }),
    ];
    const result = aggregateByKOLTier(notes);
    const kocTier = result.find(r => r.tier === 'KOC');
    expect(kocTier?.totalImpressions).toBe(3000);
  });

  it('computes totalReads correctly', () => {
    const notes: NoteWithKOL[] = [
      makeNoteWithKOL({ noteId: 'n1', kolFanNum: 5000, readNum: 100 }),
      makeNoteWithKOL({ noteId: 'n2', kolFanNum: 8000, readNum: 200 }),
    ];
    const result = aggregateByKOLTier(notes);
    const kocTier = result.find(r => r.tier === 'KOC');
    expect(kocTier?.totalReads).toBe(300);
  });

  it('computes totalEngagement using default config (like+fav+cmt+share+follow)', () => {
    const notes: NoteWithKOL[] = [
      makeNoteWithKOL({
        noteId: 'n1',
        kolFanNum: 5000,
        likeNum: 100,
        favNum: 50,
        cmtNum: 30,
        shareNum: 20,
        followNum: 10,
      }),
    ];
    const result = aggregateByKOLTier(notes);
    const kocTier = result.find(r => r.tier === 'KOC');
    // 100 + 50 + 30 + 20 + 10 = 210
    expect(kocTier?.totalEngagement).toBe(210);
  });

  it('computes averageCPE for above-water notes (kolPrice + serviceFee) / totalEngagement', () => {
    const notes: NoteWithKOL[] = [
      makeNoteWithKOL({
        noteId: 'n1',
        kolFanNum: 5000,
        kolPrice: 1000,
        serviceFee: 200,
        isUnderwater: false,
        likeNum: 100,
        favNum: 50,
        cmtNum: 30,
        shareNum: 20,
        followNum: 0,
      }),
    ];
    const result = aggregateByKOLTier(notes);
    const kocTier = result.find(r => r.tier === 'KOC');
    // cost = 1000 + 200 = 1200, engagement = 100+50+30+20+0 = 200
    // CPE = 1200 / 200 = 6
    expect(kocTier?.averageCPE).toBe(6);
  });

  it('computes averageCPE for underwater notes using underwaterPrice', () => {
    const notes: NoteWithKOL[] = [
      makeNoteWithKOL({
        noteId: 'n1',
        kolFanNum: 5000,
        kolPrice: 1000,
        serviceFee: 200,
        isUnderwater: true,
        underwaterPrice: 800,
        likeNum: 100,
        favNum: 50,
        cmtNum: 30,
        shareNum: 20,
        followNum: 0,
      }),
    ];
    const result = aggregateByKOLTier(notes);
    const kocTier = result.find(r => r.tier === 'KOC');
    // cost = 800 (underwater), engagement = 200
    // CPE = 800 / 200 = 4
    expect(kocTier?.averageCPE).toBe(4);
  });

  it('returns N/A for averageCPE when totalEngagement is 0', () => {
    const notes: NoteWithKOL[] = [
      makeNoteWithKOL({
        noteId: 'n1',
        kolFanNum: 5000,
        kolPrice: 1000,
        serviceFee: 200,
        likeNum: 0,
        favNum: 0,
        cmtNum: 0,
        shareNum: 0,
        followNum: 0,
      }),
    ];
    const result = aggregateByKOLTier(notes);
    const kocTier = result.find(r => r.tier === 'KOC');
    expect(kocTier?.averageCPE).toBe('N/A');
  });

  it('detects viral notes using fixed threshold (like+fav+cmt >= 1000)', () => {
    const notes: NoteWithKOL[] = [
      makeNoteWithKOL({ noteId: 'n1', kolFanNum: 5000, likeNum: 500, favNum: 300, cmtNum: 200 }), // 1000 - viral
      makeNoteWithKOL({ noteId: 'n2', kolFanNum: 8000, likeNum: 300, favNum: 300, cmtNum: 399 }), // 999 - not viral
    ];
    const result = aggregateByKOLTier(notes);
    const kocTier = result.find(r => r.tier === 'KOC');
    expect(kocTier?.viralCount).toBe(1);
    expect(kocTier?.viralRate).toBe(0.5);
  });

  it('viral detection ignores shareNum and followNum', () => {
    const notes: NoteWithKOL[] = [
      makeNoteWithKOL({
        noteId: 'n1',
        kolFanNum: 5000,
        likeNum: 300,
        favNum: 300,
        cmtNum: 300,
        shareNum: 500,
        followNum: 500,
      }), // like+fav+cmt = 900, not viral despite high share/follow
    ];
    const result = aggregateByKOLTier(notes);
    const kocTier = result.find(r => r.tier === 'KOC');
    expect(kocTier?.viralCount).toBe(0);
  });

  it('computes viralRate as viralCount / noteCount', () => {
    const notes: NoteWithKOL[] = [
      makeNoteWithKOL({ noteId: 'n1', kolFanNum: 5000, likeNum: 1000 }), // viral
      makeNoteWithKOL({ noteId: 'n2', kolFanNum: 8000, likeNum: 0 }),    // not viral
      makeNoteWithKOL({ noteId: 'n3', kolFanNum: 9000, likeNum: 0 }),    // not viral
    ];
    const result = aggregateByKOLTier(notes);
    const kocTier = result.find(r => r.tier === 'KOC');
    expect(kocTier?.viralCount).toBe(1);
    expect(kocTier?.viralRate).toBeCloseTo(1 / 3);
  });

  it('handles multiple tiers in a single call', () => {
    const notes: NoteWithKOL[] = [
      makeNoteWithKOL({ noteId: 'n1', kolFanNum: 5000 }),    // KOC
      makeNoteWithKOL({ noteId: 'n2', kolFanNum: 20000 }),   // 尾部
      makeNoteWithKOL({ noteId: 'n3', kolFanNum: 75000 }),   // 腰尾部
      makeNoteWithKOL({ noteId: 'n4', kolFanNum: 200000 }),  // 腰部
      makeNoteWithKOL({ noteId: 'n5', kolFanNum: 600000 }),  // 头部
    ];
    const result = aggregateByKOLTier(notes);
    expect(result.length).toBe(5);
    const tiers = result.map(r => r.tier);
    expect(tiers).toContain('KOC');
    expect(tiers).toContain('尾部');
    expect(tiers).toContain('腰尾部');
    expect(tiers).toContain('腰部');
    expect(tiers).toContain('头部');
  });

  it('correctly sums cost for mixed above-water and underwater notes in same tier', () => {
    const notes: NoteWithKOL[] = [
      makeNoteWithKOL({
        noteId: 'n1',
        kolFanNum: 5000,
        kolPrice: 1000,
        serviceFee: 200,
        isUnderwater: false,
        underwaterPrice: 0,
        likeNum: 50,
        favNum: 25,
        cmtNum: 25,
        shareNum: 0,
        followNum: 0,
      }),
      makeNoteWithKOL({
        noteId: 'n2',
        kolFanNum: 8000,
        kolPrice: 2000,
        serviceFee: 300,
        isUnderwater: true,
        underwaterPrice: 1500,
        likeNum: 50,
        favNum: 25,
        cmtNum: 25,
        shareNum: 0,
        followNum: 0,
      }),
    ];
    const result = aggregateByKOLTier(notes);
    const kocTier = result.find(r => r.tier === 'KOC');
    // above-water cost: 1000 + 200 = 1200
    // underwater cost: 1500
    // total cost: 2700, total engagement: 100 + 100 = 200
    // CPE = 2700 / 200 = 13.5
    expect(kocTier?.averageCPE).toBe(13.5);
  });
});
