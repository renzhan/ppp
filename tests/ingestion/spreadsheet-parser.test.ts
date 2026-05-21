import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { SpreadsheetParserImpl } from '../../src/ingestion/spreadsheet-parser';

function createXlsxBuffer(sheets: Record<string, unknown[][]>): Buffer {
  const workbook = XLSX.utils.book_new();
  for (const [name, data] of Object.entries(sheets)) {
    const sheet = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, sheet, name);
  }
  return Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
}

function createCsvBuffer(data: unknown[][]): Buffer {
  const sheet = XLSX.utils.aoa_to_sheet(data);
  const csv = XLSX.utils.sheet_to_csv(sheet);
  return Buffer.from(csv, 'utf-8');
}

describe('SpreadsheetParserImpl', () => {
  const parser = new SpreadsheetParserImpl();

  describe('parseLingxiSheet', () => {
    describe('AIPS data parsing', () => {
      it('parses valid AIPS data from xlsx with named sheet', () => {
        const buffer = createXlsxBuffer({
          'AIPS人群': [
            ['awareness', 'interest', 'purchase', 'share', 'penetration_rate', 'flow_rates'],
            [50000, 30000, 10000, 5000, 0.15, '{"A_to_I": 0.6, "I_to_P": 0.33}'],
          ],
        });

        const result = parser.parseLingxiSheet(buffer, 'xlsx');
        expect(result.data.aips).toBeDefined();
        expect(result.data.aips!.awareness).toBe(50000);
        expect(result.data.aips!.interest).toBe(30000);
        expect(result.data.aips!.purchase).toBe(10000);
        expect(result.data.aips!.share).toBe(5000);
        expect(result.data.aips!.penetrationRate).toBe(0.15);
        expect(result.data.aips!.flowRates).toEqual({ A_to_I: 0.6, I_to_P: 0.33 });
        expect(result.errors).toHaveLength(0);
      });

      it('handles missing non-critical AIPS fields with defaults', () => {
        const buffer = createXlsxBuffer({
          'AIPS': [
            ['awareness'],
            [100000],
          ],
        });

        const result = parser.parseLingxiSheet(buffer, 'xlsx');
        expect(result.data.aips).toBeDefined();
        expect(result.data.aips!.awareness).toBe(100000);
        expect(result.data.aips!.interest).toBe(0);
        expect(result.data.aips!.purchase).toBe(0);
        expect(result.data.aips!.share).toBe(0);
        expect(result.data.aips!.penetrationRate).toBe(0);
        expect(result.data.aips!.flowRates).toEqual({});
      });

      it('returns error when awareness value is not numeric', () => {
        const buffer = createXlsxBuffer({
          'AIPS': [
            ['awareness', 'interest'],
            ['invalid', 30000],
          ],
        });

        const result = parser.parseLingxiSheet(buffer, 'xlsx');
        expect(result.data.aips).toBeUndefined();
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0].message).toContain('awareness');
      });
    });

    describe('Brand ranking parsing', () => {
      it('parses valid brand ranking data', () => {
        const buffer = createXlsxBuffer({
          '品牌排名': [
            ['brand_name', 'rank', 'category', 'period'],
            ['TestBrand', 3, '美妆', '2024-Q1'],
          ],
        });

        const result = parser.parseLingxiSheet(buffer, 'xlsx');
        expect(result.data.brandRanking).toBeDefined();
        expect(result.data.brandRanking!.brandName).toBe('TestBrand');
        expect(result.data.brandRanking!.rank).toBe(3);
        expect(result.data.brandRanking!.category).toBe('美妆');
        expect(result.data.brandRanking!.period).toBe('2024-Q1');
      });

      it('returns error when brand_name is missing', () => {
        const buffer = createXlsxBuffer({
          '品牌排名': [
            ['brand_name', 'rank'],
            [null, 3],
          ],
        });

        const result = parser.parseLingxiSheet(buffer, 'xlsx');
        expect(result.data.brandRanking).toBeUndefined();
        expect(result.errors.some(e => e.message.includes('Brand name'))).toBe(true);
      });
    });

    describe('SOC/SOV parsing', () => {
      it('parses valid SOC/SOV data', () => {
        const buffer = createXlsxBuffer({
          'SOC_SOV': [
            ['soc', 'sov', 'category', 'period'],
            [0.25, 0.30, '护肤', '2024-01'],
          ],
        });

        const result = parser.parseLingxiSheet(buffer, 'xlsx');
        expect(result.data.socSov).toBeDefined();
        expect(result.data.socSov!.soc).toBe(0.25);
        expect(result.data.socSov!.sov).toBe(0.30);
        expect(result.data.socSov!.category).toBe('护肤');
      });

      it('supports partial SOC/SOV (only soc present)', () => {
        const buffer = createXlsxBuffer({
          'SOC声量': [
            ['soc', 'category'],
            [0.18, '彩妆'],
          ],
        });

        const result = parser.parseLingxiSheet(buffer, 'xlsx');
        expect(result.data.socSov).toBeDefined();
        expect(result.data.socSov!.soc).toBe(0.18);
        expect(result.data.socSov!.sov).toBe(0);
      });
    });

    describe('SPU ranking parsing', () => {
      it('parses valid SPU ranking data', () => {
        const buffer = createXlsxBuffer({
          'SPU排名': [
            ['spu_name', 'rank', 'category', 'period'],
            ['精华液A', 1, '精华', '2024-Q1'],
          ],
        });

        const result = parser.parseLingxiSheet(buffer, 'xlsx');
        expect(result.data.spuRanking).toBeDefined();
        expect(result.data.spuRanking!.spuName).toBe('精华液A');
        expect(result.data.spuRanking!.rank).toBe(1);
      });
    });

    describe('Multi-sheet xlsx', () => {
      it('parses all data types from multiple sheets', () => {
        const buffer = createXlsxBuffer({
          'AIPS人群': [
            ['awareness', 'interest', 'purchase', 'share', 'penetration_rate'],
            [80000, 40000, 15000, 8000, 0.2],
          ],
          '品牌排名': [
            ['brand_name', 'rank', 'category', 'period'],
            ['BrandX', 2, '美妆', '2024-Q2'],
          ],
          'SOC_SOV': [
            ['soc', 'sov', 'category', 'period'],
            [0.3, 0.35, '美妆', '2024-Q2'],
          ],
          'SPU产品排名': [
            ['spu_name', 'rank', 'category', 'period'],
            ['面霜B', 5, '面霜', '2024-Q2'],
          ],
        });

        const result = parser.parseLingxiSheet(buffer, 'xlsx');
        expect(result.data.aips).toBeDefined();
        expect(result.data.brandRanking).toBeDefined();
        expect(result.data.socSov).toBeDefined();
        expect(result.data.spuRanking).toBeDefined();
        expect(result.errors).toHaveLength(0);
      });
    });

    describe('CSV format', () => {
      it('parses AIPS data from CSV', () => {
        const buffer = createCsvBuffer([
          ['awareness', 'interest', 'purchase', 'share', 'penetration_rate'],
          [60000, 35000, 12000, 6000, 0.18],
        ]);

        const result = parser.parseLingxiSheet(buffer, 'csv');
        expect(result.data.aips).toBeDefined();
        expect(result.data.aips!.awareness).toBe(60000);
      });
    });

    describe('Error handling', () => {
      it('handles empty file gracefully', () => {
        const buffer = createXlsxBuffer({ Sheet1: [] });
        const result = parser.parseLingxiSheet(buffer, 'xlsx');
        expect(result.warnings.length).toBeGreaterThan(0);
      });

      it('handles invalid buffer', () => {
        // Use a truly corrupted buffer that xlsx cannot parse at all
        const buffer = Buffer.alloc(4, 0xFF);
        const result = parser.parseLingxiSheet(buffer, 'xlsx');
        // Either errors or warnings should be present for unreadable/empty data
        expect(result.errors.length + result.warnings.length).toBeGreaterThan(0);
      });
    });
  });

  describe('parseAnnotationSheet', () => {
    describe('Valid annotation parsing', () => {
      it('parses complete annotation data', () => {
        const buffer = createXlsxBuffer({
          Sheet1: [
            ['note_id', 'content_direction', 'account_type', 'kol_type', 'launch_phase', 'is_underwater'],
            ['note001', '种草', '美妆博主', '头部KOL', '预热期', 'true'],
            ['note002', '测评', '生活博主', '腰部KOL', '爆发期', 'false'],
            ['note003', '教程', '专业博主', 'KOC', '长尾期', '否'],
          ],
        });

        const result = parser.parseAnnotationSheet(buffer, 'xlsx');
        expect(result.data).toHaveLength(3);
        expect(result.data[0]).toEqual({
          noteId: 'note001',
          contentDirection: '种草',
          accountType: '美妆博主',
          kolType: '头部KOL',
          launchPhase: '预热期',
          isUnderwater: true,
        });
        expect(result.data[1].isUnderwater).toBe(false);
        expect(result.data[2].isUnderwater).toBe(false);
        expect(result.errors).toHaveLength(0);
      });

      it('supports Chinese column headers', () => {
        const buffer = createXlsxBuffer({
          Sheet1: [
            ['笔记ID', '内容方向', '账号类型', 'KOL类型', '投放阶段', '水下标记'],
            ['n001', '日常', '素人', 'KOC', '测试期', '是'],
          ],
        });

        const result = parser.parseAnnotationSheet(buffer, 'xlsx');
        expect(result.data).toHaveLength(1);
        expect(result.data[0].noteId).toBe('n001');
        expect(result.data[0].isUnderwater).toBe(true);
      });
    });

    describe('Partial import support', () => {
      it('imports rows with missing non-critical fields', () => {
        const buffer = createXlsxBuffer({
          Sheet1: [
            ['note_id', 'content_direction'],
            ['note001', '种草'],
            ['note002', null],
          ],
        });

        const result = parser.parseAnnotationSheet(buffer, 'xlsx');
        expect(result.data).toHaveLength(2);
        expect(result.data[0].contentDirection).toBe('种草');
        expect(result.data[1].contentDirection).toBe('');
        expect(result.data[0].accountType).toBe('');
        expect(result.data[0].kolType).toBe('');
        expect(result.data[0].launchPhase).toBe('');
        expect(result.data[0].isUnderwater).toBe(false);
        // Should have warnings about missing columns
        expect(result.warnings.length).toBeGreaterThan(0);
      });

      it('skips rows with missing note_id but continues parsing', () => {
        const buffer = createXlsxBuffer({
          Sheet1: [
            ['note_id', 'content_direction', 'account_type', 'kol_type', 'launch_phase', 'is_underwater'],
            ['note001', '种草', '美妆', '头部', '预热', 'false'],
            [null, '测评', '生活', '腰部', '爆发', 'true'],
            ['note003', '教程', '专业', 'KOC', '长尾', 'false'],
          ],
        });

        const result = parser.parseAnnotationSheet(buffer, 'xlsx');
        expect(result.data).toHaveLength(2);
        expect(result.data[0].noteId).toBe('note001');
        expect(result.data[1].noteId).toBe('note003');
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0].message).toContain('note_id');
      });
    });

    describe('Field validation', () => {
      it('reports error with row/column location for missing note_id', () => {
        const buffer = createXlsxBuffer({
          Sheet1: [
            ['note_id', 'content_direction'],
            ['', '种草'],
          ],
        });

        const result = parser.parseAnnotationSheet(buffer, 'xlsx');
        expect(result.data).toHaveLength(0);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0].row).toBe(2);
        expect(result.errors[0].column).toBe('A');
        expect(result.errors[0].message).toContain('note_id');
      });

      it('warns about unparseable is_underwater values', () => {
        const buffer = createXlsxBuffer({
          Sheet1: [
            ['note_id', 'is_underwater'],
            ['note001', 'maybe'],
          ],
        });

        const result = parser.parseAnnotationSheet(buffer, 'xlsx');
        expect(result.data).toHaveLength(1);
        expect(result.data[0].isUnderwater).toBe(false);
        expect(result.warnings.some(w => w.message.includes('could not be parsed'))).toBe(true);
      });

      it('returns error when note_id column is completely missing', () => {
        const buffer = createXlsxBuffer({
          Sheet1: [
            ['content_direction', 'account_type'],
            ['种草', '美妆'],
          ],
        });

        const result = parser.parseAnnotationSheet(buffer, 'xlsx');
        expect(result.data).toHaveLength(0);
        expect(result.errors.some(e => e.message.includes('note_id'))).toBe(true);
      });
    });

    describe('CSV format', () => {
      it('parses annotations from CSV', () => {
        const buffer = createCsvBuffer([
          ['note_id', 'content_direction', 'account_type', 'kol_type', 'launch_phase', 'is_underwater'],
          ['csv001', '种草', '美妆博主', '头部', '预热期', '1'],
          ['csv002', '测评', '生活博主', '腰部', '爆发期', '0'],
        ]);

        const result = parser.parseAnnotationSheet(buffer, 'csv');
        expect(result.data).toHaveLength(2);
        expect(result.data[0].noteId).toBe('csv001');
        expect(result.data[0].isUnderwater).toBe(true);
        expect(result.data[1].isUnderwater).toBe(false);
      });
    });

    describe('Error handling', () => {
      it('handles invalid buffer', () => {
        const buffer = Buffer.from('not valid');
        const result = parser.parseAnnotationSheet(buffer, 'xlsx');
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('handles file with only headers', () => {
        const buffer = createXlsxBuffer({
          Sheet1: [
            ['note_id', 'content_direction'],
          ],
        });

        const result = parser.parseAnnotationSheet(buffer, 'xlsx');
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0].message).toContain('at least a header row and one data row');
      });

      it('skips completely empty rows', () => {
        const buffer = createXlsxBuffer({
          Sheet1: [
            ['note_id', 'content_direction'],
            ['note001', '种草'],
            [null, null],
            ['note002', '测评'],
          ],
        });

        const result = parser.parseAnnotationSheet(buffer, 'xlsx');
        expect(result.data).toHaveLength(2);
      });
    });
  });
});
