import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the prisma client
vi.mock('@/lib/prisma', () => ({
  prisma: {
    reportVersion: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    reviewEdit: {
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

import { PUT } from './route';
import { prisma } from '@/lib/prisma';

const mockFindUnique = prisma.reportVersion.findUnique as ReturnType<typeof vi.fn>;
const mockUpdate = prisma.reportVersion.update as ReturnType<typeof vi.fn>;
const mockCreate = prisma.reviewEdit.create as ReturnType<typeof vi.fn>;
const mockDeleteMany = prisma.reviewEdit.deleteMany as ReturnType<typeof vi.fn>;

function createRequest(body: unknown): Request {
  return new Request('http://localhost/api/review/version-1/columns', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const mockVersion = {
  id: 'version-1',
  projectId: 'project-1',
  config: {},
};

describe('PUT /api/review/[versionId]/columns', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindUnique.mockResolvedValue(mockVersion);
    mockUpdate.mockResolvedValue({});
    mockCreate.mockResolvedValue({});
    mockDeleteMany.mockResolvedValue({ count: 1 });
  });

  it('returns 400 when columns is missing', async () => {
    const request = createRequest({ moduleId: 'M1' });
    const response = await PUT(request, { params: { versionId: 'version-1' } });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('columns object is required');
  });

  it('returns 400 when moduleId is missing', async () => {
    const request = createRequest({ columns: { '曝光量': false } });
    const response = await PUT(request, { params: { versionId: 'version-1' } });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('moduleId is required');
  });

  it('returns 404 when version does not exist', async () => {
    mockFindUnique.mockResolvedValue(null);

    const request = createRequest({ columns: { '曝光量': false }, moduleId: 'M1' });
    const response = await PUT(request, { params: { versionId: 'nonexistent' } });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Report version not found');
  });

  it('hides a column and creates a ReviewEdit record with editType=column_hide', async () => {
    const request = createRequest({
      columns: { '曝光量': false },
      moduleId: 'M1',
    });

    const response = await PUT(request, { params: { versionId: 'version-1' } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.moduleId).toBe('M1');
    expect(data.columnVisibility).toEqual({ '曝光量': false });

    // Should create a ReviewEdit record
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectId: 'project-1',
        versionId: 'version-1',
        moduleId: 'M1',
        editType: 'column_hide',
        newContent: { columnKey: '曝光量', visible: false },
      }),
    });
  });

  it('restores a column and deletes the corresponding ReviewEdit record', async () => {
    const request = createRequest({
      columns: { '曝光量': true },
      moduleId: 'M1',
    });

    const response = await PUT(request, { params: { versionId: 'version-1' } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.columnVisibility).toEqual({ '曝光量': true });

    // Should delete existing column_hide records
    expect(mockDeleteMany).toHaveBeenCalledWith({
      where: {
        versionId: 'version-1',
        moduleId: 'M1',
        editType: 'column_hide',
        newContent: {
          path: ['columnKey'],
          equals: '曝光量',
        },
      },
    });

    // Should NOT create a new ReviewEdit
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('updates the version config with column visibility', async () => {
    const request = createRequest({
      columns: { 'CPE': false },
      moduleId: 'M1',
    });

    await PUT(request, { params: { versionId: 'version-1' } });

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'version-1' },
      data: {
        config: {
          columnVisibility: {
            M1: { CPE: false },
          },
        },
      },
    });
  });

  it('preserves existing column visibility when adding new column hide', async () => {
    mockFindUnique.mockResolvedValue({
      ...mockVersion,
      config: {
        columnVisibility: {
          M1: { '曝光量': false },
        },
      },
    });

    const request = createRequest({
      columns: { 'CPE': false },
      moduleId: 'M1',
    });

    await PUT(request, { params: { versionId: 'version-1' } });

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'version-1' },
      data: {
        config: {
          columnVisibility: {
            M1: { '曝光量': false, CPE: false },
          },
        },
      },
    });
  });

  it('handles multiple columns in a single request', async () => {
    const request = createRequest({
      columns: { '曝光量': false, 'CPE': false, '互动量': true },
      moduleId: 'M1',
    });

    const response = await PUT(request, { params: { versionId: 'version-1' } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);

    // Should create ReviewEdit for hidden columns
    expect(mockCreate).toHaveBeenCalledTimes(2);
    // Should delete for restored columns
    expect(mockDeleteMany).toHaveBeenCalledTimes(1);
  });
});
