/**
 * Presenton Backend API Client
 *
 * Provides service-to-service communication with the Presenton FastAPI backend.
 * Implements:
 * - API key authentication via X-API-Key header
 * - Retry with exponential backoff (max 3 attempts)
 * - Health check polling (every 30 seconds)
 * - Circuit breaker pattern: returns 503 for PPT endpoints when service is unavailable
 */

// --- Types ---

export interface GenerateRequest {
  content: string;
  n_slides?: number;
  language?: string;
  template?: string;
  tone?: string;
  verbosity?: string;
  instructions?: string;
  include_title_slide?: boolean;
  export_as?: string;
}

export interface PresentationResponse {
  presentation_id: string;
  path: string;
}

export interface PresentationDetail {
  id: string;
  title: string;
  slides: unknown[];
  theme: unknown;
  template: string;
  created_at: string;
  updated_at: string;
}

export interface HealthCheckResponse {
  status: string;
}

export type ServiceDegradationResult =
  | { allowed: true }
  | { allowed: false; status: 503; message: string };

// --- Helper Functions ---

/**
 * Determines if a request path is PPT-related.
 * PPT endpoints include any path containing /ppt/ or /presentation/.
 */
export function isPptEndpoint(path: string): boolean {
  const normalizedPath = path.toLowerCase();
  return normalizedPath.includes('/ppt/') ||
    normalizedPath.includes('/ppt') && normalizedPath.endsWith('/ppt') ||
    normalizedPath.includes('/presentation/') ||
    normalizedPath.endsWith('/presentation');
}

/**
 * Handles service degradation by checking if the request should be blocked
 * when Presenton is unavailable.
 *
 * - PPT endpoints return 503 when service is down
 * - Non-PPT endpoints are allowed through regardless of service status
 */
export function handleServiceDegradation(
  path: string,
  isServiceAvailable: boolean
): ServiceDegradationResult {
  if (isServiceAvailable) {
    return { allowed: true };
  }

  if (isPptEndpoint(path)) {
    return {
      allowed: false,
      status: 503,
      message: 'PPT generation service is temporarily unavailable. Please try again later.',
    };
  }

  return { allowed: true };
}

// --- Retry Logic ---

export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  baseDelayMs: 1000,
};

/**
 * Calculates the delay for a given retry attempt using exponential backoff.
 * delay = baseDelayMs * 2^attempt (0-indexed)
 * Attempt 0: 1000ms, Attempt 1: 2000ms, Attempt 2: 4000ms
 */
export function calculateBackoffDelay(attempt: number, baseDelayMs: number): number {
  return baseDelayMs * Math.pow(2, attempt);
}

/**
 * Sleeps for the specified duration. Extracted for testability.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- PresentonClient Class ---

export class PresentonClient {
  private baseUrl: string;
  private apiKey: string;
  private _isAvailable: boolean = true;
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;
  private retryOptions: RetryOptions;
  private sleepFn: (ms: number) => Promise<void>;
  private fetchFn: typeof fetch;

  constructor(options?: {
    baseUrl?: string;
    apiKey?: string;
    retryOptions?: Partial<RetryOptions>;
    sleepFn?: (ms: number) => Promise<void>;
    fetchFn?: typeof fetch;
  }) {
    this.baseUrl = options?.baseUrl ?? process.env.PRESENTON_API_URL ?? 'http://presenton-backend:8000';
    this.apiKey = options?.apiKey ?? process.env.PRESENTON_API_KEY ?? '';
    this.retryOptions = { ...DEFAULT_RETRY_OPTIONS, ...options?.retryOptions };
    this.sleepFn = options?.sleepFn ?? sleep;
    this.fetchFn = options?.fetchFn ?? fetch;
  }

  get isAvailable(): boolean {
    return this._isAvailable;
  }

  /**
   * Starts health check polling at the specified interval (default 30s).
   */
  startHealthCheckPolling(intervalMs: number = 30_000): void {
    this.stopHealthCheckPolling();
    this.healthCheckInterval = setInterval(async () => {
      await this.checkHealth();
    }, intervalMs);
  }

  /**
   * Stops health check polling.
   */
  stopHealthCheckPolling(): void {
    if (this.healthCheckInterval !== null) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Checks the health of the Presenton backend by calling GET /api/v1/health.
   * Updates the internal availability state.
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await this.fetchFn(`${this.baseUrl}/api/v1/health`, {
        method: 'GET',
        headers: this.getHeaders(),
      });
      this._isAvailable = response.ok;
      return this._isAvailable;
    } catch {
      this._isAvailable = false;
      return false;
    }
  }

  /**
   * Generates a presentation via the Presenton API.
   * Retries with exponential backoff on failure.
   */
  async generatePresentation(request: GenerateRequest): Promise<PresentationResponse> {
    return this.requestWithRetry<PresentationResponse>(
      `${this.baseUrl}/api/v1/ppt/presentation/generate`,
      {
        method: 'POST',
        headers: {
          ...this.getHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      }
    );
  }

  /**
   * Gets presentation details by ID.
   * Retries with exponential backoff on failure.
   */
  async getPresentation(id: string): Promise<PresentationDetail> {
    return this.requestWithRetry<PresentationDetail>(
      `${this.baseUrl}/api/v1/ppt/presentation/${id}`,
      {
        method: 'GET',
        headers: this.getHeaders(),
      }
    );
  }

  /**
   * Constructs the download URL for a given file path.
   */
  getDownloadUrl(path: string): string {
    // If path is already absolute URL, return as-is
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }
    // Otherwise construct from base URL
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${this.baseUrl}${cleanPath}`;
  }

  // --- Private Methods ---

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    if (this.apiKey) {
      headers['X-API-Key'] = this.apiKey;
    }
    return headers;
  }

  /**
   * Executes a fetch request with retry and exponential backoff.
   * After all retries are exhausted, marks the service as unavailable.
   */
  private async requestWithRetry<T>(url: string, init: RequestInit): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.retryOptions.maxAttempts; attempt++) {
      try {
        const response = await this.fetchFn(url, init);

        if (response.ok) {
          // Successful response - ensure service is marked available
          this._isAvailable = true;
          return (await response.json()) as T;
        }

        // Non-retryable client errors (4xx except 429)
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          const errorBody = await response.text().catch(() => '');
          throw new Error(
            `Presenton API error: ${response.status} ${response.statusText}${errorBody ? ` - ${errorBody}` : ''}`
          );
        }

        // Server error or rate limit - will retry
        lastError = new Error(`Presenton API error: ${response.status} ${response.statusText}`);
      } catch (error) {
        if (error instanceof Error && error.message.startsWith('Presenton API error: 4')) {
          // Don't retry client errors
          throw error;
        }
        lastError = error instanceof Error ? error : new Error(String(error));
      }

      // Wait before retrying (except after the last attempt)
      if (attempt < this.retryOptions.maxAttempts - 1) {
        const delay = calculateBackoffDelay(attempt, this.retryOptions.baseDelayMs);
        await this.sleepFn(delay);
      }
    }

    // All retries exhausted - mark service as unavailable
    this._isAvailable = false;
    throw lastError ?? new Error('Presenton API request failed after all retries');
  }
}

// --- Singleton Instance ---

let _instance: PresentonClient | null = null;

/**
 * Returns the singleton PresentonClient instance.
 */
export function getPresentonClient(): PresentonClient {
  if (!_instance) {
    _instance = new PresentonClient();
  }
  return _instance;
}

/**
 * Resets the singleton instance (useful for testing).
 */
export function resetPresentonClient(): void {
  if (_instance) {
    _instance.stopHealthCheckPolling();
  }
  _instance = null;
}
