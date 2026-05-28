/**
 * HTML Report Generator - 直接通过大模型提示词生成完整可编辑HTML复盘报告
 *
 * 新方案：不再逐章节拼装，而是将所有项目数据组装为一个完整提示词，
 * 让大模型直接输出一个独立的HTML页面，包含：
 * - ECharts 图表（柱状图、饼图等）
 * - 原生数据表格
 * - 内容可编辑（contenteditable）
 * - 导出PDF（html2canvas + jsPDF）
 * - 导出DOCX（html-docx-js）
 *
 * 使用方式：
 *   const html = await generateHtmlReport(projectId);
 *   // html 是完整的 HTML 字符串，可直接在浏览器中打开
 */

import type { LLMClient } from './llm-client.js';
import { createLLMClientFromEnv } from './llm-client.js';
import { assembleReportData } from './html-report-data-assembler.js';
import { buildHtmlReportPrompt } from './html-report-prompt-builder.js';
import { getPrismaClient } from '../shared/db.js';

/**
 * HTML报告生成配置
 */
export interface HtmlReportOptions {
  /** LLM客户端（可选，默认从环境变量创建） */
  llmClient?: LLMClient;
  /** LLM超时时间（毫秒），默认120000（2分钟，因为生成完整HTML较长） */
  timeout?: number;
  /** 是否包含编辑功能，默认true */
  editable?: boolean;
  /** 是否包含导出按钮，默认true */
  exportButtons?: boolean;
  /** 自定义提示词附加内容（追加到系统提示词末尾） */
  additionalInstructions?: string;
}

/**
 * HTML报告生成结果
 */
export interface HtmlReportResult {
  /** 完整的HTML字符串 */
  html: string;
  /** 生成时间 */
  generatedAt: string;
  /** 项目ID */
  projectId: string;
  /** 报告版本ID（如果保存到数据库） */
  versionId?: string;
}

/**
 * 生成完整的HTML复盘报告
 *
 * 流程：
 * 1. 从数据库加载项目所有数据
 * 2. 组装数据为结构化上下文
 * 3. 构建提示词（系统提示词 + 数据上下文）
 * 4. 调用大模型生成完整HTML
 * 5. 提取并验证HTML
 * 6. 保存到数据库（可选）
 *
 * @param projectId - 项目UUID
 * @param options - 生成选项
 * @returns HTML报告结果
 */
export async function generateHtmlReport(
  projectId: string,
  options?: HtmlReportOptions,
): Promise<HtmlReportResult> {
  const llmClient = options?.llmClient ?? createLLMClientFromEnv();
  const timeout = options?.timeout ?? 120000;
  const editable = options?.editable ?? true;
  const exportButtons = options?.exportButtons ?? true;

  console.log(`[HtmlReportGenerator] Starting HTML report generation for project: ${projectId}`);

  // Step 1: 加载项目数据
  const reportData = await assembleReportData(projectId);
  console.log(`[HtmlReportGenerator] Data assembled: ${Object.keys(reportData).length} sections`);

  // Step 2: 构建提示词
  const { systemPrompt, userPrompt } = buildHtmlReportPrompt(reportData, {
    editable,
    exportButtons,
    additionalInstructions: options?.additionalInstructions,
  });
  console.log(`[HtmlReportGenerator] Prompt built: system=${systemPrompt.length}chars, user=${userPrompt.length}chars`);

  // Step 3: 调用大模型
  const rawResponse = await llmClient.chat(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    { timeout, temperature: 0.3 },
  );
  console.log(`[HtmlReportGenerator] LLM response received: ${rawResponse.length} chars`);

  // Step 4: 提取HTML
  const html = extractHtmlFromResponse(rawResponse);
  console.log(`[HtmlReportGenerator] HTML extracted: ${html.length} chars`);

  // Step 5: 保存到数据库
  const versionId = await saveHtmlReport(projectId, html);

  return {
    html,
    generatedAt: new Date().toISOString(),
    projectId,
    versionId,
  };
}

/**
 * 从LLM响应中提取HTML代码
 * 处理可能的markdown代码块包裹
 */
function extractHtmlFromResponse(response: string): string {
  // 尝试从 ```html ... ``` 代码块中提取
  const htmlBlockMatch = response.match(/```html\s*\n?([\s\S]*?)\n?```/);
  if (htmlBlockMatch) {
    return htmlBlockMatch[1].trim();
  }

  // 尝试从 ``` ... ``` 代码块中提取
  const codeBlockMatch = response.match(/```\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    const content = codeBlockMatch[1].trim();
    if (content.startsWith('<!DOCTYPE') || content.startsWith('<html')) {
      return content;
    }
  }

  // 尝试直接匹配完整HTML文档
  const htmlDocMatch = response.match(/(<!DOCTYPE[\s\S]*<\/html>)/i);
  if (htmlDocMatch) {
    return htmlDocMatch[1].trim();
  }

  // 如果都没匹配到，返回原始响应（可能本身就是HTML）
  const trimmed = response.trim();
  if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html')) {
    return trimmed;
  }

  // 最后兜底：包裹为基础HTML
  console.warn('[HtmlReportGenerator] Could not extract HTML from response, wrapping as-is');
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><title>复盘报告</title></head>
<body>${trimmed}</body>
</html>`;
}

/**
 * 保存HTML报告到数据库
 */
async function saveHtmlReport(projectId: string, html: string): Promise<string | undefined> {
  try {
    const prisma = getPrismaClient();

    // 查找最新版本号
    const latestVersion = await prisma.reportVersion.findFirst({
      where: { projectId },
      orderBy: { versionNumber: 'desc' },
    });
    const versionNumber = (latestVersion?.versionNumber ?? 0) + 1;

    // 创建新版本
    const reportVersion = await prisma.reportVersion.create({
      data: {
        projectId,
        versionNumber,
        content: { type: 'html', html } as any,
        status: 'draft',
      },
    });

    console.log(`[HtmlReportGenerator] Report saved: versionId=${reportVersion.id}, version=${versionNumber}`);
    return reportVersion.id;
  } catch (error) {
    console.error('[HtmlReportGenerator] Failed to save report to DB:', error);
    return undefined;
  }
}
