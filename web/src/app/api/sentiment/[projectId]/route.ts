import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

/**
 * GET /api/sentiment/[projectId]
 * 获取项目舆情数据，按 dataType 分组返回
 * - sentiment_distribution: 情感倾向分布（正向/中性/负向）
 * - trend: 评论数变化趋势
 * - keywords: 关键词高频分布
 * - negative_comments: 负向评论列表
 *
 * Validates: Requirements 17.2, 17.3, 18.1, 18.2, 18.3, 18.4
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json(
        { error: '未登录', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const { projectId } = await params;

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, createdBy: true, participants: true },
    });

    if (!project) {
      return NextResponse.json(
        { error: '项目不存在', code: 'PROJECT_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Data permission check: non-admin users can only see their own projects
    if (session.role !== 'admin') {
      if (
        project.createdBy !== session.sub &&
        !project.participants.includes(session.sub)
      ) {
        return NextResponse.json(
          { error: '无权限', code: 'FORBIDDEN' },
          { status: 403 }
        );
      }
    }

    // Query sentiment data grouped by dataType
    const sentimentData = await prisma.sentimentData.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });

    // Group by dataType
    const grouped: Record<string, unknown[]> = {
      sentiment_distribution: [],
      trend: [],
      keywords: [],
      negative_comments: [],
    };

    for (const item of sentimentData) {
      if (grouped[item.dataType]) {
        grouped[item.dataType].push({
          id: item.id,
          dataContent: item.dataContent,
          periodStart: item.periodStart,
          periodEnd: item.periodEnd,
          createdAt: item.createdAt,
        });
      }
    }

    return NextResponse.json({
      projectId,
      sentimentDistribution: grouped.sentiment_distribution,
      trend: grouped.trend,
      keywords: grouped.keywords,
      negativeComments: grouped.negative_comments,
    });
  } catch (error) {
    console.error('GET /api/sentiment/[projectId] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
