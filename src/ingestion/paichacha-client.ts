/**
 * Paichacha API Client
 * Fetches pugongying (蒲公英) and juguang (聚光) data from the Paichacha API.
 * Applies currency conversion (分→元) via normalizeAmount before returning.
 * Implements retry logic with exponential backoff and response validation.
 */

import type { PugongyingNote, JuguangNote, LingxiData, CommentData } from '../shared/types.js';
import { PugongyingClient } from './pugongying-client.js';
import type { PugongyingClientConfig } from './pugongying-client.js';
import { JuguangClient } from './juguang-client.js';
import type { JuguangClientConfig } from './juguang-client.js';
import { LingxiClient } from './lingxi-client.js';
import type { LingxiClientConfig } from './lingxi-client.js';

/**
 * Interface for the Paichacha API client
 */
export interface IPaichachaClient {
  fetchPugongyingData(noteIds: string[]): Promise<PugongyingNote[]>;
  /** 获取聚光笔记层级离线报表（advertiserId + 日期范围，替代旧的 noteIds 模式） */
  fetchJuguangData(advertiserId: number, startDate: string, endDate: string): Promise<JuguangNote[]>;
  /** 获取灵犀数据（brandName + keyword，Phase 1 写死） */
  fetchLingxiData(brandName: string, keyword: string): Promise<LingxiData>;
  /** 获取评论数据（全量评论，用于舆情分析） */
  fetchCommentData(noteIds: string[]): Promise<CommentData[]>;
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
  private readonly lingxiClient?: LingxiClient;

  constructor(
    baseUrl: string,
    apiKey: string,
    retryConfig?: Partial<RetryConfig>,
    pugongyingConfig?: PugongyingClientConfig,
    juguangConfig?: JuguangClientConfig,
    lingxiConfig?: LingxiClientConfig,
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.apiKey = apiKey;
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
    if (pugongyingConfig) {
      this.pugongyingClient = new PugongyingClient(pugongyingConfig);
    }
    if (juguangConfig) {
      this.juguangClient = new JuguangClient(juguangConfig);
    }
    if (lingxiConfig) {
      this.lingxiClient = new LingxiClient(lingxiConfig);
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

  // ── Lingxi ──

  async fetchLingxiData(brandName: string, keyword: string): Promise<LingxiData> {
    if (!this.lingxiClient) throw new Error('Lingxi client not configured');
    return this.lingxiClient.fetchLingxiData(brandName, keyword);
  }

  // ── Comments ──

  async fetchCommentData(noteIds: string[]): Promise<CommentData[]> {
    if (!this.pugongyingClient) throw new Error('Pugongying client not configured');
    return this.pugongyingClient.fetchComments(noteIds);
  }
}
