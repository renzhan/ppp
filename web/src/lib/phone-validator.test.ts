import { describe, it, expect } from 'vitest';
import { isValidPhone } from './phone-validator';

describe('isValidPhone', () => {
  describe('valid phone numbers', () => {
    it('should accept 13x numbers', () => {
      expect(isValidPhone('13800138000')).toBe(true);
    });

    it('should accept 15x numbers', () => {
      expect(isValidPhone('15912345678')).toBe(true);
    });

    it('should accept 19x numbers', () => {
      expect(isValidPhone('19900001111')).toBe(true);
    });

    it('should accept all valid second digits (3-9)', () => {
      for (let d = 3; d <= 9; d++) {
        expect(isValidPhone(`1${d}000000000`)).toBe(true);
      }
    });
  });

  describe('invalid phone numbers', () => {
    it('should reject numbers starting with 10x', () => {
      expect(isValidPhone('10000000000')).toBe(false);
    });

    it('should reject numbers starting with 11x', () => {
      expect(isValidPhone('11000000000')).toBe(false);
    });

    it('should reject numbers starting with 12x', () => {
      expect(isValidPhone('12000000000')).toBe(false);
    });

    it('should reject numbers shorter than 11 digits', () => {
      expect(isValidPhone('1380013800')).toBe(false);
    });

    it('should reject numbers longer than 11 digits', () => {
      expect(isValidPhone('138001380001')).toBe(false);
    });

    it('should reject empty string', () => {
      expect(isValidPhone('')).toBe(false);
    });

    it('should reject non-numeric input', () => {
      expect(isValidPhone('1380013800a')).toBe(false);
    });

    it('should reject numbers not starting with 1', () => {
      expect(isValidPhone('23800138000')).toBe(false);
    });

    it('should reject input with spaces', () => {
      expect(isValidPhone('138 0013 8000')).toBe(false);
    });

    it('should reject input with country code prefix', () => {
      expect(isValidPhone('+8613800138000')).toBe(false);
    });
  });
});
