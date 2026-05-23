/**
 * File validation utilities for upload endpoints.
 *
 * Used by:
 * - /api/admin/import/project-base route (validates .xlsx files)
 * - Property tests (verifies file type validation correctness)
 */

/**
 * Validates whether a file name has a valid .xlsx extension
 * for project base table uploads.
 *
 * @param fileName - The file name to validate
 * @returns true if the file has a .xlsx extension, false otherwise
 */
export function isValidProjectBaseFile(fileName: string): boolean {
  return fileName.toLowerCase().endsWith('.xlsx');
}
