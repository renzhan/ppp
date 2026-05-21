/**
 * Export module type definitions.
 */

export interface TemplateConfig {
  id: string;
  name: string;
  fonts: { heading: string; body: string };
  colors: { primary: string; secondary: string; accent: string };
  spacing: { lineHeight: number; paragraphSpacing: number };
  margins: { top: number; bottom: number; left: number; right: number };
  logo?: { url: string; position: 'header-left' | 'header-right' };
  headerFooter: { header?: string; footer?: string };
}

export interface TemplateSummary {
  id: string;
  name: string;
  preview?: string;
}

export interface ExportOptions {
  format: 'pdf' | 'docx';
  templateId?: string;
  versionId: string;
  hiddenColumns?: Record<string, string[]>;
}

export interface ExportResult {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}

// ─── Report Content Types (for PDF/Word export) ─────────────────────────────

/**
 * Status of a report module as determined by the decision engine.
 * - 'show': Module is fully visible
 * - 'hide': Module is excluded from export
 * - 'degraded': Module is shown but annotated as data-incomplete
 */
export type ModuleStatus = 'show' | 'hide' | 'degraded';

/**
 * A table within a report module.
 */
export interface ReportTable {
  title?: string;
  headers: string[];
  rows: string[][];
}

/**
 * A single module in the report content.
 */
export interface ReportModule {
  moduleId: string;
  title: string;
  status: ModuleStatus;
  narrative?: string;
  tables?: ReportTable[];
  chartIds?: string[];           // References to ChartImage by moduleId match
}

/**
 * Project metadata displayed on the cover page.
 */
export interface ProjectMetadata {
  projectName: string;
  brand: string;
  category: string;
  projectType: string;
  generatedAt: Date;
}

/**
 * Complete report content structure for export.
 */
export interface ReportContent {
  metadata: ProjectMetadata;
  modules: ReportModule[];
}
