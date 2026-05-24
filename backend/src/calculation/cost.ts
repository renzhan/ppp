import type { CostCalculationInput, ProjectCost } from '../shared/types';

/**
 * 计算项目总费用
 *
 * 公式:
 * - 水上费用: SUM((kolPrice + serviceFee) × applicableDiscount(kolId))
 *   - applicableDiscount: 若 specialRules 中存在该 kolId 的规则，使用其 discount；否则使用 defaultDiscount
 * - 水下费用: SUM(underwaterPrices)（不应用折扣）
 * - 聚光费用: SUM(juguangFees)
 * - 总费用: aboveWaterCost + underwaterCost + juguangCost
 */
export function calculateProjectTotalCost(params: CostCalculationInput): ProjectCost {
  const { aboveWaterNotes, underwaterPrices, juguangFees, cooperationPolicy } = params;
  const { defaultDiscount, specialRules } = cooperationPolicy;

  // Build a lookup map for special rules by kolId
  const specialRuleMap = new Map<string, number>();
  for (const rule of specialRules) {
    specialRuleMap.set(rule.kolId, rule.discount);
  }

  // Calculate above-water cost with applicable discounts
  const aboveWaterCost = aboveWaterNotes.reduce((sum, note) => {
    const discount = specialRuleMap.get(note.kolId) ?? defaultDiscount;
    return sum + (note.kolPrice + note.serviceFee) * discount;
  }, 0);

  // Calculate underwater cost (no discounts applied)
  const underwaterCost = underwaterPrices.reduce((sum, price) => sum + price, 0);

  // Calculate juguang cost
  const juguangCost = juguangFees.reduce((sum, fee) => sum + fee, 0);

  // Total cost
  const totalCost = aboveWaterCost + underwaterCost + juguangCost;

  return {
    aboveWaterCost,
    underwaterCost,
    juguangCost,
    totalCost,
  };
}
