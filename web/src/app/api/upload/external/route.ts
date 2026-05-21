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
 * POST /api/upload/external
 * Upload external platform data (灵犀平台数据: AIPS, 品牌排名, SOC/SOV, SPU排名).
 *
 * Accepts multipart form data with:
 *   - file: xlsx/csv file
 *   - projectId: UUID of the project
 */
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const projectId = formData.get('projectId') as string | null;

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

    // Parse lingxi data using SpreadsheetParser
    const parser = new SpreadsheetParserImpl();
    const parseResult = parser.parseLingxiSheet(buffer, format);

    // Check for critical errors with no data
    const hasData = !!(
      parseResult.data.aips ||
      parseResult.data.brandRanking ||
      parseResult.data.socSov ||
      parseResult.data.spuRanking
    );

    if (parseResult.errors.length > 0 && !hasData) {
      return NextResponse.json(
        {
          error: 'Failed to parse external platform spreadsheet',
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
    let successCount = 0;

    if (hasData) {
      try {
        const persistenceService = new PrismaDataPersistenceService();
        await persistenceService.saveLingxiData(projectId, parseResult.data);
        persisted = true;
        // Trigger status transition: draft → uploading (silently ignored if already past draft)
        await transitionStatus(projectId, 'first_upload');

        // Count successful data sections
        if (parseResult.data.aips) successCount++;
        if (parseResult.data.brandRanking) successCount++;
        if (parseResult.data.socSov) successCount++;
        if (parseResult.data.spuRanking) successCount++;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json(
          { error: `Failed to persist data: ${message}` },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: successCount,
      failed: parseResult.errors.length,
      persisted,
      sections: {
        aips: !!parseResult.data.aips,
        brandRanking: !!parseResult.data.brandRanking,
        socSov: !!parseResult.data.socSov,
        spuRanking: !!parseResult.data.spuRanking,
      },
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
  } catch (error) {
    console.error('POST /api/upload/external error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
