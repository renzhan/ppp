/**
 * Property-based tests for project import: column mapping, createdBy resolution, and upsert.
 *
 * Feature: schema-restructure
 * - Property 6: Project import new column mapping
 * - Property 7: CreatedBy realName resolution
 * - Property 12: Project upsert on import conflict
 *
 * Validates: Requirements 5.4, 6.1, 6.2, 6.3, 6.4, 12.3
 *
 * These tests replicate the core logic from the project-base import route
 * and verify correctness properties across many random inputs.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Feature: schema-restructure, Property 6: Project import new column mapping
// Feature: schema-restructure, Property 7: CreatedBy realName resolution
// Feature: schema-restructure, Property 12: Project upsert on import conflict

// ============================================================
// Replicated logic from web/src/app/api/admin/import/project-base/route.ts
// ============================================================

/**
 * Column header mapping (replicated from route.ts)
 * Chinese headers → field names
 */
const COLUMN_MAP: Record<string, string> = {
  // 品类 (category)
  '品牌行业类目': 'category',
  '品类': 'category',
  // 品牌 (brand)
  '品牌简称': 'brand',
  '品牌简称（必填）': 'brand',
  '品牌': 'brand',
  // 业务线 (businessLine)
  '品牌业务线': 'businessLine',
  '品牌业务线（必填）': 'businessLine',
  // 项目名称 (projectName) - priority order
  '元派实际立项名称': 'projectName',
  '飞书项目名称': 'projectName',
  '项目名称': 'projectName',
  '客户名称': 'projectName',
  // 立项时间 (startDate)
  '立项时间': 'startDate',
  // 创建者 (createdBy)
  'AD': 'createdBy',
  '创建者': 'createdBy',
  // 灵犀账号ID
  '灵犀ID': 'lingxiAccountId',
};

/**
 * Replicates the row mapping logic from the route:
 * - Iterates COLUMN_MAP in order
 * - First non-empty match for each field wins (priority-based)
 * - Trims whitespace; empty/whitespace-only → null
 */
function mapRow(raw: Record<string, unknown>): Record<string, string | null> {
  const mapped: Record<string, string | null> = {};
  for (const [chineseHeader, fieldName] of Object.entries(COLUMN_MAP)) {
    const value = raw[chineseHeader];
    const trimmed = value != null && String(value).trim() !== '' ? String(value).trim() : null;
    // Only set if not already set (first match wins for priority)
    if (trimmed && !mapped[fieldName]) {
      mapped[fieldName] = trimmed;
    } else if (!mapped[fieldName]) {
      mapped[fieldName] = mapped[fieldName] ?? null;
    }
  }
  return mapped;
}

// ============================================================
// Replicated resolveCreatedBy logic
// ============================================================

interface UserRecord {
  id: string;
  realName: string | null;
}

/**
 * Replicates the resolveCreatedBy logic:
 * - Find all users where realName matches
 * - If exactly 1 → return that user's UUID
 * - If 0 → return null + "未找到用户" warning
 * - If >1 → return null + "姓名重复" warning
 */
function resolveCreatedByInMemory(
  users: UserRecord[],
  realName: string
): { userId: string | null; warning?: string } {
  const matching = users.filter((u) => u.realName === realName);
  if (matching.length === 1) return { userId: matching[0].id };
  if (matching.length > 1)
    return { userId: null, warning: `姓名"${realName}"重复，请手动指定创建者` };
  return { userId: null, warning: `未找到用户"${realName}"` };
}

// ============================================================
// Replicated findProjectId logic (upsert)
// ============================================================

interface ProjectRecord {
  id: string;
  category: string;
  brand: string;
  businessLine: string | null;
  projectName: string;
}

const NON_EXISTENT_ID = '00000000-0000-0000-0000-000000000000';

/**
 * Replicates the findProjectId logic:
 * - Match on (category, brand, businessLine, projectName) where
 *   null === null (JavaScript semantics mirrors the Prisma findFirst behavior)
 * - If found → return existing project's ID (triggers update in upsert)
 * - If not found → return sentinel UUID (triggers create in upsert)
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
  return existing?.id ?? NON_EXISTENT_ID;
}

// ============================================================
// Generators
// ============================================================

/** Non-empty trimmed string generator for field values */
const nonEmptyStringArb = fc
  .string({ minLength: 1, maxLength: 30 })
  .filter((s) => s.trim().length > 0)
  .map((s) => s.trim());

/** Chinese-style name generator */
const chineseNameArb = fc.constantFrom(
  '张三', '李四', '王五', '赵六', '刘德华', '周杰伦', '陈奕迅',
  '林俊杰', '邓紫棋', '蔡依林', '马云', '李彦宏'
);

/** UUID generator */
const uuidArb = fc.uuid();

/** Category field value */
const categoryArb = fc.constantFrom('美妆', '食品', '服饰', '家居', '数码', '母婴');

/** Brand field value */
const brandArb = fc.constantFrom(
  '雅诗兰黛', '兰蔻', '三只松鼠', '优衣库', 'Nike', '小米', '华为'
);

/** Business line field value (nullable) */
const businessLineArb = fc.option(
  fc.constantFrom('护肤', '彩妆', '香水', '零食', '坚果', '男装', '女装'),
  { nil: null }
);

/** Project name field value */
const projectNameArb = fc.constantFrom(
  '618大促', '双11活动', '年度品宣', '新品上市', 'Q1复盘', '春节营销'
);

// ============================================================
// Property 6: Project import new column mapping
// ============================================================

describe('Property 6: Project import new column mapping', () => {
  /**
   * Validates: Requirements 5.4
   *
   * For any project base Excel row with headers "品牌简称", "品牌行业类目",
   * "品牌业务线", "项目名称", "创建者", the Project Import Service SHALL
   * correctly map these to brand, category, businessLine, projectName,
   * createdBy respectively.
   */

  it('maps "品牌简称"→brand, "品牌行业类目"→category, "品牌业务线"→businessLine, "项目名称"→projectName, "创建者"→createdBy', () => {
    fc.assert(
      fc.property(
        categoryArb,
        brandArb,
        nonEmptyStringArb,
        projectNameArb,
        chineseNameArb,
        (category, brand, businessLine, projectName, createdBy) => {
          const rawRow: Record<string, unknown> = {
            '品牌简称': brand,
            '品牌行业类目': category,
            '品牌业务线': businessLine,
            '项目名称': projectName,
            '创建者': createdBy,
          };

          const mapped = mapRow(rawRow);

          expect(mapped.brand).toBe(brand);
          expect(mapped.category).toBe(category);
          expect(mapped.businessLine).toBe(businessLine);
          expect(mapped.projectName).toBe(projectName);
          expect(mapped.createdBy).toBe(createdBy);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('values are trimmed of whitespace before mapping', () => {
    fc.assert(
      fc.property(
        categoryArb,
        brandArb,
        projectNameArb,
        fc.constantFrom(' ', '  ', '\t'),
        (category, brand, projectName, ws) => {
          const rawRow: Record<string, unknown> = {
            '品牌简称': `${ws}${brand}${ws}`,
            '品牌行业类目': `${ws}${category}${ws}`,
            '项目名称': `${ws}${projectName}${ws}`,
          };

          const mapped = mapRow(rawRow);

          expect(mapped.brand).toBe(brand);
          expect(mapped.category).toBe(category);
          expect(mapped.projectName).toBe(projectName);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('empty or whitespace-only values map to null', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('', ' ', '  ', '\t', ' \t '),
        fc.constantFrom('', ' ', '  ', '\t', ' \t '),
        (emptyBrand, emptyBL) => {
          const rawRow: Record<string, unknown> = {
            '品牌简称': emptyBrand,
            '品牌行业类目': '美妆',
            '品牌业务线': emptyBL,
            '项目名称': '618大促',
          };

          const mapped = mapRow(rawRow);

          expect(mapped.brand).toBeNull();
          expect(mapped.businessLine).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('alternative column names also map correctly (priority-based)', () => {
    fc.assert(
      fc.property(
        categoryArb,
        brandArb,
        projectNameArb,
        (category, brand, projectName) => {
          // Use alternative header names
          const rawRow: Record<string, unknown> = {
            '品牌': brand,          // alternative for brand
            '品类': category,       // alternative for category
            '客户名称': projectName, // lowest-priority alternative for projectName
          };

          const mapped = mapRow(rawRow);

          expect(mapped.brand).toBe(brand);
          expect(mapped.category).toBe(category);
          expect(mapped.projectName).toBe(projectName);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('first non-empty match wins when multiple headers map to the same field', () => {
    fc.assert(
      fc.property(
        brandArb,
        nonEmptyStringArb,
        (primaryBrand, altBrand) => {
          // "品牌简称" has higher priority than "品牌" in COLUMN_MAP
          const rawRow: Record<string, unknown> = {
            '品牌简称': primaryBrand,
            '品牌': altBrand,
            '品牌行业类目': '美妆',
            '项目名称': '618大促',
          };

          const mapped = mapRow(rawRow);

          // "品牌简称" comes first in COLUMN_MAP → it wins
          expect(mapped.brand).toBe(primaryBrand);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('numeric values from Excel are coerced to string', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100000, max: 999999 }),
        (numericId) => {
          const rawRow: Record<string, unknown> = {
            '品牌简称': 'TestBrand',
            '品牌行业类目': '美妆',
            '项目名称': '618大促',
            '灵犀ID': numericId,
          };

          const mapped = mapRow(rawRow);

          expect(mapped.lingxiAccountId).toBe(String(numericId));
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================
// Property 7: CreatedBy realName resolution
// ============================================================

describe('Property 7: CreatedBy realName resolution', () => {
  /**
   * Validates: Requirements 6.1, 6.2, 6.3, 6.4
   *
   * For any realName string provided in the "创建者" column during project import:
   * - If exactly one user in the system has that realName → createdBy = that user's UUID
   * - If zero users match → createdBy = null, warning recorded
   * - If more than one user matches → createdBy = null, warning recorded
   */

  it('exactly one matching user → userId is that user UUID', () => {
    fc.assert(
      fc.property(
        chineseNameArb,
        uuidArb,
        fc.array(
          fc.record({ id: uuidArb, realName: chineseNameArb }),
          { minLength: 0, maxLength: 10 }
        ),
        (targetName, targetId, otherUsers) => {
          // Ensure none of the other users share the target name
          const filteredOthers = otherUsers.filter((u) => u.realName !== targetName);
          const users: UserRecord[] = [
            { id: targetId, realName: targetName },
            ...filteredOthers,
          ];

          const result = resolveCreatedByInMemory(users, targetName);

          expect(result.userId).toBe(targetId);
          expect(result.warning).toBeUndefined();
        }
      ),
      { numRuns: 200 }
    );
  });

  it('zero matching users → userId is null and warning contains "未找到用户"', () => {
    fc.assert(
      fc.property(
        chineseNameArb,
        fc.array(
          fc.record({ id: uuidArb, realName: chineseNameArb }),
          { minLength: 0, maxLength: 10 }
        ),
        (targetName, users) => {
          // Ensure no user has the target name
          const filteredUsers = users.filter((u) => u.realName !== targetName);

          const result = resolveCreatedByInMemory(filteredUsers, targetName);

          expect(result.userId).toBeNull();
          expect(result.warning).toBeDefined();
          expect(result.warning).toContain('未找到用户');
        }
      ),
      { numRuns: 200 }
    );
  });

  it('more than one matching user → userId is null and warning contains "重复"', () => {
    fc.assert(
      fc.property(
        chineseNameArb,
        uuidArb,
        uuidArb,
        fc.array(
          fc.record({ id: uuidArb, realName: chineseNameArb }),
          { minLength: 0, maxLength: 5 }
        ),
        (targetName, id1, id2, otherUsers) => {
          // Ensure the two IDs are different
          fc.pre(id1 !== id2);

          // Create at least 2 users with the same realName
          const users: UserRecord[] = [
            { id: id1, realName: targetName },
            { id: id2, realName: targetName },
            ...otherUsers,
          ];

          const result = resolveCreatedByInMemory(users, targetName);

          expect(result.userId).toBeNull();
          expect(result.warning).toBeDefined();
          expect(result.warning).toContain('重复');
        }
      ),
      { numRuns: 200 }
    );
  });

  it('resolution is case-sensitive (exact realName match required)', () => {
    fc.assert(
      fc.property(uuidArb, (id) => {
        const users: UserRecord[] = [{ id, realName: '张三' }];

        // Exact match works
        const exactResult = resolveCreatedByInMemory(users, '张三');
        expect(exactResult.userId).toBe(id);

        // Different name does not match
        const differentResult = resolveCreatedByInMemory(users, '张三丰');
        expect(differentResult.userId).toBeNull();
        expect(differentResult.warning).toContain('未找到用户');
      }),
      { numRuns: 100 }
    );
  });

  it('null realName in user records never matches any search', () => {
    fc.assert(
      fc.property(
        chineseNameArb,
        uuidArb,
        (targetName, id) => {
          // A user with null realName should never match
          const users: UserRecord[] = [{ id, realName: null }];

          const result = resolveCreatedByInMemory(users, targetName);

          expect(result.userId).toBeNull();
          expect(result.warning).toContain('未找到用户');
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================
// Property 12: Project upsert on import conflict
// ============================================================

describe('Property 12: Project upsert on import conflict', () => {
  /**
   * Validates: Requirements 12.3
   *
   * For any project import where the combination (category, brand, businessLine,
   * projectName) already exists in the database, the import service SHALL perform
   * an update of the existing record rather than creating a duplicate or returning
   * an error.
   */

  it('existing project with matching composite key → returns existing ID (triggers update)', () => {
    fc.assert(
      fc.property(
        uuidArb,
        categoryArb,
        brandArb,
        businessLineArb,
        projectNameArb,
        fc.array(
          fc.record({
            id: uuidArb,
            category: categoryArb,
            brand: brandArb,
            businessLine: businessLineArb,
            projectName: projectNameArb,
          }),
          { minLength: 0, maxLength: 5 }
        ),
        (existingId, category, brand, businessLine, projectName, otherProjects) => {
          // Ensure no other project has the same composite key
          const filteredOthers = otherProjects.filter(
            (p) =>
              !(
                p.category === category &&
                p.brand === brand &&
                p.businessLine === businessLine &&
                p.projectName === projectName
              )
          );

          const projects: ProjectRecord[] = [
            { id: existingId, category, brand, businessLine, projectName },
            ...filteredOthers,
          ];

          const result = findProjectIdInMemory(projects, category, brand, businessLine, projectName);

          // Should find the existing project → triggers update in upsert
          expect(result).toBe(existingId);
          expect(result).not.toBe(NON_EXISTENT_ID);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('no matching composite key → returns sentinel ID (triggers create)', () => {
    fc.assert(
      fc.property(
        categoryArb,
        brandArb,
        businessLineArb,
        projectNameArb,
        fc.array(
          fc.record({
            id: uuidArb,
            category: categoryArb,
            brand: brandArb,
            businessLine: businessLineArb,
            projectName: projectNameArb,
          }),
          { minLength: 0, maxLength: 5 }
        ),
        (category, brand, businessLine, projectName, projects) => {
          // Ensure no project has this exact composite key
          const filteredProjects = projects.filter(
            (p) =>
              !(
                p.category === category &&
                p.brand === brand &&
                p.businessLine === businessLine &&
                p.projectName === projectName
              )
          );

          const result = findProjectIdInMemory(
            filteredProjects,
            category,
            brand,
            businessLine,
            projectName
          );

          // No match → returns sentinel UUID → triggers create in upsert
          expect(result).toBe(NON_EXISTENT_ID);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('null businessLine matches only null businessLine (not non-null)', () => {
    fc.assert(
      fc.property(
        uuidArb,
        categoryArb,
        brandArb,
        nonEmptyStringArb,
        projectNameArb,
        (id, category, brand, nonNullBL, projectName) => {
          // Project exists with non-null businessLine
          const projects: ProjectRecord[] = [
            { id, category, brand, businessLine: nonNullBL, projectName },
          ];

          // Searching with null businessLine should NOT match
          const result = findProjectIdInMemory(projects, category, brand, null, projectName);

          expect(result).toBe(NON_EXISTENT_ID);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('non-null businessLine does not match null businessLine project', () => {
    fc.assert(
      fc.property(
        uuidArb,
        categoryArb,
        brandArb,
        nonEmptyStringArb,
        projectNameArb,
        (id, category, brand, nonNullBL, projectName) => {
          // Project exists with null businessLine
          const projects: ProjectRecord[] = [
            { id, category, brand, businessLine: null, projectName },
          ];

          // Searching with non-null businessLine should NOT match
          const result = findProjectIdInMemory(projects, category, brand, nonNullBL, projectName);

          expect(result).toBe(NON_EXISTENT_ID);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('same (category, brand, projectName) with different businessLines are distinct projects', () => {
    fc.assert(
      fc.property(
        uuidArb,
        uuidArb,
        uuidArb,
        categoryArb,
        brandArb,
        projectNameArb,
        (id1, id2, id3, category, brand, projectName) => {
          fc.pre(id1 !== id2 && id2 !== id3 && id1 !== id3);

          const projects: ProjectRecord[] = [
            { id: id1, category, brand, businessLine: '护肤', projectName },
            { id: id2, category, brand, businessLine: null, projectName },
            { id: id3, category, brand, businessLine: '彩妆', projectName },
          ];

          // Each businessLine variant finds its own project
          const r1 = findProjectIdInMemory(projects, category, brand, '护肤', projectName);
          const r2 = findProjectIdInMemory(projects, category, brand, null, projectName);
          const r3 = findProjectIdInMemory(projects, category, brand, '彩妆', projectName);

          expect(r1).toBe(id1);
          expect(r2).toBe(id2);
          expect(r3).toBe(id3);

          // All three are distinct
          expect(new Set([r1, r2, r3]).size).toBe(3);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('all four composite key fields must match for upsert (partial match → create)', () => {
    fc.assert(
      fc.property(
        uuidArb,
        categoryArb,
        brandArb,
        businessLineArb,
        projectNameArb,
        categoryArb,
        brandArb,
        projectNameArb,
        (id, cat1, brand1, bl, name1, cat2, brand2, name2) => {
          const projects: ProjectRecord[] = [
            { id, category: cat1, brand: brand1, businessLine: bl, projectName: name1 },
          ];

          // Change just one field at a time — should not match
          if (cat2 !== cat1) {
            const r = findProjectIdInMemory(projects, cat2, brand1, bl, name1);
            expect(r).toBe(NON_EXISTENT_ID);
          }
          if (brand2 !== brand1) {
            const r = findProjectIdInMemory(projects, cat1, brand2, bl, name1);
            expect(r).toBe(NON_EXISTENT_ID);
          }
          if (name2 !== name1) {
            const r = findProjectIdInMemory(projects, cat1, brand1, bl, name2);
            expect(r).toBe(NON_EXISTENT_ID);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
