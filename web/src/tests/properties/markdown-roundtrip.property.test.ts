/**
 * Property-Based Test: 报告数据 Markdown 往返转换
 *
 * **Validates: Requirements 12.1, 12.2, 12.3, 12.4**
 *
 * Property 8: 报告数据 Markdown 往返转换
 * For any valid report module data (KPI tables, content analysis tables,
 * traffic analysis tables), converting to Markdown then parsing back
 * should produce exact numeric values and unchanged row/column counts.
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { convertModulesToMarkdown, parseMarkdownToModules } from '../../lib/content-converter';
import type { ReportModule } from '../../lib/presenton-client';

// --- Generators ---

/**
 * Generates a random table header that does NOT contain the pipe character.
 */
const tableHeaderArb: fc.Arbitrary<string> = fc.constantFrom(
  '指标', '数值', '环比', '同比', '日期', '品牌', '品类',
  '点击量', '曝光量', '转化率', '花费', '收入', 'ROI',
  'KPI', 'GMV', 'CTR', 'CPM', 'CPC', '总计'
);

/**
 * Generates a random table cell value (numeric: integers, decimals, percentages).
 * Cell values must NOT contain the pipe character `|` since that's the Markdown table delimiter.
 */
const numericCellArb: fc.Arbitrary<string> = fc.oneof(
  // Integers
  fc.integer({ min: 0, max: 9999999 }).map(n => String(n)),
  // Decimals with varying precision
  fc.tuple(
    fc.integer({ min: 0, max: 99999 }),
    fc.integer({ min: 1, max: 99999 })
  ).map(([whole, frac]) => `${whole}.${frac}`),
  // Percentages
  fc.tuple(
    fc.constantFrom('+', '-', ''),
    fc.integer({ min: 0, max: 999 }),
    fc.integer({ min: 0, max: 99 })
  ).map(([sign, whole, frac]) => `${sign}${whole}.${frac}%`),
  // Simple integer percentages
  fc.integer({ min: 0, max: 100 }).map(n => `${n}%`),
  // Large numbers
  fc.integer({ min: 100000, max: 99999999 }).map(n => String(n)),
  // Small decimals
  fc.integer({ min: 1, max: 9999 }).map(n => `0.${n}`)
);

/**
 * Generates a random table with headers and rows containing numeric values.
 * Ensures column count is consistent across all rows.
 */
const tableArb: fc.Arbitrary<{
  title?: string;
  headers: string[];
  rows: string[][];
}> = fc.record({
  title: fc.option(
    fc.constantFrom('KPI 总览', '投流数据', '内容分析', '品牌对比', '趋势分析', '流量分析'),
    { nil: undefined }
  ),
  headers: fc.array(tableHeaderArb, { minLength: 2, maxLength: 6 }),
}).chain(({ title, headers }) =>
  fc.array(
    fc.array(numericCellArb, { minLength: headers.length, maxLength: headers.length }),
    { minLength: 1, maxLength: 8 }
  ).map(rows => ({ title, headers, rows }))
);

/**
 * Generates a random ReportModule with status 'show' and at least one table.
 * Only 'show' modules are included since 'hide' modules are filtered out.
 */
const showModuleWithTablesArb: fc.Arbitrary<ReportModule> = fc.record({
  status: fc.constant('show' as const),
  paragraphs: fc.option(
    fc.array(
      fc.record({
        content: fc.constantFrom(
          '本月销量同比增长显著',
          '品牌曝光量持续提升',
          '投流效果优化明显',
          'ROI 达到预期目标'
        ),
      }),
      { minLength: 1, maxLength: 2 }
    ),
    { nil: undefined }
  ),
  tables: fc.array(tableArb, { minLength: 1, maxLength: 3 }),
});

/**
 * Generates a random module key (simulating real module names).
 */
const moduleKeyArb: fc.Arbitrary<string> = fc.constantFrom(
  'kpi_overview', 'content_analysis', 'traffic_analysis',
  'brand_comparison', 'trend_analysis', 'audience_insights',
  'roi_summary', 'campaign_performance', 'competitor_analysis'
);

/**
 * Generates a set of modules all with status 'show' and containing tables.
 * Uses unique keys to avoid collisions.
 */
const moduleSetWithTablesArb: fc.Arbitrary<Record<string, ReportModule>> = fc
  .array(moduleKeyArb, { minLength: 1, maxLength: 6 })
  .map(keys => [...new Set(keys)]) // deduplicate
  .filter(keys => keys.length >= 1)
  .chain(uniqueKeys => {
    const arbitraries = uniqueKeys.map(key =>
      showModuleWithTablesArb.map(mod => [key, mod] as [string, ReportModule])
    );
    return fc.tuple(...(arbitraries as [fc.Arbitrary<[string, ReportModule]>, ...fc.Arbitrary<[string, ReportModule]>[]]));
  })
  .map(pairs => Object.fromEntries(pairs));

/**
 * Generates random metadata for the conversion function.
 */
const metadataArb: fc.Arbitrary<{ projectName: string; brand: string; category: string }> = fc.record({
  projectName: fc.constantFrom('项目A', '品牌复盘', '618大促', 'Q3营销分析'),
  brand: fc.constantFrom('品牌X', '品牌Y', '品牌Z', 'BrandAlpha'),
  category: fc.constantFrom('美妆', '食品', '服饰', '数码', '家居'),
});

// --- Tests ---

describe('Property 8: 报告数据 Markdown 往返转换 (Report Data Markdown Round-Trip)', () => {
  it('round-trip preserves table headers exactly', () => {
    /**
     * **Validates: Requirements 12.1, 12.2, 12.3, 12.4**
     *
     * For any set of report modules with tables, converting to Markdown
     * then parsing back should produce tables with identical headers.
     */
    fc.assert(
      fc.property(moduleSetWithTablesArb, metadataArb, (modules, metadata) => {
        const { markdown } = convertModulesToMarkdown(modules, metadata);
        const parsed = parseMarkdownToModules(markdown);

        for (const [key, mod] of Object.entries(modules)) {
          if (!mod.tables || mod.tables.length === 0) continue;

          expect(parsed[key]).toBeDefined();
          expect(parsed[key].tables.length).toBe(mod.tables.length);

          for (let t = 0; t < mod.tables.length; t++) {
            const originalHeaders = mod.tables[t].headers;
            const parsedHeaders = parsed[key].tables[t].headers;
            expect(parsedHeaders).toEqual(originalHeaders);
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  it('round-trip preserves row count for each table', () => {
    /**
     * **Validates: Requirements 12.1, 12.2, 12.3, 12.4**
     *
     * For any set of report modules with tables, converting to Markdown
     * then parsing back should produce tables with the same number of rows.
     */
    fc.assert(
      fc.property(moduleSetWithTablesArb, metadataArb, (modules, metadata) => {
        const { markdown } = convertModulesToMarkdown(modules, metadata);
        const parsed = parseMarkdownToModules(markdown);

        for (const [key, mod] of Object.entries(modules)) {
          if (!mod.tables || mod.tables.length === 0) continue;

          expect(parsed[key]).toBeDefined();

          for (let t = 0; t < mod.tables.length; t++) {
            const originalRowCount = mod.tables[t].rows.length;
            const parsedRowCount = parsed[key].tables[t].rows.length;
            expect(parsedRowCount).toBe(originalRowCount);
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  it('round-trip preserves column count for each row', () => {
    /**
     * **Validates: Requirements 12.1, 12.2, 12.3, 12.4**
     *
     * For any set of report modules with tables, converting to Markdown
     * then parsing back should produce rows with the same number of columns.
     */
    fc.assert(
      fc.property(moduleSetWithTablesArb, metadataArb, (modules, metadata) => {
        const { markdown } = convertModulesToMarkdown(modules, metadata);
        const parsed = parseMarkdownToModules(markdown);

        for (const [key, mod] of Object.entries(modules)) {
          if (!mod.tables || mod.tables.length === 0) continue;

          for (let t = 0; t < mod.tables.length; t++) {
            for (let r = 0; r < mod.tables[t].rows.length; r++) {
              const originalColCount = mod.tables[t].rows[r].length;
              const parsedColCount = parsed[key].tables[t].rows[r].length;
              expect(parsedColCount).toBe(originalColCount);
            }
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  it('round-trip preserves exact cell values (no rounding or truncation)', () => {
    /**
     * **Validates: Requirements 12.1, 12.2, 12.3, 12.4**
     *
     * For any set of report modules with tables containing numeric values,
     * converting to Markdown then parsing back should produce cells with
     * exact string equality — no rounding, no truncation, no modification.
     */
    fc.assert(
      fc.property(moduleSetWithTablesArb, metadataArb, (modules, metadata) => {
        const { markdown } = convertModulesToMarkdown(modules, metadata);
        const parsed = parseMarkdownToModules(markdown);

        for (const [key, mod] of Object.entries(modules)) {
          if (!mod.tables || mod.tables.length === 0) continue;

          expect(parsed[key]).toBeDefined();

          for (let t = 0; t < mod.tables.length; t++) {
            const originalTable = mod.tables[t];
            const parsedTable = parsed[key].tables[t];

            for (let r = 0; r < originalTable.rows.length; r++) {
              for (let c = 0; c < originalTable.rows[r].length; c++) {
                const originalValue = originalTable.rows[r][c];
                const parsedValue = parsedTable.rows[r][c];
                expect(parsedValue).toBe(originalValue);
              }
            }
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  it('round-trip preserves table count per module', () => {
    /**
     * **Validates: Requirements 12.1, 12.2, 12.3, 12.4**
     *
     * For any set of report modules, the number of tables parsed back
     * from Markdown should equal the number of tables in the original module.
     */
    fc.assert(
      fc.property(moduleSetWithTablesArb, metadataArb, (modules, metadata) => {
        const { markdown } = convertModulesToMarkdown(modules, metadata);
        const parsed = parseMarkdownToModules(markdown);

        for (const [key, mod] of Object.entries(modules)) {
          if (!mod.tables || mod.tables.length === 0) continue;

          expect(parsed[key]).toBeDefined();
          expect(parsed[key].tables.length).toBe(mod.tables.length);
        }
      }),
      { numRuns: 100 }
    );
  });
});
