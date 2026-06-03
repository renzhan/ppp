/**
 * Property-based tests for project-sort.ts
 *
 * Validates: Requirements 1.2
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { sortProjectsByEndDate, ProjectSortItem } from './project-sort';

/**
 * Arbitrary: generates a valid ISO date string (YYYY-MM-DD format).
 */
const isoDateArb = fc
  .integer({
    min: new Date('2020-01-01').getTime(),
    max: new Date('2030-12-31').getTime(),
  })
  .map((ts) => new Date(ts).toISOString().slice(0, 10));

/**
 * Arbitrary: generates an endDate that is either a valid ISO date string or null.
 */
const endDateArb = fc.oneof(isoDateArb, fc.constant(null));

/**
 * Arbitrary: generates a ProjectSortItem with random id and endDate.
 */
const projectArb: fc.Arbitrary<ProjectSortItem> = fc.record({
  id: fc.uuid(),
  endDate: endDateArb,
});

// Feature: project-note-base-management, Property 1: 项目列表按 endDate 降序排列
describe('Property 1: 项目列表按 endDate 降序排列', () => {
  /**
   * Validates: Requirements 1.2
   *
   * For any project list, after applying the default sort, adjacent projects
   * projects[i] and projects[i+1] must satisfy:
   * projects[i].endDate >= projects[i+1].endDate (null values treated as minimum).
   */
  it('排序后相邻项目满足 endDate 降序（null 视为最小值）', () => {
    fc.assert(
      fc.property(
        fc.array(projectArb, { minLength: 0, maxLength: 50 }),
        (projects) => {
          const sorted = sortProjectsByEndDate(projects);

          // Verify length is preserved
          expect(sorted.length).toBe(projects.length);

          // Verify ordering property for all adjacent pairs
          for (let i = 0; i < sorted.length - 1; i++) {
            const current = sorted[i].endDate;
            const next = sorted[i + 1].endDate;

            if (current === null && next === null) {
              // Both null: order is fine
              continue;
            }
            if (next === null) {
              // next is null (minimum), current can be anything — always valid
              continue;
            }
            if (current === null) {
              // current is null but next is not — violates descending order
              expect.fail(
                `projects[${i}].endDate is null but projects[${i + 1}].endDate is "${next}" — null should be sorted last`
              );
            }
            // Both non-null: current >= next (descending)
            expect(current! >= next).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
