import { NextRequest, NextResponse } from 'next/server';
import { modelConfigService } from '@/lib/agent-management';

/**
 * GET /api/agent-mgmt/models/[id]
 * Get a single model configuration by ID.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const config = await modelConfigService.findById(id);

    if (!config) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: `Model configuration with id '${id}' not found` },
        { status: 404 }
      );
    }

    return NextResponse.json(config);
  } catch (error) {
    console.error('GET /api/agent-mgmt/models/[id] error:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to fetch model configuration' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/agent-mgmt/models/[id]
 * Update an existing model configuration.
 *
 * Body (all optional):
 *   name, apiKey, baseUrl, modelName, timeoutMs, maxRetries, isDefault
 */
export async function PUT(
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

    const body = await request.json();
    const updated = await modelConfigService.update(id, body);
    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('PUT /api/agent-mgmt/models/[id] error:', error);

    const message = error?.message || 'Unknown error';

    if (message.includes('Invalid URL format') || message.includes('baseUrl cannot be empty')) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message, details: { baseUrl: message } },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to update model configuration' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/agent-mgmt/models/[id]
 * Delete a model configuration.
 * Returns 409 if the config is referenced by agents.
 */
export async function DELETE(
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

    await modelConfigService.delete(id);
    return NextResponse.json({ message: 'Model configuration deleted successfully' });
  } catch (error: any) {
    console.error('DELETE /api/agent-mgmt/models/[id] error:', error);

    const message = error?.message || 'Unknown error';

    if (message.includes('Cannot delete model config: referenced by agents')) {
      // Extract agent names from the error message
      const referencesMatch = message.match(/referenced by agents: (.+)/);
      const references = referencesMatch
        ? referencesMatch[1].split(', ')
        : [];
      return NextResponse.json(
        {
          error: 'REFERENCE_CONFLICT',
          message: 'Cannot delete model configuration because it is referenced by agents',
          references,
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to delete model configuration' },
      { status: 500 }
    );
  }
}
