import { NextResponse } from 'next/server';
import { parseNoteBaseExcel } from '@/lib/note-base-parser';

/**
 * POST /api/upload/note-base/parse
 *
 * Parse-only endpoint for note base Excel files.
 * Used when creating a new project (project doesn't exist yet in DB).
 *
 * Accepts multipart/form-data with an .xlsx file.
 * Returns parsed records with display metrics — NO database writes.
 *
 * Response: { success: true, records: ParsedNoteBaseRow[], warnings: string[], skippedRows: number }
 */
export async function POST(request: Request) {
  try {
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
      const diagnosticInfo = [
        ...(parseResult.warnings || []),
        parseResult.skippedRows > 0 ? `跳过了${parseResult.skippedRows}行（发布链接为空）` : null,
      ].filter(Boolean);
      console.error(`[note-base parse] 没有有效的数据行。skippedRows=${parseResult.skippedRows}, warnings:`, parseResult.warnings);
      return NextResponse.json(
        {
          error: diagnosticInfo.length > 0 ? diagnosticInfo.join('；') : '没有有效的数据行',
          code: 'PARSE_FAILED',
          skippedRows: parseResult.skippedRows,
          warnings: parseResult.warnings,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      records: parseResult.records,
      warnings: parseResult.warnings,
      skippedRows: parseResult.skippedRows,
    });
  } catch (error) {
    console.error('POST /api/upload/note-base/parse error:', error);
    return NextResponse.json(
      { error: '解析失败，请稍后重试', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
