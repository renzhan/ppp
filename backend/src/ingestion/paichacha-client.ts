/**
 * Paichacha API Client
 * Fetches pugongying (蒲公英) and juguang (聚光) data from the Paichacha API.
 * Applies currency conversion (分→元) via normalizeAmount before returning.
 * Implements retry logic with exponential backoff and response validation.
 */

import type { PugongyingNote, JuguangNote } from '../shared/types.js';
import { normalizeAmount } from './currency.js';

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
 * Raw pugongying note data as returned by the API (amounts in 分)
 */
interface RawPugongyingNote {
  note_id: string;
  brand_user_name: string;
  spu_name: string;
  kol_nick_name: string;
  kol_id: string;
  kol_fan_num: number;
  note_type: 'image' | 'video';
  note_link: string;
  imp_num: number;
  read_num: number;
  engage_num: number;
  like_num: number;
  fav_num: number;
  cmt_num: number;
  share_num: number;
  follow_num?: number;            // 关注量 (API可能不返回)
  kol_price: number;              // 分
  service_fee: number;            // 元 (already in yuan from API)
  total_platform_price: number;   // 分
  heat_imp_num: number;
  heat_read_num: number;
  is_underwater: boolean;
  underwater_price: number;       // 元
  components?: Array<{
    component_type: string;
    impressions: number;
    clicks: number;
    conversions: number;
  }>;
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

  constructor(baseUrl: string, apiKey: string, retryConfig?: Partial<RetryConfig>) {
    this.baseUrl = baseUrl.replace(/\/+$/, ''); // Remove trailing slashes
    this.apiKey = apiKey;
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
  }

  /**
   * Fetch pugongying (蒲公英) platform data for given note IDs.
   * Applies normalizeAmount to kol_price and total_platform_price fields.
   */
  async fetchPugongyingData(noteIds: string[]): Promise<PugongyingNote[]> {
    if (noteIds.length === 0) {
      return [];
    }

    const response = await this.requestWithRetry<RawPugongyingNote[]>(
      '/api/pugongying/notes',
      { note_ids: noteIds }
    );

    return response.map((raw) => this.transformPugongyingNote(raw));
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
      { note_ids: noteIds }
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

  /**
   * Transform raw pugongying API response to PugongyingNote.
   * Applies normalizeAmount to kol_price and total_platform_price.
   */
  private transformPugongyingNote(raw: RawPugongyingNote): PugongyingNote {
    this.validatePugongyingNote(raw);

    return {
      noteId: raw.note_id,
      brandUserName: raw.brand_user_name,
      spuName: raw.spu_name,
      kolNickName: raw.kol_nick_name,
      kolId: raw.kol_id,
      kolFanNum: raw.kol_fan_num,
      noteType: raw.note_type,
      noteLink: raw.note_link,
      impNum: raw.imp_num,
      readNum: raw.read_num,
      engageNum: raw.engage_num,
      likeNum: raw.like_num,
      favNum: raw.fav_num,
      cmtNum: raw.cmt_num,
      shareNum: raw.share_num,
      followNum: raw.follow_num ?? 0,
      kolPrice: normalizeAmount(raw.kol_price),
      serviceFee: raw.service_fee,
      totalPlatformPrice: normalizeAmount(raw.total_platform_price),
      heatImpNum: raw.heat_imp_num,
      heatReadNum: raw.heat_read_num,
      isUnderwater: raw.is_underwater,
      underwaterPrice: raw.underwater_price,
      components: raw.components?.map((c) => ({
        componentType: c.component_type,
        impressions: c.impressions,
        clicks: c.clicks,
        conversions: c.conversions,
      })),
    };
  }

  /**
   * Transform raw juguang API response to JuguangNote.
   * Applies normalizeAmount to fee field.
   */
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

  /**
   * Validate a raw pugongying note has required fields and correct types.
   */
  private validatePugongyingNote(raw: unknown): asserts raw is RawPugongyingNote {
    if (!raw || typeof raw !== 'object') {
      throw new PaichachaValidationError('Invalid pugongying note: expected an object');
    }

    const note = raw as Record<string, unknown>;

    const requiredStringFields = ['note_id', 'kol_id', 'note_type'];
    for (const field of requiredStringFields) {
      if (typeof note[field] !== 'string' || (note[field] as string).trim() === '') {
        throw new PaichachaValidationError(`Invalid pugongying note: missing or empty required field "${field}"`);
      }
    }

    if (note['note_type'] !== 'image' && note['note_type'] !== 'video') {
      throw new PaichachaValidationError(`Invalid pugongying note: note_type must be "image" or "video", got "${note['note_type']}"`);
    }

    const requiredNumericFields = [
      'kol_fan_num', 'imp_num', 'read_num', 'engage_num',
      'like_num', 'fav_num', 'cmt_num', 'share_num',
      'kol_price', 'total_platform_price', 'heat_imp_num', 'heat_read_num',
    ];
    for (const field of requiredNumericFields) {
      if (typeof note[field] !== 'number' || Number.isNaN(note[field])) {
        throw new PaichachaValidationError(`Invalid pugongying note: field "${field}" must be a number`);
      }
    }

    // kol_price and total_platform_price must be non-negative integers (in 分)
    if (!Number.isInteger(note['kol_price']) || (note['kol_price'] as number) < 0) {
      throw new PaichachaValidationError('Invalid pugongying note: kol_price must be a non-negative integer (in fen)');
    }
    if (!Number.isInteger(note['total_platform_price']) || (note['total_platform_price'] as number) < 0) {
      throw new PaichachaValidationError('Invalid pugongying note: total_platform_price must be a non-negative integer (in fen)');
    }

    if (typeof note['is_underwater'] !== 'boolean') {
      throw new PaichachaValidationError('Invalid pugongying note: is_underwater must be a boolean');
    }
  }

  /**
   * Validate a raw juguang note has required fields and correct types.
   */
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
