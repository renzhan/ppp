/**
 * Report Assembler - 报告组装器
 * Reads all project data from PostgreSQL via Prisma and assembles
 * the report modules in the required fixed order.
 */

import { getPrismaClient } from '../shared/db.js';
import type { Report, ReportModule, Project, BenchmarkRange } from '../shared/types.js';
import { normalizeBenchmarkValue } from '../shared/types.js';

/** Placeholder for missing/null data fields */
const MISSING_DATA_PLACEHOLDER = '数据待补充';

/**
 * Format a BenchmarkRange as a display string (e.g., "10.59%~15.36%" or "10.59~15.36").
 */
function formatBenchmarkRange(range: BenchmarkRange, suffix: string = ''): string {
  return `${range.min}${suffix}~${range.max}${suffix}`;
}

/**
 * Normalize raw benchmark data (supports both old single-value and new range format)
 * and produce template variables with _min, _max, and _range suffixes.
 */
function assembleBenchmarkTemplateVars(
  rawBenchmark: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!rawBenchmark || typeof rawBenchmark !== 'object') return {};

  const result: Record<string, unknown> = {};

  const metrics: Array<{ key: string; varPrefix: string; suffix: string }> = [
    { key: 'ctr', varPrefix: 'benchmark_ctr', suffix: '%' },
    { key: 'cpm', varPrefix: 'benchmark_cpm', suffix: '' },
    { key: 'cpc', varPrefix: 'benchmark_cpc', suffix: '' },
    { key: 'cpe', varPrefix: 'benchmark_cpe', suffix: '' },
    { key: 'engagementRate', varPrefix: 'benchmark_engagement_rate', suffix: '%' },
  ];

  for (const { key, varPrefix, suffix } of metrics) {
    const rawValue = rawBenchmark[key] as number | BenchmarkRange | undefined;
    const range = normalizeBenchmarkValue(rawValue);
    if (range) {
      result[`${varPrefix}_min`] = range.min;
      result[`${varPrefix}_max`] = range.max;
      result[`${varPrefix}_range`] = formatBenchmarkRange(range, suffix);
      // Keep backward-compatible single value (midpoint for display)
      result[varPrefix] = range.min === range.max
        ? `${range.min}${suffix}`
        : formatBenchmarkRange(range, suffix);
    }
  }

  return result;
}

/**
 * The fixed module order for report assembly (10 modules).
 * Removed: audience_assets (人群资产分析), competitor_benchmark (竞品/行业对标)
 */
export const REPORT_MODULE_ORDER = [
  { moduleId: 'customer_info', title: '客户信息' },
  { moduleId: 'project_review', title: '项目回顾' },
  { moduleId: 'data_overview', title: '数据总览' },
  { moduleId: 'highlights', title: '项目亮点' },
  { moduleId: 'content_analysis', title: '内容分析' },
  { moduleId: 'brand_voice', title: '品牌声量分析' },
  { moduleId: 'paid_traffic', title: '投流分析' },
  { moduleId: 'conversion_analysis', title: '小程序/转化分析' },
  { moduleId: 'highlight_summary', title: '亮点总结' },
  { moduleId: 'optimization_suggestions', title: '优化建议' },
] as const;

/**
 * Replace null/undefined values in a data record with the placeholder string.
 * Recursively handles nested objects.
 */
export function fillPlaceholders(data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) {
      result[key] = MISSING_DATA_PLACEHOLDER;
    } else if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
      result[key] = fillPlaceholders(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Assemble a complete report for the given project.
 * Reads all related data from PostgreSQL and organizes it into the 10 fixed modules.
 */
export async function assembleReport(projectId: string): Promise<Report> {
  const prisma = getPrismaClient();

  // Fetch project with all related data
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: {
      notes: true,
      juguangData: true,
      lingxiData: true,
      manualInputs: true,
      kpiTargets: true,
      calculatedMetrics: true,
      aiGeneratedContent: true,
      competitorData: true,
    },
  });

  // Map Prisma project to our Project interface
  const projectInfo: Project = {
    id: project.id,
    category: project.category,
    brand: project.brand,
    spuName: project.spuName ?? undefined,
    projectName: project.projectName,
    startDate: project.startDate,
    endDate: project.endDate,
    engagementConfig: project.engagementConfig as unknown as Project['engagementConfig'],
    cooperationPolicy: project.cooperationPolicy as unknown as Project['cooperationPolicy'],
  };

  // Extract AI-generated content by type
  const aiContent = new Map(
    project.aiGeneratedContent.map((c) => [
      c.contentType,
      c.isEdited ? c.editedContent : c.generatedContent,
    ]),
  );

  // Extract manual inputs by type
  const manualInputsByType = new Map(
    project.manualInputs.map((m) => [m.inputType, m.dataContent]),
  );

  // Extract calculated metrics by type
  const calculatedMetricsByType = new Map(
    project.calculatedMetrics.map((m) => [m.metricType, m.metricValue]),
  );

  // Assemble each module's data
  const modules: ReportModule[] = REPORT_MODULE_ORDER.map(({ moduleId, title }) => {
    const rawData = assembleModuleData(moduleId, {
      project,
      projectInfo,
      notes: project.notes,
      juguangData: project.juguangData,
      lingxiData: project.lingxiData,
      manualInputs: manualInputsByType,
      kpiTargets: project.kpiTargets,
      calculatedMetrics: calculatedMetricsByType,
      aiContent,
      competitorData: project.competitorData,
    });

    return {
      moduleId,
      title,
      data: fillPlaceholders(rawData),
    };
  });

  return {
    projectId,
    project: projectInfo,
    modules,
    generatedAt: new Date(),
  };
}

/**
 * Internal context passed to module assembly functions.
 */
interface AssemblyContext {
  project: {
    id: string;
    category: string;
    brand: string;
    spuName: string | null;
    projectName: string;
    startDate: Date | null;
    endDate: Date | null;
    engagementConfig: unknown;
    cooperationPolicy: unknown;
  };
  projectInfo: Project;
  notes: unknown[];
  juguangData: unknown[];
  lingxiData: { dataType: string; dataContent: unknown }[];
  manualInputs: Map<string, unknown>;
  kpiTargets: { metricName: string; targetValue: unknown; isCostMetric: boolean }[];
  calculatedMetrics: Map<string, unknown>;
  aiContent: Map<string, string | null | undefined>;
  competitorData: { competitorName: string; metrics: unknown }[];
}

/**
 * Assemble raw data for a specific module.
 * Returns a record where null/undefined values indicate missing data.
 */
function assembleModuleData(
  moduleId: string,
  ctx: AssemblyContext,
): Record<string, unknown> {
  switch (moduleId) {
    case 'customer_info':
      return {
        category: ctx.project.category,
        brand: ctx.project.brand,
        spuName: ctx.project.spuName,
        projectName: ctx.project.projectName,
        startDate: ctx.project.startDate,
        endDate: ctx.project.endDate,
        engagementConfig: ctx.project.engagementConfig,
        cooperationPolicy: ctx.project.cooperationPolicy,
      };

    case 'project_review':
      return {
        planBackground: ctx.aiContent.get('plan_background') ?? null,
        objective: ctx.aiContent.get('objective') ?? null,
        strategy: ctx.aiContent.get('strategy') ?? null,
      };

    case 'data_overview': {
      const kpiTargetMap: Record<string, unknown> = {};
      for (const target of ctx.kpiTargets) {
        kpiTargetMap[target.metricName] = {
          targetValue: target.targetValue,
          isCostMetric: target.isCostMetric,
        };
      }
      // Assemble benchmark template variables (min, max, range) from manual inputs
      const benchmarkRaw = ctx.manualInputs.get('benchmark') as Record<string, unknown> | null | undefined;
      const benchmarkVars = assembleBenchmarkTemplateVars(benchmarkRaw);
      return {
        noteCount: ctx.notes.length > 0 ? ctx.notes.length : null,
        kpiTargets: Object.keys(kpiTargetMap).length > 0 ? kpiTargetMap : null,
        calculatedMetrics: ctx.calculatedMetrics.get('overview') ?? null,
        benchmarkComparison: ctx.calculatedMetrics.get('benchmark_comparison') ?? null,
        benchmarkData: benchmarkRaw ?? null,
        ...benchmarkVars,
      };
    }

    case 'highlights':
      return {
        highlights: ctx.calculatedMetrics.get('highlights') ?? null,
      };

    case 'content_analysis':
      return {
        contentMetrics: ctx.calculatedMetrics.get('content_analysis') ?? null,
        dimensionAggregations: ctx.calculatedMetrics.get('dimension_aggregations') ?? null,
      };

    case 'brand_voice': {
      const lingxiBrandData = ctx.lingxiData.find((d) => d.dataType === 'brand_ranking');
      const lingxiSocSov = ctx.lingxiData.find((d) => d.dataType === 'soc_sov');
      const lingxiSpuRanking = ctx.lingxiData.find((d) => d.dataType === 'spu_ranking');
      return {
        brandSearchIndex: ctx.manualInputs.get('brand_search_index') ?? null,
        topicExposure: ctx.manualInputs.get('topic_exposure') ?? null,
        brandRanking: lingxiBrandData?.dataContent ?? null,
        socSov: lingxiSocSov?.dataContent ?? null,
        spuRanking: lingxiSpuRanking?.dataContent ?? null,
      };
    }

    case 'audience_assets': {
      const lingxiAips = ctx.lingxiData.find((d) => d.dataType === 'aips');
      return {
        aips: lingxiAips?.dataContent ?? null,
        grassPlanting: ctx.calculatedMetrics.get('grass_planting') ?? null,
      };
    }

    case 'paid_traffic':
      return {
        paidTrafficMetrics: ctx.calculatedMetrics.get('paid_traffic') ?? null,
        naturalExposure: ctx.calculatedMetrics.get('natural_exposure') ?? null,
        juguangSummary: ctx.juguangData.length > 0 ? { recordCount: ctx.juguangData.length } : null,
      };

    case 'conversion_analysis':
      return {
        componentMetrics: ctx.calculatedMetrics.get('component_conversion') ?? null,
      };

    case 'competitor_benchmark': {
      // Assemble benchmark template variables (min, max, range) from manual inputs
      const competitorBenchmarkRaw = ctx.manualInputs.get('benchmark') as Record<string, unknown> | null | undefined;
      const competitorBenchmarkVars = assembleBenchmarkTemplateVars(competitorBenchmarkRaw);
      return {
        competitors: ctx.competitorData.length > 0
          ? ctx.competitorData.map((c) => ({
              competitorName: c.competitorName,
              metrics: c.metrics,
            }))
          : null,
        benchmarkData: competitorBenchmarkRaw ?? null,
        ...competitorBenchmarkVars,
      };
    }

    case 'highlight_summary':
      return {
        highlightSummary: ctx.calculatedMetrics.get('highlight_summary') ?? null,
      };

    case 'optimization_suggestions':
      return {
        suggestions: ctx.aiContent.get('optimization_suggestions') ?? null,
      };

    default:
      return {};
  }
}
