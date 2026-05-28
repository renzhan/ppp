/**
 * HTML Report Data Assembler - 为HTML报告生成组装所有项目数据
 *
 * 从数据库读取项目的全部数据，组装为结构化的数据对象，
 * 供提示词构建器使用。
 */

import { getPrismaClient } from '../shared/db.js';

/**
 * 报告数据结构 - 包含生成HTML报告所需的全部数据
 */
export interface HtmlReportData {
  /** 项目基本信息 */
  project: {
    projectName: string;
    brand: string;
    category: string;
    spuName?: string;
    period: string;
    startDate: string;
    endDate: string;
  };

  /** KPI完成情况 */
  kpiCompletion: Array<{
    metric: string;
    kpiTarget: string;
    actual: string;
    completionRate: string;
  }>;

  /** 大盘对比 */
  benchmark: Array<{
    metric: string;
    actual: string | number;
    benchmarkRange: string;
    status: string;
    diff: string;
  }>;

  /** 内容方向分析 */
  contentByDirection: Array<{
    direction: string;
    count: number;
    impressions: string | number;
    reads: string | number;
    engagement: string | number;
    cpe: string | number;
    viralCount: number;
    viralRate: string;
  }>;

  /** 达人层级分析 */
  contentByTier: Array<{
    tier: string;
    count: number;
    impressions: string | number;
    reads: string | number;
    engagement: string | number;
    cpe: string | number;
    viralCount: number;
    viralRate: string;
  }>;

  /** 内容形式分析 */
  contentByForm: Array<{
    type: string;
    count: number;
    impressions: string | number;
    reads: string | number;
    engagement: string | number;
    cpe: string | number;
    viralCount: number;
    viralRate: string;
  }>;

  /** 投流分析 */
  trafficOverview?: {
    totalSpend: string | number;
    totalImpressions: string | number;
    totalClicks: string | number;
    totalEngagement: string | number;
    ctr: string;
    cpc: string | number;
    cpm: string | number;
    cpe: string | number;
  };

  /** 投流-广告类型 */
  trafficByType?: Array<{
    type: string;
    spend: string | number;
    impressions: string | number;
    clicks: string | number;
    engagement: string | number;
    cpm: string | number;
    cpc: string | number;
    cpe: string | number;
    ctr: string;
  }>;

  /** 投流-人群定向 */
  trafficByTargeting?: Array<{
    targeting: string;
    spend: string | number;
    cpm: string | number;
    cpc: string | number;
    cpe: string | number;
    ctr: string;
  }>;

  /** 项目亮点 */
  highlights: string[];

  /** 优化建议 */
  optimization: Record<string, string[]>;

  /** 费用概览 */
  costOverview?: {
    totalCost: string | number;
    talentCost: string | number;
    trafficCost: string | number;
    noteCount: number;
  };
}

/**
 * 从数据库加载并组装项目的全部报告数据
 */
export async function assembleReportData(projectId: string): Promise<HtmlReportData> {
  const prisma = getPrismaClient();

  // 加载项目及关联数据
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: {
      notes: true,
      juguangData: true,
      kpiTargets: true,
      calculatedMetrics: true,
      aiGeneratedContent: true,
      competitorData: true,
      manualInputs: true,
    },
  });

  // 组装项目基本信息
  const projectInfo = {
    projectName: project.projectName,
    brand: project.brand,
    category: project.category,
    spuName: project.spuName ?? undefined,
    period: `${formatDate(project.startDate)} - ${formatDate(project.endDate)}`,
    startDate: formatDate(project.startDate),
    endDate: formatDate(project.endDate),
  };

  // 从 calculated_metrics 中提取各类指标
  const metricsMap = new Map(
    project.calculatedMetrics.map((m) => [m.metricType, m.metricValue as any]),
  );

  // 从 kpi_targets 中提取KPI目标
  const kpiMap = new Map(
    project.kpiTargets.map((k) => [k.metricName, k]),
  );

  // 组装KPI完成情况
  const kpiCompletion = buildKpiCompletion(metricsMap, kpiMap);

  // 组装大盘对比
  const benchmark = buildBenchmark(metricsMap);

  // 组装内容分析数据
  const contentByDirection = extractArrayMetric(metricsMap, 'content_by_direction');
  const contentByTier = extractArrayMetric(metricsMap, 'kol_tier_aggregation');
  const contentByForm = extractArrayMetric(metricsMap, 'content_by_form');

  // 组装投流数据
  const trafficOverview = extractObjectMetric(metricsMap, 'paid_traffic_overview');
  const trafficByType = extractArrayMetric(metricsMap, 'paid_traffic_by_type');
  const trafficByTargeting = extractArrayMetric(metricsMap, 'paid_traffic_by_targeting');

  // 组装亮点
  const highlightsMetric = metricsMap.get('highlights');
  const highlights: string[] = Array.isArray(highlightsMetric)
    ? highlightsMetric.map((h: any) => h.description || String(h))
    : [];

  // 组装优化建议（从AI生成内容中获取）
  const aiSuggestions = project.aiGeneratedContent.find(
    (c) => c.contentType === 'optimization_suggestions',
  );
  const optimization = parseOptimizationSuggestions(
    aiSuggestions?.isEdited ? aiSuggestions.editedContent : aiSuggestions?.generatedContent,
  );

  // 费用概览
  const costMetric = metricsMap.get('project_total_cost');
  const costOverview = costMetric
    ? {
        totalCost: costMetric.totalCost ?? 0,
        talentCost: costMetric.talentCost ?? 0,
        trafficCost: costMetric.trafficCost ?? 0,
        noteCount: project.notes.length,
      }
    : undefined;

  return {
    project: projectInfo,
    kpiCompletion,
    benchmark,
    contentByDirection,
    contentByTier,
    contentByForm,
    trafficOverview,
    trafficByType,
    trafficByTargeting,
    highlights,
    optimization,
    costOverview,
  };
}

// ---- Helper Functions ----

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function buildKpiCompletion(
  metricsMap: Map<string, any>,
  kpiMap: Map<string, any>,
): HtmlReportData['kpiCompletion'] {
  const kpiResults = metricsMap.get('kpi_completion');
  if (!kpiResults || typeof kpiResults !== 'object') {
    // 从kpiMap直接构建
    return Array.from(kpiMap.entries()).map(([metric, target]) => ({
      metric,
      kpiTarget: String(target.targetValue ?? '-'),
      actual: '-',
      completionRate: '-',
    }));
  }

  // kpiResults 是 { metricName: { target, actual, completionRate, label } } 格式
  return Object.entries(kpiResults).map(([metric, val]: [string, any]) => ({
    metric,
    kpiTarget: String(val.target ?? '-'),
    actual: String(val.actual ?? '-'),
    completionRate: val.completionRate != null
      ? `${(val.completionRate * 100).toFixed(0)}%`
      : (val.label ?? '-'),
  }));
}

function buildBenchmark(metricsMap: Map<string, any>): HtmlReportData['benchmark'] {
  const benchmarkResults = metricsMap.get('benchmark_comparison');
  if (!benchmarkResults || typeof benchmarkResults !== 'object') {
    return [];
  }

  return Object.entries(benchmarkResults).map(([metric, val]: [string, any]) => ({
    metric,
    actual: val.actual ?? '-',
    benchmarkRange: val.benchmarkRange ?? '-',
    status: val.label ?? '-',
    diff: val.percentageDiff != null
      ? `${val.percentageDiff > 0 ? '+' : ''}${val.percentageDiff.toFixed(1)}%`
      : '-',
  }));
}

function extractArrayMetric(metricsMap: Map<string, any>, key: string): any[] {
  const data = metricsMap.get(key);
  return Array.isArray(data) ? data : [];
}

function extractObjectMetric(metricsMap: Map<string, any>, key: string): any | undefined {
  const data = metricsMap.get(key);
  return data && typeof data === 'object' && !Array.isArray(data) ? data : undefined;
}

function parseOptimizationSuggestions(content: any): Record<string, string[]> {
  if (!content) return {};

  // 如果是字符串（Markdown格式），尝试解析
  if (typeof content === 'string') {
    const result: Record<string, string[]> = {};
    let currentSection = '综合建议';
    const lines = content.split('\n');

    for (const line of lines) {
      const headerMatch = line.match(/^#{1,3}\s+(.+)/);
      if (headerMatch) {
        currentSection = headerMatch[1].trim();
        if (!result[currentSection]) result[currentSection] = [];
        continue;
      }
      const bulletMatch = line.match(/^[-*•]\s+(.+)/);
      if (bulletMatch) {
        if (!result[currentSection]) result[currentSection] = [];
        result[currentSection].push(bulletMatch[1].trim());
      }
    }

    return Object.keys(result).length > 0 ? result : { '综合建议': [content] };
  }

  // 如果已经是对象格式
  if (typeof content === 'object') {
    return content as Record<string, string[]>;
  }

  return {};
}
