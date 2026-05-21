import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * PUT /api/review/[versionId]/ppt
 * 更新报告版本中的 PPT 信息（当从审校页面重新生成 PPT 时调用）
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { versionId: string } }
) {
  try {
    const { versionId } = params;
    const body = await request.json();
    const { presentationId, editUrl, downloadUrl } = body;

    const version = await prisma.reportVersion.findUnique({
      where: { id: versionId },
    });

    if (!version) {
      return NextResponse.json({ error: '版本不存在' }, { status: 404 });
    }

    // 合并 PPT 信息到现有 config
    const existingConfig = (version.config as Record<string, unknown>) || {};
    const updatedConfig = {
      ...existingConfig,
      ppt: {
        presentationId,
        editUrl,
        downloadUrl,
      },
    };

    await prisma.reportVersion.update({
      where: { id: versionId },
      data: { config: updatedConfig },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PUT /api/review/[versionId]/ppt error:', error);
    return NextResponse.json({ error: '更新 PPT 信息失败' }, { status: 500 });
  }
}
