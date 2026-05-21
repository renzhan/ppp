/**
 * OCR Service — OCR 数据采集服务
 *
 * 利用 Vision Document Parser 进行 OCR 识别，统一使用 LLM Vision API。
 * 委托给 vision-document-parser.ts 的 recognizeLingxiScreenshot() 函数。
 *
 * 支持：
 * - PNG/JPG 格式灵犀平台截图输入
 * - 返回结构化数据（dataType + data + confidence）
 * - 对置信度 < 80% 的字段标记为低置信度
 */

import { recognizeLingxiScreenshot } from './vision-document-parser.js';
import type { OCRResult, OCRField } from './vision-document-parser.js';
import type { LLMClient } from '../report/llm-client.js';

// ---- Types ----

export type { OCRResult, OCRField } from './vision-document-parser.js';

/** Supported image MIME types for OCR */
export type SupportedImageMimeType = 'image/png' | 'image/jpeg';

/** Low confidence threshold (below this value, fields are marked as low confidence) */
export const LOW_CONFIDENCE_THRESHOLD = 80;

/** OCR processing result with low-confidence field annotations */
export interface OCRProcessingResult {
  /** The raw OCR result from the vision parser */
  result: OCRResult;
  /** Fields that have confidence below the threshold */
  lowConfidenceFields: OCRField[];
  /** Whether the overall result has low confidence */
  isLowConfidence: boolean;
}

// ---- Service ----

/**
 * Process a Lingxi platform screenshot through OCR.
 *
 * Delegates to the Vision Document Parser's recognizeLingxiScreenshot() function,
 * which uses the same LLM Vision pipeline as plan document parsing (just with a different prompt).
 *
 * @param imageBuffer - The image file buffer (PNG or JPEG)
 * @param mimeType - The MIME type of the image
 * @param llmClient - The LLM client instance for Vision API calls
 * @returns OCR processing result with low-confidence annotations
 * @throws Error if image format is unsupported or OCR fails
 */
export async function processLingxiScreenshot(
  imageBuffer: Buffer,
  mimeType: SupportedImageMimeType,
  llmClient: LLMClient,
): Promise<OCRProcessingResult> {
  // Validate image format
  validateImageFormat(mimeType);

  // Delegate to vision-document-parser
  const result = await recognizeLingxiScreenshot(imageBuffer, mimeType, llmClient);

  // Identify low-confidence fields
  const lowConfidenceFields = identifyLowConfidenceFields(result);

  return {
    result,
    lowConfidenceFields,
    isLowConfidence: result.confidence < LOW_CONFIDENCE_THRESHOLD,
  };
}

/**
 * Validate that the image format is supported.
 *
 * @param mimeType - The MIME type to validate
 * @throws Error if format is not supported
 */
function validateImageFormat(mimeType: string): asserts mimeType is SupportedImageMimeType {
  const supportedFormats: string[] = ['image/png', 'image/jpeg'];
  if (!supportedFormats.includes(mimeType)) {
    throw new Error('仅支持 PNG/JPG 格式');
  }
}

/**
 * Identify fields with confidence below the threshold.
 * Reconstructs OCRField objects from the result data by checking
 * individual field confidence values if available.
 *
 * @param result - The OCR result to analyze
 * @returns Array of fields with low confidence
 */
function identifyLowConfidenceFields(result: OCRResult): OCRField[] {
  const lowConfidenceFields: OCRField[] = [];

  for (const [key, value] of Object.entries(result.data)) {
    // If the overall confidence is low, mark all fields as low confidence
    // Individual field confidence is embedded in the data during parsing
    const fieldConfidence = getFieldConfidence(result, key);

    if (fieldConfidence < LOW_CONFIDENCE_THRESHOLD) {
      lowConfidenceFields.push({
        key,
        value: value as string | number,
        confidence: fieldConfidence,
      });
    }
  }

  return lowConfidenceFields;
}

/**
 * Get the confidence score for a specific field.
 * If individual field confidence is not available, uses the overall confidence.
 *
 * @param result - The OCR result
 * @param fieldKey - The field key to check
 * @returns Confidence score (0-100)
 */
function getFieldConfidence(result: OCRResult, fieldKey: string): number {
  // Check if there's a field-level confidence map in the data
  const confidenceMap = result.data['_fieldConfidences'] as Record<string, number> | undefined;
  if (confidenceMap && typeof confidenceMap[fieldKey] === 'number') {
    return confidenceMap[fieldKey];
  }

  // Fall back to overall confidence
  return result.confidence;
}

/**
 * Determine the MIME type from a file extension or buffer magic bytes.
 *
 * @param filename - The filename or extension
 * @returns The detected MIME type, or null if unsupported
 */
export function detectImageMimeType(filename: string): SupportedImageMimeType | null {
  const ext = filename.toLowerCase().split('.').pop();
  switch (ext) {
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    default:
      return null;
  }
}
