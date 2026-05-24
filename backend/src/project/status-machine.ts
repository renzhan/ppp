/**
 * Project Status Machine
 *
 * Manages project lifecycle state transitions with optimistic locking
 * to prevent concurrent update conflicts.
 *
 * States: draft → uploading → generating → reviewing → finalized
 */

import { getPrismaClient } from '../shared/db.js';

export type ProjectStatus = 'draft' | 'uploading' | 'generating' | 'reviewing' | 'finalized';

export interface StatusTransition {
  from: ProjectStatus;
  to: ProjectStatus;
  trigger: string;
}

export interface TransitionResult {
  success: boolean;
  newStatus?: ProjectStatus;
  error?: string;
}

/**
 * Valid state transitions for the project lifecycle.
 * Each transition is triggered by a specific event.
 */
export const VALID_TRANSITIONS: StatusTransition[] = [
  { from: 'draft', to: 'uploading', trigger: 'first_upload' },
  { from: 'uploading', to: 'generating', trigger: 'generate_triggered' },
  { from: 'generating', to: 'reviewing', trigger: 'generation_complete' },
  { from: 'reviewing', to: 'finalized', trigger: 'finalize' },
];

/** All valid project statuses */
const VALID_STATUSES: ProjectStatus[] = ['draft', 'uploading', 'generating', 'reviewing', 'finalized'];

/** Maximum number of optimistic lock retries */
const MAX_RETRIES = 3;

/**
 * Check if a given string is a valid ProjectStatus.
 */
export function isValidStatus(status: string): status is ProjectStatus {
  return VALID_STATUSES.includes(status as ProjectStatus);
}

/**
 * Find the target status for a given current status and trigger.
 * Returns undefined if no valid transition exists.
 */
export function findTransition(currentStatus: ProjectStatus, trigger: string): StatusTransition | undefined {
  return VALID_TRANSITIONS.find(t => t.from === currentStatus && t.trigger === trigger);
}

/**
 * Transition a project's status based on a trigger event.
 *
 * Uses optimistic locking via the `updatedAt` timestamp to prevent
 * concurrent status update conflicts. If a conflict is detected,
 * the operation is retried up to MAX_RETRIES times.
 *
 * Invalid transitions are silently rejected (returns success: false).
 *
 * @param projectId - The UUID of the project to transition
 * @param trigger - The event trigger (e.g., 'first_upload', 'generate_triggered')
 * @returns TransitionResult indicating success/failure and the new status
 */
export async function transitionStatus(
  projectId: string,
  trigger: string
): Promise<TransitionResult> {
  const prisma = getPrismaClient();

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    // 1. Read current project state
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return { success: false, error: 'Project not found' };
    }

    // 2. Determine current status (default to 'draft' if not set)
    const currentStatus = ((project as Record<string, unknown>).status as string) || 'draft';

    if (!isValidStatus(currentStatus)) {
      return { success: false, error: `Invalid current status: ${currentStatus}` };
    }

    // 3. Find valid transition
    const transition = findTransition(currentStatus, trigger);

    if (!transition) {
      // Invalid transition: silently reject
      return { success: false };
    }

    // 4. Attempt optimistic lock update using updatedAt as version field
    const previousUpdatedAt = project.updatedAt;

    try {
      await prisma.project.update({
        where: {
          id: projectId,
          // Optimistic lock: only update if updatedAt hasn't changed
          updatedAt: previousUpdatedAt,
        },
        data: {
          status: transition.to,
          updatedAt: new Date(),
        } as Record<string, unknown>,
      });

      return { success: true, newStatus: transition.to };
    } catch (error: unknown) {
      // Check if this is a Prisma "record not found" error (optimistic lock failure)
      // P2025: "An operation failed because it depends on one or more records that were required but not found."
      if (isOptimisticLockError(error)) {
        // Concurrent update detected, retry
        if (attempt < MAX_RETRIES - 1) {
          continue;
        }
        return { success: false, error: 'Concurrent update conflict after retries' };
      }

      // Unexpected error
      return { success: false, error: `Unexpected error: ${String(error)}` };
    }
  }

  return { success: false, error: 'Max retries exceeded' };
}

/**
 * Check if an error is an optimistic lock conflict (Prisma P2025).
 */
function isOptimisticLockError(error: unknown): boolean {
  if (error && typeof error === 'object' && 'code' in error) {
    return (error as { code: string }).code === 'P2025';
  }
  return false;
}
