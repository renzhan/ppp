/**
 * Response Parser for the Report Generation Pipeline.
 *
 * Parses LLM responses into HTML-compatible Markdown based on output_format,
 * and handles content truncation at paragraph boundaries.
 */

export interface ParsedContent {
  html: string; // HTML-compatible Markdown content
}

export type OutputFormat = 'paragraphs' | 'bullets' | 'table' | 'structured';

/**
 * Parse an LLM response into HTML-compatible Markdown based on the specified output format.
 *
 * - paragraphs: Wraps text blocks in <p> tags, separated by double newlines
 * - bullets: Converts lines starting with - or * into <ul><li> lists
 * - table: Preserves Markdown table format or wraps in <table> structure
 * - structured: Preserves headings (## / ###) and wraps remaining content in <p> tags
 *
 * @param rawText - The raw LLM response text
 * @param outputFormat - The desired output format specification
 * @returns ParsedContent with HTML-compatible Markdown
 */
export function parseResponse(
  rawText: string,
  outputFormat: OutputFormat,
): ParsedContent {
  if (!rawText || rawText.trim().length === 0) {
    return { html: '' };
  }

  const trimmed = rawText.trim();

  switch (outputFormat) {
    case 'paragraphs':
      return { html: parseParagraphs(trimmed) };
    case 'bullets':
      return { html: parseBullets(trimmed) };
    case 'table':
      return { html: parseTable(trimmed) };
    case 'structured':
      return { html: parseStructured(trimmed) };
    default:
      // Fallback: treat as paragraphs
      return { html: parseParagraphs(trimmed) };
  }
}

/**
 * Truncate content at the nearest paragraph boundary (double newline) when it exceeds maxLength.
 *
 * Rules:
 * (a) The result ends at a paragraph boundary (\n\n)
 * (b) The result has length ≤ maxLength, OR is the first complete paragraph if that paragraph
 *     alone exceeds maxLength
 * (c) The result is a prefix of the original content
 *
 * @param content - The content string to truncate
 * @param maxLength - Maximum allowed length (default 2000)
 * @returns Truncated string ending at a paragraph boundary
 */
export function truncateAtParagraphBoundary(content: string, maxLength: number = 2000): string {
  // If content is within limit, return as-is
  if (content.length <= maxLength) {
    return content;
  }

  // Find paragraph boundaries (double newlines) within the allowed length
  const paragraphBreak = '\n\n';
  
  // Find the last paragraph boundary at or before maxLength
  let lastBoundary = -1;
  let searchFrom = 0;

  while (true) {
    const idx = content.indexOf(paragraphBreak, searchFrom);
    if (idx === -1 || idx >= maxLength) {
      break;
    }
    // The boundary position is at the end of the paragraph (before the \n\n)
    lastBoundary = idx;
    searchFrom = idx + paragraphBreak.length;
  }

  // If no paragraph boundary found before maxLength, return the first complete paragraph
  if (lastBoundary === -1) {
    const firstBreak = content.indexOf(paragraphBreak);
    if (firstBreak === -1) {
      // No paragraph breaks at all — return the full content (first "paragraph")
      return content;
    }
    // Return the first complete paragraph (which exceeds maxLength)
    return content.substring(0, firstBreak);
  }

  // Truncate at the last paragraph boundary found within maxLength
  return content.substring(0, lastBoundary);
}

// --- Internal parsing helpers ---

/**
 * Parse text into paragraph format: split by double newlines, wrap each block in <p> tags.
 */
function parseParagraphs(text: string): string {
  const paragraphs = text.split(/\n\n+/);
  return paragraphs
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .map((p) => `<p>${p}</p>`)
    .join('\n\n');
}

/**
 * Parse text into bullet list format.
 * Lines starting with - or * become list items; other content is preserved as paragraphs.
 */
function parseBullets(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];
  let inList = false;
  let listItems: string[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();
    const bulletMatch = trimmedLine.match(/^[-*]\s+(.+)$/);

    if (bulletMatch) {
      if (!inList) {
        inList = true;
        listItems = [];
      }
      listItems.push(bulletMatch[1]);
    } else {
      if (inList) {
        result.push('<ul>');
        for (const item of listItems) {
          result.push(`<li>${item}</li>`);
        }
        result.push('</ul>');
        inList = false;
        listItems = [];
      }
      if (trimmedLine.length > 0) {
        result.push(`<p>${trimmedLine}</p>`);
      }
    }
  }

  // Close any remaining open list
  if (inList && listItems.length > 0) {
    result.push('<ul>');
    for (const item of listItems) {
      result.push(`<li>${item}</li>`);
    }
    result.push('</ul>');
  }

  return result.join('\n');
}

/**
 * Parse text as table format. Preserves Markdown table syntax or wraps in HTML table.
 */
function parseTable(text: string): string {
  const lines = text.split('\n').filter((l) => l.trim().length > 0);

  // Check if it's already a Markdown table (lines contain |)
  const isMarkdownTable = lines.some((l) => l.includes('|'));

  if (isMarkdownTable) {
    // Parse Markdown table into HTML table
    const tableLines = lines.filter((l) => l.trim().startsWith('|') || l.includes('|'));
    if (tableLines.length === 0) {
      return `<p>${text}</p>`;
    }

    const rows: string[][] = [];
    for (const line of tableLines) {
      // Skip separator lines (e.g., |---|---|)
      if (/^\|?\s*[-:]+\s*\|/.test(line.trim())) {
        continue;
      }
      const cells = line
        .split('|')
        .map((c) => c.trim())
        .filter((c) => c.length > 0);
      if (cells.length > 0) {
        rows.push(cells);
      }
    }

    if (rows.length === 0) {
      return `<p>${text}</p>`;
    }

    let html = '<table>\n';
    // First row as header
    html += '<thead><tr>';
    for (const cell of rows[0]) {
      html += `<th>${cell}</th>`;
    }
    html += '</tr></thead>\n';

    // Remaining rows as body
    if (rows.length > 1) {
      html += '<tbody>\n';
      for (let i = 1; i < rows.length; i++) {
        html += '<tr>';
        for (const cell of rows[i]) {
          html += `<td>${cell}</td>`;
        }
        html += '</tr>\n';
      }
      html += '</tbody>\n';
    }
    html += '</table>';
    return html;
  }

  // Not a Markdown table — wrap as paragraphs
  return parseParagraphs(text);
}

/**
 * Parse text as structured format: preserve headings (##, ###) and wrap other content in <p> tags.
 */
function parseStructured(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];
  let currentParagraph: string[] = [];

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      const content = currentParagraph.join('\n').trim();
      if (content.length > 0) {
        result.push(`<p>${content}</p>`);
      }
      currentParagraph = [];
    }
  };

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Check for headings
    const headingMatch = trimmedLine.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      const level = headingMatch[1].length;
      result.push(`<h${level}>${headingMatch[2]}</h${level}>`);
    } else if (trimmedLine.length === 0) {
      flushParagraph();
    } else {
      currentParagraph.push(trimmedLine);
    }
  }

  flushParagraph();
  return result.join('\n\n');
}
