import { NextRequest, NextResponse } from 'next/server';
import { agentManagementService } from '@/lib/agent-management';

/**
 * GET /api/agent-mgmt/agents/[id]
 * Get agent details by ID (includes associated skills).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const agent = await agentManagementService.findById(id);

    if (!agent) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: `Agent with id '${id}' not found` },
        { status: 404 }
      );
    }

    return NextResponse.json(agent);
  } catch (error) {
    console.error('GET /api/agent-mgmt/agents/[id] error:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to fetch agent' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/agent-mgmt/agents/[id]
 * Update an existing agent.
 *
 * Body (all optional):
 *   name, description, modelConfigId, systemPrompt
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Check existence first
    const existing = await agentManagementService.findById(id);
    if (!existing) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: `Agent with id '${id}' not found` },
        { status: 404 }
      );
    }

    const body = await request.json();
    const updated = await agentManagementService.update(id, body);
    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('PUT /api/agent-mgmt/agents/[id] error:', error);

    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to update agent' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/agent-mgmt/agents/[id]
 * Delete an agent. Returns warning if it's the last agent in a workspace.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Check existence first
    const existing = await agentManagementService.findById(id);
    if (!existing) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: `Agent with id '${id}' not found` },
        { status: 404 }
      );
    }

    const result = await agentManagementService.delete(id);

    if (result.warning) {
      return NextResponse.json({
        message: 'Agent deleted successfully',
        warning: result.warning,
      });
    }

    return NextResponse.json({ message: 'Agent deleted successfully' });
  } catch (error: any) {
    console.error('DELETE /api/agent-mgmt/agents/[id] error:', error);

    const message = error?.message || 'Unknown error';

    if (message.includes('Agent not found')) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to delete agent' },
      { status: 500 }
    );
  }
}
