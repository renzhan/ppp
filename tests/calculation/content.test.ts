import { describe, it, expect } from 'vitest';
import { aggregateByDimension } from '../../src/calculation/content';
import type { AnnotatedNote } from '../../src/shared/types';

/**
 * Helper to create an AnnotatedNote with defaults
 */
function makeNote(overrides: Partial<AnnotatedNote> = {}): AnnotatedNote {
  return {
    noteId: 'note-1',
    noteType: 'image',
    impNum: 1000,
    readNum: 500,
    likeNum: 100,
    favNum: 50,
    cmtNum: 30,
    shareNum: 20,
    followNum: 10,
    kolPrice: 500,
    serviceFee: 100,
    isUnderwater: false,
    underwaterPrice: 0,
    contentDirection: '种草',
    accountType: '美妆博主',
    kolType: '达人',
    launchPhase: '预热期',
    ...overrides,
  };
}

describe('aggregateByDimension', () => {
  it('should return empty array for empty notes input', () => {
    const result = aggregateByDimension([], 'noteType');
    expect(result).toEqual([]);
  });

  it('should group by noteType dimension', () => {
    const notes: AnnotatedNote[] = [
      makeNote({ noteId: 'n1', noteType: 'image', impNum: 1000, readNum: 500 }),
      makeNote({ noteId: 'n2', noteType: 'video', impNum: 2000, readNum: 800 }),
      makeNote({ noteId: 'n3', noteType: 'image', impNum: 1500, readNum: 600 }),
    ];

    const result = aggregateByDimension(notes, 'noteType');

    expect(result).toHaveLength(2);
    // Find image and video groups
    const imageGroup = result.find(r => r.dimensionValue === 'image');
    const videoGroup = result.find(r => r.dimensionValue === 'video');

    expect(imageGroup).toBeDefined();
    expect(imageGroup!.noteCount).toBe(2);
    expect(imageGroup!.totalImpressions).toBe(2500);
    expect(imageGroup!.totalReads).toBe(1100);

    expect(videoGroup).toBeDefined();
    expect(videoGroup!.noteCount).toBe(1);
    expect(videoGroup!.totalImpressions).toBe(2000);
    expect(videoGroup!.totalReads).toBe(800);
  });

  it('should group by contentDirection dimension', () => {
    const notes: AnnotatedNote[] = [
      makeNote({ noteId: 'n1', contentDirection: '种草', impNum: 1000 }),
      makeNote({ noteId: 'n2', contentDirection: '测评', impNum: 2000 }),
      makeNote({ noteId: 'n3', contentDirection: '种草', impNum: 1500 }),
    ];

    const result = aggregateByDimension(notes, 'contentDirection');

    expect(result).toHaveLength(2);
    const seedGroup = result.find(r => r.dimensionValue === '种草');
    const reviewGroup = result.find(r => r.dimensionValue === '测评');

    expect(seedGroup!.noteCount).toBe(2);
    expect(seedGroup!.totalImpressions).toBe(2500);
    expect(reviewGroup!.noteCount).toBe(1);
    expect(reviewGroup!.totalImpressions).toBe(2000);
  });

  it('should group by accountType dimension', () => {
    const notes: AnnotatedNote[] = [
      makeNote({ noteId: 'n1', accountType: '美妆博主' }),
      makeNote({ noteId: 'n2', accountType: '生活博主' }),
      makeNote({ noteId: 'n3', accountType: '美妆博主' }),
    ];

    const result = aggregateByDimension(notes, 'accountType');
    expect(result).toHaveLength(2);
    const beautyGroup = result.find(r => r.dimensionValue === '美妆博主');
    expect(beautyGroup!.noteCount).toBe(2);
  });

  it('should group by kolType dimension', () => {
    const notes: AnnotatedNote[] = [
      makeNote({ noteId: 'n1', kolType: '达人' }),
      makeNote({ noteId: 'n2', kolType: '素人' }),
    ];

    const result = aggregateByDimension(notes, 'kolType');
    expect(result).toHaveLength(2);
  });

  it('should group by launchPhase dimension', () => {
    const notes: AnnotatedNote[] = [
      makeNote({ noteId: 'n1', launchPhase: '预热期' }),
      makeNote({ noteId: 'n2', launchPhase: '爆发期' }),
      makeNote({ noteId: 'n3', launchPhase: '预热期' }),
    ];

    const result = aggregateByDimension(notes, 'launchPhase');
    expect(result).toHaveLength(2);
    const warmupGroup = result.find(r => r.dimensionValue === '预热期');
    expect(warmupGroup!.noteCount).toBe(2);
  });

  it('should compute totalEngagement using default config (like+fav+cmt+share+follow)', () => {
    const notes: AnnotatedNote[] = [
      makeNote({
        noteId: 'n1',
        noteType: 'image',
        likeNum: 100,
        favNum: 50,
        cmtNum: 30,
        shareNum: 20,
        followNum: 10,
      }),
    ];

    const result = aggregateByDimension(notes, 'noteType');
    expect(result[0].totalEngagement).toBe(100 + 50 + 30 + 20 + 10);
  });

  it('should compute CPE as totalCost / totalEngagement for above-water notes', () => {
    const notes: AnnotatedNote[] = [
      makeNote({
        noteId: 'n1',
        noteType: 'image',
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

    const result = aggregateByDimension(notes, 'noteType');
    // Cost = 1000 + 200 = 1200, Engagement = 100+50+30+20+0 = 200
    expect(result[0].cpe).toBe(1200 / 200);
  });

  it('should compute CPE using underwaterPrice for underwater notes', () => {
    const notes: AnnotatedNote[] = [
      makeNote({
        noteId: 'n1',
        noteType: 'image',
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

    const result = aggregateByDimension(notes, 'noteType');
    // Cost = underwaterPrice = 800, Engagement = 200
    expect(result[0].cpe).toBe(800 / 200);
  });

  it('should return N/A for CPE when totalEngagement is 0', () => {
    const notes: AnnotatedNote[] = [
      makeNote({
        noteId: 'n1',
        noteType: 'image',
        likeNum: 0,
        favNum: 0,
        cmtNum: 0,
        shareNum: 0,
        followNum: 0,
      }),
    ];

    const result = aggregateByDimension(notes, 'noteType');
    expect(result[0].cpe).toBe('N/A');
  });

  it('should count viral notes correctly (like+fav+cmt >= 1000)', () => {
    const notes: AnnotatedNote[] = [
      makeNote({ noteId: 'n1', noteType: 'image', likeNum: 500, favNum: 300, cmtNum: 200 }), // 1000 = viral
      makeNote({ noteId: 'n2', noteType: 'image', likeNum: 500, favNum: 300, cmtNum: 199 }), // 999 = not viral
      makeNote({ noteId: 'n3', noteType: 'image', likeNum: 800, favNum: 200, cmtNum: 100 }), // 1100 = viral
    ];

    const result = aggregateByDimension(notes, 'noteType');
    expect(result[0].viralCount).toBe(2);
    expect(result[0].viralRate).toBeCloseTo(2 / 3);
  });

  it('should compute viralRate as viralCount / noteCount', () => {
    const notes: AnnotatedNote[] = [
      makeNote({ noteId: 'n1', noteType: 'image', likeNum: 1000, favNum: 0, cmtNum: 0 }), // viral
      makeNote({ noteId: 'n2', noteType: 'image', likeNum: 10, favNum: 5, cmtNum: 3 }), // not viral
    ];

    const result = aggregateByDimension(notes, 'noteType');
    expect(result[0].viralRate).toBe(1 / 2);
  });

  it('should sort results by totalEngagement descending', () => {
    const notes: AnnotatedNote[] = [
      makeNote({
        noteId: 'n1',
        contentDirection: '种草',
        likeNum: 10,
        favNum: 5,
        cmtNum: 3,
        shareNum: 2,
        followNum: 0,
      }), // engagement = 20
      makeNote({
        noteId: 'n2',
        contentDirection: '测评',
        likeNum: 200,
        favNum: 100,
        cmtNum: 50,
        shareNum: 30,
        followNum: 20,
      }), // engagement = 400
      makeNote({
        noteId: 'n3',
        contentDirection: '日常',
        likeNum: 50,
        favNum: 30,
        cmtNum: 20,
        shareNum: 10,
        followNum: 5,
      }), // engagement = 115
    ];

    const result = aggregateByDimension(notes, 'contentDirection');
    expect(result[0].dimensionValue).toBe('测评');
    expect(result[0].totalEngagement).toBe(400);
    expect(result[1].dimensionValue).toBe('日常');
    expect(result[1].totalEngagement).toBe(115);
    expect(result[2].dimensionValue).toBe('种草');
    expect(result[2].totalEngagement).toBe(20);
  });

  it('should handle mixed above-water and underwater notes in same group', () => {
    const notes: AnnotatedNote[] = [
      makeNote({
        noteId: 'n1',
        noteType: 'image',
        kolPrice: 1000,
        serviceFee: 200,
        isUnderwater: false,
        underwaterPrice: 0,
        likeNum: 50,
        favNum: 25,
        cmtNum: 15,
        shareNum: 10,
        followNum: 0,
      }),
      makeNote({
        noteId: 'n2',
        noteType: 'image',
        kolPrice: 2000,
        serviceFee: 300,
        isUnderwater: true,
        underwaterPrice: 500,
        likeNum: 50,
        favNum: 25,
        cmtNum: 15,
        shareNum: 10,
        followNum: 0,
      }),
    ];

    const result = aggregateByDimension(notes, 'noteType');
    // Cost: note1 = 1000+200=1200, note2 = 500 (underwater), total = 1700
    // Engagement: (50+25+15+10+0)*2 = 200
    expect(result[0].cpe).toBe(1700 / 200);
  });

  it('should handle single note in a group', () => {
    const notes: AnnotatedNote[] = [
      makeNote({ noteId: 'n1', noteType: 'video', impNum: 5000, readNum: 2000 }),
    ];

    const result = aggregateByDimension(notes, 'noteType');
    expect(result).toHaveLength(1);
    expect(result[0].dimensionValue).toBe('video');
    expect(result[0].noteCount).toBe(1);
    expect(result[0].totalImpressions).toBe(5000);
    expect(result[0].totalReads).toBe(2000);
  });
});
