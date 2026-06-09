/**
 * Unit tests for login route handler.
 *
 * Tests phone login success/failure, username fallback, disabled account rejection,
 * and unified error messages for security (no user enumeration).
 *
 * Requirements: 2.1, 2.2, 2.4
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock @/lib/prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// Mock @/lib/auth
vi.mock('@/lib/auth', () => ({
  verifyPassword: vi.fn(),
  createToken: vi.fn(),
  getCookieName: vi.fn(() => 'ppp_token'),
}));

import { prisma } from '@/lib/prisma';
import { verifyPassword, createToken, getCookieName } from '@/lib/auth';
import { POST } from '../route';

// Helper to create a NextRequest with JSON body
function createLoginRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// Mock user data
const mockActiveUser = {
  id: 'user-uuid-001',
  username: '花名测试',
  phone: '13800138000',
  displayName: '测试用户',
  realName: '张三',
  role: 'AE',
  passwordHash: '$2a$10$hashedpassword',
  mustChangePassword: false,
  isActive: true,
  lastLoginAt: null,
};

const mockDisabledUser = {
  ...mockActiveUser,
  id: 'user-uuid-002',
  isActive: false,
};

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getCookieName as ReturnType<typeof vi.fn>).mockReturnValue('ppp_token');
  });

  // Test 1: Phone login success
  describe('Phone login success', () => {
    it('returns 200 with user data when phone exists, isActive=true, correct password', async () => {
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockActiveUser);
      (verifyPassword as ReturnType<typeof vi.fn>).mockResolvedValue(true);
      (createToken as ReturnType<typeof vi.fn>).mockResolvedValue('mock-jwt-token');
      (prisma.user.update as ReturnType<typeof vi.fn>).mockResolvedValue(mockActiveUser);

      const request = createLoginRequest({
        phone: '13800138000',
        password: 'correct-password',
        rememberMe: false,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.user).toEqual({
        id: 'user-uuid-001',
        username: '花名测试',
        displayName: '测试用户',
        role: 'AE',
        mustChangePassword: false,
      });

      // Verify findUnique was called with phone
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { phone: '13800138000' },
      });

      // Verify password was checked
      expect(verifyPassword).toHaveBeenCalledWith('correct-password', '$2a$10$hashedpassword');

      // Verify lastLoginAt was updated
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-uuid-001' },
        data: { lastLoginAt: expect.any(Date) },
      });

      // Verify token was created with correct user data
      expect(createToken).toHaveBeenCalledWith(
        {
          id: 'user-uuid-001',
          username: '花名测试',
          phone: '13800138000',
          role: 'AE',
          mustChangePassword: false,
        },
        false
      );
    });
  });

  // Test 2: Phone login failure - phone not found
  describe('Phone login failure - user not found', () => {
    it('returns 401 "手机号或密码错误" when phone is not found', async () => {
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const request = createLoginRequest({
        phone: '13900000000',
        password: 'any-password',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('手机号或密码错误');

      // Should NOT attempt password verification
      expect(verifyPassword).not.toHaveBeenCalled();
    });
  });

  // Test 3: Phone login failure - wrong password
  describe('Phone login failure - wrong password', () => {
    it('returns 401 "手机号或密码错误" when password is incorrect', async () => {
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockActiveUser);
      (verifyPassword as ReturnType<typeof vi.fn>).mockResolvedValue(false);

      const request = createLoginRequest({
        phone: '13800138000',
        password: 'wrong-password',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('手机号或密码错误');

      // Should NOT update lastLoginAt
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  // Test 4: Disabled account rejection
  describe('Disabled account rejection', () => {
    it('returns 401 "手机号或密码错误" when user isActive=false', async () => {
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockDisabledUser);

      const request = createLoginRequest({
        phone: '13800138000',
        password: 'correct-password',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('手机号或密码错误');

      // Should NOT attempt password verification for disabled accounts
      expect(verifyPassword).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  // Test 5: Username fallback success
  describe('Username fallback success', () => {
    it('looks up by username when phone is not provided, returns 200', async () => {
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockActiveUser);
      (verifyPassword as ReturnType<typeof vi.fn>).mockResolvedValue(true);
      (createToken as ReturnType<typeof vi.fn>).mockResolvedValue('mock-jwt-token');
      (prisma.user.update as ReturnType<typeof vi.fn>).mockResolvedValue(mockActiveUser);

      const request = createLoginRequest({
        username: '花名测试',
        password: 'correct-password',
        rememberMe: true,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.user).toEqual({
        id: 'user-uuid-001',
        username: '花名测试',
        displayName: '测试用户',
        role: 'AE',
        mustChangePassword: false,
      });

      // Verify findUnique was called with username (not phone)
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { username: '花名测试' },
      });

      // Verify rememberMe=true is passed to createToken
      expect(createToken).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'user-uuid-001' }),
        true
      );
    });
  });

  // Test 6: Missing credentials - neither phone nor username
  describe('Missing credentials', () => {
    it('returns 400 "请输入手机号和密码" when neither phone nor username provided', async () => {
      const request = createLoginRequest({
        password: 'some-password',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('请输入手机号和密码');

      // Should NOT query database
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });
  });

  // Test 7: Missing password
  describe('Missing password', () => {
    it('returns 400 "请输入手机号和密码" when password is not provided', async () => {
      const request = createLoginRequest({
        phone: '13800138000',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('请输入手机号和密码');
    });
  });

  // Test 8: Unified error messages - no user enumeration
  describe('Unified error messages (no user enumeration)', () => {
    it('returns the same error message for all auth failure cases', async () => {
      const UNIFIED_ERROR = '手机号或密码错误';

      // Case A: User not found
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      const responseNotFound = await POST(
        createLoginRequest({ phone: '13900000001', password: 'pw' })
      );
      const dataNotFound = await responseNotFound.json();

      // Case B: User disabled
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockDisabledUser);
      const responseDisabled = await POST(
        createLoginRequest({ phone: '13800138000', password: 'pw' })
      );
      const dataDisabled = await responseDisabled.json();

      // Case C: Wrong password
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockActiveUser);
      (verifyPassword as ReturnType<typeof vi.fn>).mockResolvedValue(false);
      const responseWrongPw = await POST(
        createLoginRequest({ phone: '13800138000', password: 'wrong' })
      );
      const dataWrongPw = await responseWrongPw.json();

      // All cases must return same status and same message
      expect(responseNotFound.status).toBe(401);
      expect(responseDisabled.status).toBe(401);
      expect(responseWrongPw.status).toBe(401);

      expect(dataNotFound.error).toBe(UNIFIED_ERROR);
      expect(dataDisabled.error).toBe(UNIFIED_ERROR);
      expect(dataWrongPw.error).toBe(UNIFIED_ERROR);

      // All three error messages are identical (prevents user enumeration)
      expect(dataNotFound.error).toBe(dataDisabled.error);
      expect(dataDisabled.error).toBe(dataWrongPw.error);
    });
  });
});
