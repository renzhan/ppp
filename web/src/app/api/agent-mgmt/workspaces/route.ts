import { NextRequest, NextResponse } from 'next/server';
import { workspaceService } from '@/lib/agent-management';

/**
 * GET /api/agent-mgmt/workspaces
 * List all workspaces ordered by sortOrder.
 */
export async function GET() {
  try {
    const workspaces = await workspaceService.findAll();
    return NextResponse.json(workspaces);
  } catch (error) {
    console.error('GET /api/agent-mgmt/workspaces error:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to fetch workspaces' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/agent-mgmt/workspaces
 * Create a new custom workspace.
 *
 * Body:
 *   name        - required
 *   description - optional
 *   icon        - optional
 *   sortOrder   - optional (default 0)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.name || typeof body.name !== 'string' || body.name.trim() === '') {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'Missing required fields: name',
          details: { name: 'name is required' },
        },
        { status: 400 }
      );
    }

    const workspace = await workspaceService.create(body);
    return NextResponse.json(workspace, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/agent-mgmt/workspaces error:', error);

    const message = error?.message || 'Unknown error';

    // Prisma unique constraint violation
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
      { error: 'INTERNAL_ERROR', message: 'Failed to create workspace' },
      { status: 500 }
    );
  }
}
