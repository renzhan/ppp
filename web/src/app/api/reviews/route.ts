import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '../../../../../generated/prisma';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { DataIngestionService } from '@/ingestion/index';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json(
        { error: '未登录', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.max(1, Math.min(100, parseInt(searchParams.get('pageSize') || '20', 10)));
    const search = searchParams.get('search')?.trim();

    const where: Prisma.ReviewConfigWhereInput = {};

    // Data permission filtering
    const permissionFilter: Prisma.ProjectWhereInput | undefined =
      session.role !== 'admin'
        ? {
            OR: [
              { createdBy: session.sub },
              { participants: { has: session.sub } },
            ],
          }
        : undefined;

    if (permissionFilter) {
      where.project = permissionFilter;
    }

    if (search) {
      const matchingUsers = await prisma.user.findMany({
        where: {
          OR: [
            { displayName: { contains: search, mode: 'insensitive' } },
            { username: { contains: search, mode: 'insensitive' } },
          ],
        },
        select: { id: true },
      });
      const matchingUserIds = matchingUsers.map((u) => u.id);

      const searchConditions: Prisma.ReviewConfigWhereInput[] = [
        { project: { projectName: { contains: search, mode: 'insensitive' } } },
      ];
      if (matchingUserIds.length > 0) {
        searchConditions.push({ createdBy: { in: matchingUserIds } });
      }

      if (permissionFilter) {
        where.AND = [{ project: permissionFilter }, { OR: searchConditions }];
        delete where.project;
      } else {
        where.OR = searchConditions;
      }
    }

    const [reviews, totalItems] = await Promise.all([
      prisma.reviewConfig.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { updatedAt: 'desc' },
        include: {
          project: {
            select: {
              id: true,
              projectName: true,
              category: true,
              brand: true,
              businessLine: true,
            },
          },
        },
      }),
      prisma.reviewConfig.count({ where }),
    ]);

    // Resolve createdBy user IDs to display names
    const createdByIds = reviews.map((r) => r.createdBy).filter(Boolean);
    const uniqueCreatedByIds = Array.from(new Set(createdByIds));
    const users = uniqueCreatedByIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: uniqueCreatedByIds } },
          select: { id: true, displayName: true, username: true },
        })
      : [];
    const userMap = new Map(
      users.map((u) => [u.id, u.displayName || u.username])
    );

    const items = reviews.map((r) => ({
      id: r.id,
      projectId: r.projectId,
      projectName: r.project.projectName,
      category: r.project.category,
      brand: r.project.brand,
      businessLine: r.project.businessLine,
      status: r.status,
      createdBy: r.createdBy,
      createdByDisplayName: userMap.get(r.createdBy) || null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));

    return NextResponse.json({
      items,
      page,
      pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / pageSize),
    });
  } catch (error) {
    console.error('GET /api/reviews error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json(
        { error: '未登录', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      projectId,
      benchmark,
      influencerTiers,
      kpiTargets,
      engagementMetric,
      viralMetric,
      viralThreshold,
      modules,
      launchPhases,
      advertiserIds,
    } = body;

    if (!projectId) {
      return NextResponse.json(
        { error: '项目ID为必填项', code: 'VALIDATION_ERROR', fields: { projectId: 'projectId is required' } },
        { status: 400 }
      );
    }

    // Check project exists and has required fields for review creation
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, noteCount: true, executionStartDate: true, endDate: true, lingxiAccountId: true },
    });

    if (!project) {
      return NextResponse.json(
        { error: '项目不存在', code: 'PROJECT_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Validate project has all required fields for review creation
    const missingFields: string[] = [];
    if (!project.executionStartDate) {
      missingFields.push('开始执行日期');
    }
    if (!project.endDate) {
      missingFields.push('结束日期');
    }
    if (!project.lingxiAccountId) {
      missingFields.push('灵犀ID');
    }
    if (project.noteCount === 0) {
      missingFields.push('业务底表');
    }

    if (missingFields.length > 0) {
      return NextResponse.json(
        {
          error: `项目缺少必填信息，请先在项目设置中补充以下字段：${missingFields.join('、')}`,
          code: 'PROJECT_INCOMPLETE',
          missingFields,
        },
        { status: 400 }
      );
    }

    // Validate benchmark ranges: min ≤ max
    if (benchmark && typeof benchmark === 'object') {
      for (const [key, value] of Object.entries(benchmark)) {
        if (value && typeof value === 'object' && 'min' in value && 'max' in value) {
          const { min, max } = value as { min: number | null; max: number | null };
          if (min != null && max != null && min > max) {
            return NextResponse.json(
              { error: `大盘数据 ${key} 最小值不能大于最大值`, code: 'VALIDATION_ERROR' },
              { status: 400 }
            );
          }
          if ((min != null && min < 0) || (max != null && max < 0)) {
            return NextResponse.json(
              { error: `大盘数据 ${key} 不能为负数`, code: 'VALIDATION_ERROR' },
              { status: 400 }
            );
          }
        }
      }
    }

    // Sanitize advertiserIds: filter to valid numeric strings, limit to 5
    const sanitizedAdvertiserIds: string[] = Array.isArray(advertiserIds)
      ? advertiserIds.filter((id: unknown) => typeof id === 'string' && /^\d+$/.test(id)).slice(0, 5)
      : [];

    const reviewConfig = await prisma.reviewConfig.create({
      data: {
        projectId,
        createdBy: session.sub,
        benchmark: benchmark ?? {},
        influencerTiers: influencerTiers ?? [],
        kpiTargets: kpiTargets ?? {},
        engagementMetric: engagementMetric ?? 'exclude_follow',
        viralMetric: viralMetric ?? 'like_comment_share',
        viralThreshold: viralThreshold != null ? Math.max(1, Number(viralThreshold)) : null,
        modules: modules ?? {},
        launchPhases: launchPhases ?? [],
        advertiserIds: sanitizedAdvertiserIds,
      },
    });

    // Trigger juguang data ingestion if advertiserIds is non-empty (同步等待完成)
    if (sanitizedAdvertiserIds.length > 0) {
      // 从投流周期计算最小/最大日期
      const phases = Array.isArray(launchPhases) ? launchPhases as Array<{ startDate?: string; endDate?: string }> : [];
      const allDates = phases.flatMap((p) => [p.startDate, p.endDate]).filter((d): d is string => !!d).sort();
      const startDate = allDates[0] || '';
      const endDate = allDates[allDates.length - 1] || '';

      if (startDate && endDate) {
        const ingestionService = new DataIngestionService();
        const numericAdvertiserIds = sanitizedAdvertiserIds.map((id) => Number(id));
        console.log('[POST /api/reviews] 调用 ingestJuguangData (同步等待):', JSON.stringify({
          projectId,
          advertiserIds: numericAdvertiserIds,
          startDate,
          endDate,
          reviewConfigId: reviewConfig.id,
        }));
        try {
          const juguangResult = await ingestionService.ingestJuguangData(projectId, numericAdvertiserIds, startDate, endDate, reviewConfig.id);
          console.log('[POST /api/reviews] ingestJuguangData 完成:', JSON.stringify({
            juguangNotesCount: juguangResult.juguangNotes.length,
            errors: juguangResult.errors,
          }));
        } catch (ingestionError) {
          console.error('POST /api/reviews ingestion error:', ingestionError);
        }
      }
    }

    return NextResponse.json(reviewConfig, { status: 201 });
  } catch (error) {
    console.error('POST /api/reviews error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
