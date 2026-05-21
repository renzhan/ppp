import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/versions/[projectId]
 * List all report versions for a project, sorted by generation time (descending).
 */
export async function GET(
  _request: Request,
  { params }: { params: { projectId: string } },
) {
  try {
    const { projectId } = params;

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 },
      );
    }

    const versions = await prisma.reportVersion.findMany({
      where: { projectId },
      orderBy: { generatedAt: 'desc' },
      include: {
        _count: {
          select: {
            reviewEdits: true,
            moduleDecisions: true,
          },
        },
      },
    });

    return NextResponse.json({
      projectId,
      versions: versions.map((v) => ({
        id: v.id,
        versionNumber: v.versionNumber,
        generatedAt: v.generatedAt,
        status: v.status,
        config: v.config,
        createdBy: v.createdBy,
        editCount: v._count.reviewEdits,
        moduleCount: v._count.moduleDecisions,
      })),
    });
  } catch (error) {
    console.error('GET /api/versions/[projectId] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
