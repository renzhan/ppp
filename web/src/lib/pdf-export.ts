/**
 * PDF Export Utility
 *
 * 使用 html2canvas + jsPDF 将章节 HTML 直接导出为 PDF 文件，
 * 无需浏览器打印对话框。
 */

import type { ChapterData } from './report-export';
import { buildPdfExportBody } from './report-export';

type JsPDFInstance = InstanceType<(typeof import('jspdf'))['jsPDF']>;

function appendCanvasToPdf(
  pdf: JsPDFInstance,
  canvas: HTMLCanvasElement,
  margin: number,
  isFirstPage: boolean,
): boolean {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const contentWidth = pageWidth - margin * 2;
  const contentHeight = pageHeight - margin * 2;
  const scaledHeight = (canvas.height * contentWidth) / canvas.width;

  let offsetY = 0;
  let sliceIndex = 0;

  while (offsetY < scaledHeight - 0.5) {
    if (!isFirstPage || sliceIndex > 0) {
      pdf.addPage();
    }
    isFirstPage = false;
    sliceIndex++;

    const sliceHeight = Math.min(contentHeight, scaledHeight - offsetY);
    const sourceSliceHeight = (sliceHeight / scaledHeight) * canvas.height;
    const sourceY = (offsetY / scaledHeight) * canvas.height;

    const sliceCanvas = document.createElement('canvas');
    sliceCanvas.width = canvas.width;
    sliceCanvas.height = Math.max(1, Math.ceil(sourceSliceHeight));
    const ctx = sliceCanvas.getContext('2d');
    if (!ctx) break;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
    ctx.drawImage(
      canvas,
      0,
      sourceY,
      canvas.width,
      sourceSliceHeight,
      0,
      0,
      canvas.width,
      sourceSliceHeight,
    );

    pdf.addImage(
      sliceCanvas.toDataURL('image/jpeg', 0.92),
      'JPEG',
      margin,
      margin,
      contentWidth,
      sliceHeight,
    );

    offsetY += sliceHeight;
  }

  return isFirstPage;
}

/**
 * 将章节内容导出为 PDF 并触发浏览器下载。
 */
export async function exportChaptersToPdf(
  chapters: ChapterData[],
  title: string,
  filename: string,
): Promise<void> {
  const [{ jsPDF }, { default: html2canvas }, { renderChartsToImages }] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
    import('./chart-to-image'),
  ]);

  const chaptersWithImages = await renderChartsToImages(chapters);

  const container = document.createElement('div');
  container.style.cssText =
    'position:fixed;left:-9999px;top:0;width:794px;padding:40px 48px;background:#fff;' +
    'font-family:-apple-system,"Microsoft YaHei","PingFang SC",sans-serif;color:#1e293b;line-height:1.7;';
  container.innerHTML = buildPdfExportBody(chaptersWithImages, title);
  document.body.appendChild(container);

  try {
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    const margin = 10;
    let isFirstPage = true;

    const sections = Array.from(container.querySelectorAll<HTMLElement>('.pdf-section'));
    const targets = sections.length > 0 ? sections : [container];

    for (const section of targets) {
      const canvas = await html2canvas(section, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });
      isFirstPage = appendCanvasToPdf(pdf, canvas, margin, isFirstPage);
    }

    pdf.save(`${filename}.pdf`);
  } finally {
    document.body.removeChild(container);
  }
}
