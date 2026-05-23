import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock the prisma client
vi.mock('@/lib/prisma', () => ({
  prisma: {
    reviewConfig: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    project: {
      findUnique: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
  },
}));

// Mock the auth module
vi.mock('@/lib/auth', () => ({
  getSession: vi.fn(),
}));

import { GET, POST } from './route';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

const mockGetSession = getSession as ReturnType<typeof vi.fn>;
const mockReviewConfigFindMany = prisma.reviewConfig.findMany as ReturnType<typeof vi.fn>;
const mockReviewConfigCreate = prisma.reviewConfig.create as ReturnType<typeof vi.fn>;
const mockProjectFindUnique = prisma.project.findUnique as ReturnType<typeof vi.fn>;
const mockUserFindMany = prisma.user.findMany as ReturnType<typeof vi.fn>;

function makeGetRequest(url = 'http://localhost/api/reviews'): NextRequest {
  return new NextRequest(url, { method: 'GET' });
}

function makePostRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/reviews', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('GET /api/reviews', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockGetSession.mockResolvedValue(null);

    const res = await GET(makeGetRequest());
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.code).toBe('UNAUTHORIZED');
  });

  it('returns review list with project info and user display names', async () => {
    mockGetSession.mockResolvedValue({ sub: 'user-1', role: 'admin', username: 'admin' });
    mockReviewConfigFindMany.mockResolvedValue([
      {
        id: 'review-1',
        projectId: 'proj-1',
        createdBy: 'user-1',
        status: 'draft',
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-02'),
        project: {
          id: 'proj-1',
          projectName: '测试项目',
          category: '美妆',
          brand: '品牌A',
          businessLine: '护肤',
        },
      },
    ]);
    mockUserFindMany.mockResolvedValue([
      { id: 'user-1', displayName: '管理员', username: 'admin' },
    ]);

    const res = await GET(makeGetRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.items).toHaveLength(1);
    expect(json.items[0]).toMatchObject({
      id: 'review-1',
      projectName: '测试项目',
      createdByDisplayName: '管理员',
      status: 'draft',
    });
  });

  it('applies data permission filter for non-admin users', async () => {
    mockGetSession.mockResolvedValue({ sub: 'user-2', role: 'AM', username: 'am_user' });
    mockReviewConfigFindMany.mockResolvedValue([]);
    mockUserFindMany.mockResolvedValue([]);

    await GET(makeGetRequest());

    expect(mockReviewConfigFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          project: {
            OR: [
              { createdBy: 'user-2' },
              { participants: { has: 'user-2' } },
            ],
          },
        },
      })
    );
  });

  it('does not apply data permission filter for admin users', async () => {
    mockGetSession.mockResolvedValue({ sub: 'user-1', role: 'admin', username: 'admin' });
    mockReviewConfigFindMany.mockResolvedValue([]);
    mockUserFindMany.mockResolvedValue([]);

    await GET(makeGetRequest());

    expect(mockReviewConfigFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
      })
    );
  });
});

describe('POST /api/reviews', () => {
  const projectId = '123e4567-e89b-12d3-a456-426614174000';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockGetSession.mockResolvedValue(null);

    const res = await POST(makePostRequest({ projectId }));
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.code).toBe('UNAUTHORIZED');
  });

  it('returns 400 when projectId is missing', async () => {
    mockGetSession.mockResolvedValue({ sub: 'user-1', role: 'admin', username: 'admin' });

    const res = await POST(makePostRequest({}));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 when project does not exist', async () => {
    mockGetSession.mockResolvedValue({ sub: 'user-1', role: 'admin', username: 'admin' });
    mockProjectFindUnique.mockResolvedValue(null);

    const res = await POST(makePostRequest({ projectId }));
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.code).toBe('PROJECT_NOT_FOUND');
  });

  it('returns 400 when project has noteCount === 0', async () => {
    mockGetSession.mockResolvedValue({ sub: 'user-1', role: 'admin', username: 'admin' });
    mockProjectFindUnique.mockResolvedValue({ id: projectId, noteCount: 0 });

    const res = await POST(makePostRequest({ projectId }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.code).toBe('NOTES_REQUIRED');
    expect(json.error).toBe('请先上传笔记底表');
  });

  it('creates review config and returns 201 on success', async () => {
    mockGetSession.mockResolvedValue({ sub: 'user-1', role: 'admin', username: 'admin' });
    mockProjectFindUnique.mockResolvedValue({ id: projectId, noteCount: 50 });

    const createdReview = {
      id: 'review-new',
      projectId,
      createdBy: 'user-1',
      status: 'draft',
      benchmark: { ctr: 0.05 },
      influencerTiers: [],
      kpiTargets: {},
      engagementMetric: 'exclude_follow',
      viralMetric: 'like_comment_share',
      modules: {},
      launchPhases: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockReviewConfigCreate.mockResolvedValue(createdReview);

    const res = await POST(makePostRequest({
      projectId,
      benchmark: { ctr: 0.05 },
      engagementMetric: 'exclude_follow',
      viralMetric: 'like_comment_share',
    }));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.id).toBe('review-new');
    expect(json.projectId).toBe(projectId);
  });

  it('passes correct data to prisma create', async () => {
    mockGetSession.mockResolvedValue({ sub: 'user-1', role: 'admin', username: 'admin' });
    mockProjectFindUnique.mockResolvedValue({ id: projectId, noteCount: 10 });
    mockReviewConfigCreate.mockResolvedValue({ id: 'review-new' });

    const body = {
      projectId,
      benchmark: { ctr: 0.03, cpm: 50 },
      influencerTiers: [{ id: '1', name: '头部', fanRangeMin: 100000, fanRangeMax: 999999 }],
      kpiTargets: { totalImpression: 1000000 },
      engagementMetric: 'include_follow',
      viralMetric: 'like_only',
      modules: { projectReview: true, dataOverview: true },
      launchPhases: [{ id: '1', name: '预热期', startDate: '2025-01-01', endDate: '2025-01-15' }],
    };

    await POST(makePostRequest(body));

    expect(mockReviewConfigCreate).toHaveBeenCalledWith({
      data: {
        projectId,
        createdBy: 'user-1',
        benchmark: body.benchmark,
        influencerTiers: body.influencerTiers,
        kpiTargets: body.kpiTargets,
        engagementMetric: 'include_follow',
        viralMetric: 'like_only',
        modules: body.modules,
        launchPhases: body.launchPhases,
      },
    });
  });

  it('uses default values when optional fields are not provided', async () => {
    mockGetSession.mockResolvedValue({ sub: 'user-1', role: 'admin', username: 'admin' });
    mockProjectFindUnique.mockResolvedValue({ id: projectId, noteCount: 5 });
    mockReviewConfigCreate.mockResolvedValue({ id: 'review-new' });

    await POST(makePostRequest({ projectId }));

    expect(mockReviewConfigCreate).toHaveBeenCalledWith({
      data: {
        projectId,
        createdBy: 'user-1',
        benchmark: {},
        influencerTiers: [],
        kpiTargets: {},
        engagementMetric: 'exclude_follow',
        viralMetric: 'like_comment_share',
        modules: {},
        launchPhases: [],
      },
    });
  });

  it('returns 500 on unexpected database error', async () => {
    mockGetSession.mockResolvedValue({ sub: 'user-1', role: 'admin', username: 'admin' });
    mockProjectFindUnique.mockResolvedValue({ id: projectId, noteCount: 10 });
    mockReviewConfigCreate.mockRejectedValue(new Error('DB connection lost'));

    const res = await POST(makePostRequest({ projectId }));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe('Internal server error');
  });
});
