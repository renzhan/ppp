import { describe, it, expect } from 'vitest';
import { validateProjectInput } from '../../src/shared/validation';
import type { Project } from '../../src/shared/types';

describe('validateProjectInput', () => {
  const validInput: Partial<Project> = {
    category: '美妆',
    brand: '兰蔻',
    projectName: '2024春季推广',
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-03-31'),
  };

  describe('valid inputs', () => {
    it('returns valid when all required fields are present', () => {
      const result = validateProjectInput(validInput);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('returns valid when optional fields are missing', () => {
      const result = validateProjectInput({
        category: '食品',
        brand: '三只松鼠',
        projectName: '年货节',
        startDate: new Date('2024-01-15'),
        endDate: new Date('2024-02-15'),
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('returns valid when optional fields are present', () => {
      const result = validateProjectInput({
        ...validInput,
        id: 'project-123',
        spuName: '小棕瓶精华',
        engagementConfig: { includeShare: true, includeFollow: false },
        cooperationPolicy: { defaultDiscount: 0.8, specialRules: [] },
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  describe('missing required string fields', () => {
    it('rejects when category is missing', () => {
      const { category, ...rest } = validInput;
      const result = validateProjectInput(rest);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('品类(category)为必填字段');
    });

    it('rejects when category is empty string', () => {
      const result = validateProjectInput({ ...validInput, category: '' });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('品类(category)为必填字段');
    });

    it('rejects when category is whitespace only', () => {
      const result = validateProjectInput({ ...validInput, category: '   ' });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('品类(category)为必填字段');
    });

    it('rejects when brand is missing', () => {
      const { brand, ...rest } = validInput;
      const result = validateProjectInput(rest);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('合作品牌(brand)为必填字段');
    });

    it('rejects when brand is empty string', () => {
      const result = validateProjectInput({ ...validInput, brand: '' });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('合作品牌(brand)为必填字段');
    });

    it('rejects when projectName is missing', () => {
      const { projectName, ...rest } = validInput;
      const result = validateProjectInput(rest);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('项目名称(projectName)为必填字段');
    });

    it('rejects when projectName is empty string', () => {
      const result = validateProjectInput({ ...validInput, projectName: '' });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('项目名称(projectName)为必填字段');
    });
  });

  describe('missing required date fields', () => {
    it('rejects when startDate is missing', () => {
      const { startDate, ...rest } = validInput;
      const result = validateProjectInput(rest);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('项目开始日期(startDate)为必填字段');
    });

    it('rejects when endDate is missing', () => {
      const { endDate, ...rest } = validInput;
      const result = validateProjectInput(rest);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('项目结束日期(endDate)为必填字段');
    });

    it('rejects when startDate is an invalid Date', () => {
      const result = validateProjectInput({
        ...validInput,
        startDate: new Date('invalid'),
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('项目开始日期(startDate)为必填字段');
    });

    it('rejects when endDate is an invalid Date', () => {
      const result = validateProjectInput({
        ...validInput,
        endDate: new Date('not-a-date'),
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('项目结束日期(endDate)为必填字段');
    });
  });

  describe('multiple missing fields', () => {
    it('reports all missing fields at once', () => {
      const result = validateProjectInput({});

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(5);
      expect(result.errors).toContain('品类(category)为必填字段');
      expect(result.errors).toContain('合作品牌(brand)为必填字段');
      expect(result.errors).toContain('项目名称(projectName)为必填字段');
      expect(result.errors).toContain('项目开始日期(startDate)为必填字段');
      expect(result.errors).toContain('项目结束日期(endDate)为必填字段');
    });

    it('reports only the fields that are actually missing', () => {
      const result = validateProjectInput({
        category: '美妆',
        startDate: new Date('2024-01-01'),
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(3);
      expect(result.errors).toContain('合作品牌(brand)为必填字段');
      expect(result.errors).toContain('项目名称(projectName)为必填字段');
      expect(result.errors).toContain('项目结束日期(endDate)为必填字段');
    });
  });

  describe('optional fields do not cause rejection', () => {
    it('does not reject when id is missing', () => {
      const result = validateProjectInput(validInput);
      expect(result.isValid).toBe(true);
    });

    it('does not reject when spuName is missing', () => {
      const result = validateProjectInput(validInput);
      expect(result.isValid).toBe(true);
    });

    it('does not reject when engagementConfig is missing', () => {
      const result = validateProjectInput(validInput);
      expect(result.isValid).toBe(true);
    });

    it('does not reject when cooperationPolicy is missing', () => {
      const result = validateProjectInput(validInput);
      expect(result.isValid).toBe(true);
    });
  });

  describe('null values for required fields', () => {
    it('rejects when category is null', () => {
      const result = validateProjectInput({
        ...validInput,
        category: null as unknown as string,
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('品类(category)为必填字段');
    });

    it('rejects when startDate is null', () => {
      const result = validateProjectInput({
        ...validInput,
        startDate: null as unknown as Date,
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('项目开始日期(startDate)为必填字段');
    });
  });
});
