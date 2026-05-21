import { describe, it, expect } from 'vitest';
import {
  calculateCPE,
  calculateCPM,
  calculateCPC,
  calculateCTR,
  calculatePaidTrafficMetrics,
} from '../../src/calculation/metrics';
import type { JuguangAggregated } from '../../src/calculation/metrics';

describe('calculateCPE', () => {
  it('calculates CPE correctly with positive values', () => {
    expect(calculateCPE(10000, 500)).toBe(20);
  });

  it('returns N/A when totalEngagement is 0', () => {
    expect(calculateCPE(10000, 0)).toBe('N/A');
  });

  it('returns 0 when totalCost is 0 and engagement is positive', () => {
    expect(calculateCPE(0, 100)).toBe(0);
  });

  it('handles decimal results', () => {
    expect(calculateCPE(100, 3)).toBeCloseTo(33.3333, 4);
  });
});

describe('calculateCPM', () => {
  it('calculates CPM correctly with positive values', () => {
    // 10000 / 50000 * 1000 = 200
    expect(calculateCPM(10000, 50000)).toBe(200);
  });

  it('returns N/A when totalImpressions is 0', () => {
    expect(calculateCPM(10000, 0)).toBe('N/A');
  });

  it('returns 0 when totalCost is 0 and impressions are positive', () => {
    expect(calculateCPM(0, 50000)).toBe(0);
  });

  it('handles small impression counts', () => {
    // 1000 / 1 * 1000 = 1000000
    expect(calculateCPM(1000, 1)).toBe(1000000);
  });
});

describe('calculateCPC', () => {
  it('calculates CPC correctly with positive values', () => {
    // 10000 / 2000 = 5
    expect(calculateCPC(10000, 2000)).toBe(5);
  });

  it('returns N/A when totalReads is 0', () => {
    expect(calculateCPC(10000, 0)).toBe('N/A');
  });

  it('returns 0 when totalCost is 0 and reads are positive', () => {
    expect(calculateCPC(0, 2000)).toBe(0);
  });

  it('handles decimal results', () => {
    expect(calculateCPC(100, 7)).toBeCloseTo(14.2857, 4);
  });
});

describe('calculateCTR', () => {
  it('calculates CTR correctly with positive values', () => {
    // 2000 / 10000 = 0.2
    expect(calculateCTR(2000, 10000)).toBe(0.2);
  });

  it('returns N/A when totalImpressions is 0', () => {
    expect(calculateCTR(2000, 0)).toBe('N/A');
  });

  it('returns 0 when totalReads is 0 and impressions are positive', () => {
    expect(calculateCTR(0, 10000)).toBe(0);
  });

  it('handles CTR greater than 1 (reads > impressions)', () => {
    // This can happen in certain data scenarios
    expect(calculateCTR(15000, 10000)).toBe(1.5);
  });
});

describe('calculatePaidTrafficMetrics', () => {
  const baseJuguangData: JuguangAggregated = {
    totalFee: 5000,
    totalImpression: 100000,
    totalClick: 2000,
    totalInteraction: 500,
    totalIUserNum: 300,
    totalTiUserNum: 50,
    avgIUserPrice: 10,
    avgTiUserPrice: 50,
    totalSearchCmtClick: 150,
    totalSearchCmtAfterRead: 80,
    avgSearchCmtAfterReadAvg: 5.5,
    avgSearchCmtClickCvr: 0.12,
  };

  it('calculates all metrics correctly with positive values', () => {
    const result = calculatePaidTrafficMetrics(baseJuguangData);

    // ctr = 2000 / 100000 = 0.02
    expect(result.ctr).toBe(0.02);
    // cpc = 5000 / 2000 = 2.5
    expect(result.cpc).toBe(2.5);
    // cpm = 5000 / 100000 * 1000 = 50
    expect(result.cpm).toBe(50);
    // cpe = 5000 / 500 = 10
    expect(result.cpe).toBe(10);
  });

  it('passes through impression and click totals', () => {
    const result = calculatePaidTrafficMetrics(baseJuguangData);

    expect(result.impression).toBe(100000);
    expect(result.click).toBe(2000);
  });

  it('passes through user metrics', () => {
    const result = calculatePaidTrafficMetrics(baseJuguangData);

    expect(result.iUserNum).toBe(300);
    expect(result.tiUserNum).toBe(50);
    expect(result.iUserPrice).toBe(10);
    expect(result.tiUserPrice).toBe(50);
  });

  it('passes through search metrics', () => {
    const result = calculatePaidTrafficMetrics(baseJuguangData);

    expect(result.searchMetrics.searchCmtClick).toBe(150);
    expect(result.searchMetrics.searchCmtAfterRead).toBe(80);
    expect(result.searchMetrics.searchCmtAfterReadAvg).toBe(5.5);
    expect(result.searchMetrics.searchCmtClickCvr).toBe(0.12);
  });

  it('returns N/A for ctr and cpm when totalImpression is 0', () => {
    const data: JuguangAggregated = {
      ...baseJuguangData,
      totalImpression: 0,
    };

    const result = calculatePaidTrafficMetrics(data);

    expect(result.ctr).toBe('N/A');
    expect(result.cpm).toBe('N/A');
    // cpc and cpe should still be calculated
    expect(result.cpc).toBe(2.5);
    expect(result.cpe).toBe(10);
  });

  it('returns N/A for cpc when totalClick is 0', () => {
    const data: JuguangAggregated = {
      ...baseJuguangData,
      totalClick: 0,
    };

    const result = calculatePaidTrafficMetrics(data);

    expect(result.cpc).toBe('N/A');
    // ctr should still be calculated: 0 / 100000 = 0
    expect(result.ctr).toBe(0);
    expect(result.cpm).toBe(50);
    expect(result.cpe).toBe(10);
  });

  it('returns N/A for cpe when totalInteraction is 0', () => {
    const data: JuguangAggregated = {
      ...baseJuguangData,
      totalInteraction: 0,
    };

    const result = calculatePaidTrafficMetrics(data);

    expect(result.cpe).toBe('N/A');
    expect(result.ctr).toBe(0.02);
    expect(result.cpc).toBe(2.5);
    expect(result.cpm).toBe(50);
  });

  it('returns N/A for all rate metrics when all denominators are 0', () => {
    const data: JuguangAggregated = {
      ...baseJuguangData,
      totalImpression: 0,
      totalClick: 0,
      totalInteraction: 0,
    };

    const result = calculatePaidTrafficMetrics(data);

    expect(result.ctr).toBe('N/A');
    expect(result.cpc).toBe('N/A');
    expect(result.cpm).toBe('N/A');
    expect(result.cpe).toBe('N/A');
  });

  it('handles zero fee with positive denominators', () => {
    const data: JuguangAggregated = {
      ...baseJuguangData,
      totalFee: 0,
    };

    const result = calculatePaidTrafficMetrics(data);

    expect(result.ctr).toBe(0.02); // ctr doesn't use fee
    expect(result.cpc).toBe(0);
    expect(result.cpm).toBe(0);
    expect(result.cpe).toBe(0);
  });
});
