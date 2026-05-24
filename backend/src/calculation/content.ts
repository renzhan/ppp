import type { AnnotatedNote, DimensionAggregation } from '../shared/types';

/**
 * 爆文判定阈值（固定口径：点赞+收藏+评论 >= 1000）
 */
const VIRAL_THRESHOLD = 1000;

/**
 * 有效的维度字段名
 */
type DimensionField = 'noteType' | 'contentDirection' | 'accountType' | 'kolType' | 'launchPhase';

/**
 * 按指定维度聚合笔记数据（内容分析）
 *
 * 支持的维度：
 * - noteType: 笔记类型（图文/视频）
 * - contentDirection: 内容方向
 * - accountType: 账号类型
 * - kolType: KOL类型
 * - launchPhase: 投放阶段
 *
 * 对每个分组计算：
 * - noteCount: 笔记数
 * - totalImpressions: 总曝光（sum of impNum）
 * - totalReads: 总阅读（sum of readNum）
 * - totalEngagement: 总互动（默认口径：like+fav+cmt+share+follow）
 * - cpe: 总费用 / 总互动（互动为0时返回'N/A'）
 * - viralCount: 爆文数（like+fav+cmt >= 1000）
 * - viralRate: 爆文率（viralCount / noteCount）
 *
 * 费用计算：
 * - 水上笔记：kolPrice + serviceFee
 * - 水下笔记：underwaterPrice
 *
 * 结果按 totalEngagement 降序排列
 */
export function aggregateByDimension(
  notes: AnnotatedNote[],
  dimension: string
): DimensionAggregation[] {
  if (notes.length === 0) {
    return [];
  }

  const dimField = dimension as DimensionField;

  // Group notes by dimension value
  const groups = new Map<string, AnnotatedNote[]>();

  for (const note of notes) {
    const value = note[dimField] as string;
    const group = groups.get(value);
    if (group) {
      group.push(note);
    } else {
      groups.set(value, [note]);
    }
  }

  // Compute per-group metrics
  const results: DimensionAggregation[] = [];

  for (const [dimensionValue, groupNotes] of groups) {
    const noteCount = groupNotes.length;
    let totalImpressions = 0;
    let totalReads = 0;
    let totalEngagement = 0;
    let totalCost = 0;
    let viralCount = 0;

    for (const note of groupNotes) {
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

    const cpe: number | 'N/A' = totalEngagement === 0 ? 'N/A' : totalCost / totalEngagement;
    const viralRate = noteCount === 0 ? 0 : viralCount / noteCount;

    results.push({
      dimensionValue,
      noteCount,
      totalImpressions,
      totalReads,
      totalEngagement,
      cpe,
      viralCount,
      viralRate,
    });
  }

  // Sort by totalEngagement descending (default sort metric)
  results.sort((a, b) => b.totalEngagement - a.totalEngagement);

  return results;
}
