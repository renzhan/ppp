import { NextRequest, NextResponse } from 'next/server';
import { agentManagementService } from '@/lib/agent-management';

/**
 * DELETE /api/agent-mgmt/agents/[id]/skills/[skillId]
 * Detach a skill from an agent.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; skillId: string } }
) {
  try {
    const { id, skillId } = params;

    // Check agent existence first
    const existing = await agentManagementService.findById(id);
    if (!existing) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: `Agent with id '${id}' not found` },
        { status: 404 }
      );
    }

    await agentManagementService.detachSkill(id, skillId);
    return NextResponse.json({ message: 'Skill detached successfully' });
  } catch (error: any) {
    console.error('DELETE /api/agent-mgmt/agents/[id]/skills/[skillId] error:', error);

    const message = error?.message || 'Unknown error';

    if (message.includes('is not attached to agent')) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to detach skill' },
      { status: 500 }
    );
  }
}
