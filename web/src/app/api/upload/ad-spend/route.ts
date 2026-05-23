import { NextResponse } from 'next/server';
import { PrismaDataPersistenceService } from '@/ingestion/persistence-service';
import { transitionStatus } from '@/project/status-machine';
import * as XLSX from 'xlsx';

const SUPPORTED_FORMATS = ['xlsx', 'csv'] as const;
type SupportedFormat = (typeof SUPPORTED_FORMATS)[number];

function getFileFormat(filename: string): SupportedFormat | null {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext === 'xlsx' || ext === 'xls') return 'xlsx';
  if (ext === 'csv') return 'csv';
  return null;
}

interface ParseError {
  row: number;
  column: string;
  reason: string;
}

interface JuguangRow {
  noteId?: string;
  fee: number;
  impression: number;
  click: number;
  interaction: number;
  iUserNum: number;
  tiUserNum: number;
  iUserPrice: number;
  tiUserPrice: number;
  searchCmtClick: number;
  searchCmtAfterRead: number;
  searchCmtAfterReadAvg: number;
  searchCmtClickCvr: number;
  acp: number;
  cpm: number;
  cpi: number;
}

/**
 * Find column index by header name (case-insensitive, supports aliases)
 */
function findColumnIndex(headers: unknown[], names: string[]): number {
  const lowerNames = names.map((n) => n.toLowerCase());
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    if (header && typeof header === 'string' && lowerNames.includes(header.trim().toLowerCase())) {
      return i;
    }
    if (header && typeof header === 'number') {
      if (lowerNames.includes(String(header).toLowerCase())) {
        return i;
      }
    }
  }
  return -1;
}

function parseNumber(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  const num = Number(value);
  return isNaN(num) ? 0 : num;
}

function parseString(value: unknown): string | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  return String(value).trim();
}

/**
 * POST /api/upload/ad-spend
 * Upload ad spend spreadsheet (聚光平台投放数据).
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

    // Parse the juguang spreadsheet
    let workbook: XLSX.WorkBook;
    try {
      workbook = format === 'csv'
        ? XLSX.read(buffer, { type: 'buffer', raw: true })
        : XLSX.read(buffer, { type: 'buffer' });
    } catch (e) {
      return NextResponse.json(
        {
          error: 'Failed to read file',
          details: [{ row: 0, column: 'A', reason: e instanceof Error ? e.message : String(e) }],
        },
        { status: 422 }
      );
    }

    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return NextResponse.json(
        { error: 'Workbook contains no sheets', details: [{ row: 0, column: 'A', reason: 'Empty workbook' }] },
        { status: 422 }
      );
    }

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }) as unknown[][];

    if (rows.length < 2) {
      return NextResponse.json(
        { error: 'Spreadsheet must have at least a header row and one data row', details: [{ row: 0, column: 'A', reason: 'Insufficient rows' }] },
        { status: 422 }
      );
    }

    const headers = rows[0];
    const errors: ParseError[] = [];
    const parsedRows: JuguangRow[] = [];

    // Map column headers to indices
    const noteIdCol = findColumnIndex(headers, ['note_id', '笔记id', '笔记ID', 'noteid']);
    const feeCol = findColumnIndex(headers, ['fee', '消耗', '花费', '费用']);
    const impressionCol = findColumnIndex(headers, ['impression', '曝光', '曝光量', '展示量']);
    const clickCol = findColumnIndex(headers, ['click', '点击', '点击量']);
    const interactionCol = findColumnIndex(headers, ['interaction', '互动', '互动量']);
    const iUserNumCol = findColumnIndex(headers, ['i_user_num', 'i人群', '兴趣人群']);
    const tiUserNumCol = findColumnIndex(headers, ['ti_user_num', 'ti人群', '深度兴趣人群']);
    const iUserPriceCol = findColumnIndex(headers, ['i_user_price', 'i人群成本', '兴趣人群成本']);
    const tiUserPriceCol = findColumnIndex(headers, ['ti_user_price', 'ti人群成本', '深度兴趣人群成本']);
    const searchCmtClickCol = findColumnIndex(headers, ['search_cmt_click', '搜索组件点击', '搜索点击']);
    const searchCmtAfterReadCol = findColumnIndex(headers, ['search_cmt_after_read', '搜索后阅读', '搜索阅读']);
    const searchCmtAfterReadAvgCol = findColumnIndex(headers, ['search_cmt_after_read_avg', '搜索后平均阅读', '搜索平均阅读']);
    const searchCmtClickCvrCol = findColumnIndex(headers, ['search_cmt_click_cvr', '搜索点击转化率', '搜索转化率']);
    const acpCol = findColumnIndex(headers, ['acp', '平均点击成本']);
    const cpmCol = findColumnIndex(headers, ['cpm', '平均千次曝光成本']);
    const cpiCol = findColumnIndex(headers, ['cpi', '平均互动成本']);

    // fee column is required
    if (feeCol === -1) {
      return NextResponse.json(
        {
          error: 'Required column "fee" (消耗) not found in headers',
          details: [{ row: 1, column: 'A', reason: 'Missing required column: fee/消耗' }],
        },
        { status: 422 }
      );
    }

    // Parse data rows
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.every((cell) => cell === null || cell === undefined || cell === '')) {
        continue; // Skip empty rows
      }

      const fee = parseNumber(row[feeCol]);
      if (fee === 0 && (row[feeCol] === null || row[feeCol] === undefined || row[feeCol] === '')) {
        errors.push({ row: i + 1, column: XLSX.utils.encode_col(feeCol), reason: 'Fee value is empty' });
        continue;
      }

      parsedRows.push({
        noteId: noteIdCol !== -1 ? parseString(row[noteIdCol]) : undefined,
        fee,
        impression: impressionCol !== -1 ? parseNumber(row[impressionCol]) : 0,
        click: clickCol !== -1 ? parseNumber(row[clickCol]) : 0,
        interaction: interactionCol !== -1 ? parseNumber(row[interactionCol]) : 0,
        iUserNum: iUserNumCol !== -1 ? parseNumber(row[iUserNumCol]) : 0,
        tiUserNum: tiUserNumCol !== -1 ? parseNumber(row[tiUserNumCol]) : 0,
        iUserPrice: iUserPriceCol !== -1 ? parseNumber(row[iUserPriceCol]) : 0,
        tiUserPrice: tiUserPriceCol !== -1 ? parseNumber(row[tiUserPriceCol]) : 0,
        searchCmtClick: searchCmtClickCol !== -1 ? parseNumber(row[searchCmtClickCol]) : 0,
        searchCmtAfterRead: searchCmtAfterReadCol !== -1 ? parseNumber(row[searchCmtAfterReadCol]) : 0,
        searchCmtAfterReadAvg: searchCmtAfterReadAvgCol !== -1 ? parseNumber(row[searchCmtAfterReadAvgCol]) : 0,
        searchCmtClickCvr: searchCmtClickCvrCol !== -1 ? parseNumber(row[searchCmtClickCvrCol]) : 0,
        acp: acpCol !== -1 ? parseNumber(row[acpCol]) : 0,
        cpm: cpmCol !== -1 ? parseNumber(row[cpmCol]) : 0,
        cpi: cpiCol !== -1 ? parseNumber(row[cpiCol]) : 0,
      });
    }

    // Persist valid data
    let persisted = false;
    if (parsedRows.length > 0) {
      try {
        const persistenceService = new PrismaDataPersistenceService();
        await persistenceService.saveJuguangData(projectId, parsedRows);
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
      success: parsedRows.length,
      failed: errors.length,
      persisted,
      errors,
    });
  } catch (error) {
    console.error('POST /api/upload/ad-spend error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
