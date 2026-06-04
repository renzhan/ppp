/**
 * Property-based tests for formatDateTime in project-meta.ts
 *
 * Validates: Requirements 8.2
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { formatDateTime } from './project-meta';

// Feature: review-page-redesign-v2, Property 9: 日期时间格式化精度
describe('Property 9: 日期时间格式化精度', () => {
  /**
   * Validates: Requirements 8.2
   *
   * For any valid ISO date-time string, formatDateTime output should match
   * YYYY-MM-DD HH:mm:ss format, and parsing it back to a Date object should
   * be consistent with the original time at second-level precision.
   */
  it('formatDateTime 输出匹配 YYYY-MM-DD HH:mm:ss 格式且秒级精度一致', () => {
    fc.assert(
      fc.property(
        fc.date({
          min: new Date('1970-01-01T00:00:00Z'),
          max: new Date('2099-12-31T23:59:59Z'),
        }).filter((d) => !Number.isNaN(d.getTime())),
        (date) => {
          // Truncate to second precision for the input
          const truncatedDate = new Date(
            Math.floor(date.getTime() / 1000) * 1000
          );
          const isoStr = truncatedDate.toISOString();

          const result = formatDateTime(isoStr);

          // Should match YYYY-MM-DD HH:mm:ss format
          const formatRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
          expect(result).toMatch(formatRegex);

          // Parse the formatted result back and verify second-level precision
          // The formatted output uses local time, so we reconstruct a local Date
          const [datePart, timePart] = result.split(' ');
          const [year, month, day] = datePart.split('-').map(Number);
          const [hours, minutes, seconds] = timePart.split(':').map(Number);

          const reconstructed = new Date(
            year,
            month - 1,
            day,
            hours,
            minutes,
            seconds
          );

          // The difference should be 0 at second-level precision
          const diffMs = Math.abs(
            reconstructed.getTime() - truncatedDate.getTime()
          );
          expect(diffMs).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('无效日期字符串应返回 "-"', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant('invalid-date'),
          fc.constant(''),
          fc.constant('not-a-date'),
          fc.constant('2025-13-45'),
          fc.constant('abc123')
        ),
        (invalidStr) => {
          const result = formatDateTime(invalidStr);
          expect(result).toBe('-');
        }
      ),
      { numRuns: 100 }
    );
  });
});
