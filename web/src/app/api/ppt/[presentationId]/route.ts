import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';

const PRESENTON_INTERNAL_URL = process.env.PRESENTON_INTERNAL_URL || 'http://localhost:8000';

/**
 * GET /api/ppt/[presentationId]
 *
 * 获取演示文稿详情 - 转发到 Presenton API
 *
 * 流程：
 * 1. JWT 验证（通过 getSession）
 * 2. 转发请求到 Presenton（不带 auth headers）
 * 3. 返回响应体和状态码
 *
 * Validates: Requirements 7.1, 7.2, 7.3
 */
export async function GET(
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
      `${PRESENTON_INTERNAL_URL}/api/v1/ppt/presentation/${params.presentationId}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(30_000),
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Presenton API error');
      return new Response(errorText, { status: response.status });
    }

    // 3. 返回响应体和状态码
    const data = await response.json();
    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      return new Response(
        JSON.stringify({ error: '请求超时', code: 'PRESENTON_TIMEOUT' }),
        { status: 504, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.error('PPT presentation GET proxy error:', error);
    const message = error instanceof Error ? error.message : '代理错误';
    return new Response(
      JSON.stringify({ error: message, code: 'PROXY_ERROR' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * PUT /api/ppt/[presentationId]
 *
 * 更新演示文稿 - 转发到 Presenton API
 *
 * 流程：
 * 1. JWT 验证（通过 getSession）
 * 2. 转发请求到 Presenton（不带 auth headers）
 * 3. 返回响应体和状态码
 *
 * Validates: Requirements 7.1, 7.2, 7.3
 */
export async function PUT(
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
    const body = await request.json();
    const response = await fetch(
      `${PRESENTON_INTERNAL_URL}/api/v1/ppt/presentation/${params.presentationId}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Presenton API error');
      return new Response(errorText, { status: response.status });
    }

    // 3. 返回响应体和状态码
    const data = await response.json();
    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      return new Response(
        JSON.stringify({ error: '请求超时', code: 'PRESENTON_TIMEOUT' }),
        { status: 504, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.error('PPT presentation PUT proxy error:', error);
    const message = error instanceof Error ? error.message : '代理错误';
    return new Response(
      JSON.stringify({ error: message, code: 'PROXY_ERROR' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
