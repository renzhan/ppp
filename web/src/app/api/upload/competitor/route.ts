import { NextResponse } from 'next/server';
import { prisma, Prisma } from '@/lib/prisma';
import { transitionStatus } from '@/project/status-machine';

/**
 * POST /api/upload/competitor
 * Batch competitor data entry (竞品数据批量录入).
 *
 * Accepts JSON body with:
 *   - projectId: UUID of the project
 *   - competitors: Array of competitor entries, each containing:
 *     - brandName: string (竞品品牌名称)
 *     - metrics: object containing core metrics (曝光量、互动量、CPE、爆文率等)
 *
 * Returns:
 *   - success: true
 *   - count: number of records created
 *
 * Requirements: 13.2, 13.3, 13.4
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { projectId, competitors } = body;

    // Validate required fields
    if (!projectId || typeof projectId !== 'string') {
      return NextResponse.json(
        { error: 'projectId is required and must be a string' },
        { status: 400 }
      );
    }

    if (!Array.isArray(competitors) || competitors.length === 0) {
      return NextResponse.json(
        { error: 'competitors is required and must be a non-empty array' },
        { status: 400 }
      );
    }

    // Validate each competitor entry
    const validationErrors: { index: number; reason: string }[] = [];
    for (let i = 0; i < competitors.length; i++) {
      const competitor = competitors[i];
      if (!competitor.brandName || typeof competitor.brandName !== 'string') {
        validationErrors.push({ index: i, reason: 'brandName is required and must be a non-empty string' });
      }
      if (!competitor.metrics || typeof competitor.metrics !== 'object' || Array.isArray(competitor.metrics)) {
        validationErrors.push({ index: i, reason: 'metrics is required and must be an object' });
      }
    }

    if (validationErrors.length > 0) {
      return NextResponse.json(
        { error: 'Validation failed for competitor entries', details: validationErrors },
        { status: 400 }
      );
    }

    // Verify project exists
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Batch create competitor data records
    const result = await prisma.competitorData.createMany({
      data: competitors.map((c: { brandName: string; metrics: Record<string, unknown> }) => ({
        projectId,
        competitorName: c.brandName,
        metrics: c.metrics as Prisma.InputJsonValue,
      })),
    });

    // Trigger status transition: draft → uploading (silently ignored if already past draft)
    await transitionStatus(projectId, 'first_upload');

    return NextResponse.json({
      success: true,
      count: result.count,
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }
    console.error('POST /api/upload/competitor error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
