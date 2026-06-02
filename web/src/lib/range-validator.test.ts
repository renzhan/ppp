import { describe, it, expect } from 'vitest';
import { validateRangeInput, validateRange } from './range-validator';

describe('validateRangeInput', () => {
  it('空值视为有效', () => {
    const result = validateRangeInput('');
    expect(result).toEqual({ valid: true, sanitizedValue: '', error: null });
  });

  it('空格字符串视为有效（trim后为空）', () => {
    const result = validateRangeInput('   ');
    expect(result).toEqual({ valid: true, sanitizedValue: '', error: null });
  });

  it('整数输入有效', () => {
    const result = validateRangeInput('42');
    expect(result).toEqual({ valid: true, sanitizedValue: '42', error: null });
  });

  it('一位小数有效', () => {
    const result = validateRangeInput('3.5');
    expect(result).toEqual({ valid: true, sanitizedValue: '3.5', error: null });
  });

  it('两位小数有效', () => {
    const result = validateRangeInput('10.59');
    expect(result).toEqual({ valid: true, sanitizedValue: '10.59', error: null });
  });

  it('超过两位小数截断到两位', () => {
    const result = validateRangeInput('3.14159');
    expect(result).toEqual({ valid: true, sanitizedValue: '3.14', error: null });
  });

  it('三位小数截断到两位', () => {
    const result = validateRangeInput('1.999');
    expect(result).toEqual({ valid: true, sanitizedValue: '1.99', error: null });
  });

  it('非数值字符串无效', () => {
    const result = validateRangeInput('abc');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('请输入有效数值');
  });

  it('负数有效', () => {
    const result = validateRangeInput('-2.5');
    expect(result).toEqual({ valid: true, sanitizedValue: '-2.5', error: null });
  });

  it('零有效', () => {
    const result = validateRangeInput('0');
    expect(result).toEqual({ valid: true, sanitizedValue: '0', error: null });
  });
});

describe('validateRange', () => {
  it('min为空时有效', () => {
    const result = validateRange('', '10');
    expect(result).toEqual({ valid: true, error: null });
  });

  it('max为空时有效', () => {
    const result = validateRange('5', '');
    expect(result).toEqual({ valid: true, error: null });
  });

  it('两者都为空时有效', () => {
    const result = validateRange('', '');
    expect(result).toEqual({ valid: true, error: null });
  });

  it('min ≤ max 时有效', () => {
    const result = validateRange('1.5', '3.2');
    expect(result).toEqual({ valid: true, error: null });
  });

  it('min = max 时有效', () => {
    const result = validateRange('5', '5');
    expect(result).toEqual({ valid: true, error: null });
  });

  it('min > max 时无效', () => {
    const result = validateRange('10', '5');
    expect(result).toEqual({ valid: false, error: '最小值不能大于最大值' });
  });

  it('非数值输入无效', () => {
    const result = validateRange('abc', '10');
    expect(result).toEqual({ valid: false, error: '请输入有效数值' });
  });
});
