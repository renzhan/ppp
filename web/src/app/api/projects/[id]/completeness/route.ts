import { NextResponse } from 'next/server';
import { checkDataCompleteness } from '@/validation/data-completeness';

/**
 * GET /api/projects/[id]/completeness
 * Returns data completeness status for a project.
 * Checks 5 data sources and calculates overall completeness percentage.
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    const result = await checkDataCompleteness(id);

    return NextResponse.json(result);
  } catch (error) {
    console.error('GET /api/projects/[id]/completeness error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
