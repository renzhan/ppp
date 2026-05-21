/**
 * Word (DOCX) Exporter using the `docx` library.
 *
 * Generates a Word document with:
 * - Cover page with project metadata (name, brand, category, type, date)
 * - Module sections with headings, narratives, tables, and embedded chart PNGs
 * - Template-driven styling (fonts, colors, margins)
 * - Hidden module exclusion and degraded module annotation
 * - Hidden column exclusion from tables
 * - Data tables with header styling and alternating row background colors
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 9.5
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  ImageRun,
  HeadingLevel,
  AlignmentType,
  WidthType,
  BorderStyle,
  ShadingType,
  PageNumber,
  NumberFormat,
  convertInchesToTwip,
  type ISectionOptions,
  type IRunOptions,
  type IParagraphOptions,
} from 'docx';
import type {
  ReportContent,
  ReportModule,
  ReportTable,
  TemplateConfig,
} from './types.js';
import type { ChartImage } from './chart-renderer.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const DEGRADED_ANNOTATION = '⚠️ 数据不完整，部分指标可能缺失';

/** Points to twips conversion (1 pt = 20 twips) */
const PT_TO_TWIP = 20;

/** Default chart width in EMU (English Metric Units). 1 inch = 914400 EMU */
const MAX_CHART_WIDTH_INCHES = 5.5;
const EMU_PER_INCH = 914400;

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Export report content to a Word (DOCX) buffer.
 *
 * @param content - Report content with metadata and modules
 * @param charts - Chart PNG images to embed
 * @param template - Template configuration for styling
 * @param options - Export options (e.g., hidden columns)
 * @returns DOCX file as a Buffer
 */
export async function exportToWord(
  content: ReportContent,
  charts: ChartImage[],
  template: TemplateConfig,
  options: { hiddenColumns?: Record<string, string[]> } = {}
): Promise<Buffer> {
  // Filter out hidden modules
  const visibleModules = content.modules.filter((m) => m.status !== 'hide');

  // Build chart lookup by moduleId
  const chartsByModule = new Map<string, ChartImage[]>();
  for (const chart of charts) {
    const existing = chartsByModule.get(chart.moduleId) || [];
    existing.push(chart);
    chartsByModule.set(chart.moduleId, existing);
  }

  // Build document sections
  const coverSection = buildCoverSection(content, template);
  const contentSection = buildContentSection(
    visibleModules,
    chartsByModule,
    template,
    options.hiddenColumns
  );

  const doc = new Document({
    styles: buildDocStyles(template),
    sections: [coverSection, contentSection],
  });

  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}

// ─── Cover Page ──────────────────────────────────────────────────────────────

function buildCoverSection(
  content: ReportContent,
  template: TemplateConfig
): ISectionOptions {
  const { metadata } = content;

  return {
    properties: {
      page: {
        margin: {
          top: template.margins.top * PT_TO_TWIP,
          bottom: template.margins.bottom * PT_TO_TWIP,
          left: template.margins.left * PT_TO_TWIP,
          right: template.margins.right * PT_TO_TWIP,
        },
      },
    },
    children: [
      // Spacer
      new Paragraph({ spacing: { before: 4000 } }),
      // Project name (title)
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 600 },
        children: [
          new TextRun({
            text: metadata.projectName,
            bold: true,
            size: 56, // 28pt
            font: template.fonts.heading,
            color: template.colors.primary.replace('#', ''),
          }),
        ],
      }),
      // Subtitle line
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [
          new TextRun({
            text: '营销复盘报告',
            size: 32, // 16pt
            font: template.fonts.body,
            color: template.colors.secondary.replace('#', ''),
          }),
        ],
      }),
      // Spacer
      new Paragraph({ spacing: { before: 1200 } }),
      // Metadata items
      buildCoverMetaLine(`品牌：${metadata.brand}`, template),
      buildCoverMetaLine(`品类：${metadata.category}`, template),
      buildCoverMetaLine(`项目类型：${metadata.projectType}`, template),
      buildCoverMetaLine(`生成日期：${formatDate(metadata.generatedAt)}`, template),
    ],
  };
}

function buildCoverMetaLine(text: string, template: TemplateConfig): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [
      new TextRun({
        text,
        size: 24, // 12pt
        font: template.fonts.body,
        color: template.colors.secondary.replace('#', ''),
      }),
    ],
  });
}

// ─── Content Section ─────────────────────────────────────────────────────────

function buildContentSection(
  modules: ReportModule[],
  chartsByModule: Map<string, ChartImage[]>,
  template: TemplateConfig,
  hiddenColumns?: Record<string, string[]>
): ISectionOptions {
  const children: (Paragraph | Table)[] = [];

  for (const module of modules) {
    const moduleElements = buildModuleElements(
      module,
      chartsByModule.get(module.moduleId) || [],
      template,
      hiddenColumns?.[module.moduleId]
    );
    children.push(...moduleElements);
  }

  return {
    properties: {
      page: {
        margin: {
          top: template.margins.top * PT_TO_TWIP,
          bottom: template.margins.bottom * PT_TO_TWIP,
          left: template.margins.left * PT_TO_TWIP,
          right: template.margins.right * PT_TO_TWIP,
        },
        pageNumbers: {
          start: 1,
          formatType: NumberFormat.DECIMAL,
        },
      },
    },
    footers: {
      default: {
        options: {
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  children: [PageNumber.CURRENT],
                  size: 18,
                  font: template.fonts.body,
                  color: '999999',
                }),
              ],
            }),
          ],
        },
      },
    },
    children,
  };
}

// ─── Module Builder ──────────────────────────────────────────────────────────

function buildModuleElements(
  module: ReportModule,
  charts: ChartImage[],
  template: TemplateConfig,
  hiddenColumns?: string[]
): (Paragraph | Table)[] {
  const elements: (Paragraph | Table)[] = [];

  // Module heading
  elements.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 400, after: 200 },
      children: [
        new TextRun({
          text: module.title,
          bold: true,
          size: 28, // 14pt
          font: template.fonts.heading,
          color: template.colors.primary.replace('#', ''),
        }),
      ],
    })
  );

  // Degraded annotation
  if (module.status === 'degraded') {
    elements.push(
      new Paragraph({
        spacing: { after: 200 },
        shading: {
          type: ShadingType.CLEAR,
          fill: 'FFF3CD',
        },
        children: [
          new TextRun({
            text: DEGRADED_ANNOTATION,
            size: 20, // 10pt
            font: template.fonts.body,
            color: '856404',
            italics: true,
          }),
        ],
      })
    );
  }

  // Narrative
  if (module.narrative) {
    elements.push(
      new Paragraph({
        spacing: {
          after: template.spacing.paragraphSpacing * PT_TO_TWIP,
          line: Math.round(template.spacing.lineHeight * 240),
        },
        children: [
          new TextRun({
            text: module.narrative,
            size: 21, // ~10.5pt
            font: template.fonts.body,
            color: template.colors.primary.replace('#', ''),
          }),
        ],
      })
    );
  }

  // Tables
  if (module.tables) {
    for (const table of module.tables) {
      const tableElements = buildTableElements(table, template, hiddenColumns);
      elements.push(...tableElements);
    }
  }

  // Charts (embed PNG images)
  for (const chart of charts) {
    const chartParagraph = buildChartParagraph(chart);
    if (chartParagraph) {
      elements.push(chartParagraph);
    }
  }

  // Spacing after module
  elements.push(new Paragraph({ spacing: { after: 400 } }));

  return elements;
}

// ─── Table Builder ───────────────────────────────────────────────────────────

function buildTableElements(
  table: ReportTable,
  template: TemplateConfig,
  hiddenColumns?: string[]
): (Paragraph | Table)[] {
  const elements: (Paragraph | Table)[] = [];

  // Determine visible columns
  const visibleIndices = table.headers
    .map((header, idx) => ({ header, idx }))
    .filter(({ header }) => !hiddenColumns?.includes(header))
    .map(({ idx }) => idx);

  if (visibleIndices.length === 0) {
    return elements;
  }

  const visibleHeaders = visibleIndices.map((i) => table.headers[i]);
  const visibleRows = table.rows.map((row) =>
    visibleIndices.map((i) => row[i] ?? '')
  );

  // Table title
  if (table.title) {
    elements.push(
      new Paragraph({
        spacing: { before: 200, after: 100 },
        children: [
          new TextRun({
            text: table.title,
            bold: true,
            size: 22, // 11pt
            font: template.fonts.body,
            color: template.colors.secondary.replace('#', ''),
          }),
        ],
      })
    );
  }

  // Build table rows
  const tableRows: TableRow[] = [];

  // Header row
  const headerCells = visibleHeaders.map(
    (header) =>
      new TableCell({
        shading: {
          type: ShadingType.CLEAR,
          fill: template.colors.primary.replace('#', ''),
        },
        children: [
          new Paragraph({
            spacing: { before: 40, after: 40 },
            children: [
              new TextRun({
                text: header,
                bold: true,
                size: 18, // 9pt
                font: template.fonts.body,
                color: 'FFFFFF',
              }),
            ],
          }),
        ],
      })
  );
  tableRows.push(new TableRow({ children: headerCells }));

  // Data rows with alternating background
  for (let rowIdx = 0; rowIdx < visibleRows.length; rowIdx++) {
    const row = visibleRows[rowIdx];
    const isAlt = rowIdx % 2 === 1;
    const fillColor = isAlt ? 'F8F9FA' : 'FFFFFF';

    const cells = row.map(
      (cellValue) =>
        new TableCell({
          shading: {
            type: ShadingType.CLEAR,
            fill: fillColor,
          },
          children: [
            new Paragraph({
              spacing: { before: 40, after: 40 },
              children: [
                new TextRun({
                  text: cellValue,
                  size: 18, // 9pt
                  font: template.fonts.body,
                  color: template.colors.primary.replace('#', ''),
                }),
              ],
            }),
          ],
        })
    );
    tableRows.push(new TableRow({ children: cells }));
  }

  // Create the table
  const docTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: tableRows,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: 'E0E0E0' },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: 'E0E0E0' },
      left: { style: BorderStyle.SINGLE, size: 1, color: 'E0E0E0' },
      right: { style: BorderStyle.SINGLE, size: 1, color: 'E0E0E0' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'E0E0E0' },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'E0E0E0' },
    },
  });

  elements.push(docTable);

  // Spacing after table
  elements.push(new Paragraph({ spacing: { after: 200 } }));

  return elements;
}

// ─── Chart Embedding ─────────────────────────────────────────────────────────

function buildChartParagraph(chart: ChartImage): Paragraph | null {
  if (!chart.buffer || chart.buffer.length === 0) {
    return null;
  }

  // Calculate dimensions to fit within page width
  const maxWidthEmu = MAX_CHART_WIDTH_INCHES * EMU_PER_INCH;
  const aspectRatio = chart.height / chart.width;

  let widthEmu = chart.width * (EMU_PER_INCH / 150); // Convert from pixels at 150 DPI
  if (widthEmu > maxWidthEmu) {
    widthEmu = maxWidthEmu;
  }
  const heightEmu = widthEmu * aspectRatio;

  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 200 },
    children: [
      new ImageRun({
        data: chart.buffer,
        transformation: {
          width: Math.round(widthEmu / EMU_PER_INCH * 96), // Convert to pixels for docx lib
          height: Math.round(heightEmu / EMU_PER_INCH * 96),
        },
        type: 'png',
      }),
    ],
  });
}

// ─── Document Styles ─────────────────────────────────────────────────────────

function buildDocStyles(template: TemplateConfig) {
  return {
    default: {
      document: {
        run: {
          font: template.fonts.body,
          size: 21, // ~10.5pt
          color: template.colors.primary.replace('#', ''),
        },
        paragraph: {
          spacing: {
            line: Math.round(template.spacing.lineHeight * 240),
            after: template.spacing.paragraphSpacing * PT_TO_TWIP,
          },
        },
      },
      heading2: {
        run: {
          font: template.fonts.heading,
          size: 28,
          bold: true,
          color: template.colors.primary.replace('#', ''),
        },
        paragraph: {
          spacing: { before: 400, after: 200 },
        },
      },
    },
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(date: Date): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
