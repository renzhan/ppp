/**
 * Unit tests for header row auto-detection in note-base-parser.
 * Validates: Requirements 10.1, 10.2, 10.3
 */

import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseNoteBaseExcel, headersContainKnownColumns } from '../note-base-parser';

// ─── Helpers ───

/**
 * Creates an Excel buffer with a specific sheet structure.
 * `rows` is an array of arrays representing cell values per row.
 * The first row becomes the header when parsed with default settings.
 */
function createExcelBufferFromAoA(rows: unknown[][]): Buffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, '已发布达人');
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

/**
 * Creates an Excel buffer from standard json-style rows (header in row 1).
 */
function createExcelBuffer(rows: Record<string, unknown>[]): Buffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, '已发布达人');
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

// ─── headersContainKnownColumns tests ───

describe('headersContainKnownColumns', () => {
  it('should return true when headers contain a NOTE_BASE_COLUMN_MAP key', () => {
    expect(headersContainKnownColumns(['笔记链接', '其他列'])).toBe(true);
    expect(headersContainKnownColumns(['发布链接'])).toBe(true);
    expect(headersContainKnownColumns(['内容方向'])).toBe(true);
    expect(headersContainKnownColumns(['资源含税成本价'])).toBe(true);
  });

  it('should return true when headers contain a DISPLAY_ONLY_COLUMN_MAP key', () => {
    expect(headersContainKnownColumns(['曝光量', '阅读量'])).toBe(true);
    expect(headersContainKnownColumns(['CPM'])).toBe(true);
    expect(headersContainKnownColumns(['转发量'])).toBe(true);
  });

  it('should return true when header matches after normalization', () => {
    // Emoji prefix + parenthetical suffix
    expect(headersContainKnownColumns(['🔴笔记链接（必填）'])).toBe(true);
    expect(headersContainKnownColumns(['⭐️发布链接（必填）'])).toBe(true);
  });

  it('should return false when no headers match', () => {
    expect(headersContainKnownColumns(['项目周期汇总表', '时间段', '负责人'])).toBe(false);
    expect(headersContainKnownColumns(['Column A', 'Column B', 'Column C'])).toBe(false);
    expect(headersContainKnownColumns([])).toBe(false);
  });
});

// ─── Header Row Auto-Detection in parseNoteBaseExcel ───

describe('parseNoteBaseExcel header row auto-detection', () => {
  it('should use row 1 as header when it contains known column names (Req 10.1)', () => {
    // Row 1 is valid header, data starts from row 2
    const rows: Record<string, unknown>[] = [
      {
        '发布链接': 'https://www.xiaohongshu.com/explore/abc123',
        '内容方向': '种草',
        '笔记类型': '图文',
        '资源含税成本价': 5000,
        '资源含税售价': 6000,
      },
    ];
    const buffer = createExcelBuffer(rows);
    const result = parseNoteBaseExcel(buffer);

    expect(result.records.length).toBe(1);
    expect(result.records[0].contentDirection).toBe('种草');
    expect(result.warnings).not.toContain('未识别到有效表头');
  });

  it('should skip row 1 and use row 2 as header when row 1 has no known columns (Req 10.2)', () => {
    // Row 1: title row (no known headers)
    // Row 2: actual header row (known column names)
    // Row 3+: data
    const aoa = [
      ['项目底表汇总 - 2024年Q1', '', '', '', ''],  // Row 1: title (not a header)
      ['发布链接', '内容方向', '笔记类型', '资源含税成本价', '资源含税售价'],  // Row 2: real header
      ['https://www.xiaohongshu.com/explore/note001', '种草', '图文', 5000, 6000],  // Row 3: data
      ['https://www.xiaohongshu.com/explore/note002', '测评', '视频', 3000, 4000],  // Row 4: data
    ];
    const buffer = createExcelBufferFromAoA(aoa);
    const result = parseNoteBaseExcel(buffer);

    expect(result.records.length).toBe(2);
    expect(result.records[0].noteLink).toBe('https://www.xiaohongshu.com/explore/note001');
    expect(result.records[0].contentDirection).toBe('种草');
    expect(result.records[1].noteLink).toBe('https://www.xiaohongshu.com/explore/note002');
    expect(result.records[1].contentDirection).toBe('测评');
    expect(result.warnings).not.toContain('未识别到有效表头');
  });

  it('should return parse error when neither row 1 nor row 2 contains known headers (Req 10.3)', () => {
    const aoa = [
      ['项目周期汇总表', '2024年Q1', '负责人'],  // Row 1: no known headers
      ['Some Title', 'Another Field', 'Data'],   // Row 2: still no known headers
      ['value1', 'value2', 'value3'],             // Row 3: data
    ];
    const buffer = createExcelBufferFromAoA(aoa);
    const result = parseNoteBaseExcel(buffer);

    expect(result.records).toHaveLength(0);
    expect(result.warnings[0]).toContain('未识别到有效表头');
  });

  it('should handle row 2 header with emoji-decorated column names', () => {
    const aoa = [
      ['达人投放底表 - 品牌A', '', '', '', ''],
      ['🔴发布链接（必填）', '🔴内容方向（必填）', '🔴笔记类型（必填）', '🔴资源含税成本价（必填）', '🔴资源含税售价（必填）'],
      ['https://www.xiaohongshu.com/explore/note001', '种草', '图文', 5000, 6000],
    ];
    const buffer = createExcelBufferFromAoA(aoa);
    const result = parseNoteBaseExcel(buffer);

    expect(result.records.length).toBe(1);
    expect(result.records[0].contentDirection).toBe('种草');
    expect(result.records[0].contentCost).toBe(5000);
  });

  it('should handle single-row file with only a title (no valid header anywhere)', () => {
    // When a single-row file has no known headers, sheet_to_json treats row 1 as header
    // yielding 0 data rows → returns "文件中没有数据行" before header detection runs.
    // This is correct behavior: a 1-row file with no known columns has no usable data.
    const aoa = [
      ['这是一个标题行，不包含任何已知列名'],
    ];
    const buffer = createExcelBufferFromAoA(aoa);
    const result = parseNoteBaseExcel(buffer);

    expect(result.records).toHaveLength(0);
    expect(result.warnings[0]).toMatch(/没有数据行|未识别到有效表头/);
  });

  it('should detect row 1 header even with DISPLAY_ONLY_COLUMN_MAP columns', () => {
    // Row 1 has display-only columns like 曝光量 — should still be detected
    const aoa = [
      ['发布链接', '内容方向', '笔记类型', '资源含税成本价', '资源含税售价', '曝光量', '阅读量'],
      ['https://www.xiaohongshu.com/explore/note001', '种草', '图文', 5000, 6000, 10000, 8000],
    ];
    const buffer = createExcelBufferFromAoA(aoa);
    const result = parseNoteBaseExcel(buffer);

    expect(result.records.length).toBe(1);
    expect(result.records[0].displayMetrics?.impNum).toBe(10000);
    expect(result.records[0].displayMetrics?.readNum).toBe(8000);
  });
});
