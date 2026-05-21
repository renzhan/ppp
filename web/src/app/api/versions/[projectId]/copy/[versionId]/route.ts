import { NextResponse } from 'next/server';
import { prisma, Prisma } from '@/lib/prisma';

/**
 * POST /api/versions/[projectId]/copy/[versionId]
 * Create a copy of an existing report version.
 * The new version gets the next version number and copies content + config.
 */
export async function POST(
  _request: Request,
  { params }: { params: { projectId: string; versionId: string } },
) {
  try {
    const { projectId, versionId } = params;

    // Verify source version exists and belongs to the project
    const sourceVersion = await prisma.reportVersion.findUnique({
      where: { id: versionId },
      include: {
        moduleDecisions: true,
      },
    });

    if (!sourceVersion) {
      return NextResponse.json(
        { error: 'Source version not found' },
        { status: 404 },
      );
    }

    if (sourceVersion.projectId !== projectId) {
      return NextResponse.json(
        { error: 'Version does not belong to this project' },
        { status: 400 },
      );
    }

    // Get next version number
    const latestVersion = await prisma.reportVersion.findFirst({
      where: { projectId },
      orderBy: { versionNumber: 'desc' },
    });

    const newVersionNumber = (latestVersion?.versionNumber ?? 0) + 1;

    // Create the copy
    const newVersion = await prisma.reportVersion.create({
      data: {
        projectId,
        versionNumber: newVersionNumber,
        config: sourceVersion.config ?? {},
        content: sourceVersion.content ?? {},
        status: 'draft',
        createdBy: `copy_of_v${sourceVersion.versionNumber}`,
      },
    });

    // Copy module decisions
    if (sourceVersion.moduleDecisions.length > 0) {
      await prisma.moduleDecision.createMany({
        data: sourceVersion.moduleDecisions.map((d) => ({
          projectId,
          versionId: newVersion.id,
          moduleId: d.moduleId,
          moduleName: d.moduleName,
          status: d.status,
          reason: d.reason,
          degradedFields: d.degradedFields !== null
            ? (d.degradedFields as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          isOverridden: d.isOverridden,
        })),
      });
    }

    return NextResponse.json({
      id: newVersion.id,
      versionNumber: newVersion.versionNumber,
      copiedFrom: sourceVersion.versionNumber,
      status: newVersion.status,
    }, { status: 201 });
  } catch (error) {
    console.error('POST /api/versions/[projectId]/copy/[versionId] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
