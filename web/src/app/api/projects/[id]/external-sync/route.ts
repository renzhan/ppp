import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { transitionStatus } from '@/project/status-machine';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const project = await prisma.project.findUnique({
      where: { id: params.id },
      select: { id: true, brand: true, category: true, projectType: true, executionStartDate: true, endDate: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const payload = {
      provider: '灵犀千瓜',
      source: 'external-sync',
      brand: project.brand,
      category: project.category,
      projectType: project.projectType,
    };

    await prisma.lingxiData.create({
      data: {
        projectId: project.id,
        dataType: 'brand',
        dataContent: payload as object,
        periodStart: project.executionStartDate,
        periodEnd: project.endDate,
      },
    });

    await transitionStatus(project.id, 'first_upload');

    return NextResponse.json({ success: true, provider: '灵犀千瓜', recordCount: 1 });
  } catch (error) {
    console.error('POST /api/projects/[id]/external-sync error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
