import { NextResponse } from 'next/server';
import { prisma, Prisma } from '@/lib/prisma';
import { rateAllMetrics } from '@/engines/rating';
import { decideModules } from '@/engines/decision';
import { generateNarrative, getAttributionStrategies } from '@/engines/narrative';
import { transitionStatus } from '@/project/status-machine';
import type { RatingInput, DecisionInput, ModuleId, NarrativeRequest } from '@/engines/types';

/**
 * POST /api/generate/[projectId]
 * Trigger report generation pipeline:
 * Rating Engine → Decision Engine → Narrative Engine → create ReportVersion
 */
export async function POST(
  request: Request,
  { params }: { params: { projectId: string } },
) {
  try {
    const { projectId } = params;

    // Verify project exists
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
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 },
      );
    }

    // Parse optional body for config overrides
    let body: {
      tone?: string;
      moduleOverrides?: Record<string, string>;
      modules?: Array<{ moduleId: string; status: string; isOverridden?: boolean }>;
    } = {};
    try {
      body = await request.json();
    } catch {
      // No body is fine
    }

    const moduleOverrides: Record<string, string> = {
      ...(body.moduleOverrides ?? {}),
    };

    for (const moduleConfig of body.modules ?? []) {
      if (
        moduleConfig?.isOverridden &&
        (moduleConfig.status === 'show' || moduleConfig.status === 'hide')
      ) {
        moduleOverrides[moduleConfig.moduleId] = moduleConfig.status;
      }
    }

    // Trigger status transition: uploading → generating
    await transitionStatus(projectId, 'generate_triggered');

    const tone = (body.tone as 'positive' | 'standard' | 'conservative') || 'standard';

    // Step 1: Rating Engine — build rating inputs from KPI targets and calculated metrics
    const ratingInputs: RatingInput[] = project.kpiTargets.map((kpi) => {
      const calculatedMetric = project.calculatedMetrics.find(
        (cm) => (cm.metricValue as Record<string, unknown>)?.metricName === kpi.metricName,
      );
      const actualValue = calculatedMetric
        ? Number((calculatedMetric.metricValue as Record<string, unknown>)?.value ?? 0)
        : 0;

      return {
        metricName: kpi.metricName,
        actualValue,
        isCostMetric: kpi.isCostMetric,
        kpiTarget: Number(kpi.targetValue),
      };
    });

    const metricRatings = rateAllMetrics(ratingInputs);

    // Step 2: Decision Engine — determine module visibility
    const totalCost = project.notes.reduce(
      (sum, n) => sum + Number(n.totalPlatformPrice),
      0,
    );
    const juguangCost = project.juguangData.reduce(
      (sum, j) => sum + Number(j.fee),
      0,
    );
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

    const moduleDecisions = decideModules(decisionInput);

    // Apply user overrides if provided
    if (Object.keys(moduleOverrides).length > 0) {
      for (const decision of moduleDecisions) {
        const override = moduleOverrides[decision.moduleId];
        if (override === 'show' || override === 'hide') {
          decision.status = override;
          decision.reason = '用户手动覆盖';
        }
      }
    }

    // Step 3: Narrative Engine — generate content for visible modules
    const reportContent: Record<string, unknown> = {};

    // Build rich data context from all available project data
    const calcMetrics = project.calculatedMetrics.reduce(
      (acc, cm) => {
        const val = cm.metricValue as Record<string, unknown>;
        if (val?.metricName) acc[String(val.metricName)] = val;
        return acc;
      },
      {} as Record<string, Record<string, unknown>>,
    );

    // Aggregate key metrics for templates
    const totalImpressions = project.notes.reduce((s, n) => s + Number(n.impNum || 0), 0);
    const totalReads = project.notes.reduce((s, n) => s + Number(n.readNum || 0), 0);
    const totalEngagement = project.notes.reduce(
      (s, n) => s + Number(n.likeNum || 0) + Number(n.favNum || 0) + Number(n.cmtNum || 0) + Number(n.shareNum || 0),
      0,
    );
    const viralNotes = project.notes.filter((n) => Number(n.readNum || 0) >= 50000);
    const noteCount = project.notes.length;
    const impressionsStr = totalImpressions >= 10000 ? `${(totalImpressions / 10000).toFixed(1)}万` : String(totalImpressions);
    const readsStr = totalReads >= 10000 ? `${(totalReads / 10000).toFixed(1)}万` : String(totalReads);
    const engagementStr = totalEngagement >= 10000 ? `${(totalEngagement / 10000).toFixed(1)}万` : String(totalEngagement);

    // KPI completion info
    const kpiDetails = project.kpiTargets.map((kpi) => {
      const calc = project.calculatedMetrics.find(
        (cm) => (cm.metricValue as Record<string, unknown>)?.metricName === kpi.metricName,
      );
      const actual = calc ? Number((calc.metricValue as Record<string, unknown>)?.value ?? 0) : 0;
      const completion = Number(kpi.targetValue) > 0 ? ((actual / Number(kpi.targetValue)) * 100).toFixed(1) : 'N/A';
      return `${kpi.metricName}: 实际${actual}, 目标${kpi.targetValue}, 完成率${completion}%`;
    }).join('; ');

    // KOL tier breakdown (from business annotations)
    const kolTypeCounts: Record<string, number> = {};
    const annotationTypes: Record<string, number> = {};

    // Content direction breakdown from business annotations
    const annotations = await prisma.businessAnnotation.findMany({ where: { projectId } });
    annotations.forEach((a) => {
      const tier = a.kolType || '未知';
      kolTypeCounts[tier] = (kolTypeCounts[tier] || 0) + 1;
      const dir = a.contentDirection || '未知';
      annotationTypes[dir] = (annotationTypes[dir] || 0) + 1;
    });
    const kolBreakdown = Object.entries(kolTypeCounts)
      .map(([tier, count]) => `${tier}${count}篇`)
      .join('、');
    const contentBreakdown = Object.entries(annotationTypes)
      .map(([dir, count]) => `${dir}${count}篇`)
      .join('、');

    // Phase breakdown
    const phaseCounts: Record<string, number> = {};
    annotations.forEach((a) => {
      if (a.launchPhase) phaseCounts[a.launchPhase] = (phaseCounts[a.launchPhase] || 0) + 1;
    });
    const phaseBreakdown = Object.entries(phaseCounts)
      .map(([p, c]) => `${p}${c}篇`)
      .join('、');

    // Plan parse background
    const planParse = project.aiGeneratedContent.find((c) => c.contentType === 'plan_parse');
    const planData = planParse ? (typeof planParse.generatedContent === 'string'
      ? JSON.parse(planParse.generatedContent) : planParse.generatedContent) : null;

    // Juguang (paid traffic) summary
    const juguangNotes = project.juguangData.length;
    const totalJuguangFee = project.juguangData.reduce((s, j) => s + Number(j.fee), 0);
    const totalJuguangImpression = project.juguangData.reduce((s, j) => s + Number(j.impression || 0), 0);

    const baseContext: Record<string, string> = {
      project_name: project.projectName,
      brand: project.brand,
      category: project.category,
      project_type: project.projectType,
      total_impressions: impressionsStr,
      total_reads: readsStr,
      total_engagement: engagementStr,
      total_cost: String(totalCost),
      note_count: String(noteCount),
      viral_count: String(viralNotes.length),
      kol_breakdown: kolBreakdown || '数据待补充',
      content_breakdown: contentBreakdown || '数据待补充',
      phase_breakdown: phaseBreakdown || '数据待补充',
      kpi_details: kpiDetails || '数据待补充',
      juguang_cost: String(juguangCost),
      juguang_notes: String(juguangNotes),
      juguang_fee: String(totalJuguangFee >= 10000 ? `${(totalJuguangFee / 10000).toFixed(1)}万` : String(totalJuguangFee)),
      juguang_impressions: String(totalJuguangImpression >= 10000 ? `${(totalJuguangImpression / 10000).toFixed(1)}万` : String(totalJuguangImpression)),
      project_objective: planData?.projectObjective || '数据待补充',
      project_strategy: planData?.strategy || '数据待补充',
      target_audience: planData?.targetAudience || '数据待补充',
      core_message: planData?.coreMessage || '数据待补充',
    };

    // Best/worst KPI
    const bestKpi = metricRatings.length > 0
      ? metricRatings.reduce((best, r) => (r.finalRating > best.finalRating ? r : best))
      : null;
    const worstKpi = metricRatings.length > 0
      ? metricRatings.reduce((worst, r) => (r.finalRating < worst.finalRating ? r : worst))
      : null;
    if (bestKpi) {
      baseContext.top_metric_name = bestKpi.metricName;
      baseContext.top_metric_value = String(
        project.kpiTargets.find((k) => k.metricName === bestKpi.metricName)?.targetValue ?? '',
      );
      baseContext.top_metric_rating = bestKpi.finalRating;
    }
    if (worstKpi) {
      baseContext.low_metric_name = worstKpi.metricName;
      baseContext.low_metric_rating = worstKpi.finalRating;
    }

    for (const decision of moduleDecisions) {
      if (decision.status === 'hide') {
        reportContent[decision.moduleId] = { status: 'hidden', paragraphs: [] };
        continue;
      }

      const narrativeRequest: NarrativeRequest = {
        projectType: project.projectType as NarrativeRequest['projectType'],
        moduleId: decision.moduleId,
        metricRatings,
        toneIntensity: tone,
        dataContext: baseContext,
        attributionStrategy: getAttributionStrategies(
          project.projectType as NarrativeRequest['projectType'],
        )[0],
      };

      try {
        const narrativeResult = await generateNarrative(narrativeRequest);
        reportContent[decision.moduleId] = {
          status: decision.status,
          ...narrativeResult,
        };
      } catch {
        reportContent[decision.moduleId] = {
          status: decision.status,
          paragraphs: [],
          error: 'Narrative generation failed',
        };
      }
    }

    // Step 4: Create ReportVersion record
    const latestVersion = await prisma.reportVersion.findFirst({
      where: { projectId },
      orderBy: { versionNumber: 'desc' },
    });

    const newVersionNumber = (latestVersion?.versionNumber ?? 0) + 1;

    const reportVersion = await prisma.reportVersion.create({
      data: {
        projectId,
        versionNumber: newVersionNumber,
        config: { tone, moduleOverrides },
        content: reportContent as unknown as Prisma.InputJsonValue,
        status: 'draft',
      },
    });

    // Persist module decisions
    await prisma.moduleDecision.createMany({
      data: moduleDecisions.map((d) => ({
        projectId,
        versionId: reportVersion.id,
        moduleId: d.moduleId,
        moduleName: d.moduleName,
        status: d.status,
        reason: d.reason,
        degradedFields: d.degradedFields
          ? (d.degradedFields as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      })),
    });

    // Persist metric ratings
    for (const rating of metricRatings) {
      await prisma.metricRatingRecord.upsert({
        where: {
          projectId_metricName: {
            projectId,
            metricName: rating.metricName,
          },
        },
        update: {
          isCostMetric: rating.isCostMetric,
          vsKpiRatio: rating.dimensions[0]?.ratio ?? null,
          vsKpiRating: rating.dimensions[0]?.rating ?? null,
          vsBenchmarkRatio: rating.dimensions[1]?.ratio ?? null,
          vsBenchmarkRating: rating.dimensions[1]?.rating ?? null,
          vsPreRatio: rating.dimensions[2]?.ratio ?? null,
          vsPreRating: rating.dimensions[2]?.rating ?? null,
          finalRating: rating.finalRating,
        },
        create: {
          projectId,
          metricName: rating.metricName,
          isCostMetric: rating.isCostMetric,
          vsKpiRatio: rating.dimensions[0]?.ratio ?? null,
          vsKpiRating: rating.dimensions[0]?.rating ?? null,
          vsBenchmarkRatio: rating.dimensions[1]?.ratio ?? null,
          vsBenchmarkRating: rating.dimensions[1]?.rating ?? null,
          vsPreRatio: rating.dimensions[2]?.ratio ?? null,
          vsPreRating: rating.dimensions[2]?.rating ?? null,
          finalRating: rating.finalRating,
        },
      });
    }

    // Trigger status transition: generating → reviewing
    await transitionStatus(projectId, 'generation_complete');

    return NextResponse.json({
      versionId: reportVersion.id,
      versionNumber: newVersionNumber,
      status: 'complete',
    });
  } catch (error) {
    console.error('POST /api/generate/[projectId] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
