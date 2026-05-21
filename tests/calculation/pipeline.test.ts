/**
 * Tests for the calculation pipeline module.
 * Validates that the pipeline exports are correctly wired and function signatures match.
 */

import { describe, it, expect, vi } from 'vitest';
import { runCalculationPipeline, onEngagementConfigChange } from '../../src/calculation/pipeline.js';

// Mock the prisma client to avoid real DB calls in unit tests
vi.mock('../../src/shared/db.js', () => {
  const mockProject = {
    id: 'test-project-id',
    category: '美妆',
    brand: 'TestBrand',
    projectName: 'Test Project',
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-03-31'),
    engagementConfig: { includeShare: true, includeFollow: true },
    cooperationPolicy: { defaultDiscount: 0.9, specialRules: [] },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockNotes = [
    {
      id: 'note-uuid-1',
      projectId: 'test-project-id',
      noteId: 'note-001',
      brandUserName: 'brand1',
      spuName: 'SPU1',
      kolNickName: 'KOL1',
      kolId: 'kol-001',
      kolFanNum: 50000,
      noteType: 'image',
      noteLink: 'https://example.com/note1',
      impNum: 10000,
      readNum: 2000,
      engageNum: 500,
      likeNum: 300,
      favNum: 150,
      cmtNum: 50,
      shareNum: 20,
      followNum: 10,
      kolPrice: 5000,
      serviceFee: 500,
      totalPlatformPrice: 5500,
      heatImpNum: 1000,
      heatReadNum: 200,
      isUnderwater: false,
      underwaterPrice: 0,
      components: [
        { componentType: '正文组件', impressions: 5000, clicks: 200, conversions: 50 },
      ],
      createdAt: new Date(),
    },
    {
      id: 'note-uuid-2',
      projectId: 'test-project-id',
      noteId: 'note-002',
      brandUserName: 'brand1',
      spuName: 'SPU1',
      kolNickName: 'KOL2',
      kolId: 'kol-002',
      kolFanNum: 200000,
      noteType: 'video',
      noteLink: 'https://example.com/note2',
      impNum: 50000,
      readNum: 10000,
      engageNum: 2000,
      likeNum: 800,
      favNum: 400,
      cmtNum: 200,
      shareNum: 100,
      followNum: 50,
      kolPrice: 20000,
      serviceFee: 2000,
      totalPlatformPrice: 22000,
      heatImpNum: 5000,
      heatReadNum: 1000,
      isUnderwater: false,
      underwaterPrice: 0,
      components: null,
      createdAt: new Date(),
    },
  ];

  const mockJuguangData = [
    {
      id: 'jg-uuid-1',
      projectId: 'test-project-id',
      noteId: 'note-001',
      fee: 3000,
      impression: 8000,
      click: 500,
      interaction: 200,
      iUserNum: 100,
      tiUserNum: 30,
      iUserPrice: 30,
      tiUserPrice: 100,
      searchCmtClick: 50,
      searchCmtAfterRead: 30,
      searchCmtAfterReadAvg: 15,
      searchCmtClickCvr: 0.6,
      createdAt: new Date(),
    },
  ];

  const mockKpiTargets = [
    { id: 'kpi-1', projectId: 'test-project-id', metricName: 'impression', targetValue: 50000, isCostMetric: false },
    { id: 'kpi-2', projectId: 'test-project-id', metricName: 'cpe', targetValue: 15, isCostMetric: true },
  ];

  const mockAnnotations = [
    {
      id: 'ann-1',
      projectId: 'test-project-id',
      noteId: 'note-001',
      contentDirection: '种草',
      accountType: '美妆博主',
      kolType: '垂类',
      launchPhase: '预热期',
      isUnderwater: false,
      createdAt: new Date(),
    },
  ];

  const mockManualInputs = [
    {
      id: 'mi-1',
      projectId: 'test-project-id',
      inputType: 'benchmark',
      dataContent: { cpm: 50, cpe: 20, ctr: 0.15 },
      createdAt: new Date(),
    },
  ];

  const createdMetrics: unknown[] = [];

  return {
    prisma: {
      project: {
        findUniqueOrThrow: vi.fn().mockResolvedValue(mockProject),
        update: vi.fn().mockResolvedValue(mockProject),
      },
      note: {
        findMany: vi.fn().mockResolvedValue(mockNotes),
      },
      juguangData: {
        findMany: vi.fn().mockResolvedValue(mockJuguangData),
      },
      kpiTarget: {
        findMany: vi.fn().mockResolvedValue(mockKpiTargets),
      },
      businessAnnotation: {
        findMany: vi.fn().mockResolvedValue(mockAnnotations),
      },
      manualInput: {
        findMany: vi.fn().mockResolvedValue(mockManualInputs),
      },
      calculatedMetric: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        createMany: vi.fn().mockImplementation(({ data }) => {
          createdMetrics.push(...data);
          return Promise.resolve({ count: data.length });
        }),
      },
      _createdMetrics: createdMetrics,
    },
    getPrismaClient: vi.fn(),
    disconnect: vi.fn(),
  };
});

describe('Calculation Pipeline', () => {
  describe('runCalculationPipeline', () => {
    it('should execute the full pipeline and write metrics to DB', async () => {
      const { prisma } = await import('../../src/shared/db.js');

      await runCalculationPipeline('test-project-id');

      // Verify DB reads were called
      expect(prisma.project.findUniqueOrThrow).toHaveBeenCalledWith({
        where: { id: 'test-project-id' },
      });
      expect(prisma.note.findMany).toHaveBeenCalledWith({
        where: { projectId: 'test-project-id' },
      });
      expect(prisma.juguangData.findMany).toHaveBeenCalledWith({
        where: { projectId: 'test-project-id' },
      });
      expect(prisma.kpiTarget.findMany).toHaveBeenCalledWith({
        where: { projectId: 'test-project-id' },
      });
      expect(prisma.businessAnnotation.findMany).toHaveBeenCalledWith({
        where: { projectId: 'test-project-id' },
      });

      // Verify old metrics were deleted
      expect(prisma.calculatedMetric.deleteMany).toHaveBeenCalledWith({
        where: { projectId: 'test-project-id' },
      });

      // Verify new metrics were written
      expect(prisma.calculatedMetric.createMany).toHaveBeenCalled();

      // Check that all expected metric types were written
      const createManyCall = vi.mocked(prisma.calculatedMetric.createMany).mock.calls[0][0];
      const data = createManyCall.data as Array<{ metricType: string }>;
      const metricTypes = data.map((r) => r.metricType);

      expect(metricTypes).toContain('project_total_cost');
      expect(metricTypes).toContain('engagement');
      expect(metricTypes).toContain('core_metrics');
      expect(metricTypes).toContain('viral');
      expect(metricTypes).toContain('kpi_completion');
      expect(metricTypes).toContain('kol_tier');
      expect(metricTypes).toContain('natural_exposure');
      expect(metricTypes).toContain('paid_traffic');
      expect(metricTypes).toContain('dimension_aggregations');
      expect(metricTypes).toContain('benchmark_comparison');
      expect(metricTypes).toContain('highlights');
      expect(metricTypes).toContain('component_conversion');
    });

    it('should calculate correct project total cost', async () => {
      const { prisma } = await import('../../src/shared/db.js');

      await runCalculationPipeline('test-project-id');

      const createManyCall = vi.mocked(prisma.calculatedMetric.createMany).mock.calls[0][0];
      const data = createManyCall.data as Array<{ metricType: string; metricValue: unknown }>;
      const costMetric = data.find((r) => r.metricType === 'project_total_cost');

      expect(costMetric).toBeDefined();
      const costValue = costMetric!.metricValue as {
        aboveWaterCost: number;
        underwaterCost: number;
        juguangCost: number;
        totalCost: number;
      };

      // Above water: (5000 + 500) * 0.9 + (20000 + 2000) * 0.9 = 4950 + 19800 = 24750
      expect(costValue.aboveWaterCost).toBeCloseTo(24750);
      // No underwater notes
      expect(costValue.underwaterCost).toBe(0);
      // Juguang: 3000
      expect(costValue.juguangCost).toBe(3000);
      // Total: 24750 + 0 + 3000 = 27750
      expect(costValue.totalCost).toBeCloseTo(27750);
    });

    it('should calculate correct core metrics', async () => {
      const { prisma } = await import('../../src/shared/db.js');

      await runCalculationPipeline('test-project-id');

      const createManyCall = vi.mocked(prisma.calculatedMetric.createMany).mock.calls[0][0];
      const data = createManyCall.data as Array<{ metricType: string; metricValue: unknown }>;
      const coreMetric = data.find((r) => r.metricType === 'core_metrics');

      expect(coreMetric).toBeDefined();
      const metrics = coreMetric!.metricValue as {
        cpe: number | 'N/A';
        cpm: number | 'N/A';
        cpc: number | 'N/A';
        ctr: number | 'N/A';
      };

      // Total impressions: 10000 + 50000 = 60000
      // Total reads: 2000 + 10000 = 12000
      // Total engagement (with share+follow): (300+150+50+20+10) + (800+400+200+100+50) = 530 + 1550 = 2080
      // Total cost: 27750
      // CPE = 27750 / 2080 ≈ 13.34
      expect(metrics.cpe).toBeCloseTo(27750 / 2080, 1);
      // CPM = 27750 / 60000 * 1000 = 462.5
      expect(metrics.cpm).toBeCloseTo(462.5);
      // CPC = 27750 / 12000 ≈ 2.3125
      expect(metrics.cpc).toBeCloseTo(27750 / 12000, 1);
      // CTR = 12000 / 60000 = 0.2
      expect(metrics.ctr).toBeCloseTo(0.2);
    });
  });

  describe('onEngagementConfigChange', () => {
    it('should update config in DB and re-run pipeline', async () => {
      const { prisma } = await import('../../src/shared/db.js');

      const newConfig = { includeShare: false, includeFollow: false };
      await onEngagementConfigChange('test-project-id', newConfig);

      // Verify project was updated with new config
      expect(prisma.project.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'test-project-id' },
          data: expect.objectContaining({
            engagementConfig: JSON.parse(JSON.stringify(newConfig)),
          }),
        })
      );

      // Verify pipeline was re-run (metrics were written)
      expect(prisma.calculatedMetric.deleteMany).toHaveBeenCalled();
      expect(prisma.calculatedMetric.createMany).toHaveBeenCalled();
    });
  });
});
