import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { createLLMClientFromEnv } from '@/report/llm-client';
import { assembleReportData } from '@/report/html-report-data-assembler';
import { buildHtmlReportPrompt } from '@/report/html-report-prompt-builder';
import type { ChatMessage } from '@/shared/types';

export const maxDuration = 300; // 5 minutes

/**
 * Report chapter definitions for streaming generation
 */
const REPORT_CHAPTERS = [
  { id: 'cover', title: '封面', number: 1 },
  { id: 'dataOverview', title: '数据总览', number: 2 },
  { id: 'benchmark', title: '大盘对比', number: 3 },
  { id: 'highlights', title: '项目亮点', number: 4 },
  { id: 'contentAnalysis', title: '内容分析', number: 5 },
  { id: 'audienceAssets', title: '人群资产分析', number: 6 },
  { id: 'trafficAnalysis', title: '投流分析', number: 7 },
  { id: 'competitorAnalysis', title: '竞品分析', number: 8 },
  { id: 'optimization', title: '优化建议', number: 9 },
] as const satisfies readonly { id: string; title: string; number: number }[];

type ChapterDef = { id: string; title: string; number: number };

/**
 * GET /api/generate-report/[reviewConfigId]/stream
 *
 * SSE 流式生成复盘报告，按章节逐步输出。
 * 每个章节生成完毕后发送一个 SSE event，前端可以边接收边渲染。
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
        // Load project data
        const reportData = await assembleReportData(project.id);
        const llmClient = createLLMClientFromEnv();

        send({ type: 'start', totalChapters: REPORT_CHAPTERS.length });

        const completedChapters: Array<{ id: string; title: string; number: number; content: string }> = [];

        // Generate each chapter sequentially
        for (const chapter of REPORT_CHAPTERS) {
          try {
            const chapterPrompt = buildChapterPrompt(chapter, reportData);
            const content = await llmClient.chat(
              [
                { role: 'system', content: getChapterSystemPrompt(chapter) },
                { role: 'user', content: chapterPrompt },
              ] as ChatMessage[],
              { timeout: 60000, temperature: 0.3 },
            );

            const chapterResult = {
              id: chapter.id,
              title: chapter.title,
              number: chapter.number,
              content,
            };

            completedChapters.push(chapterResult);
            send({ type: 'chapter', chapter: chapterResult });
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : '生成失败';
            const fallbackChapter = {
              id: chapter.id,
              title: chapter.title,
              number: chapter.number,
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
 * Build chapter-specific system prompt
 */
function getChapterSystemPrompt(chapter: ChapterDef): string {
  return `你是一位资深的小红书营销复盘专家。请基于提供的数据生成"${chapter.title}"章节的HTML内容片段。

严格遵守以下输出规则：
1. 输出纯HTML片段（不含<!DOCTYPE>、<html>、<head>、<body>标签）
2. 章节标题用 <h2 class="chapter-title">，子标题用 <h3>
3. 数据表格用 <table class="report-table">，表头用 <thead>，数据行用 <tbody>
4. 需要图表展示的数据，在表格后添加图表占位：
   <div class="chart-placeholder" data-chart-type="bar|pie|line" data-chart-title="图表标题" data-chart-data='JSON数据'>图表加载中...</div>
   其中 data-chart-data 为 JSON 格式：{"labels":["A","B"],"values":[100,200]} 或 {"items":[{"name":"A","value":100}]}
5. 重要数据用 <strong class="highlight"> 标记
6. 分析段落用 <p>，列表用 <ul>/<li> 或 <ol>/<li>
7. 完成率超过100%的用 <span class="text-green">，低于100%的用 <span class="text-red">
8. 语言专业简洁，必须引用具体数据，使用营销行业术语
9. 仅输出HTML片段，不要包含任何解释性文字或markdown`;
}

/**
 * Build chapter-specific user prompt with relevant data
 */
function buildChapterPrompt(chapter: ChapterDef, data: any): string {
  switch (chapter.id) {
    case 'cover':
      return `生成报告封面内容：
- 项目名称：${data.project.projectName}
- 品牌：${data.project.brand}
- 品类：${data.project.category}
${data.project.spuName ? `- 产品：${data.project.spuName}` : ''}
- 执行周期：${data.project.period}

输出封面HTML，包含项目名称大标题、"小红书种草项目复盘报告"副标题、执行周期。`;

    case 'dataOverview':
      return `生成数据总览章节：
${data.costOverview ? `- 总费用：${data.costOverview.totalCost}元（达人${data.costOverview.talentCost}元 + 投流${data.costOverview.trafficCost}元）\n- 总笔记数：${data.costOverview.noteCount}篇` : ''}

KPI完成情况：
${data.kpiCompletion.map((k: any) => `| ${k.metric} | KPI: ${k.kpiTarget} | 实际: ${k.actual} | 完成率: ${k.completionRate} |`).join('\n')}

请输出：1) KPI完成情况数据表格 2) 核心亮点指标分析 3) 需关注指标 4) 综合评价`;

    case 'benchmark':
      if (data.benchmark.length === 0) return '暂无大盘对比数据，请输出提示文字说明数据待补充。';
      return `生成大盘对比章节：
${data.benchmark.map((b: any) => `| ${b.metric} | 实际: ${b.actual} | 大盘: ${b.benchmarkRange} | ${b.status} | 差异: ${b.diff} |`).join('\n')}

请输出对比表格和分析文字，突出优于大盘的指标。`;

    case 'highlights':
      if (data.highlights.length === 0) return '暂无项目亮点数据，请输出提示文字。';
      return `生成项目亮点章节：
${data.highlights.map((h: string) => `- ${h}`).join('\n')}

请输出亮点列表，每个亮点配简要分析。`;

    case 'contentAnalysis':
      return `生成内容分析章节：

内容方向分析：
${data.contentByDirection.length > 0 ? data.contentByDirection.map((c: any) => `| ${c.direction} | ${c.count}篇 | 曝光${c.impressions} | 互动${c.engagement} | CPE${c.cpe} | 爆文率${c.viralRate} |`).join('\n') : '暂无数据'}

达人层级分析：
${data.contentByTier.length > 0 ? data.contentByTier.map((t: any) => `| ${t.tier} | ${t.count}篇 | 曝光${t.impressions} | 互动${t.engagement} | CPE${t.cpe} | 爆文率${t.viralRate} |`).join('\n') : '暂无数据'}

内容形式分析：
${data.contentByForm.length > 0 ? data.contentByForm.map((f: any) => `| ${f.type} | ${f.count}篇 | 曝光${f.impressions} | 互动${f.engagement} | CPE${f.cpe} | 爆文率${f.viralRate} |`).join('\n') : '暂无数据'}

请输出三个维度的数据表格，每个表格后附AI分析解读。`;

    case 'audienceAssets':
      return '生成人群资产分析章节。如无具体AIPS数据，请输出框架性内容说明该章节用于展示品牌人群资产变化（Awareness→Interest→TrueInterest→Share）。';

    case 'trafficAnalysis':
      if (!data.trafficOverview) return '暂无投流数据，请输出提示文字说明数据待补充。';
      return `生成投流分析章节：

投流总览：
- 总消耗：${data.trafficOverview.totalSpend}元
- 总曝光：${data.trafficOverview.totalImpressions}
- 总点击：${data.trafficOverview.totalClicks}
- CTR：${data.trafficOverview.ctr} | CPC：${data.trafficOverview.cpc} | CPM：${data.trafficOverview.cpm} | CPE：${data.trafficOverview.cpe}

广告类型分析：
${data.trafficByType?.map((t: any) => `| ${t.type} | 消耗${t.spend} | 曝光${t.impressions} | CPM${t.cpm} | CPC${t.cpc} | CPE${t.cpe} | CTR${t.ctr} |`).join('\n') || '暂无'}

人群定向分析：
${data.trafficByTargeting?.map((t: any) => `| ${t.targeting} | 消耗${t.spend} | CPM${t.cpm} | CPC${t.cpc} | CPE${t.cpe} | CTR${t.ctr} |`).join('\n') || '暂无'}

请输出投流总览卡片、广告类型表格、人群定向表格，每部分附分析。`;

    case 'competitorAnalysis':
      return '生成竞品分析章节。如无具体竞品数据，请输出框架性内容说明该章节用于展示竞品/行业对标分析。';

    case 'optimization':
      if (Object.keys(data.optimization).length === 0) return '请基于项目整体数据生成通用优化建议，包含内容策略、达人选择、投流策略三个维度。';
      return `生成优化建议章节：
${Object.entries(data.optimization).map(([section, items]) => `### ${section}\n${(items as string[]).map(i => `- ${i}`).join('\n')}`).join('\n\n')}

请输出分维度的优化建议，每个维度包含总结和具体建议bullet points。`;

    default:
      return `生成${(chapter as any).title}章节内容。`;
  }
}
