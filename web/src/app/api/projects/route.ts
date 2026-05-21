import { NextResponse } from 'next/server';
import { Prisma } from '../../../../../generated/prisma';
import { prisma } from '@/lib/prisma';
import {
  PROJECT_TYPES,
  createEmptyLaunchPhases,
  getProjectDateRange,
  isProjectType,
  normalizeLaunchPhases,
} from '@/lib/project-meta';

function buildStatusFilter(status: string) {
  if (status === 'draft') {
    return { in: ['draft', 'uploading'] };
  }

  return status;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.max(1, Math.min(100, parseInt(searchParams.get('pageSize') || '20', 10)));
    const brand = searchParams.get('brand');
    const category = searchParams.get('category');
    const projectType = searchParams.get('projectType');
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const where: Prisma.ProjectWhereInput = {};

    if (brand) {
      where.brand = brand;
    }
    if (category) {
      where.category = category;
    }
    if (projectType) {
      where.projectType = projectType;
    }
    if (search) {
      where.OR = [
        { projectName: { contains: search, mode: 'insensitive' } },
        { brand: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (status) {
      where.status = buildStatusFilter(status);
    }

    const [items, totalItems] = await Promise.all([
      prisma.project.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          reportVersions: {
            orderBy: [{ versionNumber: 'desc' }],
            take: 1,
            select: {
              id: true,
              versionNumber: true,
              status: true,
              generatedAt: true,
            },
          },
        },
      }),
      prisma.project.count({ where }),
    ]);

    return NextResponse.json({
      items,
      page,
      pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / pageSize),
    });
  } catch (error) {
    console.error('GET /api/projects error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const projectName = typeof body.projectName === 'string' ? body.projectName.trim() : '';
    const brand = typeof body.brand === 'string' ? body.brand.trim() : '';
    const category = typeof body.category === 'string' ? body.category.trim() : '';
    const spuName = typeof body.spuName === 'string' ? body.spuName.trim() : '';
    const projectType = typeof body.projectType === 'string' ? body.projectType.trim() : '';
    const launchPhases = normalizeLaunchPhases(body.launchPhases ?? createEmptyLaunchPhases());

    const missingFields: Record<string, string> = {};
    if (!category) missingFields.category = 'category is required';
    if (!brand) missingFields.brand = 'brand is required';
    if (!projectName) missingFields.projectName = 'projectName is required';
    if (!projectType) missingFields.projectType = 'projectType is required';

    for (const phase of Object.entries(launchPhases)) {
      const [key, range] = phase;
      if (!range.startDate) {
        missingFields[`${key}.startDate`] = `${key}.startDate is required`;
      }
      if (!range.endDate) {
        missingFields[`${key}.endDate`] = `${key}.endDate is required`;
      }
    }

    if (Object.keys(missingFields).length > 0) {
      return NextResponse.json(
        { error: 'Missing required fields', fields: missingFields },
        { status: 400 }
      );
    }

    if (!isProjectType(projectType)) {
      return NextResponse.json(
        {
          error: 'Invalid projectType',
          fields: { projectType: `projectType must be one of: ${PROJECT_TYPES.join(', ')}` },
        },
        { status: 400 }
      );
    }

    const parsedLaunchPhases = Object.fromEntries(
      Object.entries(launchPhases).map(([key, range]) => {
        const startDate = new Date(range.startDate);
        const endDate = new Date(range.endDate);

        if (Number.isNaN(startDate.getTime())) {
          throw new Error(`${key}.startDate`);
        }
        if (Number.isNaN(endDate.getTime())) {
          throw new Error(`${key}.endDate`);
        }
        if (startDate > endDate) {
          throw new Error(`${key}.range`);
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

    const { startDate, endDate } = getProjectDateRange(launchPhases);
    const project = await prisma.project.create({
      data: {
        category,
        brand,
        spuName: spuName || null,
        projectName,
        projectType,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        launchPhases: parsedLaunchPhases as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.endsWith('.startDate') || error.message.endsWith('.endDate')) {
        return NextResponse.json(
          {
            error: 'Invalid launch phase date',
            fields: { [error.message]: `${error.message} must be a valid date` },
          },
          { status: 400 }
        );
      }
      if (error.message.endsWith('.range')) {
        const phase = error.message.replace('.range', '');
        return NextResponse.json(
          {
            error: 'Invalid launch phase date range',
            fields: { [phase]: `${phase} startDate must be before endDate` },
          },
          { status: 400 }
        );
      }
    }

    console.error('POST /api/projects error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
