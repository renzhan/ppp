/**
 * Lingxi API Client — 灵犀平台数据采集
 *
 * 单一入口 POST /api/task/start，通过 biz 切换业务模块。
 * Phase 1: keyword_trend（月搜索指数）+ asset_analyse（品牌AIPS/TI）。
 */

import type { BrandData, KeywordData, ScreenshotData, LingxiData } from '../shared/types.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

// ── Config ──

export interface LingxiClientConfig {
  baseUrl: string;
  apiKey: string;
  timeout?: number;  // 默认 120000
}

// ── Constants ──

const DEFAULT_TIMEOUT = 120_000;
const MAX_RETRIES = 2;

// ── Raw types ──

interface CapturedItem {
  url: string;
  method: string;
  status_code: number;
  data?: any;
}

interface LingxiTaskResponse {
  code: number;
  message?: string;
  data?: {
    task_id?: string;
    status?: string;
    captured?: CapturedItem[];
    screenshots?: Array<{ name: string; base64: string }>;
    screenshot_error?: string | null;
  };
}

// ── Client ──

export class LingxiClient {
  private timeout: number;

  constructor(private config: LingxiClientConfig) {
    this.timeout = config.timeout ?? DEFAULT_TIMEOUT;
  }

  // ── 统一入口 ──

  async fetchLingxiData(brandName: string, keyword: string): Promise<LingxiData> {
    const endDate = daysAgo(1);
    const startDate = oneMonthAgoPlusOne(endDate);

    const brand = await this.fetchBrandData(brandName, startDate, endDate);
    const kw = await this.fetchKeywordData(brandName, keyword, startDate, endDate);

    return { brand, keyword: [kw] };
  }

  // ── asset_analyse + move_analyse → 品牌数据 ──

  async fetchBrandData(brandName: string, startDate: string, endDate: string): Promise<BrandData> {
    const res = await this.callTask('asset_analyse', brandName, {});
    const captured = res.data?.captured ?? [];

    const aips = extractAips(captured);
    const ti = extractTi(captured);

    // 人流流转数据
    let moveData: Partial<BrandData> = {};
    try {
      const moveRes = await this.callTask('move_analyse', brandName, { startDate, endDate });
      const moveCaptured = moveRes.data?.captured ?? [];
      moveData = extractMoveAnalyseData(moveCaptured, startDate, endDate);
    } catch (e) {
      console.error(`[lingxi] move_analyse 失败: ${(e as Error).message}`);
    }

    return {
      aips,
      ti,
      period: getPeriod(),
      ...moveData,
    };
  }

  // ── keyword_trend → 月搜索指数 ──

  async fetchKeywordData(brandName: string, keyword: string, startDate: string, endDate: string): Promise<KeywordData> {
    const res = await this.callTask('keyword_trend', brandName, {
      trendKeyword: keyword,
      startTime: startDate,
      endTime: endDate,
    });
    const captured = res.data?.captured ?? [];

    const searchVolume = extractSum(captured, startDate, endDate);

    return { keyword, searchVolume, period: getPeriod() };
  }

  // ── 截图 ──

  async extractScreenshots(res: LingxiTaskResponse, projectId: string): Promise<ScreenshotData[]> {
    const screenshots = res.data?.screenshots ?? [];
    const result: ScreenshotData[] = [];
    const dir = path.resolve('web/public/screenshots', projectId);
    fs.mkdirSync(dir, { recursive: true });

    for (const ss of screenshots) {
      const safeName = ss.name.replace(/[^a-zA-Z0-9_一-龥-]/g, '_');
      const filePath = path.join(dir, `${safeName}.png`);
      fs.writeFileSync(filePath, Buffer.from(ss.base64, 'base64'));
      result.push({
        type: safeName,
        period: getPeriod(),
        filePath: `/screenshots/${projectId}/${safeName}.png`,
      });
    }

    return result;
  }

  // ── 通用调用 ──

  private async callTask(
    biz: string,
    brandName: string,
    params: Record<string, unknown>,
  ): Promise<LingxiTaskResponse> {
    return withRetry(async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeout);

      try {
        const url = `${this.config.baseUrl}/api/task/start`;
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': this.config.apiKey,
          },
          body: JSON.stringify({
            profile_id: 'default',
            biz,
            brand_name: brandName,
            params,
          }),
          signal: controller.signal,
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

        const json = await res.json() as LingxiTaskResponse;

        if (json.code !== 0) {
          throw new Error(`灵犀 API 错误: code=${json.code} message=${json.message}`);
        }

        return json;
      } finally {
        clearTimeout(timer);
      }
    });
  }
}

// ── Field extraction ──

/** chartview/2006 → extraInfo.sum，同时校验 request_body 中的日期与传入一致 */
function extractSum(captured: CapturedItem[], startDate: string, endDate: string): number {
  const hit = captured.find(c => {
    if (!c.url.includes('chartview/2006') || c.data?.data?.extraInfo?.sum == null) return false;
    // 校验 request_body 中 startTime/endTime 与传入参数一致
    try {
      const body = JSON.parse((c as any).request_body || '{}');
      return body.startTime === startDate && body.endTime === endDate;
    } catch {
      return false;
    }
  });
  if (!hit) {
    throw new Error(
      `灵犀 keyword_trend: 未找到匹配的 chartview/2006 数据（startTime=${startDate} endTime=${endDate}）`
    );
  }
  return Number(hit.data.data.extraInfo.sum);
}

/** asset/overall → list[] → name="AIPS 人群总数" → userNum */
function extractAips(captured: CapturedItem[]): number {
  const hit = captured.find(c => c.url.includes('asset/overall'));
  const item = hit?.data?.data?.list?.find((l: any) => l.name === 'AIPS 人群总数');
  return Number(item?.userNum ?? 0);
}

/** move_analyse → 提取新增资产总数 / AIPS变化 / TI变化 */
function extractMoveAnalyseData(captured: CapturedItem[], startDate: string, endDate: string): Partial<BrandData> {
  // 新增资产总数 — assertTrans/detail/card 不含 pathFrom，校验日期
  const detail = captured.find(c => {
    if (!c.url.includes('assertTrans/detail/card') || c.url.includes('pathFrom')) return false;
    return c.url.includes(`endDate=${endDate}`);
  });
  const newUserNum = Number(detail?.data?.data?.card?.find((cd: any) =>
    cd.tableResult?.[0]?.cardIndexName === '新增资产总数'
  )?.tableResult?.[0]?.newUserNum ?? 0);

  // AIPS人群变化数/率 & TI人群变化数/率 — assertTrans/card 不含 pathFrom，校验日期
  const card = captured.find(c => {
    if (!c.url.includes('assertTrans/card') || c.url.includes('pathFrom')) return false;
    return c.url.includes(`endDate=${endDate}`);
  });
  const items: any[] = card?.data?.data ?? [];

  const allItem = items.find(i => i.tableResult?.[0]?.groupLevel === 'all');
  const tiItem = items.find(i => i.tableResult?.[0]?.groupLevel === 'TI');

  return {
    newUserNum,
    aipsTransNum: Number(allItem?.tableResult?.[0]?.aipsTransNum ?? 0),
    aipsCompareStartRatio: Number(allItem?.tableResult?.[0]?.compareStartRatio ?? 0),
    tiTransNum: Number(tiItem?.tableResult?.[0]?.tiTransNum ?? 0),
    tiCompareStartRatio: Number(tiItem?.tableResult?.[0]?.compareStartRatio ?? 0),
  };
}

/** asset/overall → list[] → name="TI 深度兴趣人群数" → userNum */
function extractTi(captured: CapturedItem[]): number {
  const hit = captured.find(c => c.url.includes('asset/overall'));
  const item = hit?.data?.data?.list?.find((l: any) => l.name === 'TI 深度兴趣人群数');
  return Number(item?.userNum ?? 0);
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
      await new Promise((r) => setTimeout(r, 3000 * Math.pow(2, attempt)));
    }
  }
  throw new Error('unreachable');
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/** endDate 同一天的上个月 + 1天，确保恰好一个月（28~31天） */
function oneMonthAgoPlusOne(date: string): string {
  const d = new Date(date);
  const originalDay = d.getDate();
  d.setMonth(d.getMonth() - 1);
  // 处理月末溢出（如 3月31日 → 2月28日）
  if (d.getDate() !== originalDay) {
    d.setDate(0); // 上个月最后一天
  }
  d.setDate(d.getDate() + 1); // +1天，避免首日重叠
  return d.toISOString().slice(0, 10);
}
