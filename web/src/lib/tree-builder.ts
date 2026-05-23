/**
 * Tree structure builder utilities for converting flat project rows
 * into nested category → brand → businessLine tree structures.
 *
 * Used by:
 * - /api/tree-structure route (builds tree for cascade selector)
 * - Property tests (verifies tree correctness)
 */

export interface TreeNode {
  id: string;
  label: string;
  children?: TreeNode[];
}

export interface ProjectRow {
  category: string;
  brand: string;
  businessLine: string;
}

/**
 * Converts flat row data into a nested tree structure.
 * Deduplicates rows by (category, brand, businessLine) tuple.
 *
 * @param rows - Array of flat project rows with category, brand, businessLine
 * @returns Nested tree: category → brand → businessLine
 */
export function buildTreeStructure(rows: ProjectRow[]): TreeNode[] {
  const categoryMap = new Map<string, Map<string, Set<string>>>();

  for (const row of rows) {
    if (!categoryMap.has(row.category)) {
      categoryMap.set(row.category, new Map());
    }
    const brandMap = categoryMap.get(row.category)!;

    if (!brandMap.has(row.brand)) {
      brandMap.set(row.brand, new Set());
    }
    brandMap.get(row.brand)!.add(row.businessLine);
  }

  const tree: TreeNode[] = [];

  for (const [category, brandMap] of categoryMap) {
    const categoryNode: TreeNode = {
      id: category,
      label: category,
      children: [],
    };

    for (const [brand, businessLines] of brandMap) {
      const brandNode: TreeNode = {
        id: brand,
        label: brand,
        children: [],
      };

      for (const businessLine of businessLines) {
        brandNode.children!.push({
          id: businessLine,
          label: businessLine,
        });
      }

      categoryNode.children!.push(brandNode);
    }

    tree.push(categoryNode);
  }

  return tree;
}

/**
 * Flattens a tree structure back into a Set of "category|brand|businessLine" tuple strings.
 * Useful for verification and comparison.
 *
 * @param tree - Nested tree structure (category → brand → businessLine)
 * @returns Set of tuple strings in format "category|brand|businessLine"
 */
export function flattenTreeToTuples(tree: TreeNode[]): Set<string> {
  const tuples = new Set<string>();

  for (const categoryNode of tree) {
    if (categoryNode.children) {
      for (const brandNode of categoryNode.children) {
        if (brandNode.children) {
          for (const businessLineNode of brandNode.children) {
            tuples.add(`${categoryNode.label}|${brandNode.label}|${businessLineNode.label}`);
          }
        }
      }
    }
  }

  return tuples;
}
