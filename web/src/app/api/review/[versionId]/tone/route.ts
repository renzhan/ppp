import { NextResponse } from 'next/server';
import { prisma, Prisma } from '@/lib/prisma';
import { generateNarrative, getAttributionStrategies } from '@/engines/narrative';
import type { NarrativeRequest, ModuleId, ToneIntensity } from '@/engines/types';

/**
 * PUT /api/review/[versionId]/tone
 * Switch the tone intensity for the entire report or a specific module.
 * Regenerates narrative content with the new tone.
 * Saves ReviewEdit records for the changes.
 */
export async function PUT(
  request: Request,
  { params }: { params: { versionId: string } },
) {
  try {
    const { versionId } = params;
    const body = await request.json();
    const { tone, moduleId, editedBy } = body;

    if (!tone || !['positive', 'standard', 'conservative'].includes(tone)) {
      return NextResponse.json(
        { error: 'tone must be one of: positive, standard, conservative' },
        { status: 400 },
      );
    }

    // Verify version exists
    const version = await prisma.reportVersion.findUnique({
      where: { id: versionId },
      include: {
        project: true,
        moduleDecisions: true,
      },
    });

    if (!version) {
      return NextResponse.json(
        { error: 'Report version not found' },
        { status: 404 },
      );
    }

    const projectType = version.project.projectType as NarrativeRequest['projectType'];
    const currentContent = version.content as Record<string, unknown>;

    // Get metric ratings
    const metricRatings = await prisma.metricRatingRecord.findMany({
      where: { projectId: version.projectId },
    });

    const mappedRatings = metricRatings.map((r) => ({
      metricName: r.metricName,
      isCostMetric: r.isCostMetric,
      dimensions: [
        { dimension: 'vs_kpi' as const, ratio: Number(r.vsKpiRatio ?? 0), rating: (r.vsKpiRating as 'S' | 'A' | 'B' | 'C' | 'D') ?? null },
        { dimension: 'vs_benchmark' as const, ratio: Number(r.vsBenchmarkRatio ?? 0), rating: (r.vsBenchmarkRating as 'S' | 'A' | 'B' | 'C' | 'D') ?? null },
        { dimension: 'vs_pre_campaign' as const, ratio: Number(r.vsPreRatio ?? 0), rating: (r.vsPreRating as 'S' | 'A' | 'B' | 'C' | 'D') ?? null },
      ],
      finalRating: r.finalRating as 'S' | 'A' | 'B' | 'C' | 'D',
    }));

    // Determine which modules to regenerate
    const modulesToRegenerate: ModuleId[] = moduleId
      ? [moduleId as ModuleId]
      : version.moduleDecisions
          .filter((d) => d.status !== 'hide')
          .map((d) => d.moduleId as ModuleId);

    const updatedContent = { ...currentContent };

    for (const modId of modulesToRegenerate) {
      const previousModuleContent = currentContent[modId] ?? null;

      const narrativeRequest: NarrativeRequest = {
        projectType,
        moduleId: modId,
        metricRatings: mappedRatings,
        toneIntensity: tone as ToneIntensity,
        dataContext: {
          projectName: version.project.projectName,
          brand: version.project.brand,
          category: version.project.category,
        },
        attributionStrategy: getAttributionStrategies(projectType)[0],
      };

      try {
        const narrativeResult = await generateNarrative(narrativeRequest);
        updatedContent[modId] = { status: 'show', ...narrativeResult };
      } catch {
        // Keep existing content on failure
      }

      // Save ReviewEdit record
      await prisma.reviewEdit.create({
        data: {
          projectId: version.projectId,
          versionId,
          moduleId: modId,
          editType: 'tone_change',
          previousContent: previousModuleContent
            ? (previousModuleContent as unknown as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          newContent: { tone } as Prisma.InputJsonValue,
          editedBy: editedBy ?? null,
        },
      });
    }

    // Update version content and config
    const config = version.config as Record<string, unknown>;
    await prisma.reportVersion.update({
      where: { id: versionId },
      data: {
        content: updatedContent as unknown as Prisma.InputJsonValue,
        config: { ...config, tone } as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({
      success: true,
      tone,
      modulesUpdated: modulesToRegenerate,
    });
  } catch (error) {
    console.error('PUT /api/review/[versionId]/tone error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
