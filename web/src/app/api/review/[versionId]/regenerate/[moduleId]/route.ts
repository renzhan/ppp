import { NextResponse } from 'next/server';
import { prisma, Prisma } from '@/lib/prisma';
import { generateNarrative, getAttributionStrategies, loadTemplate, substituteVariables } from '@/engines/narrative';
import type { NarrativeRequest, ModuleId, ToneIntensity } from '@/engines/types';

/**
 * POST /api/review/[versionId]/regenerate/[moduleId]
 * Regenerate narrative content for a specific module.
 * Saves a ReviewEdit record for the regeneration.
 */
export async function POST(
  request: Request,
  { params }: { params: { versionId: string; moduleId: string } },
) {
  try {
    const { versionId, moduleId } = params;

    let body: { tone?: string } = {};
    try {
      body = await request.json();
    } catch {
      // No body is fine, use existing tone
    }

    // Verify version exists with project info
    const version = await prisma.reportVersion.findUnique({
      where: { id: versionId },
      include: {
        project: true,
      },
    });

    if (!version) {
      return NextResponse.json(
        { error: 'Report version not found' },
        { status: 404 },
      );
    }

    const config = version.config as Record<string, unknown>;
    const tone = (body.tone ?? config.tone ?? 'standard') as ToneIntensity;
    const projectType = version.project.projectType as NarrativeRequest['projectType'];

    // Get metric ratings for context
    const metricRatings = await prisma.metricRatingRecord.findMany({
      where: { projectId: version.projectId },
    });

    // Load all related project data for rich context
    const projectData = await prisma.project.findUnique({
      where: { id: version.projectId },
      include: {
        notes: true,
        kpiTargets: true,
        calculatedMetrics: true,
        juguangData: true,
        aiGeneratedContent: true,
        businessAnnotations: true,
      },
    });

    // Build rich data context (same as full generate endpoint)
    const notes = projectData?.notes || [];
    const totalImpressions = notes.reduce((s, n) => s + Number(n.impNum || 0), 0);
    const totalReads = notes.reduce((s, n) => s + Number(n.readNum || 0), 0);
    const totalEngagement = notes.reduce(
      (s, n) => s + Number(n.likeNum || 0) + Number(n.favNum || 0) + Number(n.cmtNum || 0) + Number(n.shareNum || 0) + Number(n.followNum || 0), 0);
    const totalCost = notes.reduce((s, n) => s + Number(n.totalPlatformPrice || 0), 0);
    const viralNotes = notes.filter((n) => Number(n.readNum || 0) >= 50000);
    const juguangFee = projectData?.juguangData.reduce((s, j) => s + Number(j.fee), 0) || 0;
    const juguangImp = projectData?.juguangData.reduce((s, j) => s + Number(j.impression || 0), 0) || 0;

    // KOL and content breakdowns
    const kolTypes: Record<string, number> = {};
    notes.forEach((n) => { const t = n.kolNickName || '未知'; kolTypes[t] = (kolTypes[t] || 0) + 1; });
    const kolBreakdown = Object.entries(kolTypes).map(([k, v]) => `${k}${v}篇`).join('、') || '数据待补充';

    const annotations = projectData?.businessAnnotations || [];
    const contentDirs: Record<string, number> = {};
    annotations.forEach((a) => { const d = a.contentDirection || '未知'; contentDirs[d] = (contentDirs[d] || 0) + 1; });
    const contentBreakdown = Object.entries(contentDirs).map(([d, c]) => `${d}${c}篇`).join('、') || '数据待补充';

    const phases: Record<string, number> = {};
    annotations.forEach((a) => { if (a.launchPhase) phases[a.launchPhase] = (phases[a.launchPhase] || 0) + 1; });
    const phaseBreakdown = Object.entries(phases).map(([p, c]) => `${p}${c}篇`).join('、') || '数据待补充';

    const planParse = projectData?.aiGeneratedContent.find((c) => c.contentType === 'plan_parse');
    const planData = planParse ? (typeof planParse.generatedContent === 'string' ? JSON.parse(planParse.generatedContent) : planParse.generatedContent) : null;

    // KPI details
    const kpiDetails = projectData?.kpiTargets.map((kpi) => {
      const calc = projectData?.calculatedMetrics.find(
        (cm) => (cm.metricValue as Record<string, unknown>)?.metricName === kpi.metricName);
      const actual = calc ? Number((calc.metricValue as Record<string, unknown>)?.value ?? 0) : 0;
      const completion = Number(kpi.targetValue) > 0 ? `${((actual / Number(kpi.targetValue)) * 100).toFixed(1)}%` : 'N/A';
      return `${kpi.metricName}=${actual}(目标${kpi.targetValue},${completion})`;
    }).join('; ') || '数据待补充';

    const ratings = metricRatings.map((r) => ({
      metricName: r.metricName,
      isCostMetric: r.isCostMetric,
      dimensions: [
        { dimension: 'vs_kpi' as const, ratio: Number(r.vsKpiRatio ?? 0), rating: (r.vsKpiRating as 'S' | 'A' | 'B' | 'C' | 'D') ?? null },
        { dimension: 'vs_benchmark' as const, ratio: Number(r.vsBenchmarkRatio ?? 0), rating: (r.vsBenchmarkRating as 'S' | 'A' | 'B' | 'C' | 'D') ?? null },
        { dimension: 'vs_pre_campaign' as const, ratio: Number(r.vsPreRatio ?? 0), rating: (r.vsPreRating as 'S' | 'A' | 'B' | 'C' | 'D') ?? null },
      ],
      finalRating: r.finalRating as 'S' | 'A' | 'B' | 'C' | 'D',
    }));

    const bestKpi = ratings.length > 0 ? ratings.reduce((b, r) => (r.finalRating > b.finalRating ? r : b)) : null;
    const worstKpi = ratings.length > 0 ? ratings.reduce((w, r) => (r.finalRating < w.finalRating ? r : w)) : null;

    const dataContext: Record<string, string> = {
      project_name: version.project.projectName,
      brand: version.project.brand,
      category: version.project.category,
      project_type: projectType,
      total_impressions: totalImpressions >= 10000 ? `${(totalImpressions / 10000).toFixed(1)}万` : String(totalImpressions),
      total_reads: totalReads >= 10000 ? `${(totalReads / 10000).toFixed(1)}万` : String(totalReads),
      total_engagement: totalEngagement >= 10000 ? `${(totalEngagement / 10000).toFixed(1)}万` : String(totalEngagement),
      total_cost: String(totalCost),
      note_count: String(notes.length),
      viral_count: String(viralNotes.length),
      kol_breakdown: kolBreakdown,
      content_breakdown: contentBreakdown,
      phase_breakdown: phaseBreakdown,
      kpi_details: kpiDetails,
      juguang_cost: String(juguangFee),
      juguang_notes: String(projectData?.juguangData.length || 0),
      juguang_fee: String(juguangFee >= 10000 ? `${(juguangFee / 10000).toFixed(1)}万` : String(juguangFee)),
      juguang_impressions: String(juguangImp >= 10000 ? `${(juguangImp / 10000).toFixed(1)}万` : String(juguangImp)),
      project_objective: planData?.projectObjective || '数据待补充',
      project_strategy: planData?.strategy || '数据待补充',
      target_audience: planData?.targetAudience || '数据待补充',
      core_message: planData?.coreMessage || '数据待补充',
      top_metric_name: bestKpi?.metricName || '无',
      top_metric_value: bestKpi ? String(projectData?.kpiTargets.find((k) => k.metricName === bestKpi.metricName)?.targetValue ?? '') : '',
      top_metric_rating: bestKpi?.finalRating || '',
      low_metric_name: worstKpi?.metricName || '无',
      low_metric_rating: worstKpi?.finalRating || '',
    };

    const narrativeRequest: NarrativeRequest = {
      projectType,
      moduleId: moduleId as ModuleId,
      metricRatings: ratings,
      toneIntensity: tone,
      dataContext,
      attributionStrategy: getAttributionStrategies(projectType)[0],
    };

    // Debug: print prompt and context
    const template = loadTemplate(projectType, moduleId as ModuleId, tone);
    const assembledPrompt = substituteVariables(template.prompt, dataContext);
    console.log('='.repeat(80));
    console.log(`[重新生成] 模块=${moduleId}, 语气=${tone}`);
    console.log('--- 注入的数据上下文 (dataContext) ---');
    for (const [key, val] of Object.entries(dataContext)) {
      console.log(`  ${key}=${String(val).slice(0, 100)}`);
    }
    console.log('--- 组装后的完整提示词 (prompt) ---');
    console.log(assembledPrompt.slice(0, 2000));
    console.log('='.repeat(80));

    // Get previous content
    const currentContent = version.content as Record<string, unknown>;
    const previousModuleContent = currentContent[moduleId] ?? null;

    // Regenerate
    const narrativeResult = await generateNarrative(narrativeRequest);

    // Update report content
    const updatedContent = {
      ...currentContent,
      [moduleId]: {
        status: 'show',
        ...narrativeResult,
      },
    };

    await prisma.reportVersion.update({
      where: { id: versionId },
      data: { content: updatedContent as unknown as Prisma.InputJsonValue },
    });

    // Save ReviewEdit record
    await prisma.reviewEdit.create({
      data: {
        projectId: version.projectId,
        versionId,
        moduleId,
        editType: 'regenerate',
        previousContent: previousModuleContent
          ? (previousModuleContent as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        newContent: narrativeResult as unknown as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({
      success: true,
      moduleId,
      result: narrativeResult,
    });
  } catch (error) {
    console.error('POST /api/review/[versionId]/regenerate/[moduleId] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
