import { describe, it, expect } from 'vitest';
import { calculateBenchmarkComparison } from '../../src/calculation/benchmark';

describe('calculateBenchmarkComparison', () => {
  describe('non-cost metrics (higher is better)', () => {
    it('returns positive diff and "优于大盘" when actual > benchmark', () => {
      const result = calculateBenchmarkComparison(120, 100, false);
      expect(result.percentageDiff).toBe(20);
      expect(result.isBetterThanBenchmark).toBe(true);
      expect(result.label).toBe('优于大盘');
    });

    it('returns negative diff and "劣于大盘" when actual < benchmark', () => {
      const result = calculateBenchmarkComparison(80, 100, false);
      expect(result.percentageDiff).toBe(-20);
      expect(result.isBetterThanBenchmark).toBe(false);
      expect(result.label).toBe('劣于大盘');
    });

    it('returns 0 diff and "持平大盘" when actual equals benchmark', () => {
      const result = calculateBenchmarkComparison(100, 100, false);
      expect(result.percentageDiff).toBe(0);
      expect(result.isBetterThanBenchmark).toBe(false);
      expect(result.label).toBe('持平大盘');
    });

    it('calculates correct percentage for fractional values', () => {
      const result = calculateBenchmarkComparison(150, 200, false);
      expect(result.percentageDiff).toBeCloseTo(-25);
      expect(result.isBetterThanBenchmark).toBe(false);
      expect(result.label).toBe('劣于大盘');
    });

    it('handles large percentage differences', () => {
      const result = calculateBenchmarkComparison(300, 100, false);
      expect(result.percentageDiff).toBe(200);
      expect(result.isBetterThanBenchmark).toBe(true);
      expect(result.label).toBe('优于大盘');
    });
  });

  describe('cost metrics (lower is better)', () => {
    it('returns positive diff and "优于大盘" when actual < benchmark (lower cost)', () => {
      const result = calculateBenchmarkComparison(80, 100, true);
      expect(result.percentageDiff).toBe(20);
      expect(result.isBetterThanBenchmark).toBe(true);
      expect(result.label).toBe('优于大盘');
    });

    it('returns negative diff and "劣于大盘" when actual > benchmark (higher cost)', () => {
      const result = calculateBenchmarkComparison(120, 100, true);
      expect(result.percentageDiff).toBe(-20);
      expect(result.isBetterThanBenchmark).toBe(false);
      expect(result.label).toBe('劣于大盘');
    });

    it('returns 0 diff and "持平大盘" when actual equals benchmark', () => {
      const result = calculateBenchmarkComparison(100, 100, true);
      expect(result.percentageDiff).toBe(0);
      expect(result.isBetterThanBenchmark).toBe(false);
      expect(result.label).toBe('持平大盘');
    });

    it('calculates correct percentage for cost savings', () => {
      const result = calculateBenchmarkComparison(50, 200, true);
      expect(result.percentageDiff).toBe(75);
      expect(result.isBetterThanBenchmark).toBe(true);
      expect(result.label).toBe('优于大盘');
    });

    it('handles actual being much higher than benchmark', () => {
      const result = calculateBenchmarkComparison(300, 100, true);
      expect(result.percentageDiff).toBe(-200);
      expect(result.isBetterThanBenchmark).toBe(false);
      expect(result.label).toBe('劣于大盘');
    });
  });

  describe('edge cases', () => {
    it('handles very small decimal values', () => {
      const result = calculateBenchmarkComparison(0.05, 0.04, false);
      expect(result.percentageDiff).toBeCloseTo(25);
      expect(result.isBetterThanBenchmark).toBe(true);
      expect(result.label).toBe('优于大盘');
    });

    it('handles actual being 0 for non-cost metric', () => {
      const result = calculateBenchmarkComparison(0, 100, false);
      expect(result.percentageDiff).toBe(-100);
      expect(result.isBetterThanBenchmark).toBe(false);
      expect(result.label).toBe('劣于大盘');
    });

    it('handles actual being 0 for cost metric (perfect cost)', () => {
      const result = calculateBenchmarkComparison(0, 100, true);
      expect(result.percentageDiff).toBe(100);
      expect(result.isBetterThanBenchmark).toBe(true);
      expect(result.label).toBe('优于大盘');
    });
  });

  describe('range-based comparison (new format { min, max })', () => {
    describe('non-cost metrics with range', () => {
      it('returns "劣于大盘" when actual < min', () => {
        const result = calculateBenchmarkComparison(5, { min: 10, max: 20 }, false);
        expect(result.isBetterThanBenchmark).toBe(false);
        expect(result.label).toBe('劣于大盘');
      });

      it('returns "持平大盘" when actual is within [min, max]', () => {
        const result = calculateBenchmarkComparison(15, { min: 10, max: 20 }, false);
        expect(result.isBetterThanBenchmark).toBe(false);
        expect(result.label).toBe('持平大盘');
      });

      it('returns "持平大盘" when actual equals min', () => {
        const result = calculateBenchmarkComparison(10, { min: 10, max: 20 }, false);
        expect(result.label).toBe('持平大盘');
      });

      it('returns "持平大盘" when actual equals max', () => {
        const result = calculateBenchmarkComparison(20, { min: 10, max: 20 }, false);
        expect(result.label).toBe('持平大盘');
      });

      it('returns "优于大盘" when actual > max', () => {
        const result = calculateBenchmarkComparison(25, { min: 10, max: 20 }, false);
        expect(result.isBetterThanBenchmark).toBe(true);
        expect(result.label).toBe('优于大盘');
      });
    });

    describe('cost metrics with range', () => {
      it('returns "优于大盘" when actual < min (lower cost is better)', () => {
        const result = calculateBenchmarkComparison(5, { min: 10, max: 20 }, true);
        expect(result.isBetterThanBenchmark).toBe(true);
        expect(result.label).toBe('优于大盘');
      });

      it('returns "持平大盘" when actual is within [min, max]', () => {
        const result = calculateBenchmarkComparison(15, { min: 10, max: 20 }, true);
        expect(result.isBetterThanBenchmark).toBe(false);
        expect(result.label).toBe('持平大盘');
      });

      it('returns "劣于大盘" when actual > max (higher cost is worse)', () => {
        const result = calculateBenchmarkComparison(25, { min: 10, max: 20 }, true);
        expect(result.isBetterThanBenchmark).toBe(false);
        expect(result.label).toBe('劣于大盘');
      });
    });

    describe('backward compatibility (single number auto-converts to { min: value, max: value })', () => {
      it('single number benchmark: actual above → 优于大盘 (non-cost)', () => {
        const result = calculateBenchmarkComparison(120, 100, false);
        expect(result.label).toBe('优于大盘');
      });

      it('single number benchmark: actual below → 劣于大盘 (non-cost)', () => {
        const result = calculateBenchmarkComparison(80, 100, false);
        expect(result.label).toBe('劣于大盘');
      });

      it('single number benchmark: actual equals → 持平大盘', () => {
        const result = calculateBenchmarkComparison(100, 100, false);
        expect(result.label).toBe('持平大盘');
      });

      it('single number benchmark: actual below → 优于大盘 (cost)', () => {
        const result = calculateBenchmarkComparison(80, 100, true);
        expect(result.label).toBe('优于大盘');
      });

      it('single number benchmark: actual above → 劣于大盘 (cost)', () => {
        const result = calculateBenchmarkComparison(120, 100, true);
        expect(result.label).toBe('劣于大盘');
      });
    });
  });
});
