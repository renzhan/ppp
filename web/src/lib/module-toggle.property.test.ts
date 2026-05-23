/**
 * Property 6: Report module toggle independence
 *
 * Validates: Requirements 12.1, 12.2
 *
 * For any report module toggle action, only the toggled module's enabled/disabled
 * state should change. All other modules should retain their previous state.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { toggleModule, REPORT_MODULE_KEYS, ModuleState } from './module-toggle';

describe('Property 6: Report module toggle independence', () => {
  /**
   * Arbitrary: generates a valid module state (each module key mapped to a boolean).
   */
  const moduleStateArb = fc.record(
    Object.fromEntries(REPORT_MODULE_KEYS.map((key) => [key, fc.boolean()])) as Record<string, fc.Arbitrary<boolean>>
  ) as fc.Arbitrary<ModuleState>;

  /**
   * Arbitrary: picks one of the valid module keys.
   */
  const moduleKeyArb = fc.constantFrom(...REPORT_MODULE_KEYS);

  it('toggling a module only affects that module state, all others remain unchanged', () => {
    fc.assert(
      fc.property(moduleStateArb, moduleKeyArb, (initialState, toggledKey) => {
        const newState = toggleModule(initialState, toggledKey);

        // The toggled module should have its value flipped
        expect(newState[toggledKey]).toBe(!initialState[toggledKey]);

        // All other modules should remain unchanged
        for (const key of REPORT_MODULE_KEYS) {
          if (key !== toggledKey) {
            expect(newState[key]).toBe(initialState[key]);
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  it('toggling the same module twice returns to original state', () => {
    fc.assert(
      fc.property(moduleStateArb, moduleKeyArb, (initialState, toggledKey) => {
        const afterFirst = toggleModule(initialState, toggledKey);
        const afterSecond = toggleModule(afterFirst, toggledKey);

        // Double toggle should restore original state for all modules
        for (const key of REPORT_MODULE_KEYS) {
          expect(afterSecond[key]).toBe(initialState[key]);
        }
      }),
      { numRuns: 100 }
    );
  });
});
