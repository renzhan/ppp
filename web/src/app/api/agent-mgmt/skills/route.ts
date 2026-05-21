import { NextRequest, NextResponse } from 'next/server';
import { skillManagementService } from '@/lib/agent-management';

/**
 * GET /api/agent-mgmt/skills
 * List all skills. Supports ?scope and ?workspaceId query params for filtering.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const scope = searchParams.get('scope') as 'public' | 'workspace' | null;
    const workspaceId = searchParams.get('workspaceId');

    // Validate: scope=workspace requires workspaceId
    if (scope === 'workspace' && !workspaceId) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'workspaceId is required when scope is "workspace"',
          details: { workspaceId: 'workspaceId is required when scope is "workspace"' },
        },
        { status: 400 }
      );
    }

    const filter: { scope?: 'public' | 'workspace'; workspaceId?: string } = {};
    if (scope) filter.scope = scope;
    if (workspaceId) filter.workspaceId = workspaceId;

    const skills = await skillManagementService.findAll(
      Object.keys(filter).length > 0 ? filter : undefined
    );

    return NextResponse.json(skills);
  } catch (error) {
    console.error('GET /api/agent-mgmt/skills error:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to fetch skills' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/agent-mgmt/skills
 * Create a new Skill.
 *
 * Body:
 *   name        - required
 *   description - required
 *   content     - required (Markdown format)
 *   scope       - required ("public" | "workspace")
 *   workspaceId - required when scope is "workspace"
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    const missingFields: string[] = [];
    if (!body.name) missingFields.push('name');
    if (!body.description) missingFields.push('description');
    if (!body.content) missingFields.push('content');
    if (!body.scope) missingFields.push('scope');

    if (missingFields.length > 0) {
      const details: Record<string, string> = {};
      for (const field of missingFields) {
        details[field] = `${field} is required`;
      }
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: `Missing required fields: ${missingFields.join(', ')}`,
          details,
        },
        { status: 400 }
      );
    }

    // Validate scope value
    if (body.scope !== 'public' && body.scope !== 'workspace') {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'scope must be "public" or "workspace"',
          details: { scope: 'scope must be "public" or "workspace"' },
        },
        { status: 400 }
      );
    }

    // Validate workspaceId when scope is workspace
    if (body.scope === 'workspace' && !body.workspaceId) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'workspaceId is required when scope is "workspace"',
          details: { workspaceId: 'workspaceId is required when scope is "workspace"' },
        },
        { status: 400 }
      );
    }

    const skill = await skillManagementService.create(body);
    return NextResponse.json(skill, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/agent-mgmt/skills error:', error);

    const message = error?.message || 'Unknown error';

    if (message.includes('workspaceId is required')) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message,
          details: { workspaceId: 'workspaceId is required when scope is "workspace"' },
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to create skill' },
      { status: 500 }
    );
  }
}
