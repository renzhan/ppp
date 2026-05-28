import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createLLMClientFromEnv } from '@/report/llm-client';
import { ReportPipelineOrchestrator } from '@/pipeline/orchestrator';
import { createChapterDataLoaderRegistry } from '@/pipeline/loaders/index';
import { PromptTemplateLoader } from '@/pipeline/template-loader';
import path from 'path';

/**
 * POST /api/generate-report/[reviewConfigId]
 *
 * 触发复盘报告生成 — 通过逐章节管线（Orchestrator）生成完整10章报告。
 * 每章独立加载数据 → 填充提示词模板 → 调用LLM → 解析响应。
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

    console.log('[generate-report] starting chapter-by-chapter pipeline...');

    // Initialize pipeline components
    const loaderRegistry = createChapterDataLoaderRegistry(prisma as any);
    const templatesDir = path.resolve(process.cwd(), '..', 'src', 'prompts', 'chapters');
    const templateLoader = new PromptTemplateLoader(templatesDir);
    const llmClient = createLLMClientFromEnv();

    const orchestrator = new ReportPipelineOrchestrator(
      loaderRegistry,
      templateLoader,
      llmClient,
      prisma as any,
    );

    // Generate full 10-chapter report
    const result = await orchestrator.generateFullReport({
      projectId: project.id,
      reviewConfigId,
      timeout: 60000,
    });

    console.log(`[generate-report] pipeline completed: ${result.chapters.filter(c => c.status === 'generated').length}/10 chapters generated`);

    return NextResponse.json({
      success: true,
      versionId: result.versionId,
      versionNumber: result.versionNumber,
      chaptersGenerated: result.chapters.filter(c => c.status === 'generated').length,
      chaptersErrored: result.chapters.filter(c => c.status === 'error').length,
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
