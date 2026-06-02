import type { NoteMetrics } from '../shared/types';

/**
 * 默认爆文判定阈值（点赞+收藏+评论 >= 1000）
 * 当未提供自定义阈值时使用此默认值
 */
export const DEFAULT_VIRAL_THRESHOLD = 1000;

/**
 * 判定笔记是否为爆文
 * 口径：点赞 + 收藏 + 评论 >= threshold
 * 不受 EngagementConfig 配置影响（不包含 shareNum 和 followNum）
 * @param note 笔记互动数据
 * @param threshold 爆文阈值，默认为 1000
 */
export function isViralNote(note: NoteMetrics, threshold?: number): boolean {
  const effectiveThreshold = threshold ?? DEFAULT_VIRAL_THRESHOLD;
  return note.likeNum + note.favNum + note.cmtNum >= effectiveThreshold;
}

/**
 * 计算爆文率
 * @param notes 笔记互动数据数组
 * @param threshold 爆文阈值，默认为 1000
 * @returns viralCount: 爆文数量, viralRate: 爆文率 (viralCount / totalCount)
 * 当 totalCount 为 0 时，viralRate 返回 0
 */
export function calculateViralRate(notes: NoteMetrics[], threshold?: number): { viralCount: number; viralRate: number } {
  const totalCount = notes.length;

  if (totalCount === 0) {
    return { viralCount: 0, viralRate: 0 };
  }

  const viralCount = notes.filter((note) => isViralNote(note, threshold)).length;
  const viralRate = viralCount / totalCount;

  return { viralCount, viralRate };
}
