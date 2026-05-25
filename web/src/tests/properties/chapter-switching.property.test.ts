/**
 * Property-Based Test: 章节切换内容保持
 *
 * **Validates: Requirements 3.4**
 *
 * Property 3: 章节切换内容保持
 * For any report with N chapters and any arbitrary chapter switching sequence,
 * switching back to a chapter should show the content as it was when last edited.
 * Content is never lost during chapter switches.
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { ChapterState, type Section } from '../../lib/chapter-state';

// --- Generators ---

/**
 * Generates random text content for sections.
 * Includes Chinese characters to simulate real report content.
 */
const contentArb: fc.Arbitrary<string> = fc.array(
  fc.constantFrom(
    'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
    'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
    ' ', ',', '.', '\n',
    '中', '文', '内', '容', '测', '试', '数', '据', '报', '告'
  ),
  { minLength: 1, maxLength: 50 }
).map(arr => arr.join(''));

/**
 * Generates a random section title.
 */
const titleArb: fc.Arbitrary<string> = fc.array(
  fc.constantFrom(
    '概', '述', '分', '析', '总', '结', '数', '据', '投', '流',
    'KPI', '内容', '舆情', '品牌', '竞品', '趋势', '建议'
  ),
  { minLength: 1, maxLength: 4 }
).map(arr => arr.join(''));

/**
 * Generates a random section (title + content).
 */
const sectionArb: fc.Arbitrary<Section> = fc.record({
  title: titleArb,
  content: contentArb,
});

/**
 * Generates an array of sections (simulating a multi-chapter report).
 * At least 2 chapters to make switching meaningful.
 */
const sectionsArb: fc.Arbitrary<Section[]> = fc.array(sectionArb, {
  minLength: 2,
  maxLength: 8,
});

/**
 * Represents a single action in a chapter switching sequence.
 * Either switch to a chapter or edit the current content.
 */
type Action =
  | { type: 'switch'; targetIdx: number }
  | { type: 'edit'; newContent: string };

/**
 * Generates a random action given the number of sections.
 */
function actionArb(numSections: number): fc.Arbitrary<Action> {
  return fc.oneof(
    fc.integer({ min: 0, max: numSections - 1 }).map(idx => ({
      type: 'switch' as const,
      targetIdx: idx,
    })),
    contentArb.map(content => ({
      type: 'edit' as const,
      newContent: content,
    }))
  );
}

/**
 * Generates a sequence of actions (switches and edits).
 */
function actionSequenceArb(numSections: number): fc.Arbitrary<Action[]> {
  return fc.array(actionArb(numSections), { minLength: 1, maxLength: 20 });
}

// --- Tests ---

describe('Property 3: 章节切换内容保持 (Chapter Switching Content Preservation)', () => {
  it('switching back to a chapter shows the content as it was when last edited', () => {
    /**
     * **Validates: Requirements 3.4**
     *
     * For any set of initial sections and any sequence of switch/edit actions,
     * after performing all actions, switching to any chapter should show
     * the content that was last set for that chapter (either initial or last edit).
     *
     * We track expected content in a parallel map and verify the state machine
     * matches at every point.
     */
    fc.assert(
      fc.property(
        sectionsArb.chain(sections =>
          fc.tuple(
            fc.constant(sections),
            actionSequenceArb(sections.length)
          )
        ),
        ([sections, actions]) => {
          const state = new ChapterState(sections);

          // Track expected content for each section
          const expectedContent: string[] = sections.map(s => s.content);
          let activeIdx = 0;

          // Verify initial state
          expect(state.getCurrentContent()).toBe(expectedContent[0]);

          // Execute each action and verify
          for (const action of actions) {
            if (action.type === 'switch') {
              // Before switching, save current content to expected
              expectedContent[activeIdx] = state.getCurrentContent();

              state.switchTo(action.targetIdx);

              if (action.targetIdx >= 0 && action.targetIdx < sections.length && action.targetIdx !== activeIdx) {
                activeIdx = action.targetIdx;
              }

              // After switching, current content should match expected for new active chapter
              expect(state.getCurrentContent()).toBe(expectedContent[activeIdx]);
            } else {
              // Edit action
              state.editContent(action.newContent);
              expectedContent[activeIdx] = action.newContent;

              expect(state.getCurrentContent()).toBe(action.newContent);
            }
          }

          // Final verification: switch to every chapter and verify content
          for (let i = 0; i < sections.length; i++) {
            // Save current before switching
            expectedContent[activeIdx] = state.getCurrentContent();
            state.switchTo(i);
            if (i !== activeIdx) {
              activeIdx = i;
            }
            expect(state.getCurrentContent()).toBe(expectedContent[i]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('content is never lost: editing then switching away and back preserves the edit', () => {
    /**
     * **Validates: Requirements 3.4**
     *
     * For any two-chapter scenario, editing chapter A, switching to B,
     * then switching back to A should show the edited content of A.
     */
    fc.assert(
      fc.property(
        sectionsArb,
        contentArb,
        fc.integer({ min: 1, max: 7 }),
        (sections, editedContent, targetOffset) => {
          const state = new ChapterState(sections);
          const targetIdx = targetOffset % sections.length;

          // Edit chapter 0
          state.editContent(editedContent);

          // Switch to another chapter (if possible)
          if (targetIdx !== 0) {
            state.switchTo(targetIdx);

            // Verify we're on the target chapter
            expect(state.getActiveIndex()).toBe(targetIdx);

            // Switch back to chapter 0
            state.switchTo(0);

            // The edited content should be preserved
            expect(state.getCurrentContent()).toBe(editedContent);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('multiple edits to different chapters are all preserved independently', () => {
    /**
     * **Validates: Requirements 3.4**
     *
     * For any set of chapters, editing each chapter with unique content
     * and then verifying each chapter shows its unique content.
     */
    fc.assert(
      fc.property(
        sectionsArb,
        fc.array(contentArb, { minLength: 2, maxLength: 8 }),
        (sections, edits) => {
          const state = new ChapterState(sections);
          const numChapters = sections.length;
          const editContents: string[] = [];

          // Edit each chapter with unique content
          for (let i = 0; i < numChapters; i++) {
            state.switchTo(i);
            const editContent = edits[i % edits.length] + `_chapter_${i}`;
            state.editContent(editContent);
            editContents.push(editContent);
          }

          // Verify each chapter has its unique content
          for (let i = 0; i < numChapters; i++) {
            state.switchTo(i);
            expect(state.getCurrentContent()).toBe(editContents[i]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rapid switching without edits preserves all original content', () => {
    /**
     * **Validates: Requirements 3.4**
     *
     * For any set of chapters and any random switching sequence (no edits),
     * all chapters should retain their original content.
     */
    fc.assert(
      fc.property(
        sectionsArb,
        fc.array(fc.integer({ min: 0, max: 7 }), { minLength: 1, maxLength: 30 }),
        (sections, switchSequence) => {
          const state = new ChapterState(sections);
          const originalContents = sections.map(s => s.content);

          // Perform random switches without editing
          for (const rawIdx of switchSequence) {
            const idx = rawIdx % sections.length;
            state.switchTo(idx);
          }

          // Verify all chapters still have original content
          for (let i = 0; i < sections.length; i++) {
            state.switchTo(i);
            expect(state.getCurrentContent()).toBe(originalContents[i]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('getSectionContent returns correct content for all chapters at any point', () => {
    /**
     * **Validates: Requirements 3.4**
     *
     * For any state after a sequence of actions, getSectionContent(i)
     * should return the same content as switching to chapter i would show.
     */
    fc.assert(
      fc.property(
        sectionsArb.chain(sections =>
          fc.tuple(
            fc.constant(sections),
            actionSequenceArb(sections.length)
          )
        ),
        ([sections, actions]) => {
          const state = new ChapterState(sections);

          // Execute actions
          for (const action of actions) {
            if (action.type === 'switch') {
              state.switchTo(action.targetIdx);
            } else {
              state.editContent(action.newContent);
            }
          }

          // Verify getSectionContent matches what switchTo would show
          // First, record current state
          const currentIdx = state.getActiveIndex();
          const currentContent = state.getCurrentContent();

          for (let i = 0; i < sections.length; i++) {
            const sectionContent = state.getSectionContent(i);

            // Create a fresh state to verify by switching
            const verifyState = new ChapterState(sections);
            // Replay all actions
            for (const action of actions) {
              if (action.type === 'switch') {
                verifyState.switchTo(action.targetIdx);
              } else {
                verifyState.editContent(action.newContent);
              }
            }
            verifyState.switchTo(i);

            expect(sectionContent).toBe(verifyState.getCurrentContent());
          }

          // Verify original state wasn't mutated by getSectionContent calls
          expect(state.getActiveIndex()).toBe(currentIdx);
          expect(state.getCurrentContent()).toBe(currentContent);
        }
      ),
      { numRuns: 100 }
    );
  });
});
