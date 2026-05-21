/**
 * PDF Exporter using @react-pdf/renderer.
 *
 * Generates a PDF report with:
 * - Cover page with project metadata
 * - Module sections with headings, narratives, tables, and charts
 * - Template-driven styling (fonts, colors, margins)
 * - Hidden module exclusion and degraded module annotation
 * - 30-second timeout
 *
 * Uses React.createElement instead of JSX for compatibility with
 * the project's TypeScript configuration.
 */

import type {
  ReportContent,
  ReportModule as ReportModuleType,
  ReportTable,
  TemplateConfig,
} from './types.js';
import type { ChartImage } from './chart-renderer.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const PDF_TIMEOUT_MS = 30_000;
const DEGRADED_ANNOTATION = '⚠️ 数据不完整，部分指标可能缺失';

// ─── Lazy module loader (webpackIgnore keeps these out of webpack bundle) ────

let _pdfReady: Promise<void> | undefined;
let h: any;
let Document: any;
let Page: any;
let Text: any;
let View: any;
let Image: any;
let StyleSheet: any;
let renderToBuffer: any;

async function ensurePDFModule() {
  if (_pdfReady) return _pdfReady;
  _pdfReady = (async () => {
    const React = await import(/* webpackIgnore: true */ 'react');
    const PDF = await import(/* webpackIgnore: true */ '@react-pdf/renderer');
    h = React.createElement;
    Document = PDF.Document;
    Page = PDF.Page;
    Text = PDF.Text;
    View = PDF.View;
    Image = PDF.Image;
    StyleSheet = PDF.StyleSheet;
    renderToBuffer = PDF.renderToBuffer;

    // Register Chinese font for PDF rendering
    // Only attempt fonts that actually exist on this system
    try {
      PDF.Font.register({
        family: 'SimHei',
        fonts: [{ src: 'C:\\Windows\\Fonts\\simhei.ttf' }],
      });
    } catch {
      // Windows fonts not available (e.g. Linux/macOS/Vercel)
    }
  })();
  return _pdfReady;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Export report content to a PDF buffer.
 *
 * @param content - Report content with metadata and modules
 * @param charts - Chart PNG images to embed
 * @param template - Template configuration for styling
 * @param options - Export options (e.g., hidden columns)
 * @returns PDF file as a Buffer
 * @throws Error if generation exceeds 30 seconds
 */
export async function exportToPDF(
  content: ReportContent,
  charts: ChartImage[],
  template: TemplateConfig,
  options: { hiddenColumns?: Record<string, string[]> } = {}
): Promise<Buffer> {
  await ensurePDFModule();
  const styles = createStyles(template);

  // Filter out hidden modules
  const visibleModules = content.modules.filter((m) => m.status !== 'hide');

  // Build chart lookup by moduleId
  const chartsByModule = new Map<string, ChartImage[]>();
  for (const chart of charts) {
    const existing = chartsByModule.get(chart.moduleId) || [];
    existing.push(chart);
    chartsByModule.set(chart.moduleId, existing);
  }

  // Build the document using createElement
  const doc = buildDocument(visibleModules, chartsByModule, content, styles, options);

  // Render with timeout
  const buffer = await renderWithTimeout(doc, PDF_TIMEOUT_MS);
  return buffer;
}

// ─── Document Builder ────────────────────────────────────────────────────────

function buildDocument(
  visibleModules: ReportModuleType[],
  chartsByModule: Map<string, ChartImage[]>,
  content: ReportContent,
  styles: ReturnType<typeof createStyles>,
  options: { hiddenColumns?: Record<string, string[]> }
): React.ReactElement {
  // Cover page
  const coverPage = h(
    Page,
    { size: 'A4', style: styles.page },
    h(
      View,
      { style: styles.coverContainer },
      h(Text, { style: styles.coverTitle }, content.metadata.projectName),
      h(
        View,
        { style: styles.coverMeta },
        h(Text, { style: styles.coverMetaItem }, `品牌：${content.metadata.brand}`),
        h(Text, { style: styles.coverMetaItem }, `品类：${content.metadata.category}`),
        h(Text, { style: styles.coverMetaItem }, `项目类型：${content.metadata.projectType}`),
        h(
          Text,
          { style: styles.coverMetaItem },
          `生成日期：${formatDate(content.metadata.generatedAt)}`
        )
      )
    )
  );

  // Content pages with modules
  const moduleElements = visibleModules.map((module) =>
    buildModuleSection(
      module,
      chartsByModule.get(module.moduleId) || [],
      styles,
      options.hiddenColumns?.[module.moduleId]
    )
  );

  const contentPage = h(
    Page,
    { size: 'A4', style: styles.page, wrap: true },
    ...moduleElements
  );

  return h(Document, null, coverPage, contentPage);
}

function buildModuleSection(
  module: ReportModuleType,
  charts: ChartImage[],
  styles: ReturnType<typeof createStyles>,
  hiddenColumns?: string[]
): React.ReactElement {
  const children: React.ReactElement[] = [];

  // Module title
  children.push(h(Text, { style: styles.moduleTitle }, module.title));

  // Degraded annotation
  if (module.status === 'degraded') {
    children.push(
      h(
        View,
        { style: styles.degradedBadge },
        h(Text, { style: styles.degradedText }, DEGRADED_ANNOTATION)
      )
    );
  }

  // Narrative
  if (module.narrative) {
    children.push(h(Text, { style: styles.paragraph }, module.narrative));
  }

  // Tables
  if (module.tables) {
    for (const table of module.tables) {
      children.push(buildTable(table, styles, hiddenColumns));
    }
  }

  // Charts
  for (const chart of charts) {
    const imgWidth = Math.min(chart.width / 2, 456);
    const imgHeight = (chart.height / 2) * (imgWidth / (chart.width / 2));

    children.push(
      h(
        View,
        { style: styles.chartContainer },
        h(Image, {
          src: { data: chart.buffer, format: 'png' },
          style: { width: imgWidth, height: imgHeight },
        } as any)
      )
    );
  }

  return h(View, { style: styles.moduleContainer, wrap: false }, ...children);
}

function buildTable(
  table: ReportTable,
  styles: ReturnType<typeof createStyles>,
  hiddenColumns?: string[]
): React.ReactElement {
  // Determine which column indices to show
  const visibleIndices = table.headers
    .map((header, idx) => ({ header, idx }))
    .filter(({ header }) => !hiddenColumns?.includes(header))
    .map(({ idx }) => idx);

  const visibleHeaders = visibleIndices.map((i) => table.headers[i]);
  const visibleRows = table.rows.map((row) => visibleIndices.map((i) => row[i] ?? ''));

  const children: React.ReactElement[] = [];

  // Table title
  if (table.title) {
    children.push(h(Text, { style: styles.tableTitle }, table.title));
  }

  // Header row
  const headerCells = visibleHeaders.map((header) =>
    h(View, { style: styles.tableHeaderCell }, h(Text, { style: styles.tableHeaderText }, header))
  );
  children.push(h(View, { style: styles.tableHeaderRow }, ...headerCells));

  // Data rows with alternating colors
  for (let rowIdx = 0; rowIdx < visibleRows.length; rowIdx++) {
    const row = visibleRows[rowIdx];
    const rowStyle = rowIdx % 2 === 0 ? styles.tableRow : styles.tableRowAlt;
    const cells = row.map((cell) =>
      h(View, { style: styles.tableCell }, h(Text, { style: styles.tableCellText }, cell))
    );
    children.push(h(View, { style: rowStyle }, ...cells));
  }

  return h(View, { style: styles.tableContainer }, ...children);
}

// ─── Styles ──────────────────────────────────────────────────────────────────

function createStyles(template: TemplateConfig) {
  return StyleSheet.create({
    page: {
      paddingTop: template.margins.top,
      paddingBottom: template.margins.bottom,
      paddingLeft: template.margins.left,
      paddingRight: template.margins.right,
      fontFamily: template.fonts.body || 'Helvetica',
      fontSize: 10,
      color: template.colors.primary,
    },
    // Cover page
    coverContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    coverTitle: {
      fontSize: 28,
      fontWeight: 'bold',
      color: template.colors.primary,
      marginBottom: 40,
      textAlign: 'center',
    },
    coverMeta: {
      alignItems: 'center',
    },
    coverMetaItem: {
      fontSize: 14,
      color: template.colors.secondary,
      marginBottom: 12,
    },
    // Module sections
    moduleContainer: {
      marginBottom: template.spacing.paragraphSpacing * 2,
    },
    moduleTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      color: template.colors.primary,
      marginBottom: template.spacing.paragraphSpacing,
      borderBottomWidth: 1,
      borderBottomColor: template.colors.accent,
      paddingBottom: 4,
    },
    paragraph: {
      fontSize: 10,
      lineHeight: template.spacing.lineHeight,
      marginBottom: template.spacing.paragraphSpacing,
      color: template.colors.primary,
    },
    // Degraded badge
    degradedBadge: {
      backgroundColor: '#FFF3CD',
      borderWidth: 1,
      borderColor: '#FFEEBA',
      borderRadius: 4,
      padding: 6,
      marginBottom: 8,
    },
    degradedText: {
      fontSize: 9,
      color: '#856404',
    },
    // Tables
    tableContainer: {
      marginBottom: template.spacing.paragraphSpacing,
    },
    tableTitle: {
      fontSize: 11,
      fontWeight: 'bold',
      marginBottom: 4,
      color: template.colors.secondary,
    },
    tableHeaderRow: {
      flexDirection: 'row',
      backgroundColor: template.colors.primary,
      borderTopLeftRadius: 2,
      borderTopRightRadius: 2,
    },
    tableHeaderCell: {
      flex: 1,
      padding: 4,
    },
    tableHeaderText: {
      fontSize: 9,
      fontWeight: 'bold',
      color: '#FFFFFF',
    },
    tableRow: {
      flexDirection: 'row',
      backgroundColor: '#FFFFFF',
      borderBottomWidth: 0.5,
      borderBottomColor: '#E0E0E0',
    },
    tableRowAlt: {
      flexDirection: 'row',
      backgroundColor: '#F8F9FA',
      borderBottomWidth: 0.5,
      borderBottomColor: '#E0E0E0',
    },
    tableCell: {
      flex: 1,
      padding: 4,
    },
    tableCellText: {
      fontSize: 9,
      color: template.colors.primary,
    },
    // Charts
    chartContainer: {
      marginVertical: 8,
      alignItems: 'center',
    },
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(date: Date): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Render a React PDF document to buffer with a timeout.
 * Throws if rendering exceeds the specified timeout.
 */
async function renderWithTimeout(
  doc: React.ReactElement,
  timeoutMs: number
): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('PDF生成超时，请重试'));
    }, timeoutMs);

    renderToBuffer(doc as any)
      .then((result: Uint8Array) => {
        clearTimeout(timer);
        resolve(Buffer.from(result));
      })
      .catch((err: Error) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}
