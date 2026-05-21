import { describe, it, expect } from 'vitest';
import { ratioToRating, computeRatio, rateMetric, rateAllMetrics, COST_METRICS } from '../../src/engines/rating';

describe('ratioToRating', () => {
  describe('threshold boundaries', () => {
    it('returns S for ratio exactly at 1.5', () => {
      expect(ratioToRating(1.5)).toBe('S');
    });

    it('returns A for ratio exactly at 1.2', () => {
      expect(ratioToRating(1.2)).toBe('A');
    });

    it('returns B for ratio exactly at 1.0', () => {
      expect(ratioToRating(1.0)).toBe('B');
    });

    it('returns C for ratio exactly at 0.8', () => {
      expect(ratioToRating(0.8)).toBe('C');
    });

    it('returns D for ratio just below 0.8', () => {
      expect(ratioToRating(0.79)).toBe('D');
    });

    it('returns A for ratio just below 1.5', () => {
      expect(ratioToRating(1.49)).toBe('A');
    });

    it('returns B for ratio just below 1.2', () => {
      expect(ratioToRating(1.19)).toBe('B');
    });

    it('returns C for ratio just below 1.0', () => {
      expect(ratioToRating(0.99)).toBe('C');
    });
  });

  describe('edge cases', () => {
    it('returns D for ratio = 0', () => {
      expect(ratioToRating(0)).toBe('D');
    });

    it('returns D for negative values', () => {
      expect(ratioToRating(-1)).toBe('D');
      expect(ratioToRating(-0.5)).toBe('D');
      expect(ratioToRating(-100)).toBe('D');
    });

    it('returns S for extremely large values', () => {
      expect(ratioToRating(100)).toBe('S');
      expect(ratioToRating(999999)).toBe('S');
      expect(ratioToRating(Number.MAX_SAFE_INTEGER)).toBe('S');
    });
  });

  describe('typical values', () => {
    it('returns S for ratio 2.0', () => {
      expect(ratioToRating(2.0)).toBe('S');
    });

    it('returns A for ratio 1.3', () => {
      expect(ratioToRating(1.3)).toBe('A');
    });

    it('returns B for ratio 1.1', () => {
      expect(ratioToRating(1.1)).toBe('B');
    });

    it('returns C for ratio 0.9', () => {
      expect(ratioToRating(0.9)).toBe('C');
    });

    it('returns D for ratio 0.5', () => {
      expect(ratioToRating(0.5)).toBe('D');
    });
  });
});


describe('COST_METRICS', () => {
  it('contains CPE, CPM, CPC', () => {
    expect(COST_METRICS).toContain('CPE');
    expect(COST_METRICS).toContain('CPM');
    expect(COST_METRICS).toContain('CPC');
  });

  it('has exactly 3 entries', () => {
    expect(COST_METRICS).toHaveLength(3);
  });
});

describe('computeRatio', () => {
  describe('cost metrics (isCostMetric = true)', () => {
    it('computes comparisonValue / actualValue', () => {
      // target=10, actual=5 → ratio=2.0 (actual is half the target, great performance)
      expect(computeRatio(5, 10, true)).toBe(2.0);
    });

    it('returns ratio < 1 when actual exceeds target (bad for cost)', () => {
      // target=10, actual=20 → ratio=0.5 (actual is double the target, poor)
      expect(computeRatio(20, 10, true)).toBe(0.5);
    });

    it('returns ratio = 1 when actual equals target', () => {
      expect(computeRatio(10, 10, true)).toBe(1.0);
    });

    it('returns null when actualValue is 0 (division by zero)', () => {
      expect(computeRatio(0, 10, true)).toBeNull();
    });

    it('handles comparisonValue = 0 (returns 0, not null)', () => {
      // target=0, actual=5 → ratio=0 (valid computation)
      expect(computeRatio(5, 0, true)).toBe(0);
    });
  });

  describe('non-cost metrics (isCostMetric = false)', () => {
    it('computes actualValue / comparisonValue', () => {
      // actual=150, target=100 → ratio=1.5 (exceeded target by 50%)
      expect(computeRatio(150, 100, false)).toBe(1.5);
    });

    it('returns ratio < 1 when actual is below target', () => {
      // actual=80, target=100 → ratio=0.8
      expect(computeRatio(80, 100, false)).toBe(0.8);
    });

    it('returns ratio = 1 when actual equals target', () => {
      expect(computeRatio(100, 100, false)).toBe(1.0);
    });

    it('returns null when comparisonValue is 0 (division by zero)', () => {
      expect(computeRatio(100, 0, false)).toBeNull();
    });

    it('handles actualValue = 0 (returns 0, not null)', () => {
      // actual=0, target=100 → ratio=0 (valid computation)
      expect(computeRatio(0, 100, false)).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('handles very small actual values for cost metrics', () => {
      // target=10, actual=0.001 → ratio=10000
      expect(computeRatio(0.001, 10, true)).toBeCloseTo(10000);
    });

    it('handles very small comparison values for non-cost metrics', () => {
      // actual=10, target=0.001 → ratio=10000
      expect(computeRatio(10, 0.001, false)).toBeCloseTo(10000);
    });

    it('handles negative actual values for cost metrics', () => {
      // Negative values are unusual but should compute without error
      expect(computeRatio(-5, 10, true)).toBe(-2);
    });
  });
});


describe('rateMetric', () => {
  describe('all 3 dimensions present', () => {
    it('computes all dimensions for a non-cost metric', () => {
      const result = rateMetric({
        metricName: 'CPE_Rate',
        actualValue: 150,
        isCostMetric: false,
        kpiTarget: 100,       // ratio = 150/100 = 1.5 → S
        benchmarkValue: 120,  // ratio = 150/120 = 1.25 → A
        preCampaignValue: 200, // ratio = 150/200 = 0.75 → D
      });

      expect(result.metricName).toBe('CPE_Rate');
      expect(result.isCostMetric).toBe(false);
      expect(result.dimensions).toHaveLength(3);

      expect(result.dimensions[0].dimension).toBe('vs_kpi');
      expect(result.dimensions[0].rating).toBe('S');
      expect(result.dimensions[0].ratio).toBeCloseTo(1.5);

      expect(result.dimensions[1].dimension).toBe('vs_benchmark');
      expect(result.dimensions[1].rating).toBe('A');
      expect(result.dimensions[1].ratio).toBeCloseTo(1.25);

      expect(result.dimensions[2].dimension).toBe('vs_pre_campaign');
      expect(result.dimensions[2].rating).toBe('D');
      expect(result.dimensions[2].ratio).toBeCloseTo(0.75);

      // Final rating = best of S, A, D → S
      expect(result.finalRating).toBe('S');
    });

    it('computes all dimensions for a cost metric', () => {
      const result = rateMetric({
        metricName: 'CPE',
        actualValue: 10,
        isCostMetric: true,
        kpiTarget: 15,         // ratio = 15/10 = 1.5 → S
        benchmarkValue: 12,    // ratio = 12/10 = 1.2 → A
        preCampaignValue: 8,   // ratio = 8/10 = 0.8 → C
      });

      expect(result.isCostMetric).toBe(true);
      expect(result.dimensions[0].rating).toBe('S');
      expect(result.dimensions[1].rating).toBe('A');
      expect(result.dimensions[2].rating).toBe('C');
      expect(result.finalRating).toBe('S');
    });
  });

  describe('some dimensions missing (null)', () => {
    it('handles missing kpiTarget', () => {
      const result = rateMetric({
        metricName: 'Engagement',
        actualValue: 100,
        isCostMetric: false,
        // kpiTarget is undefined
        benchmarkValue: 80,    // ratio = 100/80 = 1.25 → A
        preCampaignValue: 90,  // ratio = 100/90 ≈ 1.11 → B
      });

      expect(result.dimensions[0].rating).toBeNull(); // vs_kpi
      expect(result.dimensions[1].rating).toBe('A');   // vs_benchmark
      expect(result.dimensions[2].rating).toBe('B');   // vs_pre_campaign
      expect(result.finalRating).toBe('A');
    });

    it('handles missing benchmarkValue and preCampaignValue', () => {
      const result = rateMetric({
        metricName: 'Views',
        actualValue: 1000,
        isCostMetric: false,
        kpiTarget: 800, // ratio = 1000/800 = 1.25 → A
        // benchmarkValue undefined
        // preCampaignValue undefined
      });

      expect(result.dimensions[0].rating).toBe('A');
      expect(result.dimensions[1].rating).toBeNull();
      expect(result.dimensions[2].rating).toBeNull();
      expect(result.finalRating).toBe('A');
    });

    it('handles only preCampaignValue present', () => {
      const result = rateMetric({
        metricName: 'Clicks',
        actualValue: 50,
        isCostMetric: false,
        preCampaignValue: 50, // ratio = 50/50 = 1.0 → B
      });

      expect(result.dimensions[0].rating).toBeNull();
      expect(result.dimensions[1].rating).toBeNull();
      expect(result.dimensions[2].rating).toBe('B');
      expect(result.finalRating).toBe('B');
    });
  });

  describe('all dimensions missing → default C', () => {
    it('returns finalRating C when no comparison values provided', () => {
      const result = rateMetric({
        metricName: 'Impressions',
        actualValue: 5000,
        isCostMetric: false,
      });

      expect(result.dimensions[0].rating).toBeNull();
      expect(result.dimensions[1].rating).toBeNull();
      expect(result.dimensions[2].rating).toBeNull();
      expect(result.finalRating).toBe('C');
    });

    it('returns finalRating C for cost metric with no comparison values', () => {
      const result = rateMetric({
        metricName: 'CPC',
        actualValue: 2.5,
        isCostMetric: true,
      });

      expect(result.finalRating).toBe('C');
    });
  });

  describe('cost metric vs non-cost metric behavior', () => {
    it('cost metric: lower actual is better (ratio = comparison/actual)', () => {
      // CPM actual=5, kpi=10 → ratio = 10/5 = 2.0 → S (spending less than target)
      const result = rateMetric({
        metricName: 'CPM',
        actualValue: 5,
        isCostMetric: true,
        kpiTarget: 10,
      });

      expect(result.dimensions[0].ratio).toBeCloseTo(2.0);
      expect(result.dimensions[0].rating).toBe('S');
    });

    it('non-cost metric: higher actual is better (ratio = actual/comparison)', () => {
      // Engagement actual=200, kpi=100 → ratio = 200/100 = 2.0 → S
      const result = rateMetric({
        metricName: 'Engagement',
        actualValue: 200,
        isCostMetric: false,
        kpiTarget: 100,
      });

      expect(result.dimensions[0].ratio).toBeCloseTo(2.0);
      expect(result.dimensions[0].rating).toBe('S');
    });

    it('cost metric with actualValue=0 yields null dimension', () => {
      const result = rateMetric({
        metricName: 'CPC',
        actualValue: 0,
        isCostMetric: true,
        kpiTarget: 10,
        benchmarkValue: 8,
      });

      // Division by zero for cost metrics → null
      expect(result.dimensions[0].rating).toBeNull();
      expect(result.dimensions[1].rating).toBeNull();
      expect(result.finalRating).toBe('C'); // all null → default C
    });
  });

  describe('final rating picks the best dimension', () => {
    it('picks S when one dimension is S and others are lower', () => {
      const result = rateMetric({
        metricName: 'Views',
        actualValue: 150,
        isCostMetric: false,
        kpiTarget: 100,        // 1.5 → S
        benchmarkValue: 200,   // 0.75 → D
        preCampaignValue: 180, // 0.83 → C
      });

      expect(result.finalRating).toBe('S');
    });

    it('picks A when best dimension is A', () => {
      const result = rateMetric({
        metricName: 'Likes',
        actualValue: 120,
        isCostMetric: false,
        kpiTarget: 100,        // 1.2 → A
        benchmarkValue: 150,   // 0.8 → C
        preCampaignValue: 200, // 0.6 → D
      });

      expect(result.finalRating).toBe('A');
    });

    it('picks B when best dimension is B', () => {
      const result = rateMetric({
        metricName: 'Shares',
        actualValue: 100,
        isCostMetric: false,
        kpiTarget: 100,        // 1.0 → B
        benchmarkValue: 130,   // ~0.77 → D
      });

      expect(result.finalRating).toBe('B');
    });
  });
});

describe('rateAllMetrics', () => {
  it('processes multiple metrics in batch', () => {
    const results = rateAllMetrics([
      {
        metricName: 'Views',
        actualValue: 200,
        isCostMetric: false,
        kpiTarget: 100, // ratio=2.0 → S
      },
      {
        metricName: 'CPE',
        actualValue: 10,
        isCostMetric: true,
        kpiTarget: 8, // ratio=8/10=0.8 → C
      },
      {
        metricName: 'Engagement',
        actualValue: 50,
        isCostMetric: false,
        // no comparison values → default C
      },
    ]);

    expect(results).toHaveLength(3);
    expect(results[0].metricName).toBe('Views');
    expect(results[0].finalRating).toBe('S');
    expect(results[1].metricName).toBe('CPE');
    expect(results[1].finalRating).toBe('C');
    expect(results[2].metricName).toBe('Engagement');
    expect(results[2].finalRating).toBe('C');
  });

  it('returns empty array for empty input', () => {
    const results = rateAllMetrics([]);
    expect(results).toHaveLength(0);
  });
});
