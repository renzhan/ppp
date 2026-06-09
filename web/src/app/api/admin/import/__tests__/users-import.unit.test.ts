/**
 * Unit tests for user import phone validation.
 *
 * Tests valid phone import, invalid format rejection, duplicate phone rejection,
 * missing phone acceptance, and valid phone with other fields.
 *
 * Requirements: 3.3, 3.4
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock @/lib/prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

// Mock @/lib/auth
vi.mock('@/lib/auth', () => ({
  getSession: vi.fn(),
  hashPassword: vi.fn(),
}));

// Mock @/lib/phone-validator - use the real validation logic
vi.mock('@/lib/phone-validator', () => ({
  isValidPhone: (input: string) => /^1[3-9]\d{9}$/.test(input),
}));

// Mock xlsx - control parsed row data
const mockXlsxRead = vi.fn();
const mockSheetToJson = vi.fn();
vi.mock('xlsx', () => ({
  read: (...args: unknown[]) => mockXlsxRead(...args),
  utils: {
    sheet_to_json: (...args: unknown[]) => mockSheetToJson(...args),
  },
}));

import { prisma } from '@/lib/prisma';
import { getSession, hashPassword } from '@/lib/auth';
import { POST } from '../users/route';

// Mock admin session
const mockAdminSession = {
  id: 'admin-uuid',
  username: 'admin',
  role: 'admin',
};

/**
 * Creates a mock NextRequest-like object that has a working formData() method.
 * Since real FormData/File in Node test environment has issues with NextRequest,
 * we construct a request object that directly returns a mock formData.
 */
function createMockRequest() {
  // Create a real File instance to pass instanceof checks
  const fakeFile = new File([new ArrayBuffer(10)], 'users.xlsx', {
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
  } as unknown as NextRequest;
}

describe('POST /api/admin/import/users - phone validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: admin session
    (getSession as ReturnType<typeof vi.fn>).mockResolvedValue(mockAdminSession);

    // Default: hashPassword returns a fixed hash
    (hashPassword as ReturnType<typeof vi.fn>).mockResolvedValue('$hashed$');

    // Default: xlsx.read returns workbook with one sheet
    mockXlsxRead.mockReturnValue({
      SheetNames: ['Sheet1'],
      Sheets: { Sheet1: {} },
    });

    // Default: no existing users (findUnique returns null)
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    // Default: create succeeds
    (prisma.user.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'new-user-id' });
  });

  /**
   * Test 1: Valid phone import
   * Row with valid phone "13800138000" → user created with phone field
   * Validates: Requirement 3.3 (valid phone passes validation)
   */
  it('creates user with valid phone "13800138000"', async () => {
    mockSheetToJson.mockReturnValue([
      { '花名': 'testuser', '角色': 'AE', '手机号': '13800138000' },
    ]);

    const request = createMockRequest();
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.imported).toBe(1);
    expect(data.errors).toHaveLength(0);

    // Verify user was created with phone field
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        username: 'testuser',
        phone: '13800138000',
        role: 'AE',
      }),
    });
  });

  /**
   * Test 2: Invalid phone format rejection
   * Row with phone "12345" → error "第2行: 手机号格式不正确", user NOT created
   * Validates: Requirement 3.3
   */
  it('rejects row with invalid phone format "12345" and records error', async () => {
    mockSheetToJson.mockReturnValue([
      { '花名': 'testuser', '角色': 'AE', '手机号': '12345' },
    ]);

    const request = createMockRequest();
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.imported).toBe(0);
    expect(data.errors).toContain('第2行: 手机号格式不正确');

    // User should NOT be created
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  /**
   * Test 3: Duplicate phone rejection
   * Row with phone that already exists in DB → error "第2行: 手机号已存在", user NOT created
   * Validates: Requirement 3.4
   */
  it('rejects row when phone already exists in system', async () => {
    // findUnique: first call for username check → not found, second call for phone check → found
    (prisma.user.findUnique as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(null) // username lookup → not found
      .mockResolvedValueOnce({ id: 'existing-user', phone: '13900139000' }); // phone lookup → found

    mockSheetToJson.mockReturnValue([
      { '花名': 'newuser', '角色': 'AE', '手机号': '13900139000' },
    ]);

    const request = createMockRequest();
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.imported).toBe(0);
    expect(data.errors).toContain('第2行: 手机号已存在');

    // User should NOT be created
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  /**
   * Test 4: Missing phone is acceptable
   * Row without phone column → user created with phone=null
   */
  it('creates user when phone column is absent (phone defaults to null)', async () => {
    mockSheetToJson.mockReturnValue([
      { '花名': 'nophone_user', '角色': 'AM' },
    ]);

    const request = createMockRequest();
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.imported).toBe(1);
    expect(data.errors).toHaveLength(0);

    // Verify user was created with phone=null
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        username: 'nophone_user',
        phone: null,
        role: 'AM',
      }),
    });
  });

  /**
   * Test 5: Valid phone with other valid fields → imported count = 1
   */
  it('successfully imports user with valid phone and all other valid fields', async () => {
    mockSheetToJson.mockReturnValue([
      {
        '花名': 'zhangsan',
        '真实姓名': '张三',
        '显示名': '张三Display',
        '角色': 'VP',
        '手机号': '15912345678',
      },
    ]);

    const request = createMockRequest();
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.imported).toBe(1);
    expect(data.errors).toHaveLength(0);

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        username: 'zhangsan',
        realName: '张三',
        displayName: '张三Display',
        phone: '15912345678',
        role: 'VP',
        permissionLevel: 1,
        mustChangePassword: true,
        isActive: true,
      }),
    });
  });
});
