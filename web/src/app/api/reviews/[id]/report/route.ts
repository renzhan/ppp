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
      select: {
        id: true,
        reportContent: true,
        projectId: true,
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

    // If ReviewConfig.reportContent is empty, try to load from the latest ReportVersion
    let reportContent = review.reportContent;
    if (!reportContent || (typeof reportContent === 'object' && Object.keys(reportContent as object).length === 0)) {
      const latestVersion = await prisma.reportVersion.findFirst({
        where: { projectId: review.projectId },
        orderBy: { versionNumber: 'desc' },
        select: { content: true },
      });
      if (latestVersion?.content) {
        reportContent = latestVersion.content;
      }
    }

    return NextResponse.json({
      id: review.id,
      reportContent,
    });
  } catch (error) {
    console.error('GET /api/reviews/[id]/report error:', error);
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
    const { content } = body;

    if (content === undefined) {
      return NextResponse.json(
        { error: '缺少 content 字段', code: 'INVALID_REQUEST' },
        { status: 400 }
      );
    }

    const updated = await prisma.reviewConfig.update({
      where: { id },
      data: {
        reportContent: content,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      id: updated.id,
      reportContent: updated.reportContent,
      updatedAt: updated.updatedAt,
    });
  } catch (error) {
    console.error('PUT /api/reviews/[id]/report error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
