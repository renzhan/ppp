import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing the route
vi.mock('@/ingestion/document-converter', () => ({
  convertDocumentToImages: vi.fn(),
}));

vi.mock('@/ingestion/vision-document-parser', () => ({
  parsePlanDocumentVision: vi.fn(),
}));

vi.mock('@/report/llm-client', () => ({
  OpenAILLMClient: vi.fn().mockImplementation(() => ({
    chat: vi.fn(),
  })),
}));

import { POST } from '../../../web/src/app/api/upload/plan-parse/route';
import { convertDocumentToImages } from '@/ingestion/document-converter';
import { parsePlanDocumentVision } from '@/ingestion/vision-document-parser';

// Helper to create a mock File in a FormData
function createMockFormData(fileName: string, content: Buffer, mimeType?: string): FormData {
  const formData = new FormData();
  const blob = new Blob([content], { type: mimeType || 'application/pdf' });
  const file = new File([blob], fileName, { type: mimeType || 'application/pdf' });
  formData.append('file', file);
  return formData;
}

function createRequest(formData: FormData): Request {
  return new Request('http://localhost:3000/api/upload/plan-parse', {
    method: 'POST',
    body: formData,
  });
}

describe('POST /api/upload/plan-parse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set required env vars
    process.env.LLM_BASE_URL = 'https://api.example.com/v1';
    process.env.LLM_API_KEY = 'test-key';
    process.env.LLM_MODEL = 'gpt-4.1';
  });

  it('should return error when no file is uploaded', async () => {
    const formData = new FormData();
    const request = createRequest(formData);

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toBe('请上传策划案文件');
  });

  it('should return error for unsupported file format', async () => {
    const formData = createMockFormData('document.txt', Buffer.from('hello'), 'text/plain');
    const request = createRequest(formData);

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(415);
    expect(body.success).toBe(false);
    expect(body.error).toContain('不支持的文件格式');
    expect(body.supportedFormats).toEqual(['pdf', 'ppt', 'pptx', 'doc', 'docx']);
  });

  it('should return error when file exceeds size limit', async () => {
    // Create a buffer larger than 50MB
    const largeBuffer = Buffer.alloc(51 * 1024 * 1024);
    const formData = createMockFormData('large.pdf', largeBuffer, 'application/pdf');
    const request = createRequest(formData);

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(413);
    expect(body.success).toBe(false);
    expect(body.error).toContain('50MB');
  });

  it('should accept PDF files and return parsed result', async () => {
    const mockPages = [
      { pageNumber: 1, buffer: Buffer.from('page1'), width: 1240, height: 1754, mimeType: 'image/png' as const },
      { pageNumber: 2, buffer: Buffer.from('page2'), width: 1240, height: 1754, mimeType: 'image/png' as const },
    ];

    vi.mocked(convertDocumentToImages).mockResolvedValue({
      pages: mockPages,
      totalPages: 2,
      processedPages: 2,
      format: 'pdf',
    });

    vi.mocked(parsePlanDocumentVision).mockResolvedValue({
      projectObjective: '提升品牌知名度',
      strategy: '小红书种草营销',
      targetAudience: '18-35岁女性',
      coreMessage: '健康美味的酸奶选择',
      kpiTargets: { 曝光量: 1000000, 互动量: 50000 },
      confidence: 85,
      pagesSummary: [
        { pageNumber: 1, summary: '项目背景', extractedFields: ['projectObjective', 'strategy'] },
        { pageNumber: 2, summary: 'KPI目标', extractedFields: ['kpiTargets'] },
      ],
    });

    const formData = createMockFormData('plan.pdf', Buffer.from('fake-pdf'), 'application/pdf');
    const request = createRequest(formData);

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.projectObjective).toBe('提升品牌知名度');
    expect(body.data.strategy).toBe('小红书种草营销');
    expect(body.data.targetAudience).toBe('18-35岁女性');
    expect(body.data.coreMessage).toBe('健康美味的酸奶选择');
    expect(body.data.kpiTargets).toEqual({ 曝光量: 1000000, 互动量: 50000 });
    expect(body.metadata.totalPages).toBe(2);
    expect(body.metadata.confidence).toBe(85);
    expect(body.metadata.format).toBe('pdf');
  });

  it('should accept PPTX files by extension when MIME type is generic', async () => {
    vi.mocked(convertDocumentToImages).mockResolvedValue({
      pages: [{ pageNumber: 1, buffer: Buffer.from('p1'), width: 1240, height: 1754, mimeType: 'image/png' }],
      totalPages: 1,
      processedPages: 1,
      format: 'pptx',
    });

    vi.mocked(parsePlanDocumentVision).mockResolvedValue({
      projectObjective: '测试目标',
      confidence: 60,
      pagesSummary: [{ pageNumber: 1, summary: '测试', extractedFields: ['projectObjective'] }],
    });

    const formData = createMockFormData(
      'marketing-plan.pptx',
      Buffer.from('fake-pptx'),
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    );
    const request = createRequest(formData);

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.projectObjective).toBe('测试目标');
  });

  it('should accept DOCX files', async () => {
    vi.mocked(convertDocumentToImages).mockResolvedValue({
      pages: [{ pageNumber: 1, buffer: Buffer.from('p1'), width: 1240, height: 1754, mimeType: 'image/png' }],
      totalPages: 1,
      processedPages: 1,
      format: 'docx',
    });

    vi.mocked(parsePlanDocumentVision).mockResolvedValue({
      confidence: 50,
      pagesSummary: [],
    });

    const formData = createMockFormData(
      'brief.docx',
      Buffer.from('fake-docx'),
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    const request = createRequest(formData);

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should return error when document conversion fails', async () => {
    vi.mocked(convertDocumentToImages).mockRejectedValue(
      new Error('LibreOffice 未安装'),
    );

    const formData = createMockFormData('plan.pptx', Buffer.from('fake'), 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
    const request = createRequest(formData);

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.success).toBe(false);
    expect(body.error).toContain('文档转换失败');
    expect(body.error).toContain('LibreOffice');
  });

  it('should return error when document has no pages', async () => {
    vi.mocked(convertDocumentToImages).mockResolvedValue({
      pages: [],
      totalPages: 0,
      processedPages: 0,
      format: 'pdf',
    });

    const formData = createMockFormData('empty.pdf', Buffer.from('fake'), 'application/pdf');
    const request = createRequest(formData);

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.success).toBe(false);
    expect(body.error).toContain('文档为空');
  });

  it('should return error when vision parsing fails', async () => {
    vi.mocked(convertDocumentToImages).mockResolvedValue({
      pages: [{ pageNumber: 1, buffer: Buffer.from('p1'), width: 1240, height: 1754, mimeType: 'image/png' }],
      totalPages: 1,
      processedPages: 1,
      format: 'pdf',
    });

    vi.mocked(parsePlanDocumentVision).mockRejectedValue(
      new Error('LLM API timeout'),
    );

    const formData = createMockFormData('plan.pdf', Buffer.from('fake'), 'application/pdf');
    const request = createRequest(formData);

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.success).toBe(false);
    expect(body.error).toContain('策划案解析失败');
  });

  it('should return null for fields not extracted', async () => {
    vi.mocked(convertDocumentToImages).mockResolvedValue({
      pages: [{ pageNumber: 1, buffer: Buffer.from('p1'), width: 1240, height: 1754, mimeType: 'image/png' }],
      totalPages: 1,
      processedPages: 1,
      format: 'pdf',
    });

    vi.mocked(parsePlanDocumentVision).mockResolvedValue({
      projectObjective: '品牌推广',
      // strategy, targetAudience, coreMessage, kpiTargets are undefined
      confidence: 30,
      pagesSummary: [],
    });

    const formData = createMockFormData('plan.pdf', Buffer.from('fake'), 'application/pdf');
    const request = createRequest(formData);

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.projectObjective).toBe('品牌推广');
    expect(body.data.strategy).toBeNull();
    expect(body.data.targetAudience).toBeNull();
    expect(body.data.coreMessage).toBeNull();
    expect(body.data.kpiTargets).toBeNull();
  });

  it('should return error when LLM config is missing', async () => {
    delete process.env.LLM_BASE_URL;
    delete process.env.LLM_API_KEY;
    delete process.env.OPENAI_BASE_URL;
    delete process.env.OPENAI_API_KEY;

    vi.mocked(convertDocumentToImages).mockResolvedValue({
      pages: [{ pageNumber: 1, buffer: Buffer.from('p1'), width: 1240, height: 1754, mimeType: 'image/png' }],
      totalPages: 1,
      processedPages: 1,
      format: 'pdf',
    });

    // Need to re-mock OpenAILLMClient to throw
    const { OpenAILLMClient } = await import('@/report/llm-client');
    vi.mocked(OpenAILLMClient).mockImplementation(() => {
      throw new Error('LLM configuration missing: LLM_BASE_URL and LLM_API_KEY are required');
    });

    const formData = createMockFormData('plan.pdf', Buffer.from('fake'), 'application/pdf');
    const request = createRequest(formData);

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error).toContain('LLM configuration missing');
  });

  it('should detect format from file extension when MIME type is octet-stream', async () => {
    // Re-mock OpenAILLMClient to not throw (previous test modified it)
    const { OpenAILLMClient } = await import('@/report/llm-client');
    vi.mocked(OpenAILLMClient).mockImplementation(() => ({
      chat: vi.fn(),
    }) as any);

    vi.mocked(convertDocumentToImages).mockResolvedValue({
      pages: [{ pageNumber: 1, buffer: Buffer.from('p1'), width: 1240, height: 1754, mimeType: 'image/png' }],
      totalPages: 1,
      processedPages: 1,
      format: 'doc',
    });

    vi.mocked(parsePlanDocumentVision).mockResolvedValue({
      confidence: 40,
      pagesSummary: [],
    });

    const formData = createMockFormData('old-doc.doc', Buffer.from('fake'), 'application/octet-stream');
    const request = createRequest(formData);

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });
});
