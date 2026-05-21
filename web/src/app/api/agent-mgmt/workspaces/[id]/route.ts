import { NextRequest, NextResponse } from 'next/server';
import { workspaceService } from '@/lib/agent-management';

/**
 * PUT /api/agent-mgmt/workspaces/[id]
 * Update an existing workspace.
 *
 * Body (all optional):
 *   name, description, icon, sortOrder, isEnabled
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();

    const updated = await workspaceService.update(id, body);
    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('PUT /api/agent-mgmt/workspaces/[id] error:', error);

    const message = error?.message || 'Unknown error';

    // Prisma record not found
    if (message.includes('Record to update not found') || error?.code === 'P2025') {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: `Workspace not found` },
        { status: 404 }
      );
    }

    // Unique constraint violation (name already taken)
    if (message.includes('Unique constraint') || error?.code === 'P2002') {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'A workspace with this name already exists',
          details: { name: 'name must be unique' },
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to update workspace' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/agent-mgmt/workspaces/[id]
 * Delete a workspace.
 * Returns 400 if trying to delete a preset workspace.
 * Returns 409 if workspace has associated agents or documents.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    await workspaceService.delete(id);
    return NextResponse.json({ message: 'Workspace deleted successfully' });
  } catch (error: any) {
    console.error('DELETE /api/agent-mgmt/workspaces/[id] error:', error);

    const message = error?.message || 'Unknown error';

    // Workspace not found
    if (message.includes('Workspace not found')) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: 'Workspace not found' },
        { status: 404 }
      );
    }

    // Cannot delete preset workspace
    if (message.includes('Cannot delete preset workspace')) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: 'Cannot delete preset workspace' },
        { status: 400 }
      );
    }

    // Cannot delete workspace with references
    if (message.includes('Cannot delete workspace: referenced by')) {
      // Extract references from the error message
      const referencesMatch = message.match(/referenced by (.+)/);
      const references = referencesMatch
        ? referencesMatch[1].split('; ')
        : [];
      return NextResponse.json(
        {
          error: 'REFERENCE_CONFLICT',
          message: 'Cannot delete workspace because it has associated resources',
          references,
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to delete workspace' },
      { status: 500 }
    );
  }
}
