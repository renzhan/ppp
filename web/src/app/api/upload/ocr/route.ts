import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  processLingxiScreenshot,
  detectImageMimeType,
} from '@/ingestion/ocr-service';
import type { SupportedImageMimeType, OCRProcessingResult } from '@/ingestion/ocr-service';
import { createLLMClientFromEnv } from '@/report/llm-client';

/** Maximum file size: 10MB */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * POST /api/upload/ocr
 * Upload a Lingxi platform screenshot for OCR recognition.
 *
 * Accepts multipart form data with:
 *   - file: PNG/JPG image file
 *   - projectId: UUID of the project
 *
 * Returns the OCR recognition result with low-confidence field annotations.
 */
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const projectId = formData.get('projectId') as string | null;

    // Validate required fields
    if (!file) {
      return NextResponse.json(
        { error: '请上传图片文件', fields: { file: 'file is required' } },
        { status: 400 }
      );
    }
    if (!projectId) {
      return NextResponse.json(
        { error: 'projectId 为必填项', fields: { projectId: 'projectId is required' } },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: '文件大小不能超过 10MB' },
        { status: 413 }
      );
    }

    // Validate image format
    const mimeType = detectImageMimeType(file.name);
    if (!mimeType) {
      return NextResponse.json(
        { error: '仅支持 PNG/JPG 格式', supportedFormats: ['png', 'jpg', 'jpeg'] },
        { status: 415 }
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

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Create LLM client and process OCR
    const llmClient = createLLMClientFromEnv();
    let ocrResult: OCRProcessingResult;

    try {
      ocrResult = await processLingxiScreenshot(
        buffer,
        mimeType as SupportedImageMimeType,
        llmClient
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'OCR识别失败';
      return NextResponse.json(
        { error: message, retryable: true },
        { status: 422 }
      );
    }

    // Return OCR result for user confirmation
    return NextResponse.json({
      success: true,
      projectId,
      result: {
        dataType: ocrResult.result.dataType,
        data: ocrResult.result.data,
        confidence: ocrResult.result.confidence,
        rawText: ocrResult.result.rawText,
      },
      lowConfidenceFields: ocrResult.lowConfidenceFields,
      isLowConfidence: ocrResult.isLowConfidence,
    });
  } catch (error) {
    console.error('POST /api/upload/ocr error:', error);
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    );
  }
}
