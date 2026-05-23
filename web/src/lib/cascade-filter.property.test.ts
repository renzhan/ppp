/**
 * Property-Based Test: Cascade selector parent-child filtering
 *
 * **Validates: Requirements 7.1**
 *
 * Property 2: For any tree structure data and any selected category,
 * the brand options shown should be exactly those brands that exist under
 * that category in the tree. Similarly, for any selected brand, the business
 * line options should be exactly those that exist under that brand.
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { getBrandsForCategory, getBusinessLinesForBrand, type TreeNode } from './cascade-filter';

// --- Generators ---

/** Generates a leaf node (business line level - no children) */
const leafNodeArb: fc.Arbitrary<TreeNode> = fc.record({
  id: fc.string({ minLength: 1, maxLength: 30 }),
  label: fc.string({ minLength: 1, maxLength: 30 }),
});

/** Generates a brand node with business line children */
const brandNodeArb: fc.Arbitrary<TreeNode> = fc.record({
  id: fc.string({ minLength: 1, maxLength: 30 }),
  label: fc.string({ minLength: 1, maxLength: 30 }),
  children: fc.array(leafNodeArb, { minLength: 0, maxLength: 10 }),
});

/** Generates a category node with brand children */
const categoryNodeArb: fc.Arbitrary<TreeNode> = fc.record({
  id: fc.string({ minLength: 1, maxLength: 30 }),
  label: fc.string({ minLength: 1, maxLength: 30 }),
  children: fc.array(brandNodeArb, { minLength: 0, maxLength: 10 }),
});

/** Generates a full tree (array of category nodes) */
const treeArb: fc.Arbitrary<TreeNode[]> = fc.array(categoryNodeArb, {
  minLength: 1,
  maxLength: 10,
});

/**
 * Generates a tree with unique IDs at each level for deterministic lookups.
 * - Category IDs are unique across the tree
 * - Brand IDs are unique within each category
 * - Business line IDs are unique within each brand
 */
const uniqueTreeArb: fc.Arbitrary<TreeNode[]> = treeArb.map((tree) => {
  const seenCategories = new Set<string>();
  const result: TreeNode[] = [];

  for (const categoryNode of tree) {
    if (seenCategories.has(categoryNode.id)) continue;
    seenCategories.add(categoryNode.id);

    // Deduplicate brand IDs within this category
    const seenBrands = new Set<string>();
    const uniqueBrands: TreeNode[] = [];
    for (const brandNode of categoryNode.children ?? []) {
      if (seenBrands.has(brandNode.id)) continue;
      seenBrands.add(brandNode.id);

      // Deduplicate business line IDs within this brand
      const seenBLs = new Set<string>();
      const uniqueBLs: TreeNode[] = [];
      for (const blNode of brandNode.children ?? []) {
        if (seenBLs.has(blNode.id)) continue;
        seenBLs.add(blNode.id);
        uniqueBLs.push(blNode);
      }

      uniqueBrands.push({ ...brandNode, children: uniqueBLs });
    }

    result.push({ ...categoryNode, children: uniqueBrands });
  }

  return result;
});

// --- Tests ---

describe('Property 2: Cascade selector parent-child filtering', () => {
  it('selecting a category shows only brands under that category', () => {
    /**
     * **Validates: Requirements 7.1**
     *
     * For any tree and any category that exists in the tree,
     * getBrandsForCategory returns exactly the brand IDs that are
     * children of that category node.
     */
    fc.assert(
      fc.property(uniqueTreeArb, (tree) => {
        for (const categoryNode of tree) {
          const brands = getBrandsForCategory(tree, categoryNode.id);
          const expectedBrands = (categoryNode.children ?? []).map((b) => b.id);

          // Should return exactly the brands under this category
          expect(brands).toEqual(expectedBrands);

          // Every returned brand must be a child of the selected category
          for (const brandId of brands) {
            const found = (categoryNode.children ?? []).some((b) => b.id === brandId);
            expect(found).toBe(true);
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  it('selecting a brand shows only business lines under that brand', () => {
    /**
     * **Validates: Requirements 7.1**
     *
     * For any tree, any category, and any brand under that category,
     * getBusinessLinesForBrand returns exactly the business line IDs
     * that are children of that brand node.
     */
    fc.assert(
      fc.property(uniqueTreeArb, (tree) => {
        for (const categoryNode of tree) {
          for (const brandNode of categoryNode.children ?? []) {
            const businessLines = getBusinessLinesForBrand(tree, categoryNode.id, brandNode.id);
            const expectedBLs = (brandNode.children ?? []).map((bl) => bl.id);

            // Should return exactly the business lines under this brand
            expect(businessLines).toEqual(expectedBLs);

            // Every returned business line must be a child of the selected brand
            for (const blId of businessLines) {
              const found = (brandNode.children ?? []).some((bl) => bl.id === blId);
              expect(found).toBe(true);
            }
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  it('selecting a non-existent category returns empty brands', () => {
    /**
     * **Validates: Requirements 7.1**
     *
     * For any tree and any category ID that does NOT exist in the tree,
     * getBrandsForCategory returns an empty array.
     */
    fc.assert(
      fc.property(
        uniqueTreeArb,
        fc.string({ minLength: 1, maxLength: 30 }),
        (tree, randomId) => {
          const existingIds = new Set(tree.map((n) => n.id));
          if (!existingIds.has(randomId)) {
            const brands = getBrandsForCategory(tree, randomId);
            expect(brands).toEqual([]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('selecting a non-existent brand returns empty business lines', () => {
    /**
     * **Validates: Requirements 7.1**
     *
     * For any tree, any valid category, and any brand ID that does NOT
     * exist under that category, getBusinessLinesForBrand returns an empty array.
     */
    fc.assert(
      fc.property(
        uniqueTreeArb,
        fc.string({ minLength: 1, maxLength: 30 }),
        (tree, randomBrandId) => {
          for (const categoryNode of tree) {
            const existingBrandIds = new Set(
              (categoryNode.children ?? []).map((b) => b.id)
            );
            if (!existingBrandIds.has(randomBrandId)) {
              const bls = getBusinessLinesForBrand(tree, categoryNode.id, randomBrandId);
              expect(bls).toEqual([]);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
