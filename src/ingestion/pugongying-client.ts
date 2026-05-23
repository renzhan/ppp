/**
 * Pugongying API Client — 蒲公英平台数据采集
 *
 * 调用蒲公英 API 获取笔记详情（POST batch_latest）和评论总数（full_tree），
 * 映射为系统标准类型 PugongyingNote[]。
 */

import type { PugongyingNote } from '../shared/types.js';

// ── Config ──

export interface PugongyingClientConfig {
  noteBaseUrl: string;
  apiKey: string;
}

// ── Constants ──

const BATCH_SIZE = 50;
const MAX_RETRIES = 3;

// ── Raw types ──

export interface RawPugongyingNote {
  note_id: string;
  brand_user_name?: string;
  spu_name?: string;
  kol_nick_name?: string;
  kol_id?: string;
  kol_fan_num?: number;
  note_type?: string;
  note_link?: string;
  note_title?: string;
  note_publish_time?: string;
  cooperate_type?: string;
  duration?: number;
  order_id?: number | string;
  kol_price?: number;
  total_platform_price?: number;
  effect?: string;
  imp_num?: number;
  heat_imp_num?: number;
  promotion_imp_num?: number;
  read_num?: number;
  heat_read_num?: number;
  promotion_read_num?: number;
  read_uv?: number;
  video_play_5s_rate?: number;
  pic_read_3s_rate?: number;
  avg_view_time?: number;
  finish_rate?: number;
  engage_num?: number;
  engage_rate?: number;
  like_num?: number;
  fav_num?: number;
  cmt_num?: number;
  share_num?: number;
  origin_imp_num?: number;
  origin_read_num?: number;
  read_cost?: number;
  engage_cost?: number;
  cpcp?: number;
  cp?: number;
  cp_rate?: number;
  comp_type?: string;
  comp_content?: string | null;
  comp_imp_num?: number;
  comp_click_pv_num?: number;
  comp_click_uv_num?: number;
  click_pv_rate?: number;
  with_content_comp?: string;
  content_comp_type?: string;
  content_comp_content?: string | null;
  content_comp_imp_num?: number;
  content_comp_click_num?: number;
  content_comp_click_uv?: number;
  connent_comp_click_ratio?: number;
  with_note_bottom_comp?: string;
  note_bottom_comp_type?: string;
  note_bottom_comp_content?: string | null;
  note_bottom_comp_imp_num?: number;
  note_bottom_comp_click_pv_num?: number;
  note_bottom_comp_click_uv_num?: number;
  note_bottom_comp_click_ratio?: number;
  with_engage_comp?: string;
  engage_comp_type?: string;
  engage_comp_title?: string | null;
  engage_comp_imp_num?: number;
  engage_comp_click_uv_num?: number;
  engage_comp_click_ratio?: number;
}

/**
| 接口中有但是我们未使用的字段(如果有需要可以新增) | 字段解释（根据资料） |
|--------------------------------|---------------------|
| `id` | 数据记录的自增主键（内部标识） |
| `date_key` | 更新日期，示例：2022-12-01 |
| `operate_user_id` | 下单账号id，不会为空 |
| `operate_user_name` | 下单账号名称 |
| `operate_main_name` | 下单账号主体名称 |
| `brand_user_id` | 报备品牌id |
| `kol_link` | 博主主页链接 |
| `kol_credit_level` | 博主信用等级：0-异常，1-普通，2-优秀（注意JSON中为字符串如"优秀"） |
| `order_kol_level` | 下单时博主信用等级：0-异常，1-普通，>=2-优秀 |
| `note_title` | 笔记标题，视频笔记可能为空 |
| `biz_title` | 订单标题 |
| `imp_discovery` | 曝光来源分布-发现页占比（自然流量），double，示例24.00% |
| `imp_search` | 曝光来源分布-搜索页占比 |
| `imp_homepage` | 曝光来源分布-个人页占比 |
| `imp_follow` | 曝光来源分布-关注页占比 |
| `imp_nearby` | 曝光来源分布-附近页占比 |
| `imp_other` | 曝光来源分布-其他占比 |
| `read_discovery` | 阅读来源分布-发现页占比 |
| `read_search` | 阅读来源分布-搜索页占比 |
| `read_homepage` | 阅读来源分布-个人页占比 |
| `read_follow` | 阅读来源分布-关注页占比 |
| `read_nearby` | 阅读来源分布-附近页占比 |
| `read_other` | 阅读来源分布-其他占比 |
| `fan_percent` | 粉丝占比（阅读受众分析） |
| `female_percent` | 女性占比 |
| `male_percent` | 男性占比 |
| `age1_percent` | 年龄 <18 占比 |
| `age2_percent` | 年龄 18~24 占比 |
| `age3_percent` | 年龄 25~34 占比 |
| `age4_percent` | 年龄 35~44 占比 |
| `age5_percent` | 年龄 >44 占比 |
| `phone_top1` | 手机型号top1 |
| `phone_top1_rate` | top1占比 |
| `phone_top2` | 手机型号top2 |
| `phone_top2_rate` | top2占比 |
| `phone_top3` | 手机型号top3 |
| `phone_top3_rate` | top3占比 |
| `province_top1` | 地域分布top1（省份） |
| `province_top1_rate` | top1占比 |
| `province_top2` | 地域分布top2 |
| `province_top2_rate` | top2占比 |
| `province_top3` | 地域分布top3 |
| `province_top3_rate` | top3占比 |
| `interest_top1` | 兴趣分布top1 |
| `interest_top1_rate` | top1占比 |
| `interest_top2` | 兴趣分布top2 |
| `interest_top2_rate` | top2占比 |
| `interest_top3` | 兴趣分布top3 |
| `interest_top3_rate` | top3占比 |
| `star_task_name` | 星任务名称 |
| `star_event_group_id` | 星任务主任务ID |
| `event_group_start_time` | 星任务考试开始时间 |
| `event_group_end_time` | 星任务结束时间 |
| `star_total_amount` | 星任务总金额（单位：元，但JSON中为0数字） |
| `star_pgy_total_amount` | 蒲公英金额（元） |
| `star_ads_total_amount` | 广告金额（元） |
| `star_trans_ratio` | 抽样比例（如50表示50%） |
| `star_read_uv` | 星任务阅读UV |
| `star_cmt_uv` | 评论UV |
| `star_like_uv` | 点赞UV |
| `star_fav_uv` | 收藏UV |
| `star_share_uv` | 分享UV |
| `star_enter_store_uv` | 站外店铺行为UV |
| `star_enter_store_ratio` | 站外转化率 |
| `star_enter_store_cost` | 站外转化成本（元） |
| `spu_name` | SPU名称（如一鸣大米生牛乳） |
| `interest_num` | 种草数 |
| `interest_rate` | 种草率 |
| `interest_cost` | 种草成本（元） |
| `feed_interest_num` | 推荐场种草数 |
| `search_interest_num` | 搜索场种草数 |
| `other_interest_num` | 其他场种草数 |
| `note_bottom_comp_click_ratio` | 底栏点击率 |
| `created_at` | 记录创建时间（入库时间） |
 */

// ── Client ──

export class PugongyingClient {
  constructor(private config: PugongyingClientConfig) {}

  async fetchPugongyingData(noteIds: string[]): Promise<PugongyingNote[]> {
    if (noteIds.length === 0) return [];

    // 批量拉笔记详情（cmtNum 由 API 直接返回）
    const allNotes: PugongyingNote[] = [];
    for (const batch of chunkArray(noteIds, BATCH_SIZE)) {
      const rawNotes = await this.fetchNoteBatch(batch);
      allNotes.push(...rawNotes.map(mapToNote));
    }

    return allNotes;
  }

  // ── API calls ──

  private async fetchNoteBatch(noteIds: string[]): Promise<RawPugongyingNote[]> {
    return withRetry(async () => {
      const url = `${this.config.noteBaseUrl}/api/v1/data/note/batch_latest`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.config.apiKey,
        },
        body: JSON.stringify({ note_ids: noteIds }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const json = await res.json() as { code: number; message?: string; data?: unknown };
      if (json.code !== 0) throw new Error(`API 错误: code=${json.code} message=${json.message}`);
      if (!Array.isArray(json.data)) throw new Error('API 返回 data 不是数组');
      return json.data as RawPugongyingNote[];
    });
  }

}

// ── Validation ──

class PugongyingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PugongyingValidationError';
  }
}

function validateNote(raw: unknown): asserts raw is RawPugongyingNote {
  if (!raw || typeof raw !== 'object') {
    throw new PugongyingValidationError('Invalid pugongying note: expected an object');
  }
  const note = raw as Record<string, unknown>;

  // ── 必填字符串 ──
  for (const field of ['note_id', 'kol_id']) {
    if (typeof note[field] !== 'string' || (note[field] as string).trim() === '') {
      throw new PugongyingValidationError(`Invalid pugongying note: "${field}" is required`);
    }
  }

  // ── note_type 必须为 "图文" 或 "视频" ──
  if (note['note_type'] !== undefined && note['note_type'] !== null) {
    if (note['note_type'] !== '图文' && note['note_type'] !== '视频') {
      throw new PugongyingValidationError(`Invalid note_type: expected "图文" or "视频", got "${note['note_type']}"`);
    }
  }

  // ── 核心数值字段 ──
  const requiredNumericFields = [
    'kol_fan_num', 'imp_num', 'read_num', 'engage_num',
    'like_num', 'fav_num', 'share_num',
    'kol_price', 'total_platform_price', 'heat_imp_num', 'heat_read_num',
  ];
  for (const field of requiredNumericFields) {
    if (typeof note[field] !== 'number' || Number.isNaN(note[field])) {
      throw new PugongyingValidationError(`Invalid pugongying note: "${field}" must be a number`);
    }
  }

  // ── 金额字段非负（新 API 已是元，允许小数） ──
  if ((note['kol_price'] as number) < 0) {
    throw new PugongyingValidationError('Invalid pugongying note: kol_price must be non-negative');
  }
  if ((note['total_platform_price'] as number) < 0) {
    throw new PugongyingValidationError('Invalid pugongying note: total_platform_price must be non-negative');
  }
}

// ── Field mapping ──

function mapToNote(raw: RawPugongyingNote): PugongyingNote {
  validateNote(raw);
  const kolPrice = raw.kol_price ?? 0;
  const serviceFee = raw.total_platform_price ?? 0;

  return {
    noteId: raw.note_id,
    brandUserName: raw.brand_user_name ?? '',
    spuName: raw.spu_name ?? '',
    kolNickName: raw.kol_nick_name ?? '',
    kolId: raw.kol_id ?? '',
    kolFanNum: raw.kol_fan_num ?? 0,
    noteType: raw.note_type === '视频' ? 'video' : 'image',
    noteLink: raw.note_link ?? '',
    noteTitle: raw.note_title ?? null,
    impNum: raw.imp_num ?? 0,
    readNum: raw.read_num ?? 0,
    engageNum: raw.engage_num ?? 0,
    likeNum: raw.like_num ?? 0,
    favNum: raw.fav_num ?? 0,
    cmtNum: raw.cmt_num ?? 0,
    shareNum: raw.share_num ?? 0,
    followNum: 0,
    kolPrice,
    serviceFee,
    totalPlatformPrice: kolPrice + serviceFee,
    heatImpNum: raw.heat_imp_num ?? 0,
    heatReadNum: raw.heat_read_num ?? 0,
    isUnderwater: false,
    underwaterPrice: 0,
    components: buildComponents(raw),
    notePublishTime: raw.note_publish_time ? new Date(raw.note_publish_time) : null,
    cooperateType: raw.cooperate_type ?? null,
    duration: raw.duration ?? 0,
    originImpNum: raw.origin_imp_num ?? 0,
    originReadNum: raw.origin_read_num ?? 0,
    promotionImpNum: raw.promotion_imp_num ?? 0,
    promotionReadNum: raw.promotion_read_num ?? 0,
    readUv: raw.read_uv ?? 0,
    engageRate: raw.engage_rate ?? null,
    readCost: raw.read_cost ?? 0,
    engageCost: raw.engage_cost ?? 0,
    avgViewTime: raw.avg_view_time ?? null,
    videoPlay5sRate: raw.video_play_5s_rate ?? null,
    picRead3sRate: raw.pic_read_3s_rate ?? null,
    finishRate: raw.finish_rate ?? null,
    cp: raw.cp ?? 0,
    cpRate: raw.cp_rate ?? null,
    cpcp: raw.cpcp ?? 0,
    orderId: raw.order_id != null ? String(raw.order_id) : null,
    effect: raw.effect ?? null,
  };
}

function buildComponents(raw: RawPugongyingNote): PugongyingNote['components'] {
  const components: PugongyingNote['components'] = [];
  if (raw.comp_type && raw.comp_type !== '无') {
    components.push({ componentType: '评论区组件', impressions: raw.comp_imp_num ?? 0, clicks: raw.comp_click_pv_num ?? 0, conversions: 0 });
  }
  if (raw.with_content_comp === '是') {
    components.push({ componentType: '正文组件', impressions: raw.content_comp_imp_num ?? 0, clicks: raw.content_comp_click_num ?? 0, conversions: 0 });
  }
  if (raw.with_note_bottom_comp === '是') {
    components.push({ componentType: '底栏组件', impressions: raw.note_bottom_comp_imp_num ?? 0, clicks: raw.note_bottom_comp_click_pv_num ?? 0, conversions: 0 });
  }
  if (raw.with_engage_comp === '是') {
    components.push({ componentType: '互动组件', impressions: raw.engage_comp_imp_num ?? 0, clicks: raw.engage_comp_click_uv_num ?? 0, conversions: 0 });
  }
  return components.length > 0 ? components : undefined;
}

// ── Utilities ──

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
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
