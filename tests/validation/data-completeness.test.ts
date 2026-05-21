/**
 * Unit tests for the Data Completeness Validator.
 * Tests the checkDataCompleteness function with mocked Prisma client.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the shared db module
vi.mock('../../src/shared/db.js', () => {
  const mockPrisma = {
    note: {
      count: vi.fn(),
    },
    juguangData: {
      count: vi.fn(),
    },
    lingxiData: {
      count: vi.fn(),
    },
    kpiTarget: {
      count: vi.fn(),
    },
    manualInput: {
      count: vi.fn(),
    },
  };
  return {
    getPrismaClient: () => mockPrisma,
    prisma: mockPrisma,
  };
});

import { getPrismaClient } from '../../src/shared/db.js';
import { checkDataCompleteness } from '../../src/validation/data-completeness.js';

const mockPrisma = getPrismaClient() as unknown as {
  note: { count: ReturnType<typeof vi.fn> };
  juguangData: { count: ReturnType<typeof vi.fn> };
  lingxiData: { count: ReturnType<typeof vi.fn> };
  kpiTarget: { count: ReturnType<typeof vi.fn> };
  manualInput: { count: ReturnType<typeof vi.fn> };
};

describe('checkDataCompleteness', () => {
  const projectId = '123e4567-e89b-12d3-a456-426614174000';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 0% when no data sources are uploaded', async () => {
    mockPrisma.note.count.mockResolvedValue(0);
    mockPrisma.juguangData.count.mockResolvedValue(0);
    mockPrisma.lingxiData.count.mockResolvedValue(0);
    mockPrisma.kpiTarget.count.mockResolvedValue(0);
    mockPrisma.manualInput.count.mockResolvedValue(0);

    const result = await checkDataCompleteness(projectId);

    expect(result.percentage).toBe(0);
    expect(result.canGenerate).toBe(false);
    expect(result.sources).toHaveLength(5);
    expect(result.sources.every((s) => s.status === 'not_uploaded')).toBe(true);
  });

  it('returns 100% when all data sources are uploaded', async () => {
    mockPrisma.note.count.mockResolvedValue(10);
    mockPrisma.juguangData.count.mockResolvedValue(5);
    mockPrisma.lingxiData.count.mockResolvedValue(3);
    mockPrisma.kpiTarget.count.mockResolvedValue(4);
    mockPrisma.manualInput.count.mockResolvedValue(2);

    const result = await checkDataCompleteness(projectId);

    expect(result.percentage).toBe(100);
    expect(result.canGenerate).toBe(true);
    expect(result.sources.every((s) => s.status === 'uploaded')).toBe(true);
  });

  it('returns 60% when 3 of 5 sources are uploaded (canGenerate = true)', async () => {
    mockPrisma.note.count.mockResolvedValue(10);
    mockPrisma.juguangData.count.mockResolvedValue(5);
    mockPrisma.lingxiData.count.mockResolvedValue(3);
    mockPrisma.kpiTarget.count.mockResolvedValue(0);
    mockPrisma.manualInput.count.mockResolvedValue(0);

    const result = await checkDataCompleteness(projectId);

    expect(result.percentage).toBe(60);
    expect(result.canGenerate).toBe(true);
  });

  it('returns 40% when 2 of 5 sources are uploaded (canGenerate = false)', async () => {
    mockPrisma.note.count.mockResolvedValue(10);
    mockPrisma.juguangData.count.mockResolvedValue(0);
    mockPrisma.lingxiData.count.mockResolvedValue(0);
    mockPrisma.kpiTarget.count.mockResolvedValue(4);
    mockPrisma.manualInput.count.mockResolvedValue(0);

    const result = await checkDataCompleteness(projectId);

    expect(result.percentage).toBe(40);
    expect(result.canGenerate).toBe(false);
  });

  it('returns correct source labels', async () => {
    mockPrisma.note.count.mockResolvedValue(0);
    mockPrisma.juguangData.count.mockResolvedValue(0);
    mockPrisma.lingxiData.count.mockResolvedValue(0);
    mockPrisma.kpiTarget.count.mockResolvedValue(0);
    mockPrisma.manualInput.count.mockResolvedValue(0);

    const result = await checkDataCompleteness(projectId);

    const labels = result.sources.map((s) => s.label);
    expect(labels).toEqual([
      '执行底表',
      '广告投放底表',
      '外部平台数据',
      'KPI目标值',
      'Benchmark数据',
    ]);
  });

  it('returns correct source identifiers', async () => {
    mockPrisma.note.count.mockResolvedValue(0);
    mockPrisma.juguangData.count.mockResolvedValue(0);
    mockPrisma.lingxiData.count.mockResolvedValue(0);
    mockPrisma.kpiTarget.count.mockResolvedValue(0);
    mockPrisma.manualInput.count.mockResolvedValue(0);

    const result = await checkDataCompleteness(projectId);

    const sources = result.sources.map((s) => s.source);
    expect(sources).toEqual(['execution', 'ad_spend', 'external', 'kpi', 'benchmark']);
  });

  it('includes record counts for each source', async () => {
    mockPrisma.note.count.mockResolvedValue(15);
    mockPrisma.juguangData.count.mockResolvedValue(8);
    mockPrisma.lingxiData.count.mockResolvedValue(0);
    mockPrisma.kpiTarget.count.mockResolvedValue(3);
    mockPrisma.manualInput.count.mockResolvedValue(0);

    const result = await checkDataCompleteness(projectId);

    expect(result.sources[0].recordCount).toBe(15);
    expect(result.sources[1].recordCount).toBe(8);
    expect(result.sources[2].recordCount).toBe(0);
    expect(result.sources[3].recordCount).toBe(3);
    expect(result.sources[4].recordCount).toBe(0);
  });

  it('includes upload paths with projectId substituted', async () => {
    mockPrisma.note.count.mockResolvedValue(0);
    mockPrisma.juguangData.count.mockResolvedValue(0);
    mockPrisma.lingxiData.count.mockResolvedValue(0);
    mockPrisma.kpiTarget.count.mockResolvedValue(0);
    mockPrisma.manualInput.count.mockResolvedValue(0);

    const result = await checkDataCompleteness(projectId);

    for (const source of result.sources) {
      expect(source.uploadPath).toContain(projectId);
      expect(source.uploadPath).not.toContain('{projectId}');
    }
  });

  it('queries benchmark data with inputType filter', async () => {
    mockPrisma.note.count.mockResolvedValue(0);
    mockPrisma.juguangData.count.mockResolvedValue(0);
    mockPrisma.lingxiData.count.mockResolvedValue(0);
    mockPrisma.kpiTarget.count.mockResolvedValue(0);
    mockPrisma.manualInput.count.mockResolvedValue(0);

    await checkDataCompleteness(projectId);

    expect(mockPrisma.manualInput.count).toHaveBeenCalledWith({
      where: { projectId, inputType: 'benchmark' },
    });
  });

  it('queries other data sources with only projectId filter', async () => {
    mockPrisma.note.count.mockResolvedValue(0);
    mockPrisma.juguangData.count.mockResolvedValue(0);
    mockPrisma.lingxiData.count.mockResolvedValue(0);
    mockPrisma.kpiTarget.count.mockResolvedValue(0);
    mockPrisma.manualInput.count.mockResolvedValue(0);

    await checkDataCompleteness(projectId);

    expect(mockPrisma.note.count).toHaveBeenCalledWith({
      where: { projectId },
    });
    expect(mockPrisma.juguangData.count).toHaveBeenCalledWith({
      where: { projectId },
    });
    expect(mockPrisma.lingxiData.count).toHaveBeenCalledWith({
      where: { projectId },
    });
    expect(mockPrisma.kpiTarget.count).toHaveBeenCalledWith({
      where: { projectId },
    });
  });

  it('returns canGenerate = true at exactly 50% (3 sources)', async () => {
    // 3 out of 5 = 60%, which is >= 50
    mockPrisma.note.count.mockResolvedValue(1);
    mockPrisma.juguangData.count.mockResolvedValue(1);
    mockPrisma.lingxiData.count.mockResolvedValue(1);
    mockPrisma.kpiTarget.count.mockResolvedValue(0);
    mockPrisma.manualInput.count.mockResolvedValue(0);

    const result = await checkDataCompleteness(projectId);

    expect(result.percentage).toBe(60);
    expect(result.canGenerate).toBe(true);
  });

  it('returns canGenerate = false at 20% (1 source)', async () => {
    mockPrisma.note.count.mockResolvedValue(5);
    mockPrisma.juguangData.count.mockResolvedValue(0);
    mockPrisma.lingxiData.count.mockResolvedValue(0);
    mockPrisma.kpiTarget.count.mockResolvedValue(0);
    mockPrisma.manualInput.count.mockResolvedValue(0);

    const result = await checkDataCompleteness(projectId);

    expect(result.percentage).toBe(20);
    expect(result.canGenerate).toBe(false);
  });
});
