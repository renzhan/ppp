import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json(
        { error: '未登录', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    // Data permission filtering
    const where: Record<string, unknown> = {};
    if (session.role !== 'admin') {
      where.project = {
        OR: [
          { createdBy: session.sub },
          { participants: { has: session.sub } },
        ],
      };
    }

    const reviews = await prisma.reviewConfig.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
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

    // Resolve createdBy user IDs to display names
    const createdByIds = reviews.map((r) => r.createdBy).filter(Boolean);
    const uniqueCreatedByIds = Array.from(new Set(createdByIds));
    const users = uniqueCreatedByIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: uniqueCreatedByIds } },
          select: { id: true, displayName: true, username: true },
        })
      : [];
    const userMap = new Map(
      users.map((u) => [u.id, u.displayName || u.username])
    );

    const items = reviews.map((r) => ({
      id: r.id,
      projectId: r.projectId,
      projectName: r.project.projectName,
      category: r.project.category,
      brand: r.project.brand,
      businessLine: r.project.businessLine,
      status: r.status,
      createdBy: r.createdBy,
      createdByDisplayName: userMap.get(r.createdBy) || null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));

    return NextResponse.json({ items });
  } catch (error) {
    console.error('GET /api/reviews error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json(
        { error: '未登录', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      projectId,
      benchmark,
      influencerTiers,
      kpiTargets,
      engagementMetric,
      viralMetric,
      modules,
      launchPhases,
    } = body;

    if (!projectId) {
      return NextResponse.json(
        { error: '项目ID为必填项', code: 'VALIDATION_ERROR', fields: { projectId: 'projectId is required' } },
        { status: 400 }
      );
    }

    // Check project exists and has notes
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, noteCount: true },
    });

    if (!project) {
      return NextResponse.json(
        { error: '项目不存在', code: 'PROJECT_NOT_FOUND' },
        { status: 404 }
      );
    }

    if (project.noteCount === 0) {
      return NextResponse.json(
        { error: '请先上传笔记底表', code: 'NOTES_REQUIRED' },
        { status: 400 }
      );
    }

    const reviewConfig = await prisma.reviewConfig.create({
      data: {
        projectId,
        createdBy: session.sub,
        benchmark: benchmark ?? {},
        influencerTiers: influencerTiers ?? [],
        kpiTargets: kpiTargets ?? {},
        engagementMetric: engagementMetric ?? 'exclude_follow',
        viralMetric: viralMetric ?? 'like_comment_share',
        modules: modules ?? {},
        launchPhases: launchPhases ?? [],
      },
    });

    return NextResponse.json(reviewConfig, { status: 201 });
  } catch (error) {
    console.error('POST /api/reviews error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
