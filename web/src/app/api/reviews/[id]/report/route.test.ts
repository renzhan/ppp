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

const reviewId = 'review-456';

function makeGetRequest(): NextRequest {
  return new NextRequest(`http://localhost/api/reviews/${reviewId}/report`, { method: 'GET' });
}

function makePutRequest(body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/reviews/${reviewId}/report`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const routeParams = { params: Promise.resolve({ id: reviewId }) };

describe('GET /api/reviews/[id]/report', () => {
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

  it('returns report content for admin user', async () => {
    mockGetSession.mockResolvedValue({ sub: 'user-1', role: 'admin', username: 'admin' });
    const mockReportContent = {
      chapters: [
        { title: '项目概述', content: '这是一个测试项目...' },
        { title: 'KPI达成', content: '总曝光达成率120%...' },
      ],
    };
    mockReviewConfigFindUnique.mockResolvedValue({
      id: reviewId,
      reportContent: mockReportContent,
      projectId: 'proj-1',
    });

    const res = await GET(makeGetRequest(), routeParams);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.id).toBe(reviewId);
    expect(json.reportContent).toEqual(mockReportContent);
  });

  it('returns null reportContent when report has not been generated', async () => {
    mockGetSession.mockResolvedValue({ sub: 'user-1', role: 'admin', username: 'admin' });
    mockReviewConfigFindUnique.mockResolvedValue({
      id: reviewId,
      reportContent: null,
      projectId: 'proj-1',
    });

    const res = await GET(makeGetRequest(), routeParams);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.id).toBe(reviewId);
    expect(json.reportContent).toBeNull();
  });

  it('returns 403 for non-admin user without access', async () => {
    mockGetSession.mockResolvedValue({ sub: 'user-2', role: 'AM', username: 'am_user' });
    mockReviewConfigFindUnique.mockResolvedValue({
      id: reviewId,
      reportContent: null,
      projectId: 'proj-1',
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
    mockReviewConfigFindUnique.mockResolvedValue({
      id: reviewId,
      reportContent: { chapters: [] },
      projectId: 'proj-1',
    });
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

describe('PUT /api/reviews/[id]/report', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockGetSession.mockResolvedValue(null);

    const res = await PUT(makePutRequest({ content: {} }), routeParams);
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.code).toBe('UNAUTHORIZED');
  });

  it('returns 404 when review does not exist', async () => {
    mockGetSession.mockResolvedValue({ sub: 'user-1', role: 'admin', username: 'admin' });
    mockReviewConfigFindUnique.mockResolvedValue(null);

    const res = await PUT(makePutRequest({ content: { chapters: [] } }), routeParams);
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.code).toBe('REVIEW_NOT_FOUND');
  });

  it('returns 400 when content field is missing', async () => {
    mockGetSession.mockResolvedValue({ sub: 'user-1', role: 'admin', username: 'admin' });
    mockReviewConfigFindUnique.mockResolvedValue({ id: reviewId, projectId: 'proj-1' });

    const res = await PUT(makePutRequest({}), routeParams);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.code).toBe('INVALID_REQUEST');
  });

  it('saves report content and updates timestamp', async () => {
    mockGetSession.mockResolvedValue({ sub: 'user-1', role: 'admin', username: 'admin' });
    mockReviewConfigFindUnique.mockResolvedValue({ id: reviewId, projectId: 'proj-1' });

    const newContent = {
      chapters: [
        { title: '项目概述', content: '编辑后的内容...' },
      ],
    };
    const updatedReview = {
      id: reviewId,
      reportContent: newContent,
      updatedAt: new Date('2025-06-01T10:00:00Z'),
    };
    mockReviewConfigUpdate.mockResolvedValue(updatedReview);

    const res = await PUT(makePutRequest({ content: newContent }), routeParams);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.id).toBe(reviewId);
    expect(json.reportContent).toEqual(newContent);
    expect(json.updatedAt).toBeDefined();
    expect(mockReviewConfigUpdate).toHaveBeenCalledWith({
      where: { id: reviewId },
      data: {
        reportContent: newContent,
        updatedAt: expect.any(Date),
      },
    });
  });

  it('allows saving null content to clear report', async () => {
    mockGetSession.mockResolvedValue({ sub: 'user-1', role: 'admin', username: 'admin' });
    mockReviewConfigFindUnique.mockResolvedValue({ id: reviewId, projectId: 'proj-1' });
    mockReviewConfigUpdate.mockResolvedValue({
      id: reviewId,
      reportContent: null,
      updatedAt: new Date(),
    });

    const res = await PUT(makePutRequest({ content: null }), routeParams);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.reportContent).toBeNull();
  });

  it('returns 403 for non-admin user without access', async () => {
    mockGetSession.mockResolvedValue({ sub: 'user-2', role: 'AM', username: 'am_user' });
    mockReviewConfigFindUnique.mockResolvedValue({ id: reviewId, projectId: 'proj-1' });
    mockProjectFindUnique.mockResolvedValue({
      createdBy: 'user-1',
      participants: ['user-3'],
    });

    const res = await PUT(makePutRequest({ content: {} }), routeParams);
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
    mockReviewConfigUpdate.mockResolvedValue({
      id: reviewId,
      reportContent: { chapters: [] },
      updatedAt: new Date(),
    });

    const res = await PUT(makePutRequest({ content: { chapters: [] } }), routeParams);

    expect(res.status).toBe(200);
  });

  it('returns 500 on unexpected error', async () => {
    mockGetSession.mockResolvedValue({ sub: 'user-1', role: 'admin', username: 'admin' });
    mockReviewConfigFindUnique.mockResolvedValue({ id: reviewId, projectId: 'proj-1' });
    mockReviewConfigUpdate.mockRejectedValue(new Error('DB error'));

    const res = await PUT(makePutRequest({ content: {} }), routeParams);
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe('Internal server error');
  });
});
