import { Report, ExportFormat } from '../shared/types.js';

/**
 * Export a report to the specified format.
 *
 * Supports:
 * - JSON: Serializes the Report object to a formatted JSON Buffer
 * - HTML: Returns pre-generated HTML content as a Buffer
 * - PDF/PPTX: Not yet implemented (throws an error)
 *
 * @param report - The assembled report to export
 * @param format - The desired export format
 * @param htmlContent - Pre-generated HTML content (required for HTML format)
 * @returns A Buffer containing the exported report data
 */
export async function exportReport(
  report: Report,
  format: ExportFormat,
  htmlContent?: string,
): Promise<Buffer> {
  switch (format) {
    case ExportFormat.JSON:
      return exportAsJSON(report);
    case ExportFormat.HTML:
      return exportAsHTML(report, htmlContent);
    case ExportFormat.PDF:
      throw new Error('PDF export format is not yet supported. Use HTML format with built-in PDF export button.');
    case ExportFormat.PPTX:
      throw new Error('PPTX export format is not yet supported');
    default:
      throw new Error(`Unknown export format: ${format}`);
  }
}

/**
 * Serialize a Report object to a formatted JSON Buffer.
 */
function exportAsJSON(report: Report): Buffer {
  const jsonString = JSON.stringify(report, null, 2);
  return Buffer.from(jsonString, 'utf-8');
}

/**
 * Export as HTML. If htmlContent is provided, use it directly.
 * Otherwise, generate a basic HTML wrapper around the report JSON.
 */
function exportAsHTML(_report: Report, htmlContent?: string): Buffer {
  if (htmlContent) {
    return Buffer.from(htmlContent, 'utf-8');
  }
  throw new Error('HTML export requires pre-generated HTML content. Use generateHtmlReport() first.');
}
