/**
 * Vision Document Parser — 多模态文档解析器
 *
 * 基于 LLM Vision API 的多模态文档理解服务。
 * 将文档页面图片发送给 gpt-4.1 Vision，提取结构化信息。
 * 同时复用于策划案解析和灵犀截图 OCR。
 */

import type { LLMClient } from '../report/llm-client.js';
import type { VisionContentPart } from '../shared/types.js';

// ---- Types ----

export interface PageImage {
  pageNumber: number;
  buffer: Buffer;
  width: number;
  height: number;
  mimeType: 'image/png';
}

export interface PlanParseResult {
  projectObjective?: string;
  strategy?: string;
  targetAudience?: string;
  coreMessage?: string;
  kpiTargets?: Record<string, number>;
  confidence: number;
  pagesSummary: Array<{
    pageNumber: number;
    summary: string;
    extractedFields: string[];
  }>;
}

export interface OCRResult {
  dataType: 'aips' | 'brand_ranking' | 'soc_sov' | 'spu_ranking';
  data: Record<string, unknown>;
  confidence: number;
  rawText?: string;
}

export interface OCRField {
  key: string;
  value: string | number;
  confidence: number;
}

export interface VisionParseOptions {
  mode: 'plan_document' | 'lingxi_screenshot';
  batchSize?: number;
  systemPrompt?: string;
}

// ---- Constants ----

const LINGXI_OCR_SYSTEM_PROMPT = `你是一个灵犀平台数据提取助手。请从以下灵犀平台截图中识别并提取结构化数据。

灵犀平台截图可能包含以下类型的数据：
1. AIPS人群流转数据（awareness, interest, purchase, share, penetrationRate, flowRates）
2. 品牌排名数据（brandName, rank, category, period）
3. SOC/SOV数据（soc, sov, category, period）
4. SPU排名数据（spuName, rank, category, period）

请严格按照以下JSON格式返回识别结果：
{
  "dataType": "aips" | "brand_ranking" | "soc_sov" | "spu_ranking",
  "fields": [
    { "key": "字段名", "value": "字段值", "confidence": 0-100 }
  ],
  "rawText": "截图中的原始文本内容",
  "overallConfidence": 0-100
}

注意：
- confidence 表示对该字段识别的置信度（0-100）
- 如果无法确定数据类型，请根据截图内容做出最佳判断
- 数值字段请转换为数字类型
- 如果某个字段模糊不清，降低其 confidence 值`;

const PLAN_DOCUMENT_SYSTEM_PROMPT = `你是一个营销策划案分析助手。请从以下策划案页面图片中提取项目背景信息。

请提取以下字段（如果页面中包含相关信息）：
- projectObjective: 传播目的/项目目标
- strategy: 策略回顾/营销策略
- targetAudience: 目标人群
- coreMessage: 核心传播信息
- kpiTargets: KPI目标值（键值对）

请严格按照以下JSON格式返回：
{
  "projectObjective": "...",
  "strategy": "...",
  "targetAudience": "...",
  "coreMessage": "...",
  "kpiTargets": { "指标名": 数值 },
  "confidence": 0-100,
  "pageSummary": "本页内容摘要",
  "extractedFields": ["已提取的字段名列表"]
}

如果某页不包含相关信息，返回：
{ "confidence": 0, "pageSummary": "本页无相关信息", "extractedFields": [] }`;

const DEFAULT_BATCH_SIZE = 3;
const VISION_TIMEOUT = 30000; // 30 seconds for OCR

// ---- Functions ----

/**
 * 使用 LLM Vision API 识别灵犀平台截图。
 * 复用同一 Vision 管线，仅切换 prompt。
 *
 * @param imageBuffer - 截图图片 Buffer（PNG 或 JPEG）
 * @param mimeType - 图片 MIME 类型
 * @param llmClient - LLM 客户端实例
 * @returns OCR 识别结果
 */
export async function recognizeLingxiScreenshot(
  imageBuffer: Buffer,
  mimeType: 'image/png' | 'image/jpeg',
  llmClient: LLMClient,
): Promise<OCRResult> {
  // Validate input format
  if (mimeType !== 'image/png' && mimeType !== 'image/jpeg') {
    throw new Error('仅支持 PNG/JPG 格式');
  }

  const base64Image = imageBuffer.toString('base64');
  const dataUrl = `data:${mimeType};base64,${base64Image}`;

  // Use the LLM client with vision content
  // The LLM client interface uses string content, so we encode the image
  // as a special format that the Vision API understands
  const userContent = `[IMAGE:${dataUrl}]\n\n请识别这张灵犀平台截图中的数据。`;

  let response: string;
  try {
    response = await llmClient.chat(
      [
        { role: 'system', content: LINGXI_OCR_SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      { temperature: 0.1, timeout: VISION_TIMEOUT },
    );
  } catch (err) {
    throw new Error(`OCR识别失败: ${err instanceof Error ? err.message : '请重试'}`);
  }

  return parseOCRResponse(response);
}

/**
 * 使用 LLM Vision API 解析策划案文档。
 * 流程：文档→图片→分批发送 LLM→合并提取结果
 *
 * @param pages - 文档页面图片数组
 * @param llmClient - LLM 客户端实例
 * @param options - 解析选项
 * @returns 策划案解析结果
 */
export async function parsePlanDocumentVision(
  pages: PageImage[],
  llmClient: LLMClient,
  options?: { batchSize?: number },
): Promise<PlanParseResult> {
  const batchSize = options?.batchSize ?? DEFAULT_BATCH_SIZE;
  const results: PlanParseResult = {
    confidence: 0,
    pagesSummary: [],
  };

  // Process batches with limited concurrency (3 at a time)
  const allBatches: Array<{ pages: PageImage[] }> = [];
  for (let i = 0; i < pages.length; i += batchSize) {
    allBatches.push({ pages: pages.slice(i, i + batchSize) });
  }
  const batchResults: PlanParseResult[] = [];
  for (let i = 0; i < allBatches.length; i += 3) {
    const chunk = allBatches.slice(i, i + 3);
    const results = await Promise.all(chunk.map((b) => processPlanBatch(b.pages, llmClient)));
    batchResults.push(...results);
  }
  for (const batchResult of batchResults) {
    mergeResults(results, batchResult);
  }

  // Calculate overall confidence
  if (results.pagesSummary.length > 0) {
    const fieldsExtracted = new Set(
      results.pagesSummary.flatMap((p) => p.extractedFields),
    );
    results.confidence = Math.min(100, fieldsExtracted.size * 20);
  }

  return results;
}

// ---- Internal Helpers ----

/**
 * Process a batch of plan document pages.
 */
async function processPlanBatch(
  pages: PageImage[],
  llmClient: LLMClient,
): Promise<PlanParseResult> {
  const pageRange = pages.length === 1 ? `第${pages[0]?.pageNumber}页` : `第${pages[0]?.pageNumber}-${pages[pages.length - 1]?.pageNumber}页`;

  // Build vision content: text + multiple images using standard OpenAI image_url format
  const content: VisionContentPart[] = [
    { type: 'text', text: `请分析以下策划案页面（共${pages.length}页）：\n\n` },
    ...pages.flatMap((page) => [
      { type: 'text' as const, text: `\n--- 第${page.pageNumber}页 ---\n` },
      { type: 'image_url' as const, image_url: { url: `data:image/png;base64,${page.buffer.toString('base64')}` } },
    ]),
  ];

  // Estimate request size for logging
  const estimatedSize = JSON.stringify(content).length;
  console.log(`[策划案解析] 批次${pageRange}, ${pages.length}页, 预估请求体${(estimatedSize / 1024 / 1024).toFixed(1)}MB`);

  let response: string;
  try {
    response = await llmClient.chat(
      [
        { role: 'system', content: PLAN_DOCUMENT_SYSTEM_PROMPT },
        { role: 'user', content },
      ],
      { temperature: 0.3, timeout: 120000 },
    );
  } catch (err) {
    console.error(`[策划案解析] 批次${pageRange} LLM调用失败:`, err instanceof Error ? err.message : err);
    return { confidence: 0, pagesSummary: [] };
  }

  const result = parsePlanResponse(response, pages);
  const status = result.confidence > 0 ? `✓ 置信度${result.confidence}` : `✗ 置信度0`;
  console.log(`[策划案解析] 批次${pageRange} ${status}, 请求体${(estimatedSize / 1024 / 1024).toFixed(1)}MB, LLM响应: ${response.replace(/\n/g, '\\n').slice(0, 300)}`);
  return result;
}

/**
 * Parse the LLM response for plan document analysis.
 */
function parsePlanResponse(response: string, pages: PageImage[]): PlanParseResult {
  const result: PlanParseResult = {
    confidence: 0,
    pagesSummary: [],
  };

  try {
    const jsonStr = extractJSON(response);
    const parsed = JSON.parse(jsonStr);

    if (parsed.projectObjective) result.projectObjective = String(parsed.projectObjective);
    if (parsed.strategy) result.strategy = String(parsed.strategy);
    if (parsed.targetAudience) result.targetAudience = String(parsed.targetAudience);
    if (parsed.coreMessage) result.coreMessage = String(parsed.coreMessage);
    if (parsed.kpiTargets && typeof parsed.kpiTargets === 'object') {
      result.kpiTargets = parsed.kpiTargets;
    }
    result.confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0;

    result.pagesSummary = pages.map((page) => ({
      pageNumber: page.pageNumber,
      summary: parsed.pageSummary || '',
      extractedFields: Array.isArray(parsed.extractedFields) ? parsed.extractedFields : [],
    }));
  } catch {
    // If parsing fails, return empty result
    result.pagesSummary = pages.map((page) => ({
      pageNumber: page.pageNumber,
      summary: '解析失败',
      extractedFields: [],
    }));
  }

  return result;
}

/**
 * Parse the LLM response for OCR recognition.
 */
function parseOCRResponse(response: string): OCRResult {
  const FALLBACK_MESSAGE = 'AI生成失败，请稍后重试';

  if (response === FALLBACK_MESSAGE) {
    throw new Error('OCR识别超时，请重试');
  }

  try {
    const jsonStr = extractJSON(response);
    const parsed = JSON.parse(jsonStr);

    // Validate dataType
    const validDataTypes = ['aips', 'brand_ranking', 'soc_sov', 'spu_ranking'] as const;
    const dataType = validDataTypes.includes(parsed.dataType)
      ? parsed.dataType as OCRResult['dataType']
      : 'aips'; // default fallback

    // Convert fields array to data object
    const data: Record<string, unknown> = {};
    const fields: OCRField[] = [];

    if (Array.isArray(parsed.fields)) {
      for (const field of parsed.fields) {
        if (field && typeof field.key === 'string') {
          const confidence = typeof field.confidence === 'number' ? field.confidence : 0;
          data[field.key] = field.value;
          fields.push({
            key: field.key,
            value: field.value,
            confidence,
          });
        }
      }
    }

    const overallConfidence = typeof parsed.overallConfidence === 'number'
      ? parsed.overallConfidence
      : calculateOverallConfidence(fields);

    return {
      dataType,
      data,
      confidence: overallConfidence,
      rawText: typeof parsed.rawText === 'string' ? parsed.rawText : undefined,
    };
  } catch (error) {
    if (error instanceof Error && error.message === 'OCR识别超时，请重试') {
      throw error;
    }
    throw new Error('无法识别截图内容，请确认截图来源');
  }
}

/**
 * Calculate overall confidence from individual field confidences.
 */
function calculateOverallConfidence(fields: OCRField[]): number {
  if (fields.length === 0) return 0;
  const sum = fields.reduce((acc, f) => acc + f.confidence, 0);
  return Math.round(sum / fields.length);
}

/**
 * Merge batch results into the accumulated result.
 */
function mergeResults(target: PlanParseResult, source: PlanParseResult): void {
  // Take the first non-empty value for each field
  if (!target.projectObjective && source.projectObjective) {
    target.projectObjective = source.projectObjective;
  }
  if (!target.strategy && source.strategy) {
    target.strategy = source.strategy;
  }
  if (!target.targetAudience && source.targetAudience) {
    target.targetAudience = source.targetAudience;
  }
  if (!target.coreMessage && source.coreMessage) {
    target.coreMessage = source.coreMessage;
  }
  if (!target.kpiTargets && source.kpiTargets) {
    target.kpiTargets = source.kpiTargets;
  }

  // Append page summaries
  target.pagesSummary.push(...source.pagesSummary);
}

/**
 * Extract JSON from a string that may contain markdown code blocks.
 */
function extractJSON(text: string): string {
  // Try to find JSON in markdown code block
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  // Try to find raw JSON object
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0];
  }

  return text;
}
