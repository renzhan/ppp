import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/agent-mgmt/native-tools
 * List all native tools (system built-in tools).
 * Returns name, description, inputSchema, outputFormat, isBuiltin.
 */
export async function GET() {
  try {
    const tools = await prisma.nativeTool.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        inputSchema: true,
        outputFormat: true,
        isBuiltin: true,
        createdAt: true,
      },
    });
    return NextResponse.json(tools);
  } catch (error) {
    console.error('GET /api/agent-mgmt/native-tools error:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to fetch native tools' },
      { status: 500 }
    );
  }
}
