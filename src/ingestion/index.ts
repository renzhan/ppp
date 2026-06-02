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
import type { PugongyingNote, JuguangNote, LingxiData, CommentData } from '../shared/types.js';

// ---- Types ----

export interface BaseDataResult {
  pugongyingNotes: PugongyingNote[];
  errors: string[];
}

export interface JuguangDataResult {
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
   * 预爬基础数据：蒲公英笔记 + 灵犀（品牌资产）。
   * 每天凌晨定时调用，用户使用时数据已在库中。
   */
  async ingestBaseData(projectId: string): Promise<BaseDataResult> {
    const ctx = await this.resolveProjectContext(projectId);
    const errors: string[] = [];

    // 蒲公英笔记
    let pugongyingNotes: PugongyingNote[] = [];
    try {
      pugongyingNotes = await this.paichachaClient.fetchPugongyingData(ctx.noteIds);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`Failed to fetch pugongying data: ${message}`);
    }

    // 灵犀
    let lingxiData: LingxiData | undefined;
    try {
      lingxiData = await this.paichachaClient.fetchLingxiData(
        ctx.brandName,
        ctx.execStart,
        ctx.currentEnd,
        ctx.taxonomyNames,
        ctx.preStart,
        ctx.preEnd,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`Failed to fetch lingxi data: ${message}`);
    }

    // 保留已有水下/水下价格
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
        // lookup 失败就用 API 值
      }
    }

    // 持久化
    if (pugongyingNotes.length > 0) {
      try {
        await this.persistenceService.savePugongyingNotes(projectId, pugongyingNotes);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`Failed to persist pugongying data: ${message}`);
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

    return { pugongyingNotes, errors };
  }

  /**
   * 采集聚光投流数据（需广告主 ID，由用户手动触发）。
   */
  async ingestJuguangData(projectId: string, advertiserIds: number[]): Promise<JuguangDataResult> {
    const ctx = await this.resolveProjectContext(projectId);
    const errors: string[] = [];
    let juguangNotes: JuguangNote[] = [];

    try {
      juguangNotes = await this.paichachaClient.fetchJuguangData(advertiserIds, ctx.currentEnd, ctx.currentEnd);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`Failed to fetch juguang data: ${message}`);
    }

    if (juguangNotes.length > 0) {
      try {
        await this.persistenceService.saveJuguangData(projectId, juguangNotes);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`Failed to persist juguang data: ${message}`);
      }
    }

    return { juguangNotes, errors };
  }

  // ── private helpers ──

  /** 解析项目参数 + 计算统一日期，供各采集方法复用 */
  private async resolveProjectContext(projectId: string) {
    const noteIds = await this.persistenceService.findNoteIdsByProject(projectId);

    const project = await this.persistenceService.findProject(projectId);
    if (!project) throw new Error(`项目不存在: ${projectId}`);
    if (!project.executionStartDate) throw new Error(`项目缺少"开始执行日期"（executionStartDate），请先补充后再拉取数据`);

    const brandName = project.brand;
    const taxonomyNames = [project.category];

    // T-1（下午 4 点爬取昨天数据）
    const now = new Date();
    now.setDate(now.getDate() - 1);
    const dateBase = now.toISOString().slice(0, 10);

    const execStart = new Date(project.executionStartDate).toISOString().slice(0, 10);
    const execEnd = new Date(project.endDate).toISOString().slice(0, 10);

    const currentEnd = dateBase <= execEnd ? dateBase : execEnd;

    const periodDays = Math.ceil(
      (new Date(currentEnd).getTime() - new Date(execStart).getTime()) / 86400000
    );
    const preEnd = new Date(new Date(execStart).getTime() - 86400000).toISOString().slice(0, 10);
    const preStart = new Date(new Date(preEnd).getTime() - periodDays * 86400000 + 86400000).toISOString().slice(0, 10);

    return { noteIds, brandName, taxonomyNames, execStart, execEnd, currentEnd, preStart, preEnd };
  }

  /**
   * 评论数据采集（全量替换，用于舆情分析）。
   * Phase 1 — 与 ingestBaseData 平级，按需独立调用
   */
  async ingestComments(projectId: string, noteIds: string[]): Promise<{ count: number; errors: string[] }> {
    const ctx = await this.resolveProjectContext(projectId);
    const errors: string[] = [];
    let commentData: CommentData[] = [];

    try {
      commentData = await this.paichachaClient.fetchCommentData(noteIds, ctx.execStart, ctx.currentEnd);
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
