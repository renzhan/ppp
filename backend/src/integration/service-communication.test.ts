/**
 * Integration Tests: Service Communication
 *
 * Tests the communication patterns between services in the unified platform:
 * 1. PPP backend can reach Presenton backend via internal network (mocked)
 * 2. Nginx routes requests to correct upstream services (routing logic)
 * 3. End-to-end flow: authenticate → create project → generate PPT (mocked)
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 4.1
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PresentonClient } from '../lib/presenton-client.js';
import { resolveNginxRoute } from '../lib/routing.js';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { SignJWT } from 'jose';

// --- Test Helpers ---

function createMockFetch(responses: Array<{ ok: boolean; status: number; body?: unknown }>) {
  let callIndex = 0;
  return vi.fn(async () => {
    const response = responses[callIndex] ?? responses[responses.length - 1];
    callIndex++;
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.ok ? 'OK' : 'Error',
      json: async () => response.body,
      text: async () => JSON.stringify(response.body ?? ''),
    } as unknown as Response;
  });
}

function createJwtToken(payload: Record<string, unknown>): Promise<string> {
  const secret = new TextEncoder().encode('test-jwt-secret-at-least-32-chars');
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret);
}

// --- Test Suite ---

describe('Integration: Service Communication', () => {
  beforeEach(() => {
    vi.stubEnv('JWT_SECRET', 'test-jwt-secret-at-least-32-chars');
    vi.stubEnv('PRESENTON_API_URL', 'http://presenton-backend:8000');
    vi.stubEnv('PRESENTON_API_KEY', 'test-api-key');
  });

  describe('PPP Backend → Presenton Backend Communication', () => {
    it('PresentonClient sends X-API-Key header for authentication', async () => {
      const mockFetch = createMockFetch([
        { ok: true, status: 200, body: { status: 'healthy' } },
      ]);

      const client = new PresentonClient({
        baseUrl: 'http://presenton-backend:8000',
        apiKey: 'test-api-key',
        fetchFn: mockFetch as unknown as typeof fetch,
        sleepFn: async () => {},
      });

      await client.checkHealth();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://presenton-backend:8000/api/v1/health',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'X-API-Key': 'test-api-key',
          }),
        })
      );
    });

    it('PresentonClient can call generate presentation endpoint', async () => {
      const mockResponse = {
        presentation_id: 'pres-123',
        path: '/app_data/presentations/pres-123.pptx',
      };

      const mockFetch = createMockFetch([
        { ok: true, status: 200, body: mockResponse },
      ]);

      const client = new PresentonClient({
        baseUrl: 'http://presenton-backend:8000',
        apiKey: 'test-api-key',
        fetchFn: mockFetch as unknown as typeof fetch,
        sleepFn: async () => {},
      });

      const result = await client.generatePresentation({
        content: '# Test Presentation\n\nSlide content here',
        n_slides: 5,
        language: 'en',
      });

      expect(result.presentation_id).toBe('pres-123');
      expect(result.path).toBe('/app_data/presentations/pres-123.pptx');
    });

    it('PresentonClient retries on server errors and marks service unavailable', async () => {
      const mockFetch = createMockFetch([
        { ok: false, status: 500, body: { error: 'Internal Server Error' } },
        { ok: false, status: 500, body: { error: 'Internal Server Error' } },
        { ok: false, status: 500, body: { error: 'Internal Server Error' } },
      ]);

      const client = new PresentonClient({
        baseUrl: 'http://presenton-backend:8000',
        apiKey: 'test-api-key',
        retryOptions: { maxAttempts: 3, baseDelayMs: 10 },
        fetchFn: mockFetch as unknown as typeof fetch,
        sleepFn: async () => {},
      });

      await expect(client.generatePresentation({ content: 'test' })).rejects.toThrow();
      expect(client.isAvailable).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('PresentonClient health check updates availability status', async () => {
      const mockFetch = createMockFetch([
        { ok: true, status: 200, body: { status: 'healthy' } },
      ]);

      const client = new PresentonClient({
        baseUrl: 'http://presenton-backend:8000',
        apiKey: 'test-api-key',
        fetchFn: mockFetch as unknown as typeof fetch,
        sleepFn: async () => {},
      });

      const isHealthy = await client.checkHealth();
      expect(isHealthy).toBe(true);
      expect(client.isAvailable).toBe(true);
    });
  });

  describe('Nginx Request Routing', () => {
    it('routes Presenton API requests to presenton-backend', () => {
      const testPaths = [
        '/api/v1/ppt/presentation/generate',
        '/api/v1/ppt/presentation/123',
        '/api/v1/health',
        '/api/v1/ppt/fonts',
        '/api/v1/ppt/themes',
        '/api/v1/auth/login',
      ];

      for (const path of testPaths) {
        const result = resolveNginxRoute(path);
        expect(result.service).toBe('presenton-backend');
        expect(result.port).toBe(8000);
      }
    });

    it('routes PPP API requests to ppp-backend', () => {
      const testPaths = [
        '/api/auth/login',
        '/api/auth/refresh',
        '/api/projects',
        '/api/projects/123',
        '/api/projects/123/report',
        '/api/ppt/generate',
      ];

      for (const path of testPaths) {
        const result = resolveNginxRoute(path);
        expect(result.service).toBe('ppp-backend');
        expect(result.port).toBe(4000);
      }
    });

    it('routes static asset requests to presenton-backend', () => {
      const testPaths = [
        '/app_data/images/test.png',
        '/app_data/presentations/pres-123.pptx',
        '/app_data/icons/icon.svg',
      ];

      for (const path of testPaths) {
        const result = resolveNginxRoute(path);
        expect(result.service).toBe('presenton-backend');
        expect(result.port).toBe(8000);
      }
    });

    it('routes frontend page requests to frontend', () => {
      const testPaths = [
        '/',
        '/projects',
        '/projects/123',
        '/review/456',
        '/presentation',
        '/presentation/789',
        '/planning',
        '/sentiment',
        '/admin',
      ];

      for (const path of testPaths) {
        const result = resolveNginxRoute(path);
        expect(result.service).toBe('frontend');
        expect(result.port).toBe(3000);
      }
    });

    it('distinguishes /api/v1/ from /api/ correctly', () => {
      // /api/v1/ goes to presenton
      expect(resolveNginxRoute('/api/v1/anything').service).toBe('presenton-backend');
      // /api/v2/ goes to ppp
      expect(resolveNginxRoute('/api/v2/anything').service).toBe('ppp-backend');
      // /api/auth goes to ppp
      expect(resolveNginxRoute('/api/auth/login').service).toBe('ppp-backend');
    });
  });

  describe('End-to-End Flow: Authenticate → Create Project → Generate PPT', () => {
    it('authenticates user with valid JWT token', async () => {
      const token = await createJwtToken({
        sub: 'user-123',
        email: 'test@example.com',
        role: 'admin',
      });

      const request: AuthRequest = {
        headers: { authorization: `Bearer ${token}` },
        path: '/api/projects',
      };

      const result = await authenticate(request);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.user.sub).toBe('user-123');
        expect(result.user.email).toBe('test@example.com');
      }
    });

    it('rejects unauthenticated requests with 401', async () => {
      const request: AuthRequest = {
        headers: {},
        path: '/api/projects',
      };

      const result = await authenticate(request);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.status).toBe(401);
      }
    });

    it('simulates full PPT generation flow', async () => {
      // Step 1: Authenticate
      const token = await createJwtToken({
        sub: 'user-123',
        email: 'test@example.com',
      });

      const authResult = await authenticate({
        headers: { authorization: `Bearer ${token}` },
        path: '/api/ppt/generate',
      });
      expect(authResult.success).toBe(true);

      // Step 2: Verify routing - PPT generate goes to PPP backend
      const routeResult = resolveNginxRoute('/api/ppt/generate');
      expect(routeResult.service).toBe('ppp-backend');

      // Step 3: PPP backend calls Presenton to generate presentation
      const mockPresentonResponse = {
        presentation_id: 'pres-456',
        path: '/app_data/presentations/pres-456.pptx',
      };

      const mockFetch = createMockFetch([
        { ok: true, status: 200, body: mockPresentonResponse },
      ]);

      const client = new PresentonClient({
        baseUrl: 'http://presenton-backend:8000',
        apiKey: 'test-api-key',
        fetchFn: mockFetch as unknown as typeof fetch,
        sleepFn: async () => {},
      });

      const pptResult = await client.generatePresentation({
        content: '# Marketing Report\n\n## Key Metrics\n\n- Revenue: $1M\n- Growth: 25%',
        n_slides: 10,
        language: 'en',
        template: 'professional',
      });

      expect(pptResult.presentation_id).toBe('pres-456');

      // Step 4: Verify the edit URL and download URL
      const editUrl = `/presentation/${pptResult.presentation_id}`;
      expect(editUrl).toBe('/presentation/pres-456');

      const downloadUrl = client.getDownloadUrl(pptResult.path);
      expect(downloadUrl).toBe('http://presenton-backend:8000/app_data/presentations/pres-456.pptx');

      // Step 5: Verify routing for edit URL goes to frontend
      const editRouteResult = resolveNginxRoute(editUrl);
      expect(editRouteResult.service).toBe('frontend');

      // Step 6: Verify routing for download URL goes to presenton
      const downloadRouteResult = resolveNginxRoute('/app_data/presentations/pres-456.pptx');
      expect(downloadRouteResult.service).toBe('presenton-backend');
    });

    it('handles Presenton unavailability gracefully during PPT generation', async () => {
      // Authenticate successfully
      const token = await createJwtToken({
        sub: 'user-123',
        email: 'test@example.com',
      });

      const authResult = await authenticate({
        headers: { authorization: `Bearer ${token}` },
        path: '/api/ppt/generate',
      });
      expect(authResult.success).toBe(true);

      // Presenton is down - all calls fail
      const mockFetch = createMockFetch([
        { ok: false, status: 503, body: { error: 'Service Unavailable' } },
        { ok: false, status: 503, body: { error: 'Service Unavailable' } },
        { ok: false, status: 503, body: { error: 'Service Unavailable' } },
      ]);

      const client = new PresentonClient({
        baseUrl: 'http://presenton-backend:8000',
        apiKey: 'test-api-key',
        retryOptions: { maxAttempts: 3, baseDelayMs: 10 },
        fetchFn: mockFetch as unknown as typeof fetch,
        sleepFn: async () => {},
      });

      // PPT generation should fail after retries
      await expect(
        client.generatePresentation({ content: 'test content' })
      ).rejects.toThrow();

      // Service should be marked as unavailable
      expect(client.isAvailable).toBe(false);
    });
  });
});
