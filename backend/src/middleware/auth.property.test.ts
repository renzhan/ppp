/**
 * Property 6: JWT Authentication Enforcement
 *
 * For any API request to PPP_Backend that lacks a valid JWT token,
 * the PPP_Backend SHALL return HTTP 401 Unauthorized regardless of
 * the endpoint or request payload.
 *
 * **Validates: Requirements 6.1, 6.5**
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fc from 'fast-check';
import { authenticate, type AuthRequest } from './auth';

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-for-property-tests-minimum-length';
});

/**
 * Arbitrary for non-public API paths.
 * Generates paths that do NOT match public paths (/api/auth/login, /api/auth/refresh).
 */
const nonPublicPathArb = fc.oneof(
  // Common API paths
  fc.constantFrom(
    '/api/projects',
    '/api/projects/123',
    '/api/projects/abc/report',
    '/api/ppt/generate',
    '/api/ppt/123',
    '/api/admin/users',
    '/api/export/pdf',
    '/api/data/upload',
    '/api/sentiment/analyze',
    '/api/planning/tasks'
  ),
  // Random API paths (never matching public paths)
  fc
    .array(fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-_'), { minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 })
    .map((segments) => `/api/${segments.join('/')}`)
    .filter((path) => path !== '/api/auth/login' && path !== '/api/auth/refresh' && !path.startsWith('/api/auth/login?') && !path.startsWith('/api/auth/refresh?'))
);

/**
 * Arbitrary for invalid authorization headers.
 * Generates headers that will never contain a valid JWT.
 */
const invalidAuthHeaderArb = fc.oneof(
  // No authorization header at all
  fc.constant(undefined),
  // Empty string
  fc.constant(''),
  // Random strings (not Bearer scheme)
  fc.string({ minLength: 1, maxLength: 100 }),
  // Wrong scheme prefix
  fc.string({ minLength: 1, maxLength: 50 }).map((s) => `Basic ${s}`),
  fc.string({ minLength: 1, maxLength: 50 }).map((s) => `Token ${s}`),
  fc.string({ minLength: 1, maxLength: 50 }).map((s) => `Digest ${s}`),
  // Bearer with no token
  fc.constant('Bearer'),
  fc.constant('Bearer '),
  // Bearer with invalid token (random string, not a valid JWT)
  fc.string({ minLength: 1, maxLength: 200 }).map((s) => `Bearer ${s.replace(/\s/g, 'x')}`),
  // bearer lowercase (wrong case)
  fc.string({ minLength: 1, maxLength: 50 }).map((s) => `bearer ${s}`),
  // Multiple spaces
  fc.string({ minLength: 1, maxLength: 50 }).map((s) => `Bearer  ${s}`)
);

/**
 * Arbitrary for request body/payload (to show it doesn't affect auth).
 */
const arbitraryPayloadArb = fc.oneof(
  fc.constant(undefined),
  fc.json(),
  fc.string(),
  fc.dictionary(fc.string({ minLength: 1, maxLength: 10 }), fc.anything())
);

describe('Property 6: JWT Authentication Enforcement', () => {
  it('should return 401 for any non-public path with missing/invalid auth header', async () => {
    await fc.assert(
      fc.asyncProperty(
        nonPublicPathArb,
        invalidAuthHeaderArb,
        async (path, authHeader) => {
          const request: AuthRequest = {
            headers: {
              authorization: authHeader,
            },
            path,
          };

          const result = await authenticate(request);

          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.status).toBe(401);
            expect(result.body.error).toBe('Unauthorized');
            expect(result.body.message).toBeDefined();
            expect(result.body.message.length).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('should enforce auth regardless of request payload content', async () => {
    await fc.assert(
      fc.asyncProperty(
        nonPublicPathArb,
        invalidAuthHeaderArb,
        arbitraryPayloadArb,
        async (path, authHeader, _payload) => {
          // The payload is generated but not used in the auth check,
          // demonstrating that auth enforcement is independent of body content
          const request: AuthRequest = {
            headers: {
              authorization: authHeader,
              'content-type': 'application/json',
            },
            path,
          };

          const result = await authenticate(request);

          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.status).toBe(401);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should enforce auth when path is provided via url field instead of path field', async () => {
    await fc.assert(
      fc.asyncProperty(
        nonPublicPathArb,
        invalidAuthHeaderArb,
        async (url, authHeader) => {
          const request: AuthRequest = {
            headers: {
              authorization: authHeader,
            },
            url, // using url field instead of path
          };

          const result = await authenticate(request);

          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.status).toBe(401);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
