/**
 * Calculation Pipeline Orchestrator
 *
 * Reads project data from DB → runs all calculation functions → writes results
 * to the `calculated_metrics` table. Provides recalculation triggers when
 * engagement config changes.
 *
 * Requirements: 3.1, 4.1, 5.1, 6.1, 7.1, 8.1, 9.1, 17.3
 */

import { prisma } from '../shared/db.js';
import type {
  EngagementConfig,
  CostCalculationInput,
  NoteMetrics,
  NoteWithKOL,
  AnnotatedNote,
  ComponentData,
  ProjectMetrics,
  BenchmarkData,
  KPITargets,
} from '../shared/types.js';
import type { JuguangAggregated } from './metrics.js';
import {
  calculateProjectTotalCost,
  calculateCPE,
  calculateCPM,
  calculateCPC,
  calculateCTR,
  calculatePaidTrafficMetrics,
  calculateEngagement,
  isViralNote,
  calculateViralRate,
  calculateKPICompletion,
  classifyKOLTier,
  aggregateByKOLTier,
  calculateNaturalExposure,
  aggregateByDimension,
  calculateBenchmarkComparison,
  identifyHighlights,
  calculateComponentConversion,
} from './index.js';

/**
 * Run the full calculation pipeline for a project.
 * Reads all project data from DB, runs all calculations, and writes results
 * to the `calculated_metrics` table (upsert by project_id + metric_type).
 */
export async function runCalculationPipeline(projectId: string): Promise<void> {
  // 1. Read project data from DB
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
  });

  const notes = await prisma.note.findMany({
    where: { projectId },
  });

  const juguangData = await prisma.juguangData.findMany({
    where: { projectId },
  });

  const kpiTargets = await prisma.kpiTarget.findMany({
    where: { projectId },
  });

  const businessAnnotations = await prisma.businessAnnotation.findMany({
    where: { projectId },
  });

  const engagementConfig = project.engagementConfig as unknown as EngagementConfig;
  const cooperationPolicy = project.cooperationPolicy as unknown as {
    defaultDiscount: number;
    specialRules: { kolId: string; discount: number }[];
  };

  // 2. Run all calculations
  const results: Map<string, unknown> = new Map();

  // --- Project Total Cost ---
  const costInput: CostCalculationInput = {
    aboveWaterNotes: notes
      .filter((n) => !n.isUnderwater)
      .map((n) => ({
        kolPrice: Number(n.kolPrice),
        serviceFee: Number(n.serviceFee),
        kolId: n.kolId ?? '',
      })),
    underwaterPrices: notes
      .filter((n) => n.isUnderwater)
      .map((n) => Number(n.underwaterPrice)),
    juguangFees: juguangData.map((j) => Number(j.fee)),
    cooperationPolicy,
  };
  const projectCost = calculateProjectTotalCost(costInput);
  results.set('project_total_cost', projectCost);

  // --- Engagement per note ---
  const noteMetricsList: NoteMetrics[] = notes.map((n) => ({
    noteId: n.noteId,
    likeNum: n.likeNum,
    favNum: n.favNum,
    cmtNum: n.cmtNum,
    shareNum: n.shareNum,
    followNum: n.followNum ?? 0,
    impNum: n.impNum,
    readNum: n.readNum,
  }));

  const engagementPerNote = noteMetricsList.map((nm) => ({
    noteId: nm.noteId,
    engagement: calculateEngagement(nm, engagementConfig),
  }));
  const totalEngagement = engagementPerNote.reduce((sum, e) => sum + e.engagement, 0);
  results.set('engagement', { perNote: engagementPerNote, total: totalEngagement });

  // --- Core metrics (CPE, CPM, CPC, CTR) ---
  const totalImpressions = notes.reduce((sum, n) => sum + n.impNum, 0);
  const totalReads = notes.reduce((sum, n) => sum + n.readNum, 0);

  const cpe = calculateCPE(projectCost.totalCost, totalEngagement);
  const cpm = calculateCPM(projectCost.totalCost, totalImpressions);
  const cpc = calculateCPC(projectCost.totalCost, totalReads);
  const ctr = calculateCTR(totalReads, totalImpressions);
  results.set('core_metrics', { cpe, cpm, cpc, ctr });

  // --- Viral notes ---
  const viralResults = calculateViralRate(noteMetricsList);
  const viralNotes = noteMetricsList.filter(isViralNote).map((n) => n.noteId);
  results.set('viral', { ...viralResults, viralNoteIds: viralNotes });

  // --- KPI Completion ---
  const kpiResults: Record<string, unknown> = {};
  for (const target of kpiTargets) {
    let actualValue: number | 'N/A' = 0;
    switch (target.metricName) {
      case 'impression':
        actualValue = totalImpressions;
        break;
      case 'read':
        actualValue = totalReads;
        break;
      case 'engagement':
        actualValue = totalEngagement;
        break;
      case 'viralCount':
        actualValue = viralResults.viralCount;
        break;
      case 'cpm':
        actualValue = cpm;
        break;
      case 'cpc':
        actualValue = cpc;
        break;
      case 'cpe':
        actualValue = cpe;
        break;
      case 'ctr':
        actualValue = ctr;
        break;
    }
    if (actualValue === 'N/A') {
      kpiResults[target.metricName] = { completionRate: null, label: 'N/A' };
    } else {
      kpiResults[target.metricName] = calculateKPICompletion(
        actualValue,
        Number(target.targetValue),
        target.isCostMetric
      );
    }
  }
  results.set('kpi_completion', kpiResults);

  // --- KOL Tier classification and aggregation ---
  const notesWithKOL: NoteWithKOL[] = notes.map((n) => ({
    noteId: n.noteId,
    kolId: n.kolId ?? '',
    kolFanNum: n.kolFanNum ?? 0,
    kolNickName: n.kolNickName ?? '',
    impNum: n.impNum,
    readNum: n.readNum,
    likeNum: n.likeNum,
    favNum: n.favNum,
    cmtNum: n.cmtNum,
    shareNum: n.shareNum,
    followNum: n.followNum ?? 0,
    kolPrice: Number(n.kolPrice),
    serviceFee: Number(n.serviceFee),
    isUnderwater: n.isUnderwater,
    underwaterPrice: Number(n.underwaterPrice),
  }));
  const kolTierAggregation = aggregateByKOLTier(notesWithKOL);
  results.set('kol_tier', kolTierAggregation);

  // --- Natural Exposure ---
  const juguangTotalImpression = juguangData.reduce((sum, j) => sum + j.impression, 0);
  const naturalExposure = calculateNaturalExposure(totalImpressions, juguangTotalImpression);
  results.set('natural_exposure', naturalExposure);

  // --- Paid Traffic Metrics ---
  const juguangAggregated: JuguangAggregated = {
    totalFee: juguangData.reduce((sum, j) => sum + Number(j.fee), 0),
    totalImpression: juguangTotalImpression,
    totalClick: juguangData.reduce((sum, j) => sum + j.click, 0),
    totalInteraction: juguangData.reduce((sum, j) => sum + j.interaction, 0),
    totalIUserNum: juguangData.reduce((sum, j) => sum + j.iUserNum, 0),
    totalTiUserNum: juguangData.reduce((sum, j) => sum + j.tiUserNum, 0),
    avgIUserPrice: juguangData.length > 0
      ? juguangData.reduce((sum, j) => sum + Number(j.iUserPrice), 0) / juguangData.length
      : 0,
    avgTiUserPrice: juguangData.length > 0
      ? juguangData.reduce((sum, j) => sum + Number(j.tiUserPrice), 0) / juguangData.length
      : 0,
    totalSearchCmtClick: juguangData.reduce((sum, j) => sum + j.searchCmtClick, 0),
    totalSearchCmtAfterRead: juguangData.reduce((sum, j) => sum + j.searchCmtAfterRead, 0),
    avgSearchCmtAfterReadAvg: juguangData.length > 0
      ? juguangData.reduce((sum, j) => sum + Number(j.searchCmtAfterReadAvg), 0) / juguangData.length
      : 0,
    avgSearchCmtClickCvr: juguangData.length > 0
      ? juguangData.reduce((sum, j) => sum + Number(j.searchCmtClickCvr), 0) / juguangData.length
      : 0,
  };
  const paidTrafficMetrics = calculatePaidTrafficMetrics(juguangAggregated);
  results.set('paid_traffic', paidTrafficMetrics);

  // --- Content Analysis (aggregation by dimension) ---
  // Build annotated notes by joining notes with business annotations
  const annotationMap = new Map(businessAnnotations.map((a) => [a.noteId, a]));
  const annotatedNotes: AnnotatedNote[] = notes.map((n) => {
    const annotation = annotationMap.get(n.noteId);
    return {
      noteId: n.noteId,
      noteType: (n.noteType as 'image' | 'video') ?? 'image',
      impNum: n.impNum,
      readNum: n.readNum,
      likeNum: n.likeNum,
      favNum: n.favNum,
      cmtNum: n.cmtNum,
      shareNum: n.shareNum,
      followNum: n.followNum ?? 0,
      kolPrice: Number(n.kolPrice),
      serviceFee: Number(n.serviceFee),
      isUnderwater: n.isUnderwater,
      underwaterPrice: Number(n.underwaterPrice),
      contentDirection: annotation?.contentDirection ?? '',
      accountType: annotation?.accountType ?? '',
      kolType: annotation?.kolType ?? '',
      launchPhase: annotation?.launchPhase ?? '',
    };
  });

  const dimensions = ['noteType', 'contentDirection', 'accountType', 'kolType', 'launchPhase'];
  const dimensionAggregations: Record<string, unknown> = {};
  for (const dim of dimensions) {
    dimensionAggregations[dim] = aggregateByDimension(annotatedNotes, dim);
  }
  results.set('dimension_aggregations', dimensionAggregations);

  // --- Benchmark Comparison ---
  // Read benchmark data from manual_inputs
  const benchmarkInputs = await prisma.manualInput.findMany({
    where: { projectId, inputType: 'benchmark' },
  });
  const benchmarkData: BenchmarkData = {};
  for (const input of benchmarkInputs) {
    const content = input.dataContent as Record<string, number>;
    if (content.cpm !== undefined) benchmarkData.cpm = content.cpm;
    if (content.cpc !== undefined) benchmarkData.cpc = content.cpc;
    if (content.cpe !== undefined) benchmarkData.cpe = content.cpe;
    if (content.ctr !== undefined) benchmarkData.ctr = content.ctr;
    if (content.viralRate !== undefined) benchmarkData.viralRate = content.viralRate;
  }

  const benchmarkResults: Record<string, unknown> = {};
  if (benchmarkData.cpm !== undefined && cpm !== 'N/A') {
    benchmarkResults['cpm'] = calculateBenchmarkComparison(cpm, benchmarkData.cpm, true);
  }
  if (benchmarkData.cpc !== undefined && cpc !== 'N/A') {
    benchmarkResults['cpc'] = calculateBenchmarkComparison(cpc, benchmarkData.cpc, true);
  }
  if (benchmarkData.cpe !== undefined && cpe !== 'N/A') {
    benchmarkResults['cpe'] = calculateBenchmarkComparison(cpe, benchmarkData.cpe, true);
  }
  if (benchmarkData.ctr !== undefined && ctr !== 'N/A') {
    benchmarkResults['ctr'] = calculateBenchmarkComparison(ctr, benchmarkData.ctr, false);
  }
  if (benchmarkData.viralRate !== undefined) {
    benchmarkResults['viralRate'] = calculateBenchmarkComparison(
      viralResults.viralRate,
      benchmarkData.viralRate,
      false
    );
  }
  results.set('benchmark_comparison', benchmarkResults);

  // --- Highlights ---
  const projectMetrics: ProjectMetrics = {
    totalImpressions,
    totalReads,
    totalEngagement,
    viralCount: viralResults.viralCount,
    viralRate: viralResults.viralRate,
    cpm,
    cpc,
    cpe,
    ctr,
    totalCost: projectCost.totalCost,
  };

  const kpiTargetsForHighlights: KPITargets = {};
  for (const target of kpiTargets) {
    const key = target.metricName as keyof KPITargets;
    kpiTargetsForHighlights[key] = Number(target.targetValue);
  }

  const highlights = identifyHighlights(projectMetrics, benchmarkData, kpiTargetsForHighlights);
  results.set('highlights', highlights);

  // --- Component Conversion ---
  const allComponents: ComponentData[] = [];
  for (const note of notes) {
    if (note.components && Array.isArray(note.components)) {
      for (const comp of note.components as unknown as ComponentData[]) {
        allComponents.push(comp);
      }
    }
  }
  const componentMetrics = calculateComponentConversion(allComponents);
  results.set('component_conversion', componentMetrics);

  // 3. Write results to calculated_metrics table (upsert by project_id + metric_type)
  await writeMetricsToDb(projectId, results);
}

/**
 * Recalculate all metrics when engagement config changes.
 * Updates the project's engagement config in DB, then re-runs the full pipeline.
 *
 * Requirement 17.3: When engagement config changes, recalculate all derived metrics.
 */
export async function onEngagementConfigChange(
  projectId: string,
  newConfig: EngagementConfig
): Promise<void> {
  // Update the project's engagement config in DB
  await prisma.project.update({
    where: { id: projectId },
    data: {
      engagementConfig: JSON.parse(JSON.stringify(newConfig)),
      updatedAt: new Date(),
    },
  });

  // Re-run the full calculation pipeline with the new config
  await runCalculationPipeline(projectId);
}

/**
 * Write calculated metrics to the database.
 * Uses upsert logic: for each metric_type, either create or update the record.
 */
async function writeMetricsToDb(
  projectId: string,
  results: Map<string, unknown>
): Promise<void> {
  const now = new Date();

  // Delete existing metrics for this project and re-insert
  // This is simpler than individual upserts since calculated_metrics
  // doesn't have a unique constraint on (project_id, metric_type)
  await prisma.calculatedMetric.deleteMany({
    where: { projectId },
  });

  const records = Array.from(results.entries()).map(([metricType, metricValue]) => ({
    projectId,
    metricType,
    metricValue: JSON.parse(JSON.stringify(metricValue)),
    calculatedAt: now,
  }));

  if (records.length > 0) {
    await prisma.calculatedMetric.createMany({
      data: records,
    });
  }
}
