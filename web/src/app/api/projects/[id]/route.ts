import { NextResponse } from 'next/server';
import { Prisma } from '../../../../../../generated/prisma';
import { prisma } from '@/lib/prisma';
import {
  PROJECT_TYPES,
  createEmptyLaunchPhases,
  getProjectDateRange,
  isProjectType,
  normalizeLaunchPhases,
} from '@/lib/project-meta';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const project = await prisma.project.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: {
            notes: true,
            reportVersions: true,
            metricRatings: true,
            reviewEdits: true,
          },
        },
        reportVersions: {
          orderBy: [{ versionNumber: 'desc' }],
          select: {
            id: true,
            versionNumber: true,
            status: true,
            generatedAt: true,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json(project);
  } catch (error) {
    console.error('GET /api/projects/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const existing = await prisma.project.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const body = await request.json();
    const updateData: Prisma.ProjectUpdateInput = {
      updatedAt: new Date(),
    };

    if (body.projectName !== undefined) {
      updateData.projectName = body.projectName;
    }
    if (body.brand !== undefined) {
      updateData.brand = body.brand;
    }
    if (body.category !== undefined) {
      updateData.category = body.category;
    }
    if (body.spuName !== undefined) {
      updateData.spuName = body.spuName || null;
    }
    if (body.projectType !== undefined) {
      if (!isProjectType(body.projectType)) {
        return NextResponse.json(
          {
            error: 'Invalid projectType',
            fields: { projectType: `projectType must be one of: ${PROJECT_TYPES.join(', ')}` },
          },
          { status: 400 }
        );
      }
      updateData.projectType = body.projectType;
    }

    if (body.launchPhases !== undefined) {
      const launchPhases = normalizeLaunchPhases(body.launchPhases ?? createEmptyLaunchPhases());
      const normalized = Object.fromEntries(
        Object.entries(launchPhases).map(([key, range]) => {
          const startDate = new Date(range.startDate);
          const endDate = new Date(range.endDate);

          if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate > endDate) {
            throw new Error(`invalid_launch_phase:${key}`);
          }

          return [
            key,
            {
              startDate: range.startDate,
              endDate: range.endDate,
            },
          ];
        })
      );

      const range = getProjectDateRange(launchPhases);
      updateData.launchPhases = normalized as Prisma.InputJsonValue;
      if (range.startDate) updateData.executionStartDate = new Date(range.startDate);
      if (range.endDate) updateData.endDate = new Date(range.endDate);
    } else {
      if (body.endDate !== undefined) {
        if (body.endDate === null || body.endDate === '') {
          updateData.endDate = null;
        } else {
          const endDate = new Date(body.endDate);
          if (Number.isNaN(endDate.getTime())) {
            return NextResponse.json(
              { error: 'Invalid endDate format', fields: { endDate: 'endDate must be a valid date' } },
              { status: 400 }
            );
          }
          updateData.endDate = endDate;
        }
      }
    }

    if (body.engagementConfig !== undefined) {
      updateData.engagementConfig = body.engagementConfig as Prisma.InputJsonValue;
    }
    if (body.cooperationPolicy !== undefined) {
      updateData.cooperationPolicy = body.cooperationPolicy as Prisma.InputJsonValue;
    }
    if (body.businessLine !== undefined) {
      updateData.businessLine = body.businessLine || null;
    }
    if (body.executionStartDate !== undefined) {
      updateData.executionStartDate = body.executionStartDate ? new Date(body.executionStartDate) : null;
    }
    if (body.participants !== undefined) {
      updateData.participants = Array.isArray(body.participants) ? body.participants : [];
    }
    if (body.lingxiAccountId !== undefined) {
      updateData.lingxiAccountId = typeof body.lingxiAccountId === 'string' ? body.lingxiAccountId.trim() || null : null;
    }
    if (body.lingxiTaxonomyCode !== undefined) {
      updateData.lingxiTaxonomyCode = typeof body.lingxiTaxonomyCode === 'string' ? body.lingxiTaxonomyCode.trim() || null : null;
    }
    if (body.lingxiTaxonomyPath !== undefined) {
      updateData.lingxiTaxonomyPath = typeof body.lingxiTaxonomyPath === 'string' ? body.lingxiTaxonomyPath.trim() || null : null;
    }

    const updated = await prisma.project.update({
      where: { id: params.id },
      data: updateData,
    });

    // 灵犀同步条件检查：ALL 5 conditions must be met
    // - lingxiAccountId non-empty (from DB after update)
    // - lingxiTaxonomyPath non-empty (from DB after update)
    // - executionStartDate filled (from DB after update)
    // - endDate filled (from DB after update)
    // - noteCount > 0 (project already has uploaded notes)
    const lingxiAccountIdFilled = updated.lingxiAccountId && updated.lingxiAccountId.trim();
    const lingxiTaxonomyPathFilled = updated.lingxiTaxonomyPath && updated.lingxiTaxonomyPath.trim();
    const executionStartDateFilled = updated.executionStartDate;
    const endDateFilled = updated.endDate;
    const hasNotes = updated.noteCount && updated.noteCount > 0;

    const shouldTriggerLingxiSync = !!(
      lingxiAccountIdFilled &&
      lingxiTaxonomyPathFilled &&
      executionStartDateFilled &&
      endDateFilled &&
      hasNotes
    );

    if (shouldTriggerLingxiSync) {
      try {
        const { DataIngestionService } = await import('@/ingestion/index');
        const ingestionService = new DataIngestionService();
        console.log(`[ProjectUpdate] 触发灵犀同步 (project: ${params.id})`);
        await ingestionService.ingestBaseData(params.id);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[ProjectUpdate] 灵犀同步异常 (project: ${params.id}):`, msg);
      }
    }

    return NextResponse.json(updated);
  } catch (error) {
    // Handle unique constraint violation (P2002)
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return NextResponse.json(
        { error: '该品类+品牌+业务线+项目名称组合已存在' },
        { status: 409 }
      );
    }

    if (error instanceof Error && error.message.startsWith('invalid_launch_phase:')) {
      const phase = error.message.split(':')[1];
      return NextResponse.json(
        {
          error: 'Invalid launch phase date range',
          fields: { [phase]: `${phase} startDate must be before endDate` },
        },
        { status: 400 }
      );
    }

    console.error('PUT /api/projects/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const existing = await prisma.project.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Cascade delete all related data
    await prisma.$transaction([
      prisma.note.deleteMany({ where: { projectId: params.id } }),
      prisma.juguangData.deleteMany({ where: { projectId: params.id } }),
      prisma.businessAnnotation.deleteMany({ where: { projectId: params.id } }),
      prisma.lingxiData.deleteMany({ where: { projectId: params.id } }),
      prisma.manualInput.deleteMany({ where: { projectId: params.id } }),
      prisma.kpiTarget.deleteMany({ where: { projectId: params.id } }),
      prisma.calculatedMetric.deleteMany({ where: { projectId: params.id } }),
      prisma.aiGeneratedContent.deleteMany({ where: { projectId: params.id } }),
      prisma.competitorData.deleteMany({ where: { projectId: params.id } }),
      prisma.reviewEdit.deleteMany({ where: { projectId: params.id } }),
      prisma.moduleDecision.deleteMany({ where: { projectId: params.id } }),
      prisma.metricRatingRecord.deleteMany({ where: { projectId: params.id } }),
      prisma.reportVersion.deleteMany({ where: { projectId: params.id } }),
      prisma.project.delete({ where: { id: params.id } }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/projects/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
  }
}
