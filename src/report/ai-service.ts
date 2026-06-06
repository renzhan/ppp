/**
 * AI Service - AI辅助功能
 * - 策划案解析（parsePlanDocument）
 * - 优化建议生成（generateOptimizationSuggestions）
 * - 保存编辑后的建议（saveEditedSuggestions）
 */

import type { LLMClient } from './llm-client.js';
import type { ProjectBackground, AllMetrics, Highlight } from '../shared/types.js';
import { getPrismaClient } from '../shared/db.js';

const FALLBACK_MESSAGE = 'AI生成失败，请稍后重试';

/**
 * Fallback template for project background when LLM fails.
 */
function getFallbackProjectBackground(): ProjectBackground {
  return {
    objective: '数据待补充',
    strategy: '数据待补充',
    targetAudience: '数据待补充',
    keyMessages: [],
    budget: undefined,
    timeline: undefined,
  };
}

/**
 * Fallback template for optimization suggestions when LLM fails.
 */
function getFallbackOptimizationSuggestions(): string {
  return [
    '## 优化建议',
    '',
    '基于本次项目数据分析，以下为初步优化方向：',
    '',
    '1. **内容策略优化**：建议根据爆文特征优化内容方向，提升整体互动率。',
    '2. **达人组合优化**：建议根据各层级达人表现调整投放比例。',
    '3. **投流策略优化**：建议根据投流效果数据优化预算分配。',
    '4. **转化路径优化**：建议根据组件点击数据优化转化链路。',
    '',
    '（AI生成失败，以上为模板建议，请根据实际数据补充具体内容。）',
  ].join('\n');
}

/**
 * Parse a plan document (策划案) using LLM to extract project background info.
 *
 * @param document - The plan document as a Buffer (text-based formats: PDF text, docx text, etc.)
 * @param llmClient - The LLM client to use for parsing
 * @returns Parsed ProjectBackground
 */
export async function parsePlanDocument(
  document: Buffer,
  llmClient: LLMClient,
): Promise<ProjectBackground> {
  const documentText = document.toString('utf-8');

  const systemPrompt = `你是一个营销策划案分析助手。请从以下策划案文档中提取项目背景信息，并以JSON格式返回。

请提取以下字段：
- objective: 传播目的/项目目标
- strategy: 策略回顾/营销策略
- targetAudience: 目标人群
- keyMessages: 核心传播信息（数组）
- budget: 预算金额（数字，如果有的话）
- timeline: 时间线/项目周期（字符串，如果有的话）

请严格按照以下JSON格式返回，不要包含其他内容：
{
  "objective": "...",
  "strategy": "...",
  "targetAudience": "...",
  "keyMessages": ["...", "..."],
  "budget": null,
  "timeline": null
}`;

  let response: string;
  try {
    response = await llmClient.chat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: documentText },
      ],
      { temperature: 0.3 },
    );
  } catch (err) {
    console.error('[AI-Service] parsePlanDocument LLM调用失败:', err instanceof Error ? err.message : err);
    return getFallbackProjectBackground();
  }

  // Check if LLM returned the fallback message
  if (response === FALLBACK_MESSAGE) {
    return getFallbackProjectBackground();
  }

  try {
    // Try to extract JSON from the response (handle markdown code blocks)
    const jsonStr = extractJSON(response);
    const parsed = JSON.parse(jsonStr);

    return {
      objective: typeof parsed.objective === 'string' ? parsed.objective : '数据待补充',
      strategy: typeof parsed.strategy === 'string' ? parsed.strategy : '数据待补充',
      targetAudience: typeof parsed.targetAudience === 'string' ? parsed.targetAudience : '数据待补充',
      keyMessages: Array.isArray(parsed.keyMessages)
        ? parsed.keyMessages.filter((m: unknown) => typeof m === 'string')
        : [],
      budget: typeof parsed.budget === 'number' ? parsed.budget : undefined,
      timeline: typeof parsed.timeline === 'string' ? parsed.timeline : undefined,
    };
  } catch {
    // If JSON parsing fails, return fallback
    return getFallbackProjectBackground();
  }
}

/**
 * Generate optimization suggestions using LLM based on project metrics and highlights.
 *
 * @param metrics - All project metrics
 * @param highlights - Identified project highlights
 * @param llmClient - The LLM client to use
 * @returns Optimization suggestions text in Chinese
 */
export async function generateOptimizationSuggestions(
  metrics: AllMetrics,
  highlights: Highlight[],
  llmClient: LLMClient,
): Promise<string> {
  const systemPrompt = `你是一个小红书营销项目复盘专家。请基于以下项目数据和亮点，生成具体的优化建议。

要求：
1. 使用中文撰写
2. 结合具体数据给出建议
3. 包含内容策略、达人组合、投流策略、转化优化等维度
4. 建议要具体可执行，避免空泛
5. 使用Markdown格式，包含标题和分点`;

  const userContent = `## 项目指标数据

### 核心指标
- 总曝光量: ${metrics.projectMetrics.totalImpressions}
- 总阅读量: ${metrics.projectMetrics.totalReads}
- 总互动量: ${metrics.projectMetrics.totalEngagement}
- 爆文数: ${metrics.projectMetrics.viralCount}
- 爆文率: ${(metrics.projectMetrics.viralRate * 100).toFixed(1)}%
- CPM: ${metrics.projectMetrics.cpm}
- CPC: ${metrics.projectMetrics.cpc}
- CPE: ${metrics.projectMetrics.cpe}
- CTR: ${metrics.projectMetrics.ctr}

### KPI完成情况
${Object.entries(metrics.kpiResults)
  .map(([key, val]) => `- ${key}: ${val.completionRate !== null ? (val.completionRate * 100).toFixed(1) + '%' : val.label}`)
  .join('\n')}

### 大盘对比
${Object.entries(metrics.benchmarkResults)
  .map(([key, val]) => `- ${key}: ${val.label} (${val.percentageDiff > 0 ? '+' : ''}${val.percentageDiff.toFixed(1)}%)`)
  .join('\n')}

### 达人层级表现
${metrics.kolTierAggregation
  .map((tier) => `- ${tier.tier}: ${tier.noteCount}篇笔记, 爆文率${(tier.viralRate * 100).toFixed(1)}%, CPE=${tier.averageCPE}`)
  .join('\n')}

### 项目亮点
${highlights.map((h) => `- [${h.type}] ${h.description}`).join('\n')}`;

  let response: string;
  try {
    response = await llmClient.chat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      { temperature: 0.7 },
    );
  } catch (err) {
    console.error('[AI-Service] generateOptimizationSuggestions LLM调用失败:', err instanceof Error ? err.message : err);
    return getFallbackOptimizationSuggestions();
  }

  // Check if LLM returned the fallback message
  if (response === FALLBACK_MESSAGE) {
    return getFallbackOptimizationSuggestions();
  }

  return response;
}

/**
 * Save human-edited optimization suggestions to the ai_generated_content table.
 *
 * @param projectId - The project UUID
 * @param content - The edited content to save
 */
export async function saveEditedSuggestions(
  projectId: string,
  content: string,
): Promise<void> {
  const prisma = getPrismaClient();

  // Find existing record for this project + content_type
  const existing = await prisma.aiGeneratedContent.findFirst({
    where: {
      projectId,
      contentType: 'optimization_suggestions',
    },
  });

  if (existing) {
    // Update existing record
    await prisma.aiGeneratedContent.update({
      where: { id: existing.id },
      data: {
        editedContent: content,
        isEdited: true,
        updatedAt: new Date(),
      },
    });
  } else {
    // Create new record with edited content
    await prisma.aiGeneratedContent.create({
      data: {
        projectId,
        contentType: 'optimization_suggestions',
        editedContent: content,
        isEdited: true,
      },
    });
  }
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

  // Return as-is and let JSON.parse handle the error
  return text;
}
