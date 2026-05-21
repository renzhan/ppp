import { NextRequest, NextResponse } from 'next/server';
import { presentonClient } from '@/lib/presenton-client';

/**
 * GET /api/ppt/[presentationId]/export
 * 导出 PPT 为 PPTX 文件下载
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { presentationId: string } }
) {
  try {
    const { presentationId } = params;
    const { buffer, filename } = await presentonClient.downloadPptx(presentationId);

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (error: unknown) {
    console.error('PPT export failed:', error);
    const message = error instanceof Error ? error.message : '导出 PPT 失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
