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

interface AdvertiserListResponse {
  code: number;
  message?: string;
  data?: {
    result?: {
      advertisers?: Array<{ advertiser_id: number; advertiser_name: string }>;
    };
  };
}

/** 聚光笔记报表 API 返回的原始记录（值均为 string） */
interface RawJuguangNote {
  note_id?: string;
  placement?: string;             // 广告类型：1-信息流、2-搜索、4-全站智投、7-视频流
  targets_detail?: string;        // 精准定向名称
  keyword?: string;               // 关键词/搜索主题名称
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
  acp?: string;
  cpm?: string;
  cpi?: string;
  placement?: string;
  keyword?: string;
  target_detail?: string;
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
   * 内部先通过品牌名称匹配 advertiserId。
   *
   * @param brandName 品牌名称
   * @param startDate 开始日期 yyyy-MM-dd
   * @param endDate 结束日期 yyyy-MM-dd
   */
  async fetchJuguangData(
    brandName: string,
    startDate: string,
    endDate: string,
  ): Promise<JuguangNote[]> {
    const advertiserId = await this.resolveAdvertiserId(brandName);

    // 四种分组维度并发采集
    const variants: Array<{ splitColumns?: string[] }> = [
      {},                                      // 基础（无 split）
      { splitColumns: ['placement'] },         // 广告位拆分
      { splitColumns: ['keyword'] },           // 关键词拆分
      // targetDetail 接口未完成，暂时 skip
    ];

    const results = await Promise.all(
      variants.map(v =>
        this.fetchAllPages(advertiserId, startDate, endDate, v.splitColumns)
          .catch(e => {
            console.error(`[juguang] split=${v.splitColumns?.join(',') || 'none'} 失败:`, (e as Error).message);
            return [] as RawJuguangNote[];
          })
      )
    );

    return results.flat().map(mapToJuguangNote);
  }

  private async fetchAllPages(
    advertiserId: number, startDate: string, endDate: string, splitColumns?: string[],
  ): Promise<RawJuguangNote[]> {
    const allRows: RawJuguangNote[] = [];
    let page = 1;
    let hasMore = true;
    while (hasMore) {
      const res = await this.fetchPage(advertiserId, startDate, endDate, page, splitColumns);
      allRows.push(...(res.data?.data_list ?? []));
      const total = res.data?.total_count ?? 0;
      hasMore = page * PAGE_SIZE < total;
      page++;
    }
    return allRows;
  }

  /** 根据品牌名称匹配 advertiser_id（取第一个，前端后续支持选择具体广告主） */
  private async resolveAdvertiserId(brandName: string): Promise<number> {
    const url = `${this.config.baseUrl}/api/v1/juguang/advertisers`;
    const res = await fetch(url, { headers: { 'X-API-Key': this.config.apiKey } });
    if (!res.ok) throw new Error(`获取广告主列表失败: HTTP ${res.status}`);
    const json = await res.json() as AdvertiserListResponse;
    if (json.code !== 200) throw new Error(`获取广告主列表失败: code=${json.code}`);
    const advertisers = json.data?.result?.advertisers ?? [];

    const match = advertisers.find(a => a.advertiser_name.includes(brandName));
    if (match) return match.advertiser_id;

    throw new Error(`未找到匹配品牌 "${brandName}" 的广告主`);
  }

  private async fetchPage(
    advertiserId: number,
    startDate: string,
    endDate: string,
    page: number,
    splitColumns?: string[],
  ): Promise<JuguangPageResponse> {
    return withRetry(async () => {
      const url = `${this.config.baseUrl}/api/v1/juguang/proxy/reports/note`;
      const body: Record<string, unknown> = {
        advertiser_id: advertiserId,
        start_date: startDate,
        end_date: endDate,
        page_num: page,
        page_size: PAGE_SIZE,
        time_unit: 'SUMMARY',
      };
      if (splitColumns?.length) {
        body.split_columns = splitColumns;
      }
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.config.apiKey,
        },
        body: JSON.stringify(body),
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
    placement: raw.placement || undefined,
    targetsDetail: raw.targets_detail || undefined,
    keyword: raw.keyword || undefined,
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
    acp: parseNum(raw.acp),
    cpm: parseNum(raw.cpm),
    cpi: parseNum(raw.cpi),
    placement: raw.placement || undefined,
    keyword: raw.keyword || undefined,
    targetDetail: raw.target_detail || undefined,
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
