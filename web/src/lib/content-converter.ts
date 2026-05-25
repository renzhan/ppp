/**
 * Content format converter for report modules → Markdown.
 *
 * Converts structured report module data into Markdown format suitable
 * for Presenton PPT generation. Handles module filtering (hide/show),
 * paragraph content, and table formatting.
 *
 * Rules:
 * 1. Modules with status === 'hide' are excluded from output
 * 2. Numeric data preserved as-is, no rounding or truncation
 * 3. Tables converted to Markdown table format (| header | ... |)
 * 4. Paragraph content output directly
 */

import type { ReportModule } from './presenton-client';

export interface ConversionResult {
  markdown: string;
  includedModules: string[]; // module keys that were included
}

/**
 * Converts report modules to Markdown format for PPT generation.
 *
 * @param modules - Record of module key → ReportModule data
 * @param metadata - Project metadata (projectName, brand, category)
 * @returns ConversionResult with markdown string and list of included module keys
 */
export function convertModulesToMarkdown(
  modules: Record<string, ReportModule>,
  metadata: { projectName: string; brand: string; category: string }
): ConversionResult {
  const includedModules: string[] = [];
  const sections: string[] = [];

  // Add metadata header
  sections.push(`# ${metadata.projectName}`);
  sections.push('');
  sections.push(`**品牌:** ${metadata.brand}`);
  sections.push(`**品类:** ${metadata.category}`);
  sections.push('');

  for (const [key, module] of Object.entries(modules)) {
    // Rule 1: Skip modules with status === 'hide'
    if (module.status === 'hide') {
      continue;
    }

    includedModules.push(key);

    // Add module heading
    sections.push(`## ${key}`);
    sections.push('');

    // Rule 4: Output paragraph content directly
    if (module.paragraphs && module.paragraphs.length > 0) {
      for (const paragraph of module.paragraphs) {
        sections.push(paragraph.content);
        sections.push('');
      }
    }

    // Rule 3: Convert tables to Markdown table format
    if (module.tables && module.tables.length > 0) {
      for (const table of module.tables) {
        if (table.title) {
          sections.push(`### ${table.title}`);
          sections.push('');
        }

        // Rule 2: Numeric data preserved as-is
        const headerRow = `| ${table.headers.join(' | ')} |`;
        const separatorRow = `| ${table.headers.map(() => '---').join(' | ')} |`;
        sections.push(headerRow);
        sections.push(separatorRow);

        for (const row of table.rows) {
          const dataRow = `| ${row.join(' | ')} |`;
          sections.push(dataRow);
        }

        sections.push('');
      }
    }
  }

  return {
    markdown: sections.join('\n').trimEnd(),
    includedModules,
  };
}

/**
 * Parses Markdown tables back into structured data for verification (round-trip testing).
 *
 * This function extracts tables from Markdown content and returns them
 * grouped by module key (identified by ## headings).
 *
 * @param markdown - Markdown string to parse
 * @returns Record of module key → { tables: [...] }
 */
export function parseMarkdownToModules(
  markdown: string
): Record<string, { tables: Array<{ headers: string[]; rows: string[][] }> }> {
  const result: Record<string, { tables: Array<{ headers: string[]; rows: string[][] }> }> = {};
  const lines = markdown.split('\n');

  let currentModule: string | null = null;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Detect module heading (## key)
    if (line.startsWith('## ')) {
      currentModule = line.slice(3).trim();
      if (!result[currentModule]) {
        result[currentModule] = { tables: [] };
      }
      i++;
      continue;
    }

    // Detect table start (line starts with |)
    if (currentModule && line.startsWith('|') && line.trim().endsWith('|')) {
      // Parse header row
      const headers = parseTableRow(line);

      // Skip separator row (| --- | --- | ... |)
      i++;
      if (i < lines.length && lines[i].startsWith('|') && lines[i].includes('---')) {
        i++; // skip separator
      }

      // Parse data rows
      const rows: string[][] = [];
      while (i < lines.length && lines[i].startsWith('|') && lines[i].trim().endsWith('|')) {
        rows.push(parseTableRow(lines[i]));
        i++;
      }

      result[currentModule].tables.push({ headers, rows });
      continue;
    }

    i++;
  }

  return result;
}

/**
 * Parses a single Markdown table row into an array of cell values.
 * Trims whitespace from each cell.
 */
function parseTableRow(line: string): string[] {
  // Remove leading and trailing pipes, then split by |
  const trimmed = line.trim();
  const inner = trimmed.startsWith('|') ? trimmed.slice(1) : trimmed;
  const withoutTrailing = inner.endsWith('|') ? inner.slice(0, -1) : inner;
  return withoutTrailing.split('|').map((cell) => cell.trim());
}
