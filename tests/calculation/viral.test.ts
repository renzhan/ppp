import { describe, it, expect } from 'vitest';
import { isViralNote, calculateViralRate } from '../../src/calculation/viral';
import type { NoteMetrics } from '../../src/shared/types';

function makeNote(overrides: Partial<NoteMetrics> = {}): NoteMetrics {
  return {
    noteId: 'note-001',
    likeNum: 0,
    favNum: 0,
    cmtNum: 0,
    shareNum: 0,
    followNum: 0,
    impNum: 0,
    readNum: 0,
    ...overrides,
  };
}

describe('isViralNote', () => {
  it('returns false when like + fav + cmt < 1000', () => {
    const note = makeNote({ likeNum: 500, favNum: 300, cmtNum: 198 }); // sum = 998
    expect(isViralNote(note)).toBe(false);
  });

  it('returns false at boundary 999', () => {
    const note = makeNote({ likeNum: 333, favNum: 333, cmtNum: 333 }); // sum = 999
    expect(isViralNote(note)).toBe(false);
  });

  it('returns true at exact threshold 1000', () => {
    const note = makeNote({ likeNum: 500, favNum: 300, cmtNum: 200 }); // sum = 1000
    expect(isViralNote(note)).toBe(true);
  });

  it('returns true when like + fav + cmt > 1000', () => {
    const note = makeNote({ likeNum: 800, favNum: 500, cmtNum: 300 }); // sum = 1600
    expect(isViralNote(note)).toBe(true);
  });

  it('does NOT include shareNum in viral calculation', () => {
    // like + fav + cmt = 900, but shareNum = 500 (should not count)
    const note = makeNote({ likeNum: 300, favNum: 300, cmtNum: 300, shareNum: 500 });
    expect(isViralNote(note)).toBe(false);
  });

  it('does NOT include followNum in viral calculation', () => {
    // like + fav + cmt = 900, but followNum = 500 (should not count)
    const note = makeNote({ likeNum: 300, favNum: 300, cmtNum: 300, followNum: 500 });
    expect(isViralNote(note)).toBe(false);
  });

  it('returns false when all metrics are 0', () => {
    const note = makeNote();
    expect(isViralNote(note)).toBe(false);
  });

  it('returns true when a single metric reaches 1000', () => {
    const note = makeNote({ likeNum: 1000 });
    expect(isViralNote(note)).toBe(true);
  });
});

describe('calculateViralRate', () => {
  it('returns viralCount 0 and viralRate 0 for empty array', () => {
    const result = calculateViralRate([]);
    expect(result).toEqual({ viralCount: 0, viralRate: 0 });
  });

  it('returns correct count and rate when no notes are viral', () => {
    const notes = [
      makeNote({ likeNum: 100, favNum: 100, cmtNum: 100 }), // 300
      makeNote({ likeNum: 200, favNum: 200, cmtNum: 200 }), // 600
    ];
    const result = calculateViralRate(notes);
    expect(result.viralCount).toBe(0);
    expect(result.viralRate).toBe(0);
  });

  it('returns correct count and rate when all notes are viral', () => {
    const notes = [
      makeNote({ likeNum: 500, favNum: 300, cmtNum: 200 }), // 1000
      makeNote({ likeNum: 600, favNum: 400, cmtNum: 300 }), // 1300
    ];
    const result = calculateViralRate(notes);
    expect(result.viralCount).toBe(2);
    expect(result.viralRate).toBe(1);
  });

  it('returns correct count and rate for mixed notes', () => {
    const notes = [
      makeNote({ likeNum: 500, favNum: 300, cmtNum: 200 }), // 1000 - viral
      makeNote({ likeNum: 100, favNum: 100, cmtNum: 100 }), // 300 - not viral
      makeNote({ likeNum: 400, favNum: 400, cmtNum: 400 }), // 1200 - viral
      makeNote({ likeNum: 50, favNum: 50, cmtNum: 50 }),     // 150 - not viral
    ];
    const result = calculateViralRate(notes);
    expect(result.viralCount).toBe(2);
    expect(result.viralRate).toBe(0.5);
  });

  it('calculates viralRate as viralCount / totalCount', () => {
    const notes = [
      makeNote({ likeNum: 1000 }), // viral
      makeNote({ likeNum: 0 }),     // not viral
      makeNote({ likeNum: 0 }),     // not viral
    ];
    const result = calculateViralRate(notes);
    expect(result.viralCount).toBe(1);
    expect(result.viralRate).toBeCloseTo(1 / 3);
  });

  it('ignores shareNum and followNum for viral detection in rate calculation', () => {
    const notes = [
      makeNote({ likeNum: 300, favNum: 300, cmtNum: 300, shareNum: 500, followNum: 500 }), // 900 (not viral)
    ];
    const result = calculateViralRate(notes);
    expect(result.viralCount).toBe(0);
    expect(result.viralRate).toBe(0);
  });
});
