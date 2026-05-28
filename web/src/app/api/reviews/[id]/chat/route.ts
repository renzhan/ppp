import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';
import { createLLMClientFromEnv } from '@/report/llm-client';

/**
 * POST /api/reviews/[id]/chat
 *
 * AI 审校助手 - 基于当前章节内容进行对话式优化。
 * 使用 SSE 流式返回 LLM 响应。
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { id: reviewId } = await params;
  const body = await request.json();
  const { message, context } = body;

  if (!message) {
    return new Response(JSON.stringify({ error: 'message is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const chapterTitle = context?.chapterTitle || '';
  const chapterContent = context?.chapterContent || '';

  const systemPrompt = `你是一位资深的小红书营销复盘报告审校助手。
用户正在编辑复盘报告的"${chapterTitle}"章节。

当前章节内容：
${chapterContent.slice(0, 3000)}

请根据用户的指令，对当前章节内容进行优化、润色或重写。
输出要求：
- 直接输出优化后的 HTML 内容片段
- 保持专业营销复盘语气
- 数据引用必须准确
- 不要输出解释性文字，直接给出优化后的内容`;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const llmClient = createLLMClientFromEnv();
        const response = await llmClient.chat(
          [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message },
          ],
          { timeout: 60000, temperature: 0.3 },
        );

        // Send the response as SSE chunks
        // Split into smaller chunks for streaming effect
        const chunkSize = 20;
        for (let i = 0; i < response.length; i += chunkSize) {
          const chunk = response.slice(i, i + chunkSize);
          const event = JSON.stringify({ type: 'text', content: chunk });
          controller.enqueue(encoder.encode(`data: ${event}\n\n`));
        }

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : '生成失败';
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'error', message: errorMsg })}\n\n`)
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
