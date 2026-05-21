import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { chat, setLLMClient } from '@/engines/narrative';
import { createLLMClientFromEnv } from '@/report/llm-client';
import type { ModuleId } from '@/engines/types';

/**
 * POST /api/chat/[projectId]
 * AI chat endpoint for the review platform.
 * Supports attribution analysis, data queries, and optimization suggestions.
 */
export async function POST(
  request: Request,
  { params }: { params: { projectId: string } },
) {
  try {
    const { projectId } = params;
    const body = await request.json();
    const { messages, moduleId } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'messages array is required and must not be empty' },
        { status: 400 },
      );
    }

    // Validate message format
    for (const msg of messages) {
      if (!msg.role || !msg.content) {
        return NextResponse.json(
          { error: 'Each message must have role and content fields' },
          { status: 400 },
        );
      }
      if (!['user', 'assistant'].includes(msg.role)) {
        return NextResponse.json(
          { error: 'Message role must be "user" or "assistant"' },
          { status: 400 },
        );
      }
    }

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 },
      );
    }

    // Ensure LLM client is initialized
    setLLMClient(createLLMClientFromEnv());

    // Call Narrative Engine's chat function
    const response = await chat(
      messages as { role: 'user' | 'assistant'; content: string }[],
      {
        projectId,
        moduleId: moduleId as ModuleId | undefined,
      },
    );

    return NextResponse.json({ response });
  } catch (error) {
    console.error('POST /api/chat/[projectId] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
