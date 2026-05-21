import { NextRequest, NextResponse } from 'next/server';
import { presentonClient } from '@/lib/presenton-client';

/**
 * GET /api/ppt/[presentationId]
 * 获取演示文稿详情（幻灯片列表、主题等）
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { presentationId: string } }
) {
  try {
    const { presentationId } = params;
    const presentation = await presentonClient.getPresentation(presentationId);

    return NextResponse.json({
      ...presentation,
      editorUrl: presentonClient.getEditorUrl(presentationId),
    });
  } catch (error: unknown) {
    console.error('Failed to get presentation:', error);
    const message = error instanceof Error ? error.message : '获取 PPT 详情失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PUT /api/ppt/[presentationId]
 * 编辑演示文稿中的指定幻灯片
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { presentationId: string } }
) {
  try {
    const { presentationId } = params;
    const body = await request.json();
    const { slides, export_as = 'pptx' } = body;

    if (!slides || !Array.isArray(slides) || slides.length === 0) {
      return NextResponse.json(
        { error: '缺少 slides 参数' },
        { status: 400 }
      );
    }

    const result = await presentonClient.editPresentation({
      presentation_id: presentationId,
      slides,
      export_as,
    });

    return NextResponse.json({
      presentationId: result.presentation_id,
      editUrl: presentonClient.getEditorUrl(result.presentation_id),
      downloadUrl: presentonClient.getDownloadUrl(result.path),
    });
  } catch (error: unknown) {
    console.error('Failed to edit presentation:', error);
    const message = error instanceof Error ? error.message : '编辑 PPT 失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
