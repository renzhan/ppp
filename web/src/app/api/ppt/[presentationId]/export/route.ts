import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

const PRESENTON_INTERNAL_URL = process.env.PRESENTON_INTERNAL_URL || 'http://localhost:8000';

/**
 * POST /api/ppt/[presentationId]/export?format=pptx|pdf
 *
 * 导出 PPTX/PDF 文件
 * 方案 A：使用 pptxgenjs 在服务端直接从 slides JSON 生成 PPTX
 * PDF 通过先生成 PPTX 再用 LibreOffice 转换
 */
export const maxDuration = 120;

interface SlideContent {
  title?: string;
  body?: string;
  content?: string;
  bullets?: Array<{ title?: string; description?: string; icon?: string }>;
  metrics?: Array<{ label?: string; value?: string; description?: string }>;
  headers?: string[];
  rows?: string[][];
  items?: Array<{ title?: string; description?: string }>;
  chartData?: Array<{ label?: string; value?: number }>;
  presenterName?: string;
  presentationDate?: string;
  description?: string;
  type?: string;
  [key: string]: unknown;
}

interface PresentationSlide {
  index: number;
  type: string;
  content: SlideContent;
  layout?: string;
  speaker_note?: string;
}

interface PresentationData {
  id: string;
  title: string;
  slides: PresentationSlide[];
}

export async function POST(
  request: NextRequest,
  { params }: { params: { presentationId: string } }
) {
  const session = await getSession(request);
  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }

  const url = new URL(request.url);
  const format = url.searchParams.get('format') || 'pptx';

  try {
    // 1. 从 presenton-api 获取 presentation 数据
    const presRes = await fetch(
      `${PRESENTON_INTERNAL_URL}/api/v1/ppt/presentation/${params.presentationId}`,
      { headers: { 'Accept': 'application/json' } }
    );

    if (!presRes.ok) {
      const errText = await presRes.text().catch(() => '');
      return NextResponse.json(
        { error: `获取演示文稿失败: ${errText}` },
        { status: presRes.status }
      );
    }

    const presData: PresentationData = await presRes.json();
    const slides = presData.slides || [];

    if (slides.length === 0) {
      return NextResponse.json({ error: '演示文稿没有幻灯片' }, { status: 400 });
    }

    // 2. 使用 pptxgenjs 生成 PPTX
    const pptxBuffer = await generatePptxFromSlides(presData.title, slides);

    if (format === 'pdf') {
      // 3a. PDF: 用 LibreOffice 转换 PPTX → PDF
      const pdfBuffer = await convertPptxToPdf(pptxBuffer, presData.title);
      return new Response(new Uint8Array(pdfBuffer), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(presData.title || 'presentation')}.pdf"`,
        },
      });
    }

    // 3b. PPTX: 直接返回
    return new Response(new Uint8Array(pptxBuffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(presData.title || 'presentation')}.pptx"`,
      },
    });
  } catch (error: unknown) {
    console.error('PPT export error:', error);
    const message = error instanceof Error ? error.message : '导出失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// 兼容 GET 请求（前端可能用 GET）
export async function GET(
  request: NextRequest,
  { params }: { params: { presentationId: string } }
) {
  return POST(request, { params });
}

async function generatePptxFromSlides(
  title: string,
  slides: PresentationSlide[]
): Promise<Buffer> {
  // Dynamic import to avoid issues with ESM/CJS
  const PptxGenJS = (await import('pptxgenjs')).default;
  const pptx = new PptxGenJS();

  pptx.title = title;
  pptx.layout = 'LAYOUT_WIDE'; // 16:9

  for (const slide of slides) {
    const pptSlide = pptx.addSlide();
    const content = slide.content || {};

    // 根据 slide 内容类型渲染
    if (slide.layout?.includes('intro') || slide.index === 0) {
      renderIntroSlide(pptSlide, content, title);
    } else if (content.headers && content.rows) {
      renderTableSlide(pptSlide, content);
    } else if (content.metrics && Array.isArray(content.metrics)) {
      renderMetricsSlide(pptSlide, content);
    } else if (content.bullets && Array.isArray(content.bullets)) {
      renderBulletsSlide(pptSlide, content);
    } else if (content.items && Array.isArray(content.items)) {
      renderItemsSlide(pptSlide, content);
    } else if (content.chartData && Array.isArray(content.chartData)) {
      renderChartSlide(pptSlide, content);
    } else {
      renderTextSlide(pptSlide, content);
    }

    // Speaker notes
    if (slide.speaker_note) {
      pptSlide.addNotes(slide.speaker_note);
    }
  }

  // Generate as Buffer
  const output = await pptx.write({ outputType: 'nodebuffer' });
  return Buffer.from(output as ArrayBuffer);
}

function renderIntroSlide(slide: any, content: SlideContent, fallbackTitle: string) {
  slide.background = { color: '1a1a2e' };
  slide.addText(content.title || fallbackTitle, {
    x: 0.8, y: 2.0, w: '85%', h: 1.5,
    fontSize: 32, bold: true, color: 'FFFFFF',
    align: 'center', valign: 'middle',
  });
  if (content.description) {
    slide.addText(content.description, {
      x: 0.8, y: 3.5, w: '85%', h: 0.8,
      fontSize: 14, color: 'CCCCCC', align: 'center',
    });
  }
  if (content.presenterName || content.presentationDate) {
    const info = [content.presenterName, content.presentationDate].filter(Boolean).join(' | ');
    slide.addText(info, {
      x: 0.8, y: 4.5, w: '85%', h: 0.5,
      fontSize: 12, color: '999999', align: 'center',
    });
  }
}

function renderTableSlide(slide: any, content: SlideContent) {
  if (content.title) {
    slide.addText(content.title, {
      x: 0.5, y: 0.3, w: '90%', h: 0.6,
      fontSize: 20, bold: true, color: '333333',
    });
  }

  const headers = content.headers || [];
  const rows = content.rows || [];

  if (headers.length > 0) {
    const tableRows: any[][] = [];
    // Header row
    tableRows.push(
      headers.map(h => ({ text: h, options: { bold: true, color: 'FFFFFF', fill: { color: '4472C4' } } }))
    );
    // Data rows
    for (const row of rows) {
      tableRows.push(row.map(cell => ({ text: cell || '' })));
    }

    slide.addTable(tableRows, {
      x: 0.5, y: 1.0, w: 12.3,
      fontSize: 10,
      border: { type: 'solid', pt: 0.5, color: 'CCCCCC' },
      colW: headers.map(() => 12.3 / headers.length),
      autoPage: true,
    });
  }
}

function renderMetricsSlide(slide: any, content: SlideContent) {
  if (content.title) {
    slide.addText(content.title, {
      x: 0.5, y: 0.3, w: '90%', h: 0.6,
      fontSize: 20, bold: true, color: '333333',
    });
  }

  const metrics = content.metrics || [];
  const cols = Math.min(metrics.length, 4);
  const cardWidth = 12 / cols;

  metrics.forEach((metric, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = 0.5 + col * cardWidth;
    const y = 1.2 + row * 2.2;

    slide.addShape('rect', {
      x, y, w: cardWidth - 0.3, h: 1.8,
      fill: { color: 'F5F5F5' }, line: { color: 'E0E0E0', width: 1 },
      rectRadius: 0.05,
    });
    slide.addText(metric.value || '', {
      x, y: y + 0.2, w: cardWidth - 0.3, h: 0.8,
      fontSize: 24, bold: true, color: '4472C4', align: 'center',
    });
    slide.addText(metric.label || '', {
      x, y: y + 1.0, w: cardWidth - 0.3, h: 0.5,
      fontSize: 11, color: '666666', align: 'center',
    });
  });
}

function renderBulletsSlide(slide: any, content: SlideContent) {
  if (content.title) {
    slide.addText(content.title, {
      x: 0.5, y: 0.3, w: '90%', h: 0.6,
      fontSize: 20, bold: true, color: '333333',
    });
  }

  const bullets = content.bullets || [];
  const textItems = bullets.map(b => ({
    text: `${b.title || ''}${b.description ? ': ' + b.description : ''}`,
    options: { bullet: true, fontSize: 13, color: '444444', breakLine: true },
  }));

  slide.addText(textItems, {
    x: 0.8, y: 1.2, w: '85%', h: 5.0,
    valign: 'top', paraSpaceAfter: 8,
  });
}

function renderItemsSlide(slide: any, content: SlideContent) {
  if (content.title) {
    slide.addText(content.title, {
      x: 0.5, y: 0.3, w: '90%', h: 0.6,
      fontSize: 20, bold: true, color: '333333',
    });
  }

  const items = content.items || [];
  const textItems = items.map((item, i) => ({
    text: `${i + 1}. ${item.title || ''}${item.description ? ' — ' + item.description : ''}`,
    options: { fontSize: 13, color: '444444', breakLine: true },
  }));

  slide.addText(textItems, {
    x: 0.8, y: 1.2, w: '85%', h: 5.0,
    valign: 'top', paraSpaceAfter: 8,
  });
}

function renderChartSlide(slide: any, content: SlideContent) {
  if (content.title) {
    slide.addText(content.title, {
      x: 0.5, y: 0.3, w: '90%', h: 0.6,
      fontSize: 20, bold: true, color: '333333',
    });
  }

  const chartData = content.chartData || [];
  if (chartData.length > 0) {
    slide.addChart('bar', [
      {
        name: content.title || 'Data',
        labels: chartData.map(d => d.label || ''),
        values: chartData.map(d => d.value || 0),
      },
    ], {
      x: 0.8, y: 1.2, w: 11.5, h: 5.0,
      showValue: true,
      chartColors: ['4472C4'],
    });
  }
}

function renderTextSlide(slide: any, content: SlideContent) {
  if (content.title) {
    slide.addText(content.title, {
      x: 0.5, y: 0.3, w: '90%', h: 0.6,
      fontSize: 20, bold: true, color: '333333',
    });
  }

  const body = content.body || content.content || '';
  if (body) {
    slide.addText(String(body), {
      x: 0.8, y: 1.2, w: '85%', h: 5.0,
      fontSize: 13, color: '444444', valign: 'top',
    });
  }
}

async function convertPptxToPdf(pptxBuffer: Buffer, title: string): Promise<Buffer> {
  // 调用 presenton-api 内部的 LibreOffice 转换
  const { writeFile, readFile, unlink, mkdtemp } = await import('fs/promises');
  const { join } = await import('path');
  const { tmpdir } = await import('os');
  const { execFile } = await import('child_process');
  const { promisify } = await import('util');
  const execFileAsync = promisify(execFile);

  const tempDir = await mkdtemp(join(tmpdir(), 'pptx-pdf-'));
  const pptxPath = join(tempDir, `${title || 'presentation'}.pptx`);

  try {
    await writeFile(pptxPath, pptxBuffer);

    // Use LibreOffice to convert PPTX to PDF
    await execFileAsync('libreoffice', [
      '--headless',
      '--convert-to', 'pdf',
      '--outdir', tempDir,
      pptxPath,
    ], { timeout: 60_000 });

    // Find the generated PDF
    const { readdir } = await import('fs/promises');
    const files = await readdir(tempDir);
    const pdfFile = files.find(f => f.endsWith('.pdf'));
    if (!pdfFile) {
      throw new Error('LibreOffice PDF 转换失败');
    }

    const pdfBuffer = await readFile(join(tempDir, pdfFile));
    return pdfBuffer;
  } finally {
    // Cleanup
    const { rm } = await import('fs/promises');
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}
