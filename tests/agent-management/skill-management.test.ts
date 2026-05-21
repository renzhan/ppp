import { describe, it, expect, afterAll, beforeAll, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { SkillManagementService } from '../../src/agent-management/skill-management-service';
import { AgentManagementService } from '../../src/agent-management/agent-management-service';
import { getTestPrismaClient, disconnectTestClient } from '../helpers/db-transaction';

beforeAll(() => {
  process.env.ENCRYPTION_KEY = 'test-encryption-key-for-skill-mgmt-tests!';
});

const prisma = getTestPrismaClient();

// Helper: create a workspace for tests
async function createTestWorkspace(suffix: string) {
  return prisma.workspace.create({
    data: {
      name: `test-ws-skill-${suffix}-${Date.now()}`,
      description: 'Test workspace for skill management tests',
      isPreset: false,
      isEnabled: true,
    },
  });
}

// Cleanup helper
async function cleanupTestData() {
  await prisma.agentSkill.deleteMany({
    where: {
      agent: { name: { startsWith: 'prop' } },
    },
  });
  await prisma.skillVersion.deleteMany({
    where: {
      skill: { name: { startsWith: 'prop' } },
    },
  });
  await prisma.skill.deleteMany({
    where: { name: { startsWith: 'prop' } },
  });
  await prisma.agent.deleteMany({
    where: { name: { startsWith: 'prop' } },
  });
  await prisma.workspace.deleteMany({
    where: { name: { startsWith: 'test-ws-skill-' } },
  });
}

describe('Feature: agent-management, Property 13: Skill 作用域访问控制', () => {
  /**
   * Validates: Requirements 4.2, 4.3
   *
   * For any scope="public" Skill, any Agent should be able to attach it.
   * For any scope="workspace" Skill, only Agents in the same workspace can attach it;
   * Agents in other workspaces should be rejected.
   */

  const skillService = new SkillManagementService(prisma);
  const agentService = new AgentManagementService(prisma);

  beforeEach(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await disconnectTestClient();
  });

  it('public Skill 任何 Agent 可关联，workspace Skill 仅同工作区 Agent 可关联', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          publicSkillName: fc.string({ minLength: 1, maxLength: 30 }).map((s) => `prop13-pub-${s.replace(/\0/g, '')}`),
          wsSkillName: fc.string({ minLength: 1, maxLength: 30 }).map((s) => `prop13-ws-${s.replace(/\0/g, '')}`),
          agentNameA: fc.string({ minLength: 1, maxLength: 30 }).map((s) => `prop13-agA-${s.replace(/\0/g, '')}`),
          agentNameB: fc.string({ minLength: 1, maxLength: 30 }).map((s) => `prop13-agB-${s.replace(/\0/g, '')}`),
        }),
        async ({ publicSkillName, wsSkillName, agentNameA, agentNameB }) => {
          // Create two workspaces
          const workspaceA = await createTestWorkspace(`p13a-${Date.now()}`);
          const workspaceB = await createTestWorkspace(`p13b-${Date.now()}`);

          try {
            // Create a public skill
            const publicSkill = await skillService.create({
              name: publicSkillName,
              description: 'Public skill for testing',
              content: '# Public Skill Content',
              scope: 'public',
            });

            // Create a workspace-scoped skill in workspace A
            const wsSkill = await skillService.create({
              name: wsSkillName,
              description: 'Workspace skill for testing',
              content: '# Workspace Skill Content',
              scope: 'workspace',
              workspaceId: workspaceA.id,
            });

            // Create agents in both workspaces
            const agentA = await agentService.createWorkspaceAgent({
              name: agentNameA,
              workspaceId: workspaceA.id,
            });

            const agentB = await agentService.createWorkspaceAgent({
              name: agentNameB,
              workspaceId: workspaceB.id,
            });

            // Public skill can be attached to agent in workspace A
            await agentService.attachSkill(agentA.id, publicSkill.id);

            // Public skill can be attached to agent in workspace B
            await agentService.attachSkill(agentB.id, publicSkill.id);

            // Workspace-scoped skill can be attached to agent in workspace A (same workspace)
            await agentService.attachSkill(agentA.id, wsSkill.id);

            // Workspace-scoped skill should NOT be attachable to agent in workspace B (different workspace)
            await expect(
              agentService.attachSkill(agentB.id, wsSkill.id)
            ).rejects.toThrow();
          } finally {
            // Cleanup
            await prisma.agentSkill.deleteMany({
              where: {
                agent: { workspaceId: { in: [workspaceA.id, workspaceB.id] } },
              },
            });
            await prisma.skillVersion.deleteMany({
              where: {
                skill: { name: { in: [publicSkillName, wsSkillName] } },
              },
            });
            await prisma.skill.deleteMany({
              where: { name: { in: [publicSkillName, wsSkillName] } },
            });
            await prisma.agent.deleteMany({
              where: { workspaceId: { in: [workspaceA.id, workspaceB.id] } },
            });
            await prisma.workspace.deleteMany({
              where: { id: { in: [workspaceA.id, workspaceB.id] } },
            });
          }
        }
      ),
      { numRuns: 10 }
    );
  }, 120000);
});

describe('Feature: agent-management, Property 14: Skill 注入系统提示词', () => {
  /**
   * Validates: Requirements 4.4
   *
   * For any Agent with associated Skills, calling buildSystemPrompt should
   * produce a result that contains each skill's content.
   */

  const skillService = new SkillManagementService(prisma);
  const agentService = new AgentManagementService(prisma);

  beforeEach(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it('buildSystemPrompt 应包含所有关联 Skill 的 content', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          agentName: fc.string({ minLength: 1, maxLength: 30 }).map((s) => `prop14-ag-${s.replace(/\0/g, '')}`),
          systemPrompt: fc.string({ minLength: 1, maxLength: 100 }),
          skillContents: fc.array(
            fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
            { minLength: 1, maxLength: 4 }
          ),
        }),
        async ({ agentName, systemPrompt, skillContents }) => {
          const workspace = await createTestWorkspace(`p14-${Date.now()}`);

          try {
            // Create an agent with a systemPrompt
            const agent = await agentService.createWorkspaceAgent({
              name: agentName,
              workspaceId: workspace.id,
              systemPrompt,
            });

            // Create multiple skills and attach them
            const skillIds: string[] = [];
            for (let i = 0; i < skillContents.length; i++) {
              const skill = await skillService.create({
                name: `prop14-skill-${i}-${Date.now()}`,
                description: `Skill ${i}`,
                content: skillContents[i],
                scope: 'public',
              });
              skillIds.push(skill.id);
              await agentService.attachSkill(agent.id, skill.id);
            }

            // Build system prompt
            const builtPrompt = await agentService.buildSystemPrompt(agent.id);

            // Verify: the built prompt contains the agent's own systemPrompt
            expect(builtPrompt).toContain(systemPrompt);

            // Verify: the built prompt contains each skill's content
            for (const content of skillContents) {
              expect(builtPrompt).toContain(content);
            }
          } finally {
            // Cleanup
            await prisma.agentSkill.deleteMany({
              where: { agent: { workspaceId: workspace.id } },
            });
            await prisma.skillVersion.deleteMany({
              where: { skill: { name: { startsWith: 'prop14-skill-' } } },
            });
            await prisma.skill.deleteMany({
              where: { name: { startsWith: 'prop14-skill-' } },
            });
            await prisma.agent.deleteMany({
              where: { workspaceId: workspace.id },
            });
            await prisma.workspace.delete({ where: { id: workspace.id } });
          }
        }
      ),
      { numRuns: 10 }
    );
  }, 120000);
});

describe('Feature: agent-management, Property 15: Skill 版本历史保留', () => {
  /**
   * Validates: Requirements 4.5
   *
   * For any Skill updated N times, the version history should contain N+1 records
   * (initial v1 + N updates), version numbers should be sequential (1, 2, 3, ...),
   * and each version's content should match what was provided during that update.
   */

  const skillService = new SkillManagementService(prisma);

  beforeEach(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it('N 次更新后应有 N+1 条版本记录，version 递增，content 匹配', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          skillName: fc.string({ minLength: 1, maxLength: 30 }).map((s) => `prop15-${s.replace(/\0/g, '')}`),
          initialContent: fc.string({ minLength: 1, maxLength: 100 }),
          updates: fc.array(
            fc.string({ minLength: 1, maxLength: 100 }),
            { minLength: 1, maxLength: 5 }
          ),
        }),
        async ({ skillName, initialContent, updates }) => {
          try {
            // Create a skill (this creates v1)
            const skill = await skillService.create({
              name: skillName,
              description: 'Skill for version testing',
              content: initialContent,
              scope: 'public',
            });

            // Track all contents in order: initial + updates
            const allContents = [initialContent, ...updates];

            // Update the skill N times
            for (const content of updates) {
              await skillService.update(skill.id, { content });
            }

            // Get version history
            const versions = await skillService.getVersionHistory(skill.id);

            // Should have N+1 version records (initial + N updates)
            expect(versions.length).toBe(updates.length + 1);

            // Sort by version ascending for verification
            const sortedVersions = [...versions].sort((a, b) => a.version - b.version);

            // Version numbers should be sequential: 1, 2, 3, ...
            for (let i = 0; i < sortedVersions.length; i++) {
              expect(sortedVersions[i].version).toBe(i + 1);
            }

            // Each version's content should match what was provided
            for (let i = 0; i < sortedVersions.length; i++) {
              expect(sortedVersions[i].content).toBe(allContents[i]);
            }
          } finally {
            // Cleanup
            await prisma.skillVersion.deleteMany({
              where: { skill: { name: skillName } },
            });
            await prisma.skill.deleteMany({
              where: { name: skillName },
            });
          }
        }
      ),
      { numRuns: 10 }
    );
  }, 120000);
});
