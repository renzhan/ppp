/**
 * Marketing Review System - Top-level Entry Point
 * 小红书营销项目复盘报告自动生成系统
 *
 * Re-exports the main services from each layer:
 * - Data Ingestion (ingestion)
 * - Calculation Engine (calculation)
 * - Report Generation (report)
 */

// ---- Data Ingestion Layer ----
export { DataIngestionService } from './ingestion/index.js';

// ---- Calculation Engine Layer ----
export { runCalculationPipeline, onEngagementConfigChange } from './calculation/pipeline.js';

// ---- Report Generation Layer ----
export { generateReport } from './report/pipeline.js';
export { assembleReport, exportReport } from './report/index.js';

// ---- HTML Report Generation (Direct LLM → HTML) ----
export { generateHtmlReport, type HtmlReportOptions, type HtmlReportResult } from './report/html-report-generator.js';
