import { NextResponse } from 'next/server';
import { listTemplates } from '@/export/template-engine';

/**
 * GET /api/export/templates
 *
 * Returns the list of available export templates.
 * Each template has an id, name, and optional preview color.
 *
 * Requirements: 11.1, 11.2, 11.3
 */
export async function GET() {
  try {
    const templates = await listTemplates();
    return NextResponse.json({ templates });
  } catch (error) {
    console.error('GET /api/export/templates error:', error);
    return NextResponse.json(
      { error: 'Failed to load templates', templates: [] },
      { status: 500 },
    );
  }
}
