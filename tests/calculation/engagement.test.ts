import { describe, it, expect } from 'vitest';
import { calculateEngagement } from '../../src/calculation/engagement';
import type { NoteMetrics, EngagementConfig } from '../../src/shared/types';

const baseNote: NoteMetrics = {
  noteId: 'note-001',
  likeNum: 100,
  favNum: 50,
  cmtNum: 30,
  shareNum: 20,
  followNum: 10,
  impNum: 5000,
  readNum: 1000,
};

describe('calculateEngagement', () => {
  it('includes all metrics when both includeShare and includeFollow are true', () => {
    const config: EngagementConfig = { includeShare: true, includeFollow: true };
    // 100 + 50 + 30 + 20 + 10 = 210
    expect(calculateEngagement(baseNote, config)).toBe(210);
  });

  it('excludes shareNum when includeShare is false', () => {
    const config: EngagementConfig = { includeShare: false, includeFollow: true };
    // 100 + 50 + 30 + 10 = 190
    expect(calculateEngagement(baseNote, config)).toBe(190);
  });

  it('excludes followNum when includeFollow is false', () => {
    const config: EngagementConfig = { includeShare: true, includeFollow: false };
    // 100 + 50 + 30 + 20 = 200
    expect(calculateEngagement(baseNote, config)).toBe(200);
  });

  it('excludes both shareNum and followNum when both are false', () => {
    const config: EngagementConfig = { includeShare: false, includeFollow: false };
    // 100 + 50 + 30 = 180
    expect(calculateEngagement(baseNote, config)).toBe(180);
  });

  it('returns 0 when all metric values are 0', () => {
    const zeroNote: NoteMetrics = {
      noteId: 'note-zero',
      likeNum: 0,
      favNum: 0,
      cmtNum: 0,
      shareNum: 0,
      followNum: 0,
      impNum: 0,
      readNum: 0,
    };
    const config: EngagementConfig = { includeShare: true, includeFollow: true };
    expect(calculateEngagement(zeroNote, config)).toBe(0);
  });

  it('handles large metric values correctly', () => {
    const largeNote: NoteMetrics = {
      noteId: 'note-large',
      likeNum: 100000,
      favNum: 50000,
      cmtNum: 30000,
      shareNum: 20000,
      followNum: 10000,
      impNum: 1000000,
      readNum: 500000,
    };
    const config: EngagementConfig = { includeShare: true, includeFollow: true };
    expect(calculateEngagement(largeNote, config)).toBe(210000);
  });

  it('only sums engagement metrics, not impNum or readNum', () => {
    const note: NoteMetrics = {
      noteId: 'note-imp',
      likeNum: 1,
      favNum: 1,
      cmtNum: 1,
      shareNum: 1,
      followNum: 1,
      impNum: 999999,
      readNum: 888888,
    };
    const config: EngagementConfig = { includeShare: true, includeFollow: true };
    expect(calculateEngagement(note, config)).toBe(5);
  });
});
