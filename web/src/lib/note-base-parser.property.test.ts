/**
 * Property-based tests for note-base-parser.ts
 *
 * Validates: Requirements 6.1, 5.1, 4.1, 4.2, 6.3, 7.2
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { normalizeHeader } from './note-base-parser';

// ─── Arbitraries ───

/**
 * Generates plain Chinese text (common CJK characters) without emoji or parentheses.
 */
const plainChineseTextArb = fc
  .array(
    fc.integer({ min: 0x4e00, max: 0x9fff }).map((cp) => String.fromCodePoint(cp)),
    { minLength: 1, maxLength: 10 }
  )
  .map((chars) => chars.join(''));

/**
 * Generates a random emoji prefix (one or more emoji characters).
 */
const emojiPrefixArb = fc
  .array(
    fc.oneof(
      fc.integer({ min: 0x1f300, max: 0x1f5ff }).map((cp) => String.fromCodePoint(cp)),
      fc.integer({ min: 0x1f600, max: 0x1f64f }).map((cp) => String.fromCodePoint(cp)),
      fc.integer({ min: 0x1f680, max: 0x1f6ff }).map((cp) => String.fromCodePoint(cp)),
      fc.integer({ min: 0x2600, max: 0x26ff }).map((cp) => String.fromCodePoint(cp))
    ),
    { minLength: 1, maxLength: 3 }
  )
  .map((emojis) => emojis.join(''));

/**
 * Generates a Chinese parenthetical suffix like （必填）or （选填）.
 */
const chineseParenSuffixArb = fc
  .array(
    fc.integer({ min: 0x4e00, max: 0x9fff }).map((cp) => String.fromCodePoint(cp)),
    { minLength: 1, maxLength: 5 }
  )
  .map((chars) => `（${chars.join('')}）`);

// Feature: project-note-base-management, Property 4: 列名标准化去除装饰字符
describe('Feature: project-note-base-management, Property 4: 列名标准化去除装饰字符', () => {
  /**
   * Validates: Requirements 6.1
   *
   * For any plain Chinese text (no emojis, no parentheses),
   * normalizeHeader returns the same text (idempotency).
   */
  it('不含装饰字符的纯文本应原样返回（幂等性）', () => {
    fc.assert(
      fc.property(plainChineseTextArb, (text) => {
        const result = normalizeHeader(text);
        expect(result).toBe(text);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 6.1
   *
   * For any Chinese text with an emoji prefix prepended,
   * normalizeHeader returns the original text without the emoji prefix.
   */
  it('带emoji前缀的列名应去除emoji返回纯文本', () => {
    fc.assert(
      fc.property(emojiPrefixArb, plainChineseTextArb, (emoji, text) => {
        const decorated = emoji + text;
        const result = normalizeHeader(decorated);
        expect(result).toBe(text);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 6.1
   *
   * For any Chinese text with a Chinese parenthetical suffix appended like （xxx）,
   * normalizeHeader returns the original text without the suffix.
   */
  it('带中文括号后缀的列名应去除后缀返回纯文本', () => {
    fc.assert(
      fc.property(plainChineseTextArb, chineseParenSuffixArb, (text, suffix) => {
        const decorated = text + suffix;
        const result = normalizeHeader(decorated);
        expect(result).toBe(text);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 6.1
   *
   * For any Chinese text with both emoji prefix AND parenthetical suffix,
   * normalizeHeader returns the original text without either decoration.
   */
  it('同时带emoji前缀和中文括号后缀的列名应去除所有装饰返回纯文本', () => {
    fc.assert(
      fc.property(
        emojiPrefixArb,
        plainChineseTextArb,
        chineseParenSuffixArb,
        (emoji, text, suffix) => {
          const decorated = emoji + text + suffix;
          const result = normalizeHeader(decorated);
          expect(result).toBe(text);
        }
      ),
      { numRuns: 100 }
    );
  });
});

import { extractNoteIdFromLink } from './note-base-parser';

// ─── Property 3 Arbitraries ───

/**
 * Generates a valid alphanumeric noteId (simulating real Xiaohongshu note IDs).
 */
const alphanumericNoteIdArb = fc
  .array(
    fc.oneof(
      fc.integer({ min: 0x30, max: 0x39 }).map((cp) => String.fromCodePoint(cp)), // 0-9
      fc.integer({ min: 0x61, max: 0x66 }).map((cp) => String.fromCodePoint(cp))  // a-f (hex)
    ),
    { minLength: 10, maxLength: 30 }
  )
  .map((chars) => chars.join(''));

/**
 * Generates a valid alphanumeric noteId (broader range: a-z, 0-9).
 */
const generalAlphanumericNoteIdArb = fc
  .array(
    fc.oneof(
      fc.integer({ min: 0x30, max: 0x39 }).map((cp) => String.fromCodePoint(cp)), // 0-9
      fc.integer({ min: 0x61, max: 0x7a }).map((cp) => String.fromCodePoint(cp))  // a-z
    ),
    { minLength: 1, maxLength: 30 }
  )
  .map((chars) => chars.join(''));

/**
 * Generates a random query string parameter value.
 */
const queryParamArb = fc.webQueryParameters();

/**
 * Generates a row index for fallback ID generation.
 */
const rowIndexArb = fc.integer({ min: 1, max: 10000 });

/**
 * Generates a URL that does NOT contain 'explore/' in the path.
 */
const nonExploreUrlArb = fc.oneof(
  fc.constant('https://www.xiaohongshu.com/discovery/item/abc123'),
  fc.constant('https://www.xiaohongshu.com/user/profile/123456'),
  fc.constant('https://example.com/some/path'),
  fc.constant('not-a-url-at-all'),
  fc.constant('https://www.xiaohongshu.com/')
);

// Feature: project-note-base-management, Property 3: 笔记ID从链接中正确提取
describe('Feature: project-note-base-management, Property 3: 笔记ID从链接中正确提取', () => {
  /**
   * Validates: Requirements 5.1
   *
   * For any valid alphanumeric noteId string, when formatted into a standard
   * Xiaohongshu explore URL, extractNoteIdFromLink should return exactly that noteId.
   */
  it('标准格式URL应正确提取noteId', () => {
    fc.assert(
      fc.property(generalAlphanumericNoteIdArb, rowIndexArb, (noteId, rowIndex) => {
        const url = `https://www.xiaohongshu.com/explore/${noteId}?xsec_token=xxx`;
        const result = extractNoteIdFromLink(url, rowIndex);
        expect(result.noteId).toBe(noteId);
        expect(result.warning).toBeUndefined();
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 5.1
   *
   * For any URL that does NOT contain 'explore/', extractNoteIdFromLink should
   * return a fallback ID `row_{rowIndex}` and include a warning message.
   */
  it('不含explore/的URL应返回备用ID并包含warning', () => {
    fc.assert(
      fc.property(nonExploreUrlArb, rowIndexArb, (url, rowIndex) => {
        const result = extractNoteIdFromLink(url, rowIndex);
        expect(result.noteId).toBe(`row_${rowIndex}`);
        expect(result.warning).toBeDefined();
        expect(result.warning).toContain(`row_${rowIndex}`);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 5.1
   *
   * For URLs with noteId containing only hex characters (like real Xiaohongshu IDs),
   * extraction works correctly.
   */
  it('十六进制noteId（真实小红书ID格式）应正确提取', () => {
    fc.assert(
      fc.property(alphanumericNoteIdArb, rowIndexArb, (hexNoteId, rowIndex) => {
        const url = `https://www.xiaohongshu.com/explore/${hexNoteId}?xsec_token=abc123&xsec_source=pc_search`;
        const result = extractNoteIdFromLink(url, rowIndex);
        expect(result.noteId).toBe(hexNoteId);
        expect(result.warning).toBeUndefined();
      }),
      { numRuns: 100 }
    );
  });
});

import { parseNoteBaseExcel } from './note-base-parser';
import * as XLSX from 'xlsx';

// ─── Property 2 Helpers ───

/**
 * Creates an Excel buffer from row data with the target sheet name "已发布达人".
 */
function createExcelBuffer(rows: Record<string, unknown>[]): Buffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, '已发布达人');
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

// ─── Property 2 Arbitraries ───

/**
 * Generates a valid Xiaohongshu note URL.
 */
const validNoteLinkArb = fc
  .array(
    fc.oneof(
      fc.integer({ min: 0x30, max: 0x39 }).map((cp) => String.fromCodePoint(cp)), // 0-9
      fc.integer({ min: 0x61, max: 0x66 }).map((cp) => String.fromCodePoint(cp))  // a-f
    ),
    { minLength: 10, maxLength: 24 }
  )
  .map((chars) => `https://www.xiaohongshu.com/explore/${chars.join('')}?xsec_token=abc`);

/**
 * Generates a valid KOL nickname (Chinese characters).
 */
const kolNicknameArb = fc
  .array(
    fc.integer({ min: 0x4e00, max: 0x9fff }).map((cp) => String.fromCodePoint(cp)),
    { minLength: 2, maxLength: 8 }
  )
  .map((chars) => chars.join(''));

/**
 * Generates a row with a valid noteLink (should be included in parse result).
 */
const validRowArb = fc.tuple(validNoteLinkArb, kolNicknameArb).map(([noteLink, nickname]) => ({
  '笔记链接': noteLink,
  '博主昵称': nickname,
  '博主粉丝量': 10000,
  '合作形式': '报备',
}));

/**
 * Generates a row with an empty noteLink (should be skipped/filtered).
 */
const emptyLinkRowArb = kolNicknameArb.map((nickname) => ({
  '笔记链接': '',
  '博主昵称': nickname,
  '博主粉丝量': 5000,
  '合作形式': '非报备',
}));

// Feature: project-note-base-management, Property 2: 无笔记链接的行被过滤
describe('Feature: project-note-base-management, Property 2: 无笔记链接的行被过滤', () => {
  /**
   * Validates: Requirements 4.1, 4.2
   *
   * For any mix of rows with valid noteLink and empty noteLink,
   * all records in the parse result must have a non-empty noteLink field.
   */
  it('解析结果中所有记录的noteLink必须非空', () => {
    fc.assert(
      fc.property(
        fc.array(validRowArb, { minLength: 1, maxLength: 5 }),
        fc.array(emptyLinkRowArb, { minLength: 0, maxLength: 5 }),
        (validRows, emptyRows) => {
          // Mix valid and empty rows in arbitrary order
          const allRows = [...validRows, ...emptyRows];
          const buffer = createExcelBuffer(allRows);
          const result = parseNoteBaseExcel(buffer);

          // Every record in the result must have a non-empty noteLink
          for (const record of result.records) {
            expect(record.noteLink).toBeTruthy();
            expect(record.noteLink.length).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 4.1, 4.2
   *
   * The skippedRows count must equal the number of rows with empty noteLink in the input.
   */
  it('skippedRows数量等于空noteLink行数', () => {
    fc.assert(
      fc.property(
        fc.array(validRowArb, { minLength: 1, maxLength: 5 }),
        fc.array(emptyLinkRowArb, { minLength: 0, maxLength: 5 }),
        (validRows, emptyRows) => {
          const allRows = [...validRows, ...emptyRows];
          const buffer = createExcelBuffer(allRows);
          const result = parseNoteBaseExcel(buffer);

          expect(result.skippedRows).toBe(emptyRows.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 4.1, 4.2
   *
   * The number of records in the result must equal the number of valid rows
   * (those with non-empty noteLink) in the input.
   */
  it('解析记录数等于有效行数（非空noteLink行）', () => {
    fc.assert(
      fc.property(
        fc.array(validRowArb, { minLength: 1, maxLength: 5 }),
        fc.array(emptyLinkRowArb, { minLength: 0, maxLength: 5 }),
        (validRows, emptyRows) => {
          const allRows = [...validRows, ...emptyRows];
          const buffer = createExcelBuffer(allRows);
          const result = parseNoteBaseExcel(buffer);

          expect(result.records.length).toBe(validRows.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});

import { NOTE_BASE_COLUMN_MAP } from './note-base-parser';

// ─── Property 5 Helpers ───

/**
 * Field type classification for NOTE_BASE_COLUMN_MAP entries.
 */
type FieldType = 'string' | 'number' | 'boolean';

interface FieldMapping {
  chineseHeader: string;
  fieldName: string;
  fieldType: FieldType;
}

/**
 * All mappable fields from NOTE_BASE_COLUMN_MAP (excluding '_index'),
 * classified by their expected type in ParsedNoteBaseRow.
 */
const STRING_FIELDS: FieldMapping[] = [
  { chineseHeader: '博主昵称', fieldName: 'kolNickName', fieldType: 'string' },
  { chineseHeader: '笔记链接', fieldName: 'noteLink', fieldType: 'string' },
  { chineseHeader: '笔记连接', fieldName: 'noteLink', fieldType: 'string' },
  { chineseHeader: '合作形式', fieldName: 'cooperationForm', fieldType: 'string' },
  { chineseHeader: '内容形式', fieldName: 'cooperationForm', fieldType: 'string' },
  { chineseHeader: '内容方向', fieldName: 'contentDirection', fieldType: 'string' },
  { chineseHeader: '达人类型', fieldName: 'kolType', fieldType: 'string' },
  { chineseHeader: '对应SPU', fieldName: 'spuName', fieldType: 'string' },
];

const NUMBER_FIELDS: FieldMapping[] = [
  { chineseHeader: '博主粉丝量', fieldName: 'kolFanNum', fieldType: 'number' },
  { chineseHeader: '内容实际消耗金额', fieldName: 'contentCost', fieldType: 'number' },
  { chineseHeader: '达人金额', fieldName: 'contentCost', fieldType: 'number' },
  { chineseHeader: '内容实际结算金额', fieldName: 'contentSettlement', fieldType: 'number' },
  { chineseHeader: '投流实际消耗', fieldName: 'adSpend', fieldType: 'number' },
  { chineseHeader: '投流金额', fieldName: 'adSpend', fieldType: 'number' },
  { chineseHeader: '总费用', fieldName: 'totalCost', fieldType: 'number' },
  { chineseHeader: '总消耗', fieldName: 'totalCost', fieldType: 'number' },
];

const BOOLEAN_FIELDS: FieldMapping[] = [
  { chineseHeader: '是否报备', fieldName: 'isRegistered', fieldType: 'boolean' },
];

/**
 * Generates a valid noteLink URL for use in test rows (required so rows aren't skipped).
 */
const testNoteLinkArb = fc
  .array(
    fc.oneof(
      fc.integer({ min: 0x30, max: 0x39 }).map((cp) => String.fromCodePoint(cp)),
      fc.integer({ min: 0x61, max: 0x66 }).map((cp) => String.fromCodePoint(cp))
    ),
    { minLength: 12, maxLength: 24 }
  )
  .map((chars) => `https://www.xiaohongshu.com/explore/${chars.join('')}?xsec_token=test`);

/**
 * Generates a random non-empty string value for string field testing.
 */
const nonEmptyStringArb = fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0);

/**
 * Generates a random positive integer for number field testing.
 */
const positiveNumberArb = fc.integer({ min: 1, max: 1000000 });

// Feature: project-note-base-management, Property 5: 字段映射完整性
describe('Feature: project-note-base-management, Property 5: 字段映射完整性', () => {
  /**
   * Validates: Requirements 6.3, 7.2
   *
   * For a randomly chosen string field mapping from NOTE_BASE_COLUMN_MAP,
   * when the Excel row contains that Chinese header with a non-empty string value,
   * the parsed result's corresponding field must contain that value.
   */
  it('字符串字段：中文列名映射到正确字段并保留原值', () => {
    // Exclude noteLink-related mappings from value checks since noteLink is always present as the filter field
    const nonLinkStringFields = STRING_FIELDS.filter(
      (f) => f.chineseHeader !== '笔记链接' && f.chineseHeader !== '笔记连接'
    );

    fc.assert(
      fc.property(
        fc.constantFrom(...nonLinkStringFields),
        nonEmptyStringArb,
        testNoteLinkArb,
        (fieldMapping, value, noteLink) => {
          const row: Record<string, unknown> = {
            '笔记链接': noteLink,
            [fieldMapping.chineseHeader]: value,
          };
          const buffer = createExcelBuffer([row]);
          const result = parseNoteBaseExcel(buffer);

          expect(result.records.length).toBe(1);
          const record = result.records[0] as Record<string, unknown>;
          expect(record[fieldMapping.fieldName]).toBe(value.trim());
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 6.3, 7.2
   *
   * For a randomly chosen number field mapping from NOTE_BASE_COLUMN_MAP,
   * when the Excel row contains that Chinese header with a numeric value,
   * the parsed result's corresponding field must contain the correct numeric value.
   */
  it('数字字段：中文列名映射到正确字段并正确转为数字', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...NUMBER_FIELDS),
        positiveNumberArb,
        testNoteLinkArb,
        (fieldMapping, value, noteLink) => {
          const row: Record<string, unknown> = {
            '笔记链接': noteLink,
            [fieldMapping.chineseHeader]: value,
          };
          const buffer = createExcelBuffer([row]);
          const result = parseNoteBaseExcel(buffer);

          expect(result.records.length).toBe(1);
          const record = result.records[0] as Record<string, unknown>;
          expect(record[fieldMapping.fieldName]).toBe(value);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 6.3, 7.2
   *
   * For the boolean field '是否报备' → 'isRegistered',
   * '是' maps to true and '否' maps to false.
   */
  it('布尔字段：是否报备正确映射为true/false', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('是', '否'),
        testNoteLinkArb,
        (boolValue, noteLink) => {
          const row: Record<string, unknown> = {
            '笔记链接': noteLink,
            '是否报备': boolValue,
          };
          const buffer = createExcelBuffer([row]);
          const result = parseNoteBaseExcel(buffer);

          expect(result.records.length).toBe(1);
          const record = result.records[0];
          if (boolValue === '是') {
            expect(record.isRegistered).toBe(true);
          } else {
            expect(record.isRegistered).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 6.3, 7.2
   *
   * Verify that NOTE_BASE_COLUMN_MAP covers all expected mappings by checking
   * that noteLink field mappings correctly preserve the link value in parsed output.
   */
  it('笔记链接字段：通过noteLink列名映射正确保留链接值', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('笔记链接', '笔记连接'),
        testNoteLinkArb,
        (headerName, noteLink) => {
          const row: Record<string, unknown> = {
            [headerName]: noteLink,
          };
          const buffer = createExcelBuffer([row]);
          const result = parseNoteBaseExcel(buffer);

          expect(result.records.length).toBe(1);
          expect(result.records[0].noteLink).toBe(noteLink);
        }
      ),
      { numRuns: 100 }
    );
  });
});
