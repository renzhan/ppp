import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

/**
 * GET /api/reviews/[id]/html
 *
 * 返回生成的 HTML 复盘报告内容，用于 iframe 渲染。
 * Content-Type: text/html
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(request);
    if (!session) {
      return new NextResponse('未登录', { status: 401 });
    }

    const { id } = await params;

    const review = await prisma.reviewConfig.findUnique({
      where: { id },
      select: {
        id: true,
        projectId: true,
        reportContent: true,
      },
    });

    if (!review) {
      return new NextResponse('复盘记录不存在', { status: 404 });
    }

    // Data permission check
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
        return new NextResponse('无权限', { status: 403 });
      }
    }

    // Extract HTML from reportContent
    const reportContent = review.reportContent as Record<string, unknown> | null;

    if (!reportContent || reportContent.type !== 'html' || !reportContent.html) {
      // If no HTML content, try to load from latest ReportVersion
      const latestVersion = await prisma.reportVersion.findFirst({
        where: { projectId: review.projectId },
        orderBy: { versionNumber: 'desc' },
        select: { content: true },
      });

      const versionContent = latestVersion?.content as Record<string, unknown> | null;
      if (versionContent?.type === 'html' && versionContent.html) {
        return new NextResponse(versionContent.html as string, {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      }

      return new NextResponse(
        `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:#666;"><p>报告尚未生成，请先点击"生成报告"按钮。</p></body></html>`,
        { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }

    return new NextResponse(reportContent.html as string, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (error) {
    console.error('GET /api/reviews/[id]/html error:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}
