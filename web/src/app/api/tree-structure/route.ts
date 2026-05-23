import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { buildTreeStructure } from '@/lib/tree-builder';

export async function GET() {
  try {
    const rows = await prisma.projectTreeNode.findMany({
      select: {
        category: true,
        brand: true,
        businessLine: true,
      },
      orderBy: [
        { category: 'asc' },
        { brand: 'asc' },
        { businessLine: 'asc' },
      ],
    });

    const tree = buildTreeStructure(rows);

    return NextResponse.json(tree);
  } catch (error) {
    console.error('GET /api/tree-structure error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
