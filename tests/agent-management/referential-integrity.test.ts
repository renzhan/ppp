import { describe, it, expect, afterAll, beforeAll, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { ModelConfigService } from '../../src/agent-management/model-config-service';
import { SkillManagementService } from '../../src/agent-management/skill-management-service';
import { WorkspaceService } from '../../src/agent-management/workspace-service';
import { AgentManagementService } from '../../src/agent-management/agent-management-service';
import { getTestPrismaClient, disconnectTestClient } from '../helpers/db-transaction';

beforeAll(() => {
  process.env.ENCRYPTION_KEY = 'test-encryption-key-for-ref-integrity!';
});

const prisma = getTestPrismaClient();

// Helper: create a test workspace
async function createTestWorkspace(suffix: string) {
  return prisma.workspace.create({
    data: {
      name: `test-ws-ref-${suffix}-${Date.now()}`,
      description: 'Test workspace for referential integrity tests',
      isPreset: false,
      isEnabled: true,
    },
  });
}

// Helper: create a model config
async function createTestModelConfig(suffix: string) {
  const modelConfigService = new ModelConfigService(prisma);
  return modelConfigService.create({
    name: `test-model-ref-${suffix}-${Date.now()}`,
    apiKey: 'sk-test-key-for-ref-integrity',
    baseUrl: 'https://api.test.com/v1',
    modelName: 'gpt-4-test',
  });
}

// Helper: create a skill
async function createTestSkill(suffix: string, workspaceId?: string) {
  const skillService = new SkillManagementService(prisma);
  return skillService.create({
    name: `test-skill-ref-${suffix}-${Date.now()}`,
    description: 'Test skill for referential integrity',
    content: '# Test Skill Content',
    scope: workspaceId ? 'workspace' : 'public',
    workspaceId,
  });
}

// Cleanup helper
async function cleanupTestData() {
  await prisma.agentSkill.deleteMany({
    where: { agent: { name: { startsWith: 'prop6' } } },
  });
  await prisma.agent.deleteMany({
    where: { name: { startsWith: 'prop6' } },
  });
  await prisma.skillVersion.deleteMany({
    where: { skill: { name: { startsWith: 'test-skill-ref-' } } },
  });
  await prisma.skill.deleteMany({
    where: { name: { startsWith: 'test-skill-ref-' } },
  });
  await prisma.modelConfig.deleteMany({
    where: { name: { startsWith: 'test-model-ref-' } },
  });
  await prisma.knowledgeDocument.deleteMany({
    where: { workspace: { name: { startsWith: 'test-ws-ref-' } } },
  });
  await prisma.workspace.deleteMany({
    where: { name: { startsWith: 'test-ws-ref-' } },
  });
}

describe('Feature: agent-management, Property 6: 引用完整性阻止删除', () => {
  /**
   * **Validates: Requirements 1.7, 4.6, 7.5**
   *
   * For any ModelConfig referenced by an Agent, any Skill referenced by an Agent,
   * or any Workspace containing Agents/Documents, deletion should be blocked
   * and the error should contain reference information.
   */

  beforeEach(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await disconnectTestClient();
  });

  it('被 Agent 引用的 ModelConfig 删除应被阻止并返回引用列表', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          agentName: fc.string({ minLength: 1, maxLength: 30 }).map(
            (s) => `prop6-mc-${s.replace(/[\0\x00-\x1f]/g, 'x')}`
          ),
        }),
        async ({ agentName }) => {
          const workspace = await createTestWorkspace(`mc-${Date.now()}`);

          try {
            // Create a ModelConfig
            const modelConfig = await createTestModelConfig(`mc-${Date.now()}`);

            // Create an Agent referencing the ModelConfig
            const agentService = new AgentManagementService(prisma);
            const agent = await agentService.createWorkspaceAgent({
              name: agentName,
              workspaceId: workspace.id,
              modelConfigId: modelConfig.id,
            });

            // Attempt to delete the ModelConfig — should be blocked
            const modelConfigService = new ModelConfigService(prisma);
            await expect(
              modelConfigService.delete(modelConfig.id)
            ).rejects.toThrow();

            // Verify the error message contains reference information
            try {
              await modelConfigService.delete(modelConfig.id);
            } catch (err: any) {
              expect(err.message).toContain('Cannot delete model config');
              expect(err.message).toContain(agentName);
            }
          } finally {
            // Cleanup
            await prisma.agentSkill.deleteMany({
              where: { agent: { workspaceId: workspace.id } },
            });
            await prisma.agent.deleteMany({ where: { workspaceId: workspace.id } });
            await prisma.modelConfig.deleteMany({
              where: { name: { startsWith: 'test-model-ref-' } },
            });
            await prisma.workspace.delete({ where: { id: workspace.id } });
          }
        }
      ),
      { numRuns: 10 }
    );
  }, 120000);

  it('被 Agent 引用的 Skill 删除应被阻止并返回引用列表', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          agentName: fc.string({ minLength: 1, maxLength: 30 }).map(
            (s) => `prop6-sk-${s.replace(/[\0\x00-\x1f]/g, 'x')}`
          ),
        }),
        async ({ agentName }) => {
          const workspace = await createTestWorkspace(`sk-${Date.now()}`);

          try {
            // Create a public Skill
            const skill = await createTestSkill(`sk-${Date.now()}`);

            // Create an Agent and attach the Skill
            const agentService = new AgentManagementService(prisma);
            const agent = await agentService.createWorkspaceAgent({
              name: agentName,
              workspaceId: workspace.id,
            });

            // Attach the skill to the agent
            await agentService.attachSkill(agent.id, skill.id);

            // Attempt to delete the Skill — should be blocked
            const skillService = new SkillManagementService(prisma);
            await expect(
              skillService.delete(skill.id)
            ).rejects.toThrow();

            // Verify the error message contains reference information
            try {
              await skillService.delete(skill.id);
            } catch (err: any) {
              expect(err.message).toContain('Cannot delete skill');
              expect(err.message).toContain(agentName);
            }
          } finally {
            // Cleanup
            await prisma.agentSkill.deleteMany({
              where: { agent: { workspaceId: workspace.id } },
            });
            await prisma.agent.deleteMany({ where: { workspaceId: workspace.id } });
            await prisma.skillVersion.deleteMany({
              where: { skill: { name: { startsWith: 'test-skill-ref-' } } },
            });
            await prisma.skill.deleteMany({
              where: { name: { startsWith: 'test-skill-ref-' } },
            });
            await prisma.workspace.delete({ where: { id: workspace.id } });
          }
        }
      ),
      { numRuns: 10 }
    );
  }, 120000);

  it('包含 Agent 的 Workspace 删除应被阻止并返回引用列表', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          agentName: fc.string({ minLength: 1, maxLength: 30 }).map(
            (s) => `prop6-ws-${s.replace(/[\0\x00-\x1f]/g, 'x')}`
          ),
        }),
        async ({ agentName }) => {
          const workspace = await createTestWorkspace(`ws-${Date.now()}`);

          try {
            // Create an Agent in the workspace
            const agentService = new AgentManagementService(prisma);
            const agent = await agentService.createWorkspaceAgent({
              name: agentName,
              workspaceId: workspace.id,
            });

            // Attempt to delete the Workspace — should be blocked
            const workspaceService = new WorkspaceService(prisma);
            await expect(
              workspaceService.delete(workspace.id)
            ).rejects.toThrow();

            // Verify the error message contains reference information
            try {
              await workspaceService.delete(workspace.id);
            } catch (err: any) {
              expect(err.message).toContain('Cannot delete workspace');
              expect(err.message).toContain(agentName);
            }
          } finally {
            // Cleanup
            await prisma.agentSkill.deleteMany({
              where: { agent: { workspaceId: workspace.id } },
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
