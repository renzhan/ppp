/**
 * Property-based test for viral threshold classification correctness.
 *
 * **Validates: Requirements 4.3, 4.4, 4.5**
 *
 * Property 1: Viral threshold classification correctness
 * - For any note with non-negative engagement metrics and any positive threshold,
 *   isViralNote(note, threshold) returns true iff likeNum + favNum + cmtNum >= threshold
 * - When threshold is not provided, the function behaves as if threshold is 1000
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { isViralNote, DEFAULT_VIRAL_THRESHOLD } from '../viral.js';
import type { NoteMetrics } from '../../shared/types.js';

/**
 * Generator for NoteMetrics with random engagement values (0–100000)
 */
const noteMetricsArb = fc.record({
  noteId: fc.string({ minLength: 1, maxLength: 10 }),
  likeNum: fc.integer({ min: 0, max: 100000 }),
  favNum: fc.integer({ min: 0, max: 100000 }),
  cmtNum: fc.integer({ min: 0, max: 100000 }),
  shareNum: fc.integer({ min: 0, max: 100000 }),
  followNum: fc.integer({ min: 0, max: 100000 }),
  impNum: fc.integer({ min: 0, max: 1000000 }),
  readNum: fc.integer({ min: 0, max: 1000000 }),
});

describe('Property 1: Viral threshold classification correctness', () => {
  it('isViralNote(note, threshold) returns true iff likeNum + favNum + cmtNum >= threshold', () => {
    fc.assert(
      fc.property(
        noteMetricsArb,
        fc.integer({ min: 1, max: 50000 }),
        (note: NoteMetrics, threshold: number) => {
          const result = isViralNote(note, threshold);
          const engagementSum = note.likeNum + note.favNum + note.cmtNum;
          const expected = engagementSum >= threshold;

          expect(result).toBe(expected);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('isViralNote(note) without threshold behaves as if threshold is DEFAULT_VIRAL_THRESHOLD (1000)', () => {
    fc.assert(
      fc.property(
        noteMetricsArb,
        (note: NoteMetrics) => {
          const resultNoThreshold = isViralNote(note);
          const resultWithDefault = isViralNote(note, DEFAULT_VIRAL_THRESHOLD);
          const engagementSum = note.likeNum + note.favNum + note.cmtNum;
          const expected = engagementSum >= 1000;

          // Without threshold should match with explicit default threshold
          expect(resultNoThreshold).toBe(resultWithDefault);
          // Both should match the manual calculation
          expect(resultNoThreshold).toBe(expected);
        }
      ),
      { numRuns: 200 }
    );
  });
});
