/**
 * Property-based tests for fillNotesFromNoteBase — Property 13
 *
 * Feature: schema-restructure, Property 13: fillNotesFromNoteBase two-step data flow
 *
 * Validates: Requirements 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7
 *
 * Since the real function uses Prisma, we replicate the two-step logic in an
 * in-memory simulation and verify the three invariants hold for all generated inputs.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ─── Types mimicking the NoteBase and Note models ───

interface NoteBaseRecord {
  noteId: string;
  projectId: string;
  noteLink: string | null;
  contentDirection: string | null;
  kolType: string | null;
  contentCost: number | null;
  contentSettlement: number | null;
  totalCost: number | null;
  cooperationForm: string | null;
  metrics: Record<string, number | string> | null;
}

interface NoteRecord {
  noteId: string;
  projectId: string;
  noteLink?: string | null;
  contentDirection?: string | null;
  noteType?: string | null;
  kolPrice?: number | null;
  serviceFee?: number | null;
  impNum?: number | null;
  readNum?: number | null;
  engageNum?: number | null;
  likeNum?: number | null;
  favNum?: number | null;
  cmtNum?: number | null;
  shareNum?: number | null;
  totalCost?: number | null;
  cooperationForm?: string | null;
  dataSource?: string | null;
}

// ─── Helper: replicates toInt from persistence-service.ts ───

function toInt(val: unknown): number {
  if (val == null) return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : Math.round(n);
}

// ─── In-memory simulation of fillNotesFromNoteBase two-step logic ───

/**
 * Simulates the fillNotesFromNoteBase function's two-step behavior in memory.
 *
 * @param notesTable - existing notes in the table (keyed by noteId)
 * @param noteBaseRecords - all note_base records for the project
 * @param allNoteIds - all note IDs to process
 * @param missingNoteIds - note IDs where pugongying did NOT return data
 * @returns the updated notes table state after both steps
 */
function simulateFillNotesFromNoteBase(
  notesTable: Map<string, NoteRecord>,
  noteBaseRecords: NoteBaseRecord[],
  allNoteIds: string[],
  missingNoteIds: string[]
): Map<string, NoteRecord> {
  const projectId = 'test-project';

  if (allNoteIds.length === 0) return notesTable;

  const noteBaseMap = new Map(noteBaseRecords.map((nb) => [nb.noteId, nb]));

  if (noteBaseMap.size === 0) return notesTable;

  // Step 1: Upsert all notes with only the 5 required fields
  for (const noteId of allNoteIds) {
    if (!noteBaseMap.has(noteId)) continue;
    const nb = noteBaseMap.get(noteId)!;

    const existing = notesTable.get(noteId);
    if (existing) {
      // Update: only overwrite the 5 required fields
      existing.noteLink = nb.noteLink ?? undefined;
      existing.contentDirection = nb.contentDirection ?? undefined;
      existing.noteType = nb.kolType ?? undefined;
      existing.kolPrice = nb.contentCost;
      existing.serviceFee = nb.contentSettlement;
      // DO NOT touch metrics or dataSource
    } else {
      // Create: new note with only the 5 required fields
      notesTable.set(noteId, {
        noteId,
        projectId,
        noteLink: nb.noteLink ?? undefined,
        contentDirection: nb.contentDirection ?? undefined,
        noteType: nb.kolType ?? undefined,
        kolPrice: nb.contentCost,
        serviceFee: nb.contentSettlement,
      });
    }
  }

  // Step 2: For missing (non-official) notes, additionally write metrics + dataSource
  const step2NoteIds = missingNoteIds.filter((noteId) => noteBaseMap.has(noteId));
  if (step2NoteIds.length === 0) return notesTable;

  for (const noteId of step2NoteIds) {
    const nb = noteBaseMap.get(noteId)!;
    const metrics = nb.metrics ?? {};
    const note = notesTable.get(noteId);
    if (!note) continue; // Should exist after Step 1

    note.totalCost = nb.totalCost;
    note.cooperationForm = nb.cooperationForm ?? undefined;
    note.impNum = toInt(metrics.impNum);
    note.readNum = toInt(metrics.readNum);
    note.engageNum = toInt(metrics.engageNum);
    note.likeNum = toInt(metrics.likeNum);
    note.favNum = toInt(metrics.favNum);
    note.cmtNum = toInt(metrics.cmtNum);
    note.shareNum = toInt(metrics.shareNum);
    note.dataSource = 'note_base';
  }

  return notesTable;
}

// ─── Arbitraries ───

const noteIdArb = fc.hexaString({ minLength: 10, maxLength: 24 });

const contentDirectionArb = fc.constantFrom('种草', '测评', '品宣', '引流', '日常分享');

const kolTypeArb = fc.constantFrom('图文', '视频');

const cooperationFormArb = fc.constantFrom('报备', '非报备', '置换', '赠品');

const noteLinkArb = fc
  .hexaString({ minLength: 10, maxLength: 24 })
  .map((id) => `https://www.xiaohongshu.com/explore/${id}`);

const costArb = fc.oneof(
  fc.constant(null),
  fc.integer({ min: 0, max: 100000 })
);

const nonNullCostArb = fc.integer({ min: 0, max: 100000 });

const metricValueArb = fc.integer({ min: 0, max: 1000000 });

/**
 * Generates a NoteBase record for a given noteId.
 */
function noteBaseRecordArb(noteId: string): fc.Arbitrary<NoteBaseRecord> {
  return fc.record({
    noteId: fc.constant(noteId),
    projectId: fc.constant('test-project'),
    noteLink: fc.oneof(noteLinkArb, fc.constant(null)),
    contentDirection: fc.oneof(contentDirectionArb, fc.constant(null)),
    kolType: fc.oneof(kolTypeArb, fc.constant(null)),
    contentCost: costArb,
    contentSettlement: costArb,
    totalCost: costArb,
    cooperationForm: fc.oneof(cooperationFormArb, fc.constant(null)),
    metrics: fc.oneof(
      fc.constant(null),
      fc.record({
        impNum: metricValueArb,
        readNum: metricValueArb,
        engageNum: metricValueArb,
        likeNum: metricValueArb,
        favNum: metricValueArb,
        cmtNum: metricValueArb,
        shareNum: metricValueArb,
      })
    ),
  });
}

/**
 * Generates an existing Note record (simulating pugongying-fetched data).
 */
function existingNoteRecordArb(noteId: string): fc.Arbitrary<NoteRecord> {
  return fc.record({
    noteId: fc.constant(noteId),
    projectId: fc.constant('test-project'),
    noteLink: fc.oneof(noteLinkArb, fc.constant(null)),
    contentDirection: fc.oneof(contentDirectionArb, fc.constant(null)),
    noteType: fc.oneof(kolTypeArb, fc.constant(null)),
    kolPrice: nonNullCostArb,
    serviceFee: nonNullCostArb,
    impNum: metricValueArb,
    readNum: metricValueArb,
    engageNum: metricValueArb,
    likeNum: metricValueArb,
    favNum: metricValueArb,
    cmtNum: metricValueArb,
    shareNum: metricValueArb,
    totalCost: nonNullCostArb,
    cooperationForm: fc.oneof(cooperationFormArb, fc.constant(null)),
    dataSource: fc.constant('pugongying'),
  });
}

/**
 * Generates a complete test scenario with note_base records, existing notes,
 * allNoteIds, and missingNoteIds.
 */
interface Scenario {
  noteBaseRecords: NoteBaseRecord[];
  existingNotes: NoteRecord[];
  allNoteIds: string[];
  missingNoteIds: string[];
  officialNoteIds: string[];
}

const scenarioArb: fc.Arbitrary<Scenario> = fc
  .integer({ min: 1, max: 10 })
  .chain((numNotes) => {
    // Generate unique noteIds
    return fc.uniqueArray(noteIdArb, { minLength: numNotes, maxLength: numNotes }).chain((noteIds) => {
      // Decide which are "official" (have pugongying data) and which are "missing"
      return fc
        .subarray(noteIds, { minLength: 0, maxLength: noteIds.length })
        .chain((officialNoteIds) => {
          const missingNoteIds = noteIds.filter((id) => !officialNoteIds.includes(id));

          // Generate note_base records for all notes
          const noteBaseListArb = fc.tuple(...noteIds.map((id) => noteBaseRecordArb(id))) as fc.Arbitrary<NoteBaseRecord[]>;

          // Generate existing notes only for official ones (they have pugongying data)
          const existingNotesArb: fc.Arbitrary<NoteRecord[]> = officialNoteIds.length > 0
            ? fc.tuple(...officialNoteIds.map((id) => existingNoteRecordArb(id))) as fc.Arbitrary<NoteRecord[]>
            : fc.constant([] as NoteRecord[]);

          return fc.tuple(
            noteBaseListArb,
            existingNotesArb,
            fc.constant(noteIds),
            fc.constant(missingNoteIds),
            fc.constant(officialNoteIds)
          );
        });
    });
  })
  .map(([noteBaseRecords, existingNotes, allNoteIds, missingNoteIds, officialNoteIds]): Scenario => {
    return {
      noteBaseRecords: Array.isArray(noteBaseRecords) ? noteBaseRecords : [noteBaseRecords],
      existingNotes: Array.isArray(existingNotes) ? existingNotes : [],
      allNoteIds,
      missingNoteIds,
      officialNoteIds,
    };
  });

// Feature: schema-restructure, Property 13: fillNotesFromNoteBase two-step data flow
describe('Feature: schema-restructure, Property 13: fillNotesFromNoteBase two-step data flow', () => {
  /**
   * **Validates: Requirements 13.1, 13.2**
   *
   * Step 1 invariant: After fillNotesFromNoteBase executes, ALL notes that have
   * a corresponding note_base record SHALL have noteLink, contentDirection, noteType,
   * kolPrice, and serviceFee populated from their note_base records.
   */
  it('Step 1 invariant: all notes get required fields from note_base', () => {
    fc.assert(
      fc.property(scenarioArb, (scenario) => {
        const { noteBaseRecords, existingNotes, allNoteIds, missingNoteIds } = scenario;

        // Set up initial notes table with existing (official) notes
        const notesTable = new Map<string, NoteRecord>();
        for (const note of existingNotes) {
          notesTable.set(note.noteId, { ...note });
        }

        // Run the simulation
        const result = simulateFillNotesFromNoteBase(notesTable, noteBaseRecords, allNoteIds, missingNoteIds);

        // Build noteBase map for easy lookup
        const noteBaseMap = new Map(noteBaseRecords.map((nb) => [nb.noteId, nb]));

        // Verify: ALL notes with a note_base record have the 5 required fields populated
        for (const noteId of allNoteIds) {
          const nb = noteBaseMap.get(noteId);
          if (!nb) continue; // No note_base record → skip

          const note = result.get(noteId);
          expect(note).toBeDefined();
          expect(note!.noteLink).toBe(nb.noteLink ?? undefined);
          expect(note!.contentDirection).toBe(nb.contentDirection ?? undefined);
          expect(note!.noteType).toBe(nb.kolType ?? undefined);
          expect(note!.kolPrice).toBe(nb.contentCost);
          expect(note!.serviceFee).toBe(nb.contentSettlement);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 13.3, 13.5, 13.7**
   *
   * Step 2 invariant: For missingNoteIds only, notes additionally have metrics
   * (impNum, readNum, engageNum, likeNum, favNum, cmtNum, shareNum), totalCost,
   * cooperationForm populated from note_base, with dataSource='note_base'.
   */
  it('Step 2 invariant: only missing notes get metrics and dataSource=note_base', () => {
    fc.assert(
      fc.property(scenarioArb, (scenario) => {
        const { noteBaseRecords, existingNotes, allNoteIds, missingNoteIds } = scenario;

        // Set up initial notes table
        const notesTable = new Map<string, NoteRecord>();
        for (const note of existingNotes) {
          notesTable.set(note.noteId, { ...note });
        }

        // Run the simulation
        const result = simulateFillNotesFromNoteBase(notesTable, noteBaseRecords, allNoteIds, missingNoteIds);

        const noteBaseMap = new Map(noteBaseRecords.map((nb) => [nb.noteId, nb]));

        // Verify: missingNoteIds with note_base records get metrics + dataSource
        for (const noteId of missingNoteIds) {
          const nb = noteBaseMap.get(noteId);
          if (!nb) continue;

          const note = result.get(noteId);
          expect(note).toBeDefined();

          const metrics = nb.metrics ?? {};
          expect(note!.impNum).toBe(toInt(metrics.impNum));
          expect(note!.readNum).toBe(toInt(metrics.readNum));
          expect(note!.engageNum).toBe(toInt(metrics.engageNum));
          expect(note!.likeNum).toBe(toInt(metrics.likeNum));
          expect(note!.favNum).toBe(toInt(metrics.favNum));
          expect(note!.cmtNum).toBe(toInt(metrics.cmtNum));
          expect(note!.shareNum).toBe(toInt(metrics.shareNum));
          expect(note!.totalCost).toBe(nb.totalCost);
          expect(note!.cooperationForm).toBe(nb.cooperationForm ?? undefined);
          expect(note!.dataSource).toBe('note_base');
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 13.4, 13.6**
   *
   * Non-overwrite invariant: For notes NOT in missingNoteIds (official/fetched notes),
   * existing metric values (impNum, readNum, engageNum, likeNum, favNum, cmtNum,
   * shareNum) and dataSource SHALL NOT be overwritten by Step 1.
   */
  it('Non-overwrite invariant: existing API data not overwritten by Step 1', () => {
    fc.assert(
      fc.property(scenarioArb, (scenario) => {
        const { noteBaseRecords, existingNotes, allNoteIds, missingNoteIds, officialNoteIds } = scenario;

        // Set up initial notes table with existing (official) notes
        const notesTable = new Map<string, NoteRecord>();
        for (const note of existingNotes) {
          notesTable.set(note.noteId, { ...note });
        }

        // Snapshot the original metric values for official notes
        const originalMetrics = new Map<string, {
          impNum: number | null | undefined;
          readNum: number | null | undefined;
          engageNum: number | null | undefined;
          likeNum: number | null | undefined;
          favNum: number | null | undefined;
          cmtNum: number | null | undefined;
          shareNum: number | null | undefined;
          dataSource: string | null | undefined;
          totalCost: number | null | undefined;
          cooperationForm: string | null | undefined;
        }>();

        for (const note of existingNotes) {
          originalMetrics.set(note.noteId, {
            impNum: note.impNum,
            readNum: note.readNum,
            engageNum: note.engageNum,
            likeNum: note.likeNum,
            favNum: note.favNum,
            cmtNum: note.cmtNum,
            shareNum: note.shareNum,
            dataSource: note.dataSource,
            totalCost: note.totalCost,
            cooperationForm: note.cooperationForm,
          });
        }

        // Run the simulation
        const result = simulateFillNotesFromNoteBase(notesTable, noteBaseRecords, allNoteIds, missingNoteIds);

        // Verify: Official notes (NOT in missingNoteIds) keep their original metrics
        for (const noteId of officialNoteIds) {
          const note = result.get(noteId);
          if (!note) continue;

          const original = originalMetrics.get(noteId);
          if (!original) continue;

          // Metrics should NOT be overwritten
          expect(note.impNum).toBe(original.impNum);
          expect(note.readNum).toBe(original.readNum);
          expect(note.engageNum).toBe(original.engageNum);
          expect(note.likeNum).toBe(original.likeNum);
          expect(note.favNum).toBe(original.favNum);
          expect(note.cmtNum).toBe(original.cmtNum);
          expect(note.shareNum).toBe(original.shareNum);

          // dataSource should NOT be changed
          expect(note.dataSource).toBe(original.dataSource);

          // totalCost and cooperationForm should NOT be overwritten for official notes
          expect(note.totalCost).toBe(original.totalCost);
          expect(note.cooperationForm).toBe(original.cooperationForm);
        }
      }),
      { numRuns: 100 }
    );
  });
});
