import { describe, it, expect } from 'vitest';
import { identifyHighlights } from '../../src/calculation/highlights';
import type { ProjectMetrics, BenchmarkData, KPITargets } from '../../src/shared/types';

function makeMetrics(overrides: Partial<ProjectMetrics> = {}): ProjectMetrics {
  return {
    totalImpressions: 100000,
    totalReads: 50000,
    totalEngagement: 10000,
    viralCount: 5,
    viralRate: 0.1,
    cpm: 50,
    cpc: 2,
    cpe: 5,
    ctr: 0.5,
    totalCost: 5000,
    ...overrides,
  };
}

describe('identifyHighlights', () => {
  describe('KPI exceeded highlights', () => {
    it('identifies non-cost metric exceeding KPI target', () => {
      const metrics = makeMetrics({ totalImpressions: 150000 });
      const benchmarks: BenchmarkData = {};
      const kpiTargets: KPITargets = { impression: 100000 };

      const highlights = identifyHighlights(metrics, benchmarks, kpiTargets);

      const kpiHighlights = highlights.filter(h => h.type === 'kpi_exceeded');
      expect(kpiHighlights).toHaveLength(1);
      expect(kpiHighlights[0].metric).toBe('曝光量');
      expect(kpiHighlights[0].value).toBe(150000);
      expect(kpiHighlights[0].comparison).toBe(100000);
    });

    it('identifies cost metric beating KPI target (lower actual is better)', () => {
      const metrics = makeMetrics({ cpm: 30 });
      const benchmarks: BenchmarkData = {};
      const kpiTargets: KPITargets = { cpm: 50 };

      const highlights = identifyHighlights(metrics, benchmarks, kpiTargets);

      const kpiHighlights = highlights.filter(h => h.type === 'kpi_exceeded');
      expect(kpiHighlights).toHaveLength(1);
      expect(kpiHighlights[0].metric).toBe('CPM');
      expect(kpiHighlights[0].value).toBe(30);
      expect(kpiHighlights[0].comparison).toBe(50);
    });

    it('does not include non-cost metric that does not exceed target', () => {
      const metrics = makeMetrics({ totalImpressions: 80000 });
      const benchmarks: BenchmarkData = {};
      const kpiTargets: KPITargets = { impression: 100000 };

      const highlights = identifyHighlights(metrics, benchmarks, kpiTargets);

      const kpiHighlights = highlights.filter(h => h.type === 'kpi_exceeded');
      expect(kpiHighlights).toHaveLength(0);
    });

    it('does not include cost metric that does not beat target', () => {
      const metrics = makeMetrics({ cpm: 60 });
      const benchmarks: BenchmarkData = {};
      const kpiTargets: KPITargets = { cpm: 50 };

      const highlights = identifyHighlights(metrics, benchmarks, kpiTargets);

      const kpiHighlights = highlights.filter(h => h.type === 'kpi_exceeded');
      expect(kpiHighlights).toHaveLength(0);
    });

    it('does not include metric exactly at target (non-cost)', () => {
      const metrics = makeMetrics({ totalImpressions: 100000 });
      const benchmarks: BenchmarkData = {};
      const kpiTargets: KPITargets = { impression: 100000 };

      const highlights = identifyHighlights(metrics, benchmarks, kpiTargets);

      const kpiHighlights = highlights.filter(h => h.type === 'kpi_exceeded');
      expect(kpiHighlights).toHaveLength(0);
    });

    it('does not include metric exactly at target (cost)', () => {
      const metrics = makeMetrics({ cpm: 50 });
      const benchmarks: BenchmarkData = {};
      const kpiTargets: KPITargets = { cpm: 50 };

      const highlights = identifyHighlights(metrics, benchmarks, kpiTargets);

      const kpiHighlights = highlights.filter(h => h.type === 'kpi_exceeded');
      expect(kpiHighlights).toHaveLength(0);
    });

    it('skips metrics with N/A actual value', () => {
      const metrics = makeMetrics({ cpm: 'N/A' });
      const benchmarks: BenchmarkData = {};
      const kpiTargets: KPITargets = { cpm: 50 };

      const highlights = identifyHighlights(metrics, benchmarks, kpiTargets);

      const kpiHighlights = highlights.filter(h => h.type === 'kpi_exceeded');
      expect(kpiHighlights).toHaveLength(0);
    });

    it('skips metrics with zero or undefined target', () => {
      const metrics = makeMetrics({ totalImpressions: 150000 });
      const benchmarks: BenchmarkData = {};
      const kpiTargets: KPITargets = { impression: 0 };

      const highlights = identifyHighlights(metrics, benchmarks, kpiTargets);

      const kpiHighlights = highlights.filter(h => h.type === 'kpi_exceeded');
      expect(kpiHighlights).toHaveLength(0);
    });

    it('identifies multiple KPI exceeded metrics', () => {
      const metrics = makeMetrics({
        totalImpressions: 200000,
        totalReads: 80000,
        cpm: 20,
      });
      const benchmarks: BenchmarkData = {};
      const kpiTargets: KPITargets = {
        impression: 100000,
        read: 50000,
        cpm: 50,
      };

      const highlights = identifyHighlights(metrics, benchmarks, kpiTargets);

      const kpiHighlights = highlights.filter(h => h.type === 'kpi_exceeded');
      expect(kpiHighlights).toHaveLength(3);
    });

    it('handles CTR as non-cost metric', () => {
      const metrics = makeMetrics({ ctr: 0.8 });
      const benchmarks: BenchmarkData = {};
      const kpiTargets: KPITargets = { ctr: 0.5 };

      const highlights = identifyHighlights(metrics, benchmarks, kpiTargets);

      const kpiHighlights = highlights.filter(h => h.type === 'kpi_exceeded');
      expect(kpiHighlights).toHaveLength(1);
      expect(kpiHighlights[0].metric).toBe('CTR');
    });
  });

  describe('Above benchmark highlights', () => {
    it('identifies non-cost metric above benchmark (CTR)', () => {
      const metrics = makeMetrics({ ctr: 0.6 });
      const benchmarks: BenchmarkData = { ctr: 0.4 };
      const kpiTargets: KPITargets = {};

      const highlights = identifyHighlights(metrics, benchmarks, kpiTargets);

      const benchHighlights = highlights.filter(h => h.type === 'above_benchmark');
      expect(benchHighlights).toHaveLength(1);
      expect(benchHighlights[0].metric).toBe('CTR');
      expect(benchHighlights[0].value).toBe(0.6);
      expect(benchHighlights[0].comparison).toBe(0.4);
    });

    it('identifies non-cost metric above benchmark (viralRate)', () => {
      const metrics = makeMetrics({ viralRate: 0.15 });
      const benchmarks: BenchmarkData = { viralRate: 0.1 };
      const kpiTargets: KPITargets = {};

      const highlights = identifyHighlights(metrics, benchmarks, kpiTargets);

      const benchHighlights = highlights.filter(h => h.type === 'above_benchmark');
      expect(benchHighlights).toHaveLength(1);
      expect(benchHighlights[0].metric).toBe('爆文率');
    });

    it('identifies cost metric below benchmark (CPM lower is better)', () => {
      const metrics = makeMetrics({ cpm: 30 });
      const benchmarks: BenchmarkData = { cpm: 50 };
      const kpiTargets: KPITargets = {};

      const highlights = identifyHighlights(metrics, benchmarks, kpiTargets);

      const benchHighlights = highlights.filter(h => h.type === 'above_benchmark');
      expect(benchHighlights).toHaveLength(1);
      expect(benchHighlights[0].metric).toBe('CPM');
      expect(benchHighlights[0].value).toBe(30);
      expect(benchHighlights[0].comparison).toBe(50);
    });

    it('does not include non-cost metric at or below benchmark', () => {
      const metrics = makeMetrics({ ctr: 0.4 });
      const benchmarks: BenchmarkData = { ctr: 0.4 };
      const kpiTargets: KPITargets = {};

      const highlights = identifyHighlights(metrics, benchmarks, kpiTargets);

      const benchHighlights = highlights.filter(h => h.type === 'above_benchmark');
      expect(benchHighlights).toHaveLength(0);
    });

    it('does not include cost metric at or above benchmark', () => {
      const metrics = makeMetrics({ cpm: 50 });
      const benchmarks: BenchmarkData = { cpm: 50 };
      const kpiTargets: KPITargets = {};

      const highlights = identifyHighlights(metrics, benchmarks, kpiTargets);

      const benchHighlights = highlights.filter(h => h.type === 'above_benchmark');
      expect(benchHighlights).toHaveLength(0);
    });

    it('skips metrics with N/A actual value', () => {
      const metrics = makeMetrics({ ctr: 'N/A' });
      const benchmarks: BenchmarkData = { ctr: 0.4 };
      const kpiTargets: KPITargets = {};

      const highlights = identifyHighlights(metrics, benchmarks, kpiTargets);

      const benchHighlights = highlights.filter(h => h.type === 'above_benchmark');
      expect(benchHighlights).toHaveLength(0);
    });

    it('skips benchmarks that are not set', () => {
      const metrics = makeMetrics({ ctr: 0.6 });
      const benchmarks: BenchmarkData = {};
      const kpiTargets: KPITargets = {};

      const highlights = identifyHighlights(metrics, benchmarks, kpiTargets);

      const benchHighlights = highlights.filter(h => h.type === 'above_benchmark');
      expect(benchHighlights).toHaveLength(0);
    });

    it('identifies multiple above-benchmark metrics', () => {
      const metrics = makeMetrics({ ctr: 0.6, cpm: 30, cpc: 1 });
      const benchmarks: BenchmarkData = { ctr: 0.4, cpm: 50, cpc: 2 };
      const kpiTargets: KPITargets = {};

      const highlights = identifyHighlights(metrics, benchmarks, kpiTargets);

      const benchHighlights = highlights.filter(h => h.type === 'above_benchmark');
      expect(benchHighlights).toHaveLength(3);
    });
  });

  describe('Post better than pre highlights', () => {
    it('identifies metric where post > pre', () => {
      const metrics = makeMetrics({
        preCampaign: { brandAwareness: 50 },
        postCampaign: { brandAwareness: 80 },
      });
      const benchmarks: BenchmarkData = {};
      const kpiTargets: KPITargets = {};

      const highlights = identifyHighlights(metrics, benchmarks, kpiTargets);

      const postHighlights = highlights.filter(h => h.type === 'post_better_than_pre');
      expect(postHighlights).toHaveLength(1);
      expect(postHighlights[0].metric).toBe('brandAwareness');
      expect(postHighlights[0].value).toBe(80);
      expect(postHighlights[0].comparison).toBe(50);
    });

    it('does not include metric where post <= pre', () => {
      const metrics = makeMetrics({
        preCampaign: { brandAwareness: 80 },
        postCampaign: { brandAwareness: 60 },
      });
      const benchmarks: BenchmarkData = {};
      const kpiTargets: KPITargets = {};

      const highlights = identifyHighlights(metrics, benchmarks, kpiTargets);

      const postHighlights = highlights.filter(h => h.type === 'post_better_than_pre');
      expect(postHighlights).toHaveLength(0);
    });

    it('does not include metric where post equals pre', () => {
      const metrics = makeMetrics({
        preCampaign: { brandAwareness: 50 },
        postCampaign: { brandAwareness: 50 },
      });
      const benchmarks: BenchmarkData = {};
      const kpiTargets: KPITargets = {};

      const highlights = identifyHighlights(metrics, benchmarks, kpiTargets);

      const postHighlights = highlights.filter(h => h.type === 'post_better_than_pre');
      expect(postHighlights).toHaveLength(0);
    });

    it('returns no highlights when preCampaign is missing', () => {
      const metrics = makeMetrics({
        postCampaign: { brandAwareness: 80 },
      });
      const benchmarks: BenchmarkData = {};
      const kpiTargets: KPITargets = {};

      const highlights = identifyHighlights(metrics, benchmarks, kpiTargets);

      const postHighlights = highlights.filter(h => h.type === 'post_better_than_pre');
      expect(postHighlights).toHaveLength(0);
    });

    it('returns no highlights when postCampaign is missing', () => {
      const metrics = makeMetrics({
        preCampaign: { brandAwareness: 50 },
      });
      const benchmarks: BenchmarkData = {};
      const kpiTargets: KPITargets = {};

      const highlights = identifyHighlights(metrics, benchmarks, kpiTargets);

      const postHighlights = highlights.filter(h => h.type === 'post_better_than_pre');
      expect(postHighlights).toHaveLength(0);
    });

    it('only compares metrics present in both pre and post', () => {
      const metrics = makeMetrics({
        preCampaign: { brandAwareness: 50 },
        postCampaign: { brandAwareness: 80, newMetric: 100 },
      });
      const benchmarks: BenchmarkData = {};
      const kpiTargets: KPITargets = {};

      const highlights = identifyHighlights(metrics, benchmarks, kpiTargets);

      const postHighlights = highlights.filter(h => h.type === 'post_better_than_pre');
      expect(postHighlights).toHaveLength(1);
      expect(postHighlights[0].metric).toBe('brandAwareness');
    });

    it('identifies multiple post > pre metrics', () => {
      const metrics = makeMetrics({
        preCampaign: { brandAwareness: 50, searchIndex: 100 },
        postCampaign: { brandAwareness: 80, searchIndex: 150 },
      });
      const benchmarks: BenchmarkData = {};
      const kpiTargets: KPITargets = {};

      const highlights = identifyHighlights(metrics, benchmarks, kpiTargets);

      const postHighlights = highlights.filter(h => h.type === 'post_better_than_pre');
      expect(postHighlights).toHaveLength(2);
    });
  });

  describe('combined scenarios', () => {
    it('returns empty array when no criteria are met', () => {
      const metrics = makeMetrics({
        totalImpressions: 50000,
        cpm: 80,
        ctr: 0.3,
      });
      const benchmarks: BenchmarkData = { ctr: 0.5, cpm: 50 };
      const kpiTargets: KPITargets = { impression: 100000, cpm: 40 };

      const highlights = identifyHighlights(metrics, benchmarks, kpiTargets);

      expect(highlights).toHaveLength(0);
    });

    it('identifies highlights from all three categories simultaneously', () => {
      const metrics = makeMetrics({
        totalImpressions: 200000,
        ctr: 0.6,
        cpm: 30,
        preCampaign: { brandAwareness: 50 },
        postCampaign: { brandAwareness: 80 },
      });
      const benchmarks: BenchmarkData = { ctr: 0.4 };
      const kpiTargets: KPITargets = { impression: 100000 };

      const highlights = identifyHighlights(metrics, benchmarks, kpiTargets);

      const types = highlights.map(h => h.type);
      expect(types).toContain('kpi_exceeded');
      expect(types).toContain('above_benchmark');
      expect(types).toContain('post_better_than_pre');
    });

    it('handles all metrics being N/A gracefully', () => {
      const metrics = makeMetrics({
        cpm: 'N/A',
        cpc: 'N/A',
        cpe: 'N/A',
        ctr: 'N/A',
      });
      const benchmarks: BenchmarkData = { cpm: 50, cpc: 2, cpe: 5, ctr: 0.4 };
      const kpiTargets: KPITargets = { cpm: 50, cpc: 2, cpe: 5, ctr: 0.4 };

      const highlights = identifyHighlights(metrics, benchmarks, kpiTargets);

      // Only non-N/A metrics (impressions, reads, engagement, viralCount, viralRate) could qualify
      const kpiHighlights = highlights.filter(h => h.type === 'kpi_exceeded');
      const benchHighlights = highlights.filter(h => h.type === 'above_benchmark');
      // No benchmark or KPI highlights for N/A metrics
      expect(benchHighlights).toHaveLength(0);
      // kpiHighlights should not include any N/A metrics
      for (const h of kpiHighlights) {
        expect(['CPM', 'CPC', 'CPE', 'CTR']).not.toContain(h.metric);
      }
    });
  });
});
