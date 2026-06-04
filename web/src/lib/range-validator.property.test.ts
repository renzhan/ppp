/**
 * Property-based tests for range-validator.ts
 *
 * Validates: Requirements 5.2, 5.3
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { validateRangeInput } from './range-validator';

// Feature: review-page-redesign-v2, Property 5: 区间输入小数位验证
describe('Property 5: 区间输入小数位验证', () => {
  /**
   * Validates: Requirements 5.2, 5.3
   *
   * For any numeric string input, validateRangeInput should satisfy:
   * - If decimal places ≤ 2, return valid: true and sanitizedValue equals the original value
   * - If decimal places > 2, return a sanitizedValue truncated to 2 decimal places
   */

  it('小数位数 ≤ 2 的数值输入应返回 valid: true 且 sanitizedValue 等于原值', () => {
    // Generate numeric strings with 0, 1, or 2 decimal places
    const numericWithAtMost2Decimals = fc.oneof(
      // Integers (no decimal point)
      fc.integer({ min: -99999, max: 99999 }).map((n) => n.toString()),
      // Numbers with 1 decimal place
      fc
        .record({
          intPart: fc.integer({ min: -9999, max: 9999 }),
          decDigit: fc.integer({ min: 0, max: 9 }),
        })
        .map(({ intPart, decDigit }) => {
          const sign = intPart < 0 ? '-' : '';
          return `${sign}${Math.abs(intPart)}.${decDigit}`;
        }),
      // Numbers with 2 decimal places
      fc
        .record({
          intPart: fc.integer({ min: -9999, max: 9999 }),
          dec1: fc.integer({ min: 0, max: 9 }),
          dec2: fc.integer({ min: 0, max: 9 }),
        })
        .map(({ intPart, dec1, dec2 }) => {
          const sign = intPart < 0 ? '-' : '';
          return `${sign}${Math.abs(intPart)}.${dec1}${dec2}`;
        })
    );

    fc.assert(
      fc.property(numericWithAtMost2Decimals, (input) => {
        // Skip inputs that are not valid numbers (e.g., edge cases like "-0.0" which is still valid)
        if (isNaN(Number(input))) return;

        const result = validateRangeInput(input);

        expect(result.valid).toBe(true);
        expect(result.sanitizedValue).toBe(input);
        expect(result.error).toBeNull();
      }),
      { numRuns: 100 }
    );
  });

  it('小数位数 > 2 的数值输入应返回截断到两位小数的 sanitizedValue', () => {
    // Generate numeric strings with more than 2 decimal places
    const numericWithMoreThan2Decimals = fc
      .record({
        intPart: fc.integer({ min: 0, max: 9999 }),
        negative: fc.boolean(),
        dec1: fc.integer({ min: 0, max: 9 }),
        dec2: fc.integer({ min: 0, max: 9 }),
        extraDecimals: fc
          .array(fc.integer({ min: 0, max: 9 }), { minLength: 1, maxLength: 5 })
          .map((digits) => digits.join('')),
      })
      .map(({ intPart, negative, dec1, dec2, extraDecimals }) => {
        const sign = negative ? '-' : '';
        return `${sign}${intPart}.${dec1}${dec2}${extraDecimals}`;
      });

    fc.assert(
      fc.property(numericWithMoreThan2Decimals, (input) => {
        // Ensure the generated string is a valid number
        if (isNaN(Number(input))) return;

        const result = validateRangeInput(input);

        // Should still be valid (truncation is not an error)
        expect(result.valid).toBe(true);
        expect(result.error).toBeNull();

        // The sanitizedValue should be truncated to 2 decimal places
        const dotIndex = input.indexOf('.');
        const expectedTruncated = input.slice(0, dotIndex + 3);
        expect(result.sanitizedValue).toBe(expectedTruncated);
      }),
      { numRuns: 100 }
    );
  });
});
