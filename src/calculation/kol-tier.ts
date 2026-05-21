import type { KOLTier, NoteWithKOL, KOLTierAggregation } from '../shared/types';

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
 * 爆文判定阈值（固定口径：点赞+收藏+评论 >= 1000）
 */
const VIRAL_THRESHOLD = 1000;

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
export function aggregateByKOLTier(notes: NoteWithKOL[]): KOLTierAggregation[] {
  // Group notes by tier
  const tierGroups = new Map<KOLTier, NoteWithKOL[]>();

  for (const note of notes) {
    const tier = classifyKOLTier(note.kolFanNum);
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

      // Viral detection: fixed threshold (like + fav + cmt >= 1000)
      if (note.likeNum + note.favNum + note.cmtNum >= VIRAL_THRESHOLD) {
        viralCount++;
      }
    }

    const averageCPE: number | 'N/A' = totalEngagement === 0 ? 'N/A' : totalCost / totalEngagement;
    const viralRate = noteCount === 0 ? 0 : viralCount / noteCount;

    results.push({
      tier,
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
