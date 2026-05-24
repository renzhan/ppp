import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  PresentonClient,
  isPptEndpoint,
  handleServiceDegradation,
  calculateBackoffDelay,
  resetPresentonClient,
} from './presenton-client.js';

describe('isPptEndpoint', () => {
  it('returns true for paths containing /ppt/', () => {
    expect(isPptEndpoint('/api/ppt/generate')).toBe(true);
    expect(isPptEndpoint('/api/ppt/123')).toBe(true);
  });

  it('returns true for paths containing /presentation/', () => {
    expect(isPptEndpoint('/api/presentation/abc')).toBe(true);
    expect(isPptEndpoint('/presentation/edit')).toBe(true);
  });

  it('returns true for paths ending with /presentation', () => {
    expect(isPptEndpoint('/api/presentation')).toBe(true);
  });

  it('returns false for non-PPT paths', () => {
    expect(isPptEndpoint('/api/projects')).toBe(false);
    expect(isPptEndpoint('/api/projects/123/report')).toBe(false);
    expect(isPptEndpoint('/api/auth/login')).toBe(false);
    expect(isPptEndpoint('/api/export/pdf')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(isPptEndpoint('/API/PPT/generate')).toBe(true);
    expect(isPptEndpoint('/Api/Presentation/abc')).toBe(true);
  });
});

describe('handleServiceDegradation', () => {
  it('allows all requests when service is available', () => {
    const result = handleServiceDegradation('/api/ppt/generate', true);
    expect(result).toEqual({ allowed: true });
  });

  it('blocks PPT endpoints when service is unavailable', () => {
    const result = handleServiceDegradation('/api/ppt/generate', false);
    expect(result).toEqual({
      allowed: false,
      status: 503,
      message: 'PPT generation service is temporarily unavailable. Please try again later.',
    });
  });

  it('allows non-PPT endpoints when service is unavailable', () => {
    const result = handleServiceDegradation('/api/projects', false);
    expect(result).toEqual({ allowed: true });
  });

  it('blocks presentation endpoints when service is unavailable', () => {
    const result = handleServiceDegradation('/api/presentation/123', false);
    expect(result).toEqual({
      allowed: false,
      status: 503,
      message: 'PPT generation service is temporarily unavailable. Please try again later.',
    });
  });
});

describe('calculateBackoffDelay', () => {
  it('returns baseDelay * 2^attempt', () => {
    expect(calculateBackoffDelay(0, 1000)).toBe(1000);
    expect(calculateBackoffDelay(1, 1000)).toBe(2000);
    expect(calculateBackoffDelay(2, 1000)).toBe(4000);
  });

  it('works with different base delays', () => {
    expect(calculateBackoffDelay(0, 500)).toBe(500);
    expect(calculateBackoffDelay(1, 500)).toBe(1000);
    expect(calculateBackoffDelay(2, 500)).toBe(2000);
  });
});

describe('PresentonClient', () => {
  let mockFetch: ReturnType<typeof vi.fn>;
  let mockSleep: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    mockSleep = vi.fn().mockResolvedValue(undefined);
    resetPresentonClient();
  });

  afterEach(() => {
    resetPresentonClient();
  });

  function createClient(options?: { baseUrl?: string; apiKey?: string }) {
    return new PresentonClient({
      baseUrl: options?.baseUrl ?? 'http://localhost:8000',
      apiKey: options?.apiKey ?? 'test-api-key',
      fetchFn: mockFetch as unknown as typeof fetch,
      sleepFn: mockSleep,
    });
  }

  describe('constructor', () => {
    it('uses provided baseUrl and apiKey', () => {
      const client = createClient({ baseUrl: 'http://custom:9000', apiKey: 'my-key' });
      expect(client.isAvailable).toBe(true);
    });

    it('defaults isAvailable to true', () => {
      const client = createClient();
      expect(client.isAvailable).toBe(true);
    });
  });

  describe('checkHealth', () => {
    it('marks service as available on successful health check', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ status: 'ok' }) });
      const client = createClient();
      const result = await client.checkHealth();
      expect(result).toBe(true);
      expect(client.isAvailable).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/v1/health',
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('marks service as unavailable on failed health check', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500 });
      const client = createClient();
      const result = await client.checkHealth();
      expect(result).toBe(false);
      expect(client.isAvailable).toBe(false);
    });

    it('marks service as unavailable on network error', async () => {
      mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));
      const client = createClient();
      const result = await client.checkHealth();
      expect(result).toBe(false);
      expect(client.isAvailable).toBe(false);
    });

    it('sends X-API-Key header', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ status: 'ok' }) });
      const client = createClient({ apiKey: 'secret-key' });
      await client.checkHealth();
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: { 'X-API-Key': 'secret-key' },
        })
      );
    });
  });

  describe('generatePresentation', () => {
    it('sends POST request with correct body and headers', async () => {
      const mockResponse = { presentation_id: 'abc-123', path: '/app_data/presentations/abc.pptx' };
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(mockResponse) });

      const client = createClient();
      const result = await client.generatePresentation({
        content: 'Test content',
        n_slides: 10,
        language: 'en',
      });

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/v1/ppt/presentation/generate',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'X-API-Key': 'test-api-key',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ content: 'Test content', n_slides: 10, language: 'en' }),
        })
      );
    });

    it('retries on server error with exponential backoff', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Internal Server Error' })
        .mockResolvedValueOnce({ ok: false, status: 502, statusText: 'Bad Gateway' })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ presentation_id: 'x', path: '/p' }) });

      const client = createClient();
      const result = await client.generatePresentation({ content: 'test' });

      expect(result).toEqual({ presentation_id: 'x', path: '/p' });
      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(mockSleep).toHaveBeenCalledTimes(2);
      expect(mockSleep).toHaveBeenNthCalledWith(1, 1000); // 1000 * 2^0
      expect(mockSleep).toHaveBeenNthCalledWith(2, 2000); // 1000 * 2^1
    });

    it('marks service unavailable after all retries exhausted', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500, statusText: 'Internal Server Error' });

      const client = createClient();
      await expect(client.generatePresentation({ content: 'test' })).rejects.toThrow(
        'Presenton API error: 500 Internal Server Error'
      );

      expect(client.isAvailable).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(mockSleep).toHaveBeenCalledTimes(2);
    });

    it('does not retry on 4xx client errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: () => Promise.resolve('Invalid request body'),
      });

      const client = createClient();
      await expect(client.generatePresentation({ content: '' })).rejects.toThrow(
        'Presenton API error: 400 Bad Request - Invalid request body'
      );

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockSleep).not.toHaveBeenCalled();
    });

    it('retries on network errors', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ presentation_id: 'y', path: '/q' }) });

      const client = createClient();
      const result = await client.generatePresentation({ content: 'test' });

      expect(result).toEqual({ presentation_id: 'y', path: '/q' });
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockSleep).toHaveBeenCalledWith(1000);
    });

    it('marks service available on successful response after previous failure', async () => {
      const client = createClient();

      // First call fails all retries
      mockFetch.mockResolvedValue({ ok: false, status: 500, statusText: 'Error' });
      await expect(client.generatePresentation({ content: 'test' })).rejects.toThrow();
      expect(client.isAvailable).toBe(false);

      // Second call succeeds
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ presentation_id: 'z', path: '/r' }) });
      const result = await client.generatePresentation({ content: 'test' });
      expect(result).toEqual({ presentation_id: 'z', path: '/r' });
      expect(client.isAvailable).toBe(true);
    });
  });

  describe('getPresentation', () => {
    it('sends GET request with correct URL and headers', async () => {
      const mockDetail = { id: 'abc', title: 'Test', slides: [], theme: {}, template: 'general', created_at: '', updated_at: '' };
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(mockDetail) });

      const client = createClient();
      const result = await client.getPresentation('abc');

      expect(result).toEqual(mockDetail);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/v1/ppt/presentation/abc',
        expect.objectContaining({
          method: 'GET',
          headers: { 'X-API-Key': 'test-api-key' },
        })
      );
    });
  });

  describe('getDownloadUrl', () => {
    it('constructs URL from relative path', () => {
      const client = createClient();
      expect(client.getDownloadUrl('/app_data/presentations/abc.pptx'))
        .toBe('http://localhost:8000/app_data/presentations/abc.pptx');
    });

    it('constructs URL from path without leading slash', () => {
      const client = createClient();
      expect(client.getDownloadUrl('app_data/presentations/abc.pptx'))
        .toBe('http://localhost:8000/app_data/presentations/abc.pptx');
    });

    it('returns absolute URLs as-is', () => {
      const client = createClient();
      expect(client.getDownloadUrl('https://cdn.example.com/file.pptx'))
        .toBe('https://cdn.example.com/file.pptx');
    });
  });

  describe('health check polling', () => {
    it('starts and stops polling', () => {
      vi.useFakeTimers();
      mockFetch.mockResolvedValue({ ok: true });

      const client = createClient();
      client.startHealthCheckPolling(5000);

      // Advance time to trigger one poll
      vi.advanceTimersByTime(5000);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Advance again
      vi.advanceTimersByTime(5000);
      expect(mockFetch).toHaveBeenCalledTimes(2);

      // Stop polling
      client.stopHealthCheckPolling();
      vi.advanceTimersByTime(10000);
      expect(mockFetch).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });

    it('restarts polling when called again', () => {
      vi.useFakeTimers();
      mockFetch.mockResolvedValue({ ok: true });

      const client = createClient();
      client.startHealthCheckPolling(5000);
      client.startHealthCheckPolling(10000); // Restart with different interval

      vi.advanceTimersByTime(5000);
      expect(mockFetch).toHaveBeenCalledTimes(0); // Old interval cleared

      vi.advanceTimersByTime(5000);
      expect(mockFetch).toHaveBeenCalledTimes(1); // New 10s interval fires

      client.stopHealthCheckPolling();
      vi.useRealTimers();
    });
  });
});
