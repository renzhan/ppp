import type { Project, ValidationResult } from './types';

/**
 * 验证项目输入数据
 * 必填字段：品类(category)、合作品牌(brand)、项目名称(projectName)、项目周期(startDate, endDate)
 * 其他字段均为可选
 */
export function validateProjectInput(input: Partial<Project>): ValidationResult {
  const errors: string[] = [];

  // Check required string fields
  if (!isNonEmptyString(input.category)) {
    errors.push('品类(category)为必填字段');
  }

  if (!isNonEmptyString(input.brand)) {
    errors.push('合作品牌(brand)为必填字段');
  }

  if (!isNonEmptyString(input.projectName)) {
    errors.push('项目名称(projectName)为必填字段');
  }

  // Check required date fields
  if (!isValidDate(input.startDate)) {
    errors.push('项目开始日期(startDate)为必填字段');
  }

  if (!isValidDate(input.endDate)) {
    errors.push('项目结束日期(endDate)为必填字段');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Check if a value is a non-empty string (not undefined, null, or empty string)
 */
function isNonEmptyString(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Check if a value is a valid Date (not undefined, null, or invalid Date)
 */
function isValidDate(value: unknown): boolean {
  if (value == null) return false;
  if (!(value instanceof Date)) return false;
  return !isNaN(value.getTime());
}
