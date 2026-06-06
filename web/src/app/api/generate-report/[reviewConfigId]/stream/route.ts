import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { createLLMClientFromEnv } from '@/report/llm-client';
import { createChapterDataLoaderRegistry } from '@/pipeline/loaders/index';
import { PromptTemplateLoader } from '@/pipeline/template-loader';
import type { ChatMessage } from '@/shared/types';
import path from 'path';
import fs from 'fs';

export const maxDuration = 300; // 5 minutes

/** Maximum number of chapters to generate concurrently (configurable via env) */
const MAX_CONCURRENT_CHAPTERS = parseInt(process.env.REPORT_MAX_CONCURRENCY || '5', 10);

/**
 * 章节定义 - id 用于前端去重/追加
 * 注意：封面(1)、人群资产(8)、尾页(10) 已移除，不再生成
 */
const CHAPTER_DEFS: Array<{ id: string; number: number }> = [
  { id: 'projectReview', number: 2 },
  { id: 'dataOverview', number: 3 },
  { id: 'highlights', number: 4 },
  { id: 'quadrantAnalysis', number: 5 },
  { id: 'contentAnalysis', number: 6 },
  { id: 'trafficAnalysis', number: 7 },
  { id: 'optimization', number: 9 },
];

/** 静态章节不调用 LLM（当前已移除封面和尾页，保留备用） */
const STATIC_CHAPTERS = new Set<number>([]);

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
8. 仅输出HTML片段，不要包含任何解释性文字或markdown语法
9. 每个包含数据引用的段落、表格、列表，必须添加 data-trace-id 属性标识数据来源：
   - 数据表格: <table data-trace-id="ch3_kpi_table" class="report-table">
   - 数据段落: <p data-trace-id="ch3_overview_stats">总费用128,000元...</p>
   - 对比表格: <table data-trace-id="ch3_natural_vs_paid" class="report-table">
   data-trace-id 命名规则: ch{章节号}_{模块}_{类型}，如 ch3_kpi_table, ch7_by_placement
   纯文字分析段落（不直接引用具体数据数字）不需要添加此属性。`;

// ─── In-memory tracking of active generation tasks ─────────────────────────
// Key: reviewConfigId, Value: true if generation is running in this process
const activeGenerations = new Map<string, boolean>();

/**
 * Background report generation - runs independently of SSE connection.
 * Saves each chapter to DB incrementally so progress is persisted.
 */
async function runBackgroundGeneration(reviewConfigId: string, projectId: string) {
  if (activeGenerations.get(reviewConfigId)) {
    return; // Already running in this process
  }
  activeGenerations.set(reviewConfigId, true);

  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, projectName: true },
    });

    if (!project) {
      throw new Error('Project not found');
    }

    // Mark as generating
    await prisma.reviewConfig.update({
      where: { id: reviewConfigId },
      data: { status: 'generating', reportContent: { type: 'chapters', chapters: [], generatedAt: new Date().toISOString() } },
    });

    const loaderRegistry = createChapterDataLoaderRegistry(prisma as any);
    const templatesDir = path.resolve(process.cwd(), '..', 'src', 'prompts', 'chapters');
    const templateLoader = new PromptTemplateLoader(templatesDir);
    const llmClient = createLLMClientFromEnv();

    const allTraceItems: Array<{ traceId: string; chapterNumber: number; label: string; sourceTable: string; sourceQuery: string; totalRows: number; columns: unknown; dataRows: unknown; calculations?: unknown }> = [];

    const chapterResults = new Array<{ id: string; title: string; number: number; content: string; traceIds?: { traceId: string; label: string }[] } | null>(CHAPTER_DEFS.length).fill(null);

    // Save all completed chapters to DB immediately (out-of-order OK)
    const flushToDb = async () => {
      const currentCompleted = chapterResults.filter((r): r is NonNullable<typeof r> => r !== null);
      if (currentCompleted.length > 0) {
        await prisma.reviewConfig.update({
          where: { id: reviewConfigId },
          data: {
            reportContent: { type: 'chapters', chapters: currentCompleted, generatedAt: new Date().toISOString() },
          },
        });
      }
    };

    // Process a single chapter
    const processChapter = async (index: number) => {
      const chapterDef = CHAPTER_DEFS[index];
      const chapterStartTime = Date.now();
      console.log(`[ReportGen] 开始生成 ch${chapterDef.number}_${chapterDef.id} (${reviewConfigId})`);
      try {
        const template = templateLoader.loadTemplate(chapterDef.number);
        const title = template.metadata.chapter_name;

        const dataContext = await loaderRegistry.loadChapterData(chapterDef.number, project.id);

        const userPrompt = templateLoader.substituteVariables(
          template.userPromptTemplate,
          dataContext.variables,
        );

        let content: string;

        if (STATIC_CHAPTERS.has(chapterDef.number)) {
          content = convertTemplateToHtml(userPrompt);
        } else {
          const systemPrompt = (template.systemPrompt || '') + HTML_OUTPUT_INSTRUCTION;
          const messages: ChatMessage[] = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ];

          // Log prompts to file for debugging
          try {
            const logDir = path.resolve(process.cwd(), '..', 'logs', 'prompts', reviewConfigId);
            fs.mkdirSync(logDir, { recursive: true });
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const logFile = path.join(logDir, `ch${chapterDef.number}_${chapterDef.id}_${timestamp}.txt`);
            const logContent = `=== Chapter ${chapterDef.number}: ${chapterDef.id} ===\n` +
              `=== Timestamp: ${new Date().toISOString()} ===\n` +
              `=== ReviewConfig: ${reviewConfigId} ===\n\n` +
              `--- SYSTEM PROMPT ---\n${systemPrompt}\n\n` +
              `--- USER PROMPT ---\n${userPrompt}\n`;
            fs.writeFileSync(logFile, logContent, 'utf-8');
          } catch { /* ignore logging errors */ }

          const rawResponse = await llmClient.chat(messages, {
            timeout: 60000,
            temperature: 0.3,
          });

          if (!rawResponse || rawResponse.trim().length === 0) {
            throw new Error('LLM returned empty response');
          }

          content = rawResponse.trim();
          if (content.startsWith('```html')) {
            content = content.replace(/^```html\s*\n?/, '').replace(/\n?```\s*$/, '');
          } else if (content.startsWith('```')) {
            content = content.replace(/^```\s*\n?/, '').replace(/\n?```\s*$/, '');
          }
        }

        chapterResults[index] = {
          id: chapterDef.id,
          title,
          number: chapterDef.number,
          content,
          traceIds: (dataContext.traceItems || []).map((t) => ({ traceId: t.traceId, label: t.label })),
        };

        const elapsed = ((Date.now() - chapterStartTime) / 1000).toFixed(1);
        console.log(`[ReportGen] ✅ ch${chapterDef.number}_${chapterDef.id} 完成 (${elapsed}s, ${content.length}字符)`);

        if (dataContext.traceItems && dataContext.traceItems.length > 0) {
          allTraceItems.push(...dataContext.traceItems);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : '生成失败';
        const elapsed = ((Date.now() - chapterStartTime) / 1000).toFixed(1);
        console.error(`[ReportGen] ❌ ch${chapterDef.number}_${chapterDef.id} 失败 (${elapsed}s): ${errorMsg}`);
        if (err instanceof Error && err.stack) {
          console.error(`[ReportGen]    Stack: ${err.stack.split('\n').slice(0, 3).join(' | ')}`);
        }
        const template = templateLoader.loadTemplate(chapterDef.number);
        chapterResults[index] = {
          id: chapterDef.id,
          title: template.metadata.chapter_name,
          number: chapterDef.number,
          content: `<p class="text-gray-400">章节生成失败：${errorMsg}</p>`,
        };
      }
      await flushToDb();
    };

    // Run chapters with sliding window concurrency
    const executing = new Set<Promise<void>>();
    for (let i = 0; i < CHAPTER_DEFS.length; i++) {
      const p = processChapter(i).then(() => { executing.delete(p); });
      executing.add(p);
      if (executing.size >= MAX_CONCURRENT_CHAPTERS) {
        await Promise.race(executing);
      }
    }
    await Promise.all(executing);

    // Final save with completed status
    const finalChapters = chapterResults.filter((r): r is NonNullable<typeof r> => r !== null);
    await prisma.reviewConfig.update({
      where: { id: reviewConfigId },
      data: {
        reportContent: { type: 'chapters', chapters: finalChapters, generatedAt: new Date().toISOString() },
        status: 'completed',
      },
    });

    // Save trace items
    if (allTraceItems.length > 0) {
      await prisma.reportTraceItem.deleteMany({ where: { reviewConfigId } });
      await prisma.reportTraceItem.createMany({
        data: allTraceItems.map((item) => ({
          reviewConfigId,
          traceId: item.traceId,
          chapterNumber: item.chapterNumber,
          label: item.label,
          sourceTable: item.sourceTable,
          sourceQuery: item.sourceQuery,
          totalRows: item.totalRows,
          columns: item.columns as any,
          dataRows: item.dataRows as any,
          calculations: item.calculations as any ?? undefined,
        })),
      });
    }

    console.log(`[ReportGen] Completed: ${reviewConfigId}, ${finalChapters.length} chapters`);
  } catch (err) {
    console.error(`[ReportGen] Failed: ${reviewConfigId}`, err);
    await prisma.reviewConfig.update({
      where: { id: reviewConfigId },
      data: { status: 'draft' },
    }).catch(() => {});
  } finally {
    activeGenerations.delete(reviewConfigId);
  }
}

/**
 * GET /api/generate-report/[reviewConfigId]/stream
 *
 * SSE endpoint that:
 * 1. Kicks off background generation if not already running
 * 2. Polls DB for progress and streams completed chapters to the client
 * 3. Client can disconnect and reconnect without affecting generation
 *
 * Event types:
 * - { type: 'start', totalChapters: number }
 * - { type: 'progress', chapterId: string, tokensUsed: number }
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
    select: { id: true, projectId: true, status: true, reportContent: true },
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

  // Start background generation if not already completed or running
  const existingContent = reviewConfig.reportContent as { type?: string; chapters?: unknown[] } | null;
  const isCompleted = reviewConfig.status === 'completed' && existingContent?.chapters?.length;
  const isRunning = activeGenerations.get(reviewConfigId);

  if (!isCompleted && !isRunning) {
    // Fire and forget - generation runs in background
    runBackgroundGeneration(reviewConfigId, reviewConfig.projectId);
  }

  // SSE stream that polls DB for progress
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // Controller may be closed if client disconnected
        }
      };

      send({ type: 'start', totalChapters: CHAPTER_DEFS.length });

      let sentChapterIds = new Set<string>();
      const POLL_INTERVAL = 1500; // 1.5s
      const MAX_POLLS = 200; // 5 minutes max

      for (let poll = 0; poll < MAX_POLLS; poll++) {
        // Check if client disconnected
        if (request.signal.aborted) {
          break;
        }

        // Read current progress from DB
        const current = await prisma.reviewConfig.findUnique({
          where: { id: reviewConfigId },
          select: { status: true, reportContent: true },
        });

        if (!current) break;

        const content = current.reportContent as { type?: string; chapters?: Array<{ id: string; title: string; number: number; content: string; traceIds?: unknown }> } | null;
        const chapters = content?.chapters || [];

        // Emit chapter events for newly completed chapters (order-independent)
        for (const ch of chapters) {
          if (!sentChapterIds.has(ch.id)) {
            const tokensUsed = Math.ceil((ch.content?.length || 0) / 2);
            send({ type: 'progress', chapterId: ch.id, tokensUsed });
            send({ type: 'chapter', chapter: ch });
            sentChapterIds.add(ch.id);
          }
        }

        // Emit progress event for chapters still being generated
        if (current.status === 'generating' && chapters.length < CHAPTER_DEFS.length) {
          for (const def of CHAPTER_DEFS) {
            if (!sentChapterIds.has(def.id) && !chapters.find(c => c.id === def.id)) {
              send({ type: 'progress', chapterId: def.id, tokensUsed: 0 });
              break; // Only show one as "generating" at a time
            }
          }
        }

        // Check if generation is complete
        if (current.status === 'completed') {
          send({ type: 'done', chapters });
          break;
        }

        // Check if generation failed (status reset to draft)
        if (current.status === 'draft' && poll > 2) {
          send({ type: 'error', message: '报告生成失败，请重试' });
          break;
        }

        // Wait before next poll
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
      }

      controller.close();
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
