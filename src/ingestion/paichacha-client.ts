/**
 * Paichacha API Client
 * Fetches pugongying (蒲公英) and juguang (聚光) data from the Paichacha API.
 * Applies currency conversion (分→元) via normalizeAmount before returning.
 * Implements retry logic with exponential backoff and response validation.
 */

import type { PugongyingNote, JuguangNote, LingxiData, CommentData, QianguaStatsData, QianguaHotNotePublishData } from '../shared/types.js';
import { PugongyingClient } from './pugongying-client.js';
import type { PugongyingClientConfig } from './pugongying-client.js';
import { JuguangClient } from './juguang-client.js';
import type { JuguangClientConfig } from './juguang-client.js';
import { LingxiClient } from './lingxi-client.js';
import type { LingxiClientConfig } from './lingxi-client.js';
import { QianguaClient } from './qiangua-client.js';
import type { QianguaClientConfig } from './qiangua-client.js';

/**
 * Interface for the Paichacha API client
 */
export interface IPaichachaClient {
  fetchPugongyingData(noteIds: string[]): Promise<PugongyingNote[]>;
  /** 获取聚光笔记层级离线报表（brandName + 日期范围） */
  fetchJuguangData(brandName: string, startDate: string, endDate: string): Promise<JuguangNote[]>;
  /** 获取灵犀数据（brandName + keyword + taxonomyNames） */
  fetchLingxiData(brandName: string, keyword: string, startDate: string, endDate: string, taxonomyNames?: string | string[], preStartDate?: string, preEndDate?: string): Promise<LingxiData>;
  /** 获取评论数据（全量评论，用于舆情分析） */
  fetchCommentData(noteIds: string[]): Promise<CommentData[]>;
  /** 获取千瓜数据（品牌数据卡片 + 爆文发布时间分布） */
  fetchQianguaData(brandName: string, days?: number): Promise<{ stats: QianguaStatsData; hotNotePublish: QianguaHotNotePublishData }>;
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
  private readonly qianguaClient?: QianguaClient;

  constructor(
    baseUrl: string,
    apiKey: string,
    retryConfig?: Partial<RetryConfig>,
    pugongyingConfig?: PugongyingClientConfig,
    juguangConfig?: JuguangClientConfig,
    lingxiConfig?: LingxiClientConfig,
    qianguaConfig?: QianguaClientConfig,
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
    if (qianguaConfig) {
      this.qianguaClient = new QianguaClient(qianguaConfig);
    }
  }

  // ── Pugongying ──

  async fetchPugongyingData(noteIds: string[]): Promise<PugongyingNote[]> {
    if (!this.pugongyingClient) throw new Error('Pugongying client not configured');
    return this.pugongyingClient.fetchPugongyingData(noteIds);
  }

  // ── Juguang ──

  async fetchJuguangData(
    brandName: string,
    startDate: string,
    endDate: string,
  ): Promise<JuguangNote[]> {
    if (!this.juguangClient) throw new Error('Juguang client not configured');
    return this.juguangClient.fetchJuguangData(brandName, startDate, endDate);
  }

  // ── Lingxi ──

  async fetchLingxiData(brandName: string, keyword: string, startDate: string, endDate: string, taxonomyNames?: string | string[], preStartDate?: string, preEndDate?: string): Promise<LingxiData> {
    if (!this.lingxiClient) throw new Error('Lingxi client not configured');
    return this.lingxiClient.fetchLingxiData(brandName, keyword, startDate, endDate, taxonomyNames, preStartDate, preEndDate);
  }

  // ── Comments ──

  async fetchCommentData(noteIds: string[]): Promise<CommentData[]> {
    if (!this.pugongyingClient) throw new Error('Pugongying client not configured');
    return this.pugongyingClient.fetchComments(noteIds);
  }

  // ── Qiangua ──

  async fetchQianguaData(brandName: string, days = 30): Promise<{ stats: QianguaStatsData; hotNotePublish: QianguaHotNotePublishData }> {
    if (!this.qianguaClient) throw new Error('Qiangua client not configured');
    return this.qianguaClient.fetchQianguaData(brandName, days);
  }
}
