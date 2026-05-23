/**
 * Property-Based Test: Role-based sidebar visibility
 *
 * **Validates: Requirements 3.2, 3.3**
 *
 * Property 1: For any user role, admin sees all nav items (including adminOnly),
 * while non-admin roles cannot see adminOnly items (账户管理, 系统设置).
 * Non-adminOnly items are always visible regardless of role.
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { getVisibleNavItems, type NavItem } from './sidebar-visibility';

// --- Generators ---

/** Generates a nav item that may or may not be admin-only */
const navItemArb: fc.Arbitrary<NavItem> = fc.record({
  href: fc.string({ minLength: 1, maxLength: 30 }).map((s) => '/' + s),
  label: fc.string({ minLength: 1, maxLength: 20 }),
  adminOnly: fc.option(fc.constant(true), { nil: undefined }),
});

/** Known non-admin roles from the system */
const knownNonAdminRoles = ['组长', 'AD', 'AM', '投手', '执行'];

/** Generates any non-admin role (known roles + arbitrary strings that are not "admin") */
const nonAdminRoleArb: fc.Arbitrary<string> = fc.oneof(
  fc.constantFrom(...knownNonAdminRoles),
  fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s !== 'admin')
);

// --- Tests ---

describe('Property 1: Role-based sidebar visibility', () => {
  it('admin role can see ALL nav items including adminOnly ones', () => {
    /**
     * **Validates: Requirements 3.2, 3.3**
     *
     * For any set of nav items, when the role is "admin",
     * getVisibleNavItems returns all items without filtering any out.
     */
    fc.assert(
      fc.property(
        fc.array(navItemArb, { minLength: 1, maxLength: 20 }),
        (items) => {
          const visible = getVisibleNavItems(items, 'admin');
          expect(visible.length).toBe(items.length);
          // Every item should be present
          for (const item of items) {
            expect(visible).toContain(item);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('non-admin roles cannot see adminOnly items', () => {
    /**
     * **Validates: Requirements 3.2, 3.3**
     *
     * For any set of nav items and any non-admin role,
     * getVisibleNavItems never includes items marked adminOnly.
     */
    fc.assert(
      fc.property(
        fc.array(navItemArb, { minLength: 1, maxLength: 20 }),
        nonAdminRoleArb,
        (items, role) => {
          const visible = getVisibleNavItems(items, role);
          for (const item of visible) {
            expect(item.adminOnly).not.toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('non-adminOnly items are always visible regardless of role', () => {
    /**
     * **Validates: Requirements 3.2, 3.3**
     *
     * For any set of nav items and any role (admin or not),
     * items without adminOnly are always included in the result.
     */
    fc.assert(
      fc.property(
        fc.array(navItemArb, { minLength: 1, maxLength: 20 }),
        fc.oneof(fc.constant('admin'), nonAdminRoleArb),
        (items, role) => {
          const visible = getVisibleNavItems(items, role);
          const nonAdminItems = items.filter((item) => !item.adminOnly);
          for (const item of nonAdminItems) {
            expect(visible).toContain(item);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('with real nav items, non-admin roles cannot see 账户管理 and 系统设置', () => {
    /**
     * **Validates: Requirements 3.2, 3.3**
     *
     * Using the actual sidebar nav items configuration,
     * any non-admin role should not see 账户管理 or 系统设置.
     */
    const realNavItems: NavItem[] = [
      { href: '/', label: '项目管理' },
      { href: '/review', label: '复盘系统' },
      { href: '/planning', label: '策划系统' },
      { href: '/sentiment', label: '舆情系统' },
      { href: '/admin/users', label: '账户管理', adminOnly: true },
      { href: '/admin/settings', label: '系统设置', adminOnly: true },
    ];

    fc.assert(
      fc.property(nonAdminRoleArb, (role) => {
        const visible = getVisibleNavItems(realNavItems, role);
        const labels = visible.map((item) => item.label);
        expect(labels).not.toContain('账户管理');
        expect(labels).not.toContain('系统设置');
        // But should still see the 4 non-admin items
        expect(labels).toContain('项目管理');
        expect(labels).toContain('复盘系统');
        expect(labels).toContain('策划系统');
        expect(labels).toContain('舆情系统');
      }),
      { numRuns: 100 }
    );
  });
});
