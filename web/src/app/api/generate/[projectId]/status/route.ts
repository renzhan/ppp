import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/generate/[projectId]/status
 * Return the generation progress for a project.
 * Since generation is currently synchronous, this returns 'complete' if a version exists.
 */
export async function GET(
  _request: Request,
  { params }: { params: { projectId: string } },
) {
  try {
    const { projectId } = params;

    // Check if project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 },
      );
    }

    // Check latest report version
    const latestVersion = await prisma.reportVersion.findFirst({
      where: { projectId },
      orderBy: { generatedAt: 'desc' },
    });

    if (!latestVersion) {
      return NextResponse.json({
        status: 'idle',
        progress: 0,
        message: 'No report generated yet',
      });
    }

    // Since generation is synchronous for now, completed versions are always 'complete'
    return NextResponse.json({
      status: 'complete',
      progress: 100,
      versionId: latestVersion.id,
      versionNumber: latestVersion.versionNumber,
      generatedAt: latestVersion.generatedAt,
    });
  } catch (error) {
    console.error('GET /api/generate/[projectId]/status error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
