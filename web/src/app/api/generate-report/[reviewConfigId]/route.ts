import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ReportPipelineOrchestrator } from '@/pipeline/orchestrator';
import { createChapterDataLoaderRegistry } from '@/pipeline/loaders/index';
import { PromptTemplateLoader } from '@/pipeline/template-loader';
import { createLLMClientFromEnv } from '@/report/llm-client';
import path from 'path';

/**
 * POST /api/generate-report/[reviewConfigId]
 * Triggers full 10-chapter report generation via the pipeline orchestrator.
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

    // Invoke full report generation
    const result = await orchestrator.generateFullReport({
      projectId: project.id,
      reviewConfigId,
    });

    return NextResponse.json({
      success: true,
      versionId: result.versionId,
      versionNumber: result.versionNumber,
    });
  } catch (error) {
    console.error('POST /api/generate-report/[reviewConfigId] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
