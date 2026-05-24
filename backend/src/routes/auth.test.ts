import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { jwtVerify } from 'jose';
import { handleLogin, handleRefresh } from './auth.js';

const TEST_SECRET = 'test-jwt-secret-for-unit-tests';

beforeAll(() => {
  vi.stubEnv('JWT_SECRET', TEST_SECRET);
});

afterAll(() => {
  vi.unstubAllEnvs();
});

describe('handleLogin', () => {
  it('returns 400 for missing email', async () => {
    const result = await handleLogin({ email: '', password: 'pass123' });
    expect(result.status).toBe(400);
    if (result.status === 400) {
      expect(result.body.message).toContain('required');
    }
  });

  it('returns 400 for missing password', async () => {
    const result = await handleLogin({ email: 'user@test.com', password: '' });
    expect(result.status).toBe(400);
    if (result.status === 400) {
      expect(result.body.message).toContain('required');
    }
  });

  it('returns 401 when credential validator rejects', async () => {
    const validator = async () => null;
    const result = await handleLogin(
      { email: 'user@test.com', password: 'wrong' },
      validator
    );
    expect(result.status).toBe(401);
    if (result.status === 401) {
      expect(result.body.message).toContain('Invalid email or password');
    }
  });

  it('returns 200 with tokens for valid credentials (default validator)', async () => {
    const result = await handleLogin({ email: 'user@test.com', password: 'pass123' });
    expect(result.status).toBe(200);
    if (result.status === 200) {
      expect(result.body.accessToken).toBeDefined();
      expect(result.body.refreshToken).toBeDefined();
      expect(result.body.tokenType).toBe('Bearer');
      expect(result.body.expiresIn).toBe(3600);
    }
  });

  it('returns 200 with tokens for valid credentials (custom validator)', async () => {
    const validator = async (email: string, _password: string) => ({
      sub: 'custom-id',
      email,
      role: 'admin',
    });
    const result = await handleLogin(
      { email: 'admin@test.com', password: 'secret' },
      validator
    );
    expect(result.status).toBe(200);
    if (result.status === 200) {
      // Verify the access token contains correct claims
      const secret = new TextEncoder().encode(TEST_SECRET);
      const { payload } = await jwtVerify(result.body.accessToken, secret);
      expect(payload.sub).toBe('custom-id');
      expect(payload.email).toBe('admin@test.com');
      expect(payload.role).toBe('admin');
    }
  });

  it('generates a refresh token with type=refresh claim', async () => {
    const result = await handleLogin({ email: 'user@test.com', password: 'pass' });
    expect(result.status).toBe(200);
    if (result.status === 200) {
      const secret = new TextEncoder().encode(TEST_SECRET);
      const { payload } = await jwtVerify(result.body.refreshToken, secret);
      expect(payload.type).toBe('refresh');
      expect(payload.sub).toBe('user@test.com');
    }
  });
});

describe('handleRefresh', () => {
  it('returns 400 for missing refresh token', async () => {
    const result = await handleRefresh({ refreshToken: '' });
    expect(result.status).toBe(400);
    if (result.status === 400) {
      expect(result.body.message).toContain('required');
    }
  });

  it('returns 401 for invalid refresh token', async () => {
    const result = await handleRefresh({ refreshToken: 'not-a-valid-token' });
    expect(result.status).toBe(401);
    if (result.status === 401) {
      expect(result.body.message).toContain('Invalid or expired');
    }
  });

  it('returns 401 when using an access token as refresh token', async () => {
    // First login to get an access token
    const loginResult = await handleLogin({ email: 'user@test.com', password: 'pass' });
    expect(loginResult.status).toBe(200);
    if (loginResult.status === 200) {
      // Try to use the access token as a refresh token
      const result = await handleRefresh({ refreshToken: loginResult.body.accessToken });
      expect(result.status).toBe(401);
      if (result.status === 401) {
        expect(result.body.message).toContain('Invalid token type');
      }
    }
  });

  it('returns 200 with new token pair for valid refresh token', async () => {
    // First login to get a refresh token
    const loginResult = await handleLogin({ email: 'user@test.com', password: 'pass' });
    expect(loginResult.status).toBe(200);
    if (loginResult.status === 200) {
      const result = await handleRefresh({ refreshToken: loginResult.body.refreshToken });
      expect(result.status).toBe(200);
      if (result.status === 200) {
        expect(result.body.accessToken).toBeDefined();
        expect(result.body.refreshToken).toBeDefined();
        expect(result.body.tokenType).toBe('Bearer');
        expect(result.body.expiresIn).toBe(3600);
        // New tokens should be different from original
        expect(result.body.accessToken).not.toBe(loginResult.body.accessToken);
      }
    }
  });
});
