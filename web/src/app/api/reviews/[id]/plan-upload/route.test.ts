import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  default: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock crypto
vi.mock('crypto', () => ({
  default: {
    randomUUID: vi.fn().mockReturnValue('test-uuid-1234'),
  },
}));

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

import { POST } from './route';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

const mockGetSession = getSession as ReturnType<typeof vi.fn>;
const mockReviewConfigFindUnique = prisma.reviewConfig.findUnique as ReturnType<typeof vi.fn>;
const mockReviewConfigUpdate = prisma.reviewConfig.update as ReturnType<typeof vi.fn>;
const mockProjectFindUnique = prisma.project.findUnique as ReturnType<typeof vi.fn>;

const reviewId = 'review-123';

function makeUploadRequest(fileName: string, fileContent: string = 'test content'): NextRequest {
  const formData = new FormData();
  const blob = new Blob([fileContent], { type: 'application/octet-stream' });
  const file = new File([blob], fileName);
  formData.append('file', file);

  return new NextRequest(`http://localhost/api/reviews/${reviewId}/plan-upload`, {
    method: 'POST',
    body: formData,
  });
}

function makeEmptyRequest(): NextRequest {
  const formData = new FormData();
  return new NextRequest(`http://localhost/api/reviews/${reviewId}/plan-upload`, {
    method: 'POST',
    body: formData,
  });
}

const routeParams = { params: Promise.resolve({ id: reviewId }) };

describe('POST /api/reviews/[id]/plan-upload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockGetSession.mockResolvedValue(null);

    const res = await POST(makeUploadRequest('plan.pdf'), routeParams);
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.code).toBe('UNAUTHORIZED');
  });

  it('returns 404 when review does not exist', async () => {
    mockGetSession.mockResolvedValue({ sub: 'user-1', role: 'admin', username: 'admin' });
    mockReviewConfigFindUnique.mockResolvedValue(null);

    const res = await POST(makeUploadRequest('plan.pdf'), routeParams);
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.code).toBe('REVIEW_NOT_FOUND');
  });

  it('returns 403 for non-admin user without access', async () => {
    mockGetSession.mockResolvedValue({ sub: 'user-2', role: 'AM', username: 'am_user' });
    mockReviewConfigFindUnique.mockResolvedValue({ id: reviewId, projectId: 'proj-1' });
    mockProjectFindUnique.mockResolvedValue({
      createdBy: 'user-1',
      participants: ['user-3'],
    });

    const res = await POST(makeUploadRequest('plan.pdf'), routeParams);
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.code).toBe('FORBIDDEN');
  });

  it('returns 400 when no file is provided', async () => {
    mockGetSession.mockResolvedValue({ sub: 'user-1', role: 'admin', username: 'admin' });
    mockReviewConfigFindUnique.mockResolvedValue({ id: reviewId, projectId: 'proj-1' });

    const res = await POST(makeEmptyRequest(), routeParams);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.code).toBe('NO_FILE');
  });

  it('returns 400 for invalid file format (.xlsx)', async () => {
    mockGetSession.mockResolvedValue({ sub: 'user-1', role: 'admin', username: 'admin' });
    mockReviewConfigFindUnique.mockResolvedValue({ id: reviewId, projectId: 'proj-1' });

    const res = await POST(makeUploadRequest('data.xlsx'), routeParams);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.code).toBe('INVALID_FILE_FORMAT');
  });

  it('returns 400 for invalid file format (.txt)', async () => {
    mockGetSession.mockResolvedValue({ sub: 'user-1', role: 'admin', username: 'admin' });
    mockReviewConfigFindUnique.mockResolvedValue({ id: reviewId, projectId: 'proj-1' });

    const res = await POST(makeUploadRequest('notes.txt'), routeParams);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.code).toBe('INVALID_FILE_FORMAT');
  });

  it('successfully uploads a .pdf file', async () => {
    mockGetSession.mockResolvedValue({ sub: 'user-1', role: 'admin', username: 'admin' });
    mockReviewConfigFindUnique.mockResolvedValue({ id: reviewId, projectId: 'proj-1' });
    mockReviewConfigUpdate.mockResolvedValue({ id: reviewId, planFileUrl: '/uploads/plans/test-uuid-1234.pdf', planFileName: '策划方案.pdf' });

    const res = await POST(makeUploadRequest('策划方案.pdf'), routeParams);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.fileName).toBe('策划方案.pdf');
    expect(json.fileUrl).toBe('/uploads/plans/test-uuid-1234.pdf');
  });

  it('successfully uploads a .docx file', async () => {
    mockGetSession.mockResolvedValue({ sub: 'user-1', role: 'admin', username: 'admin' });
    mockReviewConfigFindUnique.mockResolvedValue({ id: reviewId, projectId: 'proj-1' });
    mockReviewConfigUpdate.mockResolvedValue({ id: reviewId });

    const res = await POST(makeUploadRequest('plan.docx'), routeParams);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.fileName).toBe('plan.docx');
    expect(json.fileUrl).toBe('/uploads/plans/test-uuid-1234.docx');
  });

  it('successfully uploads a .pptx file', async () => {
    mockGetSession.mockResolvedValue({ sub: 'user-1', role: 'admin', username: 'admin' });
    mockReviewConfigFindUnique.mockResolvedValue({ id: reviewId, projectId: 'proj-1' });
    mockReviewConfigUpdate.mockResolvedValue({ id: reviewId });

    const res = await POST(makeUploadRequest('presentation.pptx'), routeParams);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.fileName).toBe('presentation.pptx');
    expect(json.fileUrl).toBe('/uploads/plans/test-uuid-1234.pptx');
  });

  it('updates ReviewConfig with planFileUrl and planFileName', async () => {
    mockGetSession.mockResolvedValue({ sub: 'user-1', role: 'admin', username: 'admin' });
    mockReviewConfigFindUnique.mockResolvedValue({ id: reviewId, projectId: 'proj-1' });
    mockReviewConfigUpdate.mockResolvedValue({ id: reviewId });

    await POST(makeUploadRequest('plan.doc'), routeParams);

    expect(mockReviewConfigUpdate).toHaveBeenCalledWith({
      where: { id: reviewId },
      data: {
        planFileUrl: '/uploads/plans/test-uuid-1234.doc',
        planFileName: 'plan.doc',
        updatedAt: expect.any(Date),
      },
    });
  });

  it('allows non-admin user who is a participant', async () => {
    mockGetSession.mockResolvedValue({ sub: 'user-2', role: 'AM', username: 'am_user' });
    mockReviewConfigFindUnique.mockResolvedValue({ id: reviewId, projectId: 'proj-1' });
    mockProjectFindUnique.mockResolvedValue({
      createdBy: 'user-1',
      participants: ['user-2'],
    });
    mockReviewConfigUpdate.mockResolvedValue({ id: reviewId });

    const res = await POST(makeUploadRequest('plan.ppt'), routeParams);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
  });

  it('returns 500 on unexpected error', async () => {
    mockGetSession.mockResolvedValue({ sub: 'user-1', role: 'admin', username: 'admin' });
    mockReviewConfigFindUnique.mockResolvedValue({ id: reviewId, projectId: 'proj-1' });
    mockReviewConfigUpdate.mockRejectedValue(new Error('DB error'));

    const res = await POST(makeUploadRequest('plan.pdf'), routeParams);
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe('上传失败，请稍后重试');
  });
});
