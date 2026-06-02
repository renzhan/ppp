/**
 * Property-based test for KOL tier classification via exposure rate.
 *
 * **Validates: Requirements 7.2, 7.3, 7.4**
 *
 * Property 3: KOL tier classification via exposure rate
 * - For any note with non-negative impression count, any KOL with positive fan count,
 *   and any non-overlapping tier configuration, classifyKOLByExposureRate returns
 *   the tier name whose range [lowerBound, upperBound) contains impressions/fanCount,
 *   or "未分类" if no range matches.
 * - When fanCount <= 0, the function always returns "未分类".
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { classifyKOLByExposureRate, type ExposureRateTierConfig } from '../kol-tier.js';

/**
 * Generator for non-overlapping tier configs (1–5 tiers).
 * Strategy: generate sorted boundary points, then create tiers from adjacent pairs.
 */
const nonOverlappingTierConfigArb = fc
  .integer({ min: 1, max: 5 })
  .chain((tierCount) => {
    // Generate tierCount + 1 unique sorted boundary points to form tierCount non-overlapping ranges
    return fc
      .uniqueArray(fc.double({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true }), {
        minLength: tierCount + 1,
        maxLength: tierCount + 1,
      })
      .map((boundaries) => {
        const sorted = [...boundaries].sort((a, b) => a - b);
        const tiers: ExposureRateTierConfig[] = [];
        for (let i = 0; i < tierCount; i++) {
          tiers.push({
            name: `Tier${i + 1}`,
            lowerBound: sorted[i],
            upperBound: sorted[i + 1],
          });
        }
        return tiers;
      });
  });

describe('Property 3: KOL tier classification via exposure rate', () => {
  it('classifies KOL into the correct tier based on exposureRate = impressions / fanCount falling in [lowerBound, upperBound)', () => {
    fc.assert(
      fc.property(
        nonOverlappingTierConfigArb,
        fc.integer({ min: 0, max: 10000000 }), // impressions
        fc.integer({ min: 1, max: 10000000 }), // fanCount (positive)
        (tierConfig: ExposureRateTierConfig[], impressions: number, fanCount: number) => {
          const result = classifyKOLByExposureRate(impressions, fanCount, tierConfig);
          const exposureRate = impressions / fanCount;

          // Find the expected tier
          const expectedTier = tierConfig.find(
            (tier) => exposureRate >= tier.lowerBound && exposureRate < tier.upperBound
          );

          if (expectedTier) {
            expect(result).toBe(expectedTier.name);
          } else {
            expect(result).toBe('未分类');
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('returns "未分类" when fanCount <= 0', () => {
    fc.assert(
      fc.property(
        nonOverlappingTierConfigArb,
        fc.integer({ min: 0, max: 10000000 }), // impressions
        fc.integer({ min: -1000000, max: 0 }), // fanCount <= 0
        (tierConfig: ExposureRateTierConfig[], impressions: number, fanCount: number) => {
          const result = classifyKOLByExposureRate(impressions, fanCount, tierConfig);
          expect(result).toBe('未分类');
        }
      ),
      { numRuns: 200 }
    );
  });
});
