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
用户正在查看复盘报告的"${chapterTitle}"章节。

当前章节内容：
${chapterContent.slice(0, 3000)}

【意图判断】你需要判断用户消息的意图：
1. **查询类**：用户在提问、查看数据、咨询建议（如"这个数据准确吗"、"CPM多少"、"有什么建议"）→ 直接回答问题，不修改内容
2. **修改类**：用户明确要求修改、优化、重写、润色、调整内容（如"优化表达"、"把这段改成..."、"补充数据"、"删掉这一部分"）→ 修改内容并返回

【输出格式】根据意图选择对应格式：

查询类 → 输出纯 JSON：
{
  "intent": "query",
  "reply": "你的回答内容（支持中文，详细回答用户问题）"
}

修改类 → 输出纯 JSON：
{
  "intent": "modify",
  "content": "修改后的完整HTML内容片段（替换整个章节）",
  "summary": "总结修改了什么，如：修改了3处表达，补充了CPM数据对比"
}

输出规则：
- 仅输出 JSON，不要有任何前缀或后缀文字
- 修改类：content 字段为优化后的完整 HTML，summary 简要说明修改内容
- 查询类：reply 字段直接回答用户问题，专业简洁
- 保持专业营销复盘语气
- 数据引用必须准确`;

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
        let intent = 'query';
        let content = '';
        let summary = '';
        let reply = '';

        try {
          // Strip markdown code block wrappers if present
          let cleaned = response.trim();
          if (cleaned.startsWith('```json')) {
            cleaned = cleaned.replace(/^```json\s*\n?/, '').replace(/\n?```\s*$/, '');
          } else if (cleaned.startsWith('```')) {
            cleaned = cleaned.replace(/^```\s*\n?/, '').replace(/\n?```\s*$/, '');
          }

          const parsed = JSON.parse(cleaned);
          intent = parsed.intent || 'query';
          content = parsed.content || '';
          summary = parsed.summary || '';
          reply = parsed.reply || '';
        } catch {
          // If JSON parsing fails, treat as plain text reply (don't modify content)
          reply = response.trim();
          if (reply.startsWith('```')) {
            reply = reply.replace(/^```\w*\s*\n?/, '').replace(/\n?```\s*$/, '');
          }
          intent = 'query';
        }

        if (intent === 'modify' && content) {
          // Only apply changes for modify intent
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'apply', content })}\n\n`)
          );
          // Send the summary as chat message
          const summaryText = `✅ ${summary || '已完成内容修改'}`;
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'text', content: summaryText })}\n\n`)
          );
        } else {
          // Query intent — just reply, don't modify chapter
          const replyText = reply || summary || '暂无回复';
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'text', content: replyText })}\n\n`)
          );
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
