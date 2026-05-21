import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ConversionOptions, SupportedFormat } from '../../src/ingestion/document-converter';

// Mock pdf-to-img module
vi.mock('pdf-to-img', () => ({
  pdf: vi.fn(),
}));

// Mock child_process
vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

// Mock fs
vi.mock('node:fs', () => ({
  promises: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue(Buffer.from('fake-pdf-content')),
    rm: vi.fn().mockResolvedValue(undefined),
    access: vi.fn().mockRejectedValue(new Error('ENOENT')),
  },
}));

// Mock node:util promisify to return a mock execFile
vi.mock('node:util', () => ({
  promisify: (fn: any) => {
    return vi.fn().mockImplementation(async (cmd: string, args: string[]) => {
      if (cmd === 'which') {
        // Simulate finding libreoffice
        return { stdout: '/usr/bin/libreoffice', stderr: '' };
      }
      // Simulate successful LibreOffice conversion
      return { stdout: '', stderr: '' };
    });
  },
}));

describe('Document Converter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('convertDocumentToImages', () => {
    it('should convert PDF directly without LibreOffice', async () => {
      const { pdf } = await import('pdf-to-img');
      const mockPdf = pdf as unknown as ReturnType<typeof vi.fn>;

      const fakePageBuffer = Buffer.from('fake-png-page-1');
      mockPdf.mockResolvedValue({
        length: 3,
        getPage: vi.fn().mockResolvedValue(fakePageBuffer),
        destroy: vi.fn().mockResolvedValue(undefined),
      });

      const { convertDocumentToImages } = await import('../../src/ingestion/document-converter');

      const pdfBuffer = Buffer.from('fake-pdf-data');
      const result = await convertDocumentToImages(pdfBuffer, 'pdf');

      expect(result.format).toBe('pdf');
      expect(result.pages.length).toBe(3);
      expect(result.processedPages).toBe(3);
      expect(result.totalPages).toBe(3);

      // Verify page structure
      expect(result.pages[0].pageNumber).toBe(1);
      expect(result.pages[0].mimeType).toBe('image/png');
      expect(Buffer.isBuffer(result.pages[0].buffer)).toBe(true);
      expect(result.pages[0].width).toBeGreaterThan(0);
      expect(result.pages[0].height).toBeGreaterThan(0);
    });

    it('should respect maxPages option', async () => {
      const { pdf } = await import('pdf-to-img');
      const mockPdf = pdf as unknown as ReturnType<typeof vi.fn>;

      const fakePageBuffer = Buffer.from('fake-png-page');
      mockPdf.mockResolvedValue({
        length: 100,
        getPage: vi.fn().mockResolvedValue(fakePageBuffer),
        destroy: vi.fn().mockResolvedValue(undefined),
      });

      const { convertDocumentToImages } = await import('../../src/ingestion/document-converter');

      const pdfBuffer = Buffer.from('fake-pdf-data');
      const result = await convertDocumentToImages(pdfBuffer, 'pdf', { maxPages: 5 });

      expect(result.pages.length).toBe(5);
      expect(result.processedPages).toBe(5);
    });

    it('should use default DPI of 150', async () => {
      const { pdf } = await import('pdf-to-img');
      const mockPdf = pdf as unknown as ReturnType<typeof vi.fn>;

      const fakePageBuffer = Buffer.from('fake-png-page');
      mockPdf.mockResolvedValue({
        length: 1,
        getPage: vi.fn().mockResolvedValue(fakePageBuffer),
        destroy: vi.fn().mockResolvedValue(undefined),
      });

      const { convertDocumentToImages } = await import('../../src/ingestion/document-converter');

      const pdfBuffer = Buffer.from('fake-pdf-data');
      await convertDocumentToImages(pdfBuffer, 'pdf');

      // scale = 150 / 72 ≈ 2.083
      expect(mockPdf).toHaveBeenCalledWith(
        pdfBuffer,
        expect.objectContaining({ scale: 150 / 72 }),
      );
    });

    it('should use custom DPI when provided', async () => {
      const { pdf } = await import('pdf-to-img');
      const mockPdf = pdf as unknown as ReturnType<typeof vi.fn>;

      const fakePageBuffer = Buffer.from('fake-png-page');
      mockPdf.mockResolvedValue({
        length: 1,
        getPage: vi.fn().mockResolvedValue(fakePageBuffer),
        destroy: vi.fn().mockResolvedValue(undefined),
      });

      const { convertDocumentToImages } = await import('../../src/ingestion/document-converter');

      const pdfBuffer = Buffer.from('fake-pdf-data');
      await convertDocumentToImages(pdfBuffer, 'pdf', { dpi: 300 });

      // scale = 300 / 72 ≈ 4.167
      expect(mockPdf).toHaveBeenCalledWith(
        pdfBuffer,
        expect.objectContaining({ scale: 300 / 72 }),
      );
    });

    it('should use default maxPages of 50', async () => {
      const { pdf } = await import('pdf-to-img');
      const mockPdf = pdf as unknown as ReturnType<typeof vi.fn>;

      const fakePageBuffer = Buffer.from('fake-png-page');
      mockPdf.mockResolvedValue({
        length: 80,
        getPage: vi.fn().mockResolvedValue(fakePageBuffer),
        destroy: vi.fn().mockResolvedValue(undefined),
      });

      const { convertDocumentToImages } = await import('../../src/ingestion/document-converter');

      const pdfBuffer = Buffer.from('fake-pdf-data');
      const result = await convertDocumentToImages(pdfBuffer, 'pdf');

      // Should cap at 50 pages
      expect(result.pages.length).toBe(50);
    });

    it('should always destroy the PDF document', async () => {
      const { pdf } = await import('pdf-to-img');
      const mockPdf = pdf as unknown as ReturnType<typeof vi.fn>;

      const destroyFn = vi.fn().mockResolvedValue(undefined);
      mockPdf.mockResolvedValue({
        length: 1,
        getPage: vi.fn().mockResolvedValue(Buffer.from('page')),
        destroy: destroyFn,
      });

      const { convertDocumentToImages } = await import('../../src/ingestion/document-converter');

      await convertDocumentToImages(Buffer.from('pdf'), 'pdf');
      expect(destroyFn).toHaveBeenCalled();
    });
  });

  describe('renderPdfToImages', () => {
    it('should return PageImage array with correct structure', async () => {
      const { pdf } = await import('pdf-to-img');
      const mockPdf = pdf as unknown as ReturnType<typeof vi.fn>;

      const pageBuffers = [
        Buffer.from('page-1-png'),
        Buffer.from('page-2-png'),
      ];
      let pageIndex = 0;
      mockPdf.mockResolvedValue({
        length: 2,
        getPage: vi.fn().mockImplementation(() => Promise.resolve(pageBuffers[pageIndex++])),
        destroy: vi.fn().mockResolvedValue(undefined),
      });

      const { renderPdfToImages } = await import('../../src/ingestion/document-converter');

      const result = await renderPdfToImages(Buffer.from('pdf-data'));

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(expect.objectContaining({
        pageNumber: 1,
        mimeType: 'image/png',
      }));
      expect(result[1]).toEqual(expect.objectContaining({
        pageNumber: 2,
        mimeType: 'image/png',
      }));
      expect(Buffer.isBuffer(result[0].buffer)).toBe(true);
      expect(result[0].width).toBeGreaterThan(0);
      expect(result[0].height).toBeGreaterThan(0);
    });

    it('should calculate dimensions based on DPI', async () => {
      const { pdf } = await import('pdf-to-img');
      const mockPdf = pdf as unknown as ReturnType<typeof vi.fn>;

      mockPdf.mockResolvedValue({
        length: 1,
        getPage: vi.fn().mockResolvedValue(Buffer.from('page')),
        destroy: vi.fn().mockResolvedValue(undefined),
      });

      const { renderPdfToImages } = await import('../../src/ingestion/document-converter');

      const result150 = await renderPdfToImages(Buffer.from('pdf'), { dpi: 150 });
      // A4 at 150 DPI: width ≈ 210/25.4 * 150 ≈ 1240, height ≈ 297/25.4 * 150 ≈ 1754
      expect(result150[0].width).toBe(Math.round((210 / 25.4) * 150));
      expect(result150[0].height).toBe(Math.round((297 / 25.4) * 150));
    });
  });

  describe('convertToPdfViaLibreOffice', () => {
    it('should handle supported office formats', async () => {
      const { convertToPdfViaLibreOffice } = await import('../../src/ingestion/document-converter');

      const formats: Array<'pptx' | 'ppt' | 'docx' | 'doc'> = ['pptx', 'ppt', 'docx', 'doc'];

      for (const format of formats) {
        const result = await convertToPdfViaLibreOffice(Buffer.from('office-file'), format);
        expect(Buffer.isBuffer(result)).toBe(true);
      }
    });
  });

  describe('format detection in convertDocumentToImages', () => {
    it('should accept all supported formats', async () => {
      const { pdf } = await import('pdf-to-img');
      const mockPdf = pdf as unknown as ReturnType<typeof vi.fn>;

      mockPdf.mockResolvedValue({
        length: 1,
        getPage: vi.fn().mockResolvedValue(Buffer.from('page')),
        destroy: vi.fn().mockResolvedValue(undefined),
      });

      const { convertDocumentToImages } = await import('../../src/ingestion/document-converter');

      const formats: SupportedFormat[] = ['pdf', 'pptx', 'ppt', 'docx', 'doc'];

      for (const format of formats) {
        const result = await convertDocumentToImages(Buffer.from('file'), format);
        expect(result.format).toBe(format);
        expect(result.pages.length).toBeGreaterThan(0);
      }
    });
  });
});
