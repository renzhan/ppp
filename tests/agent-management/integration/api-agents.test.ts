import { describe, it, expect, afterAll, beforeAll, afterEach } from 'vitest';
import { AgentManagementService } from '../../../src/agent-management/agent-management-service';
import { SkillManagementService } from '../../../src/agent-management/skill-management-service';
import { getTestPrismaClient, disconnectTestClient } from '../../helpers/db-transaction';

const prisma = getTestPrismaClient();
let agentService: AgentManagementService;
let skillService: SkillManagementService;

beforeAll(() => {
  process.env.ENCRYPTION_KEY = 'test-encryption-key-for-integration-tests!';
  agentService = new AgentManagementService(prisma);
  skillService = new SkillManagementService(prisma);
});

afterEach(async () => {
  // Clean up in correct order (respect FK constraints)
  await prisma.agentSkill.deleteMany({
    where: { agent: { name: { startsWith: 'integ-agent-' } } },
  });
  await prisma.agent.deleteMany({ where: { name: { startsWith: 'integ-agent-' } } });
  await prisma.skill.deleteMany({ where: { name: { startsWith: 'integ-agent-skill-' } } });
  await prisma.workspace.deleteMany({ where: { name: { startsWith: 'integ-agent-ws-' } } });
});

afterAll(async () => {
  await disconnectTestClient();
});

describe('AgentManagementService 集成测试', () => {
  /**
   * Validates: Requirements 2.2
   * Tests Agent creation, skill attachment, toggle, and deletion flows.
   */

  it('创建 Workspace Agent 后应能查询到', async () => {
    const workspace = await prisma.workspace.create({
      data: {
        name: `integ-agent-ws-create-${Date.now()}`,
        description: 'Test workspace',
        isPreset: false,
        isEnabled: true,
      },
    });

    const agent = await agentService.createWorkspaceAgent({
      name: 'integ-agent-create-test',
      description: 'Integration test agent',
      workspaceId: workspace.id,
      systemPrompt: 'You are a test agent.',
    });

    expect(agent.id).toBeDefined();
    expect(agent.name).toBe('integ-agent-create-test');
    expect(agent.type).toBe('workspace');
    expect(agent.workspaceId).toBe(workspace.id);
    expect(agent.isEnabled).toBe(true);

    // Verify persisted via findById
    const found = await agentService.findById(agent.id);
    expect(found).not.toBeNull();
    expect(found!.name).toBe('integ-agent-create-test');
    expect(found!.description).toBe('Integration test agent');
    expect(found!.systemPrompt).toBe('You are a test agent.');
  });

  it('关联 Skill 后应在 Agent 详情中可见', async () => {
    const workspace = await prisma.workspace.create({
      data: {
        name: `integ-agent-ws-skill-${Date.now()}`,
        description: 'Test workspace',
        isPreset: false,
        isEnabled: true,
      },
    });

    const agent = await agentService.createWorkspaceAgent({
      name: 'integ-agent-attach-skill',
      workspaceId: workspace.id,
    });

    // Create a public skill
    const skill = await skillService.create({
      name: 'integ-agent-skill-public',
      description: 'A public skill for testing',
      content: '# Test Skill\nDo something useful.',
      scope: 'public',
    });

    // Attach skill to agent
    await agentService.attachSkill(agent.id, skill.id);

    // Verify skill is visible in agent detail
    const detail = await agentService.findById(agent.id);
    expect(detail).not.toBeNull();
    expect(detail!.skills).toHaveLength(1);
    expect(detail!.skills[0].id).toBe(skill.id);
    expect(detail!.skills[0].name).toBe('integ-agent-skill-public');
  });

  it('取消关联 Skill 后应不再可见', async () => {
    const workspace = await prisma.workspace.create({
      data: {
        name: `integ-agent-ws-detach-${Date.now()}`,
        description: 'Test workspace',
        isPreset: false,
        isEnabled: true,
      },
    });

    const agent = await agentService.createWorkspaceAgent({
      name: 'integ-agent-detach-skill',
      workspaceId: workspace.id,
    });

    const skill = await skillService.create({
      name: 'integ-agent-skill-detach',
      description: 'Skill to detach',
      content: '# Detach Test',
      scope: 'public',
    });

    // Attach then detach
    await agentService.attachSkill(agent.id, skill.id);
    await agentService.detachSkill(agent.id, skill.id);

    // Verify skill is no longer associated
    const detail = await agentService.findById(agent.id);
    expect(detail).not.toBeNull();
    expect(detail!.skills).toHaveLength(0);
  });

  it('切换启用/禁用状态应正确反映', async () => {
    const workspace = await prisma.workspace.create({
      data: {
        name: `integ-agent-ws-toggle-${Date.now()}`,
        description: 'Test workspace',
        isPreset: false,
        isEnabled: true,
      },
    });

    const agent = await agentService.createWorkspaceAgent({
      name: 'integ-agent-toggle-test',
      workspaceId: workspace.id,
    });

    expect(agent.isEnabled).toBe(true);

    // Disable
    const disabled = await agentService.toggleEnabled(agent.id, false);
    expect(disabled.isEnabled).toBe(false);

    // Re-enable
    const enabled = await agentService.toggleEnabled(agent.id, true);
    expect(enabled.isEnabled).toBe(true);
  });

  it('删除 Agent 后应不再存在', async () => {
    const workspace = await prisma.workspace.create({
      data: {
        name: `integ-agent-ws-delete-${Date.now()}`,
        description: 'Test workspace',
        isPreset: false,
        isEnabled: true,
      },
    });

    const agent = await agentService.createWorkspaceAgent({
      name: 'integ-agent-delete-test',
      workspaceId: workspace.id,
    });

    const result = await agentService.delete(agent.id);
    // Since it's the only agent in the workspace, we get a warning
    expect(result.warning).toBeDefined();

    const found = await agentService.findById(agent.id);
    expect(found).toBeNull();
  });
});
