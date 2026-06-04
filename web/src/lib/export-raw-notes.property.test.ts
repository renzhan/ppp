/**
 * Property-Based Test: Excel 导出数据完整性（Round-Trip）
 *
 * **Validates: Requirements 9.3**
 *
 * Property 7: For any valid RawPugongyingNote[] data array, converting it to
 * an Excel Buffer and then parsing it back should yield data consistent with
 * the original on key fields.
 *
 * Feature: project-note-base-management, Property 7: Excel 导出数据完整性（Round-Trip）
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import * as XLSX from 'xlsx';
import { rawNotesToExcelBuffer, generateExportFilename } from './export-raw-notes';
import { RawPugongyingNote } from './mock-raw-notes';

// Generator for hex strings (replaces hexaString which is unavailable in fast-check 4.x)
const hexStringArb = fc.stringMatching(/^[0-9a-f]{10,24}$/);

// Generator for RawPugongyingNote
const rawNoteArb: fc.Arbitrary<RawPugongyingNote> = fc.record({
  noteId: hexStringArb,
  noteTitle: fc.string({ minLength: 1, maxLength: 50 }),
  noteLink: hexStringArb.map((id) => `https://www.xiaohongshu.com/explore/${id}`),
  kolNickName: fc.string({ minLength: 2, maxLength: 20 }),
  kolId: fc.string({ minLength: 5, maxLength: 15 }),
  kolFanNum: fc.integer({ min: 1000, max: 10000000 }),
  noteType: fc.constantFrom('视频', '图文'),
  publishTime: fc.integer({
    min: new Date('2020-01-01').getTime(),
    max: new Date('2030-12-31').getTime(),
  }).map((ts) => new Date(ts).toISOString()),
  impNum: fc.integer({ min: 0, max: 10000000 }),
  readNum: fc.integer({ min: 0, max: 5000000 }),
  engageNum: fc.integer({ min: 0, max: 1000000 }),
  likeNum: fc.integer({ min: 0, max: 500000 }),
  favNum: fc.integer({ min: 0, max: 200000 }),
  cmtNum: fc.integer({ min: 0, max: 100000 }),
  shareNum: fc.integer({ min: 0, max: 50000 }),
  followNum: fc.integer({ min: 0, max: 10000 }),
  kolPrice: fc.integer({ min: 0, max: 100000 }),
  serviceFee: fc.integer({ min: 0, max: 50000 }),
  totalPlatformPrice: fc.integer({ min: 0, max: 150000 }),
  cpm: fc.double({ min: 0, max: 1000, noNaN: true }),
  cpe: fc.double({ min: 0, max: 100, noNaN: true }),
  engageRate: fc.double({ min: 0, max: 1, noNaN: true }),
});

describe('Feature: project-note-base-management, Property 7: Excel 导出数据完整性（Round-Trip）', () => {
  it('rawNotesToExcelBuffer produces data that round-trips back correctly on key fields', () => {
    fc.assert(
      fc.property(
        fc.array(rawNoteArb, { minLength: 1, maxLength: 10 }),
        (notes) => {
          // Step 1: Convert to Excel buffer
          const buffer = rawNotesToExcelBuffer(notes);

          // Step 2: Parse the buffer back
          const workbook = XLSX.read(buffer, { type: 'buffer' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

          // Step 3: Verify row count matches
          expect(rows.length).toBe(notes.length);

          // Step 4: Verify key fields match for each row
          for (let i = 0; i < notes.length; i++) {
            const original = notes[i];
            const parsed = rows[i];

            // String fields should match exactly
            expect(parsed['笔记ID']).toBe(original.noteId);
            expect(parsed['博主昵称']).toBe(original.kolNickName);
            expect(parsed['博主ID']).toBe(original.kolId);
            expect(parsed['笔记类型']).toBe(original.noteType);
            expect(parsed['笔记标题']).toBe(original.noteTitle);
            expect(parsed['笔记链接']).toBe(original.noteLink);
            expect(parsed['发布时间']).toBe(original.publishTime);

            // Integer fields should match exactly
            expect(parsed['粉丝量']).toBe(original.kolFanNum);
            expect(parsed['曝光量']).toBe(original.impNum);
            expect(parsed['阅读量']).toBe(original.readNum);
            expect(parsed['互动量']).toBe(original.engageNum);
            expect(parsed['点赞量']).toBe(original.likeNum);
            expect(parsed['收藏量']).toBe(original.favNum);
            expect(parsed['评论量']).toBe(original.cmtNum);
            expect(parsed['分享量']).toBe(original.shareNum);
            expect(parsed['关注量']).toBe(original.followNum);
            expect(parsed['达人报价']).toBe(original.kolPrice);
            expect(parsed['服务费']).toBe(original.serviceFee);
            expect(parsed['总平台价格']).toBe(original.totalPlatformPrice);

            // Floating point fields - use closeTo for precision tolerance
            expect(parsed['CPM']).toBeCloseTo(original.cpm, 10);
            expect(parsed['CPE']).toBeCloseTo(original.cpe, 10);
            expect(parsed['互动率']).toBeCloseTo(original.engageRate, 10);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Property-Based Test: 导出文件名格式正确
 *
 * **Validates: Requirements 9.4**
 *
 * Property 8: For any project name and date/time, generateExportFilename
 * should produce a string matching the format {projectName}_{YYYYMMDD_HHmmss}.xlsx
 *
 * Feature: project-note-base-management, Property 8: 导出文件名格式正确
 */
// Date generator constrained to 4-digit years for valid YYYYMMDD format
const validDateArb = fc.date({ min: new Date('2000-01-01'), max: new Date('2099-12-31') });

describe('Feature: project-note-base-management, Property 8: 导出文件名格式正确', () => {
  it('generated filename starts with the project name', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }).filter((s) => !s.includes('_')),
        validDateArb,
        (projectName, date) => {
          const filename = generateExportFilename(projectName, date);
          expect(filename.startsWith(projectName)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('generated filename ends with .xlsx', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }).filter((s) => !s.includes('_')),
        validDateArb,
        (projectName, date) => {
          const filename = generateExportFilename(projectName, date);
          expect(filename.endsWith('.xlsx')).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('generated filename matches the regex pattern ^.+_\\d{8}_\\d{6}\\.xlsx$', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }).filter((s) => !s.includes('_')),
        validDateArb,
        (projectName, date) => {
          const filename = generateExportFilename(projectName, date);
          const pattern = /^.+_\d{8}_\d{6}\.xlsx$/;
          expect(filename).toMatch(pattern);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('date portion correctly reflects the input date', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }).filter((s) => !s.includes('_')),
        validDateArb,
        (projectName, date) => {
          const filename = generateExportFilename(projectName, date);

          // Extract date/time portion between last two underscores before .xlsx
          const withoutExt = filename.replace(/\.xlsx$/, '');
          const parts = withoutExt.split('_');
          // The time part is the last element, the date part is second to last
          const timePart = parts[parts.length - 1];
          const datePart = parts[parts.length - 2];

          const expectedYear = String(date.getFullYear());
          const expectedMonth = String(date.getMonth() + 1).padStart(2, '0');
          const expectedDay = String(date.getDate()).padStart(2, '0');
          const expectedHours = String(date.getHours()).padStart(2, '0');
          const expectedMinutes = String(date.getMinutes()).padStart(2, '0');
          const expectedSeconds = String(date.getSeconds()).padStart(2, '0');

          expect(datePart).toBe(`${expectedYear}${expectedMonth}${expectedDay}`);
          expect(timePart).toBe(`${expectedHours}${expectedMinutes}${expectedSeconds}`);
        }
      ),
      { numRuns: 100 }
    );
  });
});
