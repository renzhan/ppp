import { describe, it, expect } from 'vitest';
import {
  filterProjects,
  paginateItems,
  type FilterableProject,
  type ProjectFilters,
} from '../../src/engines/filtering';

// ---- Test Helpers ----

function makeProject(overrides: Partial<FilterableProject> = {}): FilterableProject {
  return {
    brand: '品牌A',
    category: '护肤',
    projectType: '新品上市',
    status: 'active',
    ...overrides,
  };
}

// ============================================================
// filterProjects
// ============================================================

describe('filterProjects', () => {
  const projects: FilterableProject[] = [
    makeProject({ brand: '品牌A', category: '护肤', projectType: '新品上市', status: 'active' }),
    makeProject({ brand: '品牌B', category: '彩妆', projectType: '日常种草', status: 'active' }),
    makeProject({ brand: '品牌A', category: '彩妆', projectType: '节点营销', status: 'completed' }),
    makeProject({ brand: '品牌C', category: '护肤', projectType: '竞品防御', status: 'draft' }),
    makeProject({ brand: '品牌B', category: '护肤', projectType: '新品上市', status: 'completed' }),
  ];

  describe('single filter', () => {
    it('filters by brand', () => {
      const result = filterProjects(projects, { brand: '品牌A' });
      expect(result).toHaveLength(2);
      expect(result.every((p) => p.brand === '品牌A')).toBe(true);
    });

    it('filters by category', () => {
      const result = filterProjects(projects, { category: '彩妆' });
      expect(result).toHaveLength(2);
      expect(result.every((p) => p.category === '彩妆')).toBe(true);
    });

    it('filters by projectType', () => {
      const result = filterProjects(projects, { projectType: '新品上市' });
      expect(result).toHaveLength(2);
      expect(result.every((p) => p.projectType === '新品上市')).toBe(true);
    });

    it('filters by status', () => {
      const result = filterProjects(projects, { status: 'completed' });
      expect(result).toHaveLength(2);
      expect(result.every((p) => p.status === 'completed')).toBe(true);
    });
  });

  describe('multiple filters (AND logic)', () => {
    it('filters by brand AND category', () => {
      const result = filterProjects(projects, { brand: '品牌A', category: '彩妆' });
      expect(result).toHaveLength(1);
      expect(result[0].brand).toBe('品牌A');
      expect(result[0].category).toBe('彩妆');
    });

    it('filters by brand AND status', () => {
      const result = filterProjects(projects, { brand: '品牌B', status: 'active' });
      expect(result).toHaveLength(1);
      expect(result[0].brand).toBe('品牌B');
      expect(result[0].status).toBe('active');
    });

    it('filters by all four criteria', () => {
      const result = filterProjects(projects, {
        brand: '品牌A',
        category: '护肤',
        projectType: '新品上市',
        status: 'active',
      });
      expect(result).toHaveLength(1);
    });

    it('returns empty when no project matches all filters', () => {
      const result = filterProjects(projects, {
        brand: '品牌C',
        category: '彩妆',
      });
      expect(result).toHaveLength(0);
    });
  });

  describe('empty/undefined filters', () => {
    it('returns all projects when filters object is empty', () => {
      const result = filterProjects(projects, {});
      expect(result).toHaveLength(projects.length);
    });

    it('ignores undefined filter fields', () => {
      const result = filterProjects(projects, { brand: undefined, category: undefined });
      expect(result).toHaveLength(projects.length);
    });

    it('ignores empty string filter fields', () => {
      const result = filterProjects(projects, { brand: '', status: '' });
      expect(result).toHaveLength(projects.length);
    });
  });

  describe('edge cases', () => {
    it('returns empty array when projects list is empty', () => {
      const result = filterProjects([], { brand: '品牌A' });
      expect(result).toHaveLength(0);
    });

    it('returns empty when filter value matches no project', () => {
      const result = filterProjects(projects, { brand: '不存在的品牌' });
      expect(result).toHaveLength(0);
    });
  });
});

// ============================================================
// paginateItems
// ============================================================

describe('paginateItems', () => {
  const items = Array.from({ length: 55 }, (_, i) => ({ id: i + 1 }));

  describe('basic pagination', () => {
    it('returns first page with default pageSize=20', () => {
      const result = paginateItems(items, 1);
      expect(result.items).toHaveLength(20);
      expect(result.items[0]).toEqual({ id: 1 });
      expect(result.items[19]).toEqual({ id: 20 });
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
      expect(result.totalItems).toBe(55);
      expect(result.totalPages).toBe(3);
    });

    it('returns second page correctly', () => {
      const result = paginateItems(items, 2);
      expect(result.items).toHaveLength(20);
      expect(result.items[0]).toEqual({ id: 21 });
      expect(result.items[19]).toEqual({ id: 40 });
    });

    it('returns last page with remaining items', () => {
      const result = paginateItems(items, 3);
      expect(result.items).toHaveLength(15);
      expect(result.items[0]).toEqual({ id: 41 });
      expect(result.items[14]).toEqual({ id: 55 });
    });

    it('returns empty items for page beyond total pages', () => {
      const result = paginateItems(items, 4);
      expect(result.items).toHaveLength(0);
      expect(result.totalPages).toBe(3);
    });
  });

  describe('custom pageSize', () => {
    it('paginates with pageSize=10', () => {
      const result = paginateItems(items, 1, 10);
      expect(result.items).toHaveLength(10);
      expect(result.pageSize).toBe(10);
      expect(result.totalPages).toBe(6); // ceil(55/10)
    });

    it('paginates with pageSize=50', () => {
      const result = paginateItems(items, 1, 50);
      expect(result.items).toHaveLength(50);
      expect(result.totalPages).toBe(2); // ceil(55/50)
    });

    it('paginates with pageSize larger than total items', () => {
      const result = paginateItems(items, 1, 100);
      expect(result.items).toHaveLength(55);
      expect(result.totalPages).toBe(1);
    });
  });

  describe('edge cases', () => {
    it('page < 1 is treated as page 1', () => {
      const result = paginateItems(items, 0);
      expect(result.page).toBe(1);
      expect(result.items).toHaveLength(20);
      expect(result.items[0]).toEqual({ id: 1 });
    });

    it('negative page is treated as page 1', () => {
      const result = paginateItems(items, -5);
      expect(result.page).toBe(1);
      expect(result.items[0]).toEqual({ id: 1 });
    });

    it('pageSize < 1 is treated as 20', () => {
      const result = paginateItems(items, 1, 0);
      expect(result.pageSize).toBe(20);
      expect(result.items).toHaveLength(20);
    });

    it('negative pageSize is treated as 20', () => {
      const result = paginateItems(items, 1, -10);
      expect(result.pageSize).toBe(20);
    });

    it('empty items returns empty result with totalPages=0', () => {
      const result = paginateItems([], 1);
      expect(result.items).toHaveLength(0);
      expect(result.totalItems).toBe(0);
      expect(result.totalPages).toBe(0);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
    });

    it('single item list', () => {
      const result = paginateItems([{ id: 1 }], 1);
      expect(result.items).toHaveLength(1);
      expect(result.totalPages).toBe(1);
    });

    it('items exactly divisible by pageSize', () => {
      const evenItems = Array.from({ length: 40 }, (_, i) => ({ id: i + 1 }));
      const result = paginateItems(evenItems, 2, 20);
      expect(result.items).toHaveLength(20);
      expect(result.totalPages).toBe(2);
      expect(result.items[0]).toEqual({ id: 21 });
    });
  });
});
