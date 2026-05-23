/**
 * Property-Based Test: Note base table full overwrite
 *
 * **Validates: Requirements 8.3**
 *
 * Property 4: For any project with N existing notes, uploading a new note base
 * table with M rows should result in exactly the deduplicated new notes in the
 * database. No notes from the previous upload should remain.
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { simulateNoteOverwrite, type NoteRecord } from './note-overwrite';

// --- Generators ---

/** Generates a note record with a noteId and arbitrary extra fields */
const noteRecordArb: fc.Arbitrary<NoteRecord> = fc.record({
  noteId: fc.string({ minLength: 1, maxLength: 30 }),
  kolNickName: fc.string({ minLength: 0, maxLength: 20 }),
  impNum: fc.nat({ max: 1_000_000 }),
});

// --- Tests ---

describe('Property 4: Note base table full overwrite', () => {
  it('result count equals the deduplicated new notes count', () => {
    /**
     * **Validates: Requirements 8.3**
     *
     * After overwrite, the number of notes in the result equals the number
     * of unique noteIds in the new notes array.
     */
    fc.assert(
      fc.property(
        fc.array(noteRecordArb, { minLength: 0, maxLength: 50 }),
        fc.array(noteRecordArb, { minLength: 0, maxLength: 50 }),
        (existingNotes, newNotes) => {
          const result = simulateNoteOverwrite(existingNotes, newNotes);

          const uniqueNewNoteIds = new Set(newNotes.map((n) => n.noteId));
          expect(result.length).toBe(uniqueNewNoteIds.size);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('no notes from the existing set remain after overwrite', () => {
    /**
     * **Validates: Requirements 8.3**
     *
     * After overwrite, no note from the existing set should be present
     * in the result unless it happens to share a noteId with a new note.
     * We verify this by checking that every result note's noteId exists
     * in the new notes array.
     */
    fc.assert(
      fc.property(
        fc.array(noteRecordArb, { minLength: 1, maxLength: 50 }),
        fc.array(noteRecordArb, { minLength: 1, maxLength: 50 }),
        (existingNotes, newNotes) => {
          const result = simulateNoteOverwrite(existingNotes, newNotes);

          const newNoteIds = new Set(newNotes.map((n) => n.noteId));

          for (const note of result) {
            expect(newNoteIds.has(note.noteId)).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('the result contains exactly the deduplicated new notes', () => {
    /**
     * **Validates: Requirements 8.3**
     *
     * After overwrite, the result set should contain exactly the last
     * occurrence of each unique noteId from the new notes array.
     * This verifies both completeness and correctness of deduplication.
     */
    fc.assert(
      fc.property(
        fc.array(noteRecordArb, { minLength: 0, maxLength: 50 }),
        fc.array(noteRecordArb, { minLength: 0, maxLength: 50 }),
        (existingNotes, newNotes) => {
          const result = simulateNoteOverwrite(existingNotes, newNotes);

          // Build expected: last occurrence of each noteId in newNotes
          const expected = new Map<string, NoteRecord>();
          for (const note of newNotes) {
            expected.set(note.noteId, note);
          }

          // Result should have same size as expected
          expect(result.length).toBe(expected.size);

          // Every expected note should be in the result
          const resultMap = new Map(result.map((n) => [n.noteId, n]));
          for (const [noteId, expectedNote] of expected) {
            const actual = resultMap.get(noteId);
            expect(actual).toBeDefined();
            expect(actual).toEqual(expectedNote);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
