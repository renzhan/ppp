/**
 * Pure project filtering utility.
 *
 * Replicates the filter logic from /api/projects route in a testable,
 * database-independent form. Used for property-based testing of filter correctness.
 */

export interface ProjectRecord {
  projectName: string;
  brand: string;
  category: string;
  businessLine: string | null;
  startDate: Date | null;
}

export interface ProjectFilters {
  category?: string;
  brand?: string;
  businessLine?: string;
  dateFrom?: string; // ISO date string
  dateTo?: string; // ISO date string
  search?: string; // case-insensitive contains on projectName or brand
}

/**
 * Applies filter criteria to an array of projects.
 * Mirrors the WHERE clause logic in the projects API route.
 *
 * A project is included only if it matches ALL applied (non-empty) filters.
 */
export function filterProjects(
  projects: ProjectRecord[],
  filters: ProjectFilters
): ProjectRecord[] {
  return projects.filter((project) => {
    // Category: exact match
    if (filters.category && project.category !== filters.category) {
      return false;
    }

    // Brand: exact match
    if (filters.brand && project.brand !== filters.brand) {
      return false;
    }

    // Business line: exact match
    if (filters.businessLine && project.businessLine !== filters.businessLine) {
      return false;
    }

    // Date range: startDate >= dateFrom
    if (filters.dateFrom && project.startDate) {
      const from = new Date(filters.dateFrom);
      if (project.startDate < from) {
        return false;
      }
    }
    // If project has no startDate but dateFrom is set, exclude it
    if (filters.dateFrom && !project.startDate) {
      return false;
    }

    // Date range: startDate <= dateTo
    if (filters.dateTo && project.startDate) {
      const to = new Date(filters.dateTo);
      if (project.startDate > to) {
        return false;
      }
    }
    // If project has no startDate but dateTo is set, exclude it
    if (filters.dateTo && !project.startDate) {
      return false;
    }

    // Search: case-insensitive contains on projectName or brand
    if (filters.search) {
      const term = filters.search.toLowerCase();
      const nameMatch = project.projectName.toLowerCase().includes(term);
      const brandMatch = project.brand.toLowerCase().includes(term);
      if (!nameMatch && !brandMatch) {
        return false;
      }
    }

    return true;
  });
}
