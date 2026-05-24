import { Report, ExportFormat } from '../shared/types.js';

/**
 * Export a report to the specified format.
 *
 * Currently supports:
 * - JSON: Serializes the Report object to a formatted JSON Buffer
 * - PDF/PPTX: Not yet implemented (throws an error)
 *
 * @param report - The assembled report to export
 * @param format - The desired export format
 * @returns A Buffer containing the exported report data
 */
export async function exportReport(report: Report, format: ExportFormat): Promise<Buffer> {
  switch (format) {
    case ExportFormat.JSON:
      return exportAsJSON(report);
    case ExportFormat.PDF:
      throw new Error('PDF export format is not yet supported');
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
