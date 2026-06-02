/**
 * Pure utility functions for ingestion trigger decision logic.
 *
 * Extracted from the POST/PUT route handlers to enable property-based testing.
 */

export type TriggerMode = 'create' | 'update';

/**
 * Determines whether juguang data ingestion should be triggered.
 *
 * For CREATE (oldIds is undefined/null/empty):
 *   - Trigger iff newIds is non-empty
 *
 * For UPDATE (oldIds is provided):
 *   - Trigger iff newIds is non-empty AND JSON.stringify(oldIds) !== JSON.stringify(newIds)
 *
 * @param oldIds - The previous advertiser ID array (undefined/null for create case)
 * @param newIds - The new advertiser ID array
 * @returns Whether ingestion should be triggered
 */
export function shouldTriggerIngestion(
  oldIds: string[] | undefined | null,
  newIds: string[]
): boolean {
  // Never trigger if new IDs are empty
  if (newIds.length === 0) {
    return false;
  }

  // Create case: oldIds is undefined/null or empty array
  const effectiveOldIds = oldIds ?? [];
  if (effectiveOldIds.length === 0) {
    // Create scenario (or update from empty): always trigger if newIds is non-empty
    return true;
  }

  // Update case: trigger only if arrays differ in content (JSON.stringify comparison)
  return JSON.stringify(effectiveOldIds) !== JSON.stringify(newIds);
}
