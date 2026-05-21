/**
 * Juguang API Client — 聚光平台数据采集
 *
 * 调用聚光 API 笔记层级离线报表（POST /api/v1/juguang/proxy/reports/note），
 * 映射为系统标准类型 JuguangNote[]。
 */

import type { JuguangNote } from '../shared/types.js';

// ── Config ──

export interface JuguangClientConfig {
  baseUrl: string;
  apiKey: string;
}

// ── Constants ──

const PAGE_SIZE = 500;
const MAX_RETRIES = 3;

// ── Raw types ──

/** 聚光笔记报表 API 返回的原始记录（值均为 string） */
interface RawJuguangNote {
  note_id?: string;
  fee?: string;
  impression?: string;
  click?: string;
  interaction?: string;
  i_user_num?: string;
  ti_user_num?: string;
  i_user_price?: string;
  ti_user_price?: string;
  search_cmt_click?: string;
  search_cmt_after_read?: string;
  search_cmt_after_read_avg?: string;
  search_cmt_click_cvr?: string;
}

interface JuguangPageResponse {
  code: number;
  success?: boolean;
  msg?: string;
  data?: {
    total_count?: number;
    data_list?: RawJuguangNote[];
  };
}

// ── Client ──

export class JuguangClient {
  constructor(private config: JuguangClientConfig) {}

  /**
   * 获取笔记层级离线报表数据（分页遍历全部）。
   *
   * @param advertiserId 广告主 ID
   * @param startDate 开始日期 yyyy-MM-dd
   * @param endDate 结束日期 yyyy-MM-dd
   */
  async fetchJuguangData(
    advertiserId: number,
    startDate: string,
    endDate: string,
  ): Promise<JuguangNote[]> {
    const allRows: RawJuguangNote[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const res = await this.fetchPage(advertiserId, startDate, endDate, page);
      allRows.push(...(res.data?.data_list ?? []));
      const total = res.data?.total_count ?? 0;
      hasMore = page * PAGE_SIZE < total;
      page++;
    }

    return allRows.map(mapToJuguangNote);
  }

  private async fetchPage(
    advertiserId: number,
    startDate: string,
    endDate: string,
    page: number,
  ): Promise<JuguangPageResponse> {
    return withRetry(async () => {
      const url = `${this.config.baseUrl}/api/v1/juguang/proxy/reports/note`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.config.apiKey,
        },
        body: JSON.stringify({
          advertiser_id: advertiserId,
          start_date: startDate,
          end_date: endDate,
          page_num: page,
          page_size: PAGE_SIZE,
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

      const json = await res.json() as JuguangPageResponse;

      if (json.code !== 0) {
        throw new Error(`聚光 API 错误: code=${json.code} msg=${json.msg}`);
      }

      return json;
    });
  }
}

// ── Field mapping ──

/** 将 API 返回的 string 转为 number，自动去掉 % 后缀 */
function parseNum(val?: string): number {
  if (val === undefined || val === null || val === '') return 0;
  const num = Number(val.replace('%', ''));
  return Number.isNaN(num) ? 0 : num;
}

function mapToJuguangNote(raw: RawJuguangNote): JuguangNote {
  return {
    noteId: raw.note_id || undefined,
    fee: parseNum(raw.fee),
    impression: parseNum(raw.impression),
    click: parseNum(raw.click),
    interaction: parseNum(raw.interaction),
    iUserNum: parseNum(raw.i_user_num),
    tiUserNum: parseNum(raw.ti_user_num),
    iUserPrice: parseNum(raw.i_user_price),
    tiUserPrice: parseNum(raw.ti_user_price),
    searchCmtClick: parseNum(raw.search_cmt_click),
    searchCmtAfterRead: parseNum(raw.search_cmt_after_read),
    searchCmtAfterReadAvg: parseNum(raw.search_cmt_after_read_avg),
    searchCmtClickCvr: parseNum(raw.search_cmt_click_cvr),
  };
}

// ── Utilities ──

async function withRetry<T>(fn: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try { return await fn(); } catch (e) {
      if (attempt === retries) throw e;
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
    }
  }
  throw new Error('unreachable');
}
