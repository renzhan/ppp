/**
 * Unit tests for project import route handler.
 *
 * Feature: schema-restructure, Task 5.5
 * Validates: Requirements 5.3, 5.4, 6.1–6.4, 12.3
 *
 * Tests the POST /api/admin/import/project-base handler behavior:
 * 1. businessLine optional → project created with businessLine=null
 * 2. createdBy resolution: 1 match → project.createdBy = user UUID
 * 3. createdBy resolution: 0 matches → createdBy=null, warning "未找到用户"
 * 4. createdBy resolution: >1 matches → createdBy=null, warning "姓名重复"
 * 5. businessLine present → project created with businessLine value
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @/lib/prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    project: {
      findFirst: vi.fn(),
      upsert: vi.fn(),
    },
    projectTreeNode: {
      upsert: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
  },
}));

// Mock @/lib/file-validation
vi.mock('@/lib/file-validation', () => ({
  isValidProjectBaseFile: (fileName: string) => fileName.toLowerCase().endsWith('.xlsx'),
}));

// Mock xlsx - control parsed row data
const mockXlsxRead = vi.fn();
const mockSheetToJson = vi.fn();
const mockDecodeRange = vi.fn();
vi.mock('xlsx', () => ({
  read: (...args: unknown[]) => mockXlsxRead(...args),
  utils: {
    sheet_to_json: (...args: unknown[]) => mockSheetToJson(...args),
    decode_range: (...args: unknown[]) => mockDecodeRange(...args),
  },
}));

import { prisma } from '@/lib/prisma';
import { POST } from '../project-base/route';

/**
 * Creates a mock Request with formData containing a .xlsx file.
 */
function createMockRequest(fileName = 'projects.xlsx') {
  const fakeFile = new File([new ArrayBuffer(10)], fileName, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const mockFormDataObj = {
    get: (key: string) => {
      if (key === 'file') return fakeFile;
      return null;
    },
  };

  return {
    formData: async () => mockFormDataObj,
  } as unknown as Request;
}

describe('POST /api/admin/import/project-base', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: xlsx.read returns workbook with one sheet
    mockXlsxRead.mockReturnValue({
      SheetNames: ['Sheet1'],
      Sheets: { Sheet1: {} },
    });

    // Default: findFirst returns null (no existing project → triggers create)
    (prisma.project.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    // Default: upsert succeeds
    (prisma.project.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'new-project-id' });

    // Default: projectTreeNode upsert succeeds
    (prisma.projectTreeNode.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({});

    // Default: no users found for createdBy resolution
    (prisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  });

  /**
   * Test 1: businessLine optional
   * Row without businessLine column → project created with businessLine=null, no error
   * Validates: Requirement 5.3
   */
  it('creates project with businessLine=null when businessLine column is absent', async () => {
    mockSheetToJson.mockReturnValue([
      { '品牌简称': '雅诗兰黛', '品牌行业类目': '美妆', '项目名称': '618大促' },
    ]);

    const request = createMockRequest();
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.imported).toBe(1);
    // No errors related to missing businessLine
    const businessLineErrors = (data.errors as string[]).filter((e: string) =>
      e.includes('businessLine') || e.includes('业务线')
    );
    expect(businessLineErrors).toHaveLength(0);

    // Verify upsert was called with businessLine: null in create
    expect(prisma.project.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          category: '美妆',
          brand: '雅诗兰黛',
          businessLine: null,
          projectName: '618大促',
        }),
      })
    );
  });

  /**
   * Test 2: createdBy resolution (1 match)
   * "创建者" = "张三", one user found → project.createdBy = that user's UUID
   * Validates: Requirements 6.1, 6.2
   */
  it('resolves createdBy to user UUID when exactly one user matches realName', async () => {
    mockSheetToJson.mockReturnValue([
      { '品牌简称': '兰蔻', '品牌行业类目': '美妆', '项目名称': '双11活动', '创建者': '张三' },
    ]);

    // One user found with realName "张三"
    (prisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'user-zhangsan-uuid' },
    ]);

    const request = createMockRequest();
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.imported).toBe(1);

    // Verify upsert was called with resolved createdBy UUID
    expect(prisma.project.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          createdBy: 'user-zhangsan-uuid',
        }),
      })
    );

    // No warnings about createdBy
    const createdByWarnings = (data.errors as string[]).filter(
      (e: string) => e.includes('未找到用户') || e.includes('重复')
    );
    expect(createdByWarnings).toHaveLength(0);
  });

  /**
   * Test 3: createdBy resolution (0 matches)
   * "创建者" = "不存在", no user found → project.createdBy = null, warning "未找到用户"
   * Validates: Requirements 6.1, 6.4
   */
  it('sets createdBy to null and records warning when no user matches realName', async () => {
    mockSheetToJson.mockReturnValue([
      { '品牌简称': '小米', '品牌行业类目': '数码', '项目名称': '新品发布', '创建者': '不存在' },
    ]);

    // No users found
    (prisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const request = createMockRequest();
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.imported).toBe(1);

    // Verify upsert was called with createdBy: null
    expect(prisma.project.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          createdBy: null,
        }),
      })
    );

    // Warning about user not found
    const warnings = (data.errors as string[]).filter((e: string) => e.includes('未找到用户'));
    expect(warnings.length).toBeGreaterThanOrEqual(1);
    expect(warnings[0]).toContain('不存在');
  });

  /**
   * Test 4: createdBy resolution (>1 matches)
   * "创建者" = "重复名", multiple users found → project.createdBy = null, warning "姓名重复"
   * Validates: Requirements 6.1, 6.3
   */
  it('sets createdBy to null and records warning when multiple users match realName', async () => {
    mockSheetToJson.mockReturnValue([
      { '品牌简称': 'Nike', '品牌行业类目': '服饰', '项目名称': '年度品宣', '创建者': '重复名' },
    ]);

    // Multiple users found with same realName
    (prisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'user-a-uuid' },
      { id: 'user-b-uuid' },
    ]);

    const request = createMockRequest();
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.imported).toBe(1);

    // Verify upsert was called with createdBy: null
    expect(prisma.project.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          createdBy: null,
        }),
      })
    );

    // Warning about duplicate name
    const warnings = (data.errors as string[]).filter((e: string) => e.includes('重复'));
    expect(warnings.length).toBeGreaterThanOrEqual(1);
    expect(warnings[0]).toContain('重复名');
  });

  /**
   * Test 5: businessLine present
   * Row with businessLine "护肤" → project created with businessLine="护肤"
   * Validates: Requirement 5.4
   */
  it('creates project with businessLine value when column is present', async () => {
    mockSheetToJson.mockReturnValue([
      {
        '品牌简称': '雅诗兰黛',
        '品牌行业类目': '美妆',
        '品牌业务线': '护肤',
        '项目名称': '618大促',
      },
    ]);

    const request = createMockRequest();
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.imported).toBe(1);

    // Verify upsert was called with businessLine: '护肤' in create
    expect(prisma.project.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          category: '美妆',
          brand: '雅诗兰黛',
          businessLine: '护肤',
          projectName: '618大促',
        }),
      })
    );
  });
});
