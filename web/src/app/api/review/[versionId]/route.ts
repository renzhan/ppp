import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/review/[versionId]
 * Get the full report version content for the review platform.
 */
export async function GET(
  _request: Request,
  { params }: { params: { versionId: string } },
) {
  try {
    const { versionId } = params;

    const version = await prisma.reportVersion.findUnique({
      where: { id: versionId },
      include: {
        moduleDecisions: {
          orderBy: { moduleId: 'asc' },
        },
        reviewEdits: {
          orderBy: { editedAt: 'desc' },
        },
        project: {
          select: {
            id: true,
            projectName: true,
            brand: true,
            category: true,
            projectType: true,
          },
        },
      },
    });

    if (!version) {
      return NextResponse.json(
        { error: 'Report version not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      id: version.id,
      projectId: version.projectId,
      versionNumber: version.versionNumber,
      generatedAt: version.generatedAt,
      status: version.status,
      config: version.config,
      content: version.content,
      modules: version.moduleDecisions,
      edits: version.reviewEdits,
      project: version.project,
    });
  } catch (error) {
    console.error('GET /api/review/[versionId] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
