/**
 * Pure simulation of project uniqueness constraint.
 * Replicates the uniqueness check logic in a testable, database-independent form.
 */

export interface ProjectKey {
  category: string;
  brand: string;
  businessLine: string;
  projectName: string;
}

/**
 * Check if a project key already exists in the existing set.
 * Returns an error message if duplicate found, null otherwise.
 */
export function checkProjectUniqueness(
  existing: ProjectKey[],
  newProject: ProjectKey
): string | null {
  const isDuplicate = existing.some(
    (p) =>
      p.category === newProject.category &&
      p.brand === newProject.brand &&
      p.businessLine === newProject.businessLine &&
      p.projectName === newProject.projectName
  );

  if (isDuplicate) {
    return '该品类+品牌+业务线+项目名称组合已存在';
  }
  return null;
}
