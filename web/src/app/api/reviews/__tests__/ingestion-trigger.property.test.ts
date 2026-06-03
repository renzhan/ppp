/**
 * Property-based test for ingestion trigger change detection.
 *
 * **Validates: Requirements 6.1, 6.2, 6.3**
 *
 * Property 2: Ingestion trigger change detection
 * - For any two arrays of advertiser IDs (oldIds and newIds), the system SHALL trigger
 *   juguang data ingestion if and only if the arrays differ in content (strict JSON equality).
 * - When both arrays are empty, no trigger occurs.
 * - When creating a new config (oldIds is undefined/empty) and newIds is non-empty, trigger always occurs.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { shouldTriggerIngestion } from '../ingestion-utils';

/**
 * Generator for a valid advertiser ID (numeric string, 1-15 digits)
 */
const advertiserIdArb = fc.stringMatching(/^\d{1,15}$/);

/**
 * Generator for an advertiser ID array (0–10 elements)
 */
const advertiserIdArrayArb = fc.array(advertiserIdArb, { minLength: 0, maxLength: 10 });

describe('Property 2: Ingestion trigger change detection', () => {
  it('trigger iff arrays differ in content (JSON.stringify) AND newIds is non-empty', () => {
    fc.assert(
      fc.property(
        advertiserIdArrayArb,
        advertiserIdArrayArb,
        (oldIds: string[], newIds: string[]) => {
          const result = shouldTriggerIngestion(oldIds, newIds);

          // Expected behavior for update case (oldIds is non-empty):
          // trigger iff newIds is non-empty AND JSON.stringify differs
          if (oldIds.length === 0) {
            // This is effectively a create scenario (old is empty)
            const expected = newIds.length > 0;
            expect(result).toBe(expected);
          } else {
            // Update scenario: trigger iff newIds non-empty AND content differs
            const contentDiffers = JSON.stringify(oldIds) !== JSON.stringify(newIds);
            const expected = newIds.length > 0 && contentDiffers;
            expect(result).toBe(expected);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('both empty arrays → no trigger', () => {
    fc.assert(
      fc.property(
        fc.constant([] as string[]),
        fc.constant([] as string[]),
        (oldIds: string[], newIds: string[]) => {
          expect(shouldTriggerIngestion(oldIds, newIds)).toBe(false);
        }
      ),
      { numRuns: 10 }
    );
  });

  it('create with non-empty newIds (oldIds undefined) → always trigger', () => {
    fc.assert(
      fc.property(
        fc.array(advertiserIdArb, { minLength: 1, maxLength: 10 }),
        (newIds: string[]) => {
          // oldIds is undefined (create case)
          expect(shouldTriggerIngestion(undefined, newIds)).toBe(true);
          // oldIds is null (create case)
          expect(shouldTriggerIngestion(null, newIds)).toBe(true);
          // oldIds is empty array (effectively create)
          expect(shouldTriggerIngestion([], newIds)).toBe(true);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('create with empty newIds → no trigger regardless of oldIds', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(undefined as string[] | undefined | null),
          fc.constant(null as string[] | undefined | null),
          fc.constant([] as string[]),
          advertiserIdArrayArb
        ),
        (oldIds) => {
          expect(shouldTriggerIngestion(oldIds, [])).toBe(false);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('identical arrays (non-empty oldIds, same newIds) → no trigger', () => {
    fc.assert(
      fc.property(
        fc.array(advertiserIdArb, { minLength: 1, maxLength: 10 }),
        (ids: string[]) => {
          // Same array content → no trigger (update with no change)
          const copy = [...ids];
          expect(shouldTriggerIngestion(ids, copy)).toBe(false);
        }
      ),
      { numRuns: 200 }
    );
  });
});
