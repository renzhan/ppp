/**
 * Property-Based Test: File type validation for project base table
 *
 * **Validates: Requirements 5.1, 5.7**
 *
 * Property 7: For any file with an extension other than .xlsx,
 * the project base table upload should reject the file.
 * Only files with .xlsx extension should be accepted.
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { isValidProjectBaseFile } from './file-validation';

describe('Property 7: File type validation for project base table', () => {
  it('should reject any file with a non-.xlsx extension', () => {
    /**
     * **Validates: Requirements 5.1, 5.7**
     *
     * For any arbitrary file name that does NOT end with .xlsx,
     * isValidProjectBaseFile should return false.
     */

    // Generator for non-.xlsx extensions
    const nonXlsxExtensions = fc.oneof(
      fc.constant('.csv'),
      fc.constant('.xls'),
      fc.constant('.pdf'),
      fc.constant('.doc'),
      fc.constant('.docx'),
      fc.constant('.txt'),
      fc.constant('.json'),
      fc.constant('.xml'),
      fc.constant('.pptx'),
      fc.constant('.xlsm'),
      fc.constant('.xlsb'),
      fc.constant('.ods'),
      // Random extensions that are not .xlsx
      fc.string({ minLength: 1, maxLength: 10 })
        .filter((s) => !s.toLowerCase().includes('xlsx'))
        .map((s) => `.${s.replace(/\./g, '')}`)
    );

    // Generator for base file names (without extension)
    const baseFileName = fc.string({ minLength: 1, maxLength: 50 }).filter(
      (s) => !s.includes('.xlsx') && !s.includes('.XLSX') && s.trim().length > 0
    );

    // Combine base name + non-xlsx extension
    const nonXlsxFileName = fc
      .tuple(baseFileName, nonXlsxExtensions)
      .map(([name, ext]) => `${name}${ext}`)
      .filter((f) => !f.toLowerCase().endsWith('.xlsx'));

    fc.assert(
      fc.property(nonXlsxFileName, (fileName) => {
        expect(isValidProjectBaseFile(fileName)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('should accept any file with a .xlsx extension', () => {
    /**
     * **Validates: Requirements 5.1, 5.7**
     *
     * For any arbitrary base file name followed by .xlsx,
     * isValidProjectBaseFile should return true.
     */

    // Generator for valid .xlsx file names
    const xlsxFileName = fc
      .string({ minLength: 1, maxLength: 50 })
      .filter((s) => s.trim().length > 0 && !s.includes('\0'))
      .map((baseName) => `${baseName}.xlsx`);

    fc.assert(
      fc.property(xlsxFileName, (fileName) => {
        expect(isValidProjectBaseFile(fileName)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('should accept .xlsx regardless of case (case-insensitive)', () => {
    /**
     * **Validates: Requirements 5.1, 5.7**
     *
     * The validation should be case-insensitive: .XLSX, .Xlsx, .xLsX
     * should all be accepted.
     */

    // Generator for .xlsx with mixed case
    const mixedCaseXlsx = fc
      .tuple(
        fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0),
        fc.constantFrom('.xlsx', '.XLSX', '.Xlsx', '.xLsX', '.XlSx', '.xlsX', '.xLSX')
      )
      .map(([name, ext]) => `${name}${ext}`);

    fc.assert(
      fc.property(mixedCaseXlsx, (fileName) => {
        expect(isValidProjectBaseFile(fileName)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });
});
