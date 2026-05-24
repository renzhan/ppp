/**
 * Unit tests for project name validation.
 *
 * Tests the validateProjectName function and projectNameSchema
 * against specific examples and edge cases.
 */

import { describe, it, expect } from 'vitest';
import {
  validateProjectName,
  projectNameSchema,
  createProjectSchema,
  PROJECT_NAME_MAX_LENGTH,
} from './project.js';

describe('validateProjectName', () => {
  it('should accept a valid project name', () => {
    const result = validateProjectName('My Project');
    expect(result).toEqual({ valid: true, name: 'My Project' });
  });

  it('should accept a single character name', () => {
    const result = validateProjectName('A');
    expect(result).toEqual({ valid: true, name: 'A' });
  });

  it('should accept a name at exactly 200 characters', () => {
    const name = 'a'.repeat(200);
    const result = validateProjectName(name);
    expect(result).toEqual({ valid: true, name });
  });

  it('should reject an empty string', () => {
    const result = validateProjectName('');
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBe('Project name must not be empty');
    }
  });

  it('should reject a whitespace-only string', () => {
    const result = validateProjectName('   ');
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBe('Project name must not be empty');
    }
  });

  it('should reject a name exceeding 200 characters', () => {
    const name = 'a'.repeat(201);
    const result = validateProjectName(name);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBe(
        `Project name must not exceed ${PROJECT_NAME_MAX_LENGTH} characters`
      );
    }
  });

  it('should trim leading and trailing whitespace', () => {
    const result = validateProjectName('  My Project  ');
    expect(result).toEqual({ valid: true, name: 'My Project' });
  });

  it('should accept unicode characters', () => {
    const result = validateProjectName('项目名称 🚀');
    expect(result).toEqual({ valid: true, name: '项目名称 🚀' });
  });

  it('should return deterministic results for the same input', () => {
    const input = 'Test Project';
    const result1 = validateProjectName(input);
    const result2 = validateProjectName(input);
    expect(result1).toEqual(result2);
  });
});

describe('projectNameSchema', () => {
  it('should parse a valid name', () => {
    expect(projectNameSchema.parse('Valid Name')).toBe('Valid Name');
  });

  it('should throw on empty string', () => {
    expect(() => projectNameSchema.parse('')).toThrow();
  });

  it('should throw on string exceeding max length', () => {
    expect(() => projectNameSchema.parse('x'.repeat(201))).toThrow();
  });
});

describe('createProjectSchema', () => {
  it('should validate a complete project creation payload', () => {
    const input = {
      name: 'Test Project',
      brand: 'TestBrand',
      category: 'Marketing',
      platform: 'Douyin',
      startDate: '2024-01-01',
      endDate: '2024-03-31',
    };

    const result = createProjectSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Test Project');
      expect(result.data.brand).toBe('TestBrand');
      expect(result.data.startDate).toBeInstanceOf(Date);
      expect(result.data.endDate).toBeInstanceOf(Date);
    }
  });

  it('should reject a payload with empty project name', () => {
    const input = {
      name: '',
      brand: 'TestBrand',
      category: 'Marketing',
      platform: 'Douyin',
      startDate: '2024-01-01',
      endDate: '2024-03-31',
    };

    const result = createProjectSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should reject a payload with missing brand', () => {
    const input = {
      name: 'Test Project',
      category: 'Marketing',
      platform: 'Douyin',
      startDate: '2024-01-01',
      endDate: '2024-03-31',
    };

    const result = createProjectSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});
