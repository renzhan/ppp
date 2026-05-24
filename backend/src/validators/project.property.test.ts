/**
 * Property-based tests for project name validation.
 *
 * **Validates: Requirements 3.6**
 *
 * Property 5: Project Name Validation
 * For any string provided as a project name, the PPP_Backend SHALL reject it
 * if it is empty or exceeds 200 characters, and accept it otherwise.
 * The validation result SHALL be deterministic for the same input.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { validateProjectName, PROJECT_NAME_MAX_LENGTH } from './project.js';

describe('Property 5: Project Name Validation', () => {
  /**
   * Valid names (1-200 chars after trimming, not whitespace-only) are accepted.
   */
  it('should accept any non-whitespace-only string of length 1-200', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: PROJECT_NAME_MAX_LENGTH }).filter(
          (s) => s.trim().length > 0 && s.trim().length <= PROJECT_NAME_MAX_LENGTH
        ),
        (name) => {
          const result = validateProjectName(name);
          expect(result.valid).toBe(true);
          if (result.valid) {
            expect(result.name).toBe(name.trim());
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * Empty strings are always rejected.
   */
  it('should reject empty strings', () => {
    fc.assert(
      fc.property(fc.constant(''), (name) => {
        const result = validateProjectName(name);
        expect(result.valid).toBe(false);
      }),
      { numRuns: 1 }
    );
  });

  /**
   * Strings exceeding 200 characters (after trimming) are rejected.
   */
  it('should reject strings longer than 200 characters', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: PROJECT_NAME_MAX_LENGTH + 1, maxLength: 500 }).filter(
          (s) => s.trim().length > PROJECT_NAME_MAX_LENGTH
        ),
        (name) => {
          const result = validateProjectName(name);
          expect(result.valid).toBe(false);
          if (!result.valid) {
            expect(result.error).toContain('200');
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * Whitespace-only strings are rejected (they become empty after trimming).
   */
  it('should reject whitespace-only strings', () => {
    fc.assert(
      fc.property(
        fc.stringOf(fc.constantFrom(' ', '\t', '\n', '\r'), { minLength: 1, maxLength: 50 }),
        (name) => {
          const result = validateProjectName(name);
          expect(result.valid).toBe(false);
          if (!result.valid) {
            expect(result.error).toBe('Project name must not be empty');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Deterministic: same input always produces the same output.
   */
  it('should produce deterministic results for the same input', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 300 }), (name) => {
        const result1 = validateProjectName(name);
        const result2 = validateProjectName(name);
        expect(result1).toEqual(result2);
      }),
      { numRuns: 200 }
    );
  });

  /**
   * Unicode strings within valid length are accepted.
   */
  it('should accept unicode strings within valid length', () => {
    fc.assert(
      fc.property(
        fc.fullUnicode().chain((char) =>
          fc.array(fc.fullUnicode(), { minLength: 1, maxLength: 50 }).map(
            (chars) => chars.join('')
          )
        ).filter((s) => s.trim().length > 0 && s.trim().length <= PROJECT_NAME_MAX_LENGTH),
        (name) => {
          const result = validateProjectName(name);
          expect(result.valid).toBe(true);
          if (result.valid) {
            expect(result.name).toBe(name.trim());
          }
        }
      ),
      { numRuns: 200 }
    );
  });
});
