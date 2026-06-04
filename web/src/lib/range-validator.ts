export interface RangeValidationResult {
  valid: boolean;
  sanitizedValue: string;
  error: string | null;
}

/**
 * 验证区间输入值，确保最多两位小数。
 * - 空值视为有效（非必填）
 * - 非数值字符串返回无效
 * - 超过两位小数时截断到两位
 */
export function validateRangeInput(value: string): RangeValidationResult {
  const trimmed = value.trim();

  if (trimmed === '') {
    return { valid: true, sanitizedValue: '', error: null };
  }

  if (isNaN(Number(trimmed)) || trimmed === '') {
    return { valid: false, sanitizedValue: trimmed, error: '请输入有效数值' };
  }

  const dotIndex = trimmed.indexOf('.');
  if (dotIndex === -1) {
    // No decimal point, valid as-is
    return { valid: true, sanitizedValue: trimmed, error: null };
  }

  const decimalPart = trimmed.slice(dotIndex + 1);
  if (decimalPart.length <= 2) {
    return { valid: true, sanitizedValue: trimmed, error: null };
  }

  // Truncate to 2 decimal places (not rounding)
  const truncated = trimmed.slice(0, dotIndex + 3);
  return { valid: true, sanitizedValue: truncated, error: null };
}

/**
 * 验证一对区间值（min ≤ max）。
 * - 任一值为空时视为有效（非必填）
 * - 两者都非空时验证 min ≤ max
 */
export function validateRange(
  min: string,
  max: string
): { valid: boolean; error: string | null } {
  const trimmedMin = min.trim();
  const trimmedMax = max.trim();

  if (trimmedMin === '' || trimmedMax === '') {
    return { valid: true, error: null };
  }

  const minNum = Number(trimmedMin);
  const maxNum = Number(trimmedMax);

  if (isNaN(minNum) || isNaN(maxNum)) {
    return { valid: false, error: '请输入有效数值' };
  }

  if (minNum > maxNum) {
    return { valid: false, error: '最小值不能大于最大值' };
  }

  return { valid: true, error: null };
}
