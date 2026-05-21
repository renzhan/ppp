import { describe, it, expect, afterAll, beforeAll, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { ModelConfigService, CreateModelConfigInput } from '../../src/agent-management/model-config-service';
import { getTestPrismaClient, disconnectTestClient } from '../helpers/db-transaction';

beforeAll(() => {
  process.env.ENCRYPTION_KEY = 'test-encryption-key-for-model-config-tests!';
});

describe('Feature: agent-management, Property 3: Model 配置必填字段校验', () => {
  /**
   * Validates: Requirements 1.5
   *
   * For any Model config input where at least one required field (apiKey, baseUrl, modelName)
   * is empty or missing, the create operation should throw a validation error mentioning
   * the missing fields.
   */

  // We don't need a real DB for this — validation happens before any DB call
  const service = new ModelConfigService(null as any);

  it('缺失任一必填字段时 create 应抛出包含字段名的错误', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate a mask: at least one field is invalid (true = make it empty)
        fc.tuple(fc.boolean(), fc.boolean(), fc.boolean())
          .filter(([a, b, c]) => a || b || c),
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        async ([invalidApiKey, invalidBaseUrl, invalidModelName], validApiKey, validModelName) => {
          const input: CreateModelConfigInput = {
            name: 'test-config',
            apiKey: invalidApiKey ? '' : validApiKey,
            baseUrl: invalidBaseUrl ? '' : 'https://api.example.com/v1',
            modelName: invalidModelName ? '' : validModelName,
          };

          const expectedMissing: string[] = [];
          if (invalidApiKey) expectedMissing.push('apiKey');
          if (invalidBaseUrl) expectedMissing.push('baseUrl');
          if (invalidModelName) expectedMissing.push('modelName');

          await expect(service.create(input)).rejects.toThrow(/Missing required fields/);

          try {
            await service.create(input);
          } catch (err: any) {
            // Verify each expected missing field is mentioned in the error
            for (const field of expectedMissing) {
              expect(err.message).toContain(field);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Feature: agent-management, Property 4: Base URL 格式校验', () => {
  /**
   * Validates: Requirements 1.3
   *
   * For any string that is NOT a valid HTTP/HTTPS URL, the create operation
   * should throw an error about invalid URL format.
   * Valid URLs (starting with http:// or https://) should pass URL validation.
   */

  const service = new ModelConfigService(null as any);

  it('非法 URL（不以 http:// 或 https:// 开头）应被拒绝', async () => {
    // Generate strings that do NOT start with http:// or https://
    const invalidUrlArb = fc.string({ minLength: 1, maxLength: 200 })
      .filter((s) => !s.startsWith('http://') && !s.startsWith('https://'));

    await fc.assert(
      fc.asyncProperty(
        invalidUrlArb,
        async (invalidUrl) => {
          const input: CreateModelConfigInput = {
            name: 'test-config',
            apiKey: 'sk-valid-api-key-12345',
            baseUrl: invalidUrl,
            modelName: 'gpt-4',
          };

          // If the URL is empty/whitespace, it will fail with "Missing required fields"
          // If it's non-empty but invalid format, it will fail with "Invalid URL format"
          await expect(service.create(input)).rejects.toThrow();

          try {
            await service.create(input);
          } catch (err: any) {
            // Should mention either missing fields (if empty) or invalid URL format
            const isEmptyUrl = !invalidUrl || invalidUrl.trim() === '';
            if (isEmptyUrl) {
              expect(err.message).toContain('Missing required fields');
            } else {
              expect(err.message).toContain('Invalid URL format');
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('合法 URL（以 http:// 或 https:// 开头）应通过 URL 格式校验', async () => {
    // Generate valid URLs — they pass validation but will fail at DB level (no real DB)
    // Use a mock prisma that throws immediately on DB access to avoid hanging
    const mockPrisma = {
      modelConfig: {
        updateMany: () => { throw new Error('__mock_db_access__'); },
        create: () => { throw new Error('__mock_db_access__'); },
      },
    };
    const mockService = new ModelConfigService(mockPrisma as any);

    const validUrlArb = fc.oneof(
      fc.constant('https://api.openai.com/v1'),
      fc.constant('http://localhost:8080/api'),
      fc.stringOf(fc.char().filter((c) => c !== ' ' && c !== '\n' && c !== '\t'), { minLength: 1, maxLength: 50 })
        .map((s) => `https://${s}.com/v1`)
    );

    await fc.assert(
      fc.asyncProperty(
        validUrlArb,
        async (validUrl) => {
          const input: CreateModelConfigInput = {
            name: 'test-config',
            apiKey: 'sk-valid-api-key-12345',
            baseUrl: validUrl,
            modelName: 'gpt-4',
          };

          // With a mock prisma client, it will throw __mock_db_access__ when trying to call DB
          // but it should NOT throw a validation error about URL format or missing fields
          try {
            await mockService.create(input);
          } catch (err: any) {
            // Should NOT be a URL validation error — it should be the mock DB error
            expect(err.message).not.toContain('Invalid URL format');
            expect(err.message).not.toContain('Missing required fields');
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Feature: agent-management, Property 5: 默认 Model 配置唯一性', () => {
  /**
   * Validates: Requirements 1.6
   *
   * For any sequence of model config creations and setDefault calls,
   * at most one config should have isDefault=true at any given time.
   */

  const prisma = getTestPrismaClient();

  afterAll(async () => {
    await disconnectTestClient();
  });

  beforeEach(async () => {
    // Clean up model configs created by tests
    await prisma.modelConfig.deleteMany({
      where: { name: { startsWith: 'prop5-test-' } },
    });
  });

  it('任意时刻最多一个 isDefault=true 的配置', async () => {
    const service = new ModelConfigService(prisma);

    await fc.assert(
      fc.asyncProperty(
        // Generate a sequence of 2-5 configs to create, then pick one to set as default
        fc.integer({ min: 2, max: 5 }),
        fc.integer({ min: 0, max: 4 }), // index of which config to set as default
        async (configCount, defaultIndex) => {
          // Clean state
          await prisma.modelConfig.deleteMany({
            where: { name: { startsWith: 'prop5-test-' } },
          });

          const createdIds: string[] = [];

          // Create multiple configs
          for (let i = 0; i < configCount; i++) {
            const config = await service.create({
              name: `prop5-test-config-${i}-${Date.now()}`,
              apiKey: `sk-test-key-${i}`,
              baseUrl: 'https://api.openai.com/v1',
              modelName: `gpt-4-${i}`,
              isDefault: i === 0, // first one is default
            });
            createdIds.push(config.id);
          }

          // Set a random config as default
          const targetIdx = defaultIndex % configCount;
          await service.setDefault(createdIds[targetIdx]);

          // Verify: at most one config has isDefault=true (across ALL configs in DB)
          const defaultConfigs = await prisma.modelConfig.findMany({
            where: { isDefault: true },
          });

          expect(defaultConfigs.length).toBeLessThanOrEqual(1);

          // Verify: the one that is default is the one we just set
          if (defaultConfigs.length === 1) {
            expect(defaultConfigs[0].id).toBe(createdIds[targetIdx]);
          }
        }
      ),
      { numRuns: 10 }
    );
  }, 120000);
});
