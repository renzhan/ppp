/**
 * Unit tests for NoteBase parser backward compatibility (Task 7.3)
 *
 * Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5
 *
 * Verifies:
 * 1. Old column mappings (博主昵称, 博主粉丝量, etc.) are preserved in NOTE_BASE_COLUMN_MAP
 * 2. Default values are correctly applied when old columns are absent in new-format Excel
 */

import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import {
  parseNoteBaseExcel,
  NOTE_BASE_COLUMN_MAP,
} from '../note-base-parser';

// ─── Helpers ───

function createExcelBuffer(rows: Record<string, unknown>[], sheetName = '已发布达人'): Buffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

const VALID_NOTE_LINK = 'https://www.xiaohongshu.com/explore/abc123def456?xsec_token=test';

// ─── Tests ───

describe('NoteBase backward compatibility - old column mappings preserved (Req 9.1)', () => {
  it('NOTE_BASE_COLUMN_MAP contains all old header mappings', () => {
    // These are the old headers that must remain in the mapping
    const oldHeaders: Record<string, string> = {
      '博主昵称': 'kolNickName',
      '博主粉丝量': 'kolFanNum',
      '合作形式': 'cooperationForm',
      '是否报备': 'isRegistered',
      '达人类型': 'kolType',
      '对应SPU': 'spuName',
      '内容实际消耗金额': 'contentCost',
      '投流实际消耗': 'adSpend',
    };

    for (const [header, fieldName] of Object.entries(oldHeaders)) {
      expect(NOTE_BASE_COLUMN_MAP[header], `Missing mapping for "${header}"`).toBe(fieldName);
    }
  });

  it('parses old-format Excel with old headers correctly', () => {
    // Use ONLY old headers (plus required columns that share the same fields)
    // Note: '内容实际消耗金额' and '资源含税成本价' both map to contentCost;
    // when both are present, the last one encountered wins. Here we use only old headers
    // alongside the required new columns (which map to the same fields).
    const row = {
      '笔记链接': VALID_NOTE_LINK,
      '博主昵称': '测试博主',
      '博主粉丝量': 50000,
      '合作形式': '报备',
      '是否报备': '是',
      '达人类型': '图文',
      '对应SPU': '产品A',
      '内容实际消耗金额': 3000,
      '投流实际消耗': 1500,
      // Required columns (using their old aliases mapped to same fields)
      '内容方向': '种草',
      '内容实际结算金额': 6000,
    };

    const buffer = createExcelBuffer([row]);
    const result = parseNoteBaseExcel(buffer);

    expect(result.records.length).toBe(1);
    const record = result.records[0];
    expect(record.kolNickName).toBe('测试博主');
    expect(record.kolFanNum).toBe(50000);
    expect(record.cooperationForm).toBe('报备');
    expect(record.isRegistered).toBe(true);
    expect(record.kolType).toBe('图文');
    expect(record.spuName).toBe('产品A');
    expect(record.contentCost).toBe(3000);
    expect(record.adSpend).toBe(1500);
  });
});

describe('NoteBase backward compatibility - default values when old columns absent (Req 9.2–9.5)', () => {
  it('new-format Excel without old columns produces correct defaults', () => {
    // New-format Excel only has the 5 required columns + no old optional columns
    const row = {
      '发布链接': VALID_NOTE_LINK,
      '内容方向': '测评',
      '笔记类型': '视频',
      '资源含税成本价': 8000,
      '资源含税售价': 10000,
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
  });

  it('new-format Excel with some old columns mixes mapped and default values', () => {
    // Partial old columns: only 博主昵称 and 是否报备 present
    const row = {
      '发布链接': VALID_NOTE_LINK,
      '内容方向': '种草',
      '笔记类型': '图文',
      '资源含税成本价': 5000,
      '资源含税售价': 6000,
      '博主昵称': '部分旧格式博主',
      '是否报备': '否',
    };

    const buffer = createExcelBuffer([row]);
    const result = parseNoteBaseExcel(buffer);

    expect(result.records.length).toBe(1);
    const record = result.records[0];

    // Present old columns are correctly mapped
    expect(record.kolNickName).toBe('部分旧格式博主');
    expect(record.isRegistered).toBe(false);

    // Absent old columns get defaults
    expect(record.kolFanNum).toBe(0);
    expect(record.spuName).toBeNull();
    expect(record.adSpend).toBe(0);
  });

  it('cooperationForm defaults to null when old 合作形式 column is absent', () => {
    const row = {
      '发布链接': VALID_NOTE_LINK,
      '内容方向': '种草',
      '笔记类型': '图文',
      '资源含税成本价': 5000,
      '资源含税售价': 6000,
    };

    const buffer = createExcelBuffer([row]);
    const result = parseNoteBaseExcel(buffer);

    expect(result.records.length).toBe(1);
    expect(result.records[0].cooperationForm).toBeNull();
  });
});
