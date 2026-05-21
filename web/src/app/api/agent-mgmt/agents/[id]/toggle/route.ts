import { NextRequest, NextResponse } from 'next/server';
import { agentManagementService } from '@/lib/agent-management';

/**
 * POST /api/agent-mgmt/agents/[id]/toggle
 * Toggle the enabled/disabled state of an agent.
 *
 * Body:
 *   enabled - required (boolean)
 */
export async function POST(
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

    if (typeof body.enabled !== 'boolean') {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'Missing required field: enabled (boolean)',
          details: { enabled: 'enabled must be a boolean value' },
        },
        { status: 400 }
      );
    }

    const updated = await agentManagementService.toggleEnabled(id, body.enabled);
    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('POST /api/agent-mgmt/agents/[id]/toggle error:', error);

    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to toggle agent state' },
      { status: 500 }
    );
  }
}
