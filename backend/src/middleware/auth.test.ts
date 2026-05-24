import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { SignJWT } from 'jose';
import {
  authenticate,
  extractBearerToken,
  isPublicPath,
  verifyToken,
  type AuthRequest,
} from './auth.js';

const TEST_SECRET = 'test-jwt-secret-for-unit-tests';

beforeAll(() => {
  vi.stubEnv('JWT_SECRET', TEST_SECRET);
});

afterAll(() => {
  vi.unstubAllEnvs();
});

/**
 * Helper to create a valid JWT for testing.
 */
async function createTestToken(payload: {
  sub: string;
  email: string;
  role?: string;
  exp?: string;
}): Promise<string> {
  const secret = new TextEncoder().encode(TEST_SECRET);
  const builder = new SignJWT({ email: payload.email, role: payload.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt();

  if (payload.exp) {
    builder.setExpirationTime(payload.exp);
  } else {
    builder.setExpirationTime('1h');
  }

  return builder.sign(secret);
}

describe('extractBearerToken', () => {
  it('returns null for undefined header', () => {
    expect(extractBearerToken(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(extractBearerToken('')).toBeNull();
  });

  it('returns null for non-Bearer scheme', () => {
    expect(extractBearerToken('Basic abc123')).toBeNull();
  });

  it('returns null for Bearer with no token', () => {
    expect(extractBearerToken('Bearer ')).toBeNull();
  });

  it('returns null for malformed header (no space)', () => {
    expect(extractBearerToken('Bearerabc123')).toBeNull();
  });

  it('extracts token from valid Bearer header', () => {
    expect(extractBearerToken('Bearer my-token-123')).toBe('my-token-123');
  });
});

describe('isPublicPath', () => {
  it('returns true for /api/auth/login', () => {
    expect(isPublicPath('/api/auth/login')).toBe(true);
  });

  it('returns true for /api/auth/refresh', () => {
    expect(isPublicPath('/api/auth/refresh')).toBe(true);
  });

  it('returns true for /api/auth/login with query params', () => {
    expect(isPublicPath('/api/auth/login?redirect=/dashboard')).toBe(true);
  });

  it('returns false for /api/projects', () => {
    expect(isPublicPath('/api/projects')).toBe(false);
  });

  it('returns false for /api/auth/logout', () => {
    expect(isPublicPath('/api/auth/logout')).toBe(false);
  });
});

describe('verifyToken', () => {
  it('returns payload for a valid token', async () => {
    const token = await createTestToken({ sub: 'user-1', email: 'test@example.com' });
    const payload = await verifyToken(token);
    expect(payload).not.toBeNull();
    expect(payload!.sub).toBe('user-1');
    expect(payload!.email).toBe('test@example.com');
  });

  it('returns null for an invalid token', async () => {
    const payload = await verifyToken('not-a-valid-jwt');
    expect(payload).toBeNull();
  });

  it('returns null for a token signed with wrong secret', async () => {
    const wrongSecret = new TextEncoder().encode('wrong-secret');
    const token = await new SignJWT({ email: 'test@example.com' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('user-1')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(wrongSecret);

    const payload = await verifyToken(token);
    expect(payload).toBeNull();
  });

  it('returns null for an expired token', async () => {
    const secret = new TextEncoder().encode(TEST_SECRET);
    // Create a token that expired 1 hour ago
    const token = await new SignJWT({ email: 'test@example.com' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('user-1')
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
      .sign(secret);

    const payload = await verifyToken(token);
    expect(payload).toBeNull();
  });
});

describe('authenticate', () => {
  it('returns success for public paths without token', async () => {
    const request: AuthRequest = {
      headers: {},
      path: '/api/auth/login',
    };
    const result = await authenticate(request);
    expect(result.success).toBe(true);
  });

  it('returns 401 for missing Authorization header on protected path', async () => {
    const request: AuthRequest = {
      headers: {},
      path: '/api/projects',
    };
    const result = await authenticate(request);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.status).toBe(401);
      expect(result.body.error).toBe('Unauthorized');
      expect(result.body.message).toContain('Missing');
    }
  });

  it('returns 401 for invalid token on protected path', async () => {
    const request: AuthRequest = {
      headers: { authorization: 'Bearer invalid-token' },
      path: '/api/projects',
    };
    const result = await authenticate(request);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.status).toBe(401);
      expect(result.body.message).toContain('Invalid or expired');
    }
  });

  it('returns success with user for valid token on protected path', async () => {
    const token = await createTestToken({
      sub: 'user-42',
      email: 'admin@example.com',
      role: 'admin',
    });
    const request: AuthRequest = {
      headers: { authorization: `Bearer ${token}` },
      path: '/api/projects',
    };
    const result = await authenticate(request);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.user.sub).toBe('user-42');
      expect(result.user.email).toBe('admin@example.com');
      expect(result.user.role).toBe('admin');
    }
  });

  it('returns 401 for malformed Authorization header', async () => {
    const request: AuthRequest = {
      headers: { authorization: 'NotBearer some-token' },
      path: '/api/projects/123',
    };
    const result = await authenticate(request);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.status).toBe(401);
    }
  });

  it('uses url field when path is not provided', async () => {
    const request: AuthRequest = {
      headers: {},
      url: '/api/auth/login',
    };
    const result = await authenticate(request);
    expect(result.success).toBe(true);
  });
});
