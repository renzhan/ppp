import { NextResponse } from 'next/server';
import { SpreadsheetParserImpl } from '@/ingestion/spreadsheet-parser';
import { PrismaDataPersistenceService } from '@/ingestion/persistence-service';
import { transitionStatus } from '@/project/status-machine';

const SUPPORTED_FORMATS = ['xlsx', 'csv'] as const;
type SupportedFormat = (typeof SUPPORTED_FORMATS)[number];

function getFileFormat(filename: string): SupportedFormat | null {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext === 'xlsx' || ext === 'xls') return 'xlsx';
  if (ext === 'csv') return 'csv';
  return null;
}

/**
 * POST /api/upload/execution
 * Upload execution spreadsheet (蒲公英笔记数据 + 业务标注).
 *
 * Accepts multipart form data with:
 *   - file: xlsx/csv file
 *   - projectId: UUID of the project
 *   - type: 'pugongying' | 'annotation' (defaults to 'pugongying')
 */
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const projectId = formData.get('projectId') as string | null;
    const uploadType = (formData.get('type') as string) || 'pugongying';

    // Validate required fields
    if (!file) {
      return NextResponse.json(
        { error: 'File is required', fields: { file: 'file is required' } },
        { status: 400 }
      );
    }
    if (!projectId) {
      return NextResponse.json(
        { error: 'projectId is required', fields: { projectId: 'projectId is required' } },
        { status: 400 }
      );
    }

    // Validate file format
    const format = getFileFormat(file.name);
    if (!format) {
      return NextResponse.json(
        {
          error: `Unsupported file format. File: ${file.name}`,
          supportedFormats: ['xlsx', 'csv'],
        },
        { status: 415 }
      );
    }

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const parser = new SpreadsheetParserImpl();
    const persistenceService = new PrismaDataPersistenceService();

    if (uploadType === 'annotation') {
      // Parse business annotations
      const parseResult = parser.parseAnnotationSheet(buffer, format);

      if (parseResult.errors.length > 0 && parseResult.data.length === 0) {
        return NextResponse.json(
          {
            error: 'Failed to parse annotation spreadsheet',
            details: parseResult.errors.map((e) => ({
              row: e.row,
              column: e.column,
              reason: e.message,
            })),
          },
          { status: 422 }
        );
      }

      // Persist valid data
      let persisted = false;
      if (parseResult.data.length > 0) {
        try {
          await persistenceService.saveAnnotations(projectId, parseResult.data);
          persisted = true;
          // Trigger status transition: draft → uploading (silently ignored if already past draft)
          await transitionStatus(projectId, 'first_upload');
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return NextResponse.json(
            { error: `Failed to persist data: ${message}` },
            { status: 500 }
          );
        }
      }

      return NextResponse.json({
        success: parseResult.data.length,
        failed: parseResult.errors.length,
        persisted,
        errors: parseResult.errors.map((e) => ({
          row: e.row,
          column: e.column,
          reason: e.message,
        })),
        warnings: parseResult.warnings.map((w) => ({
          row: w.row,
          column: w.column,
          reason: w.message,
        })),
      });
    } else {
      // Parse pugongying notes (execution data)
      // The SpreadsheetParser currently handles Lingxi data and annotations.
      // For pugongying execution data, we use the annotation parser as the execution
      // spreadsheet contains note-level data with business annotations.
      const parseResult = parser.parseAnnotationSheet(buffer, format);

      if (parseResult.errors.length > 0 && parseResult.data.length === 0) {
        return NextResponse.json(
          {
            error: 'Failed to parse execution spreadsheet',
            details: parseResult.errors.map((e) => ({
              row: e.row,
              column: e.column,
              reason: e.message,
            })),
          },
          { status: 422 }
        );
      }

      // Persist valid data
      let persisted = false;
      if (parseResult.data.length > 0) {
        try {
          await persistenceService.saveAnnotations(projectId, parseResult.data);
          persisted = true;
          // Trigger status transition: draft → uploading (silently ignored if already past draft)
          await transitionStatus(projectId, 'first_upload');
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return NextResponse.json(
            { error: `Failed to persist data: ${message}` },
            { status: 500 }
          );
        }
      }

      return NextResponse.json({
        success: parseResult.data.length,
        failed: parseResult.errors.length,
        persisted,
        errors: parseResult.errors.map((e) => ({
          row: e.row,
          column: e.column,
          reason: e.message,
        })),
        warnings: parseResult.warnings.map((w) => ({
          row: w.row,
          column: w.column,
          reason: w.message,
        })),
      });
    }
  } catch (error) {
    console.error('POST /api/upload/execution error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
