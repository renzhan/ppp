// Calculation Engine Module
// Pure functions for cost, metrics, viral detection, KPI, KOL tier, traffic analysis

export { calculateProjectTotalCost } from './cost';
export {
  calculateCPE,
  calculateCPM,
  calculateCPC,
  calculateCTR,
  calculatePaidTrafficMetrics,
} from './metrics';
export type { JuguangAggregated } from './metrics';
export { calculateEngagement } from './engagement';
export { isViralNote, calculateViralRate, DEFAULT_VIRAL_THRESHOLD } from './viral';
export { calculateKPICompletion } from './kpi';
export { classifyKOLTier, classifyKOLByExposureRate, aggregateByKOLTier } from './kol-tier';
export type { ExposureRateTierConfig, FanTierConfig, AggregateByKOLTierOptions } from './kol-tier';
export { calculateNaturalExposure } from './traffic';
export { aggregateByDimension } from './content';
export type { AggregateByDimensionOptions } from './content';
export { calculateBenchmarkComparison } from './benchmark';
export { identifyHighlights } from './highlights';
export { calculateComponentConversion } from './components';
export { runCalculationPipeline, onEngagementConfigChange } from './pipeline';
