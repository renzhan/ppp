import { NextRequest, NextResponse } from 'next/server';
import { agentManagementService } from '@/lib/agent-management';

/**
 * GET /api/agent-mgmt/agents
 * List all agents. Supports ?workspaceId query param for filtering.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');

    let agents;
    if (workspaceId) {
      agents = await agentManagementService.findByWorkspace(workspaceId);
    } else {
      agents = await agentManagementService.findAll();
    }

    return NextResponse.json(agents);
  } catch (error) {
    console.error('GET /api/agent-mgmt/agents error:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to fetch agents' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/agent-mgmt/agents
 * Create a new Workspace Agent.
 *
 * Body:
 *   name         - required
 *   workspaceId  - required
 *   description  - optional
 *   modelConfigId - optional
 *   systemPrompt - optional
 *   skillIds     - optional (array of skill IDs to attach)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    const missingFields: string[] = [];
    if (!body.name) missingFields.push('name');
    if (!body.workspaceId) missingFields.push('workspaceId');

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

    const agent = await agentManagementService.createWorkspaceAgent(body);
    return NextResponse.json(agent, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/agent-mgmt/agents error:', error);

    const message = error?.message || 'Unknown error';

    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to create agent' },
      { status: 500 }
    );
  }
}
