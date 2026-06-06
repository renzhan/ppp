import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseNoteBaseExcel } from '@/lib/note-base-parser';

/**
 * POST /api/upload/note-base/[projectId]
 *
 * Accepts multipart/form-data with an .xlsx file containing note base table data.
 * Uses NoteBaseParser to parse the Excel file and writes to note_base table.
 *
 * Transaction operation:
 * 1. Delete all existing note_base records for this project
 * 2. Bulk insert new records from parsed data
 * 3. Update project.noteCount
 *
 * Returns { success: true, noteCount: number, warnings: string[] }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;

    // Validate projectId exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json(
        { error: '项目不存在', code: 'PROJECT_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: '请上传文件', code: 'NO_FILE' },
        { status: 400 }
      );
    }

    // Validate file extension
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      return NextResponse.json(
        { error: '仅支持.xlsx格式文件', code: 'INVALID_FILE_FORMAT' },
        { status: 400 }
      );
    }

    // Read file buffer and parse using NoteBaseParser
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const parseResult = parseNoteBaseExcel(buffer);

    // Check for valid records
    if (parseResult.records.length === 0) {
      return NextResponse.json(
        {
          error: '没有有效的数据行',
          code: 'PARSE_FAILED',
          skippedRows: parseResult.skippedRows,
          warnings: parseResult.warnings,
        },
        { status: 400 }
      );
    }

    // Deduplicate by noteId (keep last occurrence)
    const deduped = new Map<string, (typeof parseResult.records)[0]>();
    for (const record of parseResult.records) {
      deduped.set(record.noteId, record);
    }
    const uniqueRecords = Array.from(deduped.values());

    // Transaction: deleteMany → createMany → update noteCount → clean stale notes
    const noteCount = await prisma.$transaction(async (tx) => {
      // 1. Delete all existing note_base records for this project
      await tx.noteBase.deleteMany({
        where: { projectId },
      });

      // 2. Bulk insert new note_base records
      await tx.noteBase.createMany({
        data: uniqueRecords.map((record) => ({
          projectId,
          noteId: record.noteId,
          noteLink: record.noteLink,
          kolNickName: record.kolNickName,
          kolFanNum: record.kolFanNum,
          cooperationForm: record.cooperationForm,
          isRegistered: record.isRegistered,
          contentDirection: record.contentDirection,
          kolType: record.kolType,
          spuName: record.spuName,
          contentCost: record.contentCost,
          contentSettlement: record.contentSettlement,
          adSpend: record.adSpend,
          totalCost: record.totalCost,
          metrics: record.displayMetrics && Object.keys(record.displayMetrics).length > 0
            ? record.displayMetrics
            : undefined,
        })),
      });

      // 3. Update project.noteCount
      const count = uniqueRecords.length;
      await tx.project.update({
        where: { id: projectId },
        data: { noteCount: count },
      });

      // 4. Clean up notes table: remove records whose noteId is no longer in the new note_base
      const newNoteIds = uniqueRecords.map((r) => r.noteId);
      await tx.note.deleteMany({
        where: {
          projectId,
          noteId: { notIn: newNoteIds },
        },
      });

      return count;
    }, { timeout: 30000 });

    // 异步触发蒲公英数据爬取（不阻塞响应）
    try {
      const { DataIngestionService } = await import('@/ingestion/index');
      const ingestionService = new DataIngestionService();
      ingestionService.ingestBaseData(projectId).then((result) => {
        if (result.errors.length > 0) {
          console.warn(`[NoteBaseUpload] 蒲公英爬取部分失败 (project: ${projectId}):`, result.errors);
        } else {
          console.log(`[NoteBaseUpload] 蒲公英爬取完成 (project: ${projectId}): ${result.pugongyingNotes.length} 篇笔记`);
        }
      }).catch((err) => {
        console.error(`[NoteBaseUpload] 蒲公英爬取异常 (project: ${projectId}):`, err);
      });
    } catch (importErr) {
      console.error('[NoteBaseUpload] 无法加载 DataIngestionService:', importErr);
    }

    return NextResponse.json({
      success: true,
      noteCount,
      warnings: parseResult.warnings,
    });
  } catch (error) {
    console.error('POST /api/upload/note-base error:', error);
    return NextResponse.json(
      { error: '上传失败，请稍后重试', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
