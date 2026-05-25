import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';

const PRESENTON_INTERNAL_URL = process.env.PRESENTON_INTERNAL_URL || 'http://localhost:8000';

/**
 * GET /api/ppt/presentation/stream/[id]
 *
 * PPT 流式生成代理路由 - SSE 透传 Presenton 的逐页生成响应
 *
 * 流程：
 * 1. JWT 验证（通过 getSession）
 * 2. 转发请求到 Presenton（不带 auth headers）
 * 3. Streaming 响应透传（text/event-stream），不缓冲
 *
 * 超时：300 秒（PPT 生成可能较慢）
 *
 * Validates: Requirements 5.3, 7.1, 7.5
 */
export const maxDuration = 300;

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // 1. JWT 验证
  const session = await getSession(request);
  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    // 2. 转发到 Presenton（不带 auth headers）
    const response = await fetch(
      `${PRESENTON_INTERNAL_URL}/api/v1/ppt/presentation/stream/${params.id}`,
      {
        method: 'GET',
        headers: { 'Accept': 'text/event-stream' },
        signal: AbortSignal.timeout(300_000),
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Presenton Stream API error');
      return new Response(errorText, { status: response.status });
    }

    // 3. Streaming 透传（不缓冲）
    return new Response(response.body, {
      status: response.status,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      return new Response(
        JSON.stringify({ error: 'PPT 生成流式请求超时', code: 'PRESENTON_TIMEOUT' }),
        { status: 504, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.error('PPT Stream proxy error:', error);
    const message = error instanceof Error ? error.message : 'PPT 流式生成代理错误';
    return new Response(
      JSON.stringify({ error: message, code: 'PROXY_ERROR' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
