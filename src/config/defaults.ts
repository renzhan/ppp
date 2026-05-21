import type { EngagementConfig, CooperationPolicy } from '../shared/types.js';

/**
 * Default engagement configuration.
 * 默认互动量口径：点赞 + 收藏 + 评论 + 分享 + 关注
 */
export const defaultEngagementConfig: EngagementConfig = {
  includeShare: true,
  includeFollow: true,
};

/**
 * Default cooperation policy.
 * 默认合作政策：折扣系数为1（无折扣），无特殊规则
 */
export const defaultCooperationPolicy: CooperationPolicy = {
  defaultDiscount: 1,
  specialRules: [],
};
