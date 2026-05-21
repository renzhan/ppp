import type { NaturalExposureResult } from '../shared/types';

/**
 * 计算自然曝光量
 * Natural_Exposure = max(0, 蒲公英总曝光 - 聚光展现量)
 * 当原始差值为负时标记 isAnomalous = true
 *
 * @param pugongyingImpressions - 蒲公英平台总曝光量
 * @param juguangImpressions - 聚光平台总展现量
 * @returns NaturalExposureResult
 */
export function calculateNaturalExposure(
  pugongyingImpressions: number,
  juguangImpressions: number
): NaturalExposureResult {
  const rawDifference = pugongyingImpressions - juguangImpressions;
  const isAnomalous = rawDifference < 0;
  const value = Math.max(0, rawDifference);

  return { value, isAnomalous };
}
