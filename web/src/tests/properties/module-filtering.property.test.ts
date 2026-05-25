/**
 * Property-Based Test: 模块过滤正确性
 *
 * **Validates: Requirements 5.6, 12.5**
 *
 * Property 4: 模块过滤正确性
 * For any set of report modules (each with show/hide status),
 * generating PPT content should only include modules with status "show".
 * The output should NOT contain any content from modules with status "hide".
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { convertModulesToMarkdown } from '../../lib/content-converter';
import type { ReportModule } from '../../lib/presenton-client';

// --- Generators ---

/**
 * Generates a random paragraph content string.
 * Uses a mix of alphanumeric and Chinese characters to simulate real report content.
 */
const paragraphContentArb: fc.Arbitrary<string> = fc.array(
  fc.constantFrom(
    '销', '量', '增', '长', '趋', '势', '分', '析', '报', '告',
    '品', '牌', '数', '据', '投', '流', '效', '果', '优', '化',
    'KPI', 'ROI', 'GMV', 'CTR', 'CPM',
    '同比增长', '环比下降', '转化率', '点击率', '曝光量',
    '100', '200.5', '3.14', '99.99', '1000000'
  ),
  { minLength: 1, maxLength: 8 }
).map(arr => arr.join(' '));

/**
 * Generates a random table header.
 */
const tableHeaderArb: fc.Arbitrary<string> = fc.constantFrom(
  '指标', '数值', '环比', '同比', '日期', '品牌', '品类',
  '点击量', '曝光量', '转化率', '花费', '收入', 'ROI'
);

/**
 * Generates a random table cell value (preserving numeric precision).
 */
const tableCellArb: fc.Arbitrary<string> = fc.oneof(
  fc.constantFrom(
    '100', '200.5', '3.14159', '99.99', '1000000', '0.001',
    '12.345%', '+15.2%', '-3.8%'
  ),
  fc.array(
    fc.constantFrom(
      'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j',
      '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'
    ),
    { minLength: 1, maxLength: 10 }
  ).map(arr => arr.join(''))
);

/**
 * Generates a random table with headers and rows.
 */
const tableArb: fc.Arbitrary<{
  title?: string;
  headers: string[];
  rows: string[][];
}> = fc.record({
  title: fc.option(
    fc.constantFrom('KPI 总览', '投流数据', '内容分析', '品牌对比', '趋势分析'),
    { nil: undefined }
  ),
  headers: fc.array(tableHeaderArb, { minLength: 2, maxLength: 5 }),
}).chain(({ title, headers }) =>
  fc.array(
    fc.array(tableCellArb, { minLength: headers.length, maxLength: headers.length }),
    { minLength: 1, maxLength: 5 }
  ).map(rows => ({ title, headers, rows }))
);

/**
 * Generates a random ReportModule with a given status.
 */
function reportModuleArb(status: 'show' | 'hide'): fc.Arbitrary<ReportModule> {
  return fc.record({
    status: fc.constant(status),
    paragraphs: fc.option(
      fc.array(
        fc.record({ content: paragraphContentArb }),
        { minLength: 1, maxLength: 3 }
      ),
      { nil: undefined }
    ),
    tables: fc.option(
      fc.array(tableArb, { minLength: 1, maxLength: 2 }),
      { nil: undefined }
    ),
  });
}

/**
 * Generates a random module key (simulating real module names).
 */
const moduleKeyArb: fc.Arbitrary<string> = fc.constantFrom(
  'kpi_overview', 'content_analysis', 'traffic_analysis',
  'brand_comparison', 'trend_analysis', 'audience_insights',
  'roi_summary', 'campaign_performance', 'competitor_analysis',
  'sentiment_overview', 'engagement_metrics', 'conversion_funnel'
);

/**
 * Generates a random set of modules with mixed show/hide statuses.
 * Ensures at least one module exists and uses unique keys.
 */
const moduleSetArb: fc.Arbitrary<Record<string, ReportModule>> = fc
  .array(
    fc.tuple(
      moduleKeyArb,
      fc.constantFrom('show' as const, 'hide' as const)
    ),
    { minLength: 1, maxLength: 8 }
  )
  .chain(entries => {
    // Deduplicate keys by taking the first occurrence
    const uniqueEntries = new Map(entries);
    const arbitraries = [...uniqueEntries.entries()].map(([key, status]) =>
      reportModuleArb(status).map(mod => [key, mod] as [string, ReportModule])
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

describe('Property 4: 模块过滤正确性 (Module Filtering Correctness)', () => {
  it('includedModules only contains keys of modules with status "show"', () => {
    /**
     * **Validates: Requirements 5.6, 12.5**
     *
     * For any set of modules with mixed show/hide statuses,
     * the includedModules array should contain exactly the keys
     * of modules whose status is "show".
     */
    fc.assert(
      fc.property(moduleSetArb, metadataArb, (modules, metadata) => {
        const result = convertModulesToMarkdown(modules, metadata);

        // Compute expected included keys
        const expectedKeys = Object.entries(modules)
          .filter(([, mod]) => mod.status === 'show')
          .map(([key]) => key);

        // includedModules should contain exactly the "show" module keys
        expect(result.includedModules.sort()).toEqual(expectedKeys.sort());

        // No "hide" module key should appear in includedModules
        const hiddenKeys = Object.entries(modules)
          .filter(([, mod]) => mod.status === 'hide')
          .map(([key]) => key);

        for (const hiddenKey of hiddenKeys) {
          expect(result.includedModules).not.toContain(hiddenKey);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('markdown output does NOT contain any content from "hide" modules', () => {
    /**
     * **Validates: Requirements 5.6, 12.5**
     *
     * For any set of modules, the markdown output should not contain
     * the module heading (## key) for hidden modules. We use unique
     * marker content for hidden modules to ensure we can reliably
     * detect their absence in the output.
     */
    fc.assert(
      fc.property(
        metadataArb,
        fc.integer({ min: 1, max: 5 }),
        fc.integer({ min: 1, max: 5 }),
        (metadata, numShow, numHide) => {
          // Build modules with unique content for hidden ones
          const modules: Record<string, ReportModule> = {};

          // Create shown modules with generic content
          for (let i = 0; i < numShow; i++) {
            modules[`shown_module_${i}`] = {
              status: 'show',
              paragraphs: [{ content: `Shown content for module ${i}` }],
            };
          }

          // Create hidden modules with unique marker content
          for (let i = 0; i < numHide; i++) {
            const uniqueMarker = `HIDDEN_UNIQUE_MARKER_${i}_${Date.now()}`;
            modules[`hidden_module_${i}`] = {
              status: 'hide',
              paragraphs: [{ content: uniqueMarker }],
              tables: [{
                title: `Hidden Table ${i}`,
                headers: ['HiddenCol1', 'HiddenCol2'],
                rows: [[`hidden_val_${i}_a`, `hidden_val_${i}_b`]],
              }],
            };
          }

          const result = convertModulesToMarkdown(modules, metadata);

          // Verify hidden module headings are not in output
          for (let i = 0; i < numHide; i++) {
            expect(result.markdown).not.toContain(`## hidden_module_${i}`);
          }

          // Verify hidden module paragraph content is not in output
          for (const [key, mod] of Object.entries(modules)) {
            if (mod.status !== 'hide') continue;
            if (mod.paragraphs) {
              for (const para of mod.paragraphs) {
                expect(result.markdown).not.toContain(para.content);
              }
            }
            if (mod.tables) {
              for (const table of mod.tables) {
                for (const row of table.rows) {
                  const rowStr = `| ${row.join(' | ')} |`;
                  expect(result.markdown).not.toContain(rowStr);
                }
              }
            }
          }

          // Verify shown module headings ARE in output
          for (let i = 0; i < numShow; i++) {
            expect(result.markdown).toContain(`## shown_module_${i}`);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('markdown output DOES contain content from all "show" modules', () => {
    /**
     * **Validates: Requirements 5.6, 12.5**
     *
     * For any set of modules, the markdown output should contain
     * the heading, paragraph content, and table data from all modules
     * with status "show".
     */
    fc.assert(
      fc.property(moduleSetArb, metadataArb, (modules, metadata) => {
        const result = convertModulesToMarkdown(modules, metadata);

        for (const [key, mod] of Object.entries(modules)) {
          if (mod.status !== 'show') continue;

          // The module key should appear as a heading
          expect(result.markdown).toContain(`## ${key}`);

          // Paragraph content from shown modules should appear
          if (mod.paragraphs) {
            for (const para of mod.paragraphs) {
              if (para.content.trim().length > 0) {
                expect(result.markdown).toContain(para.content);
              }
            }
          }

          // Table headers from shown modules should appear
          if (mod.tables) {
            for (const table of mod.tables) {
              const headerRow = `| ${table.headers.join(' | ')} |`;
              expect(result.markdown).toContain(headerRow);

              // Table rows from shown modules should appear
              for (const row of table.rows) {
                const rowStr = `| ${row.join(' | ')} |`;
                expect(result.markdown).toContain(rowStr);
              }
            }
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  it('all-hide modules produce empty content (no module sections)', () => {
    /**
     * **Validates: Requirements 5.6, 12.5**
     *
     * When all modules have status "hide", the output should contain
     * only the metadata header and no module sections.
     */
    fc.assert(
      fc.property(
        fc.array(moduleKeyArb, { minLength: 1, maxLength: 6 }).chain(keys => {
          const uniqueKeys = [...new Set(keys)];
          const arbitraries = uniqueKeys.map(key =>
            reportModuleArb('hide').map(mod => [key, mod] as [string, ReportModule])
          );
          return fc.tuple(...(arbitraries as [fc.Arbitrary<[string, ReportModule]>, ...fc.Arbitrary<[string, ReportModule]>[]]));
        }).map(pairs => Object.fromEntries(pairs)),
        metadataArb,
        (modules, metadata) => {
          const result = convertModulesToMarkdown(modules, metadata);

          // No modules should be included
          expect(result.includedModules).toHaveLength(0);

          // No ## headings for modules should appear
          expect(result.markdown).not.toMatch(/^## /m);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('all-show modules are all included in output', () => {
    /**
     * **Validates: Requirements 5.6, 12.5**
     *
     * When all modules have status "show", every module key should
     * appear in includedModules and the markdown output.
     */
    fc.assert(
      fc.property(
        fc.array(moduleKeyArb, { minLength: 1, maxLength: 6 }).chain(keys => {
          const uniqueKeys = [...new Set(keys)];
          const arbitraries = uniqueKeys.map(key =>
            reportModuleArb('show').map(mod => [key, mod] as [string, ReportModule])
          );
          return fc.tuple(...(arbitraries as [fc.Arbitrary<[string, ReportModule]>, ...fc.Arbitrary<[string, ReportModule]>[]]));
        }).map(pairs => Object.fromEntries(pairs)),
        metadataArb,
        (modules, metadata) => {
          const result = convertModulesToMarkdown(modules, metadata);

          // All module keys should be included
          const allKeys = Object.keys(modules);
          expect(result.includedModules.sort()).toEqual(allKeys.sort());

          // All module headings should appear in markdown
          for (const key of allKeys) {
            expect(result.markdown).toContain(`## ${key}`);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
