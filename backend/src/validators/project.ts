/**
 * Project Validation
 *
 * Zod schemas and validation functions for project-related inputs.
 * Validates project names (non-empty, max 200 characters) and
 * full project creation payloads.
 *
 * Requirement 3.6: WHEN a project name is provided THEN the PPP_Backend
 * SHALL validate that the name is non-empty and does not exceed 200 characters.
 */

import { z } from 'zod';

/** Maximum allowed length for a project name */
export const PROJECT_NAME_MAX_LENGTH = 200;

/**
 * Zod schema for project name validation.
 * - Must be a string
 * - Must be non-empty after trimming
 * - Must not exceed 200 characters
 */
export const projectNameSchema = z
  .string()
  .trim()
  .min(1, { message: 'Project name must not be empty' })
  .max(PROJECT_NAME_MAX_LENGTH, {
    message: `Project name must not exceed ${PROJECT_NAME_MAX_LENGTH} characters`,
  });

/**
 * Zod schema for full project creation request.
 * Includes name, brand, category, platform, and date range.
 */
export const createProjectSchema = z.object({
  name: projectNameSchema,
  brand: z.string().trim().min(1, { message: 'Brand must not be empty' }),
  category: z.string().trim().min(1, { message: 'Category must not be empty' }),
  platform: z.string().trim().min(1, { message: 'Platform must not be empty' }),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
});

/** Inferred type for a valid project creation request */
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

/**
 * Result of project name validation.
 */
export type ValidateProjectNameResult =
  | { valid: true; name: string }
  | { valid: false; error: string };

/**
 * Validate a project name string.
 *
 * Returns { valid: true, name } with the trimmed name if valid,
 * or { valid: false, error } with a descriptive error message if invalid.
 *
 * @param name - The project name to validate
 * @returns Validation result indicating success or failure with error message
 */
export function validateProjectName(name: string): ValidateProjectNameResult {
  const result = projectNameSchema.safeParse(name);

  if (result.success) {
    return { valid: true, name: result.data };
  }

  const error = result.error.issues[0]?.message ?? 'Invalid project name';
  return { valid: false, error };
}
