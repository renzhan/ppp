/**
 * Consolidated unit tests for NoteBase parser changes (Task 7.5)
 *
 * Validates: Requirements 8.1–8.8, 9.1–9.5, 10.1–10.3
 *
 * Covers specific concrete examples for:
 * 1. New 18-column parsing (all 5 required + 2 optional mapped + 11 metric columns)
 * 2. Old header parsing (backward compat)
 * 3. Mixed scenario (varying column presence across rows)
 * 4. Header row detection (reference — detailed tests in note-base-parser-header-detection.test.ts)
 */

import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseNoteBaseExcel } from '../note-base-parser';

// ─── Helpers ───

function createExcelBuffer(rows: Record<string, unknown>[], sheetName = '已发布达人'): Buffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

function createExcelBufferFromAoA(rows: unknown[][], sheetName = '已发布达人'): Buffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

const VALID_LINK_1 = 'https://www.xiaohongshu.com/explore/abc123def456?xsec_token=test';
const VALID_LINK_2 = 'https://www.xiaohongshu.com/explore/xyz789ghi012?xsec_token=test';
const VALID_LINK_3 = 'https://www.xiaohongshu.com/explore/note00300abc?xsec_token=test';

// ─── 1. New 18-column parsing ───

describe('NoteBase parser - new 18-column parsing (Req 8.1–8.8)', () => {
  it('parses a full row with all 18 columns correctly', () => {
    const row = {
      // 5 required columns
      '发布链接': VALID_LINK_1,
      '内容方向': '种草',
      '笔记类型': '图文',
      '资源含税成本价': 5000,
      '资源含税售价': 6500,
      // 2 optional mapped columns
      '内容形式': '报备',
      '总消耗': 12000,
      // 11 metric columns (displayMetrics)
      '曝光量': 50000,
      '阅读量': 30000,
      '点赞量': 2000,
      '收藏量': 1500,
      '评论量': 300,
      '转发量': 200,
      '互动量': 4000,
      'CPM': 120.5,
      'CPC': 2.3,
      'CPE': 3.0,
      'CTR': 0.6,
    };

    const buffer = createExcelBuffer([row]);
    const result = parseNoteBaseExcel(buffer);

    expect(result.records).toHaveLength(1);
    expect(result.warnings).toHaveLength(0);
    expect(result.skippedRows).toBe(0);

    const record = result.records[0];

    // Required fields (Req 8.1–8.5)
    expect(record.noteId).toBe('abc123def456');
    expect(record.noteLink).toBe(VALID_LINK_1);
    expect(record.contentDirection).toBe('种草');
    expect(record.kolType).toBe('图文');
    expect(record.contentCost).toBe(5000);
    expect(record.contentSettlement).toBe(6500);

    // Optional mapped fields (Req 8.6, 8.7)
    expect(record.cooperationForm).toBe('报备');
    expect(record.totalCost).toBe(12000);

    // Display metrics (Req 8.8)
    expect(record.displayMetrics).toBeDefined();
    expect(record.displayMetrics!.impNum).toBe(50000);
    expect(record.displayMetrics!.readNum).toBe(30000);
    expect(record.displayMetrics!.likeNum).toBe(2000);
    expect(record.displayMetrics!.favNum).toBe(1500);
    expect(record.displayMetrics!.cmtNum).toBe(300);
    expect(record.displayMetrics!.shareNum).toBe(200);
    expect(record.displayMetrics!.engageNum).toBe(4000);
    expect(record.displayMetrics!.cpm).toBe(120.5);
    expect(record.displayMetrics!.cpc).toBe(2.3);
    expect(record.displayMetrics!.cpe).toBe(3.0);
    expect(record.displayMetrics!.ctr).toBe(0.6);
  });

  it('parses only required columns without error (optional absent)', () => {
    const row = {
      '发布链接': VALID_LINK_1,
      '内容方向': '测评',
      '笔记类型': '视频',
      '资源含税成本价': 8000,
      '资源含税售价': 10000,
    };

    const buffer = createExcelBuffer([row]);
    const result = parseNoteBaseExcel(buffer);

    expect(result.records).toHaveLength(1);
    const record = result.records[0];
    expect(record.contentDirection).toBe('测评');
    expect(record.kolType).toBe('视频');
    expect(record.contentCost).toBe(8000);
    expect(record.contentSettlement).toBe(10000);
    // No displayMetrics when metric columns absent
    expect(record.displayMetrics).toBeUndefined();
    // Optional mapped fields default
    expect(record.cooperationForm).toBeNull();
    expect(record.totalCost).toBe(0);
  });

  it('returns parse error when a required column is missing (Req 8.9)', () => {
    // Missing '资源含税售价'
    const row = {
      '发布链接': VALID_LINK_1,
      '内容方向': '种草',
      '笔记类型': '图文',
      '资源含税成本价': 5000,
    };

    const buffer = createExcelBuffer([row]);
    const result = parseNoteBaseExcel(buffer);

    expect(result.records).toHaveLength(0);
    expect(result.warnings[0]).toContain('缺少必填列');
    expect(result.warnings[0]).toContain('资源含税售价');
  });
});

// ─── 2. Old header parsing ───

describe('NoteBase parser - old header parsing (Req 9.1–9.5)', () => {
  it('parses old-format Excel with legacy column names', () => {
    const row = {
      '笔记链接': VALID_LINK_1,
      '博主昵称': '美妆达人小A',
      '博主粉丝量': 120000,
      '合作形式': '置换',
      '是否报备': '是',
      '达人类型': '视频',
      '对应SPU': '精华液',
      '内容实际消耗金额': 4000,
      '内容实际结算金额': 5000,
      '投流实际消耗': 2000,
      '内容方向': '种草',
    };

    const buffer = createExcelBuffer([row]);
    const result = parseNoteBaseExcel(buffer);

    expect(result.records).toHaveLength(1);
    const record = result.records[0];

    expect(record.kolNickName).toBe('美妆达人小A');
    expect(record.kolFanNum).toBe(120000);
    expect(record.cooperationForm).toBe('置换');
    expect(record.isRegistered).toBe(true);
    expect(record.kolType).toBe('视频');
    expect(record.spuName).toBe('精华液');
    expect(record.contentCost).toBe(4000);
    expect(record.contentSettlement).toBe(5000);
    expect(record.adSpend).toBe(2000);
  });

  it('applies defaults when old columns are absent in new-format Excel', () => {
    const row = {
      '发布链接': VALID_LINK_2,
      '内容方向': '品宣',
      '笔记类型': '图文',
      '资源含税成本价': 3000,
      '资源含税售价': 4000,
    };

    const buffer = createExcelBuffer([row]);
    const result = parseNoteBaseExcel(buffer);

    expect(result.records).toHaveLength(1);
    const record = result.records[0];

    // Req 9.2
    expect(record.kolNickName).toBeNull();
    expect(record.kolFanNum).toBe(0);
    // Req 9.3
    expect(record.isRegistered).toBe(false);
    // Req 9.4
    expect(record.spuName).toBeNull();
    // Req 9.5
    expect(record.adSpend).toBe(0);
  });
});

// ─── 3. Mixed scenario ───

describe('NoteBase parser - mixed scenarios', () => {
  it('parses multiple rows with varying column presence', () => {
    // All rows share the same headers (from the first row's keys),
    // but some cells are empty, simulating mixed data
    const rows = [
      {
        '发布链接': VALID_LINK_1,
        '内容方向': '种草',
        '笔记类型': '图文',
        '资源含税成本价': 5000,
        '资源含税售价': 6500,
        '内容形式': '报备',
        '曝光量': 50000,
        '阅读量': 30000,
        '博主昵称': '达人A',
      },
      {
        '发布链接': VALID_LINK_2,
        '内容方向': '测评',
        '笔记类型': '视频',
        '资源含税成本价': 3000,
        '资源含税售价': 4000,
        '内容形式': '',       // empty → null
        '曝光量': '',         // empty → not added to displayMetrics
        '阅读量': '',         // empty → not added to displayMetrics
        '博主昵称': '',       // empty → null
      },
      {
        '发布链接': VALID_LINK_3,
        '内容方向': '品宣',
        '笔记类型': '图文',
        '资源含税成本价': 10000,
        '资源含税售价': 12000,
        '内容形式': '非报备',
        '曝光量': 100000,
        '阅读量': 80000,
        '博主昵称': '达人C',
      },
    ];

    const buffer = createExcelBuffer(rows);
    const result = parseNoteBaseExcel(buffer);

    expect(result.records).toHaveLength(3);
    expect(result.skippedRows).toBe(0);

    // Row 1: full data
    expect(result.records[0].contentDirection).toBe('种草');
    expect(result.records[0].cooperationForm).toBe('报备');
    expect(result.records[0].displayMetrics?.impNum).toBe(50000);
    expect(result.records[0].kolNickName).toBe('达人A');

    // Row 2: sparse data (empty optional columns)
    expect(result.records[1].contentDirection).toBe('测评');
    expect(result.records[1].cooperationForm).toBeNull();
    expect(result.records[1].displayMetrics).toBeUndefined();
    expect(result.records[1].kolNickName).toBeNull();

    // Row 3: full data
    expect(result.records[2].contentDirection).toBe('品宣');
    expect(result.records[2].cooperationForm).toBe('非报备');
    expect(result.records[2].displayMetrics?.impNum).toBe(100000);
    expect(result.records[2].kolNickName).toBe('达人C');
  });

  it('skips rows with empty noteLink and counts them', () => {
    const rows = [
      {
        '发布链接': VALID_LINK_1,
        '内容方向': '种草',
        '笔记类型': '图文',
        '资源含税成本价': 5000,
        '资源含税售价': 6500,
      },
      {
        '发布链接': '',  // empty → skip
        '内容方向': '测评',
        '笔记类型': '视频',
        '资源含税成本价': 3000,
        '资源含税售价': 4000,
      },
      {
        '发布链接': VALID_LINK_2,
        '内容方向': '品宣',
        '笔记类型': '图文',
        '资源含税成本价': 10000,
        '资源含税售价': 12000,
      },
    ];

    const buffer = createExcelBuffer(rows);
    const result = parseNoteBaseExcel(buffer);

    expect(result.records).toHaveLength(2);
    expect(result.skippedRows).toBe(1);
  });
});

// ─── 4. Header row detection (reference tests) ───

describe('NoteBase parser - header row detection reference (Req 10.1–10.3)', () => {
  /**
   * Detailed header detection tests are in note-base-parser-header-detection.test.ts.
   * These are minimal reference tests to confirm the feature works end-to-end.
   */

  it('uses row 1 as header when it contains known columns (Req 10.1)', () => {
    const rows = [{ '发布链接': VALID_LINK_1, '内容方向': '种草', '笔记类型': '图文', '资源含税成本价': 5000, '资源含税售价': 6000 }];
    const buffer = createExcelBuffer(rows);
    const result = parseNoteBaseExcel(buffer);

    expect(result.records).toHaveLength(1);
    expect(result.records[0].contentCost).toBe(5000);
  });

  it('uses row 2 as header when row 1 is a title row (Req 10.2)', () => {
    const aoa = [
      ['小红书投放底表 - 2024年Q2', '', '', '', ''],
      ['发布链接', '内容方向', '笔记类型', '资源含税成本价', '资源含税售价'],
      [VALID_LINK_1, '种草', '图文', 5000, 6000],
    ];
    const buffer = createExcelBufferFromAoA(aoa);
    const result = parseNoteBaseExcel(buffer);

    expect(result.records).toHaveLength(1);
    expect(result.records[0].noteLink).toBe(VALID_LINK_1);
  });

  it('returns error when neither row 1 nor row 2 has known columns (Req 10.3)', () => {
    const aoa = [
      ['项目总结', '日期', '责任人'],
      ['第一阶段', '2024-01', '张三'],
      ['数据1', '数据2', '数据3'],
    ];
    const buffer = createExcelBufferFromAoA(aoa);
    const result = parseNoteBaseExcel(buffer);

    expect(result.records).toHaveLength(0);
    expect(result.warnings[0]).toContain('未识别到有效表头');
  });
});
