/**
 * Document-to-Image Converter — 文档转图片转换器
 *
 * 将 PDF/PPT/PPTX/DOC/DOCX 文档逐页转换为 PNG 图片。
 * - PDF: 使用 pdf-to-img（基于 pdfium/pdfjs）直接渲染
 * - PPT/PPTX/DOC/DOCX: 先通过 LibreOffice headless 转为 PDF，再渲染
 *
 * 用于策划案多模态解析管线：文档 → 逐页图片 → LLM Vision 理解
 */

import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { promisify } from 'node:util';

import type { PageImage } from './vision-document-parser.js';

const execFileAsync = promisify(execFile);

// ---- Types ----

export type SupportedFormat = 'pdf' | 'pptx' | 'ppt' | 'docx' | 'doc';

export interface ConversionOptions {
  /** 渲染 DPI，默认 150 */
  dpi?: number;
  /** 最大处理页数，默认 50 */
  maxPages?: number;
  /** 页面选择策略：'all' 全量处理，'smart' 跳过空白页 */
  pageSelection?: 'all' | 'smart';
}

export interface ConversionResult {
  pages: PageImage[];
  totalPages: number;
  processedPages: number;
  format: SupportedFormat;
}

// ---- Constants ----

const DEFAULT_DPI = 150;
const DEFAULT_MAX_PAGES = 50;
/** pdf-to-img uses scale factor; 72 DPI is the base, so scale = dpi / 72 */
const BASE_DPI = 72;

// ---- Public Functions ----

/**
 * 将文档文件转换为逐页 PNG 图片。
 * PDF 直接渲染；PPT/Word 先转 PDF 再渲染。
 *
 * @param fileBuffer - 文档文件 Buffer
 * @param format - 文档格式
 * @param options - 转换选项
 * @returns 转换结果，包含逐页 PNG 图片
 */
export async function convertDocumentToImages(
  fileBuffer: Buffer,
  format: SupportedFormat,
  options?: ConversionOptions,
): Promise<ConversionResult> {
  const dpi = options?.dpi ?? DEFAULT_DPI;
  const maxPages = options?.maxPages ?? DEFAULT_MAX_PAGES;

  let pdfBuffer: Buffer;

  if (format === 'pdf') {
    pdfBuffer = fileBuffer;
  } else {
    // PPT/PPTX/DOC/DOCX → PDF via LibreOffice
    pdfBuffer = await convertToPdfViaLibreOffice(fileBuffer, format);
  }

  const pages = await renderPdfToImages(pdfBuffer, { dpi, maxPages });

  return {
    pages,
    totalPages: pages.length, // total pages rendered (capped by maxPages)
    processedPages: pages.length,
    format,
  };
}

/**
 * 将 PPT/PPTX/DOC/DOCX 通过 LibreOffice headless 转换为 PDF。
 * 需要系统安装 LibreOffice（Docker 部署时在镜像中预装）。
 *
 * @param fileBuffer - 源文件 Buffer
 * @param inputFormat - 输入格式
 * @returns PDF Buffer
 * @throws 如果 LibreOffice 未安装或转换失败
 */
export async function convertToPdfViaLibreOffice(
  fileBuffer: Buffer,
  inputFormat: 'pptx' | 'ppt' | 'docx' | 'doc',
): Promise<Buffer> {
  const tempDir = join(tmpdir(), `doc-convert-${randomUUID()}`);
  await fs.mkdir(tempDir, { recursive: true });

  const inputFileName = `input.${inputFormat}`;
  const inputPath = join(tempDir, inputFileName);
  const expectedOutputPath = join(tempDir, 'input.pdf');

  try {
    // Write input file to temp directory
    await fs.writeFile(inputPath, fileBuffer);

    // Find LibreOffice binary
    const libreofficeBin = await findLibreOfficeBinary();

    // Run LibreOffice headless conversion
    await execFileAsync(libreofficeBin, [
      '--headless',
      '--convert-to', 'pdf',
      '--outdir', tempDir,
      inputPath,
    ], {
      timeout: 60000, // 60 second timeout
    });

    // Read the output PDF
    const pdfBuffer = await fs.readFile(expectedOutputPath);
    return pdfBuffer;
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('ENOENT') || error.message.includes('not found')) {
        throw new Error(
          'LibreOffice 未安装。PPT/Word 转 PDF 需要系统安装 LibreOffice。' +
          '请运行: winget install LibreOffice (Windows)、apt-get install libreoffice-core (Linux) 或 brew install --cask libreoffice (macOS)',
        );
      }
      // Some errors (like Object.defineProperty) come from the PDF library, not LibreOffice itself
      if (error.message.includes('Object.defineProperty')) {
        throw new Error(
          `PDF渲染库与当前Node.js版本不兼容，请尝试更新: npm install pdf-to-img@latest`,
        );
      }
      throw new Error(`文档转换失败: ${error.message}`);
    }
    throw new Error('文档转换失败: 未知错误');
  } finally {
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * 将 PDF 逐页渲染为 PNG 图片。
 * 使用 pdf-to-img 库（基于 pdfjs）。
 *
 * @param pdfBuffer - PDF 文件 Buffer
 * @param options - 渲染选项
 * @returns 逐页 PNG 图片数组
 */
export async function renderPdfToImages(
  pdfBuffer: Buffer,
  options?: { dpi?: number; maxPages?: number },
): Promise<PageImage[]> {
  const dpi = options?.dpi ?? DEFAULT_DPI;
  const maxPages = options?.maxPages ?? DEFAULT_MAX_PAGES;
  const scale = dpi / BASE_DPI;

  console.log(`[PDF渲染] 使用 pdf-to-img (基于 pdfjs-dist 5.7.284), DPI=${dpi}, 最大页数=${maxPages}`);

  let doc: { length: number; getPage: (n: number) => Promise<Uint8Array>; destroy: () => Promise<void> } | undefined;

  try {
    const t0 = Date.now();
    const { pdf } = await import(/* webpackIgnore: true */ 'pdf-to-img');
    doc = await pdf(pdfBuffer, { scale });
    console.log(`[PDF渲染] 文档初始化完成, 共${doc.length}页, 耗时${Date.now() - t0}ms`);
  } catch (error) {
    const hint = error instanceof Error && error.message.includes('Object.defineProperty')
      ? 'PDF渲染库与当前Node.js版本不兼容，请尝试: npm install pdf-to-img@latest'
      : '';
    throw new Error(
      `PDF渲染初始化失败: ${error instanceof Error ? error.message : '未知错误'}${hint ? '. ' + hint : ''}`,
    );
  }

  const pages: PageImage[] = [];
  const PAGE_TIMEOUT = 15000; // 15 seconds per page

  try {
    const totalPages = doc.length;
    const pagesToProcess = Math.min(totalPages, maxPages);
    const renderStart = Date.now();

    for (let i = 1; i <= pagesToProcess; i++) {
      const pageStart = Date.now();
      const pageBuffer = await Promise.race([
        doc.getPage(i),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`渲染第${i}页超时`)), PAGE_TIMEOUT),
        ),
      ]);

      const { width, height } = estimatePageDimensions(dpi);

      pages.push({
        pageNumber: i,
        buffer: Buffer.from(pageBuffer),
        width,
        height,
        mimeType: 'image/png',
      });

      if (i % 5 === 0 || i === pagesToProcess) {
        console.log(`[PDF渲染] 已处理${i}/${pagesToProcess}页, 累计耗时${Date.now() - renderStart}ms`);
      }
    }

    console.log(`[PDF渲染] 完成: ${pagesToProcess}页, 总耗时${Date.now() - renderStart}ms, 平均${((Date.now() - renderStart) / pagesToProcess).toFixed(0)}ms/页`);
  } catch (error) {
    throw new Error(
      `PDF页面渲染失败 (第${pages.length + 1}页): ${error instanceof Error ? error.message : '未知错误'}`,
    );
  } finally {
    if (doc) {
      await doc.destroy().catch(() => {});
    }
  }

  return pages;
}

// ---- Internal Helpers ----

/**
 * Find the LibreOffice binary path across different platforms.
 */
async function findLibreOfficeBinary(): Promise<string> {
  // On Windows, check common paths first (avoids relying on `which`)
  const windowsPaths = [
    'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
    'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
  ];

  for (const winPath of windowsPaths) {
    try {
      await fs.access(winPath);
      return winPath;
    } catch {
      // Try next
    }
  }

  // On Unix/macOS, try common paths and `which`
  const candidates = [
    'libreoffice',
    'soffice',
    '/usr/bin/libreoffice',
    '/usr/bin/soffice',
    '/usr/local/bin/libreoffice',
    '/usr/local/bin/soffice',
    '/Applications/LibreOffice.app/Contents/MacOS/soffice',
  ];

  for (const candidate of candidates) {
    try {
      await execFileAsync('which', [candidate]);
      return candidate;
    } catch {
      // Try next candidate
    }
  }

  throw new Error(
    'LibreOffice 未安装。PPT/Word 转 PDF 需要系统安装 LibreOffice。' +
    `请运行: winget install LibreOffice (Windows)、apt-get install libreoffice-core (Linux) 或 brew install --cask libreoffice (macOS)`,
  );
}

/**
 * Estimate page dimensions in pixels based on DPI.
 * Assumes A4 page size (210mm x 297mm) as default.
 */
function estimatePageDimensions(dpi: number): { width: number; height: number } {
  // A4: 210mm x 297mm
  // 1 inch = 25.4mm
  const widthInches = 210 / 25.4;
  const heightInches = 297 / 25.4;

  return {
    width: Math.round(widthInches * dpi),
    height: Math.round(heightInches * dpi),
  };
}
