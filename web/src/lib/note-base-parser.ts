import * as XLSX from 'xlsx';
import { selectTargetSheet } from './sheet-selector';

// ─── Interfaces ───

export interface ParsedNoteBaseRow {
  noteId: string;
  noteLink: string;
  kolNickName: string | null;
  kolFanNum: number;
  cooperationForm: string | null;
  isRegistered: boolean;
  contentDirection: string | null;
  kolType: string | null;
  spuName: string | null;
  contentCost: number;
  contentSettlement: number;
  adSpend: number;
  totalCost: number;
  /** All extra metrics/data columns from Excel, stored in note_base.metrics JSON */
  displayMetrics?: Record<string, number | string>;
}

export interface ParseResult {
  records: ParsedNoteBaseRow[];
  warnings: string[];
  skippedRows: number;
}

// ─── Column Maps ───

/**
 * NOTE_BASE_COLUMN_MAP: Excel 中文列名 → note_base 表字段名
 *
 * 使用 note_base 表正确字段名（cooperationForm、isRegistered、contentCost 等），
 * 而非 notes 表字段名（noteType、isUnderwater、kolPrice 等）。
 */
export const NOTE_BASE_COLUMN_MAP: Record<string, string> = {
  // ─── 忽略列 ───
  '序号': '_index',

  // ─── 博主信息 ───
  '博主昵称': 'kolNickName',
  '博主粉丝量': 'kolFanNum',

  // ─── 笔记链接 ───
  '笔记链接': 'noteLink',
  '笔记连接': 'noteLink',       // 常见错别字

  // ─── 运营标注字段（note_base 独有）───
  '合作形式': 'cooperationForm',
  '内容形式': 'cooperationForm', // 别名
  '是否报备': 'isRegistered',
  '内容方向': 'contentDirection',
  '达人类型': 'kolType',
  '对应SPU': 'spuName',

  // ─── 费用字段（note_base 独有）───
  '内容实际消耗金额': 'contentCost',
  '达人金额': 'contentCost',           // 别名
  '内容实际结算金额': 'contentSettlement',
  '投流实际消耗': 'adSpend',
  '投流金额': 'adSpend',               // 别名
  '总费用': 'totalCost',
  '总消耗': 'totalCost',               // 别名
};

/**
 * 数据指标列映射 — 这些字段存入 note_base.metrics JSON 字段，同时前端展示。
 * 包含所有 Excel 中的数据指标列（基础指标 + 投流/自然流 + CPM/CPE/CPC + 回搜等）。
 */
export const DISPLAY_ONLY_COLUMN_MAP: Record<string, string> = {
  // 基础数据指标
  '曝光量': 'impNum',
  '阅读量': 'readNum',
  '互动量': 'engageNum',
  '点赞量': 'likeNum',
  '收藏量': 'favNum',
  '评论量': 'cmtNum',
  '分享量': 'shareNum',
  '关注量': 'followNum',
  // 效率指标
  'CTR': 'ctr',
  '总CPM': 'totalCpm',
  '总CPE': 'totalCpe',
  '总CPC': 'totalCpc',
  // 自然流量
  '自然曝光量': 'organicImpNum',
  '自然阅读量': 'organicReadNum',
  '自然互动': 'organicEngageNum',
  '自然CTR': 'organicCtr',
  '自然流CPM': 'organicCpm',
  '自然流CPE': 'organicCpe',
  '自然流CPC': 'organicCpc',
  // 推广/投流数据
  '展现量': 'heatImpNum',
  '推广曝光量': 'heatImpNum',
  '点击量': 'heatReadNum',
  '推广阅读量': 'heatReadNum',
  '投流互动量': 'heatEngageNum',
  '推广互动量': 'heatEngageNum',
  '投流CTR': 'heatCtr',
  '投流CPM': 'heatCpm',
  '投流CPE': 'heatCpe',
  '投流CPC': 'heatCpc',
  '投流新增TI': 'heatNewTi',
  '投流CPTI': 'heatCpti',
  // 回搜
  '回搜数': 'searchCount',
  '回搜率': 'searchRate',
  // 日期类
  '笔记发布日期': 'notePublishDate',
  '数据更新日期': 'dataUpdateDate',
};

// ─── Helper Functions ───

/**
 * Normalize a column header by stripping emoji prefixes, symbols, and parenthetical suffixes.
 * e.g. "🔴笔记连接（必填）" → "笔记连接"
 *      "🔴笔记连接（必填）\n" → "笔记连接"
 */
export function normalizeHeader(header: string): string {
  return header
    .trim()
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}]/gu, '')
    .replace(/^[\s🔴⭐️✅❌☑️●○◎★☆△▲▽▼◇◆□■※→←↑↓]+/u, '')
    .replace(/[（(][^）)]*[）)]$/g, '')
    .trim();
}

/**
 * Extract noteId from a Xiaohongshu note link.
 * Expected format: https://www.xiaohongshu.com/explore/{noteId}?...
 *
 * If the link doesn't match this pattern, generates a fallback ID `row_{rowIndex}`
 * and records a warning.
 */
export function extractNoteIdFromLink(
  link: string,
  rowIndex: number
): { noteId: string; warning?: string } {
  const match = link.match(/explore\/([^?/]+)/);
  if (match && match[1]) {
    return { noteId: match[1] };
  }
  return {
    noteId: `row_${rowIndex}`,
    warning: `第${rowIndex}行笔记链接格式异常，使用备用ID: row_${rowIndex}`,
  };
}

/**
 * Parse a numeric value from a cell, returning 0 for invalid/empty values.
 */
function parseNumber(value: unknown): number {
  if (value == null || value === '') return 0;
  const num = Number(value);
  return isNaN(num) ? 0 : num;
}

/**
 * Parse a boolean-like value from Chinese text (是/否).
 */
function parseBoolean(value: unknown): boolean {
  if (value == null) return false;
  const str = String(value).trim();
  return str === '是' || str === 'true' || str === '1' || str === 'yes';
}

// ─── Core Parse Function ───

/**
 * Parse a note-base Excel file buffer into structured records.
 *
 * Pure function — no database access, no side effects.
 * Filters out rows where noteLink is empty.
 * Extracts noteId from noteLink using extractNoteIdFromLink.
 */
export function parseNoteBaseExcel(buffer: Buffer): ParseResult {
  const workbook = XLSX.read(buffer, { type: 'buffer' });

  if (workbook.SheetNames.length === 0) {
    return { records: [], warnings: ['文件中没有工作表'], skippedRows: 0 };
  }

  const sheetResult = selectTargetSheet(workbook.SheetNames);
  if (!sheetResult.success || !sheetResult.sheetName) {
    return {
      records: [],
      warnings: [sheetResult.error || '未找到目标工作表'],
      skippedRows: 0,
    };
  }

  const sheet = workbook.Sheets[sheetResult.sheetName];
  const rawRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  if (rawRows.length === 0) {
    return { records: [], warnings: ['文件中没有数据行'], skippedRows: 0 };
  }

  const records: ParsedNoteBaseRow[] = [];
  const warnings: string[] = [];
  let skippedRows = 0;

  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i];
    const rowNum = i + 2; // Excel row number (1-indexed header + 1-indexed data)

    // Map Chinese headers to field names
    const mapped: Record<string, unknown> = {};
    const displayMetrics: Record<string, number | string> = {};

    for (const [rawHeader, cellValue] of Object.entries(raw)) {
      const normalized = normalizeHeader(rawHeader);

      // Check NOTE_BASE_COLUMN_MAP first
      const fieldName = NOTE_BASE_COLUMN_MAP[rawHeader] || NOTE_BASE_COLUMN_MAP[normalized];
      if (fieldName && cellValue !== undefined) {
        mapped[fieldName] = cellValue;
        continue;
      }

      // Check DISPLAY_ONLY_COLUMN_MAP
      const displayField = DISPLAY_ONLY_COLUMN_MAP[rawHeader] || DISPLAY_ONLY_COLUMN_MAP[normalized];
      if (displayField && cellValue !== undefined && cellValue !== '') {
        // Date fields: convert Excel serial number to date string
        if (displayField.endsWith('Date')) {
          const numVal = Number(cellValue);
          if (!isNaN(numVal) && numVal > 40000 && numVal < 60000) {
            // Excel serial number → Date
            const date = new Date((numVal - 25569) * 86400000);
            displayMetrics[displayField] = date.toISOString().slice(0, 10);
          } else {
            displayMetrics[displayField] = String(cellValue);
          }
        } else {
          const num = parseNumber(cellValue);
          // Keep decimal precision for rate/ratio fields (CTR, CPM, etc.)
          if (displayField.includes('Ctr') || displayField.includes('ctr') ||
              displayField.includes('Rate') || displayField.includes('rate') ||
              displayField.includes('Cpm') || displayField.includes('cpm') ||
              displayField.includes('Cpe') || displayField.includes('cpe') ||
              displayField.includes('Cpc') || displayField.includes('cpc') ||
              displayField.includes('Cpti') || displayField.includes('cpti')) {
            displayMetrics[displayField] = num;
          } else {
            displayMetrics[displayField] = Math.round(num);
          }
        }
      }
    }

    // Filter: skip rows where noteLink is empty
    const noteLink = mapped.noteLink ? String(mapped.noteLink).trim() : '';
    if (!noteLink) {
      skippedRows++;
      continue;
    }

    // Extract noteId from link
    const { noteId, warning } = extractNoteIdFromLink(noteLink, rowNum);
    if (warning) {
      warnings.push(warning);
    }

    const record: ParsedNoteBaseRow = {
      noteId,
      noteLink,
      kolNickName: mapped.kolNickName ? String(mapped.kolNickName).trim() : null,
      kolFanNum: Math.round(parseNumber(mapped.kolFanNum)),
      cooperationForm: mapped.cooperationForm ? String(mapped.cooperationForm).trim() : null,
      isRegistered: parseBoolean(mapped.isRegistered),
      contentDirection: mapped.contentDirection ? String(mapped.contentDirection).trim() : null,
      kolType: mapped.kolType ? String(mapped.kolType).trim() : null,
      spuName: mapped.spuName ? String(mapped.spuName).trim() : null,
      contentCost: parseNumber(mapped.contentCost),
      contentSettlement: parseNumber(mapped.contentSettlement),
      adSpend: parseNumber(mapped.adSpend),
      totalCost: parseNumber(mapped.totalCost),
    };

    // Attach display metrics if any were found
    if (Object.keys(displayMetrics).length > 0) {
      record.displayMetrics = displayMetrics;
    }

    records.push(record);
  }

  return { records, warnings, skippedRows };
}
