import { NextRequest, NextResponse } from 'next/server';
import { modelConfigService } from '@/lib/agent-management';

/**
 * POST /api/agent-mgmt/models/[id]/set-default
 * Set a model configuration as the default.
 * Ensures only one config has isDefault=true at any time.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Check existence first
    const existing = await modelConfigService.findById(id);
    if (!existing) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: `Model configuration with id '${id}' not found` },
        { status: 404 }
      );
    }

    await modelConfigService.setDefault(id);
    return NextResponse.json({ message: 'Model configuration set as default successfully' });
  } catch (error) {
    console.error('POST /api/agent-mgmt/models/[id]/set-default error:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to set model configuration as default' },
      { status: 500 }
    );
  }
}
