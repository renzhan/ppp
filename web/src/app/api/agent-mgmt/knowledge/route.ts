import { NextRequest, NextResponse } from 'next/server';
import { knowledgeService } from '@/lib/agent-management';

export const dynamic = 'force-dynamic';

/**
 * GET /api/agent-mgmt/knowledge
 * List all knowledge documents. Supports ?workspaceId query param for filtering.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');

    const filter: { workspaceId?: string } = {};
    if (workspaceId) filter.workspaceId = workspaceId;

    const documents = await knowledgeService.findAll(
      Object.keys(filter).length > 0 ? filter : undefined
    );

    return NextResponse.json(documents);
  } catch (error) {
    console.error('GET /api/agent-mgmt/knowledge error:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to fetch knowledge documents' },
      { status: 500 }
    );
  }
}
