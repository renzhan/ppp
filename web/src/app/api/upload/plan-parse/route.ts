import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { NextResponse } from 'next/server';
import { convertDocumentToImages } from '@/ingestion/document-converter';
import { parsePlanDocumentVision } from '@/ingestion/vision-document-parser';
import { createLLMClientFromEnv } from '@/report/llm-client';
import type { SupportedFormat } from '@/ingestion/document-converter';

/** Maximum file size: 50MB (策划案 PPT/PDF 可能较大) */
const MAX_FILE_SIZE = 50 * 1024 * 1024;

/** Supported document formats */
const SUPPORTED_FORMATS: Record<string, SupportedFormat> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/msword': 'doc',
};

/** File extension to format mapping (fallback when MIME type is generic) */
const EXTENSION_FORMAT_MAP: Record<string, SupportedFormat> = {
  pdf: 'pdf',
  pptx: 'pptx',
  ppt: 'ppt',
  docx: 'docx',
  doc: 'doc',
};

/**
 * Detect document format from file name extension.
 * Returns null if the format is not supported.
 */
function detectDocumentFormat(fileName: string | undefined): SupportedFormat | null {
  if (!fileName) return null;
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (!ext) return null;
  return EXTENSION_FORMAT_MAP[ext] ?? null;
}

/**
 * POST /api/upload/plan-parse
 * Upload a marketing plan document (PDF/PPT/PPTX/DOC/DOCX) for AI parsing.
 *
 * Accepts multipart form data with:
 *   - file: Document file (PDF, PPT, PPTX, DOC, DOCX)
 *
 * Returns parsed project background information:
 *   - projectObjective: 传播目的/项目目标
 *   - strategy: 策略回顾/营销策略
 *   - targetAudience: 目标人群
 *   - coreMessage: 核心传播信息
 *   - kpiTargets: KPI 目标值
 *
 * On failure returns { success: false, error: "..." } to allow frontend
 * graceful degradation to manual input.
 */
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    // Validate required fields
    if (!file) {
      return NextResponse.json(
        { success: false, error: '请上传策划案文件' },
        { status: 400 },
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: '文件大小不能超过 50MB' },
        { status: 413 },
      );
    }

    // Detect format from MIME type first, then fall back to extension
    let format: SupportedFormat | null = SUPPORTED_FORMATS[file.type] ?? null;
    if (!format) {
      format = detectDocumentFormat((file as any).name);
    }

    if (!format) {
      return NextResponse.json(
        {
          success: false,
          error: '不支持的文件格式，仅支持 PDF/PPT/PPTX/DOC/DOCX',
          supportedFormats: ['pdf', 'ppt', 'pptx', 'doc', 'docx'],
        },
        { status: 415 },
      );
    }

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Step 1: Convert document to page images
    let conversionResult;
    try {
      const t1 = Date.now();
      conversionResult = await convertDocumentToImages(buffer, format, { dpi: 72, maxPages: 50 });
      console.log(`[上传策划案] 文档转图片完成: ${conversionResult.pages.length}页, 耗时${Date.now() - t1}ms`);
      // Save PNG images for debug
      const debugDir = join(process.cwd(), '..', 'debug-output', `plan-${Date.now()}`);
      await fs.mkdir(debugDir, { recursive: true }).catch(() => {});
      await Promise.all(
        conversionResult.pages.map((page) =>
          fs.writeFile(join(debugDir, `page_${String(page.pageNumber).padStart(3, '0')}.png`), page.buffer).catch(() => {}),
        ),
      );
      console.log(`[上传策划案] 图片已保存至 ${debugDir}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : '文档转换失败';
      return NextResponse.json(
        { success: false, error: `文档转换失败: ${message}` },
        { status: 422 },
      );
    }

    if (conversionResult.pages.length === 0) {
      return NextResponse.json(
        { success: false, error: '文档为空或无法读取页面内容' },
        { status: 422 },
      );
    }

    // Step 2: Parse document pages with Vision LLM
    let llmClient;
    try {
      llmClient = createLLMClientFromEnv();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'LLM 配置错误';
      return NextResponse.json(
        { success: false, error: message },
        { status: 500 },
      );
    }

    let parseResult;
    try {
      const t2 = Date.now();
      parseResult = await parsePlanDocumentVision(
        conversionResult.pages,
        llmClient,
      );
      console.log(`[上传策划案] LLM解析完成, 耗时${Date.now() - t2}ms, 置信度${parseResult.confidence}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : '策划案解析失败';
      return NextResponse.json(
        { success: false, error: `策划案解析失败: ${message}` },
        { status: 422 },
      );
    }

    // Return parsed result
    return NextResponse.json({
      success: true,
      data: {
        projectObjective: parseResult.projectObjective ?? null,
        strategy: parseResult.strategy ?? null,
        targetAudience: parseResult.targetAudience ?? null,
        coreMessage: parseResult.coreMessage ?? null,
        kpiTargets: parseResult.kpiTargets ?? null,
      },
      metadata: {
        totalPages: conversionResult.totalPages,
        processedPages: conversionResult.processedPages,
        confidence: parseResult.confidence,
        format: conversionResult.format,
      },
    });
  } catch (error) {
    console.error('POST /api/upload/plan-parse error:', error);
    return NextResponse.json(
      { success: false, error: '服务器内部错误，请稍后重试' },
      { status: 500 },
    );
  }
}
