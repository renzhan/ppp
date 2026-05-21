import { describe, it, expect, afterAll, beforeAll, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { AgentManagementService } from '../../src/agent-management/agent-management-service';
import { getTestPrismaClient, disconnectTestClient } from '../helpers/db-transaction';

beforeAll(() => {
  process.env.ENCRYPTION_KEY = 'test-encryption-key-for-agent-mgmt-tests!';
});

const prisma = getTestPrismaClient();

// Helper: create a workspace for tests
async function createTestWorkspace(suffix: string) {
  return prisma.workspace.create({
    data: {
      name: `test-ws-agent-${suffix}-${Date.now()}`,
      description: 'Test workspace for agent management tests',
      isPreset: false,
      isEnabled: true,
    },
  });
}

// Cleanup helper
async function cleanupTestData() {
  // Delete master agents
  await prisma.agent.deleteMany({ where: { type: 'master' } });
  // Delete test agents by name prefix
  await prisma.agent.deleteMany({
    where: { name: { startsWith: 'prop' } },
  });
  // Delete test workspaces
  await prisma.workspace.deleteMany({
    where: { name: { startsWith: 'test-ws-agent-' } },
  });
}

describe('Feature: agent-management, Property 7: Master Agent 单例不变量', () => {
  /**
   * Validates: Requirements 2.1
   *
   * For any number of initMasterAgent calls, the count of agents where type="master"
   * should always be exactly 1.
   */

  const service = new AgentManagementService(prisma);

  beforeEach(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await disconnectTestClient();
  });

  it('多次 initMasterAgent 后 master 记录数始终为 1', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 5 }),
        async (callCount) => {
          // Clean master agents before each property run
          await prisma.agent.deleteMany({ where: { type: 'master' } });

          // Call initMasterAgent multiple times
          for (let i = 0; i < callCount; i++) {
            await service.initMasterAgent();
          }

          // Count master agents — should always be exactly 1
          const masterCount = await prisma.agent.count({
            where: { type: 'master' },
          });

          expect(masterCount).toBe(1);
        }
      ),
      { numRuns: 20 }
    );
  }, 60000);
});

describe('Feature: agent-management, Property 8: Agent 创建持久化往返', () => {
  /**
   * Validates: Requirements 2.2, 2.3
   *
   * For any valid agent creation input (name, description, systemPrompt),
   * after creating the agent, calling findById should return consistent properties.
   */

  const service = new AgentManagementService(prisma);

  beforeEach(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it('创建后查询应返回一致属性', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 50 }).map((s) => `prop8-${s.replace(/\0/g, '')}`),
          description: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
          systemPrompt: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: undefined }),
        }),
        async ({ name, description, systemPrompt }) => {
          // Create a workspace for this agent
          const workspace = await createTestWorkspace(`p8-${Date.now()}`);

          try {
            // Create the agent
            const created = await service.createWorkspaceAgent({
              name,
              description,
              workspaceId: workspace.id,
              systemPrompt,
            });

            // Query by ID
            const found = await service.findById(created.id);

            // Verify all properties match
            expect(found).not.toBeNull();
            expect(found!.id).toBe(created.id);
            expect(found!.name).toBe(name);
            expect(found!.description).toBe(description ?? null);
            expect(found!.systemPrompt).toBe(systemPrompt ?? null);
            expect(found!.workspaceId).toBe(workspace.id);
            expect(found!.type).toBe('workspace');
            expect(found!.isEnabled).toBe(true);
          } finally {
            // Cleanup: delete agents in this workspace, then workspace
            await prisma.agent.deleteMany({ where: { workspaceId: workspace.id } });
            await prisma.workspace.delete({ where: { id: workspace.id } });
          }
        }
      ),
      { numRuns: 20 }
    );
  }, 120000);
});

describe('Feature: agent-management, Property 9: 禁用 Agent 拒绝调度', () => {
  /**
   * Validates: Requirements 2.5
   *
   * For any agent that is disabled via toggleEnabled(id, false),
   * the persisted isEnabled state should be false.
   */

  const service = new AgentManagementService(prisma);

  beforeEach(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it('toggleEnabled(false) 后 Agent 的 isEnabled 应为 false', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 50 }).map((s) => `prop9-${s.replace(/\0/g, '')}`),
        }),
        async ({ name }) => {
          // Create a workspace
          const workspace = await createTestWorkspace(`p9-${Date.now()}`);

          try {
            // Create an agent (initially enabled)
            const agent = await service.createWorkspaceAgent({
              name,
              workspaceId: workspace.id,
            });

            expect(agent.isEnabled).toBe(true);

            // Disable the agent
            const disabled = await service.toggleEnabled(agent.id, false);
            expect(disabled.isEnabled).toBe(false);

            // Verify persistence: query from DB
            const found = await service.findById(agent.id);
            expect(found).not.toBeNull();
            expect(found!.isEnabled).toBe(false);

            // Re-enable and verify
            const reEnabled = await service.toggleEnabled(agent.id, true);
            expect(reEnabled.isEnabled).toBe(true);

            const foundAgain = await service.findById(agent.id);
            expect(foundAgain!.isEnabled).toBe(true);
          } finally {
            // Cleanup
            await prisma.agent.deleteMany({ where: { workspaceId: workspace.id } });
            await prisma.workspace.delete({ where: { id: workspace.id } });
          }
        }
      ),
      { numRuns: 20 }
    );
  }, 120000);
});
