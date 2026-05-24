/**
 * Property Tests for Presenton Client
 *
 * Property 8: Service Degradation Isolation
 * Property 9: Retry with Exponential Backoff
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
  isPptEndpoint,
  handleServiceDegradation,
  calculateBackoffDelay,
  PresentonClient,
  type ServiceDegradationResult,
} from './presenton-client.js';

// --- Arbitraries ---

/**
 * Generates paths that are PPT-related (contain /ppt/ or /presentation/).
 */
const pptPathArb = fc.oneof(
  // Paths containing /ppt/
  fc
    .stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-_'), { minLength: 1, maxLength: 20 })
    .map((suffix) => `/api/ppt/${suffix}`),
  // Paths ending with /ppt
  fc.constantFrom('/api/ppt', '/some/path/ppt'),
  // Paths containing /presentation/
  fc
    .stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-_'), { minLength: 1, maxLength: 20 })
    .map((suffix) => `/api/presentation/${suffix}`),
  // Paths ending with /presentation
  fc
    .array(fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-_'), { minLength: 1, maxLength: 10 }), { minLength: 0, maxLength: 3 })
    .map((segments) => segments.length > 0 ? `/${segments.join('/')}/presentation` : '/presentation')
);

/**
 * Generates paths that are NOT PPT-related.
 * These paths do not contain /ppt/ or /presentation/ and do not end with /ppt or /presentation.
 */
const nonPptPathArb = fc.oneof(
  // Common non-PPT API paths
  fc.constantFrom(
    '/api/projects',
    '/api/projects/123',
    '/api/projects/abc/report',
    '/api/auth/login',
    '/api/auth/refresh',
    '/api/export/pdf',
    '/api/export/word',
    '/api/data/upload',
    '/api/sentiment/analyze',
    '/api/planning/tasks',
    '/api/admin/users'
  ),
  // Random non-PPT paths
  fc
    .array(
      fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-_'), { minLength: 1, maxLength: 15 }),
      { minLength: 1, maxLength: 4 }
    )
    .filter((segments) => {
      const path = `/${segments.join('/')}`;
      const lower = path.toLowerCase();
      return !lower.includes('/ppt/') &&
        !lower.endsWith('/ppt') &&
        !lower.includes('/presentation/') &&
        !lower.endsWith('/presentation');
    })
    .map((segments) => `/api/${segments.join('/')}`)
);

// --- Property 8: Service Degradation Isolation ---

describe('Property 8: Service Degradation Isolation', () => {
  /**
   * **Validates: Requirements 7.1, 7.2**
   *
   * For any request to PPP_Backend while Presenton_Backend is unavailable:
   * - If the request targets a PPT-related endpoint, the response SHALL be HTTP 503
   * - If the request targets any non-PPT endpoint, the response SHALL succeed normally
   */

  it('PPT endpoints return 503 when service is unavailable', () => {
    fc.assert(
      fc.property(pptPathArb, (path) => {
        const result = handleServiceDegradation(path, false);

        expect(result.allowed).toBe(false);
        if (!result.allowed) {
          expect(result.status).toBe(503);
          expect(result.message).toBeDefined();
          expect(result.message.length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 200 }
    );
  });

  it('non-PPT endpoints succeed normally when service is unavailable', () => {
    fc.assert(
      fc.property(nonPptPathArb, (path) => {
        const result = handleServiceDegradation(path, false);

        expect(result.allowed).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  it('all endpoints succeed when service is available regardless of path type', () => {
    fc.assert(
      fc.property(
        fc.oneof(pptPathArb, nonPptPathArb),
        (path) => {
          const result = handleServiceDegradation(path, true);

          expect(result.allowed).toBe(true);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('degradation result is deterministic for the same path and availability', () => {
    fc.assert(
      fc.property(
        fc.oneof(pptPathArb, nonPptPathArb),
        fc.boolean(),
        (path, isAvailable) => {
          const result1 = handleServiceDegradation(path, isAvailable);
          const result2 = handleServiceDegradation(path, isAvailable);

          expect(result1).toEqual(result2);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// --- Property 9: Retry with Exponential Backoff ---

describe('Property 9: Retry with Exponential Backoff', () => {
  /**
   * **Validates: Requirement 7.3**
   *
   * For any failed call from PPP_Backend to Presenton_Backend, the PPP_Backend
   * SHALL retry up to 3 times with exponentially increasing delays before
   * returning an error to the client.
   */

  it('calculateBackoffDelay produces strictly increasing delays for successive attempts', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 5000 }), // baseDelayMs
        (baseDelayMs) => {
          const delay0 = calculateBackoffDelay(0, baseDelayMs);
          const delay1 = calculateBackoffDelay(1, baseDelayMs);
          const delay2 = calculateBackoffDelay(2, baseDelayMs);

          // Delays must be strictly increasing
          expect(delay1).toBeGreaterThan(delay0);
          expect(delay2).toBeGreaterThan(delay1);

          // Verify exponential relationship: each delay is double the previous
          expect(delay1).toBe(delay0 * 2);
          expect(delay2).toBe(delay1 * 2);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('calculateBackoffDelay equals baseDelayMs * 2^attempt', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10 }), // attempt
        fc.integer({ min: 1, max: 10000 }), // baseDelayMs
        (attempt, baseDelayMs) => {
          const delay = calculateBackoffDelay(attempt, baseDelayMs);
          const expected = baseDelayMs * Math.pow(2, attempt);

          expect(delay).toBe(expected);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('retries exactly 3 times before giving up on persistent failures', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 500, max: 599 }), // server error status codes
        async (statusCode) => {
          const mockFetch = vi.fn().mockResolvedValue({
            ok: false,
            status: statusCode,
            statusText: 'Server Error',
          });
          const mockSleep = vi.fn().mockResolvedValue(undefined);

          const client = new PresentonClient({
            baseUrl: 'http://localhost:8000',
            apiKey: 'test-key',
            fetchFn: mockFetch as unknown as typeof fetch,
            sleepFn: mockSleep,
            retryOptions: { maxAttempts: 3, baseDelayMs: 1000 },
          });

          await expect(
            client.generatePresentation({ content: 'test' })
          ).rejects.toThrow();

          // Exactly 3 fetch attempts (initial + 2 retries)
          expect(mockFetch).toHaveBeenCalledTimes(3);

          // Sleep called between attempts (2 times: after attempt 0 and attempt 1)
          expect(mockSleep).toHaveBeenCalledTimes(2);

          // Verify exponential backoff delays
          expect(mockSleep).toHaveBeenNthCalledWith(1, 1000); // 1000 * 2^0
          expect(mockSleep).toHaveBeenNthCalledWith(2, 2000); // 1000 * 2^1
        }
      ),
      { numRuns: 50 }
    );
  });

  it('returns error to client after all retries exhausted on network failures', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'Network error'),
        async (errorMessage) => {
          const mockFetch = vi.fn().mockRejectedValue(new Error(errorMessage));
          const mockSleep = vi.fn().mockResolvedValue(undefined);

          const client = new PresentonClient({
            baseUrl: 'http://localhost:8000',
            apiKey: 'test-key',
            fetchFn: mockFetch as unknown as typeof fetch,
            sleepFn: mockSleep,
            retryOptions: { maxAttempts: 3, baseDelayMs: 1000 },
          });

          await expect(
            client.generatePresentation({ content: 'test' })
          ).rejects.toThrow();

          // Exactly 3 fetch attempts
          expect(mockFetch).toHaveBeenCalledTimes(3);

          // 2 sleep calls between the 3 attempts
          expect(mockSleep).toHaveBeenCalledTimes(2);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('marks service as unavailable after all retries exhausted', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 500, max: 599 }),
        async (statusCode) => {
          const mockFetch = vi.fn().mockResolvedValue({
            ok: false,
            status: statusCode,
            statusText: 'Error',
          });
          const mockSleep = vi.fn().mockResolvedValue(undefined);

          const client = new PresentonClient({
            baseUrl: 'http://localhost:8000',
            apiKey: 'test-key',
            fetchFn: mockFetch as unknown as typeof fetch,
            sleepFn: mockSleep,
            retryOptions: { maxAttempts: 3, baseDelayMs: 1000 },
          });

          expect(client.isAvailable).toBe(true);

          await expect(
            client.generatePresentation({ content: 'test' })
          ).rejects.toThrow();

          expect(client.isAvailable).toBe(false);
        }
      ),
      { numRuns: 50 }
    );
  });
});
