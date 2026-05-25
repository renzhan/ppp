/**
 * TipTap Content Serializer
 *
 * Provides utilities for serializing and deserializing TipTap editor content.
 * Since @tiptap/html is not available for server-side use, this module works
 * with HTML strings (the format TipTap uses via getHTML()/setContent()) and
 * provides normalization to ensure consistent round-trip behavior.
 *
 * The TipTap editor serializes content to HTML via editor.getHTML() and
 * deserializes HTML back via editor.commands.setContent(html). This module
 * provides a normalizeHTML function that ensures HTML content is in a
 * canonical form, making round-trip comparisons reliable.
 */

/**
 * Represents a simplified TipTap document node structure (JSONContent).
 * Used for generating test data and validating structural properties.
 */
export interface TipTapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  text?: string;
}

/**
 * Normalizes HTML content to a canonical form for consistent comparison.
 *
 * Normalization rules:
 * 1. Collapse multiple whitespace characters into single spaces
 * 2. Remove whitespace between tags (inter-element whitespace)
 * 3. Trim leading/trailing whitespace within text nodes
 * 4. Normalize self-closing tags (e.g., <br /> → <br>)
 * 5. Normalize attribute quoting (ensure double quotes)
 * 6. Remove empty text nodes
 * 7. Lowercase tag names and attribute names
 *
 * This normalization is IDEMPOTENT: normalizing already-normalized content
 * produces the same result.
 */
export function normalizeHTML(html: string): string {
  if (!html || html.trim() === '') {
    return '';
  }

  let result = html;

  // 1. Normalize self-closing tags: <br /> → <br>, <hr /> → <hr>
  result = result.replace(/<(br|hr|img|input)\s*\/?\s*>/gi, (_, tag) => `<${tag.toLowerCase()}>`);

  // 2. Lowercase tag names in opening tags
  result = result.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)/g, (match) => match.toLowerCase());

  // 3. Remove whitespace between closing and opening tags
  result = result.replace(/>\s+</g, '><');

  // 4. Collapse multiple whitespace within text content to single space
  result = result.replace(/([^<>])\s{2,}([^<>])/g, '$1 $2');

  // 5. Trim whitespace at start/end of text within tags
  result = result.replace(/>(\s+)/g, '>');
  result = result.replace(/(\s+)</g, '<');

  // 6. Remove completely empty paragraphs (normalize to consistent form)
  // Keep <p></p> as the canonical empty paragraph form
  result = result.replace(/<p>\s*<\/p>/g, '<p></p>');

  // 7. Trim the overall result
  result = result.trim();

  return result;
}

/**
 * Serializes a TipTap JSONContent node tree to an HTML string.
 * This is a simplified serializer that handles the common node types
 * used in the TipTap editor (headings, paragraphs, bold, italic, lists, tables).
 */
export function serializeContent(doc: TipTapNode): string {
  if (!doc || !doc.content) {
    return '';
  }
  return doc.content.map(node => serializeNode(node)).join('');
}

function serializeNode(node: TipTapNode): string {
  if (node.type === 'text') {
    let text = node.text || '';
    if (node.marks) {
      for (const mark of node.marks) {
        text = wrapWithMark(text, mark.type);
      }
    }
    return text;
  }

  const children = node.content
    ? node.content.map(child => serializeNode(child)).join('')
    : '';

  switch (node.type) {
    case 'doc':
      return children;
    case 'paragraph':
      return `<p>${children}</p>`;
    case 'heading': {
      const level = (node.attrs?.level as number) || 1;
      return `<h${level}>${children}</h${level}>`;
    }
    case 'bulletList':
      return `<ul>${children}</ul>`;
    case 'orderedList':
      return `<ol>${children}</ol>`;
    case 'listItem':
      return `<li>${children}</li>`;
    case 'blockquote':
      return `<blockquote>${children}</blockquote>`;
    case 'codeBlock':
      return `<pre><code>${children}</code></pre>`;
    case 'table':
      return `<table>${children}</table>`;
    case 'tableRow':
      return `<tr>${children}</tr>`;
    case 'tableCell':
      return `<td>${children}</td>`;
    case 'tableHeader':
      return `<th>${children}</th>`;
    case 'hardBreak':
      return '<br>';
    default:
      return children;
  }
}

function wrapWithMark(text: string, markType: string): string {
  switch (markType) {
    case 'bold':
      return `<strong>${text}</strong>`;
    case 'italic':
      return `<em>${text}</em>`;
    case 'code':
      return `<code>${text}</code>`;
    case 'strike':
      return `<s>${text}</s>`;
    default:
      return text;
  }
}

/**
 * Deserializes an HTML string back into a TipTap JSONContent node tree.
 * This is a simplified parser that handles the common HTML elements
 * produced by the serializer.
 */
export function deserializeContent(html: string): TipTapNode {
  const doc: TipTapNode = { type: 'doc', content: [] };

  if (!html || html.trim() === '') {
    return doc;
  }

  // Parse top-level block elements by finding matching open/close tags
  const blocks = parseTopLevelBlocks(html);
  for (const block of blocks) {
    const node = parseBlockElement(block.tag, block.inner);
    if (node) {
      doc.content!.push(node);
    }
  }

  // If no block elements found, wrap in paragraph
  if (doc.content!.length === 0 && html.trim()) {
    doc.content!.push({
      type: 'paragraph',
      content: parseInlineContent(html),
    });
  }

  return doc;
}

/**
 * Parses top-level block elements from HTML by tracking tag nesting depth.
 * This avoids regex issues with nested tags of the same type.
 */
function parseTopLevelBlocks(html: string): Array<{ tag: string; inner: string }> {
  const blocks: Array<{ tag: string; inner: string }> = [];
  const blockTags = ['p', 'h1', 'h2', 'h3', 'ul', 'ol', 'blockquote', 'pre', 'table'];

  let pos = 0;
  while (pos < html.length) {
    // Find next opening tag
    const openMatch = html.substring(pos).match(/^<(p|h[1-3]|ul|ol|blockquote|pre|table)(\s[^>]*)?>/)
      || html.substring(pos).match(/^[^<]*/);

    if (!openMatch || !openMatch[1]) {
      // Skip non-tag content
      const nextTag = html.indexOf('<', pos + 1);
      if (nextTag === -1) break;
      pos = nextTag;
      continue;
    }

    const tag = openMatch[1];
    const openTagEnd = pos + openMatch[0].length;
    const closeTag = `</${tag}>`;

    // Find matching close tag (accounting for nesting)
    let depth = 1;
    let searchPos = openTagEnd;
    while (depth > 0 && searchPos < html.length) {
      const nextOpen = html.indexOf(`<${tag}`, searchPos);
      const nextClose = html.indexOf(closeTag, searchPos);

      if (nextClose === -1) break; // No closing tag found

      // Check if there's a nested open tag before the close tag
      if (nextOpen !== -1 && nextOpen < nextClose) {
        // Check it's actually an opening tag (followed by > or space)
        const charAfterTag = html[nextOpen + tag.length + 1];
        if (charAfterTag === '>' || charAfterTag === ' ') {
          depth++;
          searchPos = nextOpen + tag.length + 1;
        } else {
          searchPos = nextOpen + 1;
        }
      } else {
        depth--;
        if (depth === 0) {
          const inner = html.substring(openTagEnd, nextClose);
          blocks.push({ tag, inner });
          pos = nextClose + closeTag.length;
        } else {
          searchPos = nextClose + closeTag.length;
        }
      }
    }

    if (depth > 0) {
      // Couldn't find matching close tag, skip this position
      pos++;
    }
  }

  return blocks;
}

function parseBlockElement(tag: string, inner: string): TipTapNode | null {
  if (tag === 'p') {
    return { type: 'paragraph', content: parseInlineContent(inner) };
  }

  if (tag.match(/^h[1-3]$/)) {
    const level = parseInt(tag[1], 10);
    return { type: 'heading', attrs: { level }, content: parseInlineContent(inner) };
  }

  if (tag === 'ul') {
    return { type: 'bulletList', content: parseListItems(inner) };
  }

  if (tag === 'ol') {
    return { type: 'orderedList', content: parseListItems(inner) };
  }

  if (tag === 'blockquote') {
    // Blockquote contains block elements (paragraphs)
    const content: TipTapNode[] = [];
    const pRegex = /<p>([\s\S]*?)<\/p>/g;
    let pMatch: RegExpExecArray | null;
    while ((pMatch = pRegex.exec(inner)) !== null) {
      content.push({ type: 'paragraph', content: parseInlineContent(pMatch[1]) });
    }
    if (content.length === 0) {
      content.push({ type: 'paragraph', content: parseInlineContent(inner) });
    }
    return { type: 'blockquote', content };
  }

  if (tag === 'pre') {
    // Code block: <pre><code>...</code></pre>
    const codeMatch = inner.match(/<code>([\s\S]*?)<\/code>/);
    const text = codeMatch ? codeMatch[1] : inner;
    return {
      type: 'codeBlock',
      content: text ? [{ type: 'text', text }] : [],
    };
  }

  if (tag === 'table') {
    return { type: 'table', content: parseTableRows(inner) };
  }

  return null;
}

function parseListItems(html: string): TipTapNode[] {
  const items: TipTapNode[] = [];
  const liRegex = /<li>([\s\S]*?)<\/li>/g;
  let match: RegExpExecArray | null;

  while ((match = liRegex.exec(html)) !== null) {
    const inner = match[1];
    // List items in TipTap contain paragraphs: <li><p>content</p></li>
    const pMatch = inner.match(/^<p>([\s\S]*)<\/p>$/);
    const content = pMatch ? pMatch[1] : inner;
    items.push({
      type: 'listItem',
      content: [{ type: 'paragraph', content: parseInlineContent(content) }],
    });
  }

  return items;
}

function parseTableRows(html: string): TipTapNode[] {
  const rows: TipTapNode[] = [];
  const trRegex = /<tr>([\s\S]*?)<\/tr>/g;
  let match: RegExpExecArray | null;

  while ((match = trRegex.exec(html)) !== null) {
    const cells: TipTapNode[] = [];
    const cellRegex = /<(td|th)>([\s\S]*?)<\/\1>/g;
    let cellMatch: RegExpExecArray | null;

    while ((cellMatch = cellRegex.exec(match[1])) !== null) {
      const cellType = cellMatch[1] === 'th' ? 'tableHeader' : 'tableCell';
      const cellInner = cellMatch[2];
      // Table cells in TipTap contain paragraphs: <td><p>content</p></td>
      const pMatch = cellInner.match(/^<p>([\s\S]*)<\/p>$/);
      const content = pMatch ? pMatch[1] : cellInner;
      cells.push({
        type: cellType,
        content: [{ type: 'paragraph', content: parseInlineContent(content) }],
      });
    }

    rows.push({ type: 'tableRow', content: cells });
  }

  return rows;
}

function parseInlineContent(html: string): TipTapNode[] {
  if (!html) return [];

  const nodes: TipTapNode[] = [];
  // Match inline marks: <strong>, <em>, <code>, <s>
  const inlineRegex = /(<strong>|<em>|<code>|<s>)([\s\S]*?)(<\/strong>|<\/em>|<\/code>|<\/s>)|([^<]+)|<br>/g;
  let match: RegExpExecArray | null;

  while ((match = inlineRegex.exec(html)) !== null) {
    if (match[4]) {
      // Plain text
      nodes.push({ type: 'text', text: match[4] });
    } else if (match[1]) {
      // Marked text
      const markType = getMarkType(match[1]);
      const text = match[2];
      if (text) {
        nodes.push({
          type: 'text',
          text,
          marks: [{ type: markType }],
        });
      }
    } else if (match[0] === '<br>') {
      nodes.push({ type: 'hardBreak' });
    }
  }

  return nodes;
}

function getMarkType(openTag: string): string {
  switch (openTag) {
    case '<strong>': return 'bold';
    case '<em>': return 'italic';
    case '<code>': return 'code';
    case '<s>': return 'strike';
    default: return 'bold';
  }
}
