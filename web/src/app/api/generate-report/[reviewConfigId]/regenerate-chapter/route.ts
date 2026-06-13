import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { createLLMClientFromEnv } from '@/report/llm-client';
import { createChapterDataLoaderRegistry } from '@/pipeline/loaders/index';
import { PromptTemplateLoader } from '@/pipeline/template-loader';
import type { ChatMessage } from '@/shared/types';
import path from 'path';

const CHAPTER_DEFS: Array<{ id: string; number: number }> = [
  { id: 'projectReview', number: 2 },
  { id: 'dataOverview', number: 3 },
  { id: 'highlights', number: 4 },
  { id: 'quadrantAnalysis', number: 5 },
  { id: 'contentAnalysis', number: 6 },
  { id: 'trafficAnalysis', number: 7 },
  { id: 'optimization', number: 9 },
];

const HTML_OUTPUT_INSTRUCTION = `

【HTML输出格式规范】请直接输出纯HTML片段（不含<!DOCTYPE>、<html>、<head>、<body>标签）。严格遵守：
1. 章节标题用 <h2 class="chapter-title">，子标题用 <h3>
2. 数据表格用 <table class="report-table">，表头用 <thead>，数据行用 <tbody>
3. 需要图表展示的数据，在表格后添加图表占位：
   <div class="chart-placeholder" data-chart-type="bar|pie|line|scatter|multiline" data-chart-title="图表标题" data-chart-data='JSON数据'>图表加载中...</div>
   scatter格式（四象限散点图）: {"points":[{"x":0.8,"y":0.9,"label":"昵称","index":1,"quadrant":"核心资产"}],"xAvg":0.5,"yAvg":0.5}
   multiline格式（多折线趋势图）: [{"date":"2025-01-15","cpm":52,"cpc":1.8,"cpe":18,"period":"预热期"}]
4. 重要数据用 <strong class="highlight"> 标记
5. 分析段落用 <p>，列表用 <ul>/<li> 或 <ol>/<li>
6. 完成率超过100%的用 <span class="text-green">，低于100%的用 <span class="text-red">
7. 语言专业简洁，必须引用具体数据，使用营销行业术语
8. 仅输出HTML片段，不要包含任何解释性文字或markdown语法
9. 每个包含数据引用的段落、表格、列表，必须添加 data-trace-id 属性标识数据来源`;

/**
 * POST /api/generate-report/[reviewConfigId]/regenerate-chapter
 *
 * Regenerates a single chapter. Body: { chapterId: string }
 * Returns: { content: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ reviewConfigId: string }> }
) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { reviewConfigId } = await params;
  const body = await request.json();
  const { chapterId } = body;

  if (!chapterId) {
    return NextResponse.json({ error: 'chapterId is required' }, { status: 400 });
  }

  const chapterDef = CHAPTER_DEFS.find(d => d.id === chapterId);
  if (!chapterDef) {
    return NextResponse.json({ error: 'Invalid chapterId' }, { status: 400 });
  }

  const reviewConfig = await prisma.reviewConfig.findUnique({
    where: { id: reviewConfigId },
    select: { id: true, projectId: true, reportContent: true },
  });

  if (!reviewConfig) {
    return NextResponse.json({ error: 'ReviewConfig not found' }, { status: 404 });
  }

  const project = await prisma.project.findUnique({
    where: { id: reviewConfig.projectId },
    select: { id: true, projectName: true },
  });

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  try {
    const loaderRegistry = createChapterDataLoaderRegistry(prisma as any);
    const templatesDir = path.resolve(process.cwd(), '..', 'src', 'prompts', 'chapters');
    const templateLoader = new PromptTemplateLoader(templatesDir);
    const llmClient = createLLMClientFromEnv();

    const template = templateLoader.loadTemplate(chapterDef.number);
    const dataContext = await loaderRegistry.loadChapterData(chapterDef.number, project.id);
    const userPrompt = templateLoader.substituteVariables(template.userPromptTemplate, dataContext.variables);

    const systemPrompt = (template.systemPrompt || '') + HTML_OUTPUT_INSTRUCTION;
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const rawResponse = await llmClient.chat(messages, { timeout: 60000, temperature: 0.3 });

    if (!rawResponse || rawResponse.trim().length === 0) {
      return NextResponse.json({ error: 'LLM returned empty response' }, { status: 500 });
    }

    let content = rawResponse.trim();
    if (content.startsWith('```html')) {
      content = content.replace(/^```html\s*\n?/, '').replace(/\n?```\s*$/, '');
    } else if (content.startsWith('```')) {
      content = content.replace(/^```\s*\n?/, '').replace(/\n?```\s*$/, '');
    }

    // Update the chapter in reportContent
    const existingContent = reviewConfig.reportContent as { type?: string; chapters?: Array<{ id: string; title: string; number: number; content: string }> } | null;
    if (existingContent?.chapters) {
      const updatedChapters = existingContent.chapters.map(ch =>
        ch.id === chapterId ? { ...ch, content } : ch
      );
      await prisma.reviewConfig.update({
        where: { id: reviewConfigId },
        data: {
          reportContent: { ...existingContent, chapters: updatedChapters },
        },
      });
    }

    return NextResponse.json({ content });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[RegenerateChapter] Failed: ${chapterId}`, error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
