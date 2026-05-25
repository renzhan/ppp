/**
 * Property-Based Test: 幻灯片列表操作正确性
 *
 * **Validates: Requirements 11.3, 11.4, 11.5**
 *
 * Property 7: 幻灯片列表操作正确性
 * For any presentation with N slides:
 * - Adding a slide at position P results in N+1 slides, with the new slide at position P
 * - Deleting a slide at position P results in N-1 slides, with remaining slides in relative order
 * - Moving a slide from A to B results in N slides, with correct reordering
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { SlideListState, type Slide } from '../../lib/slide-list-state';

// --- Generators ---

/**
 * Generates a random slide ID.
 */
const slideIdArb: fc.Arbitrary<string> = fc.array(
  fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'),
  { minLength: 4, maxLength: 12 }
).map(arr => `slide-${arr.join('')}`);

/**
 * Generates random slide content.
 */
const slideContentArb: fc.Arbitrary<Record<string, unknown>> = fc.record({
  title: fc.string({ minLength: 1, maxLength: 20 }),
  body: fc.string({ minLength: 0, maxLength: 50 }),
  type: fc.constantFrom('title', 'content', 'two_column', 'image', 'table'),
});

/**
 * Generates a single slide (without index, as it will be assigned by the state).
 */
const slideArb: fc.Arbitrary<Omit<Slide, 'index'>> = fc.record({
  id: slideIdArb,
  content: slideContentArb,
});

/**
 * Generates an initial list of slides (1-20 slides).
 */
const slideListArb: fc.Arbitrary<Slide[]> = fc.array(
  fc.record({
    id: slideIdArb,
    index: fc.constant(0), // Will be overwritten by constructor
    content: slideContentArb,
  }),
  { minLength: 1, maxLength: 20 }
);

// --- Tests ---

describe('Property 7: 幻灯片列表操作正确性 (Slide List Operations Correctness)', () => {
  it('after add: count is exactly +1 and new slide is at the specified position', () => {
    /**
     * **Validates: Requirements 11.5**
     *
     * For any initial slide list and any valid insertion position,
     * adding a slide should increase the count by exactly 1 and
     * place the new slide at the specified position.
     */
    fc.assert(
      fc.property(
        slideListArb,
        slideArb,
        fc.nat(),
        (initialSlides, newSlide, rawPosition) => {
          const state = new SlideListState(initialSlides);
          const initialCount = state.getCount();
          const position = rawPosition % (initialCount + 1); // Valid position: [0, count]

          state.addSlide(position, newSlide);

          // Count should be exactly +1
          expect(state.getCount()).toBe(initialCount + 1);

          // The new slide should be at the specified position
          const slides = state.getSlides();
          expect(slides[position].id).toBe(newSlide.id);
          expect(slides[position].index).toBe(position);

          // All indices should be consistent
          for (let i = 0; i < slides.length; i++) {
            expect(slides[i].index).toBe(i);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('after delete: count is exactly -1 and remaining slides maintain relative order', () => {
    /**
     * **Validates: Requirements 11.4**
     *
     * For any initial slide list with at least 1 slide and any valid deletion position,
     * deleting a slide should decrease the count by exactly 1 and
     * the remaining slides should maintain their relative order.
     */
    fc.assert(
      fc.property(
        slideListArb,
        fc.nat(),
        (initialSlides, rawPosition) => {
          const state = new SlideListState(initialSlides);
          const initialCount = state.getCount();
          const position = rawPosition % initialCount; // Valid position: [0, count-1]

          // Record the IDs in order before deletion
          const slidesBefore = state.getSlides();
          const idsBefore = slidesBefore.map(s => s.id);
          const deletedId = idsBefore[position];

          state.deleteSlide(position);

          // Count should be exactly -1
          expect(state.getCount()).toBe(initialCount - 1);

          // Remaining slides should maintain relative order
          const slidesAfter = state.getSlides();
          const idsAfter = slidesAfter.map(s => s.id);

          // The deleted slide should not be present
          // Note: if there were duplicate IDs, we just check the order of remaining
          const expectedIds = idsBefore.filter((_, idx) => idx !== position);
          expect(idsAfter).toEqual(expectedIds);

          // All indices should be consistent
          for (let i = 0; i < slidesAfter.length; i++) {
            expect(slidesAfter[i].index).toBe(i);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('after move: count is unchanged and the moved slide is at the target position', () => {
    /**
     * **Validates: Requirements 11.3**
     *
     * For any initial slide list with at least 2 slides and any valid from/to positions,
     * moving a slide should keep the count unchanged and place the moved slide
     * at the target position.
     */
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: slideIdArb,
            index: fc.constant(0),
            content: slideContentArb,
          }),
          { minLength: 2, maxLength: 20 }
        ),
        fc.nat(),
        fc.nat(),
        (initialSlides, rawFrom, rawTo) => {
          const state = new SlideListState(initialSlides);
          const initialCount = state.getCount();
          const fromIndex = rawFrom % initialCount;
          const toIndex = rawTo % initialCount;

          // Record the ID of the slide being moved
          const slidesBefore = state.getSlides();
          const movedSlideId = slidesBefore[fromIndex].id;

          state.moveSlide(fromIndex, toIndex);

          // Count should be unchanged
          expect(state.getCount()).toBe(initialCount);

          // The moved slide should be at the target position
          const slidesAfter = state.getSlides();
          if (fromIndex !== toIndex) {
            expect(slidesAfter[toIndex].id).toBe(movedSlideId);
          }

          // All indices should be consistent
          for (let i = 0; i < slidesAfter.length; i++) {
            expect(slidesAfter[i].index).toBe(i);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('after move: other slides maintain their relative order', () => {
    /**
     * **Validates: Requirements 11.3**
     *
     * For any move operation, the slides that were NOT moved should
     * maintain their relative order from before the move.
     */
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: slideIdArb,
            index: fc.constant(0),
            content: slideContentArb,
          }),
          { minLength: 2, maxLength: 20 }
        ),
        fc.nat(),
        fc.nat(),
        (initialSlides, rawFrom, rawTo) => {
          const state = new SlideListState(initialSlides);
          const initialCount = state.getCount();
          const fromIndex = rawFrom % initialCount;
          const toIndex = rawTo % initialCount;

          const slidesBefore = state.getSlides();
          const movedSlideId = slidesBefore[fromIndex].id;

          state.moveSlide(fromIndex, toIndex);

          const slidesAfter = state.getSlides();

          // Get the IDs of non-moved slides in order (before and after)
          const otherIdsBefore = slidesBefore
            .filter((_, idx) => idx !== fromIndex)
            .map(s => s.id);
          const otherIdsAfter = slidesAfter
            .filter(s => s.id !== movedSlideId)
            .map(s => s.id);

          // Relative order of other slides should be preserved
          expect(otherIdsAfter).toEqual(otherIdsBefore);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('sequence of random operations maintains consistent state', () => {
    /**
     * **Validates: Requirements 11.3, 11.4, 11.5**
     *
     * For any sequence of add/delete/move operations applied to an initial slide list,
     * the state should always be consistent (indices match positions, count is correct).
     */
    type Operation =
      | { type: 'add'; position: number; slide: Omit<Slide, 'index'> }
      | { type: 'delete'; position: number }
      | { type: 'move'; from: number; to: number };

    const operationArb: fc.Arbitrary<Operation> = fc.oneof(
      fc.record({
        type: fc.constant('add' as const),
        position: fc.nat({ max: 25 }),
        slide: slideArb,
      }),
      fc.record({
        type: fc.constant('delete' as const),
        position: fc.nat({ max: 25 }),
      }),
      fc.record({
        type: fc.constant('move' as const),
        from: fc.nat({ max: 25 }),
        to: fc.nat({ max: 25 }),
      })
    );

    fc.assert(
      fc.property(
        slideListArb,
        fc.array(operationArb, { minLength: 1, maxLength: 15 }),
        (initialSlides, operations) => {
          const state = new SlideListState(initialSlides);
          let expectedCount = state.getCount();

          for (const op of operations) {
            const currentCount = state.getCount();

            if (op.type === 'add') {
              state.addSlide(op.position, op.slide);
              expectedCount = currentCount + 1;
            } else if (op.type === 'delete') {
              if (currentCount > 0) {
                const pos = op.position % currentCount;
                state.deleteSlide(pos);
                expectedCount = currentCount - 1;
              } else {
                // No slides to delete, count stays the same
                expectedCount = currentCount;
              }
            } else if (op.type === 'move') {
              if (currentCount >= 2) {
                const from = op.from % currentCount;
                const to = op.to % currentCount;
                state.moveSlide(from, to);
              }
              expectedCount = currentCount;
            }

            // After each operation, verify consistency
            expect(state.getCount()).toBe(expectedCount);

            const slides = state.getSlides();
            for (let i = 0; i < slides.length; i++) {
              expect(slides[i].index).toBe(i);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
