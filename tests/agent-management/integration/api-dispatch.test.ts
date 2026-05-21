import { describe, it, expect, afterAll, beforeAll, afterEach } from 'vitest';
import { DispatchService, LlmCaller } from '../../../src/agent-management/dispatch-service';
import { AgentManagementService } from '../../../src/agent-management/agent-management-service';
import { getTestPrismaClient, disconnectTestClient } from '../../helpers/db-transaction';

const prisma = getTestPrismaClient();
let agentService: AgentManagementService;

// Mock LLM caller that returns a predictable response
const mockLlmCaller: LlmCaller = async (
  _systemPrompt: string,
  userMessage: string,
  _config: any
): Promise<string> => {
  return `Response to: ${userMessage.substring(0, 50)}`;
};

beforeAll(() => {
  process.env.ENCRYPTION_KEY = 'test-encryption-key-for-integration-tests!';
  agentService = new AgentManagementService(prisma);
});

afterEach(async () => {
  // Clean up in correct order
  await prisma.dispatchLog.deleteMany({
    where: { targetAgent: { name: { startsWith: 'integ-dispatch-' } } },
  });
  await prisma.agent.deleteMany({ where: { name: { startsWith: 'integ-dispatch-' } } });
  await prisma.workspace.deleteMany({ where: { name: { startsWith: 'integ-dispatch-ws-' } } });
});

afterAll(async () => {
  await disconnectTestClient();
});

describe('DispatchService 调度与日志集成测试', () => {
  /**
   * Validates: Requirements 3.3, 5.2
   * Tests dispatch routing, disabled agent handling, and log recording.
   */

  it('直接指定 targetAgentId 调度时 sourceAgentId 应为 null', async () => {
    const workspace = await prisma.workspace.create({
      data: {
        name: `integ-dispatch-ws-direct-${Date.now()}`,
        description: 'Test workspace',
        isPreset: false,
        isEnabled: true,
      },
    });

    const agent = await agentService.createWorkspaceAgent({
      name: 'integ-dispatch-direct-agent',
      workspaceId: workspace.id,
    });

    const dispatchService = new DispatchService(prisma, mockLlmCaller);

    const result = await dispatchService.dispatch({
      taskContent: 'Test direct dispatch task',
      targetAgentId: agent.id,
    });

    expect(result.status).toBe('success');
    expect(result.agentId).toBe(agent.id);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);

    // Verify log has sourceAgentId = null
    const log = await dispatchService.getLog(result.logId);
    expect(log).not.toBeNull();
    expect(log!.sourceAgentId).toBeNull();
    expect(log!.targetAgentId).toBe(agent.id);
    expect(log!.status).toBe('success');
    expect(log!.taskSummary).toBe('Test direct dispatch task');
  });

  it('通过 workspaceId 调度应路由到正确的 Agent', async () => {
    const workspace = await prisma.workspace.create({
      data: {
        name: `integ-dispatch-ws-route-${Date.now()}`,
        description: 'Test workspace',
        isPreset: false,
        isEnabled: true,
      },
    });

    const agent = await agentService.createWorkspaceAgent({
      name: 'integ-dispatch-routed-agent',
      workspaceId: workspace.id,
    });

    const dispatchService = new DispatchService(prisma, mockLlmCaller);

    const result = await dispatchService.dispatch({
      taskContent: 'Test workspace routing task',
      workspaceId: workspace.id,
    });

    expect(result.status).toBe('success');
    expect(result.agentId).toBe(agent.id);

    // Verify log
    const log = await dispatchService.getLog(result.logId);
    expect(log).not.toBeNull();
    expect(log!.targetAgentId).toBe(agent.id);
  });

  it('调度到禁用 Agent 应返回错误', async () => {
    const workspace = await prisma.workspace.create({
      data: {
        name: `integ-dispatch-ws-disabled-${Date.now()}`,
        description: 'Test workspace',
        isPreset: false,
        isEnabled: true,
      },
    });

    const agent = await agentService.createWorkspaceAgent({
      name: 'integ-dispatch-disabled-agent',
      workspaceId: workspace.id,
    });

    // Disable the agent
    await agentService.toggleEnabled(agent.id, false);

    const dispatchService = new DispatchService(prisma, mockLlmCaller);

    const result = await dispatchService.dispatch({
      taskContent: 'Task for disabled agent',
      targetAgentId: agent.id,
    });

    expect(result.status).toBe('error');
    expect(result.response).toContain('disabled');

    // Verify error log was created
    const log = await dispatchService.getLog(result.logId);
    expect(log).not.toBeNull();
    expect(log!.status).toBe('error');
    expect(log!.errorMessage).toContain('disabled');
  });

  it('getLogs 应支持按 agentId 和 status 过滤', async () => {
    const workspace = await prisma.workspace.create({
      data: {
        name: `integ-dispatch-ws-logs-${Date.now()}`,
        description: 'Test workspace',
        isPreset: false,
        isEnabled: true,
      },
    });

    const agent1 = await agentService.createWorkspaceAgent({
      name: 'integ-dispatch-logs-agent1',
      workspaceId: workspace.id,
    });

    const agent2 = await agentService.createWorkspaceAgent({
      name: 'integ-dispatch-logs-agent2',
      workspaceId: workspace.id,
    });

    const dispatchService = new DispatchService(prisma, mockLlmCaller);

    // Create dispatches to different agents
    await dispatchService.dispatch({
      taskContent: 'Task for agent 1',
      targetAgentId: agent1.id,
    });
    await dispatchService.dispatch({
      taskContent: 'Another task for agent 1',
      targetAgentId: agent1.id,
    });
    await dispatchService.dispatch({
      taskContent: 'Task for agent 2',
      targetAgentId: agent2.id,
    });

    // Filter by agentId
    const agent1Logs = await dispatchService.getLogs({ agentId: agent1.id });
    expect(agent1Logs.length).toBe(2);
    for (const log of agent1Logs) {
      expect(log.targetAgentId).toBe(agent1.id);
    }

    // Filter by status
    const successLogs = await dispatchService.getLogs({ status: 'success' });
    expect(successLogs.length).toBeGreaterThanOrEqual(3);
    for (const log of successLogs) {
      expect(log.status).toBe('success');
    }
  });
});
