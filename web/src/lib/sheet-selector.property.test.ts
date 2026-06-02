/**
 * Property-based tests for sheet-selector.ts
 *
 * Validates: Requirements 2.2, 2.3, 2.4
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { selectTargetSheet } from './sheet-selector';

const TARGET_SHEET_NAME = '已发布达人';

/**
 * Arbitrary: generates a non-empty sheet name that is NOT the target sheet name.
 */
const nonTargetSheetNameArb = fc
  .string({ minLength: 1, maxLength: 50 })
  .filter((name) => name !== TARGET_SHEET_NAME);

// Feature: review-page-redesign-v2, Property 2: 多sheet文件目标sheet选择
describe('Property 2: 多sheet文件目标sheet选择', () => {
  /**
   * Validates: Requirements 2.2
   *
   * For any list of multiple sheet names that contains exactly one "已发布达人",
   * selectTargetSheet should return { success: true, sheetName: "已发布达人" }.
   */
  it('多sheet文件中包含"已发布达人"时应返回该sheet', () => {
    fc.assert(
      fc.property(
        fc.array(nonTargetSheetNameArb, { minLength: 1, maxLength: 20 }),
        fc.nat({ max: 20 }),
        (otherSheets, insertIndex) => {
          // Insert the target sheet at a random position
          const idx = insertIndex % (otherSheets.length + 1);
          const sheetNames = [
            ...otherSheets.slice(0, idx),
            TARGET_SHEET_NAME,
            ...otherSheets.slice(idx),
          ];

          const result = selectTargetSheet(sheetNames);

          expect(result.success).toBe(true);
          expect(result.sheetName).toBe(TARGET_SHEET_NAME);
          expect(result.error).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: review-page-redesign-v2, Property 3: 单sheet文件直接解析
describe('Property 3: 单sheet文件直接解析', () => {
  /**
   * Validates: Requirements 2.3
   *
   * For any single sheet name (regardless of what it is),
   * selectTargetSheet should return { success: true, sheetName: <that name> }.
   */
  it('单sheet文件应直接返回该sheet名称', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        (sheetName) => {
          const result = selectTargetSheet([sheetName]);

          expect(result.success).toBe(true);
          expect(result.sheetName).toBe(sheetName);
          expect(result.error).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: review-page-redesign-v2, Property 4: 多sheet缺失目标sheet错误
describe('Property 4: 多sheet缺失目标sheet错误', () => {
  /**
   * Validates: Requirements 2.4
   *
   * For any list of multiple sheet names where none is "已发布达人",
   * selectTargetSheet should return { success: false, error: "未找到名为【已发布达人】的工作表，请检查文件格式" }.
   */
  it('多sheet文件中不包含"已发布达人"时应返回错误', () => {
    fc.assert(
      fc.property(
        fc.array(nonTargetSheetNameArb, { minLength: 2, maxLength: 20 }),
        (sheetNames) => {
          const result = selectTargetSheet(sheetNames);

          expect(result.success).toBe(false);
          expect(result.sheetName).toBeNull();
          expect(result.error).toBe(
            '未找到名为【已发布达人】的工作表，请检查文件格式'
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});
