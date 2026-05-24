// ============================================================
// Spreadsheet Parser - 底表解析器
// Parses Lingxi platform data and business annotations from Excel/CSV
// ============================================================

import * as XLSX from 'xlsx';
import type { LingxiData, AIPSData, BrandRankingData, SOCSOVData, SPURankingData, BusinessAnnotation } from '../shared/types';

/**
 * Parse error with row/column location information
 */
export interface ParseError {
  row: number;
  column: string;
  message: string;
  severity: 'error' | 'warning';
}

/**
 * Result of parsing a spreadsheet, supporting partial import
 */
export interface ParseResult<T> {
  data: T;
  errors: ParseError[];
  warnings: ParseError[];
}

/**
 * SpreadsheetParser interface for parsing structured spreadsheet data
 */
export interface SpreadsheetParser {
  parseLingxiSheet(file: Buffer, format: 'xlsx' | 'csv'): ParseResult<LingxiData>;
  parseAnnotationSheet(file: Buffer, format: 'xlsx' | 'csv'): ParseResult<BusinessAnnotation[]>;
}

/**
 * Read a workbook from a buffer in the specified format
 */
function readWorkbook(file: Buffer, format: 'xlsx' | 'csv'): XLSX.WorkBook {
  if (format === 'csv') {
    return XLSX.read(file, { type: 'buffer', raw: true });
  }
  return XLSX.read(file, { type: 'buffer' });
}

/**
 * Get sheet data as array of arrays
 */
function getSheetData(workbook: XLSX.WorkBook, sheetName?: string): unknown[][] {
  const name = sheetName ?? workbook.SheetNames[0];
  const sheet = workbook.Sheets[name];
  if (!sheet) {
    return [];
  }
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }) as unknown[][];
}

/**
 * Safely parse a numeric value from a cell
 */
function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const num = Number(value);
  if (isNaN(num)) {
    return null;
  }
  return num;
}

/**
 * Safely parse a string value from a cell
 */
function parseString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const str = String(value).trim();
  return str === '' ? null : str;
}

/**
 * Parse a boolean value from a cell (supports various representations)
 */
function parseBoolean(value: unknown): boolean | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  const str = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', '是', 'y'].includes(str)) {
    return true;
  }
  if (['false', '0', 'no', '否', 'n'].includes(str)) {
    return false;
  }
  return null;
}

/**
 * Find column index by header name (case-insensitive, supports aliases)
 */
function findColumnIndex(headers: unknown[], names: string[]): number {
  const lowerNames = names.map(n => n.toLowerCase());
  for (let i = 0; i < headers.length; i++) {
    const header = parseString(headers[i]);
    if (header && lowerNames.includes(header.toLowerCase())) {
      return i;
    }
  }
  return -1;
}

/**
 * Get column letter from index (0-based)
 */
function columnLetter(index: number): string {
  return XLSX.utils.encode_col(index);
}

// ---- Lingxi Sheet Parsing ----

function parseAIPSSheet(rows: unknown[][], errors: ParseError[], warnings: ParseError[]): AIPSData | undefined {
  if (rows.length < 2) {
    return undefined;
  }

  const headers = rows[0];
  const awarenessCol = findColumnIndex(headers, ['awareness', 'a人群', '认知']);
  const interestCol = findColumnIndex(headers, ['interest', 'i人群', '兴趣']);
  const purchaseCol = findColumnIndex(headers, ['purchase', 'p人群', '购买']);
  const shareCol = findColumnIndex(headers, ['share', 's人群', '分享']);
  const penetrationCol = findColumnIndex(headers, ['penetration_rate', '渗透率', 'penetration']);
  const flowRatesCol = findColumnIndex(headers, ['flow_rates', '流转率', '转化率']);

  // Need at least awareness to consider this valid
  if (awarenessCol === -1) {
    warnings.push({ row: 1, column: 'A', message: 'AIPS sheet missing awareness column header', severity: 'warning' });
    return undefined;
  }

  const dataRow = rows[1];
  const awareness = parseNumber(dataRow[awarenessCol]);
  const interest = parseNumber(dataRow[interestCol]);
  const purchase = parseNumber(dataRow[purchaseCol]);
  const share = parseNumber(dataRow[shareCol]);
  const penetrationRate = parseNumber(dataRow[penetrationCol]);

  if (awareness === null) {
    errors.push({ row: 2, column: columnLetter(awarenessCol), message: 'AIPS awareness value is required and must be numeric', severity: 'error' });
    return undefined;
  }

  // Parse flow rates from remaining columns or JSON-like cell
  const flowRates: Record<string, number> = {};
  if (flowRatesCol !== -1 && dataRow[flowRatesCol] !== null && dataRow[flowRatesCol] !== undefined) {
    const rawFlowRates = dataRow[flowRatesCol];
    if (typeof rawFlowRates === 'string') {
      try {
        const parsed = JSON.parse(rawFlowRates);
        if (typeof parsed === 'object' && parsed !== null) {
          for (const [key, val] of Object.entries(parsed)) {
            const numVal = parseNumber(val);
            if (numVal !== null) {
              flowRates[key] = numVal;
            }
          }
        }
      } catch {
        warnings.push({ row: 2, column: columnLetter(flowRatesCol), message: 'Flow rates could not be parsed as JSON, skipping', severity: 'warning' });
      }
    }
  }

  return {
    awareness,
    interest: interest ?? 0,
    purchase: purchase ?? 0,
    share: share ?? 0,
    penetrationRate: penetrationRate ?? 0,
    flowRates,
  };
}

function parseBrandRankingSheet(rows: unknown[][], errors: ParseError[], warnings: ParseError[]): BrandRankingData | undefined {
  if (rows.length < 2) {
    return undefined;
  }

  const headers = rows[0];
  const brandNameCol = findColumnIndex(headers, ['brand_name', '品牌名称', '品牌']);
  const rankCol = findColumnIndex(headers, ['rank', '排名']);
  const categoryCol = findColumnIndex(headers, ['category', '品类']);
  const periodCol = findColumnIndex(headers, ['period', '周期', '时间']);

  if (brandNameCol === -1 || rankCol === -1) {
    warnings.push({ row: 1, column: 'A', message: 'Brand ranking sheet missing required columns (brand_name, rank)', severity: 'warning' });
    return undefined;
  }

  const dataRow = rows[1];
  const brandName = parseString(dataRow[brandNameCol]);
  const rank = parseNumber(dataRow[rankCol]);

  if (brandName === null) {
    errors.push({ row: 2, column: columnLetter(brandNameCol), message: 'Brand name is required', severity: 'error' });
    return undefined;
  }
  if (rank === null) {
    errors.push({ row: 2, column: columnLetter(rankCol), message: 'Rank must be a valid number', severity: 'error' });
    return undefined;
  }

  return {
    brandName,
    rank,
    category: parseString(dataRow[categoryCol]) ?? '',
    period: parseString(dataRow[periodCol]) ?? '',
  };
}

function parseSOCSOVSheet(rows: unknown[][], errors: ParseError[], warnings: ParseError[]): SOCSOVData | undefined {
  if (rows.length < 2) {
    return undefined;
  }

  const headers = rows[0];
  const socCol = findColumnIndex(headers, ['soc', '内容份额', 'share_of_content']);
  const sovCol = findColumnIndex(headers, ['sov', '声量份额', 'share_of_voice']);
  const categoryCol = findColumnIndex(headers, ['category', '品类']);
  const periodCol = findColumnIndex(headers, ['period', '周期', '时间']);

  if (socCol === -1 && sovCol === -1) {
    warnings.push({ row: 1, column: 'A', message: 'SOC/SOV sheet missing both soc and sov columns', severity: 'warning' });
    return undefined;
  }

  const dataRow = rows[1];
  const soc = parseNumber(dataRow[socCol]);
  const sov = parseNumber(dataRow[sovCol]);

  if (soc === null && sov === null) {
    errors.push({ row: 2, column: columnLetter(socCol !== -1 ? socCol : sovCol), message: 'At least one of SOC or SOV must have a valid numeric value', severity: 'error' });
    return undefined;
  }

  return {
    soc: soc ?? 0,
    sov: sov ?? 0,
    category: parseString(dataRow[categoryCol]) ?? '',
    period: parseString(dataRow[periodCol]) ?? '',
  };
}

function parseSPURankingSheet(rows: unknown[][], errors: ParseError[], warnings: ParseError[]): SPURankingData | undefined {
  if (rows.length < 2) {
    return undefined;
  }

  const headers = rows[0];
  const spuNameCol = findColumnIndex(headers, ['spu_name', 'spu名称', '产品名称', '产品']);
  const rankCol = findColumnIndex(headers, ['rank', '排名']);
  const categoryCol = findColumnIndex(headers, ['category', '品类']);
  const periodCol = findColumnIndex(headers, ['period', '周期', '时间']);

  if (spuNameCol === -1 || rankCol === -1) {
    warnings.push({ row: 1, column: 'A', message: 'SPU ranking sheet missing required columns (spu_name, rank)', severity: 'warning' });
    return undefined;
  }

  const dataRow = rows[1];
  const spuName = parseString(dataRow[spuNameCol]);
  const rank = parseNumber(dataRow[rankCol]);

  if (spuName === null) {
    errors.push({ row: 2, column: columnLetter(spuNameCol), message: 'SPU name is required', severity: 'error' });
    return undefined;
  }
  if (rank === null) {
    errors.push({ row: 2, column: columnLetter(rankCol), message: 'Rank must be a valid number', severity: 'error' });
    return undefined;
  }

  return {
    spuName,
    rank,
    category: parseString(dataRow[categoryCol]) ?? '',
    period: parseString(dataRow[periodCol]) ?? '',
  };
}

// ---- Implementation ----

export class SpreadsheetParserImpl implements SpreadsheetParser {
  /**
   * Parse Lingxi platform data from a structured spreadsheet.
   * Expects multiple sheets (or sections) for AIPS, brand ranking, SOC/SOV, SPU ranking.
   * For CSV format, expects a single sheet with all data sections.
   */
  parseLingxiSheet(file: Buffer, format: 'xlsx' | 'csv'): ParseResult<LingxiData> {
    const errors: ParseError[] = [];
    const warnings: ParseError[] = [];
    const data: LingxiData = {};

    let workbook: XLSX.WorkBook;
    try {
      workbook = readWorkbook(file, format);
    } catch (e) {
      errors.push({ row: 0, column: 'A', message: `Failed to read file: ${e instanceof Error ? e.message : String(e)}`, severity: 'error' });
      return { data, errors, warnings };
    }

    if (workbook.SheetNames.length === 0) {
      errors.push({ row: 0, column: 'A', message: 'Workbook contains no sheets', severity: 'error' });
      return { data, errors, warnings };
    }

    // For xlsx with multiple sheets, try to find named sheets
    if (format === 'xlsx' && workbook.SheetNames.length > 1) {
      for (const sheetName of workbook.SheetNames) {
        const lowerName = sheetName.toLowerCase();
        const rows = getSheetData(workbook, sheetName);

        if (lowerName.includes('aips') || lowerName.includes('人群')) {
          data.aips = parseAIPSSheet(rows, errors, warnings);
        } else if (lowerName.includes('brand') || lowerName.includes('品牌排名')) {
          data.brandRanking = parseBrandRankingSheet(rows, errors, warnings);
        } else if (lowerName.includes('soc') || lowerName.includes('sov') || lowerName.includes('声量')) {
          data.socSov = parseSOCSOVSheet(rows, errors, warnings);
        } else if (lowerName.includes('spu') || lowerName.includes('产品排名')) {
          data.spuRanking = parseSPURankingSheet(rows, errors, warnings);
        }
      }
    } else {
      // Single sheet (CSV or single-sheet xlsx): try to parse all sections from first sheet
      const rows = getSheetData(workbook);
      if (rows.length > 0) {
        // Try parsing as each type - the one that matches headers wins
        data.aips = parseAIPSSheet(rows, errors, warnings);
        if (!data.aips) {
          data.brandRanking = parseBrandRankingSheet(rows, errors, warnings);
        }
        if (!data.brandRanking && !data.aips) {
          data.socSov = parseSOCSOVSheet(rows, errors, warnings);
        }
        if (!data.socSov && !data.brandRanking && !data.aips) {
          data.spuRanking = parseSPURankingSheet(rows, errors, warnings);
        }
      }
    }

    // If no data was parsed at all, add a warning
    if (!data.aips && !data.brandRanking && !data.socSov && !data.spuRanking) {
      warnings.push({ row: 0, column: 'A', message: 'No recognizable Lingxi data sections found in the file', severity: 'warning' });
    }

    return { data, errors, warnings };
  }

  /**
   * Parse business annotations from a structured spreadsheet.
   * Expects columns: note_id, content_direction, account_type, kol_type, launch_phase, is_underwater
   */
  parseAnnotationSheet(file: Buffer, format: 'xlsx' | 'csv'): ParseResult<BusinessAnnotation[]> {
    const errors: ParseError[] = [];
    const warnings: ParseError[] = [];
    const data: BusinessAnnotation[] = [];

    let workbook: XLSX.WorkBook;
    try {
      workbook = readWorkbook(file, format);
    } catch (e) {
      errors.push({ row: 0, column: 'A', message: `Failed to read file: ${e instanceof Error ? e.message : String(e)}`, severity: 'error' });
      return { data, errors, warnings };
    }

    const rows = getSheetData(workbook);
    if (rows.length < 2) {
      errors.push({ row: 0, column: 'A', message: 'Annotation sheet must have at least a header row and one data row', severity: 'error' });
      return { data, errors, warnings };
    }

    const headers = rows[0];
    const noteIdCol = findColumnIndex(headers, ['note_id', '笔记id', '笔记ID', 'noteid', '笔记链接', '笔记URL', 'note_url', '笔记']);
    if (noteIdCol === -1) {
      const headerStrings = headers.map((h, i) => `[${i}]: ${String(h ?? '')}`).join(', ');
      errors.push({ row: 1, column: 'A', message: `Required column "note_id" not found. Actual headers: ${headerStrings}`, severity: 'error' });
      return { data, errors, warnings };
    }

    return this.parseAnnotationRows(rows);
  }

  /**
   * Parse annotation rows directly (used by combined upload for multi-sheet files).
   * Returns empty data/errors when note_id column not found (caller should check).
   */
  parseAnnotationRows(rows: unknown[][]): ParseResult<BusinessAnnotation[]> {
    const errors: ParseError[] = [];
    const warnings: ParseError[] = [];
    const data: BusinessAnnotation[] = [];

    if (rows.length < 2) {
      return { data, errors, warnings };
    }

    const headers = rows[0];

    const noteIdCol = findColumnIndex(headers, ['note_id', '笔记id', '笔记ID', 'noteid', '笔记链接', '笔记URL', 'note_url', '笔记']);
    const contentDirCol = findColumnIndex(headers, ['content_direction', '内容方向', '笔记方向', '内容标签', '内容类型']);
    const accountTypeCol = findColumnIndex(headers, ['account_type', '账号类型', '达人类型', '博主类型', '博主分类']);
    const kolTypeCol = findColumnIndex(headers, ['kol_type', 'kol类型', 'KOL类型', '达人级别', '达人等级', 'KOL级别']);
    const launchPhaseCol = findColumnIndex(headers, ['launch_phase', '投放阶段', '推广阶段', '阶段', '项目阶段']);
    const underwaterCol = findColumnIndex(headers, ['is_underwater', '水下标记', '水下', '是否水下', '合作方式', '合作类型']);

    if (noteIdCol === -1) return { data, errors, warnings };

    if (contentDirCol === -1) {
      warnings.push({ row: 1, column: 'A', message: 'Column "content_direction" not found, will use empty string', severity: 'warning' });
    }
    if (accountTypeCol === -1) {
      warnings.push({ row: 1, column: 'A', message: 'Column "account_type" not found, will use empty string', severity: 'warning' });
    }
    if (kolTypeCol === -1) {
      warnings.push({ row: 1, column: 'A', message: 'Column "kol_type" not found, will use empty string', severity: 'warning' });
    }
    if (launchPhaseCol === -1) {
      warnings.push({ row: 1, column: 'A', message: 'Column "launch_phase" not found, will use empty string', severity: 'warning' });
    }
    if (underwaterCol === -1) {
      warnings.push({ row: 1, column: 'A', message: 'Column "is_underwater" not found, will default to false', severity: 'warning' });
    }

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.every(cell => cell === null || cell === undefined || cell === '')) continue;

      const noteId = parseString(row[noteIdCol]);
      if (noteId === null) {
        errors.push({ row: i + 1, column: columnLetter(noteIdCol), message: `Row ${i + 1}: note_id is required and cannot be empty`, severity: 'error' });
        continue;
      }

      let isUnderwater = false;
      if (underwaterCol !== -1) {
        const parsed = parseBoolean(row[underwaterCol]);
        if (parsed === null && row[underwaterCol] !== null && row[underwaterCol] !== undefined && row[underwaterCol] !== '') {
          warnings.push({ row: i + 1, column: columnLetter(underwaterCol), message: `Row ${i + 1}: is_underwater value "${row[underwaterCol]}" could not be parsed, defaulting to false`, severity: 'warning' });
        }
        isUnderwater = parsed ?? false;
      }

      data.push({
        noteId,
        contentDirection: contentDirCol !== -1 ? (parseString(row[contentDirCol]) ?? '') : '',
        accountType: accountTypeCol !== -1 ? (parseString(row[accountTypeCol]) ?? '') : '',
        kolType: kolTypeCol !== -1 ? (parseString(row[kolTypeCol]) ?? '') : '',
        launchPhase: launchPhaseCol !== -1 ? (parseString(row[launchPhaseCol]) ?? '') : '',
        isUnderwater,
      });
    }

    return { data, errors, warnings };
  }
}
