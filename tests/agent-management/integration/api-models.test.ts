import { describe, it, expect, afterAll, beforeAll, afterEach } from 'vitest';
import { ModelConfigService } from '../../../src/agent-management/model-config-service';
import { AgentManagementService } from '../../../src/agent-management/agent-management-service';
import { getTestPrismaClient, disconnectTestClient } from '../../helpers/db-transaction';

const prisma = getTestPrismaClient();
let modelService: ModelConfigService;
let agentService: AgentManagementService;

beforeAll(() => {
  process.env.ENCRYPTION_KEY = 'test-encryption-key-for-integration-tests!';
  modelService = new ModelConfigService(prisma);
  agentService = new AgentManagementService(prisma);
});

afterEach(async () => {
  // Clean up test data
  await prisma.agent.deleteMany({ where: { name: { startsWith: 'integ-model-' } } });
  await prisma.modelConfig.deleteMany({ where: { name: { startsWith: 'integ-model-' } } });
  await prisma.workspace.deleteMany({ where: { name: { startsWith: 'integ-model-ws-' } } });
});

afterAll(async () => {
  await disconnectTestClient();
});

describe('ModelConfigService CRUD 集成测试', () => {
  /**
   * Validates: Requirements 1.1
   * Tests the complete CRUD flow for Model configurations.
   */

  it('创建 Model 配置后应能查询到', async () => {
    const config = await modelService.create({
      name: 'integ-model-create-test',
      apiKey: 'sk-test-key-12345678',
      baseUrl: 'https://api.openai.com/v1',
      modelName: 'gpt-4',
      timeoutMs: 60000,
      maxRetries: 3,
    });

    expect(config.id).toBeDefined();
    expect(config.name).toBe('integ-model-create-test');
    expect(config.baseUrl).toBe('https://api.openai.com/v1');
    expect(config.modelName).toBe('gpt-4');
    expect(config.timeoutMs).toBe(60000);
    expect(config.maxRetries).toBe(3);

    // Verify persisted
    const found = await modelService.findById(config.id);
    expect(found).not.toBeNull();
    expect(found!.name).toBe('integ-model-create-test');
  });

  it('更新 Model 配置后应反映变更', async () => {
    const config = await modelService.create({
      name: 'integ-model-update-test',
      apiKey: 'sk-test-key-update',
      baseUrl: 'https://api.openai.com/v1',
      modelName: 'gpt-4',
    });

    const updated = await modelService.update(config.id, {
      name: 'integ-model-update-test-v2',
      baseUrl: 'https://api.anthropic.com/v1',
      modelName: 'claude-3',
      timeoutMs: 45000,
    });

    expect(updated.name).toBe('integ-model-update-test-v2');
    expect(updated.baseUrl).toBe('https://api.anthropic.com/v1');
    expect(updated.modelName).toBe('claude-3');
    expect(updated.timeoutMs).toBe(45000);
  });

  it('设为默认后应确保只有一个默认配置', async () => {
    const config1 = await modelService.create({
      name: 'integ-model-default-1',
      apiKey: 'sk-key-1',
      baseUrl: 'https://api.openai.com/v1',
      modelName: 'gpt-4',
      isDefault: true,
    });

    const config2 = await modelService.create({
      name: 'integ-model-default-2',
      apiKey: 'sk-key-2',
      baseUrl: 'https://api.openai.com/v1',
      modelName: 'gpt-3.5',
    });

    // Set config2 as default
    await modelService.setDefault(config2.id);

    // Verify only config2 is default
    const defaultConfig = await modelService.getDefault();
    expect(defaultConfig).not.toBeNull();
    expect(defaultConfig!.id).toBe(config2.id);

    // Verify config1 is no longer default
    const config1After = await modelService.findById(config1.id);
    expect(config1After!.isDefault).toBe(false);
  });

  it('删除 Model 配置后应不再存在', async () => {
    const config = await modelService.create({
      name: 'integ-model-delete-test',
      apiKey: 'sk-key-delete',
      baseUrl: 'https://api.openai.com/v1',
      modelName: 'gpt-4',
    });

    await modelService.delete(config.id);

    const found = await modelService.findById(config.id);
    expect(found).toBeNull();
  });

  it('删除被 Agent 引用的 Model 配置应被阻止', async () => {
    const config = await modelService.create({
      name: 'integ-model-ref-test',
      apiKey: 'sk-key-ref',
      baseUrl: 'https://api.openai.com/v1',
      modelName: 'gpt-4',
    });

    // Create a workspace and agent referencing this config
    const workspace = await prisma.workspace.create({
      data: {
        name: 'integ-model-ws-ref',
        description: 'Test workspace',
        isPreset: false,
        isEnabled: true,
      },
    });

    await agentService.createWorkspaceAgent({
      name: 'integ-model-agent-ref',
      workspaceId: workspace.id,
      modelConfigId: config.id,
    });

    // Attempt to delete should be blocked
    await expect(modelService.delete(config.id)).rejects.toThrow(
      /Cannot delete model config.*referenced by agents/
    );

    // Config should still exist
    const found = await modelService.findById(config.id);
    expect(found).not.toBeNull();
  });
});
