/**
 * Spreadsheet Upload Service
 * Orchestrates the spreadsheet ingestion flow:
 * - File parse (via SpreadsheetParserImpl) → validation → persistence (via PrismaDataPersistenceService)
 *
 * Supports both Lingxi platform data and business annotation uploads.
 */

import { SpreadsheetParserImpl } from './spreadsheet-parser.js';
import { PrismaDataPersistenceService } from './persistence-service.js';
import type { ParseError } from './spreadsheet-parser.js';
import type { BusinessAnnotation } from '../shared/types.js';

// ---- Types ----

/**
 * Result of a spreadsheet upload operation
 */
export interface SpreadsheetUploadResult<T> {
  data: T;
  errors: ParseError[];
  warnings: ParseError[];
  persisted: boolean;
}

// ---- SpreadsheetUploadService ----

/**
 * Orchestrates spreadsheet-based data ingestion:
 * 1. Parse file using SpreadsheetParserImpl
 * 2. Validate parsed data (errors from parser)
 * 3. Persist valid data to PostgreSQL
 */
export class SpreadsheetUploadService {
  private readonly parser: SpreadsheetParserImpl;
  private readonly persistenceService: PrismaDataPersistenceService;

  constructor(
    parser?: SpreadsheetParserImpl,
    persistenceService?: PrismaDataPersistenceService,
  ) {
    this.parser = parser ?? new SpreadsheetParserImpl();
    this.persistenceService = persistenceService ?? new PrismaDataPersistenceService();
  }

  /**
   * Upload and persist business annotations from a spreadsheet.
   * Parses the file, then persists valid annotations to the database.
   *
   * @param projectId - The project to associate data with
   * @param file - The spreadsheet file buffer
   * @param format - File format ('xlsx' or 'csv')
   * @returns Parse results including data, errors, warnings, and persistence status
   */
  async uploadAnnotations(
    projectId: string,
    file: Buffer,
    format: 'xlsx' | 'csv',
  ): Promise<SpreadsheetUploadResult<BusinessAnnotation[]>> {
    const parseResult = this.parser.parseAnnotationSheet(file, format);

    // Only persist if we have valid annotations
    const hasData = parseResult.data.length > 0;

    let persisted = false;

    if (hasData) {
      try {
        await this.persistenceService.saveAnnotations(projectId, parseResult.data);
        persisted = true;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        parseResult.errors.push({
          row: 0,
          column: 'A',
          message: `Failed to persist annotations: ${message}`,
          severity: 'error',
        });
      }
    }

    return {
      data: parseResult.data,
      errors: parseResult.errors,
      warnings: parseResult.warnings,
      persisted,
    };
  }
}
