/**
 * Qiangua API Client — 千瓜平台数据采集
 *
 * Phase 1: stats_compare（品牌数据卡片）+ hot_note_publish_distribution（爆文发布时间分布）
 */

import type { QianguaStatsData, QianguaHotNotePublishData } from '../shared/types.js';

// ── Config ──

export interface QianguaClientConfig {
  baseUrl: string;
  apiKey: string;
}

// ── Constants ──

const MAX_RETRIES = 2;

// ── Raw types ──

interface StatsCompareResponse {
  code: number;
  data?: {
    Current?: Record<string, number>;
    Last?: Record<string, number>;
    Change?: Record<string, number>;
  };
}

interface HotNotePublishResponse {
  code: number;
  data?: {
    week?: Array<{ TimeIdentificationText?: string; HotNoteCount?: number; LowFansHotNoteCount?: number; LowFansHotNoteRate?: number }>;
    hour?: Array<{ TimeIdentificationText?: string; HotNoteCount?: number; LowFansHotNoteCount?: number; LowFansHotNoteRate?: number }>;
  };
}

// ── Client ──

export class QianguaClient {
  constructor(private config: QianguaClientConfig) {}

  async fetchQianguaData(brandName: string): Promise<{ stats: QianguaStatsData; hotNotePublish: QianguaHotNotePublishData }> {
    const [stats, hotNotePublish] = await Promise.all([
      this.fetchStatsCompare(brandName),
      this.fetchHotNotePublishDistribution(brandName),
    ]);
    return { stats, hotNotePublish };
  }

  // ── stats_compare ──

  private async fetchStatsCompare(brandName: string): Promise<QianguaStatsData> {
    const json = await this.callApi<StatsCompareResponse>('/api/qian_gua/stats_compare', {
      brand_name: brandName,
      params: { days: 30, brandsource: 0, notefeature: 0, hasgoods: false },
    });
    const d = json.data ?? {};
    return {
      current: d.Current ?? {},
      last: d.Last ?? {},
      change: d.Change ?? {},
      period: getPeriod(),
    };
  }

  // ── hot_note_publish_distribution ──

  private async fetchHotNotePublishDistribution(brandName: string): Promise<QianguaHotNotePublishData> {
    const json = await this.callApi<HotNotePublishResponse>('/api/qian_gua/hot_note_publish_distribution', {
      brand_name: brandName,
      params: { searchtype: 0 },
    });
    const d = json.data ?? {};
    return {
      week: (d.week ?? []).map(w => ({
        text: w.TimeIdentificationText ?? '',
        hotNoteCount: w.HotNoteCount ?? 0,
        lowFansHotNoteCount: w.LowFansHotNoteCount ?? 0,
        lowFansHotNoteRate: w.LowFansHotNoteRate ?? 0,
      })),
      hour: (d.hour ?? []).map(h => ({
        text: h.TimeIdentificationText ?? '',
        hotNoteCount: h.HotNoteCount ?? 0,
        lowFansHotNoteCount: h.LowFansHotNoteCount ?? 0,
        lowFansHotNoteRate: h.LowFansHotNoteRate ?? 0,
      })),
    };
  }

  // ── 通用调用 ──

  private async callApi<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
    return withRetry(async () => {
      const url = `${this.config.baseUrl}${endpoint}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': this.config.apiKey },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as T;
      return json;
    });
  }
}

// ── Helpers ──

function getPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

async function withRetry<T>(fn: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try { return await fn(); } catch (e) {
      if (attempt === retries) throw e;
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
    }
  }
  throw new Error('unreachable');
}
