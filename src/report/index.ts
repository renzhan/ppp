// Report Generator Module
// Handles report assembly, LLM integration, and export
export { OpenAILLMClient, createLLMClientFromEnv, type LLMClient, type LLMConfig, type LLMProvider } from './llm-client.js';
export { assembleReport, REPORT_MODULE_ORDER, fillPlaceholders } from './assembler.js';
export { parsePlanDocument, generateOptimizationSuggestions, saveEditedSuggestions } from './ai-service.js';
export { exportReport } from './exporter.js';
export { generateReport, type GenerateReportOptions } from './pipeline.js';

// HTML Report Generation (new approach - direct LLM to HTML)
export { generateHtmlReport, type HtmlReportOptions, type HtmlReportResult } from './html-report-generator.js';
export { assembleReportData, type HtmlReportData } from './html-report-data-assembler.js';
export { buildHtmlReportPrompt, type PromptBuildOptions } from './html-report-prompt-builder.js';
