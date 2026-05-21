// ============================================================
// Narrative Engine — YAML Prompt Template Loader & Narrative Generation
// 叙事策略引擎 — YAML Prompt模板加载器 & 叙事文案生成
// ============================================================

import { randomUUID } from 'crypto';
import { readFileSync, accessSync } from 'fs';
import { resolve } from 'path';
import { parse as parseYaml } from 'yaml';
import {
  MODULE_NAMES,
} from './types';
import type {
  PromptTemplate,
  ProjectType,
  ModuleId,
  ToneIntensity,
  Rating,
  NarrativeRequest,
  NarrativeResult,
  NarrativeParagraph,
} from './types';
import type { LLMClient } from '../report/llm-client';

// ---- Constants ----

/** Module ID to directory suffix mapping */
export const MODULE_SUFFIXES: Record<ModuleId, string> = {
  M1: 'M1_overview',
  M2: 'M2_review',
  M3: 'M3_highlights',
  M4: 'M4_underperform',
  M5: 'M5_content',
  M6: 'M6_competitor',
  M7: 'M7_traffic',
  M8: 'M8_diagnosis',
};

/** Required fields in a valid PromptTemplate YAML file */
const REQUIRED_TEMPLATE_FIELDS = [
  'name',
  'version',
  'projectType',
  'moduleId',
  'toneIntensity',
  'prompt',
  'variables',
  'fallbackText',
] as const;

// ---- Template Loader ----

/**
 * Load and validate a YAML prompt template.
 *
 * File path convention: prompts/{projectType}/{moduleId}_{moduleSuffix}/{tone}.yaml
 * Example: prompts/新品上市/M1_overview/positive.yaml
 *
 * @param projectType - The project type (e.g. '新品上市')
 * @param moduleId - The module identifier (e.g. 'M1')
 * @param tone - The tone intensity (e.g. 'positive')
 * @returns The validated PromptTemplate
 * @throws Error if file doesn't exist, YAML parsing fails, or required fields are missing
 */
export function loadTemplate(
  projectType: ProjectType,
  moduleId: ModuleId,
  tone: ToneIntensity,
): PromptTemplate {
  const moduleSuffix = MODULE_SUFFIXES[moduleId];
  // Try cwd first, then parent dir (handles Next.js running from web/ subdirectory)
  let promptsBase = resolve(process.cwd(), 'prompts');
  try {
    const testPath = resolve(promptsBase, projectType);
    accessSync(testPath);
  } catch {
    // Fallback: prompts/ is in the parent directory (project root)
    promptsBase = resolve(process.cwd(), '..', 'prompts');
  }
  const filePath = resolve(
    promptsBase,
    projectType,
    moduleSuffix,
    `${tone}.yaml`,
  );
  console.log(`[Narrative] Loading template: ${filePath}`);

  // Read file
  let fileContent: string;
  try {
    fileContent = readFileSync(filePath, 'utf-8');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Failed to load template file: prompts/${projectType}/${moduleSuffix}/${tone}.yaml — ${message}`,
    );
  }

  // Parse YAML
  let parsed: unknown;
  try {
    parsed = parseYaml(fileContent);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Failed to parse YAML template: prompts/${projectType}/${moduleSuffix}/${tone}.yaml — ${message}`,
    );
  }

  // Validate structure
  if (parsed === null || typeof parsed !== 'object') {
    throw new Error(
      `Invalid template structure: prompts/${projectType}/${moduleSuffix}/${tone}.yaml — parsed content is not an object`,
    );
  }

  const template = parsed as Record<string, unknown>;
  const missingFields: string[] = [];

  for (const field of REQUIRED_TEMPLATE_FIELDS) {
    if (template[field] === undefined || template[field] === null) {
      missingFields.push(field);
    }
  }

  if (missingFields.length > 0) {
    throw new Error(
      `Invalid template: prompts/${projectType}/${moduleSuffix}/${tone}.yaml — missing required fields: ${missingFields.join(', ')}`,
    );
  }

  // Validate field types
  if (typeof template.prompt !== 'string' || template.prompt.trim() === '') {
    throw new Error(
      `Invalid template: prompts/${projectType}/${moduleSuffix}/${tone}.yaml — 'prompt' must be a non-empty string`,
    );
  }

  if (!Array.isArray(template.variables)) {
    throw new Error(
      `Invalid template: prompts/${projectType}/${moduleSuffix}/${tone}.yaml — 'variables' must be an array`,
    );
  }

  if (typeof template.fallbackText !== 'string' || template.fallbackText.trim() === '') {
    throw new Error(
      `Invalid template: prompts/${projectType}/${moduleSuffix}/${tone}.yaml — 'fallbackText' must be a non-empty string`,
    );
  }

  return template as unknown as PromptTemplate;
}

// ---- Tone Selection ----

/**
 * Select the narrative tone intensity based on a metric rating.
 *
 * - S or A → 'positive' (emphasize achievements)
 * - B → 'standard' (objective statement)
 * - C or D → 'conservative' (cautious, problem-to-opportunity)
 */
export function selectTone(rating: Rating): ToneIntensity {
  switch (rating) {
    case 'S':
    case 'A':
      return 'positive';
    case 'B':
      return 'standard';
    case 'C':
    case 'D':
      return 'conservative';
  }
}

// ---- Attribution Strategies ----

/**
 * Attribution strategy mapping by project type.
 * Each project type has a set of narrative attribution angles.
 */
export const ATTRIBUTION_STRATEGIES: Record<ProjectType, string[]> = {
  '新品上市': ['市场突破', '用户认知建立'],
  '日常种草': ['持续渗透', '口碑积累'],
  '节点营销': ['节点爆发', '流量转化'],
  '竞品防御': ['份额保卫', '差异化优势'],
};

/**
 * Get the attribution strategies for a given project type.
 *
 * @param projectType - The project type
 * @returns Array of attribution strategy strings
 */
export function getAttributionStrategies(projectType: ProjectType): string[] {
  return ATTRIBUTION_STRATEGIES[projectType];
}

// ---- Variable Substitution ----

/**
 * Replace {{variable_name}} placeholders in a prompt string with actual values.
 *
 * @param prompt - The prompt template string containing {{variable}} placeholders
 * @param variables - A record mapping variable names to their string values
 * @returns The prompt with all recognized placeholders replaced
 */
export function substituteVariables(
  prompt: string,
  variables: Record<string, string>,
): string {
  return prompt.replace(/\{\{(\w+)\}\}/g, (match, varName: string) => {
    if (varName in variables) {
      return variables[varName];
    }
    return match; // Leave unrecognized placeholders as-is
  });
}

// ---- LLM Client Instance ----

/** Module-level LLM client instance (set via setLLMClient for dependency injection) */
let llmClient: LLMClient | null = null;

/**
 * Set the LLM client instance used by the narrative engine.
 * This enables dependency injection for testing.
 */
export function setLLMClient(client: LLMClient | null): void {
  llmClient = client;
}

/**
 * Get the current LLM client instance.
 */
export function getLLMClient(): LLMClient | null {
  return llmClient;
}

// ---- Narrative Generation ----

/** Default LLM timeout in milliseconds */
const LLM_TIMEOUT_MS = 30_000;

/**
 * Generate narrative content for a report module.
 *
 * Flow:
 * 1. Load the appropriate YAML prompt template
 * 2. Substitute variables from dataContext into the prompt
 * 3. Call LLM with assembled prompt (30s timeout)
 * 4. On success: parse response into NarrativeParagraph[] (split by double newline)
 * 5. On failure/timeout: use template.fallbackText as content
 *
 * @param request - The narrative generation request
 * @returns NarrativeResult with generated paragraphs
 */
export async function generateNarrative(
  request: NarrativeRequest,
): Promise<NarrativeResult> {
  const { projectType, moduleId, toneIntensity, dataContext, attributionStrategy } = request;

  // Load template
  const template = loadTemplate(projectType, moduleId, toneIntensity);

  // Build variable map from dataContext (convert all values to strings)
  const variables: Record<string, string> = {};
  for (const [key, value] of Object.entries(dataContext)) {
    variables[key] = String(value ?? '');
  }

  // Substitute variables into prompt
  const assembledPrompt = substituteVariables(template.prompt, variables);

  // Determine attribution strategy
  const strategies = getAttributionStrategies(projectType);
  const attribution = attributionStrategy ?? strategies[0] ?? '';

  // Attempt LLM call
  let paragraphs: NarrativeParagraph[];

  try {
    if (!llmClient) {
      console.warn(`[Narrative] LLM client not configured — using fallback for ${moduleId}`);
      throw new Error('LLM client not configured');
    }

    console.log(`[Narrative] Calling LLM for module=${moduleId}, tone=${toneIntensity}, prompt length=${assembledPrompt.length}`);
    const startTime = Date.now();

    const response = await llmClient.chat(
      [{ role: 'user', content: assembledPrompt }],
      { timeout: LLM_TIMEOUT_MS },
    );

    const elapsed = Date.now() - startTime;
    console.log(`[Narrative] LLM response received for ${moduleId} in ${elapsed}ms, length=${response.length}`);

    // Parse response: split by double newline into paragraphs
    const rawParagraphs = response
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    paragraphs = rawParagraphs.map((content) => ({
      id: randomUUID(),
      content,
      tone: toneIntensity,
      relatedMetrics: request.metricRatings.map((r) => r.metricName),
      isTransformed: false,
    }));
  } catch (err) {
    // LLM failure or timeout: fallback to template text
    console.error(`[Narrative] LLM call failed for ${moduleId}:`, err instanceof Error ? err.message : err);
    paragraphs = [
      {
        id: randomUUID(),
        content: template.fallbackText,
        tone: toneIntensity,
        relatedMetrics: request.metricRatings.map((r) => r.metricName),
        isTransformed: false,
      },
    ];
  }

  return {
    moduleId,
    paragraphs,
    toneUsed: toneIntensity,
    attributionUsed: attribution,
  };
}

// ---- Problem-to-Opportunity Transformation ----

/**
 * Transform a problem/negative-framed paragraph into an opportunity/improvement direction.
 *
 * Used for C/D rated metrics to reframe negative data as growth opportunities.
 *
 * Flow:
 * 1. Construct a prompt asking the LLM to reframe the content positively
 * 2. Call LLM with 30s timeout
 * 3. On success: return new NarrativeParagraph with transformed content and isTransformed=true
 * 4. On failure: return original paragraph with isTransformed=true (mark as attempted)
 *
 * @param paragraph - The paragraph to transform
 * @param context - The narrative request context
 * @returns A new NarrativeParagraph with isTransformed=true
 */
export async function transformProblemToOpportunity(
  paragraph: NarrativeParagraph,
  context: NarrativeRequest,
): Promise<NarrativeParagraph> {
  const transformPrompt = [
    '你是一位资深的小红书营销复盘专家。请将以下负面/问题导向的文案重新框架为改进机会和增长方向。',
    '',
    '## 原始文案',
    paragraph.content,
    '',
    '## 转换要求',
    '- 将负面/问题导向的表述转换为改进机会或增长方向',
    '- 保持专业语气',
    '- 保留原文中的数据点，但以积极的方式呈现',
    '- 输出1段50-100字的转换后文案，不要包含标题或额外格式',
  ].join('\n');

  try {
    if (!llmClient) {
      console.warn('[Narrative] LLM client not configured — skipping problem-to-opportunity transform');
      throw new Error('LLM client not configured');
    }

    console.log(`[Narrative] Calling LLM for problem-to-opportunity transform, input length=${transformPrompt.length}`);
    const startTime = Date.now();

    const response = await llmClient.chat(
      [{ role: 'user', content: transformPrompt }],
      { timeout: LLM_TIMEOUT_MS },
    );

    const elapsed = Date.now() - startTime;
    console.log(`[Narrative] Transform LLM response in ${elapsed}ms, length=${response.length}`);

    const transformedContent = response.split(/\n\n+/)[0]?.trim() || paragraph.content;

    return {
      id: randomUUID(),
      content: transformedContent,
      tone: paragraph.tone,
      relatedMetrics: paragraph.relatedMetrics,
      isTransformed: true,
    };
  } catch (err) {
    // On LLM failure: return original content but mark as transformed (attempted)
    console.error('[Narrative] Transform LLM call failed:', err instanceof Error ? err.message : err);
    return {
      ...paragraph,
      isTransformed: true,
    };
  }
}

// ---- AI Chat ----

/** Fallback message when LLM is unavailable */
export const CHAT_FALLBACK_MESSAGE = '抱歉，AI助手暂时无法响应，请稍后重试。';

/**
 * AI chat function for the review platform.
 *
 * Supports:
 * - Attribution analysis (explain why metrics performed well/poorly)
 * - Data queries (provide specific data points)
 * - Optimization suggestions (recommend improvements)
 *
 * @param messages - Multi-turn conversation history
 * @param context - Project context (projectId, optional moduleId)
 * @returns LLM-generated response string, or fallback message on failure
 */
export async function chat(
  messages: { role: 'user' | 'assistant'; content: string }[],
  context: { projectId: string; moduleId?: ModuleId },
): Promise<string> {
  const systemPrompt = buildChatSystemPrompt(context);

  const chatMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: systemPrompt },
    ...messages,
  ];

  try {
    if (!llmClient) {
      console.warn('[Narrative] LLM client not configured — returning chat fallback');
      throw new Error('LLM client not configured');
    }

    console.log(`[Narrative] Chat LLM call, messages=${chatMessages.length}, projectId=${context.projectId}, module=${context.moduleId ?? 'none'}`);
    const startTime = Date.now();

    const response = await llmClient.chat(chatMessages, { timeout: LLM_TIMEOUT_MS });

    const elapsed = Date.now() - startTime;
    console.log(`[Narrative] Chat LLM response in ${elapsed}ms, length=${response.length}`);
    return response;
  } catch (err) {
    console.error('[Narrative] Chat LLM call failed:', err instanceof Error ? err.message : err);
    return CHAT_FALLBACK_MESSAGE;
  }
}

/**
 * Build the system prompt for the AI chat assistant.
 * Establishes the AI as a marketing review expert with context about the project.
 */
export function buildChatSystemPrompt(context: { projectId: string; moduleId?: ModuleId }): string {
  const moduleInfo = context.moduleId
    ? `当前聚焦模块：${context.moduleId}（${MODULE_NAMES[context.moduleId] ?? context.moduleId}）`
    : '当前未聚焦特定模块';

  return [
    '你是一位资深的小红书营销复盘专家AI助手。你正在协助用户审校营销复盘报告。',
    '',
    '## 项目上下文',
    `- 项目ID：${context.projectId}`,
    `- ${moduleInfo}`,
    '',
    '## 你的能力',
    '你可以帮助用户完成以下任务：',
    '1. **归因分析**：解释为什么某些指标表现好或差，分析背后的原因',
    '2. **数据查询**：提供特定维度的详细数据点和统计信息',
    '3. **优化建议**：针对当前数据表现，推荐具体的改进方向和优化策略',
    '',
    '## 回答要求',
    '- 回答应专业、简洁、有数据支撑',
    '- 使用中文回答',
    '- 如涉及具体数据，请明确标注数据来源维度',
    '- 优化建议应具有可操作性',
  ].join('\n');
}

// ---- Paragraph Regeneration ----

export async function regenerateParagraph(
  paragraphId: string,
  newTone: ToneIntensity,
  context: NarrativeRequest,
): Promise<NarrativeParagraph> {
  const { projectType, moduleId, dataContext, metricRatings } = context;

  // Load template for the new tone
  const template = loadTemplate(projectType, moduleId, newTone);

  // Build variable map
  const variables: Record<string, string> = {};
  for (const [key, value] of Object.entries(dataContext)) {
    variables[key] = String(value ?? '');
  }

  // Substitute variables
  const assembledPrompt = substituteVariables(template.prompt, variables);

  try {
    if (!llmClient) {
      console.warn(`[Narrative] LLM client not configured — using fallback for regenerate ${moduleId}`);
      throw new Error('LLM client not configured');
    }

    console.log(`[Narrative] Regenerate LLM call for module=${moduleId}, tone=${newTone}, prompt length=${assembledPrompt.length}`);
    const startTime = Date.now();

    const response = await llmClient.chat(
      [{ role: 'user', content: assembledPrompt }],
      { timeout: LLM_TIMEOUT_MS },
    );

    const elapsed = Date.now() - startTime;
    console.log(`[Narrative] Regenerate LLM response for ${moduleId} in ${elapsed}ms, length=${response.length}`);

    // Use the first paragraph from the response
    const content = response.split(/\n\n+/)[0]?.trim() || template.fallbackText;

    return {
      id: randomUUID(),
      content,
      tone: newTone,
      relatedMetrics: metricRatings.map((r) => r.metricName),
      isTransformed: false,
    };
  } catch (err) {
    // Fallback on LLM failure
    console.error(`[Narrative] Regenerate LLM call failed for ${moduleId}:`, err instanceof Error ? err.message : err);
    return {
      id: randomUUID(),
      content: template.fallbackText,
      tone: newTone,
      relatedMetrics: metricRatings.map((r) => r.metricName),
      isTransformed: false,
    };
  }
}
