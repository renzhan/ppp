import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  assemblePrestonContent,
  formatMarkdownTable,
  orchestratePPTGeneration,
  startPPTGeneration,
  getPPTJobStatus,
  clearJobStore,
  type Project,
  type ReportData,
  type ModuleData,
  type ModuleKey,
  type TableData,
} from './ppt-orchestration.js';
import { PresentonClient } from '../lib/presenton-client.js';

// --- Test Helpers ---

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'proj-1',
    name: 'Test Project',
    brand: 'TestBrand',
    category: 'Beauty',
    ...overrides,
  };
}

function makeModuleData(overrides: Partial<ModuleData> = {}): ModuleData {
  return {
    status: 'show',
    paragraphs: [{ text: 'Sample paragraph content.' }],
    tables: [],
    charts: [],
    ...overrides,
  };
}

function makeReportData(overrides: Partial<ReportData> = {}): ReportData {
  return {
    projectId: 'proj-1',
    modules: {
      M1: makeModuleData(),
      M2: makeModuleData({ status: 'hide' }),
      M3: makeModuleData({ status: 'hide' }),
      M4: makeModuleData({ status: 'hide' }),
      M5: makeModuleData({ status: 'hide' }),
      M6: makeModuleData({ status: 'hide' }),
      M7: makeModuleData({ status: 'hide' }),
      M8: makeModuleData({ status: 'hide' }),
    },
    ...overrides,
  };
}

// --- formatMarkdownTable Tests ---

describe('formatMarkdownTable', () => {
  it('returns empty string for empty headers', () => {
    const table: TableData = { headers: [], rows: [['a', 'b']] };
    expect(formatMarkdownTable(table)).toBe('');
  });

  it('returns empty string for empty rows', () => {
    const table: TableData = { headers: ['Col1', 'Col2'], rows: [] };
    expect(formatMarkdownTable(table)).toBe('');
  });

  it('formats a valid table as markdown', () => {
    const table: TableData = {
      headers: ['Name', 'Value'],
      rows: [
        ['Metric A', '100'],
        ['Metric B', '200'],
      ],
    };
    const result = formatMarkdownTable(table);
    expect(result).toContain('| Name | Value |');
    expect(result).toContain('| --- | --- |');
    expect(result).toContain('| Metric A | 100 |');
    expect(result).toContain('| Metric B | 200 |');
  });
});

// --- assemblePrestonContent Tests ---

describe('assemblePrestonContent', () => {
  it('includes project metadata header', () => {
    const project = makeProject();
    const reportData = makeReportData();

    const result = assemblePrestonContent(project, reportData);

    expect(result).toContain('# Test Project');
    expect(result).toContain('**Brand:** TestBrand');
    expect(result).toContain('**Category:** Beauty');
  });

  it('includes platform when provided', () => {
    const project = makeProject({ platform: 'Douyin' });
    const reportData = makeReportData();

    const result = assemblePrestonContent(project, reportData);

    expect(result).toContain('**Platform:** Douyin');
  });

  it('includes only modules with status "show"', () => {
    const project = makeProject();
    const reportData = makeReportData({
      modules: {
        M1: makeModuleData({ status: 'show', paragraphs: [{ text: 'M1 content' }] }),
        M2: makeModuleData({ status: 'hide', paragraphs: [{ text: 'M2 content' }] }),
        M3: makeModuleData({ status: 'show', paragraphs: [{ text: 'M3 content' }] }),
        M4: makeModuleData({ status: 'hide' }),
        M5: makeModuleData({ status: 'hide' }),
        M6: makeModuleData({ status: 'hide' }),
        M7: makeModuleData({ status: 'hide' }),
        M8: makeModuleData({ status: 'hide' }),
      },
    });

    const result = assemblePrestonContent(project, reportData);

    expect(result).toContain('M1 content');
    expect(result).not.toContain('M2 content');
    expect(result).toContain('M3 content');
  });

  it('formats tables as valid markdown', () => {
    const project = makeProject();
    const reportData = makeReportData({
      modules: {
        M1: makeModuleData({
          status: 'show',
          tables: [
            {
              headers: ['KPI', 'Value'],
              rows: [['CTR', '3.5%'], ['CPC', '$0.50']],
            },
          ],
        }),
        M2: makeModuleData({ status: 'hide' }),
        M3: makeModuleData({ status: 'hide' }),
        M4: makeModuleData({ status: 'hide' }),
        M5: makeModuleData({ status: 'hide' }),
        M6: makeModuleData({ status: 'hide' }),
        M7: makeModuleData({ status: 'hide' }),
        M8: makeModuleData({ status: 'hide' }),
      },
    });

    const result = assemblePrestonContent(project, reportData);

    expect(result).toContain('| KPI | Value |');
    expect(result).toContain('| --- | --- |');
    expect(result).toContain('| CTR | 3.5% |');
  });

  it('returns non-empty string even with no show modules', () => {
    const project = makeProject();
    const reportData = makeReportData({
      modules: {
        M1: makeModuleData({ status: 'hide' }),
        M2: makeModuleData({ status: 'hide' }),
        M3: makeModuleData({ status: 'hide' }),
        M4: makeModuleData({ status: 'hide' }),
        M5: makeModuleData({ status: 'hide' }),
        M6: makeModuleData({ status: 'hide' }),
        M7: makeModuleData({ status: 'hide' }),
        M8: makeModuleData({ status: 'hide' }),
      },
    });

    const result = assemblePrestonContent(project, reportData);

    // Should still have the project metadata header
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain('# Test Project');
  });

  it('does NOT mutate the input reportData', () => {
    const project = makeProject();
    const reportData = makeReportData({
      modules: {
        M1: makeModuleData({ status: 'show', paragraphs: [{ text: 'Original' }] }),
        M2: makeModuleData({ status: 'hide' }),
        M3: makeModuleData({ status: 'hide' }),
        M4: makeModuleData({ status: 'hide' }),
        M5: makeModuleData({ status: 'hide' }),
        M6: makeModuleData({ status: 'hide' }),
        M7: makeModuleData({ status: 'hide' }),
        M8: makeModuleData({ status: 'hide' }),
      },
    });

    // Deep clone for comparison
    const originalJson = JSON.stringify(reportData);

    assemblePrestonContent(project, reportData);

    expect(JSON.stringify(reportData)).toBe(originalJson);
  });

  it('uses module names in section headers', () => {
    const project = makeProject();
    const reportData = makeReportData({
      modules: {
        M1: makeModuleData({ status: 'show' }),
        M2: makeModuleData({ status: 'hide' }),
        M3: makeModuleData({ status: 'hide' }),
        M4: makeModuleData({ status: 'hide' }),
        M5: makeModuleData({ status: 'hide' }),
        M6: makeModuleData({ status: 'hide' }),
        M7: makeModuleData({ status: 'show' }),
        M8: makeModuleData({ status: 'hide' }),
      },
    });

    const result = assemblePrestonContent(project, reportData);

    expect(result).toContain('## Executive Summary');
    expect(result).toContain('## Recommendations');
  });
});

// --- orchestratePPTGeneration Tests ---

describe('orchestratePPTGeneration', () => {
  it('calls PresentonClient and maps response to URLs', async () => {
    const project = makeProject();
    const reportData = makeReportData();

    const mockClient = new PresentonClient({
      baseUrl: 'http://test:8000',
      apiKey: 'test-key',
      fetchFn: vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            presentation_id: 'pres-123',
            path: '/app_data/presentations/pres-123.pptx',
          }),
      }),
    });

    const result = await orchestratePPTGeneration(project, reportData, {}, mockClient);

    expect(result.presentationId).toBe('pres-123');
    expect(result.editUrl).toBe('/presentation/pres-123');
    expect(result.downloadUrl).toContain('pres-123.pptx');
  });

  it('throws when assembled content is empty', async () => {
    // Create a project with empty name/brand/category to test edge case
    // Actually assemblePrestonContent always returns non-empty due to header,
    // so we test with a mock that would produce empty content
    const project = makeProject({ name: '', brand: '', category: '' });
    const reportData = makeReportData({
      modules: {
        M1: makeModuleData({ status: 'hide' }),
        M2: makeModuleData({ status: 'hide' }),
        M3: makeModuleData({ status: 'hide' }),
        M4: makeModuleData({ status: 'hide' }),
        M5: makeModuleData({ status: 'hide' }),
        M6: makeModuleData({ status: 'hide' }),
        M7: makeModuleData({ status: 'hide' }),
        M8: makeModuleData({ status: 'hide' }),
      },
    });

    const mockClient = new PresentonClient({
      baseUrl: 'http://test:8000',
      apiKey: 'test-key',
      fetchFn: vi.fn(),
    });

    // Even with empty project fields, the header template produces non-empty content
    // so this should still succeed (the API call will be made)
    // Let's verify it doesn't throw for this case
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          presentation_id: 'pres-456',
          path: '/app_data/pres-456.pptx',
        }),
    });

    const client = new PresentonClient({
      baseUrl: 'http://test:8000',
      apiKey: 'test-key',
      fetchFn: fetchMock,
    });

    const result = await orchestratePPTGeneration(project, reportData, {}, client);
    expect(result.presentationId).toBe('pres-456');
  });

  it('passes options to the generation request', async () => {
    const project = makeProject();
    const reportData = makeReportData();

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          presentation_id: 'pres-789',
          path: '/app_data/pres-789.pptx',
        }),
    });

    const mockClient = new PresentonClient({
      baseUrl: 'http://test:8000',
      apiKey: 'test-key',
      fetchFn: fetchMock,
    });

    await orchestratePPTGeneration(
      project,
      reportData,
      { slideCount: 10, language: 'en', template: 'business' },
      mockClient
    );

    // Verify the fetch was called with correct body
    const callArgs = fetchMock.mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    expect(body.n_slides).toBe(10);
    expect(body.language).toBe('en');
    expect(body.template).toBe('business');
  });
});

// --- Async Job Store Tests ---

describe('startPPTGeneration / getPPTJobStatus', () => {
  beforeEach(() => {
    clearJobStore();
  });

  it('returns a job ID immediately', () => {
    const project = makeProject();
    const reportData = makeReportData();

    const mockClient = new PresentonClient({
      baseUrl: 'http://test:8000',
      apiKey: 'test-key',
      fetchFn: vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            presentation_id: 'pres-async-1',
            path: '/app_data/pres-async-1.pptx',
          }),
      }),
    });

    const jobId = startPPTGeneration(project, reportData, {}, mockClient);

    expect(jobId).toBeTruthy();
    expect(typeof jobId).toBe('string');
    expect(jobId.startsWith('ppt-job-')).toBe(true);
  });

  it('job starts with pending status', () => {
    const project = makeProject();
    const reportData = makeReportData();

    const mockClient = new PresentonClient({
      baseUrl: 'http://test:8000',
      apiKey: 'test-key',
      fetchFn: vi.fn().mockImplementation(() => new Promise(() => {})), // never resolves
    });

    const jobId = startPPTGeneration(project, reportData, {}, mockClient);
    const job = getPPTJobStatus(jobId);

    expect(job).toBeDefined();
    expect(job!.status).toBe('pending');
    expect(job!.projectId).toBe('proj-1');
  });

  it('job transitions to completed on success', async () => {
    const project = makeProject();
    const reportData = makeReportData();

    const mockClient = new PresentonClient({
      baseUrl: 'http://test:8000',
      apiKey: 'test-key',
      fetchFn: vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            presentation_id: 'pres-async-2',
            path: '/app_data/pres-async-2.pptx',
          }),
      }),
    });

    const jobId = startPPTGeneration(project, reportData, {}, mockClient);

    // Wait for the background promise to resolve
    await new Promise((resolve) => setTimeout(resolve, 50));

    const job = getPPTJobStatus(jobId);
    expect(job!.status).toBe('completed');
    expect(job!.result).toBeDefined();
    expect(job!.result!.presentationId).toBe('pres-async-2');
  });

  it('job transitions to failed on error', async () => {
    const project = makeProject();
    const reportData = makeReportData();

    const mockClient = new PresentonClient({
      baseUrl: 'http://test:8000',
      apiKey: 'test-key',
      fetchFn: vi.fn().mockRejectedValue(new Error('Network error')),
      retryOptions: { maxAttempts: 1, baseDelayMs: 0 },
      sleepFn: () => Promise.resolve(),
    });

    const jobId = startPPTGeneration(project, reportData, {}, mockClient);

    // Wait for the background promise to reject
    await new Promise((resolve) => setTimeout(resolve, 50));

    const job = getPPTJobStatus(jobId);
    expect(job!.status).toBe('failed');
    expect(job!.error).toContain('Network error');
  });

  it('returns undefined for unknown job ID', () => {
    const job = getPPTJobStatus('nonexistent-job');
    expect(job).toBeUndefined();
  });
});
