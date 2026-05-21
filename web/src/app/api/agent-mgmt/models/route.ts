import { NextRequest, NextResponse } from 'next/server';
import { modelConfigService } from '@/lib/agent-management';

/**
 * GET /api/agent-mgmt/models
 * List all model configurations (API Key masked).
 */
export async function GET() {
  try {
    const models = await modelConfigService.findAll();
    return NextResponse.json(models);
  } catch (error) {
    console.error('GET /api/agent-mgmt/models error:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to fetch model configurations' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/agent-mgmt/models
 * Create a new model configuration.
 *
 * Body:
 *   name       - required
 *   apiKey     - required
 *   baseUrl    - required (must be valid http/https URL)
 *   modelName  - required
 *   timeoutMs  - optional (default 30000)
 *   maxRetries - optional (default 2)
 *   isDefault  - optional (default false)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const config = await modelConfigService.create(body);
    return NextResponse.json(config, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/agent-mgmt/models error:', error);

    const message = error?.message || 'Unknown error';

    // Validation errors from the service layer
    if (message.includes('Missing required fields')) {
      const fieldsMatch = message.match(/Missing required fields: (.+)/);
      const fields = fieldsMatch ? fieldsMatch[1].split(', ') : [];
      const details: Record<string, string> = {};
      for (const field of fields) {
        details[field.trim()] = `${field.trim()} is required`;
      }
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message, details },
        { status: 400 }
      );
    }

    if (message.includes('Invalid URL format')) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message, details: { baseUrl: message } },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to create model configuration' },
      { status: 500 }
    );
  }
}
