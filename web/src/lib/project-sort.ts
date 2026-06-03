export interface ProjectSortItem {
  id: string;
  endDate: string | null; // ISO date string or null
}

/**
 * Sort projects by endDate descending. Null endDate treated as minimum (sorted last).
 */
export function sortProjectsByEndDate(projects: ProjectSortItem[]): ProjectSortItem[] {
  return [...projects].sort((a, b) => {
    if (a.endDate === null && b.endDate === null) return 0;
    if (a.endDate === null) return 1;  // null goes last
    if (b.endDate === null) return -1; // null goes last
    return b.endDate.localeCompare(a.endDate); // desc
  });
}
