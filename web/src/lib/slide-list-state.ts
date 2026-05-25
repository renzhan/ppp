/**
 * SlideListState - 幻灯片列表操作状态管理
 *
 * A pure, testable state machine that encapsulates slide list operations.
 * Maintains an ordered array of slides and supports:
 * - Adding a new slide at a specified position
 * - Deleting a slide at a specified position
 * - Moving a slide from one position to another
 *
 * All operations maintain consistent slide indices.
 */

export interface Slide {
  id: string;
  index: number;
  content: Record<string, unknown>;
}

export class SlideListState {
  private slides: Slide[];

  constructor(initialSlides: Slide[]) {
    this.slides = initialSlides.map((s, i) => ({ ...s, index: i }));
  }

  /**
   * Add a new slide at the specified position.
   * The position is clamped to [0, slides.length].
   * All subsequent slides have their indices updated.
   */
  addSlide(atIndex: number, slide: Omit<Slide, 'index'>): void {
    const clampedIndex = Math.max(0, Math.min(atIndex, this.slides.length));
    const newSlide: Slide = { ...slide, index: clampedIndex };
    this.slides.splice(clampedIndex, 0, newSlide);
    this.reindex();
  }

  /**
   * Delete the slide at the specified position.
   * If the index is out of bounds, this is a no-op.
   * All subsequent slides have their indices updated.
   */
  deleteSlide(atIndex: number): void {
    if (atIndex < 0 || atIndex >= this.slides.length) {
      return; // Out of bounds, no-op
    }
    this.slides.splice(atIndex, 1);
    this.reindex();
  }

  /**
   * Move a slide from one position to another.
   * If either index is out of bounds, this is a no-op.
   * The slide at fromIndex is removed and inserted at toIndex.
   */
  moveSlide(fromIndex: number, toIndex: number): void {
    if (fromIndex < 0 || fromIndex >= this.slides.length) {
      return; // Out of bounds, no-op
    }
    if (toIndex < 0 || toIndex >= this.slides.length) {
      return; // Out of bounds, no-op
    }
    if (fromIndex === toIndex) {
      return; // No-op
    }

    const [movedSlide] = this.slides.splice(fromIndex, 1);
    this.slides.splice(toIndex, 0, movedSlide);
    this.reindex();
  }

  /**
   * Get a copy of all slides in current order.
   */
  getSlides(): Slide[] {
    return this.slides.map(s => ({ ...s }));
  }

  /**
   * Get the current number of slides.
   */
  getCount(): number {
    return this.slides.length;
  }

  /**
   * Re-index all slides to ensure indices match array positions.
   */
  private reindex(): void {
    for (let i = 0; i < this.slides.length; i++) {
      this.slides[i].index = i;
    }
  }
}
