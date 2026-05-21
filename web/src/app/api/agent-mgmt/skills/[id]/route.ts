import { NextRequest, NextResponse } from 'next/server';
import { skillManagementService } from '@/lib/agent-management';

/**
 * GET /api/agent-mgmt/skills/[id]
 * Get skill details by ID.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const skill = await skillManagementService.findById(id);

    if (!skill) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: `Skill with id '${id}' not found` },
        { status: 404 }
      );
    }

    return NextResponse.json(skill);
  } catch (error) {
    console.error('GET /api/agent-mgmt/skills/[id] error:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to fetch skill' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/agent-mgmt/skills/[id]
 * Update an existing skill. Creates a new version.
 *
 * Body (all optional):
 *   name, description, content
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Check existence first
    const existing = await skillManagementService.findById(id);
    if (!existing) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: `Skill with id '${id}' not found` },
        { status: 404 }
      );
    }

    const body = await request.json();
    const skillVersion = await skillManagementService.update(id, body);
    return NextResponse.json(skillVersion);
  } catch (error: any) {
    console.error('PUT /api/agent-mgmt/skills/[id] error:', error);

    const message = error?.message || 'Unknown error';

    if (message.includes('Skill not found')) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to update skill' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/agent-mgmt/skills/[id]
 * Delete a skill. Returns 409 if referenced by agents.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Check existence first
    const existing = await skillManagementService.findById(id);
    if (!existing) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: `Skill with id '${id}' not found` },
        { status: 404 }
      );
    }

    await skillManagementService.delete(id);
    return NextResponse.json({ message: 'Skill deleted successfully' });
  } catch (error: any) {
    console.error('DELETE /api/agent-mgmt/skills/[id] error:', error);

    const message = error?.message || 'Unknown error';

    if (message.includes('Cannot delete skill: referenced by agents')) {
      // Extract agent names from the error message
      const agentNamesMatch = message.match(/referenced by agents: (.+)$/);
      const references = agentNamesMatch
        ? agentNamesMatch[1].split(', ')
        : [];

      return NextResponse.json(
        {
          error: 'REFERENCE_CONFLICT',
          message: 'Cannot delete skill: it is referenced by one or more agents',
          references,
        },
        { status: 409 }
      );
    }

    if (message.includes('Skill not found')) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to delete skill' },
      { status: 500 }
    );
  }
}
