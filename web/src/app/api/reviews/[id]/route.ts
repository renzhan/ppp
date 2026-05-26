import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json(
        { error: '未登录', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const { id } = await params;

    const review = await prisma.reviewConfig.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            id: true,
            projectName: true,
            category: true,
            brand: true,
            businessLine: true,
          },
        },
      },
    });

    if (!review) {
      return NextResponse.json(
        { error: '复盘记录不存在', code: 'REVIEW_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Data permission check: non-admin users can only see reviews for projects they created or participate in
    if (session.role !== 'admin') {
      const project = await prisma.project.findUnique({
        where: { id: review.projectId },
        select: { createdBy: true, participants: true },
      });

      if (
        project &&
        project.createdBy !== session.sub &&
        !project.participants.includes(session.sub)
      ) {
        return NextResponse.json(
          { error: '无权限', code: 'FORBIDDEN' },
          { status: 403 }
        );
      }
    }

    return NextResponse.json(review);
  } catch (error) {
    console.error('GET /api/reviews/[id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json(
        { error: '未登录', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Check if review exists
    const existing = await prisma.reviewConfig.findUnique({
      where: { id },
      select: { id: true, projectId: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: '复盘记录不存在', code: 'REVIEW_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Data permission check
    if (session.role !== 'admin') {
      const project = await prisma.project.findUnique({
        where: { id: existing.projectId },
        select: { createdBy: true, participants: true },
      });

      if (
        project &&
        project.createdBy !== session.sub &&
        !project.participants.includes(session.sub)
      ) {
        return NextResponse.json(
          { error: '无权限', code: 'FORBIDDEN' },
          { status: 403 }
        );
      }
    }

    const body = await request.json();
    const {
      benchmark,
      influencerTiers,
      kpiTargets,
      engagementMetric,
      viralMetric,
      modules,
      launchPhases,
      presentationId,
    } = body;

    // Build update data with only provided fields
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (benchmark !== undefined) updateData.benchmark = benchmark;
    if (influencerTiers !== undefined) updateData.influencerTiers = influencerTiers;
    if (kpiTargets !== undefined) updateData.kpiTargets = kpiTargets;
    if (engagementMetric !== undefined) updateData.engagementMetric = engagementMetric;
    if (viralMetric !== undefined) updateData.viralMetric = viralMetric;
    if (modules !== undefined) updateData.modules = modules;
    if (launchPhases !== undefined) updateData.launchPhases = launchPhases;
    if (presentationId !== undefined) updateData.presentationId = presentationId;

    const updated = await prisma.reviewConfig.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('PUT /api/reviews/[id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
