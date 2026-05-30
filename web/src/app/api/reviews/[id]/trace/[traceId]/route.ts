import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

/**
 * GET /api/reviews/[id]/trace/[traceId]?page=1&pageSize=10
 *
 * 获取段落级溯源数据（分页）。
 * 返回该 traceId 对应的原始数据行（分页）+ 计算公式。
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; traceId: string }> }
) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { id: reviewConfigId, traceId } = await params;

    // Parse pagination params
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get('pageSize') || '10', 10)));

    // Find the trace item
    const traceItem = await prisma.reportTraceItem.findUnique({
      where: {
        reviewConfigId_traceId: {
          reviewConfigId,
          traceId,
        },
      },
    });

    if (!traceItem) {
      return NextResponse.json(
        { error: '溯源数据不存在', traceId },
        { status: 404 }
      );
    }

    // Paginate data rows
    const allRows = traceItem.dataRows as Record<string, unknown>[];
    const totalRows = allRows.length;
    const totalPages = Math.ceil(totalRows / pageSize);
    const startIdx = (page - 1) * pageSize;
    const rows = allRows.slice(startIdx, startIdx + pageSize);

    return NextResponse.json({
      traceId: traceItem.traceId,
      chapterNumber: traceItem.chapterNumber,
      label: traceItem.label,
      sourceTable: traceItem.sourceTable,
      sourceQuery: traceItem.sourceQuery,
      columns: traceItem.columns,
      rows,
      pagination: {
        page,
        pageSize,
        totalPages,
        totalRows,
      },
      calculations: traceItem.calculations || [],
    });
  } catch (error) {
    console.error('GET /api/reviews/[id]/trace/[traceId] error:', error);
    return NextResponse.json(
      { error: '获取溯源数据失败' },
      { status: 500 }
    );
  }
}
