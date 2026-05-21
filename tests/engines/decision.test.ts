import { describe, it, expect } from 'vitest';
import {
  countHighRatings,
  countLowRatings,
  hasHighCompetitorRating,
  isAdSpendSignificant,
  decideModuleVisibility,
  MODULE_REQUIRED_FIELDS,
  applyDegradation,
  isHighRating,
  isAcceptableRating,
  decidePlatformVisibility,
} from '../../src/engines/decision';
import { MetricRating, DecisionInput, ModuleId, ModuleStatus, Rating, PlatformDecision } from '../../src/engines/types';

// ---- Test Helpers ----

function makeMetricRating(metricName: string, finalRating: 'S' | 'A' | 'B' | 'C' | 'D'): MetricRating {
  return {
    metricName,
    isCostMetric: false,
    dimensions: [
      { dimension: 'vs_kpi', ratio: 1.0, rating: finalRating },
      { dimension: 'vs_benchmark', ratio: 1.0, rating: null },
      { dimension: 'vs_pre_campaign', ratio: 1.0, rating: null },
    ],
    finalRating,
  };
}

function makeDecisionInput(overrides: Partial<DecisionInput> = {}): DecisionInput {
  return {
    projectType: '日常种草',
    metricRatings: [],
    totalCost: 100000,
    juguangCost: 10000,
    dataCompleteness: {
      M1: [], M2: [], M3: [], M4: [], M5: [], M6: [], M7: [], M8: [],
    },
    ...overrides,
  };
}

// ---- Helper Function Tests ----

describe('countHighRatings', () => {
  it('returns 0 for empty array', () => {
    expect(countHighRatings([])).toBe(0);
  });

  it('counts S and A ratings', () => {
    const ratings = [
      makeMetricRating('CPE', 'S'),
      makeMetricRating('CPM', 'A'),
      makeMetricRating('CPC', 'B'),
      makeMetricRating('CTR', 'C'),
      makeMetricRating('VV', 'D'),
    ];
    expect(countHighRatings(ratings)).toBe(2);
  });

  it('counts all S ratings', () => {
    const ratings = [
      makeMetricRating('CPE', 'S'),
      makeMetricRating('CPM', 'S'),
      makeMetricRating('CPC', 'S'),
    ];
    expect(countHighRatings(ratings)).toBe(3);
  });

  it('returns 0 when no S or A ratings', () => {
    const ratings = [
      makeMetricRating('CPE', 'B'),
      makeMetricRating('CPM', 'C'),
      makeMetricRating('CPC', 'D'),
    ];
    expect(countHighRatings(ratings)).toBe(0);
  });
});

describe('countLowRatings', () => {
  it('returns 0 for empty array', () => {
    expect(countLowRatings([])).toBe(0);
  });

  it('counts C and D ratings', () => {
    const ratings = [
      makeMetricRating('CPE', 'S'),
      makeMetricRating('CPM', 'A'),
      makeMetricRating('CPC', 'B'),
      makeMetricRating('CTR', 'C'),
      makeMetricRating('VV', 'D'),
    ];
    expect(countLowRatings(ratings)).toBe(2);
  });

  it('returns 0 when no C or D ratings', () => {
    const ratings = [
      makeMetricRating('CPE', 'S'),
      makeMetricRating('CPM', 'A'),
      makeMetricRating('CPC', 'B'),
    ];
    expect(countLowRatings(ratings)).toBe(0);
  });
});

describe('hasHighCompetitorRating', () => {
  it('returns false for undefined', () => {
    expect(hasHighCompetitorRating(undefined)).toBe(false);
  });

  it('returns false for empty array', () => {
    expect(hasHighCompetitorRating([])).toBe(false);
  });

  it('returns true when at least one S rating exists', () => {
    const ratings = [
      makeMetricRating('SOV', 'S'),
      makeMetricRating('SOC', 'C'),
    ];
    expect(hasHighCompetitorRating(ratings)).toBe(true);
  });

  it('returns true when at least one A rating exists', () => {
    const ratings = [
      makeMetricRating('SOV', 'A'),
      makeMetricRating('SOC', 'D'),
    ];
    expect(hasHighCompetitorRating(ratings)).toBe(true);
  });

  it('returns false when all ratings are B/C/D', () => {
    const ratings = [
      makeMetricRating('SOV', 'B'),
      makeMetricRating('SOC', 'C'),
      makeMetricRating('Rank', 'D'),
    ];
    expect(hasHighCompetitorRating(ratings)).toBe(false);
  });
});

describe('isAdSpendSignificant', () => {
  it('returns false when totalCost is 0', () => {
    expect(isAdSpendSignificant(5000, 0)).toBe(false);
  });

  it('returns true when ratio > 0.2', () => {
    expect(isAdSpendSignificant(30000, 100000)).toBe(true); // 30%
  });

  it('returns false when ratio <= 0.2', () => {
    expect(isAdSpendSignificant(20000, 100000)).toBe(false); // exactly 20%
  });

  it('returns false when ratio < 0.2', () => {
    expect(isAdSpendSignificant(10000, 100000)).toBe(false); // 10%
  });

  it('returns true when ratio is just above 0.2', () => {
    expect(isAdSpendSignificant(20001, 100000)).toBe(true); // 20.001%
  });
});

// ---- Module Visibility Decision Tests ----

describe('decideModuleVisibility', () => {
  describe('M1 - 数据总览', () => {
    it('always shows M1 regardless of input', () => {
      const result = decideModuleVisibility(makeDecisionInput());
      expect(result.M1.status).toBe('show');
    });

    it('shows M1 even with empty ratings', () => {
      const result = decideModuleVisibility(makeDecisionInput({ metricRatings: [] }));
      expect(result.M1.status).toBe('show');
    });
  });

  describe('M2 - 项目回顾', () => {
    it('always shows M2', () => {
      const result = decideModuleVisibility(makeDecisionInput());
      expect(result.M2.status).toBe('show');
    });
  });

  describe('M3 - 项目亮点', () => {
    it('shows M3 when exactly 2 S/A ratings exist', () => {
      const ratings = [
        makeMetricRating('CPE', 'S'),
        makeMetricRating('CPM', 'A'),
        makeMetricRating('CPC', 'C'),
      ];
      const result = decideModuleVisibility(makeDecisionInput({ metricRatings: ratings }));
      expect(result.M3.status).toBe('show');
    });

    it('shows M3 when more than 2 S/A ratings exist', () => {
      const ratings = [
        makeMetricRating('CPE', 'S'),
        makeMetricRating('CPM', 'A'),
        makeMetricRating('CPC', 'S'),
      ];
      const result = decideModuleVisibility(makeDecisionInput({ metricRatings: ratings }));
      expect(result.M3.status).toBe('show');
    });

    it('hides M3 when only 1 S/A rating exists', () => {
      const ratings = [
        makeMetricRating('CPE', 'S'),
        makeMetricRating('CPM', 'B'),
        makeMetricRating('CPC', 'C'),
      ];
      const result = decideModuleVisibility(makeDecisionInput({ metricRatings: ratings }));
      expect(result.M3.status).toBe('hide');
    });

    it('hides M3 when no S/A ratings exist', () => {
      const ratings = [
        makeMetricRating('CPE', 'B'),
        makeMetricRating('CPM', 'C'),
      ];
      const result = decideModuleVisibility(makeDecisionInput({ metricRatings: ratings }));
      expect(result.M3.status).toBe('hide');
    });
  });

  describe('M4 - 未达预期项', () => {
    it('shows M4 when at least 1 C/D rating exists', () => {
      const ratings = [
        makeMetricRating('CPE', 'S'),
        makeMetricRating('CPM', 'C'),
      ];
      const result = decideModuleVisibility(makeDecisionInput({ metricRatings: ratings }));
      expect(result.M4.status).toBe('show');
    });

    it('hides M4 when no C/D ratings exist', () => {
      const ratings = [
        makeMetricRating('CPE', 'S'),
        makeMetricRating('CPM', 'A'),
        makeMetricRating('CPC', 'B'),
      ];
      const result = decideModuleVisibility(makeDecisionInput({ metricRatings: ratings }));
      expect(result.M4.status).toBe('hide');
    });
  });

  describe('M5 - 内容分析', () => {
    it('always shows M5', () => {
      const result = decideModuleVisibility(makeDecisionInput());
      expect(result.M5.status).toBe('show');
    });
  });

  describe('M6 - 竞品洞察', () => {
    it('shows M6 when competitor has S rating', () => {
      const competitorRatings = [makeMetricRating('SOV', 'S')];
      const result = decideModuleVisibility(makeDecisionInput({ competitorRatings }));
      expect(result.M6.status).toBe('show');
    });

    it('shows M6 when competitor has A rating', () => {
      const competitorRatings = [makeMetricRating('SOV', 'A')];
      const result = decideModuleVisibility(makeDecisionInput({ competitorRatings }));
      expect(result.M6.status).toBe('show');
    });

    it('hides M6 when no competitor ratings provided', () => {
      const result = decideModuleVisibility(makeDecisionInput({ competitorRatings: undefined }));
      expect(result.M6.status).toBe('hide');
    });

    it('hides M6 when all competitor ratings are B/C/D', () => {
      const competitorRatings = [
        makeMetricRating('SOV', 'B'),
        makeMetricRating('SOC', 'C'),
      ];
      const result = decideModuleVisibility(makeDecisionInput({ competitorRatings }));
      expect(result.M6.status).toBe('hide');
    });
  });

  describe('M7 - 投流分析', () => {
    it('shows M7 when juguangCost/totalCost > 0.2', () => {
      const result = decideModuleVisibility(makeDecisionInput({
        juguangCost: 30000,
        totalCost: 100000,
      }));
      expect(result.M7.status).toBe('show');
    });

    it('hides M7 when juguangCost/totalCost = 0.2 (boundary)', () => {
      const result = decideModuleVisibility(makeDecisionInput({
        juguangCost: 20000,
        totalCost: 100000,
      }));
      expect(result.M7.status).toBe('hide');
    });

    it('hides M7 when juguangCost/totalCost < 0.2', () => {
      const result = decideModuleVisibility(makeDecisionInput({
        juguangCost: 10000,
        totalCost: 100000,
      }));
      expect(result.M7.status).toBe('hide');
    });

    it('hides M7 when totalCost is 0', () => {
      const result = decideModuleVisibility(makeDecisionInput({
        juguangCost: 5000,
        totalCost: 0,
      }));
      expect(result.M7.status).toBe('hide');
    });
  });

  describe('M8 - 问题诊断与建议', () => {
    it('shows M8 when at least 1 C/D rating exists', () => {
      const ratings = [makeMetricRating('CPE', 'D')];
      const result = decideModuleVisibility(makeDecisionInput({ metricRatings: ratings }));
      expect(result.M8.status).toBe('show');
    });

    it('hides M8 when no C/D ratings exist', () => {
      const ratings = [
        makeMetricRating('CPE', 'S'),
        makeMetricRating('CPM', 'B'),
      ];
      const result = decideModuleVisibility(makeDecisionInput({ metricRatings: ratings }));
      expect(result.M8.status).toBe('hide');
    });
  });

  describe('empty ratings list - conservative defaults', () => {
    it('with empty ratings: M1, M2, M5 show; M3, M4, M6, M7, M8 hide', () => {
      const result = decideModuleVisibility(makeDecisionInput({
        metricRatings: [],
        competitorRatings: undefined,
        juguangCost: 0,
        totalCost: 0,
      }));
      expect(result.M1.status).toBe('show');
      expect(result.M2.status).toBe('show');
      expect(result.M3.status).toBe('hide');
      expect(result.M4.status).toBe('hide');
      expect(result.M5.status).toBe('show');
      expect(result.M6.status).toBe('hide');
      expect(result.M7.status).toBe('hide');
      expect(result.M8.status).toBe('hide');
    });
  });

  describe('all modules have reasons', () => {
    it('every module decision includes a non-empty reason', () => {
      const result = decideModuleVisibility(makeDecisionInput({
        metricRatings: [
          makeMetricRating('CPE', 'S'),
          makeMetricRating('CPM', 'A'),
          makeMetricRating('CPC', 'D'),
        ],
        competitorRatings: [makeMetricRating('SOV', 'A')],
        juguangCost: 30000,
        totalCost: 100000,
      }));

      const moduleIds: ModuleId[] = ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8'];
      for (const id of moduleIds) {
        expect(result[id].reason).toBeTruthy();
        expect(result[id].reason.length).toBeGreaterThan(0);
      }
    });
  });
});


// ---- Module Required Fields Tests ----

describe('MODULE_REQUIRED_FIELDS', () => {
  it('defines required fields for all 8 modules', () => {
    const moduleIds: ModuleId[] = ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8'];
    for (const id of moduleIds) {
      expect(MODULE_REQUIRED_FIELDS[id]).toBeDefined();
      expect(MODULE_REQUIRED_FIELDS[id].length).toBeGreaterThan(0);
    }
  });

  it('M1 requires totalImpressions, totalEngagement, totalCost, totalNotes', () => {
    expect(MODULE_REQUIRED_FIELDS.M1).toEqual(['totalImpressions', 'totalEngagement', 'totalCost', 'totalNotes']);
  });

  it('M2 requires projectBackground, strategy, targetAudience', () => {
    expect(MODULE_REQUIRED_FIELDS.M2).toEqual(['projectBackground', 'strategy', 'targetAudience']);
  });

  it('M3 requires topMetrics', () => {
    expect(MODULE_REQUIRED_FIELDS.M3).toEqual(['topMetrics']);
  });

  it('M4 requires underperformingMetrics', () => {
    expect(MODULE_REQUIRED_FIELDS.M4).toEqual(['underperformingMetrics']);
  });

  it('M5 requires contentBreakdown, notePerformance', () => {
    expect(MODULE_REQUIRED_FIELDS.M5).toEqual(['contentBreakdown', 'notePerformance']);
  });

  it('M6 requires competitorData, marketShare', () => {
    expect(MODULE_REQUIRED_FIELDS.M6).toEqual(['competitorData', 'marketShare']);
  });

  it('M7 requires adSpendData, adPerformance, roi', () => {
    expect(MODULE_REQUIRED_FIELDS.M7).toEqual(['adSpendData', 'adPerformance', 'roi']);
  });

  it('M8 requires diagnosticData, recommendations', () => {
    expect(MODULE_REQUIRED_FIELDS.M8).toEqual(['diagnosticData', 'recommendations']);
  });
});

// ---- applyDegradation Tests ----

describe('applyDegradation', () => {
  describe('when currentStatus is hide', () => {
    it('keeps status as hide regardless of available fields', () => {
      const result = applyDegradation('M1', ['totalImpressions', 'totalEngagement', 'totalCost', 'totalNotes'], 'hide');
      expect(result.status).toBe('hide');
      expect(result.degradedFields).toBeUndefined();
    });

    it('keeps status as hide even with no available fields', () => {
      const result = applyDegradation('M3', [], 'hide');
      expect(result.status).toBe('hide');
    });
  });

  describe('when all required fields are present', () => {
    it('keeps currentStatus as show for M1', () => {
      const result = applyDegradation('M1', ['totalImpressions', 'totalEngagement', 'totalCost', 'totalNotes'], 'show');
      expect(result.status).toBe('show');
      expect(result.degradedFields).toBeUndefined();
    });

    it('keeps currentStatus as show for M3 with single required field', () => {
      const result = applyDegradation('M3', ['topMetrics'], 'show');
      expect(result.status).toBe('show');
      expect(result.degradedFields).toBeUndefined();
    });

    it('keeps currentStatus as degraded if already degraded and all fields present', () => {
      const result = applyDegradation('M2', ['projectBackground', 'strategy', 'targetAudience'], 'degraded');
      expect(result.status).toBe('degraded');
      expect(result.degradedFields).toBeUndefined();
    });

    it('handles extra available fields beyond required ones', () => {
      const result = applyDegradation('M3', ['topMetrics', 'extraField1', 'extraField2'], 'show');
      expect(result.status).toBe('show');
      expect(result.degradedFields).toBeUndefined();
    });
  });

  describe('when some (but not all) required fields are present', () => {
    it('returns degraded with missing fields for M1', () => {
      const result = applyDegradation('M1', ['totalImpressions', 'totalCost'], 'show');
      expect(result.status).toBe('degraded');
      expect(result.degradedFields).toEqual(['totalEngagement', 'totalNotes']);
    });

    it('returns degraded with missing fields for M2', () => {
      const result = applyDegradation('M2', ['projectBackground'], 'show');
      expect(result.status).toBe('degraded');
      expect(result.degradedFields).toEqual(['strategy', 'targetAudience']);
    });

    it('returns degraded with missing fields for M5', () => {
      const result = applyDegradation('M5', ['contentBreakdown'], 'show');
      expect(result.status).toBe('degraded');
      expect(result.degradedFields).toEqual(['notePerformance']);
    });

    it('returns degraded with missing fields for M7', () => {
      const result = applyDegradation('M7', ['adSpendData', 'roi'], 'show');
      expect(result.status).toBe('degraded');
      expect(result.degradedFields).toEqual(['adPerformance']);
    });

    it('returns degraded even if currentStatus was show', () => {
      const result = applyDegradation('M6', ['competitorData'], 'show');
      expect(result.status).toBe('degraded');
      expect(result.degradedFields).toEqual(['marketShare']);
    });

    it('returns degraded with single missing field for M8', () => {
      const result = applyDegradation('M8', ['diagnosticData'], 'show');
      expect(result.status).toBe('degraded');
      expect(result.degradedFields).toEqual(['recommendations']);
    });
  });

  describe('when no required fields are present', () => {
    it('returns hide for M1 with empty available fields', () => {
      const result = applyDegradation('M1', [], 'show');
      expect(result.status).toBe('hide');
      expect(result.degradedFields).toBeUndefined();
    });

    it('returns hide for M2 with unrelated fields', () => {
      const result = applyDegradation('M2', ['unrelatedField1', 'unrelatedField2'], 'show');
      expect(result.status).toBe('hide');
      expect(result.degradedFields).toBeUndefined();
    });

    it('returns hide for M7 with no matching fields', () => {
      const result = applyDegradation('M7', ['totalCost', 'totalImpressions'], 'show');
      expect(result.status).toBe('hide');
      expect(result.degradedFields).toBeUndefined();
    });

    it('returns hide for M3 with empty available fields', () => {
      const result = applyDegradation('M3', [], 'show');
      expect(result.status).toBe('hide');
      expect(result.degradedFields).toBeUndefined();
    });
  });
});


// ---- Platform Rating Helper Tests ----

describe('isHighRating', () => {
  it('returns true for S', () => {
    expect(isHighRating('S')).toBe(true);
  });

  it('returns true for A', () => {
    expect(isHighRating('A')).toBe(true);
  });

  it('returns false for B', () => {
    expect(isHighRating('B')).toBe(false);
  });

  it('returns false for C', () => {
    expect(isHighRating('C')).toBe(false);
  });

  it('returns false for D', () => {
    expect(isHighRating('D')).toBe(false);
  });
});

describe('isAcceptableRating', () => {
  it('returns true for S', () => {
    expect(isAcceptableRating('S')).toBe(true);
  });

  it('returns true for A', () => {
    expect(isAcceptableRating('A')).toBe(true);
  });

  it('returns true for B', () => {
    expect(isAcceptableRating('B')).toBe(true);
  });

  it('returns false for C', () => {
    expect(isAcceptableRating('C')).toBe(false);
  });

  it('returns false for D', () => {
    expect(isAcceptableRating('D')).toBe(false);
  });
});

// ---- Platform Visibility Decision Tests ----

describe('decidePlatformVisibility', () => {
  describe('when platformRatings is undefined', () => {
    it('returns empty array', () => {
      const result = decidePlatformVisibility(undefined);
      expect(result).toEqual([]);
    });
  });

  describe('when platformRatings is empty object', () => {
    it('returns empty array', () => {
      const result = decidePlatformVisibility({});
      expect(result).toEqual([]);
    });
  });

  describe('Pugongying (蒲公英)', () => {
    it('shows when viralRate=S and cpe=S', () => {
      const result = decidePlatformVisibility({
        pugongying: { viralRate: 'S', cpe: 'S' },
      });
      const pgy = result.find((d) => d.platform === 'pugongying');
      expect(pgy?.show).toBe(true);
    });

    it('shows when viralRate=A and cpe=B', () => {
      const result = decidePlatformVisibility({
        pugongying: { viralRate: 'A', cpe: 'B' },
      });
      const pgy = result.find((d) => d.platform === 'pugongying');
      expect(pgy?.show).toBe(true);
    });

    it('shows when viralRate=S and cpe=A', () => {
      const result = decidePlatformVisibility({
        pugongying: { viralRate: 'S', cpe: 'A' },
      });
      const pgy = result.find((d) => d.platform === 'pugongying');
      expect(pgy?.show).toBe(true);
    });

    it('hides when viralRate=B (not S/A)', () => {
      const result = decidePlatformVisibility({
        pugongying: { viralRate: 'B', cpe: 'S' },
      });
      const pgy = result.find((d) => d.platform === 'pugongying');
      expect(pgy?.show).toBe(false);
    });

    it('hides when cpe=C (not S/A/B)', () => {
      const result = decidePlatformVisibility({
        pugongying: { viralRate: 'S', cpe: 'C' },
      });
      const pgy = result.find((d) => d.platform === 'pugongying');
      expect(pgy?.show).toBe(false);
    });

    it('hides when cpe=D (not S/A/B)', () => {
      const result = decidePlatformVisibility({
        pugongying: { viralRate: 'A', cpe: 'D' },
      });
      const pgy = result.find((d) => d.platform === 'pugongying');
      expect(pgy?.show).toBe(false);
    });

    it('hides when both viralRate=C and cpe=D', () => {
      const result = decidePlatformVisibility({
        pugongying: { viralRate: 'C', cpe: 'D' },
      });
      const pgy = result.find((d) => d.platform === 'pugongying');
      expect(pgy?.show).toBe(false);
    });

    it('includes a non-empty reason', () => {
      const result = decidePlatformVisibility({
        pugongying: { viralRate: 'S', cpe: 'A' },
      });
      const pgy = result.find((d) => d.platform === 'pugongying');
      expect(pgy?.reason).toBeTruthy();
      expect(pgy!.reason.length).toBeGreaterThan(0);
    });
  });

  describe('Juguang (聚光)', () => {
    it('shows when searchRate=S, ctr=S, cpeBenchmark=true', () => {
      const result = decidePlatformVisibility({
        juguang: { searchRate: 'S', ctr: 'S', cpeBenchmark: true },
      });
      const jg = result.find((d) => d.platform === 'juguang');
      expect(jg?.show).toBe(true);
    });

    it('shows when searchRate=A, ctr=B, cpeBenchmark=true', () => {
      const result = decidePlatformVisibility({
        juguang: { searchRate: 'A', ctr: 'B', cpeBenchmark: true },
      });
      const jg = result.find((d) => d.platform === 'juguang');
      expect(jg?.show).toBe(true);
    });

    it('hides when searchRate=B (not S/A)', () => {
      const result = decidePlatformVisibility({
        juguang: { searchRate: 'B', ctr: 'S', cpeBenchmark: true },
      });
      const jg = result.find((d) => d.platform === 'juguang');
      expect(jg?.show).toBe(false);
    });

    it('hides when ctr=C (not S/A/B)', () => {
      const result = decidePlatformVisibility({
        juguang: { searchRate: 'S', ctr: 'C', cpeBenchmark: true },
      });
      const jg = result.find((d) => d.platform === 'juguang');
      expect(jg?.show).toBe(false);
    });

    it('hides when cpeBenchmark=false', () => {
      const result = decidePlatformVisibility({
        juguang: { searchRate: 'S', ctr: 'S', cpeBenchmark: false },
      });
      const jg = result.find((d) => d.platform === 'juguang');
      expect(jg?.show).toBe(false);
    });

    it('hides when all conditions fail', () => {
      const result = decidePlatformVisibility({
        juguang: { searchRate: 'D', ctr: 'D', cpeBenchmark: false },
      });
      const jg = result.find((d) => d.platform === 'juguang');
      expect(jg?.show).toBe(false);
    });

    it('includes a non-empty reason', () => {
      const result = decidePlatformVisibility({
        juguang: { searchRate: 'A', ctr: 'A', cpeBenchmark: true },
      });
      const jg = result.find((d) => d.platform === 'juguang');
      expect(jg?.reason).toBeTruthy();
    });
  });

  describe('Qiangua (千瓜)', () => {
    it('shows when brandRank=1', () => {
      const result = decidePlatformVisibility({
        qiangua: { brandRank: 1 },
      });
      const qg = result.find((d) => d.platform === 'qiangua');
      expect(qg?.show).toBe(true);
    });

    it('shows when brandRank=10 (boundary)', () => {
      const result = decidePlatformVisibility({
        qiangua: { brandRank: 10 },
      });
      const qg = result.find((d) => d.platform === 'qiangua');
      expect(qg?.show).toBe(true);
    });

    it('hides when brandRank=11', () => {
      const result = decidePlatformVisibility({
        qiangua: { brandRank: 11 },
      });
      const qg = result.find((d) => d.platform === 'qiangua');
      expect(qg?.show).toBe(false);
    });

    it('hides when brandRank=100', () => {
      const result = decidePlatformVisibility({
        qiangua: { brandRank: 100 },
      });
      const qg = result.find((d) => d.platform === 'qiangua');
      expect(qg?.show).toBe(false);
    });

    it('shows when brandRank=5', () => {
      const result = decidePlatformVisibility({
        qiangua: { brandRank: 5 },
      });
      const qg = result.find((d) => d.platform === 'qiangua');
      expect(qg?.show).toBe(true);
    });

    it('includes a non-empty reason', () => {
      const result = decidePlatformVisibility({
        qiangua: { brandRank: 3 },
      });
      const qg = result.find((d) => d.platform === 'qiangua');
      expect(qg?.reason).toBeTruthy();
    });
  });

  describe('Lingxi (灵犀)', () => {
    it('shows when searchGrowth=S, audienceGrowth=S, cptiBenchmark=true', () => {
      const result = decidePlatformVisibility({
        lingxi: { searchGrowth: 'S', audienceGrowth: 'S', cptiBenchmark: true },
      });
      const lx = result.find((d) => d.platform === 'lingxi');
      expect(lx?.show).toBe(true);
    });

    it('shows when searchGrowth=A, audienceGrowth=B, cptiBenchmark=true', () => {
      const result = decidePlatformVisibility({
        lingxi: { searchGrowth: 'A', audienceGrowth: 'B', cptiBenchmark: true },
      });
      const lx = result.find((d) => d.platform === 'lingxi');
      expect(lx?.show).toBe(true);
    });

    it('hides when searchGrowth=B (not S/A)', () => {
      const result = decidePlatformVisibility({
        lingxi: { searchGrowth: 'B', audienceGrowth: 'S', cptiBenchmark: true },
      });
      const lx = result.find((d) => d.platform === 'lingxi');
      expect(lx?.show).toBe(false);
    });

    it('hides when audienceGrowth=C (not S/A/B)', () => {
      const result = decidePlatformVisibility({
        lingxi: { searchGrowth: 'S', audienceGrowth: 'C', cptiBenchmark: true },
      });
      const lx = result.find((d) => d.platform === 'lingxi');
      expect(lx?.show).toBe(false);
    });

    it('hides when cptiBenchmark=false', () => {
      const result = decidePlatformVisibility({
        lingxi: { searchGrowth: 'S', audienceGrowth: 'S', cptiBenchmark: false },
      });
      const lx = result.find((d) => d.platform === 'lingxi');
      expect(lx?.show).toBe(false);
    });

    it('hides when all conditions fail', () => {
      const result = decidePlatformVisibility({
        lingxi: { searchGrowth: 'D', audienceGrowth: 'D', cptiBenchmark: false },
      });
      const lx = result.find((d) => d.platform === 'lingxi');
      expect(lx?.show).toBe(false);
    });

    it('includes a non-empty reason', () => {
      const result = decidePlatformVisibility({
        lingxi: { searchGrowth: 'S', audienceGrowth: 'A', cptiBenchmark: true },
      });
      const lx = result.find((d) => d.platform === 'lingxi');
      expect(lx?.reason).toBeTruthy();
    });
  });

  describe('multiple platforms', () => {
    it('returns decisions for all platforms with data', () => {
      const result = decidePlatformVisibility({
        pugongying: { viralRate: 'S', cpe: 'A' },
        juguang: { searchRate: 'A', ctr: 'B', cpeBenchmark: true },
        qiangua: { brandRank: 5 },
        lingxi: { searchGrowth: 'S', audienceGrowth: 'B', cptiBenchmark: true },
      });
      expect(result).toHaveLength(4);
      expect(result.every((d) => d.show)).toBe(true);
    });

    it('returns mixed show/hide decisions', () => {
      const result = decidePlatformVisibility({
        pugongying: { viralRate: 'S', cpe: 'A' },  // show
        juguang: { searchRate: 'D', ctr: 'D', cpeBenchmark: false },  // hide
        qiangua: { brandRank: 3 },  // show
        lingxi: { searchGrowth: 'D', audienceGrowth: 'D', cptiBenchmark: false },  // hide
      });
      expect(result).toHaveLength(4);
      const pgy = result.find((d) => d.platform === 'pugongying');
      const jg = result.find((d) => d.platform === 'juguang');
      const qg = result.find((d) => d.platform === 'qiangua');
      const lx = result.find((d) => d.platform === 'lingxi');
      expect(pgy?.show).toBe(true);
      expect(jg?.show).toBe(false);
      expect(qg?.show).toBe(true);
      expect(lx?.show).toBe(false);
    });

    it('only returns decisions for platforms with data', () => {
      const result = decidePlatformVisibility({
        pugongying: { viralRate: 'S', cpe: 'S' },
        qiangua: { brandRank: 1 },
      });
      expect(result).toHaveLength(2);
      expect(result.map((d) => d.platform).sort()).toEqual(['pugongying', 'qiangua']);
    });
  });
});


// ---- Orchestrator Function Tests ----

import { decideModules, decidePlatforms } from '../../src/engines/decision';
import { MODULE_NAMES } from '../../src/engines/types';

describe('decideModules', () => {
  it('returns all 8 modules', () => {
    const input = makeDecisionInput();
    const result = decideModules(input);
    expect(result).toHaveLength(8);
    const ids = result.map((d) => d.moduleId);
    expect(ids).toEqual(['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8']);
  });

  it('includes correct moduleName from MODULE_NAMES for each module', () => {
    const input = makeDecisionInput();
    const result = decideModules(input);
    for (const decision of result) {
      expect(decision.moduleName).toBe(MODULE_NAMES[decision.moduleId]);
    }
  });

  it('applies degradation correctly — partial data results in degraded status', () => {
    const input = makeDecisionInput({
      dataCompleteness: {
        M1: ['totalImpressions', 'totalCost'], // partial — missing totalEngagement, totalNotes
        M2: ['projectBackground', 'strategy', 'targetAudience'], // complete
        M3: ['topMetrics'], // complete
        M4: ['underperformingMetrics'], // complete
        M5: ['contentBreakdown', 'notePerformance'], // complete
        M6: ['competitorData', 'marketShare'], // complete
        M7: ['adSpendData', 'adPerformance', 'roi'], // complete
        M8: ['diagnosticData', 'recommendations'], // complete
      },
    });
    const result = decideModules(input);
    const m1 = result.find((d) => d.moduleId === 'M1')!;
    expect(m1.status).toBe('degraded');
    expect(m1.degradedFields).toEqual(['totalEngagement', 'totalNotes']);
  });

  it('applies degradation — no data results in hide even if visibility says show', () => {
    const input = makeDecisionInput({
      dataCompleteness: {
        M1: [], // no data — M1 visibility is always 'show' but degradation overrides to 'hide'
        M2: [],
        M3: [],
        M4: [],
        M5: [],
        M6: [],
        M7: [],
        M8: [],
      },
    });
    const result = decideModules(input);
    const m1 = result.find((d) => d.moduleId === 'M1')!;
    expect(m1.status).toBe('hide');
  });

  it('combines visibility + degradation — hidden module stays hidden even with full data', () => {
    // M3 requires >= 2 S/A ratings to show. With 0 S/A ratings, M3 is hidden.
    // Even if M3 has full data, it should remain hidden.
    const input = makeDecisionInput({
      metricRatings: [makeMetricRating('CPE', 'C')], // no S/A ratings
      dataCompleteness: {
        M1: ['totalImpressions', 'totalEngagement', 'totalCost', 'totalNotes'],
        M2: ['projectBackground', 'strategy', 'targetAudience'],
        M3: ['topMetrics'], // full data for M3
        M4: ['underperformingMetrics'],
        M5: ['contentBreakdown', 'notePerformance'],
        M6: ['competitorData', 'marketShare'],
        M7: ['adSpendData', 'adPerformance', 'roi'],
        M8: ['diagnosticData', 'recommendations'],
      },
    });
    const result = decideModules(input);
    const m3 = result.find((d) => d.moduleId === 'M3')!;
    expect(m3.status).toBe('hide');
    expect(m3.degradedFields).toBeUndefined();
  });

  it('combines visibility + degradation — shown module with partial data is degraded', () => {
    // M3 shows when >= 2 S/A ratings. Give it 2 S/A ratings but partial data.
    const input = makeDecisionInput({
      metricRatings: [
        makeMetricRating('CPE', 'S'),
        makeMetricRating('CPM', 'A'),
      ],
      dataCompleteness: {
        M1: ['totalImpressions', 'totalEngagement', 'totalCost', 'totalNotes'],
        M2: ['projectBackground', 'strategy', 'targetAudience'],
        M3: [], // M3 has no data — should be hidden by degradation
        M4: ['underperformingMetrics'],
        M5: ['contentBreakdown', 'notePerformance'],
        M6: ['competitorData', 'marketShare'],
        M7: ['adSpendData', 'adPerformance', 'roi'],
        M8: ['diagnosticData', 'recommendations'],
      },
    });
    const result = decideModules(input);
    const m3 = result.find((d) => d.moduleId === 'M3')!;
    // M3 visibility is 'show' (2 S/A ratings), but no data → degradation hides it
    expect(m3.status).toBe('hide');
  });

  it('each decision includes a non-empty reason', () => {
    const input = makeDecisionInput({
      metricRatings: [
        makeMetricRating('CPE', 'S'),
        makeMetricRating('CPM', 'A'),
        makeMetricRating('CPC', 'D'),
      ],
      dataCompleteness: {
        M1: ['totalImpressions', 'totalEngagement', 'totalCost', 'totalNotes'],
        M2: ['projectBackground', 'strategy', 'targetAudience'],
        M3: ['topMetrics'],
        M4: ['underperformingMetrics'],
        M5: ['contentBreakdown', 'notePerformance'],
        M6: ['competitorData', 'marketShare'],
        M7: ['adSpendData', 'adPerformance', 'roi'],
        M8: ['diagnosticData', 'recommendations'],
      },
    });
    const result = decideModules(input);
    for (const decision of result) {
      expect(decision.reason).toBeTruthy();
      expect(decision.reason.length).toBeGreaterThan(0);
    }
  });

  it('does not include degradedFields when status is show or hide', () => {
    const input = makeDecisionInput({
      metricRatings: [
        makeMetricRating('CPE', 'S'),
        makeMetricRating('CPM', 'A'),
      ],
      dataCompleteness: {
        M1: ['totalImpressions', 'totalEngagement', 'totalCost', 'totalNotes'], // full → show
        M2: ['projectBackground', 'strategy', 'targetAudience'], // full → show
        M3: ['topMetrics'], // full → show (2 S/A ratings)
        M4: [], // no C/D ratings → hide by visibility
        M5: ['contentBreakdown', 'notePerformance'], // full → show
        M6: [], // no competitor → hide by visibility
        M7: [], // juguangCost/totalCost = 10% → hide by visibility
        M8: [], // no C/D ratings → hide by visibility
      },
    });
    const result = decideModules(input);
    for (const decision of result) {
      if (decision.status === 'show' || decision.status === 'hide') {
        expect(decision.degradedFields).toBeUndefined();
      }
    }
  });
});

describe('decidePlatforms', () => {
  it('delegates to decidePlatformVisibility and returns its result', () => {
    const input = makeDecisionInput({
      platformRatings: {
        pugongying: { viralRate: 'S', cpe: 'A' },
        juguang: { searchRate: 'A', ctr: 'B', cpeBenchmark: true },
        qiangua: { brandRank: 5 },
        lingxi: { searchGrowth: 'S', audienceGrowth: 'B', cptiBenchmark: true },
      },
    });
    const result = decidePlatforms(input);
    expect(result).toHaveLength(4);
    expect(result.every((d) => d.show)).toBe(true);
  });

  it('returns empty array when no platformRatings provided', () => {
    const input = makeDecisionInput({ platformRatings: undefined });
    const result = decidePlatforms(input);
    expect(result).toEqual([]);
  });

  it('returns correct show/hide decisions for mixed platforms', () => {
    const input = makeDecisionInput({
      platformRatings: {
        pugongying: { viralRate: 'S', cpe: 'A' },  // show
        juguang: { searchRate: 'D', ctr: 'D', cpeBenchmark: false },  // hide
        qiangua: { brandRank: 15 },  // hide
        lingxi: { searchGrowth: 'A', audienceGrowth: 'B', cptiBenchmark: true },  // show
      },
    });
    const result = decidePlatforms(input);
    expect(result).toHaveLength(4);
    const pgy = result.find((d) => d.platform === 'pugongying');
    const jg = result.find((d) => d.platform === 'juguang');
    const qg = result.find((d) => d.platform === 'qiangua');
    const lx = result.find((d) => d.platform === 'lingxi');
    expect(pgy?.show).toBe(true);
    expect(jg?.show).toBe(false);
    expect(qg?.show).toBe(false);
    expect(lx?.show).toBe(true);
  });

  it('each decision includes a non-empty reason', () => {
    const input = makeDecisionInput({
      platformRatings: {
        pugongying: { viralRate: 'S', cpe: 'S' },
        juguang: { searchRate: 'S', ctr: 'S', cpeBenchmark: true },
      },
    });
    const result = decidePlatforms(input);
    for (const decision of result) {
      expect(decision.reason).toBeTruthy();
      expect(decision.reason.length).toBeGreaterThan(0);
    }
  });
});
