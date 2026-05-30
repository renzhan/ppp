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

【重要】你必须严格按以下 JSON 格式输出，不要输出任何其他内容：
{
  "content": "优化后的完整HTML内容片段（替换整个章节）",
  "summary": "一句话总结你做了什么修改（中文，20字以内）"
}

输出规则：
- content 字段：输出优化后的完整 HTML 内容片段，用于直接替换当前章节
- summary 字段：简短总结修改内容，如"优化了3处表达，补充了数据对比"
- 保持专业营销复盘语气
- 数据引用必须准确
- 仅输出 JSON，不要有任何前缀或后缀文字`;

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

        // Parse the JSON response from LLM
        let content = '';
        let summary = '';

        try {
          // Strip markdown code block wrappers if present
          let cleaned = response.trim();
          if (cleaned.startsWith('```json')) {
            cleaned = cleaned.replace(/^```json\s*\n?/, '').replace(/\n?```\s*$/, '');
          } else if (cleaned.startsWith('```')) {
            cleaned = cleaned.replace(/^```\s*\n?/, '').replace(/\n?```\s*$/, '');
          }

          const parsed = JSON.parse(cleaned);
          content = parsed.content || '';
          summary = parsed.summary || '已完成修改';
        } catch {
          // If JSON parsing fails, treat entire response as content
          content = response.trim();
          if (content.startsWith('```html')) {
            content = content.replace(/^```html\s*\n?/, '').replace(/\n?```\s*$/, '');
          } else if (content.startsWith('```')) {
            content = content.replace(/^```\s*\n?/, '').replace(/\n?```\s*$/, '');
          }
          summary = '已完成内容优化';
        }

        // Send the updated content for the chapter
        if (content) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'apply', content })}\n\n`)
          );
        }

        // Send the summary as chat message
        const summaryText = `✅ ${summary}`;
        const event = JSON.stringify({ type: 'text', content: summaryText });
        controller.enqueue(encoder.encode(`data: ${event}\n\n`));

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
