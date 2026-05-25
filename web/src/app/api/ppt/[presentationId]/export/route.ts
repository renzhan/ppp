import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';

const PRESENTON_INTERNAL_URL = process.env.PRESENTON_INTERNAL_URL || 'http://localhost:8000';

/**
 * POST /api/ppt/[presentationId]/export
 *
 * 导出 PPTX 文件 - 转发到 Presenton Export API
 *
 * 流程：
 * 1. JWT 验证（通过 getSession）
 * 2. 转发请求到 Presenton（不带 auth headers）
 * 3. 返回 PPTX 文件响应
 *
 * 超时：120 秒
 *
 * Validates: Requirements 7.1, 7.4
 */
export const maxDuration = 120;

export async function POST(
  request: NextRequest,
  { params }: { params: { presentationId: string } }
) {
  // 1. JWT 验证
  const session = await getSession(request);
  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    // 2. 转发到 Presenton（不带 auth headers）
    const response = await fetch(
      `${PRESENTON_INTERNAL_URL}/api/v1/ppt/presentation/export/pptx`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presentation_id: params.presentationId }),
        signal: AbortSignal.timeout(120_000),
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Presenton Export API error');
      return new Response(errorText, { status: response.status });
    }

    // 3. 返回 PPTX 文件响应
    const contentType = response.headers.get('Content-Type') || 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    const contentDisposition = response.headers.get('Content-Disposition');

    const headers: Record<string, string> = {
      'Content-Type': contentType,
    };

    if (contentDisposition) {
      headers['Content-Disposition'] = contentDisposition;
    }

    return new Response(response.body, {
      status: response.status,
      headers,
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      return new Response(
        JSON.stringify({ error: 'PPTX 导出请求超时', code: 'PRESENTON_TIMEOUT' }),
        { status: 504, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.error('PPT export proxy error:', error);
    const message = error instanceof Error ? error.message : 'PPTX 导出代理错误';
    return new Response(
      JSON.stringify({ error: message, code: 'PROXY_ERROR' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
