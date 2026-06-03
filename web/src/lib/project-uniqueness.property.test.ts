/**
 * Property-Based Test: Project uniqueness constraint rejects duplicate combinations
 *
 * **Validates: Requirements 11.2, 11.3**
 *
 * Property 9: For any existing project, attempting to create a new project with
 * the same (category, brand, businessLine, projectName) combination should result
 * in a failure response containing a duplicate error message.
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { checkProjectUniqueness, type ProjectKey } from './project-uniqueness';

// --- Generators ---

const projectKeyArb: fc.Arbitrary<ProjectKey> = fc.record({
  category: fc.string({ minLength: 1, maxLength: 10 }),
  brand: fc.string({ minLength: 1, maxLength: 10 }),
  businessLine: fc.string({ minLength: 1, maxLength: 10 }),
  projectName: fc.string({ minLength: 1, maxLength: 20 }),
});

// --- Tests ---

// Feature: project-note-base-management, Property 9: 项目唯一性约束拒绝重复组合
describe('Property 9: 项目唯一性约束拒绝重复组合', () => {
  it('creating a project with the same key as an existing one returns a duplicate error', () => {
    /**
     * **Validates: Requirements 11.2**
     *
     * For any existing project list containing at least one project,
     * attempting to create a new project with the exact same
     * (category, brand, businessLine, projectName) as one of the existing
     * projects should return a non-null error message indicating duplication.
     */
    fc.assert(
      fc.property(
        fc.array(projectKeyArb, { minLength: 1, maxLength: 20 }),
        fc.nat(),
        (existingProjects, pickIndex) => {
          // Pick one existing project to duplicate
          const idx = pickIndex % existingProjects.length;
          const duplicateProject: ProjectKey = { ...existingProjects[idx] };

          const result = checkProjectUniqueness(existingProjects, duplicateProject);

          expect(result).not.toBeNull();
          expect(result).toBe('该品类+品牌+业务线+项目名称组合已存在');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('creating a project with any one field different returns null (no error)', () => {
    /**
     * **Validates: Requirements 11.3**
     *
     * For any existing project, if we create a new project where at least one
     * of the four key fields (category, brand, businessLine, projectName) differs
     * from ALL existing projects, checkProjectUniqueness should return null.
     */
    fc.assert(
      fc.property(
        projectKeyArb,
        fc.constantFrom('category', 'brand', 'businessLine', 'projectName') as fc.Arbitrary<keyof ProjectKey>,
        fc.string({ minLength: 1, maxLength: 10 }),
        (originalProject, fieldToChange, newValue) => {
          // Ensure the new value is actually different
          fc.pre(newValue !== originalProject[fieldToChange]);

          const existing: ProjectKey[] = [originalProject];
          const modified: ProjectKey = { ...originalProject, [fieldToChange]: newValue };

          const result = checkProjectUniqueness(existing, modified);

          expect(result).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });
});
