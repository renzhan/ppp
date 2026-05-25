/**
 * Property-Based Test: API Proxy JWT 验证网关
 *
 * **Validates: Requirements 2.3, 2.4**
 *
 * Property 1: For any HTTP request sent to `/api/ppt/*` paths,
 * if the request does not contain a valid PPP JWT token (session is null),
 * the API Proxy should return HTTP 401 and NOT forward the request to Presenton API.
 * If the request contains a valid JWT (session is non-null), the request should be forwarded.
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  makeProxyDecision,
  stripAuthHeaders,
  type ProxySession,
} from '../../lib/api-proxy-auth';

// --- Generators ---

/**
 * Generates random subpaths under /api/ppt/*
 * Includes known API endpoints and random path segments
 */
const pptSubpathArb: fc.Arbitrary<string> = fc.oneof(
  // Known API endpoints that exist in the proxy layer
  fc.constantFrom(
    'chat',
    'generate',
    'health',
    'presentation/prepare',
    'presentation/stream/abc123',
    'presentation/stream/550e8400-e29b-41d4-a716-446655440000',
    'some-presentation-id',
    'some-presentation-id/export'
  ),
  // Random subpaths (alphanumeric + slashes + hyphens)
  fc.stringOf(
    fc.constantFrom(
      'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
      'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
      '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '/', '-', '_'
    ),
    { minLength: 1, maxLength: 50 }
  )
);

/**
 * Generates a valid session object (simulating what getSession returns for valid JWT)
 */
const validSessionArb: fc.Arbitrary<ProxySession> = fc.record({
  sub: fc.uuid(),
  username: fc.stringOf(
    fc.constantFrom(
      'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
      'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
      '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'
    ),
    { minLength: 3, maxLength: 20 }
  ),
  role: fc.constantFrom('admin', 'user', 'editor'),
  mustChangePassword: fc.boolean(),
});

/**
 * Generates request headers that may include auth-related headers
 */
const headersWithAuthArb: fc.Arbitrary<Record<string, string>> = fc.record({
  'Content-Type': fc.constantFrom('application/json', 'text/plain', 'multipart/form-data'),
  'Authorization': fc.oneof(
    fc.constant('Bearer some-token'),
    fc.constant('Basic dXNlcjpwYXNz'),
    fc.string({ minLength: 5, maxLength: 50 }).map(s => `Bearer ${s}`)
  ),
  'Cookie': fc.oneof(
    fc.constant('ppp_token=some-jwt-value'),
    fc.constant('session_id=abc123; ppp_token=xyz'),
    fc.string({ minLength: 5, maxLength: 80 })
  ),
  'X-Custom-Header': fc.string({ minLength: 1, maxLength: 30 }),
});

// --- Tests ---

describe('Property 1: JWT 验证网关 (API Proxy JWT Validation Gateway)', () => {
  it('should reject (401, no forward) for all /api/ppt/* paths when session is null', () => {
    /**
     * **Validates: Requirements 2.3, 2.4**
     *
     * For any path under /api/ppt/* and a null session (invalid/missing JWT),
     * the proxy decision should be: do NOT forward, return 401.
     */
    fc.assert(
      fc.property(pptSubpathArb, (subpath) => {
        const decision = makeProxyDecision(null, subpath);

        // Should NOT forward to Presenton API
        expect(decision.shouldForward).toBe(false);

        // Should return 401 Unauthorized
        expect(decision.statusCode).toBe(401);

        // Should NOT have a forward URL
        expect(decision.forwardUrl).toBeUndefined();
      }),
      { numRuns: 100 }
    );
  });

  it('should forward requests for all /api/ppt/* paths when session is valid', () => {
    /**
     * **Validates: Requirements 2.3, 2.4**
     *
     * For any path under /api/ppt/* and a valid session (valid JWT),
     * the proxy decision should be: forward to Presenton API at localhost:8000.
     */
    fc.assert(
      fc.property(pptSubpathArb, validSessionArb, (subpath, session) => {
        const decision = makeProxyDecision(session, subpath);

        // Should forward to Presenton API
        expect(decision.shouldForward).toBe(true);

        // Should NOT return 401
        expect(decision.statusCode).not.toBe(401);

        // Forward URL should target localhost:8000 with correct path mapping
        expect(decision.forwardUrl).toBeDefined();
        expect(decision.forwardUrl).toContain('localhost:8000');
        expect(decision.forwardUrl).toContain(`/api/v1/ppt/${subpath}`);
      }),
      { numRuns: 100 }
    );
  });

  it('should correctly map paths: /api/ppt/{subpath} → localhost:8000/api/v1/ppt/{subpath}', () => {
    /**
     * **Validates: Requirements 2.3, 2.4**
     *
     * For any valid session and any subpath, the forward URL should follow
     * the exact mapping pattern: http://localhost:8000/api/v1/ppt/{subpath}
     */
    fc.assert(
      fc.property(pptSubpathArb, validSessionArb, (subpath, session) => {
        const decision = makeProxyDecision(session, subpath);

        expect(decision.shouldForward).toBe(true);
        expect(decision.forwardUrl).toBe(
          `http://localhost:8000/api/v1/ppt/${subpath}`
        );
      }),
      { numRuns: 100 }
    );
  });

  it('should strip auth headers from forwarded requests', () => {
    /**
     * **Validates: Requirements 2.3, 2.4**
     *
     * For any set of request headers that include Authorization and Cookie,
     * the stripped headers should NOT contain any auth-related headers,
     * but should preserve other headers like Content-Type.
     */
    fc.assert(
      fc.property(headersWithAuthArb, (headers) => {
        const stripped = stripAuthHeaders(headers);

        // Auth headers should be removed
        expect(stripped['Authorization']).toBeUndefined();
        expect(stripped['authorization']).toBeUndefined();
        expect(stripped['Cookie']).toBeUndefined();
        expect(stripped['cookie']).toBeUndefined();

        // Non-auth headers should be preserved
        expect(stripped['Content-Type']).toBe(headers['Content-Type']);
        expect(stripped['X-Custom-Header']).toBe(headers['X-Custom-Header']);
      }),
      { numRuns: 100 }
    );
  });

  it('session null always means rejection regardless of path complexity', () => {
    /**
     * **Validates: Requirements 2.3, 2.4**
     *
     * Even for deeply nested or complex paths, a null session always
     * results in rejection. This ensures no path can bypass JWT validation.
     */
    fc.assert(
      fc.property(
        // Generate complex nested paths
        fc.array(
          fc.stringOf(
            fc.constantFrom(
              'a', 'b', 'c', 'd', 'e', 'f', '0', '1', '2', '3', '-', '_'
            ),
            { minLength: 1, maxLength: 15 }
          ),
          { minLength: 1, maxLength: 5 }
        ).map(segments => segments.join('/')),
        (complexPath) => {
          const decision = makeProxyDecision(null, complexPath);

          // Always rejected
          expect(decision.shouldForward).toBe(false);
          expect(decision.statusCode).toBe(401);
        }
      ),
      { numRuns: 100 }
    );
  });
});
