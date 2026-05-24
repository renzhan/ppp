// ============================================================
// Project Filtering and Pagination Utilities
// 项目筛选与分页工具函数
// ============================================================

import type { ProjectType } from './types';

// ---- Interfaces ----

/** Filter criteria for project list */
export interface ProjectFilters {
  brand?: string;
  category?: string;
  projectType?: ProjectType;
  status?: string;
}

/** Minimal shape for a filterable project */
export interface FilterableProject {
  brand: string;
  category: string;
  projectType: ProjectType;
  status: string;
  [key: string]: unknown;
}

/** Pagination result wrapper */
export interface PaginationResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

// ---- Functions ----

/**
 * Filter projects by the given criteria.
 * All active (defined and non-empty) filters must match (AND logic).
 */
export function filterProjects<T extends FilterableProject>(
  projects: T[],
  filters: ProjectFilters,
): T[] {
  return projects.filter((project) => {
    if (filters.brand && project.brand !== filters.brand) {
      return false;
    }
    if (filters.category && project.category !== filters.category) {
      return false;
    }
    if (filters.projectType && project.projectType !== filters.projectType) {
      return false;
    }
    if (filters.status && project.status !== filters.status) {
      return false;
    }
    return true;
  });
}

/**
 * Paginate a list of items.
 *
 * - page < 1 → treated as page 1
 * - pageSize < 1 → treated as 20
 * - Empty items → returns empty items with totalPages=0
 */
export function paginateItems<T>(
  items: T[],
  page: number,
  pageSize: number = 20,
): PaginationResult<T> {
  // Normalize edge cases
  const effectivePageSize = pageSize < 1 ? 20 : pageSize;
  const effectivePage = page < 1 ? 1 : page;

  const totalItems = items.length;
  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / effectivePageSize);

  const startIndex = (effectivePage - 1) * effectivePageSize;
  const endIndex = Math.min(effectivePage * effectivePageSize, totalItems);

  const paginatedItems = startIndex >= totalItems ? [] : items.slice(startIndex, endIndex);

  return {
    items: paginatedItems,
    page: effectivePage,
    pageSize: effectivePageSize,
    totalItems,
    totalPages,
  };
}
