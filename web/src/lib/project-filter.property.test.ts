/**
 * Property-Based Test: Project list filter correctness
 *
 * **Validates: Requirements 4.5**
 *
 * Property 5: For any combination of filter criteria, all returned projects
 * match every applied filter. No project that fails any filter criterion
 * should appear in the results.
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  filterProjects,
  type ProjectRecord,
  type ProjectFilters,
} from './project-filter';

// --- Generators ---

/** Generates a valid ISO date string (YYYY-MM-DD) within a reasonable range */
const dateStringArb = fc
  .date({
    min: new Date('2020-01-01'),
    max: new Date('2030-12-31'),
  })
  .map((d) => d.toISOString().slice(0, 10));

/** Generates a project record with realistic field values */
const projectRecordArb: fc.Arbitrary<ProjectRecord> = fc.record({
  projectName: fc.string({ minLength: 1, maxLength: 60 }),
  brand: fc.string({ minLength: 1, maxLength: 40 }),
  category: fc.string({ minLength: 1, maxLength: 40 }),
  businessLine: fc.option(fc.string({ minLength: 1, maxLength: 40 }), { nil: null }),
  startDate: fc.option(
    fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
    { nil: null }
  ),
});

/** Generates a filter object where each field is optionally set */
const filtersArb: fc.Arbitrary<ProjectFilters> = fc.record(
  {
    category: fc.string({ minLength: 1, maxLength: 40 }),
    brand: fc.string({ minLength: 1, maxLength: 40 }),
    businessLine: fc.string({ minLength: 1, maxLength: 40 }),
    dateFrom: dateStringArb,
    dateTo: dateStringArb,
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

function matchesDateFrom(project: ProjectRecord, filters: ProjectFilters): boolean {
  if (!filters.dateFrom) return true;
  if (!project.startDate) return false;
  return project.startDate >= new Date(filters.dateFrom);
}

function matchesDateTo(project: ProjectRecord, filters: ProjectFilters): boolean {
  if (!filters.dateTo) return true;
  if (!project.startDate) return false;
  return project.startDate <= new Date(filters.dateTo);
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
    matchesDateFrom(project, filters) &&
    matchesDateTo(project, filters) &&
    matchesSearch(project, filters)
  );
}

// --- Tests ---

describe('Property 5: Project list filter correctness', () => {
  it('every returned project satisfies ALL applied filters', () => {
    /**
     * **Validates: Requirements 4.5**
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
            expect(matchesDateFrom(project, filters)).toBe(true);
            expect(matchesDateTo(project, filters)).toBe(true);
            expect(matchesSearch(project, filters)).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('no project that matches all filters is excluded from results', () => {
    /**
     * **Validates: Requirements 4.5**
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
     * **Validates: Requirements 4.5**
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
