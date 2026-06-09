/**
 * Unit tests for project upsert on unique constraint conflict.
 *
 * Feature: schema-restructure, Task 5.3
 * Validates: Requirements 12.1, 12.2, 12.3
 *
 * Tests that the findProjectId helper correctly matches projects by the full
 * composite key (category, brand, businessLine, projectName), including
 * proper handling of NULL businessLine (PostgreSQL NULL semantics).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Replicated findProjectId logic from the import route.
 * This tests the matching behavior in isolation.
 */
interface ProjectRecord {
  id: string;
  category: string;
  brand: string;
  businessLine: string | null;
  projectName: string;
}

/**
 * Simulates the findProjectId logic using an in-memory project list.
 * Mirrors the Prisma findFirst behavior:
 * - When businessLine is null, only matches records where businessLine IS NULL
 * - When businessLine is a value, only matches records where businessLine equals that value
 */
function findProjectIdInMemory(
  projects: ProjectRecord[],
  category: string,
  brand: string,
  businessLine: string | null,
  projectName: string
): string {
  const existing = projects.find(
    (p) =>
      p.category === category &&
      p.brand === brand &&
      p.businessLine === businessLine &&
      p.projectName === projectName
  );
  return existing?.id ?? '00000000-0000-0000-0000-000000000000';
}

const NON_EXISTENT_ID = '00000000-0000-0000-0000-000000000000';

describe('findProjectId - composite key matching with NULL businessLine', () => {
  const projects: ProjectRecord[] = [
    {
      id: 'aaa-111',
      category: '美妆',
      brand: '雅诗兰黛',
      businessLine: '护肤',
      projectName: '618大促',
    },
    {
      id: 'bbb-222',
      category: '美妆',
      brand: '雅诗兰黛',
      businessLine: null,
      projectName: '618大促',
    },
    {
      id: 'ccc-333',
      category: '美妆',
      brand: '雅诗兰黛',
      businessLine: '彩妆',
      projectName: '618大促',
    },
    {
      id: 'ddd-444',
      category: '食品',
      brand: '三只松鼠',
      businessLine: null,
      projectName: '双11活动',
    },
  ];

  it('matches project with non-null businessLine correctly', () => {
    const id = findProjectIdInMemory(projects, '美妆', '雅诗兰黛', '护肤', '618大促');
    expect(id).toBe('aaa-111');
  });

  it('matches project with null businessLine correctly', () => {
    const id = findProjectIdInMemory(projects, '美妆', '雅诗兰黛', null, '618大促');
    expect(id).toBe('bbb-222');
  });

  it('does not confuse null businessLine with non-null businessLine', () => {
    // Looking for null businessLine should NOT match the "护肤" project
    const id = findProjectIdInMemory(projects, '美妆', '雅诗兰黛', null, '618大促');
    expect(id).not.toBe('aaa-111'); // not the "护肤" one
    expect(id).toBe('bbb-222'); // the null one
  });

  it('does not confuse non-null businessLine with null businessLine', () => {
    // Looking for "护肤" should NOT match the null businessLine project
    const id = findProjectIdInMemory(projects, '美妆', '雅诗兰黛', '护肤', '618大促');
    expect(id).not.toBe('bbb-222'); // not the null one
    expect(id).toBe('aaa-111'); // the "护肤" one
  });

  it('returns non-existent UUID when no match exists', () => {
    const id = findProjectIdInMemory(projects, '美妆', '雅诗兰黛', '香水', '618大促');
    expect(id).toBe(NON_EXISTENT_ID);
  });

  it('returns non-existent UUID when category differs', () => {
    const id = findProjectIdInMemory(projects, '服饰', '雅诗兰黛', '护肤', '618大促');
    expect(id).toBe(NON_EXISTENT_ID);
  });

  it('returns non-existent UUID when brand differs', () => {
    const id = findProjectIdInMemory(projects, '美妆', '兰蔻', '护肤', '618大促');
    expect(id).toBe(NON_EXISTENT_ID);
  });

  it('returns non-existent UUID when projectName differs', () => {
    const id = findProjectIdInMemory(projects, '美妆', '雅诗兰黛', '护肤', '双11活动');
    expect(id).toBe(NON_EXISTENT_ID);
  });

  it('allows same projectName with different businessLines (Req 12.2)', () => {
    // Three projects exist with same (category, brand, projectName) but different businessLines
    const id1 = findProjectIdInMemory(projects, '美妆', '雅诗兰黛', '护肤', '618大促');
    const id2 = findProjectIdInMemory(projects, '美妆', '雅诗兰黛', null, '618大促');
    const id3 = findProjectIdInMemory(projects, '美妆', '雅诗兰黛', '彩妆', '618大促');

    expect(id1).toBe('aaa-111');
    expect(id2).toBe('bbb-222');
    expect(id3).toBe('ccc-333');

    // All three are distinct
    expect(new Set([id1, id2, id3]).size).toBe(3);
  });
});

describe('Project upsert behavior (Req 12.3)', () => {
  /**
   * Simulates the upsert behavior:
   * - findProjectId finds existing → upsert updates
   * - findProjectId returns non-existent ID → upsert creates
   */

  it('existing project with matching composite key triggers update (non-null businessLine)', () => {
    const projects: ProjectRecord[] = [
      {
        id: 'existing-id',
        category: '美妆',
        brand: '雅诗兰黛',
        businessLine: '护肤',
        projectName: '618大促',
      },
    ];

    const id = findProjectIdInMemory(projects, '美妆', '雅诗兰黛', '护肤', '618大促');
    // Should find existing project → triggers update in upsert
    expect(id).toBe('existing-id');
    expect(id).not.toBe(NON_EXISTENT_ID);
  });

  it('existing project with matching composite key triggers update (null businessLine)', () => {
    const projects: ProjectRecord[] = [
      {
        id: 'existing-null-bl',
        category: '美妆',
        brand: '雅诗兰黛',
        businessLine: null,
        projectName: '618大促',
      },
    ];

    const id = findProjectIdInMemory(projects, '美妆', '雅诗兰黛', null, '618大促');
    // Should find existing project with null businessLine → triggers update
    expect(id).toBe('existing-null-bl');
    expect(id).not.toBe(NON_EXISTENT_ID);
  });

  it('no matching composite key triggers create (returns non-existent ID)', () => {
    const projects: ProjectRecord[] = [
      {
        id: 'existing-id',
        category: '美妆',
        brand: '雅诗兰黛',
        businessLine: '护肤',
        projectName: '618大促',
      },
    ];

    // Different businessLine → no match → create
    const id = findProjectIdInMemory(projects, '美妆', '雅诗兰黛', '彩妆', '618大促');
    expect(id).toBe(NON_EXISTENT_ID);
  });

  it('null businessLine does not match non-null businessLine project (Req 12.1)', () => {
    const projects: ProjectRecord[] = [
      {
        id: 'has-bl',
        category: '美妆',
        brand: '雅诗兰黛',
        businessLine: '护肤',
        projectName: '618大促',
      },
    ];

    // Searching with null businessLine should NOT match a project with "护肤"
    const id = findProjectIdInMemory(projects, '美妆', '雅诗兰黛', null, '618大促');
    expect(id).toBe(NON_EXISTENT_ID);
  });

  it('non-null businessLine does not match null businessLine project', () => {
    const projects: ProjectRecord[] = [
      {
        id: 'null-bl',
        category: '美妆',
        brand: '雅诗兰黛',
        businessLine: null,
        projectName: '618大促',
      },
    ];

    // Searching with "护肤" should NOT match a project with null businessLine
    const id = findProjectIdInMemory(projects, '美妆', '雅诗兰黛', '护肤', '618大促');
    expect(id).toBe(NON_EXISTENT_ID);
  });
});
