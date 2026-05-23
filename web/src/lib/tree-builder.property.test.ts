/**
 * Property-Based Test: Tree structure generation correctness
 *
 * **Validates: Requirements 5.3, 5.4, 5.6**
 *
 * Property 3: For any set of (category, brand, businessLine) tuples,
 * the generated tree structure contains exactly the unique combinations
 * (no duplicates, no missing).
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { buildTreeStructure, flattenTreeToTuples } from './tree-builder';

describe('Property 3: Tree structure generation from project base table', () => {
  it('should produce exactly the unique tuples from any set of project rows (roundtrip)', () => {
    /**
     * **Validates: Requirements 5.3, 5.4, 5.6**
     *
     * For any arbitrary array of {category, brand, businessLine} objects,
     * flattenTreeToTuples(buildTreeStructure(rows)) produces the same set
     * as the deduplicated input tuples.
     */
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            category: fc.string({ minLength: 1, maxLength: 50 }),
            brand: fc.string({ minLength: 1, maxLength: 50 }),
            businessLine: fc.string({ minLength: 1, maxLength: 50 }),
          }),
          { minLength: 1, maxLength: 100 }
        ),
        (rows) => {
          const tree = buildTreeStructure(rows);
          const uniqueTuples = new Set(
            rows.map((r) => `${r.category}|${r.brand}|${r.businessLine}`)
          );
          const treeLeaves = flattenTreeToTuples(tree);

          // Size must match: no duplicates, no missing
          expect(treeLeaves.size).toBe(uniqueTuples.size);

          // Every input tuple must be present in the tree output
          for (const tuple of uniqueTuples) {
            expect(treeLeaves.has(tuple)).toBe(true);
          }

          // Every tree tuple must be present in the input (no extra)
          for (const tuple of treeLeaves) {
            expect(uniqueTuples.has(tuple)).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
