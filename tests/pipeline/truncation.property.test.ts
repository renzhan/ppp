import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { truncateAtParagraphBoundary } from '../../src/pipeline/response-parser';

/**
 * Property 6: Content truncation at paragraph boundary
 * Validates: Requirements 5.7
 *
 * For any string longer than 2000 characters that contains at least one paragraph break (\n\n),
 * truncateAtParagraphBoundary(content, 2000) SHALL return a string that:
 * (a) ends at a paragraph boundary,
 * (b) has length ≤ 2000 characters OR is the first complete paragraph if that paragraph
 *     alone exceeds 2000 characters, and
 * (c) is a prefix of the original content.
 */
describe('Feature: report-generation-pipeline, Property 6: Content truncation at paragraph boundary', () => {
  const MAX_LENGTH = 2000;

  // Generator for a paragraph of a specific length range (no \n\n inside)
  const paragraphOfLength = (minLen: number, maxLen: number) =>
    fc
      .stringOf(
        fc.constantFrom(
          ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ,.!?;:'.split(''),
        ),
        { minLength: minLen, maxLength: maxLen },
      )
      .map((s) => s.replace(/\n/g, ' ')); // Ensure no newlines inside a paragraph

  // Generator for long content (>2000 chars) with multiple paragraph breaks.
  // Strategy: generate several paragraphs of 200-500 chars each, join with \n\n.
  // With 8-15 paragraphs of 200-500 chars, total will reliably exceed 2000.
  const longContentWithBreaksArb = fc
    .array(paragraphOfLength(200, 500), { minLength: 8, maxLength: 15 })
    .map((paragraphs) => paragraphs.join('\n\n'));

  // Generator for long content where the first paragraph alone exceeds maxLength
  const longFirstParagraphArb = fc
    .tuple(
      paragraphOfLength(MAX_LENGTH + 10, MAX_LENGTH + 500),
      fc.array(paragraphOfLength(50, 200), { minLength: 1, maxLength: 5 }),
    )
    .map(([longFirst, rest]) => longFirst + '\n\n' + rest.join('\n\n'));

  it('(a) result ends at a paragraph boundary', () => {
    fc.assert(
      fc.property(longContentWithBreaksArb, (content) => {
        const result = truncateAtParagraphBoundary(content, MAX_LENGTH);

        // The result should be a prefix that ends at a paragraph boundary.
        // This means the character(s) immediately following the result in the original
        // content should be '\n\n' (the paragraph break), OR the result equals the full content.
        if (result.length < content.length) {
          // The content after the result should start with \n\n
          const remaining = content.substring(result.length);
          expect(remaining.startsWith('\n\n')).toBe(true);
        }
        // If result === content, it's trivially at a boundary (end of content)
      }),
      { numRuns: 20 },
    );
  });

  it('(b) result has length ≤ maxLength OR is the first complete paragraph when it exceeds maxLength', () => {
    fc.assert(
      fc.property(longContentWithBreaksArb, (content) => {
        const result = truncateAtParagraphBoundary(content, MAX_LENGTH);

        if (result.length > MAX_LENGTH) {
          // If result exceeds maxLength, it must be the first complete paragraph
          const firstBreak = content.indexOf('\n\n');
          if (firstBreak !== -1) {
            expect(result).toBe(content.substring(0, firstBreak));
          }
        } else {
          expect(result.length).toBeLessThanOrEqual(MAX_LENGTH);
        }
      }),
      { numRuns: 20 },
    );
  });

  it('(b) when first paragraph exceeds maxLength, returns the first paragraph', () => {
    fc.assert(
      fc.property(longFirstParagraphArb, (content) => {
        const result = truncateAtParagraphBoundary(content, MAX_LENGTH);

        // The first paragraph exceeds maxLength, so the result should be the first paragraph
        const firstBreak = content.indexOf('\n\n');
        expect(firstBreak).toBeGreaterThan(-1);
        expect(result).toBe(content.substring(0, firstBreak));
      }),
      { numRuns: 20 },
    );
  });

  it('(c) result is a prefix of the original content', () => {
    fc.assert(
      fc.property(longContentWithBreaksArb, (content) => {
        const result = truncateAtParagraphBoundary(content, MAX_LENGTH);

        // The result must be a prefix of the original content
        expect(content.startsWith(result)).toBe(true);
      }),
      { numRuns: 20 },
    );
  });

  it('should return content unchanged when length ≤ maxLength', () => {
    const shortContentArb = fc.stringOf(
      fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz '.split('')),
      { minLength: 1, maxLength: 100 },
    );

    fc.assert(
      fc.property(shortContentArb, (content) => {
        const result = truncateAtParagraphBoundary(content, MAX_LENGTH);
        expect(result).toBe(content);
      }),
      { numRuns: 20 },
    );
  });

  it('all three properties hold simultaneously', () => {
    fc.assert(
      fc.property(longContentWithBreaksArb, (content) => {
        const result = truncateAtParagraphBoundary(content, MAX_LENGTH);

        // (c) is a prefix
        expect(content.startsWith(result)).toBe(true);

        // (a) ends at paragraph boundary
        if (result.length < content.length) {
          const remaining = content.substring(result.length);
          expect(remaining.startsWith('\n\n')).toBe(true);
        }

        // (b) length constraint
        if (result.length > MAX_LENGTH) {
          // Must be first paragraph
          const firstBreak = content.indexOf('\n\n');
          expect(result).toBe(content.substring(0, firstBreak));
        } else {
          expect(result.length).toBeLessThanOrEqual(MAX_LENGTH);
        }
      }),
      { numRuns: 20 },
    );
  });
});
