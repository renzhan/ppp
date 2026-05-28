import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { NextResponse } from 'next/server';
import { SpreadsheetParserImpl } from '@/ingestion/spreadsheet-parser';
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

interface ParseErrorDetail {
  sheet: string;
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
 * Known data column name patterns for header detection.
 * MUST match whole cell (not substring) to avoid matching group headers.
 */
const DATA_HEADER_PATTERNS = [
  '笔记id', '笔记ID', '笔记链接', '笔记标题', '笔记类型',
  '博主昵称', '博主粉丝量', '博主主页链接',
  '内容形式', '内容标签', '内容方向',
  '订单id', '合作名称', '报备品牌', '下单账号', '博主报价', '服务费金额',
  'spu名称',
  '曝光量', '阅读量', '互动量', '互动率', '点赞量', '收藏量', '评论量', '分享量', '关注量',
  '自然曝光量', '自然阅读量', '推广曝光量', '推广阅读量',
  '消费', '消耗', '费用', '展现量', '点击量', '搜索组件点击量',
  '阅读单价', '互动单价',
];

/**
 * Find the first row that looks like a data header (skips multi-row header groups).
 * Scans up to `maxScan` rows, requiring multiple column name matches.
 */
function findHeaderRow(rows: unknown[][], maxScan = 5): { headerRow: number; headers: unknown[] } {
  let best = { headerRow: 0, headers: rows[0] || [], score: -1 };
  for (let i = 0; i < Math.min(maxScan, rows.length); i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    // Count exact matches against known data column names
    let score = 0;
    for (const cell of row) {
      const s = String(cell ?? '').trim();
      if (s && DATA_HEADER_PATTERNS.some((p) => s.toLowerCase() === p.toLowerCase())) {
        score++;
      }
    }
    if (score > best.score) {
      best = { headerRow: i, headers: row, score };
    }
  }
  // Only use detected header if at least 2 columns matched; otherwise fall back to row 0
  if (best.score < 2) {
    return { headerRow: 0, headers: rows[0] || [] };
  }
  console.log(`[合并上传] findHeaderRow: 第${best.headerRow}行得分${best.score}, 选择该行作为表头`);
  return { headerRow: best.headerRow, headers: best.headers };
}

function detectSheetType(headers: unknown[]): 'annotation' | 'juguang' | 'note_base' | 'unknown' {
  const hasNoteId = findColumnIndex(headers, ['note_id', '笔记id', '笔记ID', 'noteid', '笔记链接', '笔记/素材ID']) !== -1;
  const hasFee = findColumnIndex(headers, ['fee', '消耗', '花费']) !== -1;
  const hasKolName = findColumnIndex(headers, ['kol_nick_name', '博主昵称']) !== -1;
  const hasImpression = findColumnIndex(headers, ['impression', '展现量']) !== -1;
  const hasCooperationForm = findColumnIndex(headers, ['合作形式', '合作方式']) !== -1;
  const hasContentDirection = findColumnIndex(headers, ['内容方向', '合作方向']) !== -1;
  const hasKolType = findColumnIndex(headers, ['达人类型', '达人类别']) !== -1;

  if (hasFee && hasImpression) return 'juguang';
  if (hasCooperationForm || hasContentDirection || hasKolType) return 'note_base';
  if (hasKolName && hasNoteId) return 'annotation';
  return 'unknown';
}

function parseJuguangSheet(rows: unknown[][]): { data: JuguangRow[]; errors: ParseErrorDetail[] } {
  const headers = rows[0];
  const errors: ParseErrorDetail[] = [];
  const data: JuguangRow[] = [];

  const noteIdCol = findColumnIndex(headers, ['note_id', '笔记id', '笔记ID', 'noteid', '笔记/素材ID']);
  const feeCol = findColumnIndex(headers, ['fee', '消耗', '花费', '费用', '消费']);
  const impressionCol = findColumnIndex(headers, ['impression', '曝光', '曝光量', '展现量']);
  const clickCol = findColumnIndex(headers, ['click', '点击', '点击量']);
  const interactionCol = findColumnIndex(headers, ['interaction', '互动', '互动量']);
  const iUserNumCol = findColumnIndex(headers, ['i_user_num', 'i人群', '兴趣人群', '新增种草人群']);
  const tiUserNumCol = findColumnIndex(headers, ['ti_user_num', 'ti人群', '深度兴趣人群', '新增深度种草人群']);
  const iUserPriceCol = findColumnIndex(headers, ['i_user_price', 'i人群成本', '兴趣人群成本', '新增种草人群成本']);
  const tiUserPriceCol = findColumnIndex(headers, ['ti_user_price', 'ti人群成本', '深度兴趣人群成本', '新增深度种草人群成本']);
  const searchCmtClickCol = findColumnIndex(headers, ['search_cmt_click', '搜索组件点击', '搜索点击', '搜索组件点击量']);
  const searchCmtAfterReadCol = findColumnIndex(headers, ['search_cmt_after_read', '搜索后阅读', '搜索阅读', '搜后阅读量']);
  const searchCmtAfterReadAvgCol = findColumnIndex(headers, ['search_cmt_after_read_avg', '搜索后平均阅读', '搜索平均阅读', '平均搜索后阅读笔记篇数']);
  const searchCmtClickCvrCol = findColumnIndex(headers, ['search_cmt_click_cvr', '搜索点击转化率', '搜索转化率', '搜索组件点击转化率']);
  const acpCol = findColumnIndex(headers, ['acp', '平均点击成本']);
  const cpmCol = findColumnIndex(headers, ['cpm', '平均千次曝光成本']);
  const cpiCol = findColumnIndex(headers, ['cpi', '平均互动成本']);

  if (feeCol === -1) return { data, errors: [{ sheet: '', row: 1, column: 'A', reason: '缺少必填列: fee/消耗' }] };

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((cell) => cell === null || cell === undefined || cell === '')) continue;

    const fee = parseNumber(row[feeCol]);
    if (fee === 0 && (row[feeCol] === null || row[feeCol] === undefined || row[feeCol] === '')) {
      errors.push({ sheet: '', row: i + 1, column: XLSX.utils.encode_col(feeCol), reason: '消耗为空' });
      continue;
    }

    data.push({
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
  return { data, errors };
}

function parseNoteBaseSheet(rows: unknown[][]): { data: import('@/shared/types').NoteBaseRecord[]; errors: ParseErrorDetail[] } {
  const headers = rows[0];
  const errors: ParseErrorDetail[] = [];
  const data: import('@/shared/types').NoteBaseRecord[] = [];

  const noteLinkCol = findColumnIndex(headers, ['笔记链接', '笔记链接【长】']);
  const noteIdCol = findColumnIndex(headers, ['笔记id', '笔记ID', 'note_id', 'noteid']);
  const cooperationFormCol = findColumnIndex(headers, ['合作形式', '合作方式']);
  const isRegisteredCol = findColumnIndex(headers, ['是否报备']);
  const contentDirectionCol = findColumnIndex(headers, ['内容方向', '合作方向']);
  const kolTypeCol = findColumnIndex(headers, ['达人类型', '达人类别']);
  const spuNameCol = findColumnIndex(headers, ['对应SPU', '对应spu', 'SPU', 'spu名称', '对应SPU（若有）']);
  const contentCostCol = findColumnIndex(headers, ['内容实际消耗金额', '内容实际消耗', '内容消耗']);
  const contentSettlementCol = findColumnIndex(headers, ['内容实际结算金额', '内容实际结算', '内容结算']);
  const adSpendCol = findColumnIndex(headers, ['投流实际消耗', '投流消耗']);
  const totalCostCol = findColumnIndex(headers, ['总费用', '总计费用']);

  if (noteIdCol === -1) return { data, errors: [{ sheet: '', row: 1, column: 'A', reason: '缺少必填列: 笔记id' }] };

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((cell) => cell === null || cell === undefined || cell === '')) continue;
    const noteId = parseString(row[noteIdCol]);
    if (!noteId || noteId === '-') continue;

    const isRegisteredRaw = parseString(row[isRegisteredCol]);
    const isRegistered = isRegisteredRaw === '是' || isRegisteredRaw === 'true' || isRegisteredRaw === '1';

    data.push({
      noteId,
      noteLink: parseString(row[noteLinkCol]) || undefined,
      cooperationForm: parseString(row[cooperationFormCol]) || undefined,
      isRegistered,
      contentDirection: parseString(row[contentDirectionCol]) || undefined,
      kolType: parseString(row[kolTypeCol]) || undefined,
      spuName: parseString(row[spuNameCol]) || undefined,
      contentCost: parseNumber(row[contentCostCol]),
      contentSettlement: parseNumber(row[contentSettlementCol]),
      adSpend: parseNumber(row[adSpendCol]),
      totalCost: parseNumber(row[totalCostCol]),
    });
  }
  return { data, errors };
}

/**
 * POST /api/upload/combined
 * Upload a single Excel file with multiple sheets (执行底表 + 投流底表 + 蒲公英数据).
 *
 * Accepts multipart form data with:
 *   - file: xlsx file
 *   - projectId: UUID of the project
 *
 * Scans all sheets, detects type by column headers, and parses accordingly.
 */
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const projectId = formData.get('projectId') as string | null;

    if (!file) {
      return NextResponse.json({ error: '请上传文件' }, { status: 400 });
    }
    if (!projectId) {
      return NextResponse.json({ error: 'projectId 是必填项' }, { status: 400 });
    }

    const format = getFileFormat(file.name);
    if (!format) {
      return NextResponse.json(
        { error: `不支持的文件格式: ${file.name}`, supportedFormats: ['xlsx', 'csv'] },
        { status: 415 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(buffer, { type: 'buffer' });
    } catch (e) {
      return NextResponse.json(
        { error: '无法读取文件', details: [{ reason: e instanceof Error ? e.message : String(e) }] },
        { status: 422 },
      );
    }

    const allErrors: ParseErrorDetail[] = [];
    const annotations: import('@/shared/types').BusinessAnnotation[] = [];
    let juguangData: JuguangRow[] = [];
    const noteBaseRecords: import('@/shared/types').NoteBaseRecord[] = [];
    const parser = new SpreadsheetParserImpl();
    const sheetResults: Array<{ name: string; type: string; headerCount: number; firstHeaders: string; rowCount: number }> = [];

    // Debug: dump raw rows for diagnosis
    const debugDump: Record<string, { headerRow: number; headers: unknown[]; firstDataRows: unknown[][] }> = {};

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }) as unknown[][];
      const rowCount = rawRows.length;

      if (rowCount < 2) {
        sheetResults.push({ name: sheetName, type: 'empty', headerCount: 0, firstHeaders: '', rowCount });
        continue;
      }

      // Handle multi-row headers (蒲公英等): find the actual header row
      const { headerRow, headers } = findHeaderRow(rawRows);
      const dataRows = rawRows.slice(headerRow + 1); // rows after header
      const headerStrings = headers.map((h, i) => `[${i}]:${String(h ?? '').slice(0, 30)}`).join(', ');
      const type = detectSheetType(headers);
      sheetResults.push({ name: sheetName, type, headerCount: headers.length, firstHeaders: headerStrings, rowCount });

      // Debug dump
      debugDump[sheetName] = {
        headerRow,
        headers: headers.slice(0, 20),
        firstDataRows: rawRows.slice(headerRow + 1, headerRow + 4),
      };

      if (type === 'annotation') {
        const result = parser.parseAnnotationRows([headers, ...dataRows]);
        annotations.push(...result.data);
        for (const e of result.errors) {
          allErrors.push({ sheet: sheetName, row: e.row, column: e.column, reason: String((e as any).message || (e as any).reason || '') });
        }
      } else if (type === 'juguang') {
        const result = parseJuguangSheet([headers, ...dataRows]);
        juguangData.push(...result.data);
        for (const e of result.errors) {
          allErrors.push({ ...e, sheet: e.sheet || sheetName });
        }
      } else if (type === 'note_base') {
        const result = parseNoteBaseSheet([headers, ...dataRows]);
        noteBaseRecords.push(...result.data);
        for (const e of result.errors) {
          allErrors.push({ ...e, sheet: e.sheet || sheetName });
        }
      }
    }

    // Write debug dump to file
    const debugDir = join(process.cwd(), '..', 'debug-output');
    await fs.mkdir(debugDir, { recursive: true }).catch(() => {});
    const dumpPath = join(debugDir, `excel-parse-${Date.now()}.json`);
    const dumpData = {
      time: new Date().toISOString(),
      sheetNames: workbook.SheetNames,
      sheets: debugDump,
      detection: sheetResults,
      annotationsCount: annotations.length,
      juguangCount: juguangData.length,
      noteBaseCount: noteBaseRecords.length,
    };
    await fs.writeFile(dumpPath, JSON.stringify(dumpData, null, 2)).catch(() => {});
    console.log(`[合并上传] 调试数据已写入 ${dumpPath}`);

    const persistenceService = new PrismaDataPersistenceService();
    let annotationPersisted = false;
    let juguangPersisted = false;
    let noteBasePersisted = false;

    if (annotations.length > 0) {
      try {
        await persistenceService.saveAnnotations(projectId, annotations);
        annotationPersisted = true;
      } catch (error) {
        allErrors.push({ sheet: '', row: 0, column: 'A', reason: `业务标注保存失败: ${error instanceof Error ? error.message : String(error)}` });
      }
    }

    if (juguangData.length > 0) {
      try {
        await persistenceService.saveJuguangData(projectId, juguangData);
        juguangPersisted = true;
      } catch (error) {
        allErrors.push({ sheet: '', row: 0, column: 'A', reason: `投流数据保存失败: ${error instanceof Error ? error.message : String(error)}` });
      }
    }

    if (noteBaseRecords.length > 0) {
      try {
        await persistenceService.saveNoteBaseData(projectId, noteBaseRecords);
        noteBasePersisted = true;
      } catch (error) {
        allErrors.push({ sheet: '', row: 0, column: 'A', reason: `笔记底表保存失败: ${error instanceof Error ? error.message : String(error)}` });
      }
    }

    if (annotationPersisted || juguangPersisted || noteBasePersisted) {
      await transitionStatus(projectId, 'first_upload').catch(() => {});
    }

    return NextResponse.json({
      success: true,
      annotationsCount: annotations.length,
      juguangCount: juguangData.length,
      noteBaseCount: noteBaseRecords.length,
      annotationPersisted,
      juguangPersisted,
      noteBasePersisted,
      errors: allErrors,
      sheets: sheetResults,
    });
  } catch (error) {
    console.error('POST /api/upload/combined error:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
