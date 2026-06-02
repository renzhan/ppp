/**
 * Property-based tests for module-toggle logic.
 *
 * Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.6, 7.7
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  toggleModule,
  createDefaultModuleState,
  selectAllModules,
  deselectAllModules,
  REPORT_MODULE_KEYS,
  ModuleState,
} from './module-toggle';

describe('Module toggle property tests', () => {
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

  describe('Toggle independence', () => {
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

  // Feature: review-page-redesign-v2, Property 6: 模块列表排除已移除模块
  describe('Property 6: 模块列表排除已移除模块', () => {
    /**
     * Validates: Requirements 7.1, 7.2
     *
     * For any 通过 REPORT_MODULE_KEYS 创建的默认模块状态，该状态不应包含
     * audienceAnalysis 和 competitorAnalysis 键。
     */
    it('default module state does not contain removed modules (audienceAnalysis, competitorAnalysis)', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const defaultState = createDefaultModuleState();
          const keys = Object.keys(defaultState);

          // Should NOT contain removed modules
          expect(keys).not.toContain('audienceAnalysis');
          expect(keys).not.toContain('competitorAnalysis');

          // Should only contain keys from REPORT_MODULE_KEYS
          for (const key of keys) {
            expect((REPORT_MODULE_KEYS as readonly string[]).includes(key)).toBe(true);
          }

          // All REPORT_MODULE_KEYS should be present
          for (const key of REPORT_MODULE_KEYS) {
            expect(keys).toContain(key);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('REPORT_MODULE_KEYS does not include audienceAnalysis or competitorAnalysis', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const keys = REPORT_MODULE_KEYS as readonly string[];
          expect(keys).not.toContain('audienceAnalysis');
          expect(keys).not.toContain('competitorAnalysis');
        }),
        { numRuns: 100 }
      );
    });
  });

  // Feature: review-page-redesign-v2, Property 7: 全选操作完备性
  describe('Property 7: 全选操作完备性', () => {
    /**
     * Validates: Requirements 7.3, 7.6
     *
     * For any 模块状态（部分选中、全部未选中等任意状态），执行 selectAllModules 后，
     * 所有 REPORT_MODULE_KEYS 中的模块值都应为 true。
     */
    it('selectAllModules sets all REPORT_MODULE_KEYS to true regardless of initial state', () => {
      fc.assert(
        fc.property(moduleStateArb, (initialState) => {
          const result = selectAllModules(initialState);

          for (const key of REPORT_MODULE_KEYS) {
            expect(result[key]).toBe(true);
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  // Feature: review-page-redesign-v2, Property 8: 取消全选操作完备性
  describe('Property 8: 取消全选操作完备性', () => {
    /**
     * Validates: Requirements 7.4, 7.7
     *
     * For any 模块状态（部分选中、全部选中等任意状态），执行 deselectAllModules 后，
     * 所有 REPORT_MODULE_KEYS 中的模块值都应为 false。
     */
    it('deselectAllModules sets all REPORT_MODULE_KEYS to false regardless of initial state', () => {
      fc.assert(
        fc.property(moduleStateArb, (initialState) => {
          const result = deselectAllModules(initialState);

          for (const key of REPORT_MODULE_KEYS) {
            expect(result[key]).toBe(false);
          }
        }),
        { numRuns: 100 }
      );
    });
  });
});
