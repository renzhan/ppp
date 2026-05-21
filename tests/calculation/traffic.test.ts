import { describe, it, expect } from 'vitest';
import { calculateNaturalExposure } from '../../src/calculation/traffic';

describe('calculateNaturalExposure', () => {
  it('returns the difference when pugongying > juguang', () => {
    const result = calculateNaturalExposure(10000, 3000);
    expect(result.value).toBe(7000);
    expect(result.isAnomalous).toBe(false);
  });

  it('returns 0 and isAnomalous=true when pugongying < juguang', () => {
    const result = calculateNaturalExposure(3000, 10000);
    expect(result.value).toBe(0);
    expect(result.isAnomalous).toBe(true);
  });

  it('returns 0 and isAnomalous=false when pugongying equals juguang', () => {
    const result = calculateNaturalExposure(5000, 5000);
    expect(result.value).toBe(0);
    expect(result.isAnomalous).toBe(false);
  });

  it('returns pugongying value when juguang is 0', () => {
    const result = calculateNaturalExposure(8000, 0);
    expect(result.value).toBe(8000);
    expect(result.isAnomalous).toBe(false);
  });

  it('returns 0 and isAnomalous=true when pugongying is 0 and juguang > 0', () => {
    const result = calculateNaturalExposure(0, 5000);
    expect(result.value).toBe(0);
    expect(result.isAnomalous).toBe(true);
  });

  it('returns 0 and isAnomalous=false when both are 0', () => {
    const result = calculateNaturalExposure(0, 0);
    expect(result.value).toBe(0);
    expect(result.isAnomalous).toBe(false);
  });

  it('handles large impression values correctly', () => {
    const result = calculateNaturalExposure(10_000_000, 2_500_000);
    expect(result.value).toBe(7_500_000);
    expect(result.isAnomalous).toBe(false);
  });

  it('value is never negative', () => {
    const result = calculateNaturalExposure(1, 1_000_000);
    expect(result.value).toBe(0);
    expect(result.isAnomalous).toBe(true);
  });
});
