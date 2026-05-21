import { NextResponse } from 'next/server';
import { prisma, Prisma } from '@/lib/prisma';

/**
 * PUT /api/review/[versionId]/module/[moduleId]
 * Update a module's content in the report version.
 * Saves a ReviewEdit record for the change.
 */
export async function PUT(
  request: Request,
  { params }: { params: { versionId: string; moduleId: string } },
) {
  try {
    const { versionId, moduleId } = params;
    const body = await request.json();
    const { content, editedBy } = body;

    if (!content) {
      return NextResponse.json(
        { error: 'content is required' },
        { status: 400 },
      );
    }

    // Verify version exists
    const version = await prisma.reportVersion.findUnique({
      where: { id: versionId },
    });

    if (!version) {
      return NextResponse.json(
        { error: 'Report version not found' },
        { status: 404 },
      );
    }

    // Get previous content for the module
    const currentContent = version.content as Record<string, unknown>;
    const previousModuleContent = currentContent[moduleId] ?? null;

    // Update the report content
    const updatedContent = {
      ...currentContent,
      [moduleId]: {
        ...(typeof previousModuleContent === 'object' && previousModuleContent !== null
          ? previousModuleContent
          : {}),
        ...content,
      },
    };

    await prisma.reportVersion.update({
      where: { id: versionId },
      data: { content: updatedContent },
    });

    // Save ReviewEdit record
    await prisma.reviewEdit.create({
      data: {
        projectId: version.projectId,
        versionId,
        moduleId,
        editType: 'manual_edit',
        previousContent: previousModuleContent
          ? (previousModuleContent as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        newContent: content as Prisma.InputJsonValue,
        editedBy: editedBy ?? null,
      },
    });

    return NextResponse.json({
      success: true,
      moduleId,
      message: 'Module content updated',
    });
  } catch (error) {
    console.error('PUT /api/review/[versionId]/module/[moduleId] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
