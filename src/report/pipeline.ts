/**
 * Report Generation Pipeline
 *
 * Full report generation pipeline:
 * 1. (Optional) Run calculation pipeline to ensure metrics are up-to-date
 * 2. Assemble report from DB data
 * 3. Generate AI optimization suggestions
 * 4. Export report in requested format
 *
 * Requirements: 14.1, 15.3, 16.1
 */

import { ExportFormat } from '../shared/types.js';
import type { LLMConfig } from './llm-client.js';
import { createLLMClientFromEnv, OpenAILLMClient } from './llm-client.js';
import { assembleReport } from './assembler.js';
import { generateOptimizationSuggestions } from './ai-service.js';
import { exportReport } from './exporter.js';
import { runCalculationPipeline } from '../calculation/pipeline.js';
import { getPrismaClient } from '../shared/db.js';
import { envConfig } from '../config/env.js';
import type { AllMetrics, Highlight } from '../shared/types.js';

/**
 * Options for the report generation pipeline.
 */
export interface GenerateReportOptions {
  /** Whether to re-run the calculation pipeline before assembling the report. Default: false */
  recalculate?: boolean;
  /** Export format for the final report. Default: ExportFormat.JSON */
  format?: ExportFormat;
  /** LLM configuration override. If not provided, uses environment config. */
  llmConfig?: LLMConfig;
}

/**
 * Full report generation pipeline:
 * 1. (Optional) Run calculation pipeline to ensure metrics are up-to-date
 * 2. Assemble report from DB data
 * 3. Generate AI optimization suggestions
 * 4. Export report in requested format
 *
 * @param projectId - The project UUID to generate a report for
 * @param options - Pipeline options (recalculate, format, llmConfig)
 * @returns A Buffer containing the exported report
 */
export async function generateReport(
  projectId: string,
  options?: GenerateReportOptions,
): Promise<Buffer> {
  const format = options?.format ?? ExportFormat.JSON;
  const recalculate = options?.recalculate ?? false;

  // Step 1: Optionally recalculate metrics
  if (recalculate) {
    await runCalculationPipeline(projectId);
  }

  // Step 2: Assemble report from DB data
  const report = await assembleReport(projectId);

  // Step 3: Generate AI optimization suggestions
  const llmClient = options?.llmConfig
    ? new OpenAILLMClient(options.llmConfig)
    : createLLMClientFromEnv();

  // Build metrics and highlights from calculated data for AI suggestions
  const { metrics, highlights } = await loadMetricsAndHighlights(projectId);

  const suggestions = await generateOptimizationSuggestions(metrics, highlights, llmClient);

  // Save AI-generated suggestions to the database
  const prisma = getPrismaClient();
  const existing = await prisma.aiGeneratedContent.findFirst({
    where: { projectId, contentType: 'optimization_suggestions' },
  });

  if (existing) {
    await prisma.aiGeneratedContent.update({
      where: { id: existing.id },
      data: {
        generatedContent: suggestions,
        updatedAt: new Date(),
      },
    });
  } else {
    await prisma.aiGeneratedContent.create({
      data: {
        projectId,
        contentType: 'optimization_suggestions',
        generatedContent: suggestions,
      },
    });
  }

  // Re-assemble report to include the newly generated suggestions
  const finalReport = await assembleReport(projectId);

  // Step 4: Export report in requested format
  return exportReport(finalReport, format);
}

/**
 * Load calculated metrics and highlights from the database for AI suggestion generation.
 */
async function loadMetricsAndHighlights(
  projectId: string,
): Promise<{ metrics: AllMetrics; highlights: Highlight[] }> {
  const prisma = getPrismaClient();

  const calculatedMetrics = await prisma.calculatedMetric.findMany({
    where: { projectId },
  });

  const metricsMap = new Map(
    calculatedMetrics.map((m) => [m.metricType, m.metricValue]),
  );

  // Extract core metrics
  const coreMetrics = (metricsMap.get('core_metrics') ?? {}) as Record<string, unknown>;
  const engagement = (metricsMap.get('engagement') ?? {}) as Record<string, unknown>;
  const viral = (metricsMap.get('viral') ?? {}) as Record<string, unknown>;
  const projectCost = (metricsMap.get('project_total_cost') ?? {}) as Record<string, unknown>;
  const paidTraffic = metricsMap.get('paid_traffic') as AllMetrics['paidTrafficMetrics'] | undefined;
  const naturalExposure = metricsMap.get('natural_exposure') as AllMetrics['naturalExposure'] | undefined;
  const kpiCompletion = (metricsMap.get('kpi_completion') ?? {}) as Record<string, { completionRate: number | null; label: string }>;
  const benchmarkComparison = (metricsMap.get('benchmark_comparison') ?? {}) as Record<string, { percentageDiff: number; isBetterThanBenchmark: boolean; label: '优于大盘' | '劣于大盘' }>;
  const kolTier = (metricsMap.get('kol_tier') ?? []) as unknown as AllMetrics['kolTierAggregation'];
  const dimensionAggregations = (metricsMap.get('dimension_aggregations') ?? {}) as unknown as AllMetrics['dimensionAggregations'];
  const highlights = (metricsMap.get('highlights') ?? []) as unknown as Highlight[];

  // Build project metrics
  const notes = await prisma.note.findMany({ where: { projectId } });
  const totalImpressions = notes.reduce((sum, n) => sum + n.impNum, 0);
  const totalReads = notes.reduce((sum, n) => sum + n.readNum, 0);

  const metrics: AllMetrics = {
    projectMetrics: {
      totalImpressions,
      totalReads,
      totalEngagement: (engagement as { total?: number }).total ?? 0,
      viralCount: (viral as { viralCount?: number }).viralCount ?? 0,
      viralRate: (viral as { viralRate?: number }).viralRate ?? 0,
      cpm: (coreMetrics.cpm as number | 'N/A') ?? 'N/A',
      cpc: (coreMetrics.cpc as number | 'N/A') ?? 'N/A',
      cpe: (coreMetrics.cpe as number | 'N/A') ?? 'N/A',
      ctr: (coreMetrics.ctr as number | 'N/A') ?? 'N/A',
      totalCost: (projectCost as { totalCost?: number }).totalCost ?? 0,
    },
    kpiResults: kpiCompletion,
    benchmarkResults: benchmarkComparison,
    kolTierAggregation: kolTier,
    dimensionAggregations: dimensionAggregations,
    paidTrafficMetrics: paidTraffic,
    naturalExposure: naturalExposure,
  };

  return { metrics, highlights };
}
