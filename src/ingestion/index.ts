/**
 * Data Ingestion Module
 * Orchestrates the full data ingestion pipeline:
 * - API path: Paichacha API fetch → (currency conversion handled internally by client) → persistence
 * - Spreadsheet path: file parse → validation → persistence
 *
 * Exposes a unified ingestion interface for both API and spreadsheet paths.
 */

import { PaichachaClient } from './paichacha-client.js';
import { PrismaDataPersistenceService } from './persistence-service.js';
import { SpreadsheetUploadService } from './spreadsheet-upload.js';
import { envConfig } from '../config/env.js';
import type { PugongyingNote, JuguangNote, LingxiData, CommentData, QianguaStatsData, QianguaHotNotePublishData } from '../shared/types.js';

// ---- Types ----

/**
 * Result of an API ingestion operation
 */
export interface APIIngestionResult {
  pugongyingNotes: PugongyingNote[];
  juguangNotes: JuguangNote[];
  errors: string[];
}

// ---- DataIngestionService ----

/**
 * Orchestrates the full API ingestion flow:
 * 1. Fetch pugongying + juguang data from Paichacha API
 *    (PaichachaClient handles currency conversion internally)
 * 2. Persist normalized data to PostgreSQL
 */
export class DataIngestionService {
  private readonly paichachaClient: PaichachaClient;
  private readonly persistenceService: PrismaDataPersistenceService;

  constructor(
    paichachaClient?: PaichachaClient,
    persistenceService?: PrismaDataPersistenceService,
  ) {
    const pgyConfig = {
      noteBaseUrl: envConfig.PUGONGYING_NOTE_BASE_URL,
      commentBaseUrl: envConfig.PUGONGYING_COMMENT_BASE_URL,
      apiKey: envConfig.PUGONGYING_API_KEY,
    };
    const juguangConfig = {
      baseUrl: envConfig.JUGUANG_BASE_URL,
      apiKey: envConfig.JUGUANG_API_KEY,
    };
    const lingxiConfig = {
      baseUrl: envConfig.LINGXI_BASE_URL,
      apiKey: envConfig.LINGXI_API_KEY,
    };
    const qianguaConfig = {
      baseUrl: envConfig.QIANGUA_BASE_URL,
      apiKey: envConfig.QIANGUA_API_KEY,
    };
    this.paichachaClient = paichachaClient ?? new PaichachaClient(
      envConfig.PAICHACHA_BASE_URL,
      envConfig.PAICHACHA_API_KEY,
      undefined,
      pgyConfig,
      juguangConfig,
      lingxiConfig,
      qianguaConfig,
    );
    this.persistenceService = persistenceService ?? new PrismaDataPersistenceService();
  }

  /**
   * Ingest data from Pugongying & Juguang APIs for a given project.
   * Fetches both pugongying and juguang data, then persists to DB.
   *
   * @param projectId - The project to associate data with
   * @param noteIds - The note IDs to fetch data for
   * @returns Result containing fetched data and any errors encountered
   */
  async ingestFromAPI(projectId: string, noteIds: string[]): Promise<APIIngestionResult> {

      
    // ---- 测试项目配置（后续由前端项目配置替换）----
    const TEST_PROJECT = {
      brandName: '爷爷不泡茶',
      keyword: '酸奶',
      taxonomyNames: ['方便速食'],
      juguangBrandName: '奈雪的茶-派芽1',
      // start=项目开始日期, end=项目结束日期, campaignStart=投放开始日期
      dateRange: { start: '2026-04-01', end: '2026-05-27' },
      campaignStart: '2026-04-27',
      qianguaDays: 30,
    };

    const errors: string[] = [];
    let pugongyingNotes: PugongyingNote[] = [];
    let juguangNotes: JuguangNote[] = [];

    // Fetch pugongying data
    try {
      pugongyingNotes = await this.paichachaClient.fetchPugongyingData(noteIds);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`Failed to fetch pugongying data: ${message}`);
    }

    // Fetch juguang data
    try {
      juguangNotes = await this.paichachaClient.fetchJuguangData(
        TEST_PROJECT.juguangBrandName,
        TEST_PROJECT.dateRange.start,
        TEST_PROJECT.dateRange.end,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`Failed to fetch juguang data: ${message}`);
    }

    // Fetch lingxi data（参数后续由前端传入，当前写死联调用）
    let lingxiData: LingxiData | undefined;
    try {
      // 投后到今天，投前 = 投放前等长时段
      const cs = new Date(TEST_PROJECT.campaignStart);
      const today = new Date(); today.setHours(0,0,0,0);
      const duration = Math.ceil((today.getTime() - cs.getTime()) / 86400000);
      const preEnd = new Date(cs); preEnd.setDate(preEnd.getDate() - 1);
      const preStart = new Date(preEnd); preStart.setDate(preStart.getDate() - duration);
      const preStartDate = preStart.toISOString().slice(0, 10);
      const preEndDate   = preEnd.toISOString().slice(0, 10);
      const postEndDate = today.toISOString().slice(0,10);
      lingxiData = await this.paichachaClient.fetchLingxiData(
        TEST_PROJECT.brandName,
        TEST_PROJECT.keyword,
        TEST_PROJECT.campaignStart,  // 投后 start = 投放开始
        postEndDate,                  // 投后 end   = 今天
        TEST_PROJECT.taxonomyNames,
        preStartDate,
        preEndDate,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`Failed to fetch lingxi data: ${message}`);
    }

    // Fetch qiangua data（参数后续由前端传入，当前写死联调用）
    let qianguaStats: QianguaStatsData | undefined;
    let qianguaHotNotePublish: QianguaHotNotePublishData | undefined;
    try {
      const qianguaData = await this.paichachaClient.fetchQianguaData(
        TEST_PROJECT.brandName, TEST_PROJECT.qianguaDays,
      );
      qianguaStats = qianguaData.stats;
      qianguaHotNotePublish = qianguaData.hotNotePublish;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`Failed to fetch qiangua data: ${message}`);
    }

    // Merge: preserve isUnderwater / underwaterPrice from existing records
    if (pugongyingNotes.length > 0) {
      try {
        const existing = await this.persistenceService.findPugongyingNoteIds(projectId, pugongyingNotes.map((n) => n.noteId));
        const existingMap = new Map(existing.map((n) => [n.noteId, n]));
        for (const note of pugongyingNotes) {
          const exist = existingMap.get(note.noteId);
          if (exist) {
            note.isUnderwater = exist.isUnderwater;
            note.underwaterPrice = exist.underwaterPrice;
          }
        }
      } catch {
        // If lookup fails, proceed with API values (false / 0)
      }
    }

    // Persist successfully fetched data
    if (pugongyingNotes.length > 0) {
      try {
        await this.persistenceService.savePugongyingNotes(projectId, pugongyingNotes);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`Failed to persist pugongying data: ${message}`);
      }
    }

    if (juguangNotes.length > 0) {
      try {
        await this.persistenceService.saveJuguangData(projectId, juguangNotes);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`Failed to persist juguang data: ${message}`);
      }
    }

    if (lingxiData) {
      try {
        await this.persistenceService.saveLingxiData(projectId, lingxiData);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`Failed to persist lingxi data: ${message}`);
      }
    }

    if (qianguaStats && qianguaHotNotePublish) {
      try {
        await this.persistenceService.saveQianguaData(projectId, qianguaStats, qianguaHotNotePublish);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`Failed to persist qiangua data: ${message}`);
      }
    }

    return { pugongyingNotes, juguangNotes, errors };
  }

  /**
   * 评论数据采集（全量替换，用于舆情分析）
   * Phase 1 — 与 ingestFromAPI 平级，按需独立调用
   */
  async ingestComments(projectId: string, noteIds: string[]): Promise<{ count: number; errors: string[] }> {
    const errors: string[] = [];
    let commentData: CommentData[] = [];

    try {
      commentData = await this.paichachaClient.fetchCommentData(noteIds);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`Failed to fetch comment data: ${message}`);
    }

    if (commentData.length > 0) {
      try {
        await this.persistenceService.saveComments(projectId, commentData);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`Failed to persist comment data: ${message}`);
      }
    }

    return { count: commentData.length, errors };
  }
}

// ---- Re-exports ----

export { PaichachaClient } from './paichacha-client.js';
export type { IPaichachaClient } from './paichacha-client.js';
export { normalizeAmount } from './currency.js';
export { PrismaDataPersistenceService } from './persistence-service.js';
export type { DataPersistenceService } from './persistence-service.js';
export { SpreadsheetParserImpl } from './spreadsheet-parser.js';
export type { SpreadsheetParser, ParseResult, ParseError } from './spreadsheet-parser.js';
export { SpreadsheetUploadService } from './spreadsheet-upload.js';
export type { SpreadsheetUploadResult } from './spreadsheet-upload.js';
export { processLingxiScreenshot, detectImageMimeType, LOW_CONFIDENCE_THRESHOLD } from './ocr-service.js';
export type { OCRResult, OCRField, OCRProcessingResult, SupportedImageMimeType } from './ocr-service.js';
export { recognizeLingxiScreenshot, parsePlanDocumentVision } from './vision-document-parser.js';
export type { PageImage, PlanParseResult, VisionParseOptions } from './vision-document-parser.js';
export { LingxiClient } from './lingxi-client.js';
export type { LingxiClientConfig } from './lingxi-client.js';
export { convertDocumentToImages, convertToPdfViaLibreOffice, renderPdfToImages } from './document-converter.js';
export type { SupportedFormat, ConversionOptions, ConversionResult } from './document-converter.js';
