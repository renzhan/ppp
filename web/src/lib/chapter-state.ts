/**
 * ChapterState - 章节切换状态管理
 *
 * A pure, testable state machine that encapsulates chapter switching logic.
 * Maintains an array of sections (each with title and content), tracks the
 * active chapter index, and ensures content is preserved across switches.
 *
 * When switching chapters:
 * 1. Saves current editor content to the current section
 * 2. Updates the active index to the new chapter
 * 3. Loads the new section's content as the current content
 */

export interface Section {
  title: string;
  content: string;
}

export class ChapterState {
  private sections: Section[];
  private activeIdx: number;
  private currentContent: string;

  constructor(sections: Section[]) {
    if (sections.length === 0) {
      throw new Error('ChapterState requires at least one section');
    }
    this.sections = sections.map(s => ({ ...s }));
    this.activeIdx = 0;
    this.currentContent = this.sections[0].content;
  }

  /**
   * Switch to a different chapter by index.
   * Saves the current content to the active section before switching.
   * If the index is out of bounds or same as current, no-op.
   */
  switchTo(idx: number): void {
    if (idx < 0 || idx >= this.sections.length) {
      return; // Out of bounds, no-op
    }
    if (idx === this.activeIdx) {
      return; // Already on this chapter, no-op
    }

    // Save current content to the active section
    this.sections[this.activeIdx].content = this.currentContent;

    // Switch to new chapter
    this.activeIdx = idx;
    this.currentContent = this.sections[this.activeIdx].content;
  }

  /**
   * Edit the content of the currently active chapter.
   */
  editContent(newContent: string): void {
    this.currentContent = newContent;
  }

  /**
   * Get the content currently being edited (the active chapter's content).
   */
  getCurrentContent(): string {
    return this.currentContent;
  }

  /**
   * Get the persisted content of a section by index.
   * Note: for the active section, this returns the last-saved content,
   * which may differ from currentContent if edits haven't been saved via switchTo.
   */
  getSectionContent(idx: number): string {
    if (idx < 0 || idx >= this.sections.length) {
      throw new Error(`Section index ${idx} out of bounds`);
    }
    if (idx === this.activeIdx) {
      return this.currentContent;
    }
    return this.sections[idx].content;
  }

  /**
   * Get the currently active chapter index.
   */
  getActiveIndex(): number {
    return this.activeIdx;
  }

  /**
   * Get the total number of sections.
   */
  getSectionCount(): number {
    return this.sections.length;
  }
}
