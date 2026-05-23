import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

/**
 * GET /api/sentiment/export-records
 * 查询导出记录列表
 * 支持 ?projectId= 过滤特定项目的导出记录
 *
 * Validates: Requirements 19.2, 19.4
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json(
        { error: '未登录', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    // Build query filter
    const where: Record<string, unknown> = {};

    if (projectId) {
      where.projectId = projectId;
    }

    // Data permission check: non-admin users can only see their own export records
    if (session.role !== 'admin') {
      // Get projects the user has access to
      const accessibleProjects = await prisma.project.findMany({
        where: {
          OR: [
            { createdBy: session.sub },
            { participants: { has: session.sub } },
          ],
        },
        select: { id: true },
      });

      const accessibleProjectIds = accessibleProjects.map((p) => p.id);

      // If filtering by projectId, verify access
      if (projectId) {
        if (!accessibleProjectIds.includes(projectId)) {
          return NextResponse.json(
            { error: '无权限', code: 'FORBIDDEN' },
            { status: 403 }
          );
        }
      } else {
        // Only show records for accessible projects
        where.projectId = { in: accessibleProjectIds };
      }
    }

    const exportRecords = await prisma.exportRecord.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ records: exportRecords });
  } catch (error) {
    console.error('GET /api/sentiment/export-records error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
