/**
 * Sidebar navigation visibility logic.
 *
 * Extracted from the Sidebar component so it can be tested in isolation
 * without React rendering or API calls.
 */

export interface NavItem {
  href: string;
  label: string;
  adminOnly?: boolean;
}

/**
 * Filters navigation items based on the user's role.
 *
 * - Admin role sees all items (including those marked adminOnly).
 * - Any other role only sees items that are NOT marked adminOnly.
 */
export function getVisibleNavItems(items: NavItem[], role: string): NavItem[] {
  return items.filter((item) => !item.adminOnly || role === 'admin');
}
