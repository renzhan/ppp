import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ReportPipelineOrchestrator, ChapterResult } from '@/pipeline/orchestrator';
import { createChapterDataLoaderRegistry } from '@/pipeline/loaders/index';
import { PromptTemplateLoader } from '@/pipeline/template-loader';
import { createLLMClientFromEnv } from '@/report/llm-client';
import path from 'path';

/**
 * POST /api/generate-report/[reviewConfigId]/chapter/[chapterNumber]
 * Triggers single chapter regeneration without affecting other chapters.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ reviewConfigId: string; chapterNumber: string }> }
) {
  try {
    const { reviewConfigId, chapterNumber: chapterNumberStr } = await params;

    // Parse and validate chapter number
    const chapterNumber = parseInt(chapterNumberStr, 10);
    if (isNaN(chapterNumber) || chapterNumber < 1 || chapterNumber > 10) {
      return NextResponse.json(
        { error: 'Invalid chapter number. Must be between 1 and 10.', code: 'INVALID_CHAPTER_NUMBER' },
        { status: 400 }
      );
    }

    // Validate reviewConfigId exists and load existing reportContent
    const reviewConfig = await prisma.reviewConfig.findUnique({
      where: { id: reviewConfigId },
      select: { id: true, projectId: true, reportContent: true },
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

    // Load existing reportContent — must exist for single chapter regeneration
    const existingContent = reviewConfig.reportContent as unknown as ChapterResult[] | null;
    if (!existingContent || !Array.isArray(existingContent) || existingContent.length !== 10) {
      return NextResponse.json(
        { error: 'Report content not found or incomplete. Generate full report first.', code: 'REPORT_CONTENT_MISSING' },
        { status: 400 }
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

    // Invoke single chapter regeneration
    const updatedChapter = await orchestrator.regenerateChapter(
      {
        projectId: project.id,
        reviewConfigId,
      },
      chapterNumber,
      existingContent,
    );

    return NextResponse.json({
      success: true,
      chapter: updatedChapter,
    });
  } catch (error) {
    console.error('POST /api/generate-report/[reviewConfigId]/chapter/[chapterNumber] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
