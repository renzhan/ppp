import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { rateAllMetrics } from '@/engines/rating';
import { decideModules } from '@/engines/decision';
import type { DecisionInput, RatingInput } from '@/engines/types';

interface ConfigProjectData {
  projectType: string;
  kpiTargets: Array<{
    metricName: string;
    isCostMetric: boolean;
    targetValue: unknown;
  }>;
  calculatedMetrics: Array<{
    metricValue: unknown;
  }>;
  competitorData: Array<unknown>;
  juguangData: Array<{
    fee: unknown;
  }>;
  notes: Array<{
    totalPlatformPrice: unknown;
  }>;
  aiGeneratedContent: Array<{
    contentType: string;
  }>;
}

function buildModuleConfig(project: ConfigProjectData) {
  const ratingInputs: RatingInput[] = project.kpiTargets.map((kpi) => {
    const calculatedMetric = project.calculatedMetrics.find(
      (cm) => (cm.metricValue as Record<string, unknown>)?.metricName === kpi.metricName,
    );

    return {
      metricName: kpi.metricName,
      actualValue: calculatedMetric
        ? Number((calculatedMetric.metricValue as Record<string, unknown>)?.value ?? 0)
        : 0,
      isCostMetric: kpi.isCostMetric,
      kpiTarget: Number(kpi.targetValue),
    };
  });

  const metricRatings = rateAllMetrics(ratingInputs);
  const totalCost = project.notes.reduce((sum, note) => sum + Number(note.totalPlatformPrice), 0);
  const juguangCost = project.juguangData.reduce((sum, item) => sum + Number(item.fee), 0);
  const hasPlanParse = project.aiGeneratedContent.some((item) => item.contentType === 'plan_parse');

  const decisionInput: DecisionInput = {
    projectType: project.projectType as DecisionInput['projectType'],
    metricRatings,
    totalCost,
    juguangCost,
    competitorRatings: [],
    dataCompleteness: {
      M1: ['totalImpressions', 'totalEngagement', 'totalCost', 'totalNotes'],
      M2: hasPlanParse ? ['projectBackground', 'strategy', 'targetAudience'] : [],
      M3: metricRatings.length > 0 ? ['topMetrics'] : [],
      M4: metricRatings.length > 0 ? ['underperformingMetrics'] : [],
      M5: project.notes.length > 0 ? ['contentBreakdown', 'notePerformance'] : [],
      M6: project.competitorData.length > 0 ? ['competitorData', 'marketShare'] : [],
      M7: project.juguangData.length > 0 ? ['adSpendData', 'adPerformance', 'roi'] : [],
      M8: ['diagnosticData', 'recommendations'],
    },
  };

  return decideModules(decisionInput);
}

export async function GET(
  _request: Request,
  { params }: { params: { projectId: string } },
) {
  try {
    const { projectId } = params;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        kpiTargets: true,
        calculatedMetrics: true,
        competitorData: true,
        juguangData: true,
        notes: true,
        aiGeneratedContent: true,
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const latestVersion = await prisma.reportVersion.findFirst({
      where: { projectId },
      orderBy: { generatedAt: 'desc' },
    });

    const latestConfig = (latestVersion?.config ?? {}) as Record<string, unknown>;
    const latestOverrides = (latestConfig.moduleOverrides ?? {}) as Record<string, string>;
    const modules = buildModuleConfig(project).map((module) => {
      const override = latestOverrides[module.moduleId];
      if (override === 'show' || override === 'hide') {
        return {
          ...module,
          status: override,
          reason: '用户手动覆盖',
          isOverridden: true,
        };
      }

      return {
        ...module,
        isOverridden: false,
      };
    });

    const defaultTone =
      latestConfig.tone === 'positive' ||
      latestConfig.tone === 'standard' ||
      latestConfig.tone === 'conservative'
        ? latestConfig.tone
        : 'standard';

    return NextResponse.json({
      versionId: latestVersion?.id ?? null,
      versionNumber: latestVersion?.versionNumber ?? 0,
      defaultTone,
      modules,
    });
  } catch (error) {
    console.error('GET /api/generate/[projectId]/config error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
