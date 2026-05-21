import type { NoteMetrics } from '../shared/types';

/**
 * 爆文判定阈值（固定值：点赞+收藏+评论 >= 1000）
 * 该阈值独立于互动量配置（EngagementConfig），不包含分享和关注
 */
const VIRAL_THRESHOLD = 1000;

/**
 * 判定笔记是否为爆文
 * 使用固定口径：点赞 + 收藏 + 评论 >= 1000
 * 不受 EngagementConfig 配置影响（不包含 shareNum 和 followNum）
 */
export function isViralNote(note: NoteMetrics): boolean {
  return note.likeNum + note.favNum + note.cmtNum >= VIRAL_THRESHOLD;
}

/**
 * 计算爆文率
 * @returns viralCount: 爆文数量, viralRate: 爆文率 (viralCount / totalCount)
 * 当 totalCount 为 0 时，viralRate 返回 0
 */
export function calculateViralRate(notes: NoteMetrics[]): { viralCount: number; viralRate: number } {
  const totalCount = notes.length;

  if (totalCount === 0) {
    return { viralCount: 0, viralRate: 0 };
  }

  const viralCount = notes.filter(isViralNote).length;
  const viralRate = viralCount / totalCount;

  return { viralCount, viralRate };
}
