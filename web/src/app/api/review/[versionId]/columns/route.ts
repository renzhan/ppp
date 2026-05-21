import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * PUT /api/review/[versionId]/columns
 * Update data column visibility settings for the report.
 * Saves a ReviewEdit record for each column visibility change.
 *
 * When a column is hidden (visible=false), creates a ReviewEdit with editType='column_hide'.
 * When a column is restored (visible=true), deletes the corresponding hide record.
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.6
 */
export async function PUT(
  request: Request,
  { params }: { params: { versionId: string } },
) {
  try {
    const { versionId } = params;
    const body = await request.json();
    const { columns, moduleId, editedBy } = body;

    if (!columns || typeof columns !== 'object') {
      return NextResponse.json(
        { error: 'columns object is required (e.g. { "columnName": true/false })' },
        { status: 400 },
      );
    }

    if (!moduleId) {
      return NextResponse.json(
        { error: 'moduleId is required' },
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

    // Update config with column visibility
    const config = version.config as Record<string, unknown>;
    const columnConfig = (config.columnVisibility ?? {}) as Record<string, Record<string, boolean>>;
    columnConfig[moduleId] = {
      ...(columnConfig[moduleId] ?? {}),
      ...columns,
    };

    await prisma.reportVersion.update({
      where: { id: versionId },
      data: {
        config: { ...config, columnVisibility: columnConfig },
      },
    });

    // Process each column change
    for (const [columnKey, visible] of Object.entries(columns)) {
      if (visible === false) {
        // Column hidden: create a ReviewEdit record (editType='column_hide')
        await prisma.reviewEdit.create({
          data: {
            projectId: version.projectId,
            versionId,
            moduleId,
            editType: 'column_hide',
            previousContent: { columnKey, visible: true },
            newContent: { columnKey, visible: false },
            editedBy: editedBy ?? null,
          },
        });
      } else {
        // Column restored: delete existing column_hide records for this column
        await prisma.reviewEdit.deleteMany({
          where: {
            versionId,
            moduleId,
            editType: 'column_hide',
            newContent: {
              path: ['columnKey'],
              equals: columnKey,
            },
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      moduleId,
      columnVisibility: columnConfig[moduleId],
    });
  } catch (error) {
    console.error('PUT /api/review/[versionId]/columns error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
