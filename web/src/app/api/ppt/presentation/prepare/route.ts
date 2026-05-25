import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';

const PRESENTON_INTERNAL_URL = process.env.PRESENTON_INTERNAL_URL || 'http://localhost:8000';

/**
 * POST /api/ppt/presentation/prepare
 *
 * PPT 准备代理路由 - 创建演示文稿记录，返回 presentationId
 *
 * 流程：
 * 1. JWT 验证（通过 getSession）
 * 2. 转发请求到 Presenton（不带 auth headers）
 * 3. 返回 JSON 响应（包含 { id: string }）
 *
 * 超时：30 秒
 */
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  // 1. JWT 验证
  const session = await getSession(request);
  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    // 2. 转发到 Presenton（不带 auth headers）
    const body = await request.json();
    const response = await fetch(
      `${PRESENTON_INTERNAL_URL}/api/v1/ppt/presentation/prepare`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Presenton Prepare API error');
      return new Response(errorText, { status: response.status });
    }

    // 3. 返回 JSON 响应
    const data = await response.json();
    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      return new Response(
        JSON.stringify({ error: 'PPT 准备请求超时', code: 'PRESENTON_TIMEOUT' }),
        { status: 504, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.error('PPT Prepare proxy error:', error);
    const message = error instanceof Error ? error.message : 'PPT 准备代理错误';
    return new Response(
      JSON.stringify({ error: message, code: 'PROXY_ERROR' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
