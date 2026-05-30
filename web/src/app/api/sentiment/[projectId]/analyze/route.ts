import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { analyzeSentiment } from '@/ingestion/sentiment-analyzer';

/**
 * POST /api/sentiment/[projectId]/analyze
 * 触发舆情分析：对项目评论进行情感分类、关键词提取、趋势聚合
 * 使用 QWEN_MODEL_LITE 轻量模型批量处理
 *
 * 前置条件：项目已有评论数据（通过 ingestComments 采集）
 */
export async function POST(
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
      select: { id: true, projectName: true, createdBy: true, participants: true },
    });

    if (!project) {
      return NextResponse.json(
        { error: '项目不存在', code: 'PROJECT_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Permission check
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

    // Check if there are comments to analyze
    const commentCount = await prisma.comment.count({
      where: { projectId, isActive: true },
    });

    if (commentCount === 0) {
      return NextResponse.json(
        { error: '该项目暂无评论数据，请先采集评论', code: 'NO_COMMENTS' },
        { status: 400 }
      );
    }

    // Run sentiment analysis
    await analyzeSentiment(projectId);

    return NextResponse.json({
      success: true,
      message: `舆情分析完成，共处理 ${commentCount} 条评论`,
      commentCount,
    });
  } catch (error) {
    console.error('POST /api/sentiment/[projectId]/analyze error:', error);
    return NextResponse.json(
      { error: '舆情分析失败，请稍后重试', code: 'ANALYSIS_FAILED' },
      { status: 500 }
    );
  }
}
