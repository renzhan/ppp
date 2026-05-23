/**
 * Pure note overwrite simulation utility.
 *
 * Replicates the overwrite logic from /api/upload/note-base/[projectId] route
 * in a testable, database-independent form. Used for property-based testing
 * of the full overwrite behavior (delete all → insert new → deduplicate by noteId).
 */

export interface NoteRecord {
  noteId: string;
  [key: string]: unknown;
}

/**
 * Simulates the note base table full overwrite operation.
 *
 * The actual API performs:
 * 1. Delete all existing notes for the project
 * 2. Deduplicate new notes by noteId (last occurrence wins)
 * 3. Insert deduplicated new notes
 *
 * This function mirrors that logic in a pure, testable form.
 *
 * @param _existingNotes - The current notes in the database (will be discarded)
 * @param newNotes - The new notes from the uploaded file
 * @returns The final state after overwrite (deduplicated new notes)
 */
export function simulateNoteOverwrite(
  _existingNotes: NoteRecord[],
  newNotes: NoteRecord[]
): NoteRecord[] {
  // Step 1: All existing notes are deleted (ignored entirely)

  // Step 2: Deduplicate new notes by noteId (last occurrence wins, matching API behavior)
  const deduped = new Map<string, NoteRecord>();
  for (const note of newNotes) {
    deduped.set(note.noteId, note);
  }

  // Step 3: Return the deduplicated set as the final state
  return Array.from(deduped.values());
}
