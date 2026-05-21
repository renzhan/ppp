import { NextRequest, NextResponse } from 'next/server';
import { skillManagementService } from '@/lib/agent-management';

/**
 * GET /api/agent-mgmt/skills/[id]/versions
 * Get version history for a skill, ordered by version descending.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Check skill existence first
    const skill = await skillManagementService.findById(id);
    if (!skill) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: `Skill with id '${id}' not found` },
        { status: 404 }
      );
    }

    const versions = await skillManagementService.getVersionHistory(id);
    return NextResponse.json(versions);
  } catch (error) {
    console.error('GET /api/agent-mgmt/skills/[id]/versions error:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to fetch skill version history' },
      { status: 500 }
    );
  }
}
