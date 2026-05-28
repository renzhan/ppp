import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

/**
 * GET /api/projects/[id]/notes
 *
 * Returns notes (source data) for a project with pagination.
 * Query params:
 *   - page: page number (1-indexed, default 1)
 *   - pageSize: items per page (default 10, max 100)
 *
 * Returns { notes, total, page, pageSize, updatedAt, updatedBy }
 */
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

    // Parse pagination params
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '10', 10)));

    // Check project exists
    const project = await prisma.project.findUnique({
      where: { id },
      select: { id: true, createdBy: true, participants: true, noteCount: true, updatedAt: true },
    });

    if (!project) {
      return NextResponse.json(
        { error: '项目不存在', code: 'PROJECT_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Data permission check
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

    // Get total count
    const total = await prisma.note.count({
      where: { projectId: id },
    });

    // Fetch paginated notes
    const notes = await prisma.note.findMany({
      where: { projectId: id },
      select: {
        id: true,
        noteId: true,
        kolNickName: true,
        kolFanNum: true,
        noteLink: true,
        noteType: true,
        spuName: true,
        impNum: true,
        readNum: true,
        engageNum: true,
        likeNum: true,
        favNum: true,
        cmtNum: true,
        shareNum: true,
        followNum: true,
        kolPrice: true,
        serviceFee: true,
        totalPlatformPrice: true,
        isUnderwater: true,
        underwaterPrice: true,
        heatImpNum: true,
        heatReadNum: true,
        createdAt: true,
        components: true,
      },
      orderBy: { createdAt: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    // Get the latest note's createdAt as the data update time
    const latestNote = total > 0
      ? await prisma.note.findFirst({
          where: { projectId: id },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        })
      : null;

    return NextResponse.json({
      notes,
      total,
      page,
      pageSize,
      updatedAt: latestNote?.createdAt ?? null,
    });
  } catch (error) {
    console.error('GET /api/projects/[id]/notes error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
