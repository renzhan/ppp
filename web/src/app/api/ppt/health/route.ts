import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';

const PRESENTON_INTERNAL_URL = process.env.PRESENTON_INTERNAL_URL || 'http://localhost:8000';

/**
 * GET /api/ppt/health
 *
 * 健康检查路由 - 检查 Presenton 服务状态
 *
 * 流程：
 * 1. JWT 验证（通过 getSession）
 * 2. 转发请求到 Presenton 健康检查端点
 * 3. 返回服务状态
 *
 * 超时：5 秒
 *
 * Validates: Requirements 1.3
 */
export async function GET(request: NextRequest) {
  // 1. JWT 验证
  const session = await getSession(request);
  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    // 2. 转发到 Presenton 健康检查端点
    const response = await fetch(
      `${PRESENTON_INTERNAL_URL}/api/v1/health`,
      {
        method: 'GET',
        signal: AbortSignal.timeout(5_000),
      }
    );

    if (!response.ok) {
      return new Response(
        JSON.stringify({ status: 'unavailable', code: 'PRESENTON_UNAVAILABLE' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 3. 返回健康状态
    const data = await response.json();
    return new Response(
      JSON.stringify({ status: 'ok', ...data }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      return new Response(
        JSON.stringify({ status: 'unavailable', code: 'PRESENTON_TIMEOUT' }),
        { status: 504, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.error('PPT health check proxy error:', error);
    return new Response(
      JSON.stringify({ status: 'unavailable', code: 'PRESENTON_UNAVAILABLE' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
