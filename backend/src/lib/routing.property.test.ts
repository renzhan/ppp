/**
 * Property Test: Request Routing Correctness (Property 1)
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4
 *
 * Uses fast-check to generate arbitrary HTTP request paths and verifies:
 * - /api/v1/* routes to Presenton backend (port 8000)
 * - /api/* (non-v1) routes to PPP backend (port 4000)
 * - /app_data/* routes to Presenton backend (port 8000)
 * - All other paths route to frontend (port 3000)
 * - Each request routes to exactly one service
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { resolveNginxRoute, type UpstreamService } from './routing.js';

// Arbitrary for generating valid URL path segments
const pathSegment = fc.stringOf(
  fc.oneof(
    fc.char().filter(c => /[a-zA-Z0-9\-_.]/.test(c)),
    fc.constant('/')
  ),
  { minLength: 0, maxLength: 20 }
);

const arbitraryPathSuffix = fc.array(pathSegment, { minLength: 0, maxLength: 5 })
  .map(segments => segments.join('/'));

describe('Property 1: Request Routing Correctness', () => {
  /**
   * **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
   */
  it('routes /api/v1/* paths to Presenton backend (port 8000)', () => {
    fc.assert(
      fc.property(arbitraryPathSuffix, (suffix) => {
        const path = `/api/v1/${suffix}`;
        const result = resolveNginxRoute(path);
        expect(result.service).toBe('presenton-backend');
        expect(result.port).toBe(8000);
      }),
      { numRuns: 200 }
    );
  });

  it('routes /api/* (non-v1) paths to PPP backend (port 4000)', () => {
    // Generate paths that start with /api/ but NOT /api/v1/
    const nonV1Prefixes = fc.oneof(
      fc.constant('v2'),
      fc.constant('auth'),
      fc.constant('projects'),
      fc.constant('ppt'),
      fc.constant('export'),
      fc.stringOf(fc.char().filter(c => /[a-z0-9]/.test(c)), { minLength: 1, maxLength: 10 })
        .filter(s => s !== 'v1')
    );

    fc.assert(
      fc.property(nonV1Prefixes, arbitraryPathSuffix, (prefix, suffix) => {
        const path = `/api/${prefix}/${suffix}`;
        const result = resolveNginxRoute(path);
        expect(result.service).toBe('ppp-backend');
        expect(result.port).toBe(4000);
      }),
      { numRuns: 200 }
    );
  });

  it('routes /app_data/* paths to Presenton backend (port 8000)', () => {
    fc.assert(
      fc.property(arbitraryPathSuffix, (suffix) => {
        const path = `/app_data/${suffix}`;
        const result = resolveNginxRoute(path);
        expect(result.service).toBe('presenton-backend');
        expect(result.port).toBe(8000);
      }),
      { numRuns: 200 }
    );
  });

  it('routes all other paths to frontend (port 3000)', () => {
    // Generate paths that don't start with /api/ or /app_data/
    const frontendPrefixes = fc.oneof(
      fc.constant(''),
      fc.constant('projects'),
      fc.constant('review'),
      fc.constant('presentation'),
      fc.constant('planning'),
      fc.constant('sentiment'),
      fc.constant('admin'),
      fc.constant('dashboard'),
      fc.stringOf(fc.char().filter(c => /[a-z0-9]/.test(c)), { minLength: 1, maxLength: 10 })
        .filter(s => s !== 'api' && s !== 'app_data')
    );

    fc.assert(
      fc.property(frontendPrefixes, arbitraryPathSuffix, (prefix, suffix) => {
        const path = `/${prefix}/${suffix}`;
        const result = resolveNginxRoute(path);
        expect(result.service).toBe('frontend');
        expect(result.port).toBe(3000);
      }),
      { numRuns: 200 }
    );
  });

  it('each request routes to exactly one service (no ambiguity)', () => {
    // Generate completely arbitrary paths
    const arbitraryPath = fc.oneof(
      fc.constant('/'),
      fc.constant('/api/v1/ppt/presentation/generate'),
      fc.constant('/api/projects'),
      fc.constant('/app_data/images/test.png'),
      fc.constant('/presentation/123'),
      arbitraryPathSuffix.map(s => `/${s}`)
    );

    fc.assert(
      fc.property(arbitraryPath, (path) => {
        const result = resolveNginxRoute(path);

        // Must route to exactly one service
        const validServices: UpstreamService[] = ['presenton-backend', 'ppp-backend', 'frontend'];
        expect(validServices).toContain(result.service);

        // Port must match service
        const servicePortMap: Record<UpstreamService, number> = {
          'presenton-backend': 8000,
          'ppp-backend': 4000,
          'frontend': 3000,
        };
        expect(result.port).toBe(servicePortMap[result.service]);
      }),
      { numRuns: 500 }
    );
  });

  it('routing is deterministic - same path always routes to same service', () => {
    const arbitraryPath = fc.oneof(
      arbitraryPathSuffix.map(s => `/api/v1/${s}`),
      arbitraryPathSuffix.map(s => `/api/projects/${s}`),
      arbitraryPathSuffix.map(s => `/app_data/${s}`),
      arbitraryPathSuffix.map(s => `/${s}`)
    );

    fc.assert(
      fc.property(arbitraryPath, (path) => {
        const result1 = resolveNginxRoute(path);
        const result2 = resolveNginxRoute(path);
        expect(result1).toEqual(result2);
      }),
      { numRuns: 200 }
    );
  });
});
