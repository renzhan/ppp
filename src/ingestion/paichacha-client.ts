/**
 * Paichacha API Client
 * Fetches pugongying (蒲公英) and juguang (聚光) data from the Paichacha API.
 * Applies currency conversion (分→元) via normalizeAmount before returning.
 * Implements retry logic with exponential backoff and response validation.
 */

import type { PugongyingNote, JuguangNote } from '../shared/types.js';
import { normalizeAmount } from './currency.js';
import { PugongyingClient } from './pugongying-client.js';
import type { PugongyingClientConfig } from './pugongying-client.js';

/**
 * Interface for the Paichacha API client
 */
export interface IPaichachaClient {
  fetchPugongyingData(noteIds: string[]): Promise<PugongyingNote[]>;
  fetchJuguangData(noteIds: string[]): Promise<JuguangNote[]>;
}

/**
 * Configuration for retry behavior
 */
interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
};

/**
 * Error class for validation failures (should not be retried)
 */
export class PaichachaValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaichachaValidationError';
  }
}

/**
 * Raw juguang note data as returned by the API (fee in 分)
 */
interface RawJuguangNote {
  note_id?: string;
  fee: number;                    // 分
  impression: number;
  click: number;
  interaction: number;
  i_user_num: number;
  ti_user_num: number;
  i_user_price: number;
  ti_user_price: number;
  search_cmt_click: number;
  search_cmt_after_read: number;
  search_cmt_after_read_avg: number;
  search_cmt_click_cvr: number;
}

/**
 * Paichacha API client implementation
 */
export class PaichachaClient implements IPaichachaClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly retryConfig: RetryConfig;
  private readonly pugongyingClient?: PugongyingClient;

  constructor(
    baseUrl: string,
    apiKey: string,
    retryConfig?: Partial<RetryConfig>,
    pugongyingConfig?: PugongyingClientConfig,
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, ''); // Remove trailing slashes
    this.apiKey = apiKey;
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
    if (pugongyingConfig) {
      this.pugongyingClient = new PugongyingClient(pugongyingConfig);
    }
  }

  async fetchPugongyingData(noteIds: string[]): Promise<PugongyingNote[]> {
    if (!this.pugongyingClient) throw new Error('Pugongying client not configured');
    return this.pugongyingClient.fetchPugongyingData(noteIds);
  }

  /**
   * Fetch juguang (聚光) platform data for given note IDs.
   * Applies normalizeAmount to fee field.
   */
  async fetchJuguangData(noteIds: string[]): Promise<JuguangNote[]> {
    if (noteIds.length === 0) {
      return [];
    }

    const response = await this.requestWithRetry<RawJuguangNote[]>(
      '/api/juguang/notes',
      { note_ids: noteIds },
    );
    return response.map((raw) => this.transformJuguangNote(raw));
  }

  /**
   * Make an HTTP request with retry logic (exponential backoff).
   * Only retries on transient errors (network failures, HTTP 5xx).
   * Validation errors are thrown immediately without retry.
   */
  private async requestWithRetry<T>(endpoint: string, body: unknown): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        const result = await this.makeRequest<T>(endpoint, body);
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry validation errors — they won't succeed on retry
        if (lastError instanceof PaichachaValidationError) {
          throw lastError;
        }

        if (attempt < this.retryConfig.maxRetries) {
          const delay = this.retryConfig.baseDelayMs * Math.pow(2, attempt);
          await this.sleep(delay);
        }
      }
    }

    throw new Error(
      `Paichacha API request to ${endpoint} failed after ${this.retryConfig.maxRetries + 1} attempts. ` +
      `Last error: ${lastError?.message ?? 'Unknown error'}`
    );
  }

  /**
   * Make a single HTTP request to the Paichacha API.
   */
  private async makeRequest<T>(endpoint: string, body: unknown): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(
        `Paichacha API returned HTTP ${response.status}: ${response.statusText}`
      );
    }

    const data = await response.json();

    if (!data || typeof data !== 'object') {
      throw new PaichachaValidationError(
        'Paichacha API returned invalid response: expected JSON object'
      );
    }

    // The API wraps results in a `data` field
    const result = (data as Record<string, unknown>).data ?? data;

    if (!Array.isArray(result)) {
      throw new PaichachaValidationError(
        'Paichacha API returned invalid response: expected array of records'
      );
    }

    return result as T;
  }

  private transformJuguangNote(raw: RawJuguangNote): JuguangNote {
    this.validateJuguangNote(raw);
    return {
      noteId: raw.note_id,
      fee: normalizeAmount(raw.fee),
      impression: raw.impression,
      click: raw.click,
      interaction: raw.interaction,
      iUserNum: raw.i_user_num,
      tiUserNum: raw.ti_user_num,
      iUserPrice: raw.i_user_price,
      tiUserPrice: raw.ti_user_price,
      searchCmtClick: raw.search_cmt_click,
      searchCmtAfterRead: raw.search_cmt_after_read,
      searchCmtAfterReadAvg: raw.search_cmt_after_read_avg,
      searchCmtClickCvr: raw.search_cmt_click_cvr,
    };
  }

  private validateJuguangNote(raw: unknown): asserts raw is RawJuguangNote {
    if (!raw || typeof raw !== 'object') {
      throw new PaichachaValidationError('Invalid juguang note: expected an object');
    }

    const note = raw as Record<string, unknown>;

    // fee must be a non-negative integer (in 分)
    if (typeof note['fee'] !== 'number' || Number.isNaN(note['fee'])) {
      throw new PaichachaValidationError('Invalid juguang note: fee must be a number');
    }
    if (!Number.isInteger(note['fee']) || (note['fee'] as number) < 0) {
      throw new PaichachaValidationError('Invalid juguang note: fee must be a non-negative integer (in fen)');
    }

    const requiredNumericFields = [
      'impression', 'click', 'interaction',
      'i_user_num', 'ti_user_num', 'i_user_price', 'ti_user_price',
      'search_cmt_click', 'search_cmt_after_read',
      'search_cmt_after_read_avg', 'search_cmt_click_cvr',
    ];
    for (const field of requiredNumericFields) {
      if (typeof note[field] !== 'number' || Number.isNaN(note[field])) {
        throw new PaichachaValidationError(`Invalid juguang note: field "${field}" must be a number`);
      }
    }
  }

  /**
   * Sleep for the specified duration (used for retry backoff).
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
