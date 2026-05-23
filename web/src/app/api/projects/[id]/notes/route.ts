import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

/**
 * GET /api/projects/[id]/notes
 *
 * Returns notes (source data) for a project.
 * Used by the proofreading platform for source data comparison.
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

    // Check project exists
    const project = await prisma.project.findUnique({
      where: { id },
      select: { id: true, createdBy: true, participants: true },
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
        totalPlatformPrice: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 200, // Limit for performance
    });

    return NextResponse.json({ notes });
  } catch (error) {
    console.error('GET /api/projects/[id]/notes error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
