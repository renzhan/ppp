import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/projects/[id]/note-base
 *
 * Returns note_base records for a project.
 * Response: { records, count }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const records = await prisma.noteBase.findMany({
      where: { projectId: id },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({
      records,
      count: records.length,
    });
  } catch (error) {
    console.error('GET /api/projects/[id]/note-base error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
