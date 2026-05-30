import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '../../../../../generated/prisma';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.max(1, Math.min(100, parseInt(searchParams.get('pageSize') || '20', 10)));
    const brand = searchParams.get('brand');
    const category = searchParams.get('category');
    const projectType = searchParams.get('projectType');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const businessLine = searchParams.get('businessLine');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const createdBy = searchParams.get('createdBy');
    const isImported = searchParams.get('isImported');

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
    if (businessLine) {
      where.businessLine = businessLine;
    }
    if (dateFrom || dateTo) {
      where.startDate = {};
      if (dateFrom) {
        where.startDate.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.startDate.lte = new Date(dateTo);
      }
    }
    if (createdBy) {
      where.createdBy = createdBy;
    }
    if (isImported === 'true') {
      where.isImported = true;
    }

    // Data permission filtering
    const session = await getSession(request);
    if (session && session.role !== 'admin') {
      where.OR = [
        ...(where.OR || []),
        { createdBy: session.sub },
        { participants: { has: session.sub } },
      ];
    }

    const [items, totalItems] = await Promise.all([
      prisma.project.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { startDate: 'desc' },
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

    // Resolve createdBy user IDs to display names
    const createdByIds = items.map(item => item.createdBy).filter((id): id is string => id != null);
    const uniqueCreatedByIds = Array.from(new Set(createdByIds));
    const users = uniqueCreatedByIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: uniqueCreatedByIds } },
          select: { id: true, displayName: true, username: true },
        })
      : [];
    const userMap = new Map(users.map((u: { id: string; displayName: string | null; username: string }) => [u.id, u.displayName || u.username]));

    const enrichedItems = items.map((item) => ({
      ...item,
      createdByDisplayName: item.createdBy ? userMap.get(item.createdBy) || null : null,
    }));

    return NextResponse.json({
      items: enrichedItems,
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
    const businessLine = typeof body.businessLine === 'string' ? body.businessLine.trim() : '';
    const createdBy = typeof body.createdBy === 'string' ? body.createdBy.trim() : '';
    const participants = Array.isArray(body.participants) ? body.participants.filter((p: unknown) => typeof p === 'string') : [];

    // Support direct startDate field (new form) or launchPhases (legacy form)
    const hasDirectStartDate = typeof body.startDate === 'string' && body.startDate.trim();
    const hasLaunchPhases = body.launchPhases || body.projectType;

    const missingFields: Record<string, string> = {};
    if (!category) missingFields.category = 'category is required';
    if (!brand) missingFields.brand = 'brand is required';
    if (!projectName) missingFields.projectName = 'projectName is required';

    // Legacy form requires projectType and launchPhases
    if (hasLaunchPhases && !hasDirectStartDate) {
      if (!projectType) missingFields.projectType = 'projectType is required';

      const launchPhases = normalizeLaunchPhases(body.launchPhases ?? createEmptyLaunchPhases());
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
          businessLine: businessLine || null,
          createdBy: createdBy || null,
          participants,
        },
      });

      return NextResponse.json(project, { status: 201 });
    }

    // New form: direct startDate, no projectType/launchPhases required
    if (!hasDirectStartDate) {
      missingFields.startDate = 'startDate is required';
    }

    if (Object.keys(missingFields).length > 0) {
      return NextResponse.json(
        { error: 'Missing required fields', fields: missingFields },
        { status: 400 }
      );
    }

    const startDate = new Date(body.startDate.trim());
    if (Number.isNaN(startDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid startDate', fields: { startDate: 'startDate must be a valid date' } },
        { status: 400 }
      );
    }

    const project = await prisma.project.create({
      data: {
        category,
        brand,
        businessLine: businessLine || null,
        spuName: spuName || null,
        projectName,
        projectType: projectType || undefined,
        startDate,
        endDate: body.endDate ? new Date(body.endDate) : startDate,
        executionStartDate: body.executionStartDate ? new Date(body.executionStartDate) : null,
        createdBy: createdBy || null,
        participants,
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
