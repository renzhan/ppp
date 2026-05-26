import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { parseResponse, OutputFormat } from '../../src/pipeline/response-parser';

/**
 * Property 5: LLM response parsing preserves content structure
 * Validates: Requirements 5.3
 *
 * For any non-empty LLM response string and for any valid output_format specification,
 * the parseResponse function SHALL produce a non-empty HTML string that preserves all
 * textual content from the input (no data loss), with appropriate HTML/Markdown structural
 * elements matching the specified format.
 */
describe('Feature: report-generation-pipeline, Property 5: LLM response parsing preserves content structure', () => {
  // Generator for valid output formats
  const outputFormatArb: fc.Arbitrary<OutputFormat> = fc.constantFrom(
    'paragraphs',
    'bullets',
    'table',
    'structured',
  );

  // Generator for non-empty text content (plain text words without HTML-like characters)
  const wordArb = fc.stringOf(
    fc.constantFrom(
      ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split(''),
    ),
    { minLength: 1, maxLength: 20 },
  );

  // Generator for paragraph-style text (multiple paragraphs separated by \n\n)
  const paragraphTextArb = fc
    .array(wordArb, { minLength: 1, maxLength: 5 })
    .map((words) => words.join('\n\n'));

  // Generator for bullet-style text (lines starting with - )
  const bulletTextArb = fc
    .array(wordArb, { minLength: 1, maxLength: 8 })
    .map((words) => words.map((w) => `- ${w}`).join('\n'));

  // Generator for structured text with headings
  const structuredTextArb = fc
    .array(
      fc.tuple(wordArb, wordArb),
      { minLength: 1, maxLength: 4 },
    )
    .map((pairs) =>
      pairs.map(([heading, body]) => `## ${heading}\n\n${body}`).join('\n\n'),
    );

  // Generator for table-style text (Markdown table)
  const tableTextArb = fc
    .array(wordArb, { minLength: 2, maxLength: 5 })
    .chain((headers) =>
      fc
        .array(
          fc.array(wordArb, { minLength: headers.length, maxLength: headers.length }),
          { minLength: 1, maxLength: 4 },
        )
        .map((rows) => {
          const headerLine = `| ${headers.join(' | ')} |`;
          const separatorLine = `| ${headers.map(() => '---').join(' | ')} |`;
          const dataLines = rows.map((row) => `| ${row.join(' | ')} |`);
          return [headerLine, separatorLine, ...dataLines].join('\n');
        }),
    );

  // Generator that produces text appropriate for the given format
  const textForFormatArb = (format: OutputFormat): fc.Arbitrary<string> => {
    switch (format) {
      case 'paragraphs':
        return paragraphTextArb;
      case 'bullets':
        return bulletTextArb;
      case 'table':
        return tableTextArb;
      case 'structured':
        return structuredTextArb;
    }
  };

  // Helper: extract all textual content from HTML by stripping tags
  function extractTextContent(html: string): string {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  // Helper: extract words from raw input text (ignoring markdown syntax)
  function extractInputWords(text: string): string[] {
    // Remove markdown syntax characters (# - * |) and whitespace, get words
    return text
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/^\s*[-*]\s+/gm, '')
      .replace(/\|/g, ' ')
      .replace(/^[-:]+$/gm, '')
      .split(/\s+/)
      .map((w) => w.trim())
      .filter((w) => w.length > 0 && !/^[-:]+$/.test(w));
  }

  it('should produce non-empty HTML for any non-empty input', () => {
    fc.assert(
      fc.property(
        outputFormatArb.chain((format) =>
          textForFormatArb(format).map((text) => ({ format, text })),
        ),
        ({ format, text }) => {
          const result = parseResponse(text, format);

          // Result should be non-empty for non-empty input
          expect(result.html.length).toBeGreaterThan(0);
        },
      ),
      { numRuns: 20 },
    );
  });

  it('should preserve all textual content from the input (no data loss)', () => {
    fc.assert(
      fc.property(
        outputFormatArb.chain((format) =>
          textForFormatArb(format).map((text) => ({ format, text })),
        ),
        ({ format, text }) => {
          const result = parseResponse(text, format);
          const outputText = extractTextContent(result.html);
          const inputWords = extractInputWords(text);

          // Every meaningful word from the input should appear in the output
          for (const word of inputWords) {
            expect(outputText).toContain(word);
          }
        },
      ),
      { numRuns: 20 },
    );
  });

  it('should contain appropriate HTML structural elements for paragraphs format', () => {
    fc.assert(
      fc.property(paragraphTextArb, (text) => {
        const result = parseResponse(text, 'paragraphs');

        // Paragraphs format should contain <p> tags
        expect(result.html).toContain('<p>');
        expect(result.html).toContain('</p>');
      }),
      { numRuns: 20 },
    );
  });

  it('should contain appropriate HTML structural elements for bullets format', () => {
    fc.assert(
      fc.property(bulletTextArb, (text) => {
        const result = parseResponse(text, 'bullets');

        // Bullets format should contain <ul> and <li> tags
        expect(result.html).toContain('<ul>');
        expect(result.html).toContain('<li>');
        expect(result.html).toContain('</li>');
        expect(result.html).toContain('</ul>');
      }),
      { numRuns: 20 },
    );
  });

  it('should contain appropriate HTML structural elements for table format', () => {
    fc.assert(
      fc.property(tableTextArb, (text) => {
        const result = parseResponse(text, 'table');

        // Table format should contain <table> structure
        expect(result.html).toContain('<table>');
        expect(result.html).toContain('</table>');
        expect(result.html).toContain('<th>');
        expect(result.html).toContain('<td>');
      }),
      { numRuns: 20 },
    );
  });

  it('should contain appropriate HTML structural elements for structured format', () => {
    fc.assert(
      fc.property(structuredTextArb, (text) => {
        const result = parseResponse(text, 'structured');

        // Structured format should contain heading tags
        expect(result.html).toMatch(/<h[1-6]>/);
        expect(result.html).toMatch(/<\/h[1-6]>/);
      }),
      { numRuns: 20 },
    );
  });

  it('should return empty html for empty input', () => {
    const formats: OutputFormat[] = ['paragraphs', 'bullets', 'table', 'structured'];
    for (const format of formats) {
      const result = parseResponse('', format);
      expect(result.html).toBe('');

      const resultWhitespace = parseResponse('   ', format);
      expect(resultWhitespace.html).toBe('');
    }
  });
});
