import { NextRequest, NextResponse } from 'next/server';
import { agentManagementService } from '@/lib/agent-management';

/**
 * POST /api/agent-mgmt/agents/[id]/skills
 * Attach a skill to an agent.
 *
 * Body:
 *   skillId - required
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Check agent existence first
    const existing = await agentManagementService.findById(id);
    if (!existing) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: `Agent with id '${id}' not found` },
        { status: 404 }
      );
    }

    const body = await request.json();

    if (!body.skillId) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'Missing required field: skillId',
          details: { skillId: 'skillId is required' },
        },
        { status: 400 }
      );
    }

    await agentManagementService.attachSkill(id, body.skillId);
    return NextResponse.json({ message: 'Skill attached successfully' }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/agent-mgmt/agents/[id]/skills error:', error);

    const message = error?.message || 'Unknown error';

    if (message.includes('Skill not found')) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message },
        { status: 404 }
      );
    }

    if (message.includes('Cannot attach workspace-scoped skill')) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message },
        { status: 400 }
      );
    }

    // Unique constraint violation (skill already attached)
    if (message.includes('Unique constraint') || message.includes('already')) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: 'Skill is already attached to this agent' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to attach skill' },
      { status: 500 }
    );
  }
}
