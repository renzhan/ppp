import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/projects/filters
 * Returns all distinct brand and category values from the projects table,
 * deduplicated and sorted in ascending order.
 *
 * Response:
 *   { brands: string[], categories: string[] }
 */
export async function GET() {
  try {
    const [brandRecords, categoryRecords] = await Promise.all([
      prisma.project.findMany({
        select: { brand: true },
        distinct: ['brand'],
        orderBy: { brand: 'asc' },
      }),
      prisma.project.findMany({
        select: { category: true },
        distinct: ['category'],
        orderBy: { category: 'asc' },
      }),
    ]);

    const brands = brandRecords.map((r) => r.brand).filter(Boolean);
    const categories = categoryRecords.map((r) => r.category).filter(Boolean);

    return NextResponse.json({ brands, categories });
  } catch (error) {
    console.error('GET /api/projects/filters error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
