/**
 * Server-side chart renderer using @napi-rs/canvas.
 * Renders chart data to PNG images for embedding in PDF/Word exports.
 *
 * Supports chart types: pie, bar, line, radar, funnel
 */

let _canvasModule: { createCanvas: Function } | undefined;

async function getCanvas() {
  if (!_canvasModule) {
    _canvasModule = await import(/* webpackIgnore: true */ '@napi-rs/canvas');
  }
  return _canvasModule as unknown as { createCanvas: (w: number, h: number) => { getContext: (type: string) => CanvasRenderingContext2D; toBuffer: (mime: string) => Buffer } };
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ChartImage {
  moduleId: string;
  chartType: 'pie' | 'bar' | 'line' | 'radar' | 'funnel';
  buffer: Buffer;
  width: number;
  height: number;
}

export interface ChartRenderOptions {
  width?: number;   // default 600px
  height?: number;  // default 400px
  dpi?: number;     // default 150
  scale?: number;   // default 2 (retina)
}

export interface ChartDataEntry {
  label: string;
  value: number;
  color?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const SUPPORTED_CHART_TYPES = ['pie', 'bar', 'line', 'radar', 'funnel'] as const;
type SupportedChartType = (typeof SUPPORTED_CHART_TYPES)[number];

/** A4 page available width at 150 DPI with 72pt margins: (210mm - 2*25.4mm) * 150/25.4 ≈ 940px at 150 DPI.
 *  But at scale=2, the logical width is half. We use 456px as the max logical width constraint. */
const MAX_PAGE_WIDTH_PX = 456;
const DEFAULT_WIDTH = 600;
const DEFAULT_HEIGHT = 400;
const DEFAULT_DPI = 150;
const DEFAULT_SCALE = 2;
const MIN_DPI = 150;

// Default color palette for charts
const DEFAULT_COLORS = [
  '#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f',
  '#edc948', '#b07aa1', '#ff9da7', '#9c755f', '#bab0ac',
];

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Render a single chart to a PNG image buffer.
 *
 * @param chartType - One of: pie, bar, line, radar, funnel
 * @param data - Chart data. Expected shape: { entries: ChartDataEntry[], title?: string }
 * @param options - Render options (width, height, dpi, scale)
 * @returns ChartImage with PNG buffer
 */
export async function renderChartToImage(
  chartType: string,
  data: Record<string, unknown>,
  options?: ChartRenderOptions
): Promise<ChartImage> {
  const type = validateChartType(chartType);
  const entries = extractEntries(data);

  const resolvedOptions = resolveOptions(options);
  const { logicalWidth, logicalHeight, scale } = resolvedOptions;

  // Create canvas at scaled resolution for high DPI
  const canvasWidth = logicalWidth * scale;
  const canvasHeight = logicalHeight * scale;
  const { createCanvas } = await getCanvas();
  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext('2d');

  // Scale context for retina rendering
  ctx.scale(scale, scale);

  // White background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, logicalWidth, logicalHeight);

  // Draw title if provided
  const title = typeof data.title === 'string' ? data.title : undefined;
  const chartArea = drawTitle(ctx, title, logicalWidth, logicalHeight);

  // Render chart based on type
  switch (type) {
    case 'pie':
      drawPieChart(ctx, entries, chartArea);
      break;
    case 'bar':
      drawBarChart(ctx, entries, chartArea);
      break;
    case 'line':
      drawLineChart(ctx, entries, chartArea);
      break;
    case 'radar':
      drawRadarChart(ctx, entries, chartArea);
      break;
    case 'funnel':
      drawFunnelChart(ctx, entries, chartArea);
      break;
  }

  const buffer = Buffer.from(canvas.toBuffer('image/png'));

  return {
    moduleId: typeof data.moduleId === 'string' ? data.moduleId : '',
    chartType: type,
    buffer,
    width: canvasWidth,
    height: canvasHeight,
  };
}

/**
 * Render all charts for a given module.
 * Returns empty array if the module has no chart data.
 *
 * @param moduleId - The module identifier
 * @param moduleData - Module data containing chart configurations
 * @returns Array of ChartImage (empty if no chart data)
 */
export async function renderModuleCharts(
  moduleId: string,
  moduleData: Record<string, unknown>
): Promise<ChartImage[]> {
  const charts = extractModuleCharts(moduleData);

  if (charts.length === 0) {
    return [];
  }

  const results: ChartImage[] = [];

  for (const chart of charts) {
    try {
      const image = await renderChartToImage(chart.chartType, {
        ...chart.data,
        moduleId,
      });
      results.push(image);
    } catch {
      // Skip charts that fail to render (per error handling spec)
      continue;
    }
  }

  return results;
}

// ─── Internal Helpers ────────────────────────────────────────────────────────

interface ResolvedOptions {
  logicalWidth: number;
  logicalHeight: number;
  scale: number;
  dpi: number;
}

interface ChartArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ModuleChart {
  chartType: string;
  data: Record<string, unknown>;
}

function validateChartType(chartType: string): SupportedChartType {
  const normalized = chartType.toLowerCase().trim();
  if (!SUPPORTED_CHART_TYPES.includes(normalized as SupportedChartType)) {
    throw new Error(
      `Unsupported chart type: "${chartType}". Supported types: ${SUPPORTED_CHART_TYPES.join(', ')}`
    );
  }
  return normalized as SupportedChartType;
}

function resolveOptions(options?: ChartRenderOptions): ResolvedOptions {
  const dpi = Math.max(options?.dpi ?? DEFAULT_DPI, MIN_DPI);
  const scale = options?.scale ?? DEFAULT_SCALE;
  const requestedWidth = options?.width ?? DEFAULT_WIDTH;
  const requestedHeight = options?.height ?? DEFAULT_HEIGHT;

  // Constrain width to page available width
  const logicalWidth = Math.min(requestedWidth, MAX_PAGE_WIDTH_PX);
  // Scale height proportionally if width was constrained
  const logicalHeight =
    requestedWidth > MAX_PAGE_WIDTH_PX
      ? Math.round(requestedHeight * (MAX_PAGE_WIDTH_PX / requestedWidth))
      : requestedHeight;

  return { logicalWidth, logicalHeight, scale, dpi };
}

function extractEntries(data: Record<string, unknown>): ChartDataEntry[] {
  if (Array.isArray(data.entries)) {
    return data.entries.map((entry: unknown, index: number) => {
      if (typeof entry === 'object' && entry !== null) {
        const e = entry as Record<string, unknown>;
        return {
          label: String(e.label ?? `Item ${index + 1}`),
          value: Number(e.value ?? 0),
          color: typeof e.color === 'string' ? e.color : undefined,
        };
      }
      return { label: `Item ${index + 1}`, value: Number(entry ?? 0) };
    });
  }

  // Try to extract from data/labels/values pattern
  if (Array.isArray(data.labels) && Array.isArray(data.values)) {
    const labels = data.labels as string[];
    const values = data.values as number[];
    return labels.map((label, i) => ({
      label: String(label),
      value: Number(values[i] ?? 0),
    }));
  }

  return [];
}

function extractModuleCharts(moduleData: Record<string, unknown>): ModuleChart[] {
  // Check for explicit charts array
  if (Array.isArray(moduleData.charts)) {
    return moduleData.charts.filter((chart: unknown) => {
      if (typeof chart !== 'object' || chart === null) return false;
      const c = chart as Record<string, unknown>;
      return typeof c.chartType === 'string' && c.data != null;
    }) as ModuleChart[];
  }

  // Check for single chart configuration
  if (typeof moduleData.chartType === 'string' && moduleData.data != null) {
    return [{ chartType: moduleData.chartType, data: moduleData.data as Record<string, unknown> }];
  }

  // No chart data found
  return [];
}

function getColor(index: number, entry?: ChartDataEntry): string {
  return entry?.color ?? DEFAULT_COLORS[index % DEFAULT_COLORS.length];
}

function drawTitle(
  ctx: CanvasRenderingContext2D,
  title: string | undefined,
  width: number,
  height: number
): ChartArea {
  const padding = 20;
  let topOffset = padding;

  if (title) {
    ctx.fillStyle = '#333333';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, width / 2, topOffset + 14);
    topOffset += 30;
  }

  return {
    x: padding,
    y: topOffset,
    width: width - padding * 2,
    height: height - topOffset - padding,
  };
}

// ─── Chart Drawing Functions ─────────────────────────────────────────────────

function drawPieChart(
  ctx: CanvasRenderingContext2D,
  entries: ChartDataEntry[],
  area: ChartArea
): void {
  if (entries.length === 0) return;

  const total = entries.reduce((sum, e) => sum + Math.abs(e.value), 0);
  if (total === 0) return;

  const centerX = area.x + area.width * 0.4;
  const centerY = area.y + area.height / 2;
  const radius = Math.min(area.width * 0.35, area.height * 0.45);

  let startAngle = -Math.PI / 2;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const sliceAngle = (Math.abs(entry.value) / total) * Math.PI * 2;

    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
    ctx.closePath();
    ctx.fillStyle = getColor(i, entry);
    ctx.fill();

    // Slice border
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    startAngle += sliceAngle;
  }

  // Legend
  drawLegend(ctx, entries, area.x + area.width * 0.7, area.y + 10, area.height);
}

function drawBarChart(
  ctx: CanvasRenderingContext2D,
  entries: ChartDataEntry[],
  area: ChartArea
): void {
  if (entries.length === 0) return;

  const maxValue = Math.max(...entries.map((e) => Math.abs(e.value)), 1);
  const barWidth = Math.min(40, (area.width - 40) / entries.length - 10);
  const chartHeight = area.height - 30; // Leave room for labels

  // Draw axes
  ctx.strokeStyle = '#cccccc';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(area.x, area.y + chartHeight);
  ctx.lineTo(area.x + area.width, area.y + chartHeight);
  ctx.stroke();

  const totalBarsWidth = entries.length * (barWidth + 10) - 10;
  const startX = area.x + (area.width - totalBarsWidth) / 2;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const barHeight = (Math.abs(entry.value) / maxValue) * (chartHeight - 10);
    const x = startX + i * (barWidth + 10);
    const y = area.y + chartHeight - barHeight;

    ctx.fillStyle = getColor(i, entry);
    ctx.fillRect(x, y, barWidth, barHeight);

    // Label
    ctx.fillStyle = '#666666';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    const labelText = entry.label.length > 6 ? entry.label.slice(0, 6) + '…' : entry.label;
    ctx.fillText(labelText, x + barWidth / 2, area.y + chartHeight + 15);
  }
}

function drawLineChart(
  ctx: CanvasRenderingContext2D,
  entries: ChartDataEntry[],
  area: ChartArea
): void {
  if (entries.length < 2) return;

  const maxValue = Math.max(...entries.map((e) => e.value), 1);
  const minValue = Math.min(...entries.map((e) => e.value), 0);
  const range = maxValue - minValue || 1;
  const chartHeight = area.height - 30;
  const chartWidth = area.width - 20;

  // Draw axes
  ctx.strokeStyle = '#cccccc';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(area.x + 10, area.y + chartHeight);
  ctx.lineTo(area.x + 10 + chartWidth, area.y + chartHeight);
  ctx.stroke();

  // Draw line
  ctx.strokeStyle = DEFAULT_COLORS[0];
  ctx.lineWidth = 2;
  ctx.beginPath();

  const points: Array<{ x: number; y: number }> = [];

  for (let i = 0; i < entries.length; i++) {
    const x = area.x + 10 + (i / (entries.length - 1)) * chartWidth;
    const y = area.y + chartHeight - ((entries[i].value - minValue) / range) * (chartHeight - 10);
    points.push({ x, y });

    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();

  // Draw points
  for (const point of points) {
    ctx.beginPath();
    ctx.arc(point.x, point.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = DEFAULT_COLORS[0];
    ctx.fill();
  }

  // X-axis labels
  ctx.fillStyle = '#666666';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  for (let i = 0; i < entries.length; i++) {
    const x = area.x + 10 + (i / (entries.length - 1)) * chartWidth;
    const labelText =
      entries[i].label.length > 6 ? entries[i].label.slice(0, 6) + '…' : entries[i].label;
    ctx.fillText(labelText, x, area.y + chartHeight + 15);
  }
}

function drawRadarChart(
  ctx: CanvasRenderingContext2D,
  entries: ChartDataEntry[],
  area: ChartArea
): void {
  if (entries.length < 3) return;

  const centerX = area.x + area.width / 2;
  const centerY = area.y + area.height / 2;
  const radius = Math.min(area.width, area.height) * 0.35;
  const maxValue = Math.max(...entries.map((e) => Math.abs(e.value)), 1);
  const n = entries.length;

  // Draw grid circles
  ctx.strokeStyle = '#e0e0e0';
  ctx.lineWidth = 0.5;
  for (let level = 1; level <= 4; level++) {
    const r = (radius * level) / 4;
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
      const x = centerX + r * Math.cos(angle);
      const y = centerY + r * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Draw axes
  ctx.strokeStyle = '#cccccc';
  ctx.lineWidth = 1;
  for (let i = 0; i < n; i++) {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(centerX + radius * Math.cos(angle), centerY + radius * Math.sin(angle));
    ctx.stroke();
  }

  // Draw data polygon
  ctx.beginPath();
  ctx.fillStyle = 'rgba(78, 121, 167, 0.3)';
  ctx.strokeStyle = DEFAULT_COLORS[0];
  ctx.lineWidth = 2;

  for (let i = 0; i <= n; i++) {
    const idx = i % n;
    const angle = (Math.PI * 2 * idx) / n - Math.PI / 2;
    const value = Math.abs(entries[idx].value) / maxValue;
    const x = centerX + radius * value * Math.cos(angle);
    const y = centerY + radius * value * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.fill();
  ctx.stroke();

  // Labels
  ctx.fillStyle = '#333333';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  for (let i = 0; i < n; i++) {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const labelRadius = radius + 15;
    const x = centerX + labelRadius * Math.cos(angle);
    const y = centerY + labelRadius * Math.sin(angle);
    ctx.fillText(entries[i].label, x, y + 4);
  }
}

function drawFunnelChart(
  ctx: CanvasRenderingContext2D,
  entries: ChartDataEntry[],
  area: ChartArea
): void {
  if (entries.length === 0) return;

  const maxValue = Math.max(...entries.map((e) => Math.abs(e.value)), 1);
  const stepHeight = (area.height - 10) / entries.length;
  const maxWidth = area.width * 0.8;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const widthRatio = Math.abs(entry.value) / maxValue;
    const currentWidth = maxWidth * widthRatio;
    const nextWidthRatio =
      i < entries.length - 1 ? Math.abs(entries[i + 1].value) / maxValue : widthRatio * 0.6;
    const nextWidth = maxWidth * nextWidthRatio;

    const x1 = area.x + (area.width - currentWidth) / 2;
    const x2 = area.x + (area.width + currentWidth) / 2;
    const x3 = area.x + (area.width + nextWidth) / 2;
    const x4 = area.x + (area.width - nextWidth) / 2;
    const y1 = area.y + i * stepHeight;
    const y2 = area.y + (i + 1) * stepHeight;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y1);
    ctx.lineTo(x3, y2);
    ctx.lineTo(x4, y2);
    ctx.closePath();
    ctx.fillStyle = getColor(i, entry);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Label
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(entry.label, area.x + area.width / 2, y1 + stepHeight / 2 + 4);
  }
}

function drawLegend(
  ctx: CanvasRenderingContext2D,
  entries: ChartDataEntry[],
  x: number,
  y: number,
  maxHeight: number
): void {
  const lineHeight = 18;
  const maxItems = Math.floor(maxHeight / lineHeight);

  ctx.font = '10px sans-serif';
  ctx.textAlign = 'left';

  const itemsToShow = entries.slice(0, maxItems);

  for (let i = 0; i < itemsToShow.length; i++) {
    const entry = itemsToShow[i];
    const itemY = y + i * lineHeight;

    // Color box
    ctx.fillStyle = getColor(i, entry);
    ctx.fillRect(x, itemY, 10, 10);

    // Label
    ctx.fillStyle = '#333333';
    const labelText = entry.label.length > 10 ? entry.label.slice(0, 10) + '…' : entry.label;
    ctx.fillText(labelText, x + 14, itemY + 9);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CanvasRenderingContext2D = any;
