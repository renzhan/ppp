import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { createLLMClientFromEnv } from '@/report/llm-client';
import { createChapterDataLoaderRegistry } from '@/pipeline/loaders/index';
import { PromptTemplateLoader } from '@/pipeline/template-loader';
import type { ChatMessage } from '@/shared/types';
import path from 'path';

export const maxDuration = 300; // 5 minutes

/**
 * 章节定义 - id 用于前端去重/追加
 */
const CHAPTER_DEFS: Array<{ id: string; number: number }> = [
  { id: 'cover', number: 1 },
  { id: 'projectReview', number: 2 },
  { id: 'dataOverview', number: 3 },
  { id: 'highlights', number: 4 },
  { id: 'quadrantAnalysis', number: 5 },
  { id: 'contentAnalysis', number: 6 },
  { id: 'trafficAnalysis', number: 7 },
  { id: 'audienceAssets', number: 8 },
  { id: 'optimization', number: 9 },
  { id: 'endPage', number: 10 },
];

/** 静态章节（封面、尾页）不调用 LLM */
const STATIC_CHAPTERS = new Set([1, 10]);

/**
 * 全局 HTML 输出格式规范 - 追加到每个章节的 system prompt 后面
 */
const HTML_OUTPUT_INSTRUCTION = `

【HTML输出格式规范】请直接输出纯HTML片段（不含<!DOCTYPE>、<html>、<head>、<body>标签）。严格遵守：
1. 章节标题用 <h2 class="chapter-title">，子标题用 <h3>
2. 数据表格用 <table class="report-table">，表头用 <thead>，数据行用 <tbody>
3. 需要图表展示的数据，在表格后添加图表占位：
   <div class="chart-placeholder" data-chart-type="bar|pie|line" data-chart-title="图表标题" data-chart-data='JSON数据'>图表加载中...</div>
   其中 data-chart-data 为 JSON 格式：{"labels":["A","B"],"values":[100,200]} 或 {"items":[{"name":"A","value":100}]}
4. 重要数据用 <strong class="highlight"> 标记
5. 分析段落用 <p>，列表用 <ul>/<li> 或 <ol>/<li>
6. 完成率超过100%的用 <span class="text-green">，低于100%的用 <span class="text-red">
7. 语言专业简洁，必须引用具体数据，使用营销行业术语
8. 仅输出HTML片段，不要包含任何解释性文字或markdown语法`;

/**
 * GET /api/generate-report/[reviewConfigId]/stream
 *
 * SSE 流式生成复盘报告，按章节逐步输出。
 * 每个章节独立加载数据（loaders）+ 填充提示词模板（prompts）+ 调用LLM生成HTML。
 *
 * Event types:
 * - { type: 'start', totalChapters: number }
 * - { type: 'chapter', chapter: { id, title, number, content } }
 * - { type: 'done', chapters: [...] }
 * - { type: 'error', message: string }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ reviewConfigId: string }> }
) {
  const session = await getSession(request);
  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { reviewConfigId } = await params;

  // Validate
  const reviewConfig = await prisma.reviewConfig.findUnique({
    where: { id: reviewConfigId },
    select: { id: true, projectId: true },
  });

  if (!reviewConfig) {
    return new Response(JSON.stringify({ error: 'ReviewConfig not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const project = await prisma.project.findUnique({
    where: { id: reviewConfig.projectId },
    select: { id: true, projectName: true },
  });

  if (!project) {
    return new Response(JSON.stringify({ error: 'Project not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Mark as generating
  await prisma.reviewConfig.update({
    where: { id: reviewConfigId },
    data: { status: 'generating' },
  });

  // Create SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        // Initialize pipeline components
        const loaderRegistry = createChapterDataLoaderRegistry(prisma as any);
        const templatesDir = path.resolve(process.cwd(), '..', 'src', 'prompts', 'chapters');
        const templateLoader = new PromptTemplateLoader(templatesDir);
        const llmClient = createLLMClientFromEnv();

        send({ type: 'start', totalChapters: CHAPTER_DEFS.length });

        const completedChapters: Array<{ id: string; title: string; number: number; content: string }> = [];

        // Generate each chapter sequentially
        for (const chapterDef of CHAPTER_DEFS) {
          try {
            // 1. Load template (prompt + metadata)
            const template = templateLoader.loadTemplate(chapterDef.number);
            const title = template.metadata.chapter_name;

            // 2. Load chapter-specific data via loader
            const dataContext = await loaderRegistry.loadChapterData(chapterDef.number, project.id);

            // 3. Substitute variables into user prompt template
            const userPrompt = templateLoader.substituteVariables(
              template.userPromptTemplate,
              dataContext.variables,
            );

            let content: string;

            if (STATIC_CHAPTERS.has(chapterDef.number)) {
              // Static chapters: convert template to simple HTML directly
              content = convertTemplateToHtml(userPrompt);
            } else {
              // LLM chapters: build system prompt (chapter-specific + global HTML rules)
              const systemPrompt = (template.systemPrompt || '') + HTML_OUTPUT_INSTRUCTION;

              const messages: ChatMessage[] = [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
              ];

              const rawResponse = await llmClient.chat(messages, {
                timeout: 60000,
                temperature: 0.3,
              });

              if (!rawResponse || rawResponse.trim().length === 0) {
                throw new Error('LLM returned empty response');
              }

              // Strip markdown code block wrappers if LLM added them
              content = rawResponse.trim();
              if (content.startsWith('```html')) {
                content = content.replace(/^```html\s*\n?/, '').replace(/\n?```\s*$/, '');
              } else if (content.startsWith('```')) {
                content = content.replace(/^```\s*\n?/, '').replace(/\n?```\s*$/, '');
              }
            }

            const chapterResult = {
              id: chapterDef.id,
              title,
              number: chapterDef.number,
              content,
            };

            completedChapters.push(chapterResult);
            send({ type: 'chapter', chapter: chapterResult });
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : '生成失败';
            const template = templateLoader.loadTemplate(chapterDef.number);
            const fallbackChapter = {
              id: chapterDef.id,
              title: template.metadata.chapter_name,
              number: chapterDef.number,
              content: `<p class="text-slate-400">章节生成失败：${errorMsg}</p>`,
            };
            completedChapters.push(fallbackChapter);
            send({ type: 'chapter', chapter: fallbackChapter });
          }
        }

        // Save to database
        await prisma.reviewConfig.update({
          where: { id: reviewConfigId },
          data: {
            reportContent: { type: 'chapters', chapters: completedChapters, generatedAt: new Date().toISOString() },
            status: 'completed',
          },
        });

        send({ type: 'done', chapters: completedChapters });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : '报告生成失败';
        send({ type: 'error', message: errorMsg });

        // Reset status
        await prisma.reviewConfig.update({
          where: { id: reviewConfigId },
          data: { status: 'draft' },
        }).catch(() => {});
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

/**
 * Convert a substituted markdown template to simple HTML (for static chapters like cover/end page)
 */
function convertTemplateToHtml(template: string): string {
  return template
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const trimmed = line.trim();
      const h1Match = trimmed.match(/^#\s+(.+)$/);
      if (h1Match) return `<h1 class="chapter-title">${h1Match[1]}</h1>`;
      const h2Match = trimmed.match(/^##\s+(.+)$/);
      if (h2Match) return `<h2>${h2Match[1]}</h2>`;
      const h3Match = trimmed.match(/^###\s+(.+)$/);
      if (h3Match) return `<h3>${h3Match[1]}</h3>`;
      const bulletMatch = trimmed.match(/^[-*]\s+(.+)$/);
      if (bulletMatch) return `<li>${bulletMatch[1]}</li>`;
      return `<p>${trimmed}</p>`;
    })
    .join('\n');
}
