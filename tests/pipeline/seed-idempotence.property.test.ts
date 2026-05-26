import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';

/**
 * Property 9: Seed script idempotence
 * Validates: Requirements 1.9
 *
 * For any number of consecutive executions of the seed script (≥ 2),
 * the database state after the Nth execution SHALL be identical to the
 * state after the first execution — specifically, record counts in all
 * seeded tables remain constant.
 */
describe('Feature: report-generation-pipeline, Property 9: Seed script idempotence', () => {
  /**
   * We simulate the seed script's idempotent behavior by modeling the database
   * as an in-memory store. The seed function checks for existing data before
   * creating, so running it N times should produce the same state as running once.
   *
   * This test validates the idempotence logic without requiring a real database.
   */

  // Simulated in-memory database state
  interface DbState {
    projects: Map<string, Record<string, unknown>>;
    notes: Map<string, Record<string, unknown>>;
    juguangData: Map<string, Record<string, unknown>>;
    businessAnnotations: Map<string, Record<string, unknown>>;
    kpiTargets: Map<string, Record<string, unknown>>;
    reviewConfigs: Map<string, Record<string, unknown>>;
    aiGeneratedContent: Map<string, Record<string, unknown>>;
    lingxiData: Map<string, Record<string, unknown>>;
    users: Map<string, Record<string, unknown>>;
  }

  function createEmptyDbState(): DbState {
    return {
      projects: new Map(),
      notes: new Map(),
      juguangData: new Map(),
      businessAnnotations: new Map(),
      kpiTargets: new Map(),
      reviewConfigs: new Map(),
      aiGeneratedContent: new Map(),
      lingxiData: new Map(),
      users: new Map(),
    };
  }

  function getRecordCounts(state: DbState): Record<string, number> {
    return {
      projects: state.projects.size,
      notes: state.notes.size,
      juguangData: state.juguangData.size,
      businessAnnotations: state.businessAnnotations.size,
      kpiTargets: state.kpiTargets.size,
      reviewConfigs: state.reviewConfigs.size,
      aiGeneratedContent: state.aiGeneratedContent.size,
      lingxiData: state.lingxiData.size,
    };
  }

  /**
   * Simulates the seed script's idempotent logic:
   * - Checks if project with the seed name already exists
   * - If exists, skips creation (idempotent)
   * - If not exists, creates all records
   */
  function simulateSeedExecution(state: DbState): void {
    const SEED_PROJECT_NAME = '测试品牌_日常种草_2025Q1';
    const NOTE_COUNT = 35;
    const JUGUANG_COVERAGE = 0.6;

    // Idempotent check: if project already exists, skip
    const existingProject = Array.from(state.projects.values()).find(
      (p) => p.projectName === SEED_PROJECT_NAME
    );

    if (existingProject) {
      // Data already exists, do nothing (idempotent behavior)
      return;
    }

    // Create project
    const projectId = `project_${Date.now()}_${Math.random()}`;
    state.projects.set(projectId, {
      id: projectId,
      projectName: SEED_PROJECT_NAME,
      brand: '测试品牌',
      category: '美妆护肤',
    });

    // Create notes
    const noteIds: string[] = [];
    for (let i = 1; i <= NOTE_COUNT; i++) {
      const noteId = `note_seed_${i.toString().padStart(3, '0')}`;
      const key = `${projectId}_${noteId}`;
      state.notes.set(key, { projectId, noteId });
      noteIds.push(noteId);
    }

    // Create juguang data for 60% of notes
    const juguangCount = Math.ceil(NOTE_COUNT * JUGUANG_COVERAGE);
    for (let i = 0; i < juguangCount; i++) {
      const key = `juguang_${projectId}_${noteIds[i]}`;
      state.juguangData.set(key, { projectId, noteId: noteIds[i] });
    }

    // Create business annotations for all notes
    for (let i = 0; i < NOTE_COUNT; i++) {
      const key = `annotation_${projectId}_${noteIds[i]}`;
      state.businessAnnotations.set(key, { projectId, noteId: noteIds[i] });
    }

    // Create KPI targets
    const metrics = ['impression', 'read', 'engagement', 'cpm', 'cpc', 'cpe', 'ctr', 'viralCount'];
    for (const metric of metrics) {
      const key = `kpi_${projectId}_${metric}`;
      state.kpiTargets.set(key, { projectId, metricName: metric });
    }

    // Create review config
    state.reviewConfigs.set(`rc_${projectId}`, { projectId });

    // Create AI generated content
    state.aiGeneratedContent.set(`ai_${projectId}`, { projectId, contentType: 'plan_parse' });

    // Create lingxi data
    state.lingxiData.set(`lingxi_${projectId}`, { projectId, dataType: 'aips' });

    // Create user (if not exists)
    if (!state.users.has('seed_pipeline_user')) {
      state.users.set('seed_pipeline_user', { username: 'seed_pipeline_user' });
    }
  }

  it('should produce identical record counts after any number of consecutive executions (≥ 2)', () => {
    fc.assert(
      fc.property(
        // Generate a number of executions between 2 and 10
        fc.integer({ min: 2, max: 10 }),
        (numExecutions) => {
          const state = createEmptyDbState();

          // First execution - creates all data
          simulateSeedExecution(state);
          const countsAfterFirst = getRecordCounts(state);

          // Verify first execution created data
          expect(countsAfterFirst.projects).toBe(1);
          expect(countsAfterFirst.notes).toBe(35);
          expect(countsAfterFirst.juguangData).toBe(21); // ceil(35 * 0.6)
          expect(countsAfterFirst.businessAnnotations).toBe(35);
          expect(countsAfterFirst.kpiTargets).toBe(8);
          expect(countsAfterFirst.reviewConfigs).toBe(1);
          expect(countsAfterFirst.aiGeneratedContent).toBe(1);
          expect(countsAfterFirst.lingxiData).toBe(1);

          // Execute N-1 more times
          for (let i = 1; i < numExecutions; i++) {
            simulateSeedExecution(state);
          }

          // Counts after Nth execution should be identical to first
          const countsAfterNth = getRecordCounts(state);
          expect(countsAfterNth).toEqual(countsAfterFirst);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should not create duplicate records regardless of execution count', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 20 }),
        (numExecutions) => {
          const state = createEmptyDbState();

          // Run seed multiple times
          for (let i = 0; i < numExecutions; i++) {
            simulateSeedExecution(state);
          }

          // There should always be exactly 1 project
          expect(state.projects.size).toBe(1);

          // All project-related records should have consistent counts
          expect(state.notes.size).toBe(35);
          expect(state.businessAnnotations.size).toBe(35);
          expect(state.juguangData.size).toBe(21);
          expect(state.kpiTargets.size).toBe(8);
          expect(state.reviewConfigs.size).toBe(1);
          expect(state.aiGeneratedContent.size).toBe(1);
          expect(state.lingxiData.size).toBe(1);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should maintain idempotence with the actual seed function using mocked Prisma client', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 5 }),
        async (numExecutions) => {
          // Track what the seed function would create
          const createdRecords: Record<string, number> = {};
          let projectExists = false;
          const projectId = 'mock-project-id';
          const userId = 'mock-user-id';
          let userExists = false;

          // Create a mock Prisma client that simulates idempotent behavior
          const mockPrisma = {
            project: {
              findFirst: vi.fn().mockImplementation(() => {
                if (projectExists) {
                  return { id: projectId, projectName: '测试品牌_日常种草_2025Q1' };
                }
                return null;
              }),
              create: vi.fn().mockImplementation(() => {
                projectExists = true;
                createdRecords.projects = (createdRecords.projects ?? 0) + 1;
                return { id: projectId };
              }),
            },
            note: {
              create: vi.fn().mockImplementation(() => {
                createdRecords.notes = (createdRecords.notes ?? 0) + 1;
                return { id: 'note-id' };
              }),
              count: vi.fn().mockReturnValue(35),
            },
            juguangData: {
              create: vi.fn().mockImplementation(() => {
                createdRecords.juguangData = (createdRecords.juguangData ?? 0) + 1;
                return { id: 'juguang-id' };
              }),
              count: vi.fn().mockReturnValue(21),
            },
            businessAnnotation: {
              create: vi.fn().mockImplementation(() => {
                createdRecords.businessAnnotations = (createdRecords.businessAnnotations ?? 0) + 1;
                return { id: 'annotation-id' };
              }),
              count: vi.fn().mockReturnValue(35),
            },
            kpiTarget: {
              create: vi.fn().mockImplementation(() => {
                createdRecords.kpiTargets = (createdRecords.kpiTargets ?? 0) + 1;
                return { id: 'kpi-id' };
              }),
              count: vi.fn().mockReturnValue(8),
            },
            reviewConfig: {
              create: vi.fn().mockImplementation(() => {
                createdRecords.reviewConfigs = (createdRecords.reviewConfigs ?? 0) + 1;
                return { id: 'rc-id' };
              }),
              count: vi.fn().mockReturnValue(1),
            },
            aiGeneratedContent: {
              create: vi.fn().mockImplementation(() => {
                createdRecords.aiGeneratedContent = (createdRecords.aiGeneratedContent ?? 0) + 1;
                return { id: 'ai-id' };
              }),
              count: vi.fn().mockReturnValue(1),
            },
            lingxiData: {
              create: vi.fn().mockImplementation(() => {
                createdRecords.lingxiData = (createdRecords.lingxiData ?? 0) + 1;
                return { id: 'lingxi-id' };
              }),
              count: vi.fn().mockReturnValue(1),
            },
            user: {
              findUnique: vi.fn().mockImplementation(() => {
                if (userExists) {
                  return { id: userId, username: 'seed_pipeline_user' };
                }
                return null;
              }),
              create: vi.fn().mockImplementation(() => {
                userExists = true;
                return { id: userId };
              }),
            },
          };

          // Import and run the seed function multiple times
          const { seedReportPipeline } = await import('../../prisma/seeds/report-pipeline-seed');

          for (let i = 0; i < numExecutions; i++) {
            await seedReportPipeline(mockPrisma as any);
          }

          // The project.create should only be called once (first execution)
          // Subsequent executions find existing project and skip
          expect(mockPrisma.project.create).toHaveBeenCalledTimes(1);

          // All other creates should only happen once (during first execution)
          expect(createdRecords.projects).toBe(1);
          expect(createdRecords.notes).toBe(35);
          expect(createdRecords.juguangData).toBe(21);
          expect(createdRecords.businessAnnotations).toBe(35);
          expect(createdRecords.kpiTargets).toBe(8);
          expect(createdRecords.reviewConfigs).toBe(1);
          expect(createdRecords.aiGeneratedContent).toBe(1);
          expect(createdRecords.lingxiData).toBe(1);
        }
      ),
      { numRuns: 20 }
    );
  });
});
