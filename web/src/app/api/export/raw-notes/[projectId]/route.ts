import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fetchRawNotesData, rawNotesToExcelBuffer, generateExportFilename } from '@/lib/export-raw-notes';

/**
 * POST /api/export/raw-notes/[projectId]
 *
 * Exports raw Pugongying notes data as an Excel file.
 * Uses mock data during development (fetchRawNotes by another team).
 *
 * Returns: Excel file as attachment
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;

    // Get project info for filename
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, projectName: true },
    });

    if (!project) {
      return NextResponse.json(
        { error: '项目不存在' },
        { status: 404 }
      );
    }

    // Get noteIds for the project (from note_base table)
    const noteBaseRecords = await prisma.noteBase.findMany({
      where: { projectId },
      select: { noteId: true },
    });

    const noteIds = noteBaseRecords.map((r) => r.noteId);

    // Fetch raw notes data (uses mock in dev)
    const rawNotes = await fetchRawNotesData(noteIds);

    if (rawNotes.length === 0) {
      return NextResponse.json(
        { error: '导出失败：无可导出数据' },
        { status: 400 }
      );
    }

    // Generate Excel buffer
    const buffer = rawNotesToExcelBuffer(rawNotes);
    const filename = generateExportFilename(project.projectName);

    // Return as file download
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    });
  } catch (error) {
    console.error('POST /api/export/raw-notes error:', error);
    return NextResponse.json(
      { error: '导出失败：文件生成异常' },
      { status: 500 }
    );
  }
}
