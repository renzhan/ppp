import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { transitionStatus } from '@/project/status-machine';

/**
 * POST /api/review/[versionId]/finalize
 * Finalize a report version, transitioning the project status to "finalized".
 *
 * This endpoint:
 * 1. Verifies the report version exists
 * 2. Updates the report version status to "finalized"
 * 3. Triggers the project status machine transition: reviewing → finalized
 *
 * Requirements: 12.5
 */
export async function POST(
  _request: Request,
  { params }: { params: { versionId: string } },
) {
  try {
    const { versionId } = params;

    // Find the report version with its project
    const version = await prisma.reportVersion.findUnique({
      where: { id: versionId },
      select: {
        id: true,
        projectId: true,
        status: true,
      },
    });

    if (!version) {
      return NextResponse.json(
        { error: 'Report version not found' },
        { status: 404 },
      );
    }

    // Update the report version status to finalized
    await prisma.reportVersion.update({
      where: { id: versionId },
      data: { status: 'finalized' },
    });

    // Trigger status transition: reviewing → finalized
    const result = await transitionStatus(version.projectId, 'finalize');

    return NextResponse.json({
      success: true,
      versionId,
      projectId: version.projectId,
      projectStatus: result.newStatus ?? 'unchanged',
    });
  } catch (error) {
    console.error('POST /api/review/[versionId]/finalize error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
