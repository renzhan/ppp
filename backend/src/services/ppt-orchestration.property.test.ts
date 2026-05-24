/**
 * Property-based tests for PPT Orchestration Layer.
 *
 * Tests cover:
 * - Property 2: Content Assembly Completeness (Validates: Requirements 4.2, 4.4)
 * - Property 3: Content Assembly Immutability (Validates: Requirement 4.5)
 * - Property 4: Orchestration Response Mapping (Validates: Requirement 4.3)
 * - Property 12: Async PPT Generation Response (Validates: Requirement 12.3)
 */

import { describe, it, expect, afterEach } from 'vitest';
import * as fc from 'fast-check';
import {
  assemblePrestonContent,
  orchestratePPTGeneration,
  startPPTGeneration,
  getPPTJobStatus,
  clearJobStore,
  type Project,
  type ReportData,
  type ModuleData,
  type ModuleKey,
  type TableData,
  type Paragraph,
  type PPTGenerateOptions,
} from './ppt-orchestration.js';
import { PresentonClient, type PresentationResponse } from '../lib/presenton-client.js';

// --- Generators ---

const MODULE_KEYS: ModuleKey[] = ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8'];

const MODULE_NAMES: Record<ModuleKey, string> = {
  M1: 'Executive Summary',
  M2: 'Market Analysis',
  M3: 'Content Performance',
  M4: 'Traffic Analysis',
  M5: 'Audience Insights',
  M6: 'Competitive Landscape',
  M7: 'Recommendations',
  M8: 'Appendix',
};

const arbParagraph: fc.Arbitrary<Paragraph> = fc
  .string({ minLength: 1, maxLength: 100 })
  .filter((s) => s.trim().length > 0)
  .map((text) => ({ text }));

const arbTableData: fc.Arbitrary<TableData> = fc.record({
  headers: fc.array(fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0), {
    minLength: 1,
    maxLength: 5,
  }),
  rows: fc.array(
    fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 }),
    { minLength: 1, maxLength: 5 }
  ),
});

const arbModuleData = (status: 'show' | 'hide'): fc.Arbitrary<ModuleData> =>
  fc.record({
    status: fc.constant(status),
    paragraphs: fc.array(arbParagraph, { minLength: 0, maxLength: 3 }),
    tables: fc.array(arbTableData, { minLength: 0, maxLength: 2 }),
    charts: fc.constant([]),
  });

const arbProject: fc.Arbitrary<Project> = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
  brand: fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0),
  category: fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0),
  platform: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
  startDate: fc.option(fc.date(), { nil: undefined }),
  endDate: fc.option(fc.date(), { nil: undefined }),
  status: fc.option(fc.constantFrom('active', 'completed', 'draft'), { nil: undefined }),
});

/**
 * Generates report data with random show/hide combinations for each module.
 */
const arbReportData: fc.Arbitrary<ReportData> = fc
  .tuple(
    fc.uuid(),
    ...MODULE_KEYS.map(() => fc.constantFrom('show' as const, 'hide' as const))
  )
  .chain(([projectId, ...statuses]) => {
    const moduleArbs: Record<string, fc.Arbitrary<ModuleData>> = {};
    MODULE_KEYS.forEach((key, i) => {
      moduleArbs[key] = arbModuleData(statuses[i]);
    });

    return fc.record(moduleArbs as Record<ModuleKey, fc.Arbitrary<ModuleData>>).map(
      (modules) =>
        ({
          projectId,
          modules: modules as Record<ModuleKey, ModuleData>,
        }) as ReportData
    );
  });

/**
 * Generates a Presenton response with random ID and path.
 */
const arbPresentonResponse: fc.Arbitrary<PresentationResponse> = fc.record({
  presentation_id: fc.uuid(),
  path: fc
    .array(fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'), { minLength: 1, maxLength: 10 }), {
      minLength: 1,
      maxLength: 4,
    })
    .map((parts) => `/app_data/${parts.join('/')}.pptx`),
});

// --- Helper: Create mock PresentonClient ---

function createMockClient(response: PresentationResponse): PresentonClient {
  const mockFetch = async (_url: string | URL | Request, _init?: RequestInit): Promise<Response> => {
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  return new PresentonClient({
    baseUrl: 'http://mock-presenton:8000',
    apiKey: 'test-key',
    fetchFn: mockFetch as typeof fetch,
    sleepFn: async () => {},
  });
}

// --- Property 2: Content Assembly Completeness ---

describe('Property 2: Content Assembly Completeness', () => {
  /**
   * **Validates: Requirements 4.2, 4.4**
   *
   * For any valid project with report data containing modules with mixed
   * "show"/"hide" status, the content assembly SHALL produce a non-empty
   * string that includes project metadata and contains content from exactly
   * the modules with status "show", with all tables formatted as valid markdown.
   */

  it('output is non-empty and includes project metadata', () => {
    fc.assert(
      fc.property(arbProject, arbReportData, (project, reportData) => {
        const output = assemblePrestonContent(project, reportData);

        // Output is non-empty
        expect(output.length).toBeGreaterThan(0);

        // Includes project metadata
        expect(output).toContain(project.name);
        expect(output).toContain(project.brand);
        expect(output).toContain(project.category);
      }),
      { numRuns: 100 }
    );
  });

  it('exactly the "show" modules appear in output', () => {
    fc.assert(
      fc.property(arbProject, arbReportData, (project, reportData) => {
        const output = assemblePrestonContent(project, reportData);

        for (const key of MODULE_KEYS) {
          const moduleData = reportData.modules[key];
          const moduleName = MODULE_NAMES[key];

          if (moduleData.status === 'show') {
            // Show modules should appear as section headers
            expect(output).toContain(`## ${moduleName}`);
          } else {
            // Hide modules should NOT appear
            expect(output).not.toContain(`## ${moduleName}`);
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  it('tables are formatted as valid markdown', () => {
    fc.assert(
      fc.property(arbProject, arbReportData, (project, reportData) => {
        const output = assemblePrestonContent(project, reportData);

        // For each show module with tables, verify markdown table format
        for (const key of MODULE_KEYS) {
          const moduleData = reportData.modules[key];
          if (moduleData.status !== 'show') continue;

          for (const table of moduleData.tables) {
            if (!table.headers || table.headers.length === 0) continue;
            if (!table.rows || table.rows.length === 0) continue;

            // Valid markdown table has header row with pipes
            const headerRow = `| ${table.headers.join(' | ')} |`;
            expect(output).toContain(headerRow);

            // Valid markdown table has separator row with dashes
            const separatorRow = `| ${table.headers.map(() => '---').join(' | ')} |`;
            expect(output).toContain(separatorRow);
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});

// --- Property 3: Content Assembly Immutability ---

describe('Property 3: Content Assembly Immutability', () => {
  /**
   * **Validates: Requirement 4.5**
   *
   * For any report data input, after the PPT_Orchestration_Layer assembles
   * content for Presenton_Backend, the original report data object SHALL be
   * identical to its state before assembly (no mutations).
   */

  it('original report data is byte-for-byte identical after assembly', () => {
    fc.assert(
      fc.property(arbProject, arbReportData, (project, reportData) => {
        // Deep-clone input before assembly
        const reportDataBefore = JSON.parse(JSON.stringify(reportData));

        // Perform assembly
        assemblePrestonContent(project, reportData);

        // Verify original report data is unchanged
        const reportDataAfter = JSON.parse(JSON.stringify(reportData));
        expect(reportDataAfter).toEqual(reportDataBefore);
      }),
      { numRuns: 200 }
    );
  });

  it('project data is not mutated during assembly', () => {
    fc.assert(
      fc.property(arbProject, arbReportData, (project, reportData) => {
        // Deep-clone project before assembly
        const projectBefore = JSON.parse(JSON.stringify(project));

        // Perform assembly
        assemblePrestonContent(project, reportData);

        // Verify project is unchanged
        const projectAfter = JSON.parse(JSON.stringify(project));
        expect(projectAfter).toEqual(projectBefore);
      }),
      { numRuns: 200 }
    );
  });
});

// --- Property 4: Orchestration Response Mapping ---

describe('Property 4: Orchestration Response Mapping', () => {
  /**
   * **Validates: Requirement 4.3**
   *
   * For any successful Presenton_Backend generation response containing a
   * presentation_id and file path, the PPT_Orchestration_Layer SHALL produce
   * a result containing a valid presentation ID, an edit URL of the form
   * `/presentation/{id}`, and a download URL derived from the file path.
   */

  it('result contains valid presentation ID and correct URL patterns', () => {
    fc.assert(
      fc.asyncProperty(
        arbProject,
        arbReportData.filter((rd) =>
          MODULE_KEYS.some((k) => rd.modules[k].status === 'show')
        ),
        arbPresentonResponse,
        async (project, reportData, mockResponse) => {
          const client = createMockClient(mockResponse);

          const result = await orchestratePPTGeneration(project, reportData, {}, client);

          // Result contains valid presentation ID
          expect(result.presentationId).toBe(mockResponse.presentation_id);
          expect(result.presentationId.length).toBeGreaterThan(0);

          // Edit URL matches /presentation/{id} pattern
          expect(result.editUrl).toBe(`/presentation/${mockResponse.presentation_id}`);
          expect(result.editUrl).toMatch(/^\/presentation\/[a-f0-9-]+$/);

          // Download URL is derived from file path
          expect(result.downloadUrl).toContain(mockResponse.path);
        }
      ),
      { numRuns: 50 }
    );
  });
});

// --- Property 12: Async PPT Generation Response ---

describe('Property 12: Async PPT Generation Response', () => {
  /**
   * **Validates: Requirement 12.3**
   *
   * For any PPT generation request, the PPP_Backend SHALL return immediately
   * with a job ID for polling rather than blocking until generation completes.
   * The response time SHALL not depend on the duration of the actual generation process.
   */

  afterEach(() => {
    clearJobStore();
  });

  it('response returns immediately with job ID', () => {
    fc.assert(
      fc.property(
        arbProject,
        arbReportData,
        fc.record({
          slideCount: fc.option(fc.integer({ min: 5, max: 30 }), { nil: undefined }),
          language: fc.option(fc.constantFrom('zh', 'en', 'ja'), { nil: undefined }),
          template: fc.option(fc.constantFrom('general', 'business', 'creative'), { nil: undefined }),
        }),
        (project, reportData, options) => {
          // Create a client with a delayed response to simulate slow generation
          const slowMockFetch = async (): Promise<Response> => {
            // This would normally take a long time, but startPPTGeneration
            // should return before this resolves
            return new Promise((resolve) => {
              setTimeout(() => {
                resolve(
                  new Response(
                    JSON.stringify({
                      presentation_id: 'delayed-id',
                      path: '/app_data/delayed.pptx',
                    }),
                    { status: 200, headers: { 'Content-Type': 'application/json' } }
                  )
                );
              }, 5000); // 5 second delay
            });
          };

          const client = new PresentonClient({
            baseUrl: 'http://mock-presenton:8000',
            apiKey: 'test-key',
            fetchFn: slowMockFetch as typeof fetch,
            sleepFn: async () => {},
          });

          const startTime = Date.now();
          const jobId = startPPTGeneration(project, reportData, options as PPTGenerateOptions, client);
          const elapsed = Date.now() - startTime;

          // Job ID is returned immediately (well under 100ms)
          expect(jobId).toBeTruthy();
          expect(typeof jobId).toBe('string');
          expect(jobId.length).toBeGreaterThan(0);
          expect(elapsed).toBeLessThan(100);

          // Job is in pending state
          const job = getPPTJobStatus(jobId);
          expect(job).toBeDefined();
          expect(job!.status).toBe('pending');
          expect(job!.projectId).toBe(project.id);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('response time does not correlate with generation duration', () => {
    // Test with varying simulated generation durations
    const durations = [100, 1000, 5000, 10000];
    const responseTimes: number[] = [];

    for (const duration of durations) {
      const slowMockFetch = async (): Promise<Response> => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve(
              new Response(
                JSON.stringify({
                  presentation_id: `id-${duration}`,
                  path: `/app_data/file-${duration}.pptx`,
                }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
              )
            );
          }, duration);
        });
      };

      const client = new PresentonClient({
        baseUrl: 'http://mock-presenton:8000',
        apiKey: 'test-key',
        fetchFn: slowMockFetch as typeof fetch,
        sleepFn: async () => {},
      });

      const project: Project = {
        id: `proj-${duration}`,
        name: 'Test Project',
        brand: 'TestBrand',
        category: 'TestCategory',
      };

      const reportData: ReportData = {
        projectId: project.id,
        modules: {
          M1: { status: 'show', paragraphs: [{ text: 'Test' }], tables: [], charts: [] },
          M2: { status: 'hide', paragraphs: [], tables: [], charts: [] },
          M3: { status: 'hide', paragraphs: [], tables: [], charts: [] },
          M4: { status: 'hide', paragraphs: [], tables: [], charts: [] },
          M5: { status: 'hide', paragraphs: [], tables: [], charts: [] },
          M6: { status: 'hide', paragraphs: [], tables: [], charts: [] },
          M7: { status: 'hide', paragraphs: [], tables: [], charts: [] },
          M8: { status: 'hide', paragraphs: [], tables: [], charts: [] },
        },
      };

      const startTime = Date.now();
      startPPTGeneration(project, reportData, {}, client);
      const elapsed = Date.now() - startTime;
      responseTimes.push(elapsed);
    }

    // All response times should be fast (< 50ms) regardless of generation duration
    for (const time of responseTimes) {
      expect(time).toBeLessThan(50);
    }

    // Response times should not increase with generation duration
    // (no correlation - max difference between any two should be small)
    const maxTime = Math.max(...responseTimes);
    const minTime = Math.min(...responseTimes);
    expect(maxTime - minTime).toBeLessThan(30);

    clearJobStore();
  });
});
