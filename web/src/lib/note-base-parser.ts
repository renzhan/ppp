import * as XLSX from 'xlsx';
import { selectTargetSheet } from './sheet-selector';

// ─── Interfaces ───

export interface ParsedNoteBaseRow {
  noteId: string;
  noteLink: string;
  kolNickName: string | null;
  kolFanNum: number;
  cooperationForm: string | null;    // 内容形式: 视频报备/图文报备/视频软文/图文软文
  isRegistered: boolean;             // 是否报备 (derived from cooperationForm)
  contentDirection: string | null;   // 内容方向
  kolType: string | null;            // 笔记类型
  spuName: string | null;
  contentCost: number;               // 资源含税成本价
  contentSettlement: number;         // 资源含税售价
  adSpend: number;
  adSettlement: number;
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
 *
 * ═══ 最终版底表表头 ═══
 * 发布链接（必须是长链接）| 内容形式 | 内容方向 | 笔记类型 | 资源含税成本价 | 资源含税售价 |
 * 曝光量 | 阅读量 | 点赞量 | 收藏量 | 评论量 | 分享量 | 关注量 | 互动量
 *
 * 内容形式说明：
 * - 视频报备 / 图文报备 → 报备笔记 (isRegistered = true)
 * - 视频软文 / 图文软文 → 非报备笔记 (isRegistered = false)
 * 报备同义词：官方合作 / 水上
 * 非报备同义词：非官方合作 / 水下
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
  '发布链接': 'noteLink',       // 新版底表表头

  // ─── 运营标注字段（note_base 独有）───
  '合作形式': 'cooperationForm',
  '内容形式': 'cooperationForm', // 最终版底表表头（即是合作形式）
  '是否报备': 'isRegistered',
  '内容方向': 'contentDirection',
  '达人类型': 'kolType',
  '笔记类型': 'kolType',         // 最终版底表表头
  '对应SPU': 'spuName',

  // ─── 费用字段（note_base 独有）───
  '内容实际消耗金额': 'contentCost',
  '内容消耗金额': 'contentCost',       // 新表头别名
  '达人金额': 'contentCost',           // 旧别名
  '资源含税成本价': 'contentCost',     // 最终版底表表头
  '内容实际结算金额': 'contentSettlement',
  '内容结算金额': 'contentSettlement', // 新表头别名
  '资源含税售价': 'contentSettlement', // 最终版底表表头
  '投流实际消耗': 'adSpend',
  '投流消耗金额': 'adSpend',           // 新表头别名
  '投流金额': 'adSpend',               // 旧别名
  '投流结算金额': 'adSettlement',      // 新字段
  '投流实际结算金额': 'adSettlement',  // 可能的别名
  '总费用': 'totalCost',
  '总消耗': 'totalCost',               // 别名
};

/**
 * 数据指标列映射 — 这些字段存入 note_base.metrics JSON 字段，同时前端展示。
 * 包含所有 Excel 中的数据指标列（基础指标 + 投流/自然流 + CPM/CPE/CPC + 回搜等）。
 *
 * 注意：最终版底表中 曝光量/阅读量/点赞量/收藏量/评论量/分享量/关注量/互动量 作为核心指标，
 * 仍存入 metrics JSON，但也用于非报备笔记的计算。
 */
export const DISPLAY_ONLY_COLUMN_MAP: Record<string, string> = {
  // 基础数据指标（最终版底表核心字段）
  '曝光量': 'impNum',
  '曝光': 'impNum',             // 短别名
  '阅读量': 'readNum',
  '阅读': 'readNum',             // 短别名
  '互动量': 'engageNum',
  '互动': 'engageNum',           // 短别名
  '点赞量': 'likeNum',
  '点赞': 'likeNum',             // 短别名
  '收藏量': 'favNum',
  '收藏': 'favNum',              // 短别名
  '评论量': 'cmtNum',
  '评论': 'cmtNum',              // 短别名
  '分享量': 'shareNum',
  '转发量': 'shareNum',          // 新版底表表头
  '转发': 'shareNum',            // 短别名（转发=分享）
  '关注量': 'followNum',
  // 爆文标记
  '是否千互': 'isViral1kEngage',
  '是否千赞': 'isViral1kLike',
  // 效率指标
  'CTR': 'ctr',
  'CPM': 'cpm',
  'CPC': 'cpc',
  'CPE': 'cpe',
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

// ─── Required Columns ───

/**
 * 必填列名列表 — 新版底表Excel必须包含这些列（或其已知别名）。
 * 缺少任何一列对应的映射时 parseNoteBaseExcel 将返回解析错误。
 *
 * 最终版必填字段：发布链接、内容形式、内容方向、笔记类型
 */
export const REQUIRED_COLUMNS: string[] = [
  '发布链接',
  '内容形式',
  '内容方向',
  '笔记类型',
];

/**
 * 必填字段名 — 这些是 note_base 表中必须有值的字段。
 * 用于校验表头中是否至少有一列映射到每个必填字段。
 */
export const REQUIRED_FIELD_NAMES: string[] = [
  'noteLink',
  'cooperationForm',
  'contentDirection',
  'kolType',
];

// ─── Content Form Constants ───

/** 报备笔记内容形式 */
export const REGISTERED_FORMS = ['视频报备', '图文报备'];
/** 非报备笔记内容形式 */
export const UNREGISTERED_FORMS = ['视频软文', '图文软文'];
/** 所有有效内容形式 */
export const ALL_CONTENT_FORMS = [...REGISTERED_FORMS, ...UNREGISTERED_FORMS];

/**
 * 根据内容形式判断是否为报备笔记
 * 报备：视频报备、图文报备
 * 非报备：视频软文、图文软文
 */
export function isRegisteredByForm(cooperationForm: string | null | undefined): boolean {
  if (!cooperationForm) return false;
  return REGISTERED_FORMS.includes(cooperationForm.trim());
}

/**
 * 根据内容形式判断是否为非报备笔记
 */
export function isUnregisteredByForm(cooperationForm: string | null | undefined): boolean {
  if (!cooperationForm) return false;
  return UNREGISTERED_FORMS.includes(cooperationForm.trim());
}

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
 * Check if a set of header keys contains any known column names.
 * Uses normalizeHeader() on each key and checks against both column maps.
 */
export function headersContainKnownColumns(headers: string[]): boolean {
  for (const header of headers) {
    const normalized = normalizeHeader(header);
    if (
      NOTE_BASE_COLUMN_MAP[header] ||
      NOTE_BASE_COLUMN_MAP[normalized] ||
      DISPLAY_ONLY_COLUMN_MAP[header] ||
      DISPLAY_ONLY_COLUMN_MAP[normalized]
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Parse a note-base Excel file buffer into structured records.
 *
 * Pure function — no database access, no side effects.
 * Filters out rows where noteLink is empty.
 * Extracts noteId from noteLink using extractNoteIdFromLink.
 *
 * 内容形式 → isRegistered 自动推导：
 * - 视频报备/图文报备 → isRegistered = true
 * - 视频软文/图文软文 → isRegistered = false
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

  // ─── Hyperlink Resolution ───
  // Some Excel files store URLs as hyperlinks (cell.l.Target) with empty or truncated display text (cell.v).
  // Pre-process: for any cell where .v is empty/missing but .l.Target exists, set .v = .l.Target.
  // This ensures sheet_to_json will return the actual URL instead of empty string.
  if (sheet['!ref']) {
    const sheetRange = XLSX.utils.decode_range(sheet['!ref']);
    for (let r = sheetRange.s.r; r <= sheetRange.e.r; r++) {
      for (let c = sheetRange.s.c; c <= sheetRange.e.c; c++) {
        const cellAddr = XLSX.utils.encode_cell({ r, c });
        const cell = sheet[cellAddr];
        if (cell && cell.l && cell.l.Target) {
          const displayVal = cell.v != null ? String(cell.v).trim() : '';
          // If display value is empty or doesn't look like a URL, use hyperlink Target
          if (!displayVal || (!displayVal.startsWith('http') && !displayVal.startsWith('//'))) {
            cell.v = cell.l.Target;
            cell.w = cell.l.Target;
            cell.h = cell.l.Target;
          }
        }
      }
    }
  }

  let rawRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  if (rawRows.length === 0) {
    return { records: [], warnings: ['文件中没有数据行'], skippedRows: 0 };
  }

  // ─── Header Row Auto-Detection ───
  // Scan up to the first 5 rows to find a row containing known column names.
  // Many real-world Excel files have 1-3 title/description rows before the actual header.
  const firstRowKeys = Object.keys(rawRows[0]);
  if (!headersContainKnownColumns(firstRowKeys)) {
    // Row 1 doesn't match → try rows 2..5 as header
    let found = false;
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
    const maxHeaderRow = Math.min(4, range.e.r); // Try up to row 5 (0-indexed: 4)

    for (let startRow = 1; startRow <= maxHeaderRow; startRow++) {
      const tryRange = { ...range, s: { ...range.s, r: startRow } };
      const retryRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: '', range: tryRange });

      if (retryRows.length > 0) {
        const retryKeys = Object.keys(retryRows[0]);
        if (headersContainKnownColumns(retryKeys)) {
          rawRows = retryRows;
          found = true;
          break;
        }
      }
    }

    if (!found) {
      // None of the first 5 rows contain known headers
      const allHeaders = Object.keys(rawRows[0] || {});
      return { records: [], warnings: [`未识别到有效表头。文件中的列名: [${allHeaders.join(', ')}]。需要的列: ${REQUIRED_COLUMNS.join('、')}`], skippedRows: 0 };
    }
  }

  // ─── Required Column Validation ───
  // Check that all mandatory fields are covered by at least one header column.
  const headers = rawRows.length > 0 ? Object.keys(rawRows[0]) : [];
  const mappedFieldNames = new Set<string>();
  for (const header of headers) {
    const normalized = normalizeHeader(header);
    const fieldName = NOTE_BASE_COLUMN_MAP[header] || NOTE_BASE_COLUMN_MAP[normalized];
    if (fieldName) {
      mappedFieldNames.add(fieldName);
    }
  }
  const missingFields = REQUIRED_FIELD_NAMES.filter((field) => !mappedFieldNames.has(field));
  if (missingFields.length > 0) {
    // Map field names back to Chinese column names for user-friendly error message
    const fieldToChineseMap: Record<string, string> = {
      noteLink: '发布链接',
      cooperationForm: '内容形式',
      contentDirection: '内容方向',
      kolType: '笔记类型',
      contentCost: '资源含税成本价',
      contentSettlement: '资源含税售价',
    };
    const missingChinese = missingFields.map((f) => fieldToChineseMap[f] || f);
    return {
      records: [],
      warnings: [`缺少必填列: ${missingChinese.join('、')}`],
      skippedRows: 0,
    };
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

    // ─── Derive isRegistered from cooperationForm (内容形式) ───
    const cooperationForm = mapped.cooperationForm ? String(mapped.cooperationForm).trim() : null;
    let isRegistered: boolean;
    if (cooperationForm) {
      isRegistered = isRegisteredByForm(cooperationForm);
    } else {
      // Fallback to explicit isRegistered field if cooperationForm not set
      isRegistered = parseBoolean(mapped.isRegistered);
    }

    const record: ParsedNoteBaseRow = {
      noteId,
      noteLink,
      kolNickName: mapped.kolNickName ? String(mapped.kolNickName).trim() : null,
      kolFanNum: Math.round(parseNumber(mapped.kolFanNum)),
      cooperationForm,
      isRegistered,
      contentDirection: mapped.contentDirection ? String(mapped.contentDirection).trim() : null,
      kolType: mapped.kolType ? String(mapped.kolType).trim() : null,
      spuName: mapped.spuName ? String(mapped.spuName).trim() : null,
      contentCost: parseNumber(mapped.contentCost),
      contentSettlement: parseNumber(mapped.contentSettlement),
      adSpend: parseNumber(mapped.adSpend),
      adSettlement: parseNumber(mapped.adSettlement),
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
