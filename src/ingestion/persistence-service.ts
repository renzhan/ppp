/**
 * Data Persistence Service
 * Handles saving ingested data to PostgreSQL via Prisma.
 * All multi-record operations use Prisma transactions for atomicity.
 */

import { prisma } from '../shared/db.js';
import type {
  PugongyingNote,
  JuguangNote,
  LingxiData,
  BusinessAnnotation,
  ManualInputData,
} from '../shared/types.js';

/**
 * Interface for the data persistence service.
 * Provides methods to save various data types to PostgreSQL.
 */
export interface DataPersistenceService {
  /** Upsert pugongying notes (unique on project_id + note_id) */
  savePugongyingNotes(projectId: string, notes: PugongyingNote[]): Promise<void>;

  /** Insert juguang records (no unique constraint, uses createMany) */
  saveJuguangData(projectId: string, data: JuguangNote[]): Promise<void>;

  /** Insert lingxi records with data_type classification */
  saveLingxiData(projectId: string, data: LingxiData): Promise<void>;

  /** Upsert business annotations (unique on project_id + note_id) */
  saveAnnotations(projectId: string, annotations: BusinessAnnotation[]): Promise<void>;

  /** Insert manual input records (benchmark, KPI targets, brand search index, topic exposure) */
  saveManualInput(projectId: string, input: ManualInputData): Promise<void>;
}

/**
 * Implementation of DataPersistenceService using Prisma.
 */
export class PrismaDataPersistenceService implements DataPersistenceService {
  /**
   * Look up existing notes for the given project and note IDs,
   * returning only fields that other data sources may have populated.
   */
  async findPugongyingNoteIds(
    projectId: string,
    noteIds: string[],
  ): Promise<{ noteId: string; isUnderwater: boolean; underwaterPrice: number }[]> {
    if (noteIds.length === 0) return [];
    const rows = await prisma.note.findMany({
      where: { projectId, noteId: { in: noteIds } },
      select: { noteId: true, isUnderwater: true, underwaterPrice: true },
    });
    return rows.map((r) => ({
      noteId: r.noteId,
      isUnderwater: r.isUnderwater,
      underwaterPrice: Number(r.underwaterPrice),
    }));
  }

  /**
   * Upsert pugongying notes to PostgreSQL.
   * Uses Prisma transaction with upsert for each note (unique on project_id + note_id).
   */
  async savePugongyingNotes(projectId: string, notes: PugongyingNote[]): Promise<void> {
    if (notes.length === 0) return;

    await prisma.$transaction(
      notes.map((note) =>
        prisma.note.upsert({
          where: {
            projectId_noteId: {
              projectId,
              noteId: note.noteId,
            },
          },
          create: {
            projectId,
            noteId: note.noteId,
            brandUserName: note.brandUserName,
            spuName: note.spuName,
            kolNickName: note.kolNickName,
            kolId: note.kolId,
            kolFanNum: note.kolFanNum,
            noteType: note.noteType,
            noteLink: note.noteLink,
            noteTitle: note.noteTitle ?? undefined,
            impNum: note.impNum,
            readNum: note.readNum,
            engageNum: note.engageNum,
            likeNum: note.likeNum,
            favNum: note.favNum,
            cmtNum: note.cmtNum,
            shareNum: note.shareNum,
            followNum: note.followNum,
            kolPrice: note.kolPrice,
            serviceFee: note.serviceFee,
            totalPlatformPrice: note.totalPlatformPrice,
            heatImpNum: note.heatImpNum,
            heatReadNum: note.heatReadNum,
            isUnderwater: note.isUnderwater,
            underwaterPrice: note.underwaterPrice,
            components: note.components ? JSON.parse(JSON.stringify(note.components)) : undefined,
            notePublishTime: note.notePublishTime ?? undefined,
            cooperateType: note.cooperateType ?? undefined,
            duration: note.duration ?? 0,
            originImpNum: note.originImpNum,
            originReadNum: note.originReadNum,
            promotionImpNum: note.promotionImpNum,
            promotionReadNum: note.promotionReadNum,
            readUv: note.readUv,
            engageRate: note.engageRate ?? undefined,
            readCost: note.readCost,
            engageCost: note.engageCost,
            avgViewTime: note.avgViewTime ?? undefined,
            videoPlay5sRate: note.videoPlay5sRate ?? undefined,
            picRead3sRate: note.picRead3sRate ?? undefined,
            finishRate: note.finishRate ?? undefined,
            cp: note.cp,
            cpRate: note.cpRate ?? undefined,
            cpcp: note.cpcp,
            orderId: note.orderId ?? undefined,
            effect: note.effect ?? undefined,
          },
          update: {
            brandUserName: note.brandUserName,
            spuName: note.spuName,
            kolNickName: note.kolNickName,
            kolId: note.kolId,
            kolFanNum: note.kolFanNum,
            noteType: note.noteType,
            noteLink: note.noteLink,
            noteTitle: note.noteTitle ?? undefined,
            impNum: note.impNum,
            readNum: note.readNum,
            engageNum: note.engageNum,
            likeNum: note.likeNum,
            favNum: note.favNum,
            cmtNum: note.cmtNum,
            shareNum: note.shareNum,
            kolPrice: note.kolPrice,
            serviceFee: note.serviceFee,
            totalPlatformPrice: note.totalPlatformPrice,
            heatImpNum: note.heatImpNum,
            heatReadNum: note.heatReadNum,
            isUnderwater: note.isUnderwater,
            underwaterPrice: note.underwaterPrice,
            components: note.components ? JSON.parse(JSON.stringify(note.components)) : undefined,
            notePublishTime: note.notePublishTime ?? undefined,
            cooperateType: note.cooperateType ?? undefined,
            duration: note.duration ?? 0,
            originImpNum: note.originImpNum,
            originReadNum: note.originReadNum,
            promotionImpNum: note.promotionImpNum,
            promotionReadNum: note.promotionReadNum,
            readUv: note.readUv,
            engageRate: note.engageRate ?? undefined,
            readCost: note.readCost,
            engageCost: note.engageCost,
            avgViewTime: note.avgViewTime ?? undefined,
            videoPlay5sRate: note.videoPlay5sRate ?? undefined,
            picRead3sRate: note.picRead3sRate ?? undefined,
            finishRate: note.finishRate ?? undefined,
            cp: note.cp,
            cpRate: note.cpRate ?? undefined,
            cpcp: note.cpcp,
            orderId: note.orderId ?? undefined,
            effect: note.effect ?? undefined,
          },
        })
      )
    );
  }

  /**
   * Insert juguang records to PostgreSQL.
   * Uses createMany since there's no unique constraint on juguang_data.
   */
  async saveJuguangData(projectId: string, data: JuguangNote[]): Promise<void> {
    if (data.length === 0) return;

    await prisma.$transaction(async (tx) => {
      await tx.juguangData.createMany({
        data: data.map((record) => ({
          projectId,
          noteId: record.noteId ?? null,
          fee: record.fee,
          impression: record.impression,
          click: record.click,
          interaction: record.interaction,
          iUserNum: record.iUserNum,
          tiUserNum: record.tiUserNum,
          iUserPrice: record.iUserPrice,
          tiUserPrice: record.tiUserPrice,
          searchCmtClick: record.searchCmtClick,
          searchCmtAfterRead: record.searchCmtAfterRead,
          searchCmtAfterReadAvg: record.searchCmtAfterReadAvg,
          searchCmtClickCvr: record.searchCmtClickCvr,
          acp: record.acp,
          cpm: record.cpm,
          cpi: record.cpi,
        })),
      });
    });
  }

  /**
   * Insert lingxi records with data_type classification.
   * Each field of LingxiData (aips, brandRanking, socSov, spuRanking) is stored
   * as a separate record with its data_type and data_content as JSON.
   */
  async saveLingxiData(projectId: string, data: LingxiData): Promise<void> {
    const records: { dataType: string; dataContent: unknown }[] = [];

    if (data.brand) {
      records.push({ dataType: 'brand', dataContent: data.brand });
    }
    if (data.spu) {
      for (const spu of data.spu) {
        records.push({ dataType: 'spu', dataContent: spu });
      }
    }
    if (data.keyword) {
      for (const kw of data.keyword) {
        records.push({ dataType: 'keyword', dataContent: kw });
      }
    }
    if (data.screenshot) {
      for (const ss of data.screenshot) {
        records.push({ dataType: 'screenshot', dataContent: ss });
      }
    }

    if (records.length === 0) return;

    await prisma.$transaction(async (tx) => {
      await tx.lingxiData.createMany({
        data: records.map((record) => ({
          projectId,
          dataType: record.dataType,
          dataContent: record.dataContent as object,
        })),
      });
    });
  }

  /**
   * Upsert business annotations to PostgreSQL.
   * Uses Prisma transaction with upsert for each annotation (unique on project_id + note_id).
   */
  async saveAnnotations(projectId: string, annotations: BusinessAnnotation[]): Promise<void> {
    if (annotations.length === 0) return;

    await prisma.$transaction(
      annotations.map((annotation) =>
        prisma.businessAnnotation.upsert({
          where: {
            projectId_noteId: {
              projectId,
              noteId: annotation.noteId,
            },
          },
          create: {
            projectId,
            noteId: annotation.noteId,
            contentDirection: annotation.contentDirection,
            accountType: annotation.accountType,
            kolType: annotation.kolType,
            launchPhase: annotation.launchPhase,
            isUnderwater: annotation.isUnderwater,
          },
          update: {
            contentDirection: annotation.contentDirection,
            accountType: annotation.accountType,
            kolType: annotation.kolType,
            launchPhase: annotation.launchPhase,
            isUnderwater: annotation.isUnderwater,
          },
        })
      )
    );
  }

  /**
   * Insert manual input records to PostgreSQL.
   * Stores with input_type classification (benchmark, kpi_target, brand_search_index, topic_exposure).
   */
  async saveManualInput(projectId: string, input: ManualInputData): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.manualInput.create({
        data: {
          projectId,
          inputType: input.inputType,
          dataContent: input.dataContent as object,
        },
      });
    });
  }
}
