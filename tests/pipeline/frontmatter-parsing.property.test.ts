import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { PromptTemplateLoader } from '../../src/pipeline/template-loader';

/**
 * Property 2: YAML front-matter round-trip parsing
 * Validates: Requirements 2.4
 *
 * For any valid Markdown file with a YAML front-matter block (delimited by `---`),
 * parsing the front-matter SHALL produce an object containing all key-value pairs
 * from the YAML, and the remaining body SHALL equal the content after the closing
 * `---` delimiter.
 */
describe('Feature: report-generation-pipeline, Property 2: YAML front-matter round-trip parsing', () => {
  const loader = new PromptTemplateLoader('');

  // Generator for valid chapter numbers (1-10)
  const chapterNumberArb = fc.integer({ min: 1, max: 10 });

  // Generator for chapter names (YAML-safe, non-empty, always starts with a letter to avoid YAML number coercion)
  const chapterNameArb = fc.tuple(
    fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')),
    fc.stringOf(
      fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789_ '.split('')),
      { minLength: 0, maxLength: 19 }
    )
  ).map(([first, rest]) => (first + rest).trim()).filter((s) => s.length > 0);

  // Generator for data source names
  const dataSourceArb = fc.stringOf(
    fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz_'.split('')),
    { minLength: 1, maxLength: 20 }
  );

  // Generator for output format
  const outputFormatArb = fc.constantFrom(
    'paragraphs' as const,
    'bullets' as const,
    'table' as const,
    'structured' as const
  );

  // Generator for YAML-safe plain text (no special YAML chars that break parsing)
  // Excludes: : # { } [ ] , & * ? | - < > = ! % @ ` " ' \
  const yamlSafeTextArb = fc.stringOf(
    fc.constantFrom(
      ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 '.split('')
    ),
    { minLength: 1, maxLength: 40 }
  ).filter((s) => s.trim().length > 0);

  // Generator for fallback text (YAML-safe strings)
  const fallbackTextArb = yamlSafeTextArb;

  // Generator for system prompt (optional, YAML-safe multiline text)
  const systemPromptArb = fc.option(
    yamlSafeTextArb,
    { nil: undefined }
  );

  // Generator for markdown body content (no leading ---)
  const bodyArb = fc.string({ minLength: 0, maxLength: 300 })
    .map((s) => s.replace(/\r/g, ''));

  // Generator for a complete front-matter metadata object
  const metadataArb = fc.record({
    chapter_number: chapterNumberArb,
    chapter_name: chapterNameArb,
    required_data_sources: fc.array(dataSourceArb, { minLength: 1, maxLength: 5 }),
    output_format: outputFormatArb,
    fallback_text: fallbackTextArb,
    system_prompt: systemPromptArb,
  });

  /**
   * Build a valid front-matter document from metadata and body.
   * Uses YAML-safe formatting to avoid quoting issues.
   */
  function buildDocument(metadata: {
    chapter_number: number;
    chapter_name: string;
    required_data_sources: string[];
    output_format: string;
    fallback_text: string;
    system_prompt?: string;
  }, body: string): string {
    let yaml = '';
    yaml += `chapter_number: ${metadata.chapter_number}\n`;
    yaml += `chapter_name: ${metadata.chapter_name}\n`;
    yaml += `required_data_sources:\n`;
    for (const ds of metadata.required_data_sources) {
      yaml += `  - ${ds}\n`;
    }
    yaml += `output_format: ${metadata.output_format}\n`;
    if (metadata.system_prompt !== undefined) {
      yaml += `system_prompt: |\n`;
      for (const line of metadata.system_prompt.split('\n')) {
        yaml += `  ${line}\n`;
      }
    }
    yaml += `fallback_text: ${metadata.fallback_text}\n`;

    return `---\n${yaml}---\n${body}`;
  }

  it('should parse all key-value pairs from YAML front-matter', () => {
    fc.assert(
      fc.property(
        metadataArb,
        bodyArb,
        (metadata, body) => {
          const document = buildDocument(metadata, body);
          const result = loader.parseYAMLFrontMatter(document);

          // Verify all metadata fields are correctly parsed
          expect(result.metadata.chapter_number).toBe(metadata.chapter_number);
          expect(result.metadata.chapter_name).toBe(metadata.chapter_name.trim());
          expect(result.metadata.required_data_sources).toEqual(metadata.required_data_sources);
          expect(result.metadata.output_format).toBe(metadata.output_format);
          expect(result.metadata.fallback_text).toBe(metadata.fallback_text.trim());

          if (metadata.system_prompt !== undefined) {
            // system_prompt in YAML block scalar adds trailing newline
            expect(result.metadata.system_prompt?.trim()).toBe(metadata.system_prompt.trim());
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return the body content after the closing --- delimiter', () => {
    fc.assert(
      fc.property(
        metadataArb,
        bodyArb,
        (metadata, body) => {
          const document = buildDocument(metadata, body);
          const result = loader.parseYAMLFrontMatter(document);

          // The remaining body should equal the content after the closing ---
          expect(result.body).toBe(body);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should correctly separate front-matter from body for any valid document', () => {
    fc.assert(
      fc.property(
        metadataArb,
        bodyArb,
        (metadata, body) => {
          const document = buildDocument(metadata, body);
          const result = loader.parseYAMLFrontMatter(document);

          // The parsed result should have both metadata and body
          expect(result.metadata).toBeDefined();
          expect(result.metadata.chapter_number).toBeTypeOf('number');
          expect(result.metadata.chapter_name).toBeTypeOf('string');
          expect(Array.isArray(result.metadata.required_data_sources)).toBe(true);
          expect(typeof result.body).toBe('string');

          // Body should be exactly what was after the closing ---
          expect(result.body).toBe(body);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should throw an error for content without front-matter delimiters', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }).filter((s) => !s.startsWith('---')),
        (content) => {
          expect(() => loader.parseYAMLFrontMatter(content)).toThrow(
            'Invalid template format: missing YAML front-matter delimiters'
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});
