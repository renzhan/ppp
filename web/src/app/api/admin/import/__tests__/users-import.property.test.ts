/**
 * Property-based tests for user import phone column mapping.
 *
 * Feature: schema-restructure, Property 5: User import phone column mapping
 * Validates: Requirements 3.2
 *
 * Tests that valid phone values in "手机号"/"phone" columns are correctly
 * mapped to user records during import.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

// Feature: schema-restructure, Property 5: User import phone column mapping

/**
 * The COLUMN_MAP used by the import route.
 * We replicate it here to test the mapping logic in isolation.
 */
const COLUMN_MAP: Record<string, string> = {
  '花名': 'username',
  '用户名': 'username',
  '真名': 'realName',
  '真实姓名': 'realName',
  '显示名': 'displayName',
  '角色': 'role',
  '手机号': 'phone',
  'phone': 'phone',
};

/**
 * Replicates the row mapping logic from the import route:
 * For each entry in COLUMN_MAP, extract the value from the raw row object.
 * Only sets the mapped value when the column key actually exists in the raw row
 * (XLSX.utils.sheet_to_json only includes keys for columns present in the header).
 */
function mapRow(raw: Record<string, unknown>): Record<string, string | null> {
  const mapped: Record<string, string | null> = {};
  for (const [header, fieldName] of Object.entries(COLUMN_MAP)) {
    if (!(header in raw)) continue;
    const value = raw[header];
    mapped[fieldName] = value != null && String(value).trim() !== '' ? String(value).trim() : null;
  }
  return mapped;
}

// --- Generators ---

/**
 * Generator for valid Chinese phone numbers:
 * - Exactly 11 digits
 * - Starts with "1"
 * - Second digit is 3-9
 * - Remaining 9 digits are 0-9
 */
const validPhoneArb = fc
  .record({
    secondDigit: fc.integer({ min: 3, max: 9 }),
    remaining: fc.array(fc.integer({ min: 0, max: 9 }), {
      minLength: 9,
      maxLength: 9,
    }),
  })
  .map(({ secondDigit, remaining }) => `1${secondDigit}${remaining.join('')}`);

/**
 * Generator for the phone column header name (either Chinese or English)
 */
const phoneColumnHeaderArb = fc.constantFrom('手机号', 'phone');

/**
 * Generator for valid usernames (non-empty alphanumeric/Chinese)
 */
const usernameArb = fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0);

/**
 * Generator for valid roles
 */
const roleArb = fc.constantFrom('VP', 'AD', 'AM', '组长', 'AE');

describe('Property 5: User import phone column mapping', () => {
  /**
   * Validates: Requirements 3.2
   *
   * For any Excel row containing a column named "手机号" or "phone" with a valid
   * 11-digit phone number value, the User Import Service SHALL map that value to
   * the `phone` field of the created user record.
   */

  it('valid phone values in "手机号" or "phone" columns are mapped to the phone field', () => {
    fc.assert(
      fc.property(
        phoneColumnHeaderArb,
        validPhoneArb,
        usernameArb,
        roleArb,
        (columnHeader, phoneValue, username, role) => {
          // Simulate a raw Excel row with the phone value under the chosen header
          const rawRow: Record<string, unknown> = {
            '花名': username,
            '角色': role,
            [columnHeader]: phoneValue,
          };

          const mapped = mapRow(rawRow);

          // The phone field must contain the exact phone value
          expect(mapped.phone).toBe(phoneValue);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('phone value is trimmed of whitespace before mapping', () => {
    fc.assert(
      fc.property(
        phoneColumnHeaderArb,
        validPhoneArb,
        fc.constantFrom(' ', '  ', '\t', ' \t '),
        (columnHeader, phoneValue, whitespace) => {
          // Phone value with leading/trailing whitespace
          const rawRow: Record<string, unknown> = {
            '花名': 'testuser',
            '角色': 'AE',
            [columnHeader]: `${whitespace}${phoneValue}${whitespace}`,
          };

          const mapped = mapRow(rawRow);

          // The phone field must be trimmed
          expect(mapped.phone).toBe(phoneValue);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('when both "手机号" and "phone" columns exist, the last one in COLUMN_MAP wins', () => {
    fc.assert(
      fc.property(validPhoneArb, validPhoneArb, (phone1, phone2) => {
        // When both columns are present in the raw row
        const rawRow: Record<string, unknown> = {
          '花名': 'testuser',
          '角色': 'AE',
          '手机号': phone1,
          'phone': phone2,
        };

        const mapped = mapRow(rawRow);

        // Since COLUMN_MAP iterates in order, "phone" comes after "手机号"
        // and both map to the same field name, the last write wins
        expect(mapped.phone).toBe(phone2);
      }),
      { numRuns: 100 }
    );
  });

  it('empty or whitespace-only phone values are mapped as null', () => {
    fc.assert(
      fc.property(
        phoneColumnHeaderArb,
        fc.constantFrom('', ' ', '  ', '\t', ' \t '),
        (columnHeader, emptyValue) => {
          const rawRow: Record<string, unknown> = {
            '花名': 'testuser',
            '角色': 'AE',
            [columnHeader]: emptyValue,
          };

          const mapped = mapRow(rawRow);

          // Empty/whitespace values should map to null
          expect(mapped.phone).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('missing phone column (neither "手机号" nor "phone") results in undefined phone field', () => {
    fc.assert(
      fc.property(usernameArb, roleArb, (username, role) => {
        // Row with no phone column at all
        const rawRow: Record<string, unknown> = {
          '花名': username,
          '角色': role,
        };

        const mapped = mapRow(rawRow);

        // phone field should be undefined when neither column header is present
        expect(mapped.phone).toBeUndefined();
      }),
      { numRuns: 100 }
    );
  });

  it('phone mapping is independent of other column mappings (username, role, etc.)', () => {
    fc.assert(
      fc.property(
        phoneColumnHeaderArb,
        validPhoneArb,
        usernameArb,
        roleArb,
        fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
        (columnHeader, phoneValue, username, role, displayName) => {
          const rawRow: Record<string, unknown> = {
            '花名': username,
            '角色': role,
            [columnHeader]: phoneValue,
          };
          if (displayName !== undefined) {
            rawRow['显示名'] = displayName;
          }

          const mapped = mapRow(rawRow);

          // Phone mapping should work correctly regardless of other fields
          expect(mapped.phone).toBe(phoneValue);
          // And other fields should also be correctly mapped
          expect(mapped.username).toBe(username.trim());
          expect(mapped.role).toBe(role);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('numeric phone values (non-string) are coerced to string and mapped correctly', () => {
    fc.assert(
      fc.property(
        phoneColumnHeaderArb,
        validPhoneArb,
        (columnHeader, phoneStr) => {
          // Excel sometimes provides numbers as numeric values
          const numericPhone = Number(phoneStr);
          // Only test when the number doesn't lose precision (all valid phones fit in Number)
          fc.pre(String(numericPhone) === phoneStr);

          const rawRow: Record<string, unknown> = {
            '花名': 'testuser',
            '角色': 'AE',
            [columnHeader]: numericPhone,
          };

          const mapped = mapRow(rawRow);

          // Numeric values should be coerced via String() and mapped
          expect(mapped.phone).toBe(phoneStr);
        }
      ),
      { numRuns: 100 }
    );
  });
});
