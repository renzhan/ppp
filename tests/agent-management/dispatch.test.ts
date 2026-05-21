import { describe, it, expect, afterAll, beforeAll, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { DispatchService, LlmCaller } from '../../src/agent-management/dispatch-service';
import { AgentManagementService } from '../../src/agent-management/agent-management-service';
import { getTestPrismaClient, disconnectTestClient } from '../helpers/db-transaction';

beforeAll(() => {
  process.env.ENCRYPTION_KEY = 'test-encryption-key-for-dispatch-tests!';
});

const prisma = getTestPrismaClient();

// Mock LLM caller that returns a simple response
const mockLlmCaller: LlmCaller = async (
  _systemPrompt: string,
  _userMessage: string,
  _config: any
): Promise<string> => {
  return 'mock-llm-response';
};

// Helper: create a workspace for tests
async function createTestWorkspace(suffix: string) {
  return prisma.workspace.create({
    data: {
      name: `test-ws-dispatch-${suffix}-${Date.now()}`,
      description: 'Test workspace for dispatch tests',
      isPreset: false,
      isEnabled: true,
    },
  });
}

// Helper: create an enabled workspace agent
async function createEnabledAgent(workspaceId: string, name: string) {
  return prisma.agent.create({
    data: {
      name,
      description: 'Test agent for dispatch',
      type: 'workspace',
      workspaceId,
      isEnabled: true,
    },
  });
}

// Cleanup helper
async function cleanupTestData() {
  await prisma.dispatchLog.deleteMany({
    where: {
      targetAgent: { name: { startsWith: 'prop' } },
    },
  });
  await prisma.agent.deleteMany({
    where: { name: { startsWith: 'prop' } },
  });
  await prisma.workspace.deleteMany({
    where: { name: { startsWith: 'test-ws-dispatch-' } },
  });
}

describe('Feature: agent-management, Property 10: 任务路由正确性', () => {
  /**
   * Validates: Requirements 3.1
   *
   * For any task request with a workspaceId, the dispatch should route the task
   * to an enabled Agent in that workspace. The dispatch log's targetAgentId
   * should belong to the specified workspace.
   */

  beforeEach(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await disconnectTestClient();
  });

  it('带 workspaceId 的任务应路由到该工作区的 Agent', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          agentName: fc.string({ minLength: 1, maxLength: 30 }).map((s) => `prop10-ag-${s.replace(/\0/g, '')}`),
          taskContent: fc.string({ minLength: 1, maxLength: 200 }).filter((s) => s.trim().length > 0),
        }),
        async ({ agentName, taskContent }) => {
          const workspace = await createTestWorkspace(`p10-${Date.now()}`);

          try {
            // Create an enabled agent in the workspace
            const agent = await createEnabledAgent(workspace.id, agentName);

            // Create DispatchService with mock LLM caller
            const dispatchService = new DispatchService(prisma, mockLlmCaller);

            // Dispatch a task with workspaceId
            const result = await dispatchService.dispatch({
              taskContent,
              workspaceId: workspace.id,
            });

            // Verify the dispatch routed to the correct agent
            expect(result.agentId).toBe(agent.id);
            expect(result.status).toBe('success');

            // Verify the dispatch log's targetAgentId belongs to the workspace
            const log = await dispatchService.getLog(result.logId);
            expect(log).not.toBeNull();
            expect(log!.targetAgentId).toBe(agent.id);

            // Verify the agent belongs to the specified workspace
            const targetAgent = await prisma.agent.findUnique({
              where: { id: log!.targetAgentId },
            });
            expect(targetAgent).not.toBeNull();
            expect(targetAgent!.workspaceId).toBe(workspace.id);
          } finally {
            // Cleanup
            await prisma.dispatchLog.deleteMany({
              where: { targetAgent: { workspaceId: workspace.id } },
            });
            await prisma.agent.deleteMany({ where: { workspaceId: workspace.id } });
            await prisma.workspace.delete({ where: { id: workspace.id } });
          }
        }
      ),
      { numRuns: 10 }
    );
  }, 120000);
});

describe('Feature: agent-management, Property 11: 直接调度绕过 Master', () => {
  /**
   * Validates: Requirements 3.2
   *
   * For any dispatch request with a targetAgentId specified directly,
   * the dispatch log's sourceAgentId should be null (bypassed Master).
   */

  beforeEach(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it('指定 targetAgentId 时 sourceAgentId 应为 null', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          agentName: fc.string({ minLength: 1, maxLength: 30 }).map((s) => `prop11-ag-${s.replace(/\0/g, '')}`),
          taskContent: fc.string({ minLength: 1, maxLength: 200 }).filter((s) => s.trim().length > 0),
        }),
        async ({ agentName, taskContent }) => {
          const workspace = await createTestWorkspace(`p11-${Date.now()}`);

          try {
            // Create an enabled agent
            const agent = await createEnabledAgent(workspace.id, agentName);

            // Create DispatchService with mock LLM caller
            const dispatchService = new DispatchService(prisma, mockLlmCaller);

            // Dispatch with targetAgentId specified directly
            const result = await dispatchService.dispatch({
              taskContent,
              targetAgentId: agent.id,
            });

            expect(result.status).toBe('success');

            // Verify the dispatch log's sourceAgentId is null (bypassed Master)
            const log = await dispatchService.getLog(result.logId);
            expect(log).not.toBeNull();
            expect(log!.sourceAgentId).toBeNull();
            expect(log!.targetAgentId).toBe(agent.id);
          } finally {
            // Cleanup
            await prisma.dispatchLog.deleteMany({
              where: { targetAgent: { workspaceId: workspace.id } },
            });
            await prisma.agent.deleteMany({ where: { workspaceId: workspace.id } });
            await prisma.workspace.delete({ where: { id: workspace.id } });
          }
        }
      ),
      { numRuns: 10 }
    );
  }, 120000);
});

describe('Feature: agent-management, Property 12: 调度日志完整性', () => {
  /**
   * Validates: Requirements 3.3
   *
   * For any dispatch operation (success or error), the system should create
   * a dispatch log with non-null: targetAgentId, taskSummary, status, createdAt.
   * The status should be either 'success' or 'error'.
   */

  beforeEach(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it('每次调度应创建包含必要字段的日志记录', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          agentName: fc.string({ minLength: 1, maxLength: 30 }).map((s) => `prop12-ag-${s.replace(/\0/g, '')}`),
          taskContent: fc.string({ minLength: 1, maxLength: 200 }).filter((s) => s.trim().length > 0),
          useDirectTarget: fc.boolean(),
        }),
        async ({ agentName, taskContent, useDirectTarget }) => {
          const workspace = await createTestWorkspace(`p12-${Date.now()}`);

          try {
            // Create an enabled agent
            const agent = await createEnabledAgent(workspace.id, agentName);

            // Create DispatchService with mock LLM caller
            const dispatchService = new DispatchService(prisma, mockLlmCaller);

            // Dispatch using either mode
            const request = useDirectTarget
              ? { taskContent, targetAgentId: agent.id }
              : { taskContent, workspaceId: workspace.id };

            const result = await dispatchService.dispatch(request);

            // Verify the dispatch log has all required fields
            const log = await dispatchService.getLog(result.logId);
            expect(log).not.toBeNull();
            expect(log!.targetAgentId).not.toBeNull();
            expect(log!.targetAgentId.length).toBeGreaterThan(0);
            expect(log!.taskSummary).not.toBeNull();
            expect(log!.taskSummary.length).toBeGreaterThan(0);
            expect(log!.status).not.toBeNull();
            expect(['success', 'error']).toContain(log!.status);
            expect(log!.createdAt).not.toBeNull();
            expect(log!.createdAt).toBeInstanceOf(Date);
          } finally {
            // Cleanup
            await prisma.dispatchLog.deleteMany({
              where: { targetAgent: { workspaceId: workspace.id } },
            });
            await prisma.agent.deleteMany({ where: { workspaceId: workspace.id } });
            await prisma.workspace.delete({ where: { id: workspace.id } });
          }
        }
      ),
      { numRuns: 10 }
    );
  }, 180000);
});
