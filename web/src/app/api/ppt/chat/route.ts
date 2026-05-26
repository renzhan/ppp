import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';

const PRESENTON_INTERNAL_URL = process.env.PRESENTON_INTERNAL_URL || 'http://localhost:8000';

/**
 * POST /api/ppt/chat
 *
 * AI Chat 代理路由 - 将请求转发到 Presenton Chat API（streaming）
 *
 * 流程：
 * 1. JWT 验证（通过 getSession）
 * 2. 转发请求到 Presenton（不带 auth headers）
 * 3. Streaming 响应透传（text/event-stream）
 *
 * 超时：60 秒
 */
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  // 1. JWT 验证
  const session = await getSession(request);
  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    // 2. 转发到 Presenton（不带 auth headers）
    const body = await request.json();

    // 前端使用 camelCase，后端使用 snake_case，在此做字段映射
    const backendBody: Record<string, unknown> = {
      message: body.message,
      presentation_id: body.presentationId ?? body.presentation_id,
    };
    if (body.conversationId ?? body.conversation_id) {
      backendBody.conversation_id = body.conversationId ?? body.conversation_id;
    }

    const response = await fetch(
      `${PRESENTON_INTERNAL_URL}/api/v1/ppt/chat/message/stream`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(backendBody),
        signal: AbortSignal.timeout(60_000),
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Presenton Chat API error');
      return new Response(errorText, { status: response.status });
    }

    // 3. Streaming 透传
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
        JSON.stringify({ error: 'AI Chat 请求超时', code: 'PRESENTON_TIMEOUT' }),
        { status: 504, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.error('PPT Chat proxy error:', error);
    const message = error instanceof Error ? error.message : 'AI Chat 代理错误';
    return new Response(
      JSON.stringify({ error: message, code: 'PROXY_ERROR' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
