import { NextRequest, NextResponse } from 'next/server';
import { dispatchService } from '@/lib/agent-management';

/**
 * POST /api/agent-mgmt/dispatch
 * Dispatch a task to an Agent.
 *
 * Body:
 *   taskContent   - required: the task content to dispatch
 *   workspaceId   - optional: target workspace (routes to an enabled agent in that workspace)
 *   targetAgentId - optional: directly specify the target agent (bypasses Master routing)
 *   metadata      - optional: additional metadata object
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required field: taskContent
    if (!body.taskContent || typeof body.taskContent !== 'string' || body.taskContent.trim() === '') {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'Missing required field: taskContent',
          details: { taskContent: 'taskContent is required and must be a non-empty string' },
        },
        { status: 400 }
      );
    }

    const result = await dispatchService.dispatch({
      taskContent: body.taskContent,
      workspaceId: body.workspaceId,
      targetAgentId: body.targetAgentId,
      metadata: body.metadata,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('POST /api/agent-mgmt/dispatch error:', error);

    const message = error?.message || 'Unknown error';

    // Handle specific error cases
    if (message.includes('is disabled')) {
      return NextResponse.json(
        { error: 'AGENT_DISABLED', message },
        { status: 422 }
      );
    }

    if (message.includes('LLM') || message.includes('completeSimple') || message.includes('LLM not configured')) {
      return NextResponse.json(
        { error: 'LLM_ERROR', message },
        { status: 502 }
      );
    }

    if (message.includes('not found') || message.includes('No enabled agent')) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to dispatch task' },
      { status: 500 }
    );
  }
}
