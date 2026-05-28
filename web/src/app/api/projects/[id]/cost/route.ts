import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

/**
 * GET /api/projects/[id]/cost?contentCaliber=consumption|settlement&trafficCaliber=consumption|settlement
 *
 * 实时计算项目总费用，支持两种口径：
 * - 内容金额口径：
 *   - consumption（消耗）= SUM(蒲公英.博主报价 + 蒲公英.平台服务费)
 *   - settlement（结算）= SUM(业务底表.内容结算金额)
 * - 投流金额口径：
 *   - consumption（消耗）= SUM(聚光.fee)
 *   - settlement（结算）= SUM(业务底表.投流结算金额)
 *
 * 总费用 = 内容费用 + 投流费用
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { id: projectId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const contentCaliber = searchParams.get('contentCaliber') || 'consumption';
    const trafficCaliber = searchParams.get('trafficCaliber') || 'consumption';

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 });
    }

    let contentCost: number;
    let trafficCost: number;

    // 内容费用计算
    if (contentCaliber === 'settlement') {
      // 结算口径：SUM(业务底表.content_settlement)
      const result = await prisma.$queryRaw<[{ total: number | null }]>`
        SELECT COALESCE(SUM(content_settlement), 0)::float AS total
        FROM note_base WHERE project_id = ${projectId}::uuid
      `;
      contentCost = result[0]?.total ?? 0;
    } else {
      // 消耗口径：SUM(蒲公英.kol_price + 蒲公英.service_fee)
      const result = await prisma.$queryRaw<[{ total: number | null }]>`
        SELECT COALESCE(SUM(kol_price + service_fee), 0)::float AS total
        FROM notes WHERE project_id = ${projectId}::uuid
      `;
      contentCost = result[0]?.total ?? 0;
    }

    // 投流费用计算
    if (trafficCaliber === 'settlement') {
      // 结算口径：SUM(业务底表.ad_spend)
      const result = await prisma.$queryRaw<[{ total: number | null }]>`
        SELECT COALESCE(SUM(ad_spend), 0)::float AS total
        FROM note_base WHERE project_id = ${projectId}::uuid
      `;
      trafficCost = result[0]?.total ?? 0;
    } else {
      // 消耗口径：SUM(聚光.fee)
      const result = await prisma.$queryRaw<[{ total: number | null }]>`
        SELECT COALESCE(SUM(fee), 0)::float AS total
        FROM juguang_data WHERE project_id = ${projectId}::uuid
      `;
      trafficCost = result[0]?.total ?? 0;
    }

    return NextResponse.json({
      contentCost,
      trafficCost,
      totalCost: contentCost + trafficCost,
      contentCaliber,
      trafficCaliber,
    });
  } catch (error) {
    console.error('GET /api/projects/[id]/cost error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
