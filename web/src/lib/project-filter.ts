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
  executionStartDate: Date | null;
  endDate: Date | null;
}

export interface ProjectFilters {
  category?: string;
  brand?: string;
  businessLine?: string;
  executionStartDateFrom?: string; // ISO date string
  executionStartDateTo?: string; // ISO date string
  endDateFrom?: string; // ISO date string
  endDateTo?: string; // ISO date string
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

    // Execution start date range: executionStartDate >= executionStartDateFrom
    if (filters.executionStartDateFrom && project.executionStartDate) {
      const from = new Date(filters.executionStartDateFrom);
      if (project.executionStartDate < from) {
        return false;
      }
    }
    // If project has no executionStartDate but executionStartDateFrom is set, exclude it
    if (filters.executionStartDateFrom && !project.executionStartDate) {
      return false;
    }

    // Execution start date range: executionStartDate <= executionStartDateTo
    if (filters.executionStartDateTo && project.executionStartDate) {
      const to = new Date(filters.executionStartDateTo);
      if (project.executionStartDate > to) {
        return false;
      }
    }
    // If project has no executionStartDate but executionStartDateTo is set, exclude it
    if (filters.executionStartDateTo && !project.executionStartDate) {
      return false;
    }

    // End date range: endDate >= endDateFrom
    if (filters.endDateFrom && project.endDate) {
      const from = new Date(filters.endDateFrom);
      if (project.endDate < from) {
        return false;
      }
    }
    // If project has no endDate but endDateFrom is set, exclude it
    if (filters.endDateFrom && !project.endDate) {
      return false;
    }

    // End date range: endDate <= endDateTo
    if (filters.endDateTo && project.endDate) {
      const to = new Date(filters.endDateTo);
      if (project.endDate > to) {
        return false;
      }
    }
    // If project has no endDate but endDateTo is set, exclude it
    if (filters.endDateTo && !project.endDate) {
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
