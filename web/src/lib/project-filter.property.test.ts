/**
 * Property-Based Test: 项目日期筛选正确性
 *
 * **Validates: Requirements 1.4, 1.5, 1.6**
 *
 * Property 1: For any 项目集合和日期范围筛选条件，筛选结果中的每个项目的
 * executionStartDate 都应满足 >= executionStartDateFrom 且 <= executionStartDateTo 条件，
 * 且 endDate 都应满足 >= endDateFrom 且 <= endDateTo 条件（当对应筛选条件非空时）。
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  filterProjects,
  type ProjectRecord,
  type ProjectFilters,
} from './project-filter';

// Feature: review-page-redesign-v2, Property 1: 项目日期筛选正确性

// --- Generators ---

/** Generates a valid ISO date string (YYYY-MM-DD) within a reasonable range */
const dateStringArb = fc
  .integer({ min: 0, max: 3652 }) // days offset from 2020-01-01 (covers ~10 years)
  .map((offset) => {
    const d = new Date(2020, 0, 1 + offset);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

/** Generates a Date within a reasonable range from a day offset */
const dateArb = fc
  .integer({ min: 0, max: 3652 })
  .map((offset) => new Date(2020, 0, 1 + offset));

/** Generates a project record with realistic field values */
const projectRecordArb: fc.Arbitrary<ProjectRecord> = fc.record({
  projectName: fc.string({ minLength: 1, maxLength: 60 }),
  brand: fc.string({ minLength: 1, maxLength: 40 }),
  category: fc.string({ minLength: 1, maxLength: 40 }),
  businessLine: fc.option(fc.string({ minLength: 1, maxLength: 40 }), { nil: null }),
  executionStartDate: fc.option(dateArb, { nil: null }),
  endDate: fc.option(dateArb, { nil: null }),
});

/** Generates a filter object where each field is optionally set */
const filtersArb: fc.Arbitrary<ProjectFilters> = fc.record(
  {
    category: fc.string({ minLength: 1, maxLength: 40 }),
    brand: fc.string({ minLength: 1, maxLength: 40 }),
    businessLine: fc.string({ minLength: 1, maxLength: 40 }),
    executionStartDateFrom: dateStringArb,
    executionStartDateTo: dateStringArb,
    endDateFrom: dateStringArb,
    endDateTo: dateStringArb,
    search: fc.string({ minLength: 1, maxLength: 20 }),
  },
  { requiredKeys: [] }
);

// --- Helpers ---

function matchesCategory(project: ProjectRecord, filters: ProjectFilters): boolean {
  if (!filters.category) return true;
  return project.category === filters.category;
}

function matchesBrand(project: ProjectRecord, filters: ProjectFilters): boolean {
  if (!filters.brand) return true;
  return project.brand === filters.brand;
}

function matchesBusinessLine(project: ProjectRecord, filters: ProjectFilters): boolean {
  if (!filters.businessLine) return true;
  return project.businessLine === filters.businessLine;
}

function matchesExecutionStartDateFrom(project: ProjectRecord, filters: ProjectFilters): boolean {
  if (!filters.executionStartDateFrom) return true;
  if (!project.executionStartDate) return false;
  return project.executionStartDate >= new Date(filters.executionStartDateFrom);
}

function matchesExecutionStartDateTo(project: ProjectRecord, filters: ProjectFilters): boolean {
  if (!filters.executionStartDateTo) return true;
  if (!project.executionStartDate) return false;
  return project.executionStartDate <= new Date(filters.executionStartDateTo);
}

function matchesEndDateFrom(project: ProjectRecord, filters: ProjectFilters): boolean {
  if (!filters.endDateFrom) return true;
  if (!project.endDate) return false;
  return project.endDate >= new Date(filters.endDateFrom);
}

function matchesEndDateTo(project: ProjectRecord, filters: ProjectFilters): boolean {
  if (!filters.endDateTo) return true;
  if (!project.endDate) return false;
  return project.endDate <= new Date(filters.endDateTo);
}

function matchesSearch(project: ProjectRecord, filters: ProjectFilters): boolean {
  if (!filters.search) return true;
  const term = filters.search.toLowerCase();
  return (
    project.projectName.toLowerCase().includes(term) ||
    project.brand.toLowerCase().includes(term)
  );
}

function matchesAllFilters(project: ProjectRecord, filters: ProjectFilters): boolean {
  return (
    matchesCategory(project, filters) &&
    matchesBrand(project, filters) &&
    matchesBusinessLine(project, filters) &&
    matchesExecutionStartDateFrom(project, filters) &&
    matchesExecutionStartDateTo(project, filters) &&
    matchesEndDateFrom(project, filters) &&
    matchesEndDateTo(project, filters) &&
    matchesSearch(project, filters)
  );
}

// --- Tests ---

describe('Property 1: 项目日期筛选正确性', () => {
  // Feature: review-page-redesign-v2, Property 1: 项目日期筛选正确性

  it('every returned project satisfies executionStartDate range filters', () => {
    /**
     * **Validates: Requirements 1.4, 1.5, 1.6**
     *
     * For any array of projects and any date range filters,
     * every project in the filtered result must have:
     * - executionStartDate >= executionStartDateFrom (when filter is set)
     * - executionStartDate <= executionStartDateTo (when filter is set)
     */
    fc.assert(
      fc.property(
        fc.array(projectRecordArb, { minLength: 0, maxLength: 50 }),
        filtersArb,
        (projects, filters) => {
          const result = filterProjects(projects, filters);

          for (const project of result) {
            expect(matchesExecutionStartDateFrom(project, filters)).toBe(true);
            expect(matchesExecutionStartDateTo(project, filters)).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('every returned project satisfies endDate range filters', () => {
    /**
     * **Validates: Requirements 1.4, 1.5, 1.6**
     *
     * For any array of projects and any date range filters,
     * every project in the filtered result must have:
     * - endDate >= endDateFrom (when filter is set)
     * - endDate <= endDateTo (when filter is set)
     */
    fc.assert(
      fc.property(
        fc.array(projectRecordArb, { minLength: 0, maxLength: 50 }),
        filtersArb,
        (projects, filters) => {
          const result = filterProjects(projects, filters);

          for (const project of result) {
            expect(matchesEndDateFrom(project, filters)).toBe(true);
            expect(matchesEndDateTo(project, filters)).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('every returned project satisfies ALL applied filters (soundness)', () => {
    /**
     * **Validates: Requirements 1.4, 1.5, 1.6**
     *
     * For any array of projects and any combination of filter criteria,
     * every project in the filtered result must match all active filters.
     */
    fc.assert(
      fc.property(
        fc.array(projectRecordArb, { minLength: 0, maxLength: 50 }),
        filtersArb,
        (projects, filters) => {
          const result = filterProjects(projects, filters);

          for (const project of result) {
            expect(matchesCategory(project, filters)).toBe(true);
            expect(matchesBrand(project, filters)).toBe(true);
            expect(matchesBusinessLine(project, filters)).toBe(true);
            expect(matchesExecutionStartDateFrom(project, filters)).toBe(true);
            expect(matchesExecutionStartDateTo(project, filters)).toBe(true);
            expect(matchesEndDateFrom(project, filters)).toBe(true);
            expect(matchesEndDateTo(project, filters)).toBe(true);
            expect(matchesSearch(project, filters)).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('no project that matches all filters is excluded from results (completeness)', () => {
    /**
     * **Validates: Requirements 1.4, 1.5, 1.6**
     *
     * For any array of projects and any combination of filter criteria,
     * every project that satisfies all filters must appear in the result.
     * This ensures completeness: no valid project is accidentally dropped.
     */
    fc.assert(
      fc.property(
        fc.array(projectRecordArb, { minLength: 0, maxLength: 50 }),
        filtersArb,
        (projects, filters) => {
          const result = filterProjects(projects, filters);

          const expectedCount = projects.filter((p) => matchesAllFilters(p, filters)).length;
          expect(result.length).toBe(expectedCount);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('with no filters applied, all projects are returned', () => {
    /**
     * **Validates: Requirements 1.4, 1.5, 1.6**
     *
     * When no filter criteria are set (empty filters object),
     * the result should contain all input projects.
     */
    fc.assert(
      fc.property(
        fc.array(projectRecordArb, { minLength: 0, maxLength: 50 }),
        (projects) => {
          const result = filterProjects(projects, {});
          expect(result.length).toBe(projects.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});
