/**
 * Unit tests for POST /api/upload/competitor
 * Tests the competitor data batch entry API route.
 *
 * Requirements: 13.2, 13.3, 13.4
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the prisma client used by the route
vi.mock('@/lib/prisma', () => {
  const mockPrisma = {
    project: {
      findUnique: vi.fn(),
    },
    competitorData: {
      createMany: vi.fn(),
    },
  };
  return { prisma: mockPrisma };
});

// Mock the status machine to avoid database calls
vi.mock('@/project/status-machine', () => ({
  transitionStatus: vi.fn().mockResolvedValue({ success: true, newStatus: 'uploading' }),
}));

import { POST } from '../../web/src/app/api/upload/competitor/route';
import { prisma } from '@/lib/prisma';

const mockPrisma = prisma as unknown as {
  project: { findUnique: ReturnType<typeof vi.fn> };
  competitorData: { createMany: ReturnType<typeof vi.fn> };
};

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/upload/competitor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/upload/competitor', () => {
  const projectId = '123e4567-e89b-12d3-a456-426614174000';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when projectId is missing', async () => {
    const res = await POST(makeRequest({ competitors: [{ brandName: 'A', metrics: {} }] }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain('projectId');
  });

  it('returns 400 when competitors is missing', async () => {
    const res = await POST(makeRequest({ projectId }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain('competitors');
  });

  it('returns 400 when competitors is an empty array', async () => {
    const res = await POST(makeRequest({ projectId, competitors: [] }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain('competitors');
  });

  it('returns 400 when a competitor entry is missing brandName', async () => {
    const res = await POST(makeRequest({
      projectId,
      competitors: [{ metrics: { impressions: 1000 } }],
    }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain('Validation failed');
    expect(json.details[0].reason).toContain('brandName');
  });

  it('returns 400 when a competitor entry is missing metrics', async () => {
    const res = await POST(makeRequest({
      projectId,
      competitors: [{ brandName: 'CompetitorA' }],
    }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain('Validation failed');
    expect(json.details[0].reason).toContain('metrics');
  });

  it('returns 404 when project does not exist', async () => {
    mockPrisma.project.findUnique.mockResolvedValue(null);

    const res = await POST(makeRequest({
      projectId,
      competitors: [{ brandName: 'A', metrics: { impressions: 1000 } }],
    }));
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toContain('Project not found');
  });

  it('creates competitor records and returns count on success', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({ id: projectId });
    mockPrisma.competitorData.createMany.mockResolvedValue({ count: 3 });

    const competitors = [
      { brandName: 'BrandA', metrics: { impressions: 10000, engagement: 500, cpe: 2.5, viralRate: 0.05 } },
      { brandName: 'BrandB', metrics: { impressions: 8000, engagement: 300, cpe: 3.0, viralRate: 0.03 } },
      { brandName: 'BrandC', metrics: { impressions: 12000, engagement: 800, cpe: 1.8, viralRate: 0.08 } },
    ];

    const res = await POST(makeRequest({ projectId, competitors }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.count).toBe(3);
  });

  it('passes correct data to prisma createMany', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({ id: projectId });
    mockPrisma.competitorData.createMany.mockResolvedValue({ count: 2 });

    const competitors = [
      { brandName: 'BrandA', metrics: { impressions: 10000, cpe: 2.5 } },
      { brandName: 'BrandB', metrics: { engagement: 300, viralRate: 0.03 } },
    ];

    await POST(makeRequest({ projectId, competitors }));

    expect(mockPrisma.competitorData.createMany).toHaveBeenCalledWith({
      data: [
        { projectId, competitorName: 'BrandA', metrics: { impressions: 10000, cpe: 2.5 } },
        { projectId, competitorName: 'BrandB', metrics: { engagement: 300, viralRate: 0.03 } },
      ],
    });
  });

  it('returns 500 on unexpected database error', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({ id: projectId });
    mockPrisma.competitorData.createMany.mockRejectedValue(new Error('DB connection lost'));

    const res = await POST(makeRequest({
      projectId,
      competitors: [{ brandName: 'A', metrics: { impressions: 100 } }],
    }));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toContain('Internal server error');
  });

  it('returns 400 for invalid JSON body', async () => {
    const req = new Request('http://localhost/api/upload/competitor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not valid json{{{',
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain('Invalid JSON');
  });
});
