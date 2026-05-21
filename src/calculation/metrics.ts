import type { PaidTrafficMetrics, SearchMetrics } from '../shared/types';

/**
 * 聚光数据聚合输入（用于投流指标计算）
 */
export interface JuguangAggregated {
  totalFee: number;
  totalImpression: number;
  totalClick: number;
  totalInteraction: number;
  totalIUserNum: number;
  totalTiUserNum: number;
  avgIUserPrice: number;
  avgTiUserPrice: number;
  totalSearchCmtClick: number;
  totalSearchCmtAfterRead: number;
  avgSearchCmtAfterReadAvg: number;
  avgSearchCmtClickCvr: number;
}

/**
 * 计算CPE（每互动成本）
 * CPE = totalCost / totalEngagement
 * 当分母为0时返回 'N/A'
 */
export function calculateCPE(totalCost: number, totalEngagement: number): number | 'N/A' {
  if (totalEngagement === 0) {
    return 'N/A';
  }
  return totalCost / totalEngagement;
}

/**
 * 计算CPM（千次曝光成本）
 * CPM = totalCost / totalImpressions × 1000
 * 当分母为0时返回 'N/A'
 */
export function calculateCPM(totalCost: number, totalImpressions: number): number | 'N/A' {
  if (totalImpressions === 0) {
    return 'N/A';
  }
  return (totalCost / totalImpressions) * 1000;
}

/**
 * 计算CPC（每阅读成本）
 * CPC = totalCost / totalReads
 * 当分母为0时返回 'N/A'
 */
export function calculateCPC(totalCost: number, totalReads: number): number | 'N/A' {
  if (totalReads === 0) {
    return 'N/A';
  }
  return totalCost / totalReads;
}

/**
 * 计算CTR（点击率）
 * CTR = totalReads / totalImpressions
 * 当分母为0时返回 'N/A'
 */
export function calculateCTR(totalReads: number, totalImpressions: number): number | 'N/A' {
  if (totalImpressions === 0) {
    return 'N/A';
  }
  return totalReads / totalImpressions;
}

/**
 * 计算投流效果指标（聚光平台）
 *
 * 公式:
 * - ctr = totalClick / totalImpression (N/A if totalImpression is 0)
 * - cpc = totalFee / totalClick (N/A if totalClick is 0)
 * - cpm = totalFee / totalImpression × 1000 (N/A if totalImpression is 0)
 * - cpe = totalFee / totalInteraction (N/A if totalInteraction is 0)
 */
export function calculatePaidTrafficMetrics(juguangData: JuguangAggregated): PaidTrafficMetrics {
  const ctr: number | 'N/A' = juguangData.totalImpression === 0
    ? 'N/A'
    : juguangData.totalClick / juguangData.totalImpression;

  const cpc: number | 'N/A' = juguangData.totalClick === 0
    ? 'N/A'
    : juguangData.totalFee / juguangData.totalClick;

  const cpm: number | 'N/A' = juguangData.totalImpression === 0
    ? 'N/A'
    : (juguangData.totalFee / juguangData.totalImpression) * 1000;

  const cpe: number | 'N/A' = juguangData.totalInteraction === 0
    ? 'N/A'
    : juguangData.totalFee / juguangData.totalInteraction;

  const searchMetrics: SearchMetrics = {
    searchCmtClick: juguangData.totalSearchCmtClick,
    searchCmtAfterRead: juguangData.totalSearchCmtAfterRead,
    searchCmtAfterReadAvg: juguangData.avgSearchCmtAfterReadAvg,
    searchCmtClickCvr: juguangData.avgSearchCmtClickCvr,
  };

  return {
    impression: juguangData.totalImpression,
    click: juguangData.totalClick,
    ctr,
    cpc,
    cpm,
    cpe,
    iUserNum: juguangData.totalIUserNum,
    tiUserNum: juguangData.totalTiUserNum,
    iUserPrice: juguangData.avgIUserPrice,
    tiUserPrice: juguangData.avgTiUserPrice,
    searchMetrics,
  };
}
