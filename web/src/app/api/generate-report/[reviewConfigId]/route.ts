import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createLLMClientFromEnv } from '@/report/llm-client';
import { generateHtmlReport } from '@/report/html-report-generator';

/**
 * POST /api/generate-report/[reviewConfigId]
 *
 * 触发复盘报告生成 — 直接通过 LLM 生成完整可编辑 HTML 页面。
 * 生成的 HTML 包含 ECharts 图表、数据表格、导出PDF/DOCX按钮、内容可编辑。
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ reviewConfigId: string }> }
) {
  try {
    const { reviewConfigId } = await params;

    // Validate reviewConfigId exists
    const reviewConfig = await prisma.reviewConfig.findUnique({
      where: { id: reviewConfigId },
      select: { id: true, projectId: true },
    });

    if (!reviewConfig) {
      return NextResponse.json(
        { error: 'ReviewConfig not found', code: 'REVIEW_CONFIG_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Resolve projectId and verify project exists
    const project = await prisma.project.findUnique({
      where: { id: reviewConfig.projectId },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found', code: 'PROJECT_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Mark status as generating
    await prisma.reviewConfig.update({
      where: { id: reviewConfigId },
      data: { status: 'generating' },
    });

    console.log('[generate-report] calling generateHtmlReport...');

    // Generate HTML report via LLM
    const llmClient = createLLMClientFromEnv();
    const result = await generateHtmlReport(project.id, {
      llmClient,
      editable: true,
      exportButtons: true,
      timeout: 120000,
    });

    console.log('[generate-report] HTML report generated, length:', result.html.length);

    // Save HTML content to ReviewConfig.reportContent
    await prisma.reviewConfig.update({
      where: { id: reviewConfigId },
      data: {
        reportContent: { type: 'html', html: result.html, generatedAt: result.generatedAt },
        status: 'completed',
      },
    });

    return NextResponse.json({
      success: true,
      versionId: result.versionId,
      generatedAt: result.generatedAt,
      htmlLength: result.html.length,
    });
  } catch (error) {
    console.error('POST /api/generate-report/[reviewConfigId] error:', error);

    // Try to mark status as error
    try {
      const resolvedParams = await params;
      await prisma.reviewConfig.update({
        where: { id: resolvedParams.reviewConfigId },
        data: { status: 'draft' },
      });
    } catch { /* ignore */ }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
