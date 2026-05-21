import { describe, it, expect, afterAll, beforeAll, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { seedAgentManagement } from '../../src/agent-management/seed';
import { getTestPrismaClient, disconnectTestClient } from '../helpers/db-transaction';

const prisma = getTestPrismaClient();

beforeAll(() => {
  // Set a stable encryption key for testing (needed by ModelConfigService in Property 20)
  process.env.ENCRYPTION_KEY = 'test-encryption-key-for-property-tests-32bytes!';
});

/**
 * Clean up preset workspace records to ensure test isolation.
 * Only cleans workspaces — seed does not create agents/skills/knowledge docs.
 */
async function cleanupPresetWorkspaces(): Promise<void> {
  await prisma.workspace.deleteMany({ where: { isPreset: true } });
}

describe('Feature: agent-management, Property 18: 工作区初始化幂等性', () => {
  /**
   * Validates: Requirements 7.3
   *
   * For any number of seed calls, the number of preset workspaces
   * should always be exactly 5, with no duplicate records.
   */

  afterAll(async () => {
    await cleanupPresetWorkspaces();
    await disconnectTestClient();
  });

  beforeEach(async () => {
    await cleanupPresetWorkspaces();
  });

  it('多次调用 seedAgentManagement 后预置工作区数量始终为 5', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 5 }),
        async (seedCallCount) => {
          // Clean state before each property iteration
          await cleanupPresetWorkspaces();

          // Call seed N times
          for (let i = 0; i < seedCallCount; i++) {
            await seedAgentManagement(prisma);
          }

          // Count preset workspaces — should always be exactly 5
          const presetCount = await prisma.workspace.count({
            where: { isPreset: true },
          });

          expect(presetCount).toBe(5);

          // Verify no duplicate names among preset workspaces
          const presetWorkspaces = await prisma.workspace.findMany({
            where: { isPreset: true },
            select: { name: true },
          });
          const names = presetWorkspaces.map((w) => w.name);
          const uniqueNames = new Set(names);
          expect(uniqueNames.size).toBe(5);
        }
      ),
      { numRuns: 10 }
    );
  }, 120000);
});


// ===== Property 19 & 20 Tests =====

import { AgentManagementService } from '../../src/agent-management/agent-management-service';
import { SkillManagementService } from '../../src/agent-management/skill-management-service';
import { WorkspaceService } from '../../src/agent-management/workspace-service';
import { ModelConfigService } from '../../src/agent-management/model-config-service';

describe('Feature: agent-management, Property 19: 资源按工作区分组正确性', () => {
  /**
   * Validates: Requirements 8.2, 8.3, 8.4
   *
   * For any set of Agents/Skills created in different workspaces,
   * querying by workspace should return each entity only in its own workspace group.
   */

  const agentService = new AgentManagementService(prisma);
  const skillService = new SkillManagementService(prisma);
  const workspaceService = new WorkspaceService(prisma);

  // Track created resources for cleanup
  const createdAgentIds: string[] = [];
  const createdSkillIds: string[] = [];
  const createdWorkspaceIds: string[] = [];

  afterAll(async () => {
    // Batch cleanup using deleteMany for speed
    if (createdAgentIds.length > 0) {
      await prisma.agent.deleteMany({ where: { id: { in: createdAgentIds } } });
    }
    if (createdSkillIds.length > 0) {
      await prisma.skillVersion.deleteMany({ where: { skillId: { in: createdSkillIds } } });
      await prisma.skill.deleteMany({ where: { id: { in: createdSkillIds } } });
    }
    if (createdWorkspaceIds.length > 0) {
      await prisma.workspace.deleteMany({ where: { id: { in: createdWorkspaceIds } } });
    }
  });

  it('每个 Agent/Skill 应出现在且仅出现在其所属工作区分组中', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate 2-3 workspace names and agent/skill assignments
        fc.integer({ min: 2, max: 3 }),
        fc.integer({ min: 1, max: 2 }), // agents per workspace
        fc.integer({ min: 1, max: 2 }), // skills per workspace
        async (workspaceCount, agentsPerWs, skillsPerWs) => {
          // Create workspaces
          const workspaces: Array<{ id: string; name: string }> = [];
          for (let i = 0; i < workspaceCount; i++) {
            const ws = await workspaceService.create({
              name: `test-ws-p19-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`,
              description: `Test workspace ${i}`,
            });
            workspaces.push({ id: ws.id, name: ws.name });
            createdWorkspaceIds.push(ws.id);
          }

          // Create agents in each workspace
          const agentsByWorkspace: Record<string, string[]> = {};
          for (const ws of workspaces) {
            agentsByWorkspace[ws.id] = [];
            for (let j = 0; j < agentsPerWs; j++) {
              const agent = await agentService.createWorkspaceAgent({
                name: `agent-p19-${ws.name}-${j}-${Math.random().toString(36).slice(2, 8)}`,
                workspaceId: ws.id,
              });
              agentsByWorkspace[ws.id].push(agent.id);
              createdAgentIds.push(agent.id);
            }
          }

          // Create workspace-scoped skills in each workspace
          const skillsByWorkspace: Record<string, string[]> = {};
          for (const ws of workspaces) {
            skillsByWorkspace[ws.id] = [];
            for (let j = 0; j < skillsPerWs; j++) {
              const skill = await skillService.create({
                name: `skill-p19-${ws.name}-${j}-${Math.random().toString(36).slice(2, 8)}`,
                description: 'Test skill',
                content: '# Test content',
                scope: 'workspace',
                workspaceId: ws.id,
              });
              skillsByWorkspace[ws.id].push(skill.id);
              createdSkillIds.push(skill.id);
            }
          }

          // Verify: each agent appears only in its own workspace group
          for (const ws of workspaces) {
            const wsAgents = await agentService.findByWorkspace(ws.id);
            const wsAgentIds = wsAgents.map((a) => a.id);

            // All agents created for this workspace should be present
            for (const expectedId of agentsByWorkspace[ws.id]) {
              expect(wsAgentIds).toContain(expectedId);
            }

            // Agents from other workspaces should NOT be present
            for (const otherWs of workspaces) {
              if (otherWs.id === ws.id) continue;
              for (const otherId of agentsByWorkspace[otherWs.id]) {
                expect(wsAgentIds).not.toContain(otherId);
              }
            }
          }

          // Verify: each skill appears only in its own workspace group
          for (const ws of workspaces) {
            const wsSkills = await skillService.findAll({ workspaceId: ws.id });
            const wsSkillIds = wsSkills.map((s) => s.id);

            // All skills created for this workspace should be present
            for (const expectedId of skillsByWorkspace[ws.id]) {
              expect(wsSkillIds).toContain(expectedId);
            }

            // Skills from other workspaces should NOT be present
            for (const otherWs of workspaces) {
              if (otherWs.id === ws.id) continue;
              for (const otherId of skillsByWorkspace[otherWs.id]) {
                expect(wsSkillIds).not.toContain(otherId);
              }
            }
          }
        }
      ),
      { numRuns: 5 }
    );
  }, 120000);
});

describe('Feature: agent-management, Property 20: 时间戳自动填充', () => {
  /**
   * Validates: Requirements 10.6
   *
   * For any newly created record (ModelConfig, Agent, Skill, Workspace),
   * createdAt and updatedAt should be valid Date objects and createdAt <= updatedAt.
   */

  const agentService = new AgentManagementService(prisma);
  const skillService = new SkillManagementService(prisma);
  const workspaceService = new WorkspaceService(prisma);
  const modelConfigService = new ModelConfigService(prisma);

  // Track created resources for cleanup
  const createdAgentIds: string[] = [];
  const createdSkillIds: string[] = [];
  const createdWorkspaceIds: string[] = [];
  const createdModelConfigIds: string[] = [];

  afterAll(async () => {
    // Batch cleanup using deleteMany for speed
    if (createdAgentIds.length > 0) {
      await prisma.agent.deleteMany({ where: { id: { in: createdAgentIds } } });
    }
    if (createdSkillIds.length > 0) {
      await prisma.skillVersion.deleteMany({ where: { skillId: { in: createdSkillIds } } });
      await prisma.skill.deleteMany({ where: { id: { in: createdSkillIds } } });
    }
    if (createdModelConfigIds.length > 0) {
      await prisma.modelConfig.deleteMany({ where: { id: { in: createdModelConfigIds } } });
    }
    if (createdWorkspaceIds.length > 0) {
      await prisma.workspace.deleteMany({ where: { id: { in: createdWorkspaceIds } } });
    }
  });

  it('新记录的 createdAt/updatedAt 应自动填充且 createdAt ≤ updatedAt', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate a random suffix to ensure unique names
        fc.stringMatching(/^[a-z]{4,8}$/),
        async (suffix) => {
          const timestamp = Date.now();
          const uniqueId = `${timestamp}-${suffix}`;

          // Create a workspace
          const workspace = await workspaceService.create({
            name: `ws-p20-${uniqueId}`,
            description: 'Timestamp test workspace',
          });
          createdWorkspaceIds.push(workspace.id);

          expect(workspace.createdAt).toBeInstanceOf(Date);
          expect(workspace.updatedAt).toBeInstanceOf(Date);
          expect(workspace.createdAt.getTime()).toBeLessThanOrEqual(workspace.updatedAt.getTime());

          // Create an agent in the workspace
          const agent = await agentService.createWorkspaceAgent({
            name: `agent-p20-${uniqueId}`,
            workspaceId: workspace.id,
          });
          createdAgentIds.push(agent.id);

          expect(agent.createdAt).toBeInstanceOf(Date);
          expect(agent.updatedAt).toBeInstanceOf(Date);
          expect(agent.createdAt.getTime()).toBeLessThanOrEqual(agent.updatedAt.getTime());

          // Create a skill
          const skill = await skillService.create({
            name: `skill-p20-${uniqueId}`,
            description: 'Timestamp test skill',
            content: '# Test',
            scope: 'workspace',
            workspaceId: workspace.id,
          });
          createdSkillIds.push(skill.id);

          expect(skill.createdAt).toBeInstanceOf(Date);
          expect(skill.updatedAt).toBeInstanceOf(Date);
          expect(skill.createdAt.getTime()).toBeLessThanOrEqual(skill.updatedAt.getTime());

          // Create a model config
          const modelConfig = await modelConfigService.create({
            name: `model-p20-${uniqueId}`,
            apiKey: `sk-test-key-${uniqueId}`,
            baseUrl: 'https://api.example.com/v1',
            modelName: 'gpt-4',
          });
          createdModelConfigIds.push(modelConfig.id);

          expect(modelConfig.createdAt).toBeInstanceOf(Date);
          expect(modelConfig.updatedAt).toBeInstanceOf(Date);
          expect(modelConfig.createdAt.getTime()).toBeLessThanOrEqual(modelConfig.updatedAt.getTime());
        }
      ),
      { numRuns: 10 }
    );
  }, 120000);
});
