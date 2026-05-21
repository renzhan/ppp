import { describe, it, expect } from 'vitest';
import { normalizeAmount } from '../../src/ingestion/currency';

describe('normalizeAmount', () => {
  describe('valid conversions', () => {
    it('converts 0 fen to 0 yuan', () => {
      expect(normalizeAmount(0)).toBe(0);
    });

    it('converts 1 fen to 0.01 yuan', () => {
      expect(normalizeAmount(1)).toBe(0.01);
    });

    it('converts 99 fen to 0.99 yuan', () => {
      expect(normalizeAmount(99)).toBe(0.99);
    });

    it('converts 100 fen to 1.00 yuan', () => {
      expect(normalizeAmount(100)).toBe(1.00);
    });

    it('converts 12345 fen to 123.45 yuan', () => {
      expect(normalizeAmount(12345)).toBe(123.45);
    });
  });

  describe('invalid inputs', () => {
    it('throws on negative input', () => {
      expect(() => normalizeAmount(-1)).toThrow('non-negative');
    });

    it('throws on non-integer input (1.5)', () => {
      expect(() => normalizeAmount(1.5)).toThrow('integer');
    });

    it('throws on NaN', () => {
      expect(() => normalizeAmount(NaN)).toThrow('NaN');
    });
  });
});
