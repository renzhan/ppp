import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock the prisma client
vi.mock('@/lib/prisma', () => ({
  prisma: {
    reviewConfig: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    project: {
      findUnique: vi.fn(),
    },
  },
}));

// Mock the auth module
vi.mock('@/lib/auth', () => ({
  getSession: vi.fn(),
}));

import { GET, PUT } from './route';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

const mockGetSession = getSession as ReturnType<typeof vi.fn>;
const mockReviewConfigFindUnique = prisma.reviewConfig.findUnique as ReturnType<typeof vi.fn>;
const mockReviewConfigUpdate = prisma.reviewConfig.update as ReturnType<typeof vi.fn>;
const mockProjectFindUnique = prisma.project.findUnique as ReturnType<typeof vi.fn>;

const reviewId = 'review-123';

function makeGetRequest(): NextRequest {
  return new NextRequest(`http://localhost/api/reviews/${reviewId}`, { method: 'GET' });
}

function makePutRequest(body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/reviews/${reviewId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const routeParams = { params: Promise.resolve({ id: reviewId }) };

describe('GET /api/reviews/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockGetSession.mockResolvedValue(null);

    const res = await GET(makeGetRequest(), routeParams);
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.code).toBe('UNAUTHORIZED');
  });

  it('returns 404 when review does not exist', async () => {
    mockGetSession.mockResolvedValue({ sub: 'user-1', role: 'admin', username: 'admin' });
    mockReviewConfigFindUnique.mockResolvedValue(null);

    const res = await GET(makeGetRequest(), routeParams);
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.code).toBe('REVIEW_NOT_FOUND');
  });

  it('returns full review config with project info for admin', async () => {
    mockGetSession.mockResolvedValue({ sub: 'user-1', role: 'admin', username: 'admin' });
    const mockReview = {
      id: reviewId,
      projectId: 'proj-1',
      createdBy: 'user-1',
      status: 'draft',
      benchmark: { ctr: 0.05, cpm: 30 },
      influencerTiers: [{ id: '1', name: '头部', fanRangeMin: 100000, fanRangeMax: 999999 }],
      kpiTargets: { totalImpression: 1000000 },
      engagementMetric: 'exclude_follow',
      viralMetric: 'like_comment_share',
      modules: { projectReview: true },
      launchPhases: [{ id: '1', name: '预热期', startDate: '2025-01-01', endDate: '2025-01-15' }],
      planFileUrl: null,
      planFileName: null,
      reportContent: null,
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-02'),
      project: {
        id: 'proj-1',
        projectName: '测试项目',
        category: '美妆',
        brand: '品牌A',
        businessLine: '护肤',
      },
    };
    mockReviewConfigFindUnique.mockResolvedValue(mockReview);

    const res = await GET(makeGetRequest(), routeParams);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.id).toBe(reviewId);
    expect(json.project.projectName).toBe('测试项目');
    expect(json.benchmark).toEqual({ ctr: 0.05, cpm: 30 });
    expect(json.kpiTargets).toEqual({ totalImpression: 1000000 });
  });

  it('returns 403 for non-admin user without access', async () => {
    mockGetSession.mockResolvedValue({ sub: 'user-2', role: 'AM', username: 'am_user' });
    mockReviewConfigFindUnique.mockResolvedValue({
      id: reviewId,
      projectId: 'proj-1',
      createdBy: 'user-1',
      project: { id: 'proj-1', projectName: '测试项目', category: '美妆', brand: '品牌A', businessLine: '护肤' },
    });
    mockProjectFindUnique.mockResolvedValue({
      createdBy: 'user-1',
      participants: ['user-3'],
    });

    const res = await GET(makeGetRequest(), routeParams);
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.code).toBe('FORBIDDEN');
  });

  it('allows non-admin user who is a participant', async () => {
    mockGetSession.mockResolvedValue({ sub: 'user-2', role: 'AM', username: 'am_user' });
    const mockReview = {
      id: reviewId,
      projectId: 'proj-1',
      createdBy: 'user-1',
      project: { id: 'proj-1', projectName: '测试项目', category: '美妆', brand: '品牌A', businessLine: '护肤' },
    };
    mockReviewConfigFindUnique.mockResolvedValue(mockReview);
    mockProjectFindUnique.mockResolvedValue({
      createdBy: 'user-1',
      participants: ['user-2'],
    });

    const res = await GET(makeGetRequest(), routeParams);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.id).toBe(reviewId);
  });

  it('returns 500 on unexpected error', async () => {
    mockGetSession.mockResolvedValue({ sub: 'user-1', role: 'admin', username: 'admin' });
    mockReviewConfigFindUnique.mockRejectedValue(new Error('DB error'));

    const res = await GET(makeGetRequest(), routeParams);
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe('Internal server error');
  });
});

describe('PUT /api/reviews/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockGetSession.mockResolvedValue(null);

    const res = await PUT(makePutRequest({}), routeParams);
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.code).toBe('UNAUTHORIZED');
  });

  it('returns 404 when review does not exist', async () => {
    mockGetSession.mockResolvedValue({ sub: 'user-1', role: 'admin', username: 'admin' });
    mockReviewConfigFindUnique.mockResolvedValue(null);

    const res = await PUT(makePutRequest({ benchmark: { ctr: 0.1 } }), routeParams);
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.code).toBe('REVIEW_NOT_FOUND');
  });

  it('updates review config with provided fields', async () => {
    mockGetSession.mockResolvedValue({ sub: 'user-1', role: 'admin', username: 'admin' });
    mockReviewConfigFindUnique.mockResolvedValue({ id: reviewId, projectId: 'proj-1' });

    const updatedReview = {
      id: reviewId,
      projectId: 'proj-1',
      benchmark: { ctr: 0.08 },
      kpiTargets: { totalImpression: 2000000 },
      updatedAt: new Date(),
    };
    mockReviewConfigUpdate.mockResolvedValue(updatedReview);

    const res = await PUT(
      makePutRequest({ benchmark: { ctr: 0.08 }, kpiTargets: { totalImpression: 2000000 } }),
      routeParams
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.benchmark).toEqual({ ctr: 0.08 });
    expect(mockReviewConfigUpdate).toHaveBeenCalledWith({
      where: { id: reviewId },
      data: expect.objectContaining({
        benchmark: { ctr: 0.08 },
        kpiTargets: { totalImpression: 2000000 },
      }),
    });
  });

  it('only updates provided fields, leaving others unchanged', async () => {
    mockGetSession.mockResolvedValue({ sub: 'user-1', role: 'admin', username: 'admin' });
    mockReviewConfigFindUnique.mockResolvedValue({ id: reviewId, projectId: 'proj-1' });
    mockReviewConfigUpdate.mockResolvedValue({ id: reviewId, modules: { projectReview: true } });

    await PUT(makePutRequest({ modules: { projectReview: true } }), routeParams);

    const updateCall = mockReviewConfigUpdate.mock.calls[0][0];
    expect(updateCall.data.modules).toEqual({ projectReview: true });
    expect(updateCall.data.benchmark).toBeUndefined();
    expect(updateCall.data.influencerTiers).toBeUndefined();
    expect(updateCall.data.kpiTargets).toBeUndefined();
    expect(updateCall.data.updatedAt).toBeInstanceOf(Date);
  });

  it('returns 403 for non-admin user without access', async () => {
    mockGetSession.mockResolvedValue({ sub: 'user-2', role: 'AM', username: 'am_user' });
    mockReviewConfigFindUnique.mockResolvedValue({ id: reviewId, projectId: 'proj-1' });
    mockProjectFindUnique.mockResolvedValue({
      createdBy: 'user-1',
      participants: ['user-3'],
    });

    const res = await PUT(makePutRequest({ benchmark: { ctr: 0.1 } }), routeParams);
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.code).toBe('FORBIDDEN');
  });

  it('allows non-admin user who created the project', async () => {
    mockGetSession.mockResolvedValue({ sub: 'user-1', role: 'AM', username: 'am_user' });
    mockReviewConfigFindUnique.mockResolvedValue({ id: reviewId, projectId: 'proj-1' });
    mockProjectFindUnique.mockResolvedValue({
      createdBy: 'user-1',
      participants: [],
    });
    mockReviewConfigUpdate.mockResolvedValue({ id: reviewId, benchmark: { ctr: 0.1 } });

    const res = await PUT(makePutRequest({ benchmark: { ctr: 0.1 } }), routeParams);

    expect(res.status).toBe(200);
  });

  it('returns 500 on unexpected error', async () => {
    mockGetSession.mockResolvedValue({ sub: 'user-1', role: 'admin', username: 'admin' });
    mockReviewConfigFindUnique.mockResolvedValue({ id: reviewId, projectId: 'proj-1' });
    mockReviewConfigUpdate.mockRejectedValue(new Error('DB error'));

    const res = await PUT(makePutRequest({ benchmark: {} }), routeParams);
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe('Internal server error');
  });
});
