/**
 * Unit tests for DataPersistenceService.
 * Tests use real PostgreSQL with transaction rollback for isolation.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../src/shared/db.js';
import { PrismaDataPersistenceService } from '../../src/ingestion/persistence-service.js';
import type {
  PugongyingNote,
  JuguangNote,
  LingxiData,
  BusinessAnnotation,
  ManualInputData,
} from '../../src/shared/types.js';

describe('PrismaDataPersistenceService', () => {
  const service = new PrismaDataPersistenceService();
  let testProjectId: string;

  beforeAll(async () => {
    // Create a test project to use for all tests
    const project = await prisma.project.create({
      data: {
        category: 'test-category',
        brand: 'test-brand',
        projectName: 'persistence-service-test',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-03-31'),
      },
    });
    testProjectId = project.id;
  });

  afterAll(async () => {
    // Clean up test data in reverse dependency order
    await prisma.manualInput.deleteMany({ where: { projectId: testProjectId } });
    await prisma.businessAnnotation.deleteMany({ where: { projectId: testProjectId } });
    await prisma.lingxiData.deleteMany({ where: { projectId: testProjectId } });
    await prisma.juguangData.deleteMany({ where: { projectId: testProjectId } });
    await prisma.note.deleteMany({ where: { projectId: testProjectId } });
    await prisma.project.delete({ where: { id: testProjectId } });
  });

  describe('savePugongyingNotes', () => {
    it('should insert new notes', async () => {
      const notes: PugongyingNote[] = [
        {
          noteId: 'test-note-001',
          brandUserName: 'TestBrand',
          spuName: 'TestSPU',
          kolNickName: 'TestKOL',
          kolId: 'kol-001',
          kolFanNum: 50000,
          noteType: 'image',
          noteLink: 'https://example.com/note/001',
          impNum: 10000,
          readNum: 5000,
          engageNum: 800,
          likeNum: 400,
          favNum: 200,
          cmtNum: 100,
          shareNum: 80,
          kolPrice: 5000,
          serviceFee: 500,
          totalPlatformPrice: 5500,
          heatImpNum: 2000,
          heatReadNum: 1000,
          isUnderwater: false,
          underwaterPrice: 0,
          components: [{ componentType: '正文组件', impressions: 1000, clicks: 100, conversions: 10 }],
        },
      ];

      await service.savePugongyingNotes(testProjectId, notes);

      const saved = await prisma.note.findUnique({
        where: { projectId_noteId: { projectId: testProjectId, noteId: 'test-note-001' } },
      });

      expect(saved).not.toBeNull();
      expect(saved!.brandUserName).toBe('TestBrand');
      expect(saved!.impNum).toBe(10000);
      expect(Number(saved!.kolPrice)).toBe(5000);
    });

    it('should upsert existing notes (update on conflict)', async () => {
      const notes: PugongyingNote[] = [
        {
          noteId: 'test-note-001',
          brandUserName: 'UpdatedBrand',
          spuName: 'UpdatedSPU',
          kolNickName: 'TestKOL',
          kolId: 'kol-001',
          kolFanNum: 60000,
          noteType: 'video',
          noteLink: 'https://example.com/note/001-updated',
          impNum: 20000,
          readNum: 10000,
          engageNum: 1600,
          likeNum: 800,
          favNum: 400,
          cmtNum: 200,
          shareNum: 160,
          kolPrice: 6000,
          serviceFee: 600,
          totalPlatformPrice: 6600,
          heatImpNum: 4000,
          heatReadNum: 2000,
          isUnderwater: false,
          underwaterPrice: 0,
        },
      ];

      await service.savePugongyingNotes(testProjectId, notes);

      const saved = await prisma.note.findUnique({
        where: { projectId_noteId: { projectId: testProjectId, noteId: 'test-note-001' } },
      });

      expect(saved).not.toBeNull();
      expect(saved!.brandUserName).toBe('UpdatedBrand');
      expect(saved!.impNum).toBe(20000);
      expect(saved!.noteType).toBe('video');
    });

    it('should handle empty notes array', async () => {
      await expect(service.savePugongyingNotes(testProjectId, [])).resolves.toBeUndefined();
    });
  });

  describe('saveJuguangData', () => {
    it('should insert juguang records', async () => {
      const data: JuguangNote[] = [
        {
          noteId: 'test-note-001',
          fee: 1500.50,
          impression: 50000,
          click: 2500,
          interaction: 800,
          iUserNum: 300,
          tiUserNum: 50,
          iUserPrice: 5.0,
          tiUserPrice: 30.0,
          searchCmtClick: 100,
          searchCmtAfterRead: 80,
          searchCmtAfterReadAvg: 4.5,
          searchCmtClickCvr: 0.8,
        },
        {
          fee: 800,
          impression: 30000,
          click: 1200,
          interaction: 400,
          iUserNum: 150,
          tiUserNum: 25,
          iUserPrice: 5.33,
          tiUserPrice: 32.0,
          searchCmtClick: 50,
          searchCmtAfterRead: 40,
          searchCmtAfterReadAvg: 3.2,
          searchCmtClickCvr: 0.75,
        },
      ];

      await service.saveJuguangData(testProjectId, data);

      const saved = await prisma.juguangData.findMany({
        where: { projectId: testProjectId },
      });

      expect(saved.length).toBeGreaterThanOrEqual(2);
      const withNote = saved.find((r) => r.noteId === 'test-note-001');
      expect(withNote).not.toBeNull();
      expect(Number(withNote!.fee)).toBeCloseTo(1500.50, 2);
      expect(withNote!.impression).toBe(50000);
    });

    it('should handle empty data array', async () => {
      await expect(service.saveJuguangData(testProjectId, [])).resolves.toBeUndefined();
    });
  });

  describe('saveLingxiData', () => {
    it('should insert lingxi records with data_type classification', async () => {
      const data: LingxiData = {
        aips: {
          awareness: 100000,
          interest: 50000,
          purchase: 10000,
          share: 5000,
          penetrationRate: 0.15,
          flowRates: { 'A->I': 0.5, 'I->P': 0.2, 'P->S': 0.5 },
        },
        brandRanking: {
          brandName: 'TestBrand',
          rank: 3,
          category: '美妆',
          period: '2024-Q1',
        },
        socSov: {
          soc: 12.5,
          sov: 8.3,
          category: '美妆',
          period: '2024-Q1',
        },
        spuRanking: {
          spuName: 'TestSPU',
          rank: 5,
          category: '美妆',
          period: '2024-Q1',
        },
      };

      await service.saveLingxiData(testProjectId, data);

      const saved = await prisma.lingxiData.findMany({
        where: { projectId: testProjectId },
      });

      expect(saved.length).toBe(4);

      const aipsRecord = saved.find((r) => r.dataType === 'aips');
      expect(aipsRecord).not.toBeNull();
      expect((aipsRecord!.dataContent as Record<string, unknown>).awareness).toBe(100000);

      const brandRecord = saved.find((r) => r.dataType === 'brand_ranking');
      expect(brandRecord).not.toBeNull();
      expect((brandRecord!.dataContent as Record<string, unknown>).rank).toBe(3);

      const socRecord = saved.find((r) => r.dataType === 'soc_sov');
      expect(socRecord).not.toBeNull();

      const spuRecord = saved.find((r) => r.dataType === 'spu_ranking');
      expect(spuRecord).not.toBeNull();
    });

    it('should handle partial lingxi data (only some fields present)', async () => {
      // Clean up previous lingxi data first
      await prisma.lingxiData.deleteMany({ where: { projectId: testProjectId } });

      const data: LingxiData = {
        aips: {
          awareness: 200000,
          interest: 100000,
          purchase: 20000,
          share: 10000,
          penetrationRate: 0.2,
          flowRates: { 'A->I': 0.5 },
        },
      };

      await service.saveLingxiData(testProjectId, data);

      const saved = await prisma.lingxiData.findMany({
        where: { projectId: testProjectId },
      });

      expect(saved.length).toBe(1);
      expect(saved[0].dataType).toBe('aips');
    });

    it('should handle empty lingxi data', async () => {
      await expect(service.saveLingxiData(testProjectId, {})).resolves.toBeUndefined();
    });
  });

  describe('saveAnnotations', () => {
    it('should insert new annotations', async () => {
      const annotations: BusinessAnnotation[] = [
        {
          noteId: 'test-note-001',
          contentDirection: '产品测评',
          accountType: '美妆博主',
          kolType: '垂类KOL',
          launchPhase: '预热期',
          isUnderwater: false,
        },
      ];

      await service.saveAnnotations(testProjectId, annotations);

      const saved = await prisma.businessAnnotation.findUnique({
        where: { projectId_noteId: { projectId: testProjectId, noteId: 'test-note-001' } },
      });

      expect(saved).not.toBeNull();
      expect(saved!.contentDirection).toBe('产品测评');
      expect(saved!.accountType).toBe('美妆博主');
    });

    it('should upsert existing annotations', async () => {
      const annotations: BusinessAnnotation[] = [
        {
          noteId: 'test-note-001',
          contentDirection: '种草分享',
          accountType: '生活博主',
          kolType: '泛类KOL',
          launchPhase: '爆发期',
          isUnderwater: true,
        },
      ];

      await service.saveAnnotations(testProjectId, annotations);

      const saved = await prisma.businessAnnotation.findUnique({
        where: { projectId_noteId: { projectId: testProjectId, noteId: 'test-note-001' } },
      });

      expect(saved).not.toBeNull();
      expect(saved!.contentDirection).toBe('种草分享');
      expect(saved!.isUnderwater).toBe(true);
    });

    it('should handle empty annotations array', async () => {
      await expect(service.saveAnnotations(testProjectId, [])).resolves.toBeUndefined();
    });
  });

  describe('saveManualInput', () => {
    it('should insert benchmark data', async () => {
      const input: ManualInputData = {
        inputType: 'benchmark',
        dataContent: { cpm: 25.5, cpc: 1.2, cpe: 3.5, ctr: 0.045 },
      };

      await service.saveManualInput(testProjectId, input);

      const saved = await prisma.manualInput.findMany({
        where: { projectId: testProjectId, inputType: 'benchmark' },
      });

      expect(saved.length).toBeGreaterThanOrEqual(1);
      const latest = saved[saved.length - 1];
      expect((latest.dataContent as Record<string, unknown>).cpm).toBe(25.5);
    });

    it('should insert kpi_target data', async () => {
      const input: ManualInputData = {
        inputType: 'kpi_target',
        dataContent: { impression: 500000, read: 200000, engagement: 50000, viralCount: 10 },
      };

      await service.saveManualInput(testProjectId, input);

      const saved = await prisma.manualInput.findMany({
        where: { projectId: testProjectId, inputType: 'kpi_target' },
      });

      expect(saved.length).toBeGreaterThanOrEqual(1);
    });

    it('should insert brand_search_index data', async () => {
      const input: ManualInputData = {
        inputType: 'brand_search_index',
        dataContent: { index: 1250, period: '2024-01' },
      };

      await service.saveManualInput(testProjectId, input);

      const saved = await prisma.manualInput.findMany({
        where: { projectId: testProjectId, inputType: 'brand_search_index' },
      });

      expect(saved.length).toBeGreaterThanOrEqual(1);
    });

    it('should insert topic_exposure data', async () => {
      const input: ManualInputData = {
        inputType: 'topic_exposure',
        dataContent: { topicName: '#TestTopic', exposure: 5000000 },
      };

      await service.saveManualInput(testProjectId, input);

      const saved = await prisma.manualInput.findMany({
        where: { projectId: testProjectId, inputType: 'topic_exposure' },
      });

      expect(saved.length).toBeGreaterThanOrEqual(1);
    });
  });
});
