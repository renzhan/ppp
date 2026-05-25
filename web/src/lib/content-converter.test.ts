/**
 * Unit tests for content-converter.ts
 *
 * Tests the convertModulesToMarkdown() and parseMarkdownToModules() functions.
 * Validates: Requirements 12.1, 12.2, 12.3, 12.5
 */

import { describe, it, expect } from 'vitest';
import { convertModulesToMarkdown, parseMarkdownToModules } from './content-converter';
import type { ReportModule } from './presenton-client';

const metadata = { projectName: 'Test Project', brand: 'TestBrand', category: 'TestCategory' };

describe('convertModulesToMarkdown', () => {
  it('filters out modules with status === "hide"', () => {
    const modules: Record<string, ReportModule> = {
      visible: {
        status: 'show',
        paragraphs: [{ content: 'Visible content' }],
      },
      hidden: {
        status: 'hide',
        paragraphs: [{ content: 'Hidden content' }],
      },
    };

    const result = convertModulesToMarkdown(modules, metadata);

    expect(result.includedModules).toContain('visible');
    expect(result.includedModules).not.toContain('hidden');
    expect(result.markdown).toContain('Visible content');
    expect(result.markdown).not.toContain('Hidden content');
  });

  it('preserves numeric data as-is without rounding', () => {
    const modules: Record<string, ReportModule> = {
      kpi: {
        status: 'show',
        tables: [
          {
            title: 'KPI Data',
            headers: ['Metric', 'Value'],
            rows: [
              ['Revenue', '123456.789'],
              ['Growth Rate', '0.123456789'],
              ['Impressions', '9876543210'],
            ],
          },
        ],
      },
    };

    const result = convertModulesToMarkdown(modules, metadata);

    expect(result.markdown).toContain('123456.789');
    expect(result.markdown).toContain('0.123456789');
    expect(result.markdown).toContain('9876543210');
  });

  it('converts tables to Markdown table format', () => {
    const modules: Record<string, ReportModule> = {
      analysis: {
        status: 'show',
        tables: [
          {
            title: 'Performance',
            headers: ['Channel', 'Clicks', 'CTR'],
            rows: [
              ['Search', '1000', '2.5%'],
              ['Social', '2000', '3.1%'],
            ],
          },
        ],
      },
    };

    const result = convertModulesToMarkdown(modules, metadata);

    expect(result.markdown).toContain('| Channel | Clicks | CTR |');
    expect(result.markdown).toContain('| --- | --- | --- |');
    expect(result.markdown).toContain('| Search | 1000 | 2.5% |');
    expect(result.markdown).toContain('| Social | 2000 | 3.1% |');
  });

  it('outputs paragraph content directly', () => {
    const modules: Record<string, ReportModule> = {
      summary: {
        status: 'show',
        paragraphs: [
          { content: 'First paragraph of the report.' },
          { content: 'Second paragraph with details.' },
        ],
      },
    };

    const result = convertModulesToMarkdown(modules, metadata);

    expect(result.markdown).toContain('First paragraph of the report.');
    expect(result.markdown).toContain('Second paragraph with details.');
  });

  it('includes metadata header with project info', () => {
    const modules: Record<string, ReportModule> = {
      intro: { status: 'show', paragraphs: [{ content: 'Hello' }] },
    };

    const result = convertModulesToMarkdown(modules, metadata);

    expect(result.markdown).toContain('# Test Project');
    expect(result.markdown).toContain('**品牌:** TestBrand');
    expect(result.markdown).toContain('**品类:** TestCategory');
  });

  it('returns empty includedModules when all modules are hidden', () => {
    const modules: Record<string, ReportModule> = {
      a: { status: 'hide', paragraphs: [{ content: 'A' }] },
      b: { status: 'hide', paragraphs: [{ content: 'B' }] },
    };

    const result = convertModulesToMarkdown(modules, metadata);

    expect(result.includedModules).toEqual([]);
  });

  it('handles modules with both paragraphs and tables', () => {
    const modules: Record<string, ReportModule> = {
      mixed: {
        status: 'show',
        paragraphs: [{ content: 'Overview text' }],
        tables: [
          {
            headers: ['Name', 'Value'],
            rows: [['Item1', '100']],
          },
        ],
      },
    };

    const result = convertModulesToMarkdown(modules, metadata);

    expect(result.markdown).toContain('Overview text');
    expect(result.markdown).toContain('| Name | Value |');
    expect(result.markdown).toContain('| Item1 | 100 |');
  });
});

describe('parseMarkdownToModules', () => {
  it('parses Markdown tables back into structured data', () => {
    const markdown = `## analysis

### Performance

| Channel | Clicks | CTR |
| --- | --- | --- |
| Search | 1000 | 2.5% |
| Social | 2000 | 3.1% |
`;

    const result = parseMarkdownToModules(markdown);

    expect(result['analysis']).toBeDefined();
    expect(result['analysis'].tables).toHaveLength(1);
    expect(result['analysis'].tables[0].headers).toEqual(['Channel', 'Clicks', 'CTR']);
    expect(result['analysis'].tables[0].rows).toEqual([
      ['Search', '1000', '2.5%'],
      ['Social', '2000', '3.1%'],
    ]);
  });

  it('handles multiple tables in one module', () => {
    const markdown = `## kpi

| Metric | Value |
| --- | --- |
| Revenue | 1000 |

| Channel | CTR |
| --- | --- |
| Search | 2.5% |
| Social | 3.1% |
`;

    const result = parseMarkdownToModules(markdown);

    expect(result['kpi'].tables).toHaveLength(2);
    expect(result['kpi'].tables[0].rows).toHaveLength(1);
    expect(result['kpi'].tables[1].rows).toHaveLength(2);
  });

  it('handles multiple modules', () => {
    const markdown = `## moduleA

| H1 | H2 |
| --- | --- |
| a | b |

## moduleB

| X | Y |
| --- | --- |
| 1 | 2 |
`;

    const result = parseMarkdownToModules(markdown);

    expect(Object.keys(result)).toEqual(['moduleA', 'moduleB']);
    expect(result['moduleA'].tables[0].headers).toEqual(['H1', 'H2']);
    expect(result['moduleB'].tables[0].headers).toEqual(['X', 'Y']);
  });
});
