/**
 * Data Persistence Service
 * Handles saving ingested data to PostgreSQL via Prisma.
 * All multi-record operations use Prisma transactions for atomicity.
 */

import { prisma } from '../shared/db.js';
import type {
  PugongyingNote,
  JuguangNote,
  CommentData,
  QianguaStatsData,
  QianguaHotNotePublishData,
  LingxiData,
  BusinessAnnotation,
  ManualInputData,
  NoteBaseRecord,
} from '../shared/types.js';

/**
 * Interface for the data persistence service.
 * Provides methods to save various data types to PostgreSQL.
 */
export interface DataPersistenceService {
  /** Upsert pugongying notes (unique on project_id + note_id) */
  savePugongyingNotes(projectId: string, notes: PugongyingNote[]): Promise<void>;

  /** Insert juguang records (no unique constraint, uses createMany) */
  saveJuguangData(projectId: string, data: JuguangNote[], reviewConfigId?: string): Promise<void>;

  /** Insert lingxi records with data_type classification */
  saveLingxiData(projectId: string, data: LingxiData): Promise<void>;

  /** Upsert business annotations (unique on project_id + note_id) */
  saveAnnotations(projectId: string, annotations: BusinessAnnotation[]): Promise<void>;

  /** Insert manual input records (benchmark, KPI targets, brand search index, topic exposure) */
  saveManualInput(projectId: string, input: ManualInputData): Promise<void>;
  /** Upsert 笔记底表数据（业务底表Excel导入） */
  saveNoteBaseData(projectId: string, records: NoteBaseRecord[]): Promise<void>;
  /** 全量替换评论数据（先删后插，按 noteId 维度） */
  saveComments(projectId: string, data: CommentData[]): Promise<void>;
  /** 千瓜数据（按 dataType 分片存储） */
  saveQianguaData(projectId: string, stats: QianguaStatsData, hotNotePublish: QianguaHotNotePublishData): Promise<void>;
  /** 查找项目基础信息 */
  findProject(projectId: string): Promise<{ startDate: Date; endDate: Date; brand: string; category: string; executionStartDate: Date | null; lingxiAccountId: string | null; lingxiTaxonomyPath: string | null } | null>;
  /** 查找项目底表中的所有 noteId */
  findNoteIdsByProject(projectId: string): Promise<string[]>;
  /**
   * 从 note_base 回填数据到 notes 表（两步逻辑）。
   * Step 1: 对所有笔记（allNoteIds）拷贝必带字段（noteLink, contentDirection, noteType, kolPrice, serviceFee）。
   * Step 2: 对非官方合作笔记（missingNoteIds）额外拷贝 metrics 数据并标记 dataSource='note_base'。
   */
  fillNotesFromNoteBase(projectId: string, allNoteIds: string[], missingNoteIds: string[]): Promise<void>;
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
            coverImages: note.coverImages ?? undefined,
            videoPath: note.videoPath ?? undefined,
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
            coverImages: note.coverImages ?? undefined,
            videoPath: note.videoPath ?? undefined,
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
  async saveJuguangData(projectId: string, data: JuguangNote[], reviewConfigId?: string): Promise<void> {
    if (data.length === 0) return;

    // 分批插入，每批 200 条，避免事务超时
    const BATCH_SIZE = 200;
    const records = data.map((record) => ({
      projectId,
      reviewConfigId,
      time: record.time ?? null,
      advertiserId: record.advertiserId ?? null,
      noteId: record.noteId ?? null,
      placement: record.placement ?? null,
      targetsDetail: record.targetsDetail ?? null,
      keyword: record.keyword ?? null,
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
    }));

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      await prisma.juguangData.createMany({ data: batch });
    }
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

  /** 增量更新评论数据（upsert by commentId，API 未返回的标记 isActive=false） */
  async saveComments(projectId: string, data: CommentData[]): Promise<void> {
    if (data.length === 0) return;
    const noteIds = [...new Set(data.map((d) => d.noteId))];
    const incomingIds = new Set(data.map((d) => d.commentId));

    // 逐条 upsert，不使用事务避免超时问题
    for (const d of data) {
      await prisma.comment.upsert({
        where: { commentId: d.commentId },
        create: {
          projectId,
          noteId: d.noteId,
          commentId: d.commentId,
          parentCommentId: d.parentCommentId ?? null,
          nickname: d.nickname ?? null,
          content: d.content ?? null,
          likes: d.likes,
          commentTime: d.commentTime ?? null,
          isActive: true,
        },
        update: {
          likes: d.likes,
          content: d.content ?? null,
          commentTime: d.commentTime ?? null,
          isActive: true,
        },
      });
    }

    // Mark comments not in the new batch as inactive (deleted on platform)
    await prisma.comment.updateMany({
      where: { projectId, noteId: { in: noteIds }, commentId: { notIn: [...incomingIds] }, isActive: true },
      data: { isActive: false },
    });
  }

  async findNoteIdsByProject(projectId: string): Promise<string[]> {
    const rows = await prisma.noteBase.findMany({
      where: { projectId },
      select: { noteId: true },
      distinct: ['noteId'],
    });
    return rows.map((r) => r.noteId);
  }

  async findProject(projectId: string): Promise<{ startDate: Date; endDate: Date; brand: string; category: string; executionStartDate: Date | null; lingxiAccountId: string | null; lingxiTaxonomyPath: string | null } | null> {
    return prisma.project.findUnique({
      where: { id: projectId },
      select: { startDate: true, endDate: true, brand: true, category: true, executionStartDate: true, lingxiAccountId: true, lingxiTaxonomyPath: true },
    });
  }

  async saveQianguaData(
    projectId: string, stats: QianguaStatsData, hotNotePublish: QianguaHotNotePublishData,
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.qianguaData.createMany({
        data: [
          { projectId, dataType: 'stats', dataContent: stats as object },
          { projectId, dataType: 'hot_note_publish', dataContent: hotNotePublish as object },
        ],
      });
    });
  }

  /**
   * Upsert 笔记底表数据到 note_base 表。
   * 业务底表Excel导入的运营标注与费用数据，蒲公英API不提供这些字段。
   * Uses Prisma transaction with upsert for each record (unique on project_id + note_id).
   */
  async saveNoteBaseData(projectId: string, records: NoteBaseRecord[]): Promise<void> {
    if (records.length === 0) return;

    await prisma.$transaction(
      records.map((record) =>
        prisma.noteBase.upsert({
          where: {
            projectId_noteId: {
              projectId,
              noteId: record.noteId,
            },
          },
          create: {
            projectId,
            noteId: record.noteId,
            noteLink: record.noteLink ?? null,
            cooperationForm: record.cooperationForm ?? null,
            isRegistered: record.isRegistered,
            contentDirection: record.contentDirection ?? null,
            kolType: record.kolType ?? null,
            spuName: record.spuName ?? null,
            contentCost: record.contentCost,
            contentSettlement: record.contentSettlement,
            adSpend: record.adSpend,
            totalCost: record.totalCost,
          },
          update: {
            noteLink: record.noteLink ?? null,
            cooperationForm: record.cooperationForm ?? null,
            isRegistered: record.isRegistered,
            contentDirection: record.contentDirection ?? null,
            kolType: record.kolType ?? null,
            spuName: record.spuName ?? null,
            contentCost: record.contentCost,
            contentSettlement: record.contentSettlement,
            adSpend: record.adSpend,
            totalCost: record.totalCost,
          },
        })
      )
    );
  }

  /**
   * 从 note_base 回填数据到 notes 表（两步逻辑）。
   *
   * Step 1（所有笔记）: 对 allNoteIds 中的每条笔记，从 note_base 拷贝必带字段：
   *   noteLink, contentDirection, noteType(←kolType), kolPrice(←contentCost), serviceFee(←contentSettlement)
   *   upsert 时 update 仅覆盖这5个字段，不触碰 metric 字段或 dataSource。
   *
   * Step 2（仅非官方合作笔记）: 对 missingNoteIds 中的笔记，额外写入：
   *   totalCost, cooperationForm, impNum, readNum, engageNum, likeNum, favNum, cmtNum, shareNum
   *   并标记 dataSource = 'note_base'。
   */
  async fillNotesFromNoteBase(projectId: string, allNoteIds: string[], missingNoteIds: string[]): Promise<void> {
    if (allNoteIds.length === 0) return;

    // Fetch all relevant note_base records in one query
    const noteBaseRecords = await prisma.noteBase.findMany({
      where: { projectId, noteId: { in: allNoteIds } },
    });

    if (noteBaseRecords.length === 0) return;

    const noteBaseMap = new Map(noteBaseRecords.map((nb) => [nb.noteId, nb]));

    // Step 1: Upsert all notes with only the core fields from note_base
    const step1Ops = allNoteIds
      .filter((noteId) => noteBaseMap.has(noteId))
      .map((noteId) => {
        const nb = noteBaseMap.get(noteId)!;
        return prisma.note.upsert({
          where: {
            projectId_noteId: { projectId, noteId },
          },
          create: {
            projectId,
            noteId,
            noteLink: nb.noteLink ?? undefined,
            noteType: nb.kolType ?? undefined,
            kolPrice: nb.contentCost,
            serviceFee: nb.contentSettlement,
          },
          update: {
            // Only overwrite the core fields — do NOT touch metrics or dataSource
            noteLink: nb.noteLink ?? undefined,
            noteType: nb.kolType ?? undefined,
            kolPrice: nb.contentCost,
            serviceFee: nb.contentSettlement,
          },
        });
      });

    if (step1Ops.length > 0) {
      await prisma.$transaction(step1Ops);
    }

    // Step 2: For missing (non-official) notes, additionally write metrics + dataSource
    const step2NoteIds = missingNoteIds.filter((noteId) => noteBaseMap.has(noteId));
    if (step2NoteIds.length === 0) return;

    const step2Ops = step2NoteIds.map((noteId) => {
      const nb = noteBaseMap.get(noteId)!;
      const metrics = (nb.metrics as Record<string, number | string> | null) ?? {};

      return prisma.note.update({
        where: {
          projectId_noteId: { projectId, noteId },
        },
        data: {
          cooperateType: nb.cooperationForm ?? undefined,
          impNum: toInt(metrics.impNum),
          readNum: toInt(metrics.readNum),
          engageNum: toInt(metrics.engageNum),
          likeNum: toInt(metrics.likeNum),
          favNum: toInt(metrics.favNum),
          cmtNum: toInt(metrics.cmtNum),
          shareNum: toInt(metrics.shareNum),
          dataSource: 'note_base',
        },
      });
    });

    await prisma.$transaction(step2Ops);
  }
}

/** Helper: convert metric value to integer */
function toInt(val: unknown): number {
  if (val == null) return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : Math.round(n);
}
