import { describe, it, expect } from 'vitest';
import { calculateProjectTotalCost } from '../../src/calculation/cost';
import type { CostCalculationInput } from '../../src/shared/types';

describe('calculateProjectTotalCost', () => {
  describe('above-water cost with default discount', () => {
    it('applies default discount to all above-water notes', () => {
      const input: CostCalculationInput = {
        aboveWaterNotes: [
          { kolPrice: 1000, serviceFee: 200, kolId: 'kol1' },
          { kolPrice: 2000, serviceFee: 300, kolId: 'kol2' },
        ],
        underwaterPrices: [],
        juguangFees: [],
        cooperationPolicy: {
          defaultDiscount: 0.8,
          specialRules: [],
        },
      };

      const result = calculateProjectTotalCost(input);

      // (1000 + 200) * 0.8 + (2000 + 300) * 0.8 = 960 + 1840 = 2800
      expect(result.aboveWaterCost).toBe(2800);
      expect(result.underwaterCost).toBe(0);
      expect(result.juguangCost).toBe(0);
      expect(result.totalCost).toBe(2800);
    });

    it('applies discount of 1 (no discount) correctly', () => {
      const input: CostCalculationInput = {
        aboveWaterNotes: [
          { kolPrice: 500, serviceFee: 100, kolId: 'kol1' },
        ],
        underwaterPrices: [],
        juguangFees: [],
        cooperationPolicy: {
          defaultDiscount: 1,
          specialRules: [],
        },
      };

      const result = calculateProjectTotalCost(input);

      expect(result.aboveWaterCost).toBe(600);
      expect(result.totalCost).toBe(600);
    });
  });

  describe('above-water cost with special rules', () => {
    it('uses special discount for KOL with a special rule', () => {
      const input: CostCalculationInput = {
        aboveWaterNotes: [
          { kolPrice: 1000, serviceFee: 200, kolId: 'kol1' },
          { kolPrice: 2000, serviceFee: 300, kolId: 'kol2' },
        ],
        underwaterPrices: [],
        juguangFees: [],
        cooperationPolicy: {
          defaultDiscount: 0.8,
          specialRules: [{ kolId: 'kol1', discount: 0.6 }],
        },
      };

      const result = calculateProjectTotalCost(input);

      // kol1: (1000 + 200) * 0.6 = 720
      // kol2: (2000 + 300) * 0.8 = 1840
      expect(result.aboveWaterCost).toBe(720 + 1840);
      expect(result.totalCost).toBe(2560);
    });

    it('special rule overrides default for matching KOL only', () => {
      const input: CostCalculationInput = {
        aboveWaterNotes: [
          { kolPrice: 1000, serviceFee: 0, kolId: 'kol_special' },
          { kolPrice: 1000, serviceFee: 0, kolId: 'kol_normal' },
        ],
        underwaterPrices: [],
        juguangFees: [],
        cooperationPolicy: {
          defaultDiscount: 0.9,
          specialRules: [{ kolId: 'kol_special', discount: 0.5 }],
        },
      };

      const result = calculateProjectTotalCost(input);

      // kol_special: 1000 * 0.5 = 500
      // kol_normal: 1000 * 0.9 = 900
      expect(result.aboveWaterCost).toBe(1400);
    });

    it('handles multiple special rules for different KOLs', () => {
      const input: CostCalculationInput = {
        aboveWaterNotes: [
          { kolPrice: 1000, serviceFee: 100, kolId: 'kol_a' },
          { kolPrice: 2000, serviceFee: 200, kolId: 'kol_b' },
          { kolPrice: 3000, serviceFee: 300, kolId: 'kol_c' },
        ],
        underwaterPrices: [],
        juguangFees: [],
        cooperationPolicy: {
          defaultDiscount: 0.8,
          specialRules: [
            { kolId: 'kol_a', discount: 0.7 },
            { kolId: 'kol_b', discount: 0.6 },
          ],
        },
      };

      const result = calculateProjectTotalCost(input);

      // kol_a: (1000 + 100) * 0.7 = 770
      // kol_b: (2000 + 200) * 0.6 = 1320
      // kol_c: (3000 + 300) * 0.8 = 2640
      expect(result.aboveWaterCost).toBe(770 + 1320 + 2640);
    });
  });

  describe('underwater cost', () => {
    it('sums underwater prices without any discount', () => {
      const input: CostCalculationInput = {
        aboveWaterNotes: [],
        underwaterPrices: [500, 1000, 1500],
        juguangFees: [],
        cooperationPolicy: {
          defaultDiscount: 0.5,
          specialRules: [],
        },
      };

      const result = calculateProjectTotalCost(input);

      expect(result.underwaterCost).toBe(3000);
      expect(result.totalCost).toBe(3000);
    });

    it('returns 0 for empty underwater prices', () => {
      const input: CostCalculationInput = {
        aboveWaterNotes: [],
        underwaterPrices: [],
        juguangFees: [],
        cooperationPolicy: {
          defaultDiscount: 0.8,
          specialRules: [],
        },
      };

      const result = calculateProjectTotalCost(input);

      expect(result.underwaterCost).toBe(0);
    });
  });

  describe('juguang cost', () => {
    it('sums all juguang fees', () => {
      const input: CostCalculationInput = {
        aboveWaterNotes: [],
        underwaterPrices: [],
        juguangFees: [100, 200, 300],
        cooperationPolicy: {
          defaultDiscount: 0.8,
          specialRules: [],
        },
      };

      const result = calculateProjectTotalCost(input);

      expect(result.juguangCost).toBe(600);
      expect(result.totalCost).toBe(600);
    });

    it('returns 0 for empty juguang fees', () => {
      const input: CostCalculationInput = {
        aboveWaterNotes: [],
        underwaterPrices: [],
        juguangFees: [],
        cooperationPolicy: {
          defaultDiscount: 0.8,
          specialRules: [],
        },
      };

      const result = calculateProjectTotalCost(input);

      expect(result.juguangCost).toBe(0);
    });
  });

  describe('total cost (combined)', () => {
    it('sums all three cost components correctly', () => {
      const input: CostCalculationInput = {
        aboveWaterNotes: [
          { kolPrice: 1000, serviceFee: 200, kolId: 'kol1' },
        ],
        underwaterPrices: [500, 600],
        juguangFees: [300, 400],
        cooperationPolicy: {
          defaultDiscount: 0.8,
          specialRules: [],
        },
      };

      const result = calculateProjectTotalCost(input);

      // above-water: (1000 + 200) * 0.8 = 960
      // underwater: 500 + 600 = 1100
      // juguang: 300 + 400 = 700
      expect(result.aboveWaterCost).toBe(960);
      expect(result.underwaterCost).toBe(1100);
      expect(result.juguangCost).toBe(700);
      expect(result.totalCost).toBe(960 + 1100 + 700);
    });

    it('returns all zeros for completely empty input', () => {
      const input: CostCalculationInput = {
        aboveWaterNotes: [],
        underwaterPrices: [],
        juguangFees: [],
        cooperationPolicy: {
          defaultDiscount: 0.8,
          specialRules: [],
        },
      };

      const result = calculateProjectTotalCost(input);

      expect(result.aboveWaterCost).toBe(0);
      expect(result.underwaterCost).toBe(0);
      expect(result.juguangCost).toBe(0);
      expect(result.totalCost).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('handles discount of 0 (free cooperation)', () => {
      const input: CostCalculationInput = {
        aboveWaterNotes: [
          { kolPrice: 5000, serviceFee: 1000, kolId: 'kol1' },
        ],
        underwaterPrices: [],
        juguangFees: [],
        cooperationPolicy: {
          defaultDiscount: 0,
          specialRules: [],
        },
      };

      const result = calculateProjectTotalCost(input);

      expect(result.aboveWaterCost).toBe(0);
      expect(result.totalCost).toBe(0);
    });

    it('handles same KOL appearing multiple times in above-water notes', () => {
      const input: CostCalculationInput = {
        aboveWaterNotes: [
          { kolPrice: 1000, serviceFee: 100, kolId: 'kol1' },
          { kolPrice: 2000, serviceFee: 200, kolId: 'kol1' },
        ],
        underwaterPrices: [],
        juguangFees: [],
        cooperationPolicy: {
          defaultDiscount: 0.8,
          specialRules: [{ kolId: 'kol1', discount: 0.7 }],
        },
      };

      const result = calculateProjectTotalCost(input);

      // Both notes use kol1's special discount of 0.7
      // (1000 + 100) * 0.7 + (2000 + 200) * 0.7 = 770 + 1540 = 2310
      expect(result.aboveWaterCost).toBe(2310);
    });

    it('handles kolPrice or serviceFee of 0', () => {
      const input: CostCalculationInput = {
        aboveWaterNotes: [
          { kolPrice: 0, serviceFee: 500, kolId: 'kol1' },
          { kolPrice: 1000, serviceFee: 0, kolId: 'kol2' },
        ],
        underwaterPrices: [],
        juguangFees: [],
        cooperationPolicy: {
          defaultDiscount: 1,
          specialRules: [],
        },
      };

      const result = calculateProjectTotalCost(input);

      expect(result.aboveWaterCost).toBe(500 + 1000);
    });
  });
});
