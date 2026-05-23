/**
 * Cascade selector filtering logic.
 *
 * Extracted from the CascadeSelector component so it can be tested in isolation
 * without React rendering or API calls.
 *
 * The tree structure is: category → brand → businessLine (3 levels).
 */

export interface TreeNode {
  id: string;
  label: string;
  children?: TreeNode[];
}

/**
 * Returns the list of brand IDs available under a given category.
 *
 * @param tree - The full tree data (array of category nodes)
 * @param category - The selected category ID
 * @returns Array of brand IDs under that category, or empty if category not found
 */
export function getBrandsForCategory(tree: TreeNode[], category: string): string[] {
  const categoryNode = tree.find((node) => node.id === category);
  if (!categoryNode || !categoryNode.children) {
    return [];
  }
  return categoryNode.children.map((brand) => brand.id);
}

/**
 * Returns the list of business line IDs available under a given category + brand combination.
 *
 * @param tree - The full tree data (array of category nodes)
 * @param category - The selected category ID
 * @param brand - The selected brand ID
 * @returns Array of business line IDs under that brand, or empty if not found
 */
export function getBusinessLinesForBrand(tree: TreeNode[], category: string, brand: string): string[] {
  const categoryNode = tree.find((node) => node.id === category);
  if (!categoryNode || !categoryNode.children) {
    return [];
  }
  const brandNode = categoryNode.children.find((node) => node.id === brand);
  if (!brandNode || !brandNode.children) {
    return [];
  }
  return brandNode.children.map((bl) => bl.id);
}
