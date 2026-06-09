/**
 * Property-based tests for NoteBase parser — Properties 8, 9, 10
 *
 * Feature: schema-restructure
 *
 * Validates: Requirements 8.1–8.9, 9.1–9.5, 10.1–10.3
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import * as XLSX from 'xlsx';
import {
  parseNoteBaseExcel,
  NOTE_BASE_COLUMN_MAP,
  DISPLAY_ONLY_COLUMN_MAP,
  REQUIRED_FIELD_NAMES,
} from '../note-base-parser';

// ─── Helpers ───

/**
 * Creates an Excel buffer from json-style rows with "已发布达人" sheet.
 */
function createExcelBuffer(rows: Record<string, unknown>[]): Buffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, '已发布达人');
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

/**
 * Creates an Excel buffer from array-of-arrays (for controlling header row position).
 */
function createExcelBufferFromAoA(rows: unknown[][]): Buffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, '已发布达人');
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

// ─── Arbitraries ───

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
 * Generates a content direction value.
 */
const contentDirectionArb = fc.constantFrom('种草', '测评', '品宣', '引流', '日常分享');

/**
 * Generates a kolType value.
 */
const kolTypeArb = fc.constantFrom('图文', '视频');

/**
 * Generates a positive cost value.
 */
const costArb = fc.integer({ min: 100, max: 100000 });

/**
 * Generates a cooperation form value.
 */
const cooperationFormArb = fc.constantFrom('报备', '非报备', '置换', '赠品');

/**
 * Generates a non-negative metric value.
 */
const metricArb = fc.integer({ min: 0, max: 1000000 });

/**
 * Generates a Chinese nickname.
 */
const nicknameArb = fc
  .array(
    fc.integer({ min: 0x4e00, max: 0x9fff }).map((cp) => String.fromCodePoint(cp)),
    { minLength: 2, maxLength: 8 }
  )
  .map((chars) => chars.join(''));

/**
 * Generates arbitrary non-header text (won't be recognized as a known column).
 */
const unknownHeaderArb = fc.constantFrom(
  '项目周期汇总表', '时间段', '负责人', '备注信息', '日期范围',
  '项目名称', '阶段', 'Summary', 'Total', '合计'
);

// ─── The 5 required column headers for the new format ───
const REQUIRED_HEADERS = ['发布链接', '内容方向', '笔记类型', '资源含税成本价', '资源含税售价'];

// ─── Optional metric columns that go into displayMetrics ───
const OPTIONAL_METRIC_HEADERS = ['曝光量', '阅读量', '点赞量', '收藏量', '评论量', '转发量', '互动量', 'CPM', 'CPC', 'CPE', 'CTR'];

// ─── Optional non-metric columns ───
const OPTIONAL_MAPPED_HEADERS = ['内容形式', '总消耗'];


// Feature: schema-restructure, Property 8: NoteBase new 18-column header mapping with required vs optional distinction
describe('Feature: schema-restructure, Property 8: NoteBase new 18-column header mapping with required vs optional distinction', () => {
  /**
   * Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5
   *
   * For any NoteBase Excel with all 5 required columns present (发布链接, 内容方向,
   * 笔记类型, 资源含税成本价, 资源含税售价), the parser should produce records with
   * correct field mappings: noteLink, contentDirection, kolType, contentCost, contentSettlement.
   */
  it('all 5 required columns present → parser produces records with correct mappings', () => {
    fc.assert(
      fc.property(
        validNoteLinkArb,
        contentDirectionArb,
        kolTypeArb,
        costArb,
        costArb,
        (noteLink, direction, kolType, cost, settlement) => {
          const row: Record<string, unknown> = {
            '发布链接': noteLink,
            '内容方向': direction,
            '笔记类型': kolType,
            '资源含税成本价': cost,
            '资源含税售价': settlement,
          };
          const buffer = createExcelBuffer([row]);
          const result = parseNoteBaseExcel(buffer);

          // Should parse successfully with 1 record
          expect(result.records.length).toBe(1);
          const record = result.records[0];
          expect(record.noteLink).toBe(noteLink);
          expect(record.contentDirection).toBe(direction);
          expect(record.kolType).toBe(kolType);
          expect(record.contentCost).toBe(cost);
          expect(record.contentSettlement).toBe(settlement);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 8.9
   *
   * For any NoteBase Excel MISSING one or more of the 5 required columns
   * (but still containing at least one recognized column so header detection succeeds),
   * the parser should return a parse error (warnings contain "缺少必填列").
   *
   * We always keep at least one required column so that header detection passes
   * and the required-column validation is reached. When ALL required columns are
   * absent, the parser may return "未识别到有效表头" instead (tested in Property 10).
   */
  it('missing any required column → parser returns parse error', () => {
    fc.assert(
      fc.property(
        // Generate a non-empty STRICT SUBSET of required headers to REMOVE (1 to 4, not all 5)
        fc.subarray(REQUIRED_HEADERS, { minLength: 1, maxLength: 4 }),
        validNoteLinkArb,
        contentDirectionArb,
        kolTypeArb,
        costArb,
        costArb,
        (headersToRemove, noteLink, direction, kolType, cost, settlement) => {
          // Start with all required columns
          const row: Record<string, unknown> = {
            '发布链接': noteLink,
            '内容方向': direction,
            '笔记类型': kolType,
            '资源含税成本价': cost,
            '资源含税售价': settlement,
          };

          // Remove the selected headers (at most 4, so at least 1 remains for header detection)
          for (const header of headersToRemove) {
            delete row[header];
          }

          const buffer = createExcelBuffer([row]);
          const result = parseNoteBaseExcel(buffer);

          // Should return empty records with a warning about missing required columns
          expect(result.records.length).toBe(0);
          expect(result.warnings.length).toBeGreaterThan(0);
          expect(result.warnings[0]).toContain('缺少必填列');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 8.6, 8.7, 8.8
   *
   * For any NoteBase Excel with all 5 required columns PLUS optional columns
   * (内容形式, 总消耗, and metrics like 曝光量, 阅读量, etc.),
   * the parser should accept the file and correctly map optional columns.
   */
  it('optional columns present alongside required → parser maps them correctly', () => {
    fc.assert(
      fc.property(
        validNoteLinkArb,
        contentDirectionArb,
        kolTypeArb,
        costArb,
        costArb,
        cooperationFormArb,
        costArb,
        metricArb,
        metricArb,
        metricArb,
        (noteLink, direction, kolType, cost, settlement, coopForm, totalCost, impNum, readNum, engageNum) => {
          const row: Record<string, unknown> = {
            '发布链接': noteLink,
            '内容方向': direction,
            '笔记类型': kolType,
            '资源含税成本价': cost,
            '资源含税售价': settlement,
            '内容形式': coopForm,
            '总消耗': totalCost,
            '曝光量': impNum,
            '阅读量': readNum,
            '互动量': engageNum,
          };
          const buffer = createExcelBuffer([row]);
          const result = parseNoteBaseExcel(buffer);

          expect(result.records.length).toBe(1);
          const record = result.records[0];

          // Required fields mapped correctly
          expect(record.noteLink).toBe(noteLink);
          expect(record.contentDirection).toBe(direction);
          expect(record.kolType).toBe(kolType);
          expect(record.contentCost).toBe(cost);
          expect(record.contentSettlement).toBe(settlement);

          // Optional mapped fields
          expect(record.cooperationForm).toBe(coopForm);
          expect(record.totalCost).toBe(totalCost);

          // Metrics stored in displayMetrics
          expect(record.displayMetrics?.impNum).toBe(impNum);
          expect(record.displayMetrics?.readNum).toBe(readNum);
          expect(record.displayMetrics?.engageNum).toBe(engageNum);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 8.6, 8.7, 8.8
   *
   * For any NoteBase Excel with ONLY the 5 required columns and NO optional columns,
   * the parser should still succeed (optional columns do NOT trigger parse error).
   */
  it('missing optional columns do NOT trigger parse error', () => {
    fc.assert(
      fc.property(
        validNoteLinkArb,
        contentDirectionArb,
        kolTypeArb,
        costArb,
        costArb,
        (noteLink, direction, kolType, cost, settlement) => {
          // Only required columns, no optional columns at all
          const row: Record<string, unknown> = {
            '发布链接': noteLink,
            '内容方向': direction,
            '笔记类型': kolType,
            '资源含税成本价': cost,
            '资源含税售价': settlement,
          };
          const buffer = createExcelBuffer([row]);
          const result = parseNoteBaseExcel(buffer);

          // Should parse successfully
          expect(result.records.length).toBe(1);
          // No "缺少必填列" warning
          const hasMissingColWarning = result.warnings.some((w) => w.includes('缺少必填列'));
          expect(hasMissingColWarning).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});


// Feature: schema-restructure, Property 9: NoteBase backward compatibility and default values
describe('Feature: schema-restructure, Property 9: NoteBase backward compatibility and default values', () => {
  /**
   * Validates: Requirements 9.1
   *
   * For any old-format Excel with old headers (博主昵称, 博主粉丝量, 合作形式, 是否报备,
   * 达人类型, 对应SPU, 内容实际消耗金额, 投流实际消耗), the parser correctly maps them
   * to their respective fields.
   */
  it('old-format headers are correctly mapped to fields', () => {
    fc.assert(
      fc.property(
        validNoteLinkArb,
        nicknameArb,
        fc.integer({ min: 1000, max: 5000000 }),
        cooperationFormArb,
        fc.constantFrom('是', '否'),
        fc.constantFrom('图文', '视频'),
        nicknameArb,
        costArb,
        costArb,
        (noteLink, nickname, fanNum, coopForm, isReg, kolType, spuName, contentCost, adSpend) => {
          const row: Record<string, unknown> = {
            '笔记链接': noteLink,
            '博主昵称': nickname,
            '博主粉丝量': fanNum,
            '合作形式': coopForm,
            '是否报备': isReg,
            '达人类型': kolType,
            '对应SPU': spuName,
            '内容实际消耗金额': contentCost,
            '投流实际消耗': adSpend,
            // Need these for required field validation
            '内容方向': '种草',
            '内容实际结算金额': 6000,
          };
          const buffer = createExcelBuffer([row]);
          const result = parseNoteBaseExcel(buffer);

          expect(result.records.length).toBe(1);
          const record = result.records[0];
          expect(record.kolNickName).toBe(nickname);
          expect(record.kolFanNum).toBe(fanNum);
          expect(record.cooperationForm).toBe(coopForm);
          expect(record.isRegistered).toBe(isReg === '是');
          expect(record.kolType).toBe(kolType);
          expect(record.spuName).toBe(spuName);
          expect(record.contentCost).toBe(contentCost);
          expect(record.adSpend).toBe(adSpend);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 9.2, 9.3, 9.4, 9.5
   *
   * When old columns are absent from a new-format Excel, the parser uses defaults:
   * kolNickName=null, kolFanNum=0, isRegistered=false, spuName=null, adSpend=0.
   */
  it('new-format Excel without old columns → correct default values applied', () => {
    fc.assert(
      fc.property(
        validNoteLinkArb,
        contentDirectionArb,
        kolTypeArb,
        costArb,
        costArb,
        (noteLink, direction, kolType, cost, settlement) => {
          // New-format with only the 5 required columns (no old optional columns)
          const row: Record<string, unknown> = {
            '发布链接': noteLink,
            '内容方向': direction,
            '笔记类型': kolType,
            '资源含税成本价': cost,
            '资源含税售价': settlement,
          };
          const buffer = createExcelBuffer([row]);
          const result = parseNoteBaseExcel(buffer);

          expect(result.records.length).toBe(1);
          const record = result.records[0];

          // Req 9.2: kolNickName defaults to null, kolFanNum defaults to 0
          expect(record.kolNickName).toBeNull();
          expect(record.kolFanNum).toBe(0);

          // Req 9.3: isRegistered defaults to false
          expect(record.isRegistered).toBe(false);

          // Req 9.4: spuName defaults to null
          expect(record.spuName).toBeNull();

          // Req 9.5: adSpend defaults to 0
          expect(record.adSpend).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 9.1, 9.2–9.5
   *
   * For any mix of old and new columns (partial backward compat), values from present
   * old columns are mapped and absent old columns get defaults.
   */
  it('partial old columns present → mapped values correct, absent ones default', () => {
    fc.assert(
      fc.property(
        validNoteLinkArb,
        contentDirectionArb,
        kolTypeArb,
        costArb,
        costArb,
        nicknameArb,
        fc.integer({ min: 1000, max: 5000000 }),
        (noteLink, direction, kolType, cost, settlement, nickname, fanNum) => {
          // New-format required columns + only 博主昵称 and 博主粉丝量 from old
          const row: Record<string, unknown> = {
            '发布链接': noteLink,
            '内容方向': direction,
            '笔记类型': kolType,
            '资源含税成本价': cost,
            '资源含税售价': settlement,
            '博主昵称': nickname,
            '博主粉丝量': fanNum,
          };
          const buffer = createExcelBuffer([row]);
          const result = parseNoteBaseExcel(buffer);

          expect(result.records.length).toBe(1);
          const record = result.records[0];

          // Present old columns mapped correctly
          expect(record.kolNickName).toBe(nickname);
          expect(record.kolFanNum).toBe(fanNum);

          // Absent old columns get defaults
          expect(record.isRegistered).toBe(false);
          expect(record.spuName).toBeNull();
          expect(record.adSpend).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});


// Feature: schema-restructure, Property 10: Header row auto-detection
describe('Feature: schema-restructure, Property 10: Header row auto-detection', () => {
  /**
   * Validates: Requirements 10.1
   *
   * For any Excel where row 1 has known headers (the 5 required columns),
   * the parser uses row 1 as the header and correctly produces records.
   */
  it('row 1 contains known headers → uses row 1, parses correctly', () => {
    fc.assert(
      fc.property(
        validNoteLinkArb,
        contentDirectionArb,
        kolTypeArb,
        costArb,
        costArb,
        (noteLink, direction, kolType, cost, settlement) => {
          // AoA format: row 1 = headers, row 2+ = data
          const aoa = [
            ['发布链接', '内容方向', '笔记类型', '资源含税成本价', '资源含税售价'],
            [noteLink, direction, kolType, cost, settlement],
          ];
          const buffer = createExcelBufferFromAoA(aoa);
          const result = parseNoteBaseExcel(buffer);

          expect(result.records.length).toBe(1);
          const record = result.records[0];
          expect(record.noteLink).toBe(noteLink);
          expect(record.contentDirection).toBe(direction);
          expect(record.kolType).toBe(kolType);
          expect(record.contentCost).toBe(cost);
          expect(record.contentSettlement).toBe(settlement);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 10.2
   *
   * For any Excel where row 1 has unknown headers but row 2 has known headers,
   * the parser skips row 1 and uses row 2 as the header.
   */
  it('row 1 unknown, row 2 has known headers → skips row 1, uses row 2', () => {
    fc.assert(
      fc.property(
        unknownHeaderArb,
        unknownHeaderArb,
        unknownHeaderArb,
        validNoteLinkArb,
        contentDirectionArb,
        kolTypeArb,
        costArb,
        costArb,
        (title1, title2, title3, noteLink, direction, kolType, cost, settlement) => {
          // Row 1: unknown headers (title row)
          // Row 2: known headers
          // Row 3: data
          const aoa = [
            [title1, title2, title3, '', ''],
            ['发布链接', '内容方向', '笔记类型', '资源含税成本价', '资源含税售价'],
            [noteLink, direction, kolType, cost, settlement],
          ];
          const buffer = createExcelBufferFromAoA(aoa);
          const result = parseNoteBaseExcel(buffer);

          expect(result.records.length).toBe(1);
          const record = result.records[0];
          expect(record.noteLink).toBe(noteLink);
          expect(record.contentDirection).toBe(direction);
          expect(record.kolType).toBe(kolType);
          expect(record.contentCost).toBe(cost);
          expect(record.contentSettlement).toBe(settlement);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 10.3
   *
   * For any Excel where neither row 1 nor row 2 contains known column names,
   * the parser returns a parse error "未识别到有效表头".
   */
  it('neither row 1 nor row 2 has known headers → returns parse error', () => {
    fc.assert(
      fc.property(
        unknownHeaderArb,
        unknownHeaderArb,
        unknownHeaderArb,
        unknownHeaderArb,
        unknownHeaderArb,
        unknownHeaderArb,
        (h1, h2, h3, h4, h5, h6) => {
          // Row 1: unknown headers
          // Row 2: also unknown headers
          // Row 3: data (won't be parsed)
          const aoa = [
            [h1, h2, h3],
            [h4, h5, h6],
            ['value1', 'value2', 'value3'],
          ];
          const buffer = createExcelBufferFromAoA(aoa);
          const result = parseNoteBaseExcel(buffer);

          expect(result.records).toHaveLength(0);
          expect(result.warnings[0]).toContain('未识别到有效表头');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 10.1, 10.2
   *
   * Header detection works with decorated (emoji + parenthetical) column names
   * in either row 1 or row 2.
   */
  it('emoji-decorated headers in row 2 → correctly detected and parsed', () => {
    fc.assert(
      fc.property(
        unknownHeaderArb,
        validNoteLinkArb,
        contentDirectionArb,
        kolTypeArb,
        costArb,
        costArb,
        (title, noteLink, direction, kolType, cost, settlement) => {
          // Row 1: title/unknown
          // Row 2: decorated known headers
          const aoa = [
            [title, '', '', '', ''],
            ['🔴发布链接（必填）', '🔴内容方向（必填）', '🔴笔记类型（必填）', '🔴资源含税成本价（必填）', '🔴资源含税售价（必填）'],
            [noteLink, direction, kolType, cost, settlement],
          ];
          const buffer = createExcelBufferFromAoA(aoa);
          const result = parseNoteBaseExcel(buffer);

          expect(result.records.length).toBe(1);
          const record = result.records[0];
          expect(record.noteLink).toBe(noteLink);
          expect(record.contentDirection).toBe(direction);
          expect(record.kolType).toBe(kolType);
          expect(record.contentCost).toBe(cost);
          expect(record.contentSettlement).toBe(settlement);
        }
      ),
      { numRuns: 100 }
    );
  });
});
