import { describe, it, expect } from 'vitest';
import { calculateKPICompletion } from '../../src/calculation/kpi';

describe('calculateKPICompletion', () => {
  describe('non-cost metrics (isReversed=false)', () => {
    it('calculates completion rate as actual / target', () => {
      const result = calculateKPICompletion(800, 1000, false);
      expect(result.completionRate).toBe(0.8);
      expect(result.label).toBe('80.0%');
    });

    it('returns > 1 when actual exceeds target', () => {
      const result = calculateKPICompletion(1500, 1000, false);
      expect(result.completionRate).toBe(1.5);
      expect(result.label).toBe('150.0%');
    });

    it('returns exactly 1 when actual equals target', () => {
      const result = calculateKPICompletion(500, 500, false);
      expect(result.completionRate).toBe(1);
      expect(result.label).toBe('100.0%');
    });

    it('returns 0 when actual is 0', () => {
      const result = calculateKPICompletion(0, 1000, false);
      expect(result.completionRate).toBe(0);
      expect(result.label).toBe('0.0%');
    });
  });

  describe('cost metrics (isReversed=true)', () => {
    it('calculates completion rate as target / actual (lower actual is better)', () => {
      const result = calculateKPICompletion(50, 100, true);
      // target / actual = 100 / 50 = 2.0 (actual is half the target, so 200% completion)
      expect(result.completionRate).toBe(2);
      expect(result.label).toBe('200.0%');
    });

    it('returns 1 when actual equals target', () => {
      const result = calculateKPICompletion(100, 100, true);
      expect(result.completionRate).toBe(1);
      expect(result.label).toBe('100.0%');
    });

    it('returns < 1 when actual exceeds target (worse performance)', () => {
      const result = calculateKPICompletion(200, 100, true);
      // target / actual = 100 / 200 = 0.5
      expect(result.completionRate).toBe(0.5);
      expect(result.label).toBe('50.0%');
    });

    it('returns null with "实际值为零" when actual is 0', () => {
      const result = calculateKPICompletion(0, 100, true);
      expect(result.completionRate).toBeNull();
      expect(result.label).toBe('实际值为零');
    });
  });

  describe('target is 0 or unset', () => {
    it('returns null with "未设定目标" when target is 0', () => {
      const result = calculateKPICompletion(500, 0, false);
      expect(result.completionRate).toBeNull();
      expect(result.label).toBe('未设定目标');
    });

    it('returns null with "未设定目标" when target is null', () => {
      const result = calculateKPICompletion(500, null, false);
      expect(result.completionRate).toBeNull();
      expect(result.label).toBe('未设定目标');
    });

    it('returns null with "未设定目标" when target is undefined', () => {
      const result = calculateKPICompletion(500, undefined, false);
      expect(result.completionRate).toBeNull();
      expect(result.label).toBe('未设定目标');
    });

    it('returns null with "未设定目标" for reversed metric with target 0', () => {
      const result = calculateKPICompletion(50, 0, true);
      expect(result.completionRate).toBeNull();
      expect(result.label).toBe('未设定目标');
    });

    it('returns null with "未设定目标" for reversed metric with target null', () => {
      const result = calculateKPICompletion(50, null, true);
      expect(result.completionRate).toBeNull();
      expect(result.label).toBe('未设定目标');
    });
  });

  describe('edge cases', () => {
    it('handles very small actual values for non-cost metrics', () => {
      const result = calculateKPICompletion(1, 10000, false);
      expect(result.completionRate).toBeCloseTo(0.0001);
    });

    it('handles very large actual values for non-cost metrics', () => {
      const result = calculateKPICompletion(1000000, 100, false);
      expect(result.completionRate).toBe(10000);
    });

    it('handles decimal values correctly', () => {
      const result = calculateKPICompletion(3.5, 7, false);
      expect(result.completionRate).toBe(0.5);
      expect(result.label).toBe('50.0%');
    });

    it('handles decimal cost metric values correctly', () => {
      const result = calculateKPICompletion(2.5, 5, true);
      // target / actual = 5 / 2.5 = 2
      expect(result.completionRate).toBe(2);
      expect(result.label).toBe('200.0%');
    });
  });
});
