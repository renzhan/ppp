import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import path from 'path';
import fs from 'fs/promises';

/**
 * POST /api/sentiment/[projectId]/export
 * 导出舆情分析数据为 JSON 文件，创建 ExportRecord 记录
 * 返回文件下载 URL
 *
 * Validates: Requirements 19.1, 19.3, 19.4
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

    // Data permission check: non-admin users can only export their own projects
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

    // Query all sentiment data for this project
    const sentimentData = await prisma.sentimentData.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });

    // Group by dataType for export
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

    // Generate export file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `sentiment_${project.projectName}_${timestamp}.json`;

    const exportContent = {
      projectId,
      projectName: project.projectName,
      exportedAt: new Date().toISOString(),
      exportedBy: session.sub,
      data: {
        sentimentDistribution: grouped.sentiment_distribution,
        trend: grouped.trend,
        keywords: grouped.keywords,
        negativeComments: grouped.negative_comments,
      },
    };

    // Ensure exports directory exists
    const exportsDir = path.join(process.cwd(), 'uploads', 'exports');
    await fs.mkdir(exportsDir, { recursive: true });

    // Write export file
    const filePath = path.join(exportsDir, fileName);
    await fs.writeFile(filePath, JSON.stringify(exportContent, null, 2), 'utf-8');

    // Create ExportRecord
    const fileUrl = `/uploads/exports/${fileName}`;
    const exportRecord = await prisma.exportRecord.create({
      data: {
        projectId,
        exportType: 'sentiment',
        fileName,
        fileUrl,
        exportedBy: session.sub,
      },
    });

    return NextResponse.json({
      success: true,
      fileName,
      fileUrl,
      exportRecordId: exportRecord.id,
    });
  } catch (error) {
    console.error('POST /api/sentiment/[projectId]/export error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
