/**
 * Paichacha API Client
 * Fetches pugongying (蒲公英) and juguang (聚光) data from the Paichacha API.
 * Applies currency conversion (分→元) via normalizeAmount before returning.
 * Implements retry logic with exponential backoff and response validation.
 */

import type { PugongyingNote, JuguangNote } from '../shared/types.js';
import { PugongyingClient } from './pugongying-client.js';
import type { PugongyingClientConfig } from './pugongying-client.js';
import { JuguangClient } from './juguang-client.js';
import type { JuguangClientConfig } from './juguang-client.js';

/**
 * Interface for the Paichacha API client
 */
export interface IPaichachaClient {
  fetchPugongyingData(noteIds: string[]): Promise<PugongyingNote[]>;
  /** 获取聚光笔记层级离线报表（advertiserId + 日期范围，替代旧的 noteIds 模式） */
  fetchJuguangData(advertiserId: number, startDate: string, endDate: string): Promise<JuguangNote[]>;
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

export class PaichachaClient implements IPaichachaClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly retryConfig: RetryConfig;
  private readonly pugongyingClient?: PugongyingClient;
  private readonly juguangClient?: JuguangClient;

  constructor(
    baseUrl: string,
    apiKey: string,
    retryConfig?: Partial<RetryConfig>,
    pugongyingConfig?: PugongyingClientConfig,
    juguangConfig?: JuguangClientConfig,
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, ''); // Remove trailing slashes
    this.apiKey = apiKey;
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
    if (pugongyingConfig) {
      this.pugongyingClient = new PugongyingClient(pugongyingConfig);
    }
    if (juguangConfig) {
      this.juguangClient = new JuguangClient(juguangConfig);
    }
  }

  // ── Pugongying ──

  async fetchPugongyingData(noteIds: string[]): Promise<PugongyingNote[]> {
    if (!this.pugongyingClient) throw new Error('Pugongying client not configured');
    return this.pugongyingClient.fetchPugongyingData(noteIds);
  }

  // ── Juguang ──

  async fetchJuguangData(
    advertiserId: number,
    startDate: string,
    endDate: string,
  ): Promise<JuguangNote[]> {
    if (!this.juguangClient) throw new Error('Juguang client not configured');
    return this.juguangClient.fetchJuguangData(advertiserId, startDate, endDate);
  }
}
