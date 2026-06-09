/**
 * Property-based tests for phone-validator.ts
 *
 * Feature: schema-restructure, Property 4: Phone number format validation
 * Validates: Requirements 3.3, 4.4
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { isValidPhone } from '../phone-validator';

// Feature: schema-restructure, Property 4: Phone number format validation
describe('Property 4: Phone number format validation', () => {
  /**
   * Validates: Requirements 3.3, 4.4
   *
   * For any string input, isValidPhone SHALL return true if and only if the string
   * matches the pattern of an 11-digit Chinese mobile number (starting with 1,
   * second digit 3-9, followed by 9 more digits). All other strings SHALL be rejected.
   */

  it('valid 11-digit Chinese mobile numbers always pass validation', () => {
    // Generator for valid Chinese phone numbers:
    // - Exactly 11 digits
    // - Starts with "1"
    // - Second digit is 3-9
    // - Remaining 9 digits are 0-9
    const validPhoneArb = fc
      .record({
        secondDigit: fc.integer({ min: 3, max: 9 }),
        remaining: fc.array(fc.integer({ min: 0, max: 9 }), {
          minLength: 9,
          maxLength: 9,
        }),
      })
      .map(({ secondDigit, remaining }) => `1${secondDigit}${remaining.join('')}`);

    fc.assert(
      fc.property(validPhoneArb, (phone) => {
        expect(isValidPhone(phone)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('arbitrary strings that do not match the 11-digit pattern are rejected', () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        const isValid = /^1[3-9]\d{9}$/.test(input);
        expect(isValidPhone(input)).toBe(isValid);
      }),
      { numRuns: 200 }
    );
  });

  it('strings with wrong length are always rejected', () => {
    // Generate digit-only strings that are NOT 11 characters long
    const wrongLengthDigits = fc
      .array(fc.integer({ min: 0, max: 9 }), { minLength: 1, maxLength: 20 })
      .filter((arr) => arr.length !== 11)
      .map((arr) => arr.join(''));

    fc.assert(
      fc.property(wrongLengthDigits, (input) => {
        expect(isValidPhone(input)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('11-digit strings starting with digits other than 1 are rejected', () => {
    // Generate 11-digit strings where first digit is NOT 1
    const wrongFirstDigit = fc
      .record({
        firstDigit: fc.integer({ min: 0, max: 9 }).filter((d) => d !== 1),
        rest: fc.array(fc.integer({ min: 0, max: 9 }), {
          minLength: 10,
          maxLength: 10,
        }),
      })
      .map(({ firstDigit, rest }) => `${firstDigit}${rest.join('')}`);

    fc.assert(
      fc.property(wrongFirstDigit, (input) => {
        expect(isValidPhone(input)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('11-digit strings starting with 1 but second digit 0-2 are rejected', () => {
    // Generate 11-digit strings where first digit is 1 but second digit is 0, 1, or 2
    const invalidSecondDigit = fc
      .record({
        secondDigit: fc.integer({ min: 0, max: 2 }),
        remaining: fc.array(fc.integer({ min: 0, max: 9 }), {
          minLength: 9,
          maxLength: 9,
        }),
      })
      .map(({ secondDigit, remaining }) => `1${secondDigit}${remaining.join('')}`);

    fc.assert(
      fc.property(invalidSecondDigit, (input) => {
        expect(isValidPhone(input)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('strings containing non-digit characters are rejected even if 11 chars long', () => {
    // Generate strings of exactly 11 characters that contain at least one non-digit
    const nonDigitString = fc
      .string({ minLength: 11, maxLength: 11 })
      .filter((s) => /[^0-9]/.test(s));

    fc.assert(
      fc.property(nonDigitString, (input) => {
        expect(isValidPhone(input)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });
});
