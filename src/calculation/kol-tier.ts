import type { KOLTier, NoteWithKOL, KOLTierAggregation } from '../shared/types';

/**
 * 曝光率层级配置
 * lowerBound: 曝光率下限（含）
 * upperBound: 曝光率上限（不含）
 */
export interface ExposureRateTierConfig {
  name: string;
  lowerBound: number; // inclusive
  upperBound: number; // exclusive
}

/**
 * 基于曝光率的达人层级分类
 *
 * 计算曝光率 = impressions / fanCount，匹配 tier 配置中 [lowerBound, upperBound) 的区间。
 * 若 fanCount <= 0 或无匹配区间，返回 "未分类"。
 */
export function classifyKOLByExposureRate(
  impressions: number,
  fanCount: number,
  tierConfig: ExposureRateTierConfig[]
): string {
  if (fanCount <= 0) return '未分类';
  const exposureRate = impressions / fanCount;
  for (const tier of tierConfig) {
    if (exposureRate >= tier.lowerBound && exposureRate < tier.upperBound) {
      return tier.name;
    }
  }
  return '未分类';
}

/**
 * 达人层级分类（基于粉丝量）
 *
 * 分类规则：
 * - fanCount < 10000 → 'KOC'
 * - 10000 ≤ fanCount < 50000 → '尾部'
 * - 50000 ≤ fanCount < 100000 → '腰尾部'
 * - 100000 ≤ fanCount < 500000 → '腰部'
 * - fanCount ≥ 500000 → '头部'
 */
export function classifyKOLTier(fanCount: number): KOLTier {
  if (fanCount < 10000) return 'KOC';
  if (fanCount < 50000) return '尾部';
  if (fanCount < 100000) return '腰尾部';
  if (fanCount < 500000) return '腰部';
  return '头部';
}

/**
 * 爆文判定阈值（默认值：点赞+收藏+评论 >= 1000）
 */
const DEFAULT_VIRAL_THRESHOLD = 1000;

/**
 * 达人层级配置（基于粉丝量）
 */
export interface FanTierConfig {
  name: string;
  fanRangeMin: number; // inclusive
  fanRangeMax: number; // inclusive
}

/**
 * aggregateByKOLTier 可选配置参数
 */
export interface AggregateByKOLTierOptions {
  /** 自定义粉丝层级配置，若不提供则使用 classifyKOLTier 硬编码默认值 */
  tierConfig?: FanTierConfig[];
  /** 爆文判定阈值（点赞+收藏+评论），默认1000 */
  viralThreshold?: number;
}

/**
 * 按达人层级聚合笔记数据
 *
 * 对每个层级计算：
 * - noteCount: 笔记数
 * - totalImpressions: 总曝光
 * - totalReads: 总阅读
 * - totalEngagement: 总互动（默认口径：like+fav+cmt+share+follow）
 * - averageCPE: 平均CPE = 层级总费用 / 总互动（互动为0时返回'N/A'）
 * - viralCount: 爆文数
 * - viralRate: 爆文率
 *
 * 层级总费用计算：
 * - 水上笔记：kolPrice + serviceFee
 * - 水下笔记：underwaterPrice
 */
export function aggregateByKOLTier(notes: NoteWithKOL[], options?: AggregateByKOLTierOptions): KOLTierAggregation[] {
  const tierConfig = options?.tierConfig;
  const viralThreshold = options?.viralThreshold ?? DEFAULT_VIRAL_THRESHOLD;

  // Group notes by tier
  const tierGroups = new Map<KOLTier | string, NoteWithKOL[]>();

  for (const note of notes) {
    let tier: string;
    if (tierConfig && tierConfig.length > 0) {
      // Use custom tier config
      tier = '未分类';
      for (const t of tierConfig) {
        if (note.kolFanNum >= t.fanRangeMin && note.kolFanNum <= t.fanRangeMax) {
          tier = t.name;
          break;
        }
      }
    } else {
      // Use default hardcoded tiers
      tier = classifyKOLTier(note.kolFanNum);
    }
    const group = tierGroups.get(tier);
    if (group) {
      group.push(note);
    } else {
      tierGroups.set(tier, [note]);
    }
  }

  // Compute per-tier metrics
  const results: KOLTierAggregation[] = [];

  for (const [tier, tierNotes] of tierGroups) {
    const noteCount = tierNotes.length;
    let totalImpressions = 0;
    let totalReads = 0;
    let totalEngagement = 0;
    let totalCost = 0;
    let viralCount = 0;

    for (const note of tierNotes) {
      totalImpressions += note.impNum;
      totalReads += note.readNum;

      // Default engagement config: like + fav + cmt + share + follow
      totalEngagement += note.likeNum + note.favNum + note.cmtNum + note.shareNum + note.followNum;

      // Cost calculation: above-water uses kolPrice + serviceFee, underwater uses underwaterPrice
      if (note.isUnderwater) {
        totalCost += note.underwaterPrice;
      } else {
        totalCost += note.kolPrice + note.serviceFee;
      }

      // Viral detection: using configured threshold (like + fav + cmt >= threshold)
      if (note.likeNum + note.favNum + note.cmtNum >= viralThreshold) {
        viralCount++;
      }
    }

    const averageCPE: number | 'N/A' = totalEngagement === 0 ? 'N/A' : totalCost / totalEngagement;
    const viralRate = noteCount === 0 ? 0 : viralCount / noteCount;

    results.push({
      tier: tier as KOLTier,
      noteCount,
      totalImpressions,
      totalReads,
      totalEngagement,
      averageCPE,
      viralCount,
      viralRate,
    });
  }

  return results;
}
