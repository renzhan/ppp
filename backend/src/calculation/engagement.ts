import type { NoteMetrics, EngagementConfig } from '../shared/types';

/**
 * 计算笔记互动量（可配置口径）
 *
 * 默认口径：点赞 + 收藏 + 评论 + 分享 + 关注
 * 可配置去掉分享和/或关注
 *
 * @param note - 笔记指标数据
 * @param config - 互动量口径配置
 * @returns 互动量总和
 */
export function calculateEngagement(note: NoteMetrics, config: EngagementConfig): number {
  let engagement = note.likeNum + note.favNum + note.cmtNum;

  if (config.includeShare) {
    engagement += note.shareNum;
  }

  if (config.includeFollow) {
    engagement += note.followNum;
  }

  return engagement;
}
