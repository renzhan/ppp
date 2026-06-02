import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { DataIngestionService } from '@/ingestion/index';
import { PaichachaClient } from '@/ingestion/paichacha-client';
import { PrismaDataPersistenceService } from '@/ingestion/persistence-service';
import { transitionStatus } from '@/project/status-machine';

interface ApiFetchRequestBody {
  projectId: string;
  noteIds: string[];
}

/**
 * Create a DataIngestionService instance using environment variables.
 */
function createIngestionService(): DataIngestionService {
  const baseUrl = process.env.PAICHACHA_BASE_URL || '';
  const apiKey = process.env.PAICHACHA_API_KEY || '';
  const pgyNoteBaseUrl = process.env.PUGONGYING_NOTE_BASE_URL || '';
  const pgyApiKey = process.env.PUGONGYING_API_KEY || '';
  const juguangBaseUrl = process.env.JUGUANG_BASE_URL || '';
  const juguangApiKey = process.env.JUGUANG_API_KEY || '';

  if (!baseUrl || !apiKey) {
    throw new Error('派查查 API 配置缺失: PAICHACHA_BASE_URL 和 PAICHACHA_API_KEY 为必填项');
  }

  if (!pgyNoteBaseUrl || !pgyApiKey) {
    throw new Error('蒲公英 API 配置缺失: PUGONGYING_NOTE_BASE_URL 和 PUGONGYING_API_KEY 为必填项');
  }

  if (!juguangBaseUrl || !juguangApiKey) {
    throw new Error('聚光 API 配置缺失: JUGUANG_BASE_URL 和 JUGUANG_API_KEY 为必填项');
  }

  const pgyConfig = { noteBaseUrl: pgyNoteBaseUrl, commentBaseUrl: process.env.PUGONGYING_COMMENT_BASE_URL || '', apiKey: pgyApiKey };
  const juguangConfig = { baseUrl: juguangBaseUrl, apiKey: juguangApiKey };

  const client = new PaichachaClient(baseUrl, apiKey, undefined, pgyConfig, juguangConfig);
  const persistenceService = new PrismaDataPersistenceService();
  return new DataIngestionService(client, persistenceService);
}

/**
 * POST /api/upload/api-fetch
 * Trigger API data fetch from Paichacha for given note IDs.
 *
 * Accepts JSON body:
 *   - projectId: UUID of the project
 *   - noteIds: array of note ID strings to fetch
 *
 * Returns a summary of successes and failures.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ApiFetchRequestBody;
    const { projectId, noteIds } = body;

    // Validate required fields
    if (!projectId || typeof projectId !== 'string') {
      return NextResponse.json(
        { error: 'projectId 为必填项', fields: { projectId: 'projectId is required' } },
        { status: 400 }
      );
    }

    if (!noteIds || !Array.isArray(noteIds) || noteIds.length === 0) {
      return NextResponse.json(
        { error: 'noteIds 为必填项且不能为空数组', fields: { noteIds: 'noteIds must be a non-empty array' } },
        { status: 400 }
      );
    }

    // Validate all noteIds are non-empty strings
    const invalidIds = noteIds.filter((id) => typeof id !== 'string' || id.trim() === '');
    if (invalidIds.length > 0) {
      return NextResponse.json(
        { error: 'noteIds 中包含无效的笔记 ID（空字符串或非字符串类型）' },
        { status: 400 }
      );
    }

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!project) {
      return NextResponse.json(
        { error: '项目不存在' },
        { status: 404 }
      );
    }

    // Create ingestion service and fetch data
    let ingestionService: DataIngestionService;
    try {
      ingestionService = createIngestionService();
    } catch (error) {
      const message = error instanceof Error ? error.message : '服务配置错误';
      return NextResponse.json(
        { error: message },
        { status: 500 }
      );
    }

    const result = await ingestionService.ingestBaseData(projectId);

    // Calculate success/failure counts
    const total = noteIds.length;
    const succeededNoteIds = new Set(result.pugongyingNotes.map((n) => n.noteId));
    const succeeded = succeededNoteIds.size;
    const failed = total - succeeded;

    // Trigger status transition if any notes were successfully fetched
    if (succeeded > 0) {
      await transitionStatus(projectId, 'first_upload');
    }

    // Build failure details from errors
    const failures: Array<{ noteId: string; reason: string }> = [];

    if (result.errors.length > 0) {
      // If there are global errors (e.g., entire API call failed),
      // attribute them to all note IDs that didn't succeed
      const failedNoteIds = noteIds.filter((id) => !succeededNoteIds.has(id));
      const errorReason = result.errors.join('; ');

      for (const noteId of failedNoteIds) {
        failures.push({ noteId, reason: errorReason });
      }
    }

    return NextResponse.json({
      success: true,
      total,
      succeeded,
      failed,
      failures,
    });
  } catch (error) {
    console.error('POST /api/upload/api-fetch error:', error);

    // Handle JSON parse errors
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: '请求体必须为有效的 JSON 格式' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    );
  }
}
