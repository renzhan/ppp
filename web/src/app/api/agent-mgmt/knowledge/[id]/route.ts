import { NextRequest, NextResponse } from 'next/server';
import { knowledgeService } from '@/lib/agent-management';

/**
 * DELETE /api/agent-mgmt/knowledge/[id]
 * Delete a knowledge document by ID.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    await knowledgeService.delete(id);
    return NextResponse.json({ message: 'Knowledge document deleted successfully' });
  } catch (error: any) {
    console.error('DELETE /api/agent-mgmt/knowledge/[id] error:', error);

    const message = error?.message || 'Unknown error';

    if (message.includes('not found')) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to delete knowledge document' },
      { status: 500 }
    );
  }
}
