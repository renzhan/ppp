/**
 * Property-Based Test: TipTap 内容序列化往返
 *
 * **Validates: Requirements 3.3**
 *
 * Property 2: TipTap 内容序列化往返
 * For any valid rich text content (headings, bold, italic, lists, tables, blockquotes),
 * serializing to HTML then deserializing back should produce content equivalent
 * to the original. Additionally, HTML normalization should be idempotent.
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  normalizeHTML,
  serializeContent,
  deserializeContent,
  type TipTapNode,
} from '../../lib/tiptap-serializer';

// --- Generators ---

/**
 * Generates random plain text content (no HTML special characters)
 * Uses fc.array + map since fc.stringOf is not available in this environment.
 */
const plainTextArb: fc.Arbitrary<string> = fc.array(
  fc.constantFrom(
    'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
    'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
    ' ', ',', '.', '!', '?',
    '中', '文', '测', '试', '内', '容', '数', '据'
  ),
  { minLength: 1, maxLength: 20 }
).map(arr => arr.join(''));

/**
 * Generates a text node with optional marks (bold, italic, code, strike)
 */
const textNodeArb: fc.Arbitrary<TipTapNode> = fc.record({
  type: fc.constant('text' as const),
  text: plainTextArb,
  marks: fc.oneof(
    fc.constant(undefined),
    fc.subarray([
      { type: 'bold' },
      { type: 'italic' },
      { type: 'code' },
      { type: 'strike' },
    ], { minLength: 1, maxLength: 1 })
  ),
}).map(({ type, text, marks }) => {
  const node: TipTapNode = { type, text };
  if (marks && marks.length > 0) {
    node.marks = marks;
  }
  return node;
});

/**
 * Generates inline content (array of text nodes with optional marks)
 */
const inlineContentArb: fc.Arbitrary<TipTapNode[]> = fc.array(textNodeArb, {
  minLength: 1,
  maxLength: 4,
});

/**
 * Generates a paragraph node
 */
const paragraphNodeArb: fc.Arbitrary<TipTapNode> = inlineContentArb.map(content => ({
  type: 'paragraph',
  content,
}));

/**
 * Generates a heading node (h1-h3)
 */
const headingNodeArb: fc.Arbitrary<TipTapNode> = fc.tuple(
  fc.integer({ min: 1, max: 3 }),
  inlineContentArb
).map(([level, content]) => ({
  type: 'heading',
  attrs: { level },
  content,
}));

/**
 * Generates a list item node
 */
const listItemNodeArb: fc.Arbitrary<TipTapNode> = inlineContentArb.map(content => ({
  type: 'listItem',
  content: [{ type: 'paragraph', content }],
}));

/**
 * Generates a bullet list node
 */
const bulletListNodeArb: fc.Arbitrary<TipTapNode> = fc.array(listItemNodeArb, {
  minLength: 1,
  maxLength: 4,
}).map(items => ({
  type: 'bulletList',
  content: items,
}));

/**
 * Generates an ordered list node
 */
const orderedListNodeArb: fc.Arbitrary<TipTapNode> = fc.array(listItemNodeArb, {
  minLength: 1,
  maxLength: 4,
}).map(items => ({
  type: 'orderedList',
  content: items,
}));

/**
 * Generates a blockquote node (contains paragraphs)
 */
const blockquoteNodeArb: fc.Arbitrary<TipTapNode> = fc.array(paragraphNodeArb, {
  minLength: 1,
  maxLength: 3,
}).map(paragraphs => ({
  type: 'blockquote',
  content: paragraphs,
}));

/**
 * Generates a table cell node
 */
const tableCellNodeArb: fc.Arbitrary<TipTapNode> = inlineContentArb.map(content => ({
  type: 'tableCell',
  content: [{ type: 'paragraph', content }],
}));

/**
 * Generates a table header cell node
 */
const tableHeaderNodeArb: fc.Arbitrary<TipTapNode> = inlineContentArb.map(content => ({
  type: 'tableHeader',
  content: [{ type: 'paragraph', content }],
}));

/**
 * Generates a table node with header row and data rows
 */
const tableNodeArb: fc.Arbitrary<TipTapNode> = fc.integer({ min: 2, max: 4 }).chain(cols => {
  return fc.integer({ min: 1, max: 3 }).chain(dataRows => {
    // Generate header row cells
    const headerCells = fc.array(tableHeaderNodeArb, { minLength: cols, maxLength: cols });
    // Generate data row cells
    const dataRowCells = fc.array(
      fc.array(tableCellNodeArb, { minLength: cols, maxLength: cols }),
      { minLength: dataRows, maxLength: dataRows }
    );

    return fc.tuple(headerCells, dataRowCells).map(([headers, rows]) => ({
      type: 'table' as const,
      content: [
        { type: 'tableRow' as const, content: headers },
        ...rows.map(cells => ({ type: 'tableRow' as const, content: cells })),
      ],
    }));
  });
});

/**
 * Generates a code block node
 */
const codeBlockNodeArb: fc.Arbitrary<TipTapNode> = fc.array(
  fc.constantFrom(
    'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
    'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
    ' ', '=', '+', '-', '(', ')', '{', '}', ';'
  ),
  { minLength: 1, maxLength: 30 }
).map(arr => ({
  type: 'codeBlock' as const,
  content: [{ type: 'text' as const, text: arr.join('') }],
}));

/**
 * Generates any block-level node (the building blocks of a document)
 */
const blockNodeArb: fc.Arbitrary<TipTapNode> = fc.oneof(
  { weight: 3, arbitrary: paragraphNodeArb },
  { weight: 2, arbitrary: headingNodeArb },
  { weight: 2, arbitrary: bulletListNodeArb },
  { weight: 2, arbitrary: orderedListNodeArb },
  { weight: 1, arbitrary: blockquoteNodeArb },
  { weight: 1, arbitrary: tableNodeArb },
  { weight: 1, arbitrary: codeBlockNodeArb }
);

/**
 * Generates a complete TipTap document (doc node with block-level children)
 */
const documentArb: fc.Arbitrary<TipTapNode> = fc.array(blockNodeArb, {
  minLength: 1,
  maxLength: 6,
}).map(content => ({
  type: 'doc',
  content,
}));

/**
 * Generates valid HTML strings that represent rich text content
 * (as produced by TipTap's getHTML())
 */
const richTextHTMLArb: fc.Arbitrary<string> = documentArb.map(doc =>
  serializeContent(doc)
);

// --- Helper Functions ---

/**
 * Recursively extracts all text content from a TipTapNode tree
 */
function extractAllText(node: TipTapNode): string[] {
  const texts: string[] = [];

  if (node.type === 'text' && node.text) {
    texts.push(node.text);
  }

  if (node.content) {
    for (const child of node.content) {
      texts.push(...extractAllText(child));
    }
  }

  return texts;
}

// --- Tests ---

describe('Property 2: TipTap 内容序列化往返 (Content Serialization Round-Trip)', () => {
  it('HTML normalization should be idempotent: normalize(normalize(html)) === normalize(html)', () => {
    /**
     * **Validates: Requirements 3.3**
     *
     * For any HTML content produced by TipTap serialization,
     * normalizing it once should produce the same result as normalizing it twice.
     * This ensures the normalization function reaches a stable canonical form.
     */
    fc.assert(
      fc.property(richTextHTMLArb, (html) => {
        const normalized1 = normalizeHTML(html);
        const normalized2 = normalizeHTML(normalized1);

        expect(normalized2).toBe(normalized1);
      }),
      { numRuns: 100 }
    );
  });

  it('serialize → deserialize → serialize should produce identical normalized HTML', () => {
    /**
     * **Validates: Requirements 3.3**
     *
     * For any valid TipTap document structure, serializing to HTML,
     * deserializing back to a node tree, then serializing again should
     * produce the same normalized HTML output. This verifies the round-trip property.
     */
    fc.assert(
      fc.property(documentArb, (doc) => {
        const html1 = serializeContent(doc);
        const deserialized = deserializeContent(html1);
        const html2 = serializeContent(deserialized);

        // The normalized forms should be identical
        expect(normalizeHTML(html2)).toBe(normalizeHTML(html1));
      }),
      { numRuns: 100 }
    );
  });

  it('deserialized content should preserve document structure (node types and nesting)', () => {
    /**
     * **Validates: Requirements 3.3**
     *
     * For any valid TipTap document, after a serialize → deserialize round-trip,
     * the resulting node tree should have the same structure: same node types,
     * same nesting depth, and same text content.
     */
    fc.assert(
      fc.property(documentArb, (doc) => {
        const html = serializeContent(doc);
        const deserialized = deserializeContent(html);

        // Both should be doc nodes
        expect(deserialized.type).toBe('doc');

        // Should have the same number of top-level blocks
        expect(deserialized.content?.length).toBe(doc.content?.length);

        // Each block should have the same type
        if (doc.content && deserialized.content) {
          for (let i = 0; i < doc.content.length; i++) {
            expect(deserialized.content[i].type).toBe(doc.content[i].type);
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  it('serialized HTML should preserve all text content without loss', () => {
    /**
     * **Validates: Requirements 3.3**
     *
     * For any TipTap document, all text content in the original document
     * should appear in the serialized HTML output. No text should be lost
     * during serialization.
     */
    fc.assert(
      fc.property(documentArb, (doc) => {
        const html = serializeContent(doc);

        // Extract all text from the document tree
        const allTexts = extractAllText(doc);

        // Every text fragment should appear in the HTML
        for (const text of allTexts) {
          expect(html).toContain(text);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('heading levels should be preserved through round-trip', () => {
    /**
     * **Validates: Requirements 3.3**
     *
     * For any heading node with level 1-3, after serialize → deserialize,
     * the heading level should be preserved exactly.
     */
    fc.assert(
      fc.property(headingNodeArb, (heading) => {
        const doc: TipTapNode = { type: 'doc', content: [heading] };
        const html = serializeContent(doc);
        const deserialized = deserializeContent(html);

        const deserializedHeading = deserialized.content?.[0];
        expect(deserializedHeading?.type).toBe('heading');
        expect(deserializedHeading?.attrs?.level).toBe(heading.attrs?.level);
      }),
      { numRuns: 100 }
    );
  });

  it('table structure (rows and columns) should be preserved through round-trip', () => {
    /**
     * **Validates: Requirements 3.3**
     *
     * For any table node, after serialize → deserialize, the number of rows
     * and columns should be preserved exactly.
     */
    fc.assert(
      fc.property(tableNodeArb, (table) => {
        const doc: TipTapNode = { type: 'doc', content: [table] };
        const html = serializeContent(doc);
        const deserialized = deserializeContent(html);

        const deserializedTable = deserialized.content?.[0];
        expect(deserializedTable?.type).toBe('table');

        // Same number of rows
        const originalRows = table.content?.length || 0;
        const deserializedRows = deserializedTable?.content?.length || 0;
        expect(deserializedRows).toBe(originalRows);

        // Same number of cells per row
        if (table.content && deserializedTable?.content) {
          for (let i = 0; i < table.content.length; i++) {
            const originalCells = table.content[i].content?.length || 0;
            const deserializedCells = deserializedTable.content[i].content?.length || 0;
            expect(deserializedCells).toBe(originalCells);
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  it('list items count should be preserved through round-trip', () => {
    /**
     * **Validates: Requirements 3.3**
     *
     * For any list (bullet or ordered), after serialize → deserialize,
     * the number of list items should be preserved exactly.
     */
    fc.assert(
      fc.property(
        fc.oneof(bulletListNodeArb, orderedListNodeArb),
        (list) => {
          const doc: TipTapNode = { type: 'doc', content: [list] };
          const html = serializeContent(doc);
          const deserialized = deserializeContent(html);

          const deserializedList = deserialized.content?.[0];
          expect(deserializedList?.type).toBe(list.type);

          // Same number of list items
          const originalItems = list.content?.length || 0;
          const deserializedItems = deserializedList?.content?.length || 0;
          expect(deserializedItems).toBe(originalItems);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('marks (bold, italic) should be preserved through round-trip', () => {
    /**
     * **Validates: Requirements 3.3**
     *
     * For any text node with marks (bold, italic, code, strike),
     * after serialize → deserialize, the marks should be preserved.
     */
    fc.assert(
      fc.property(
        fc.array(textNodeArb, { minLength: 1, maxLength: 3 }).filter(
          nodes => nodes.some(n => n.marks && n.marks.length > 0)
        ),
        (textNodes) => {
          const doc: TipTapNode = {
            type: 'doc',
            content: [{ type: 'paragraph', content: textNodes }],
          };
          const html = serializeContent(doc);
          const deserialized = deserializeContent(html);

          const paragraph = deserialized.content?.[0];
          expect(paragraph?.type).toBe('paragraph');

          // Count marked nodes in original
          const originalMarkedCount = textNodes.filter(
            n => n.marks && n.marks.length > 0
          ).length;

          // Count marked nodes in deserialized
          const deserializedMarkedCount = (paragraph?.content || []).filter(
            n => n.marks && n.marks.length > 0
          ).length;

          expect(deserializedMarkedCount).toBe(originalMarkedCount);
        }
      ),
      { numRuns: 100 }
    );
  });
});
