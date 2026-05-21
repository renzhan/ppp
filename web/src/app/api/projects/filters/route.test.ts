import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the prisma client
vi.mock('@/lib/prisma', () => ({
  prisma: {
    project: {
      findMany: vi.fn(),
    },
  },
}));

import { GET } from './route';
import { prisma } from '@/lib/prisma';

const mockFindMany = prisma.project.findMany as ReturnType<typeof vi.fn>;

describe('GET /api/projects/filters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns distinct brands and categories sorted in ascending order', async () => {
    mockFindMany
      .mockResolvedValueOnce([
        { brand: '蒙牛' },
        { brand: '农夫山泉' },
        { brand: '奈雪' },
      ])
      .mockResolvedValueOnce([
        { category: '乳制品' },
        { category: '茶饮' },
        { category: '饮用水' },
      ]);

    const response = await GET();
    const data = await response.json();

    expect(data).toEqual({
      brands: ['蒙牛', '农夫山泉', '奈雪'],
      categories: ['乳制品', '茶饮', '饮用水'],
    });
  });

  it('calls prisma with correct distinct and orderBy parameters', async () => {
    mockFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await GET();

    expect(mockFindMany).toHaveBeenCalledTimes(2);
    expect(mockFindMany).toHaveBeenCalledWith({
      select: { brand: true },
      distinct: ['brand'],
      orderBy: { brand: 'asc' },
    });
    expect(mockFindMany).toHaveBeenCalledWith({
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    });
  });

  it('returns empty arrays when no projects exist', async () => {
    mockFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const response = await GET();
    const data = await response.json();

    expect(data).toEqual({ brands: [], categories: [] });
  });

  it('returns 500 on database error', async () => {
    mockFindMany.mockRejectedValueOnce(new Error('DB connection failed'));

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: 'Internal server error' });
  });

  it('filters out falsy brand/category values', async () => {
    mockFindMany
      .mockResolvedValueOnce([
        { brand: '蒙牛' },
        { brand: '' },
        { brand: '奈雪' },
      ])
      .mockResolvedValueOnce([
        { category: '' },
        { category: '茶饮' },
      ]);

    const response = await GET();
    const data = await response.json();

    expect(data).toEqual({
      brands: ['蒙牛', '奈雪'],
      categories: ['茶饮'],
    });
  });
});
