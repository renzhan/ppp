import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/projects/[id]/ai-content
 * Save AI-generated content (e.g., plan parse results) for a project.
 *
 * Body:
 *   contentType      - required (e.g., 'plan_parse')
 *   generatedContent - required (JSON string of the parsed data)
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id: projectId } = params;

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { contentType, generatedContent } = body;

    if (!contentType) {
      return NextResponse.json(
        { error: 'contentType is required' },
        { status: 400 }
      );
    }

    if (!generatedContent) {
      return NextResponse.json(
        { error: 'generatedContent is required' },
        { status: 400 }
      );
    }

    // Upsert: if a record with same projectId + contentType exists, update it
    const existing = await prisma.aiGeneratedContent.findFirst({
      where: { projectId, contentType },
    });

    let record;
    if (existing) {
      record = await prisma.aiGeneratedContent.update({
        where: { id: existing.id },
        data: {
          generatedContent,
          isEdited: false,
          updatedAt: new Date(),
        },
      });
    } else {
      record = await prisma.aiGeneratedContent.create({
        data: {
          projectId,
          contentType,
          generatedContent,
          isEdited: false,
        },
      });
    }

    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    console.error('POST /api/projects/[id]/ai-content error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/projects/[id]/ai-content
 * Get all AI-generated content for a project.
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id: projectId } = params;

    const records = await prisma.aiGeneratedContent.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(records);
  } catch (error) {
    console.error('GET /api/projects/[id]/ai-content error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
