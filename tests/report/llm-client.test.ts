import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAILLMClient, type LLMConfig } from '../../src/report/llm-client.js';
import type { ChatMessage } from '../../src/shared/types.js';

// Mock the OpenAI module
vi.mock('openai', () => {
  const mockCreate = vi.fn();
  return {
    default: class MockOpenAI {
      chat = {
        completions: {
          create: mockCreate,
        },
      };
      constructor() {}
    },
    __mockCreate: mockCreate,
  };
});

// Access the mock function
async function getMockCreate() {
  const mod = await import('openai');
  return (mod as any).__mockCreate as ReturnType<typeof vi.fn>;
}

const testConfig: LLMConfig = {
  baseURL: 'https://aiop-gateway.item.com/proxy/openai/v1',
  model: 'gpt-5.1',
  apiKey: 'test-api-key',
};

const testMessages: ChatMessage[] = [
  { role: 'system', content: 'You are a helpful assistant.' },
  { role: 'user', content: 'Hello' },
];

describe('OpenAILLMClient', () => {
  let mockCreate: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    mockCreate = await getMockCreate();
    mockCreate.mockReset();
  });

  describe('chat - successful call', () => {
    it('should return content from LLM on first attempt', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: '你好！有什么可以帮助你的？' } }],
      });

      const client = new OpenAILLMClient(testConfig);
      const result = await client.chat(testMessages);

      expect(result).toBe('你好！有什么可以帮助你的？');
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('should pass temperature and maxTokens to the API', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'response' } }],
      });

      const client = new OpenAILLMClient(testConfig);
      await client.chat(testMessages, { temperature: 0.7, maxTokens: 500 });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-5.1',
          temperature: 0.7,
          max_tokens: 500,
        }),
        expect.objectContaining({
          timeout: 120000,
        }),
      );
    });

    it('should use custom timeout from options', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'response' } }],
      });

      const client = new OpenAILLMClient(testConfig);
      await client.chat(testMessages, { timeout: 10000 });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          timeout: 10000,
        }),
      );
    });

    it('should use default 120s timeout when not specified', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'response' } }],
      });

      const client = new OpenAILLMClient(testConfig);
      await client.chat(testMessages);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          timeout: 120000,
        }),
      );
    });
  });

  describe('chat - retry behavior', () => {
    it('should retry once on first failure and return result on success', async () => {
      mockCreate
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          choices: [{ message: { content: '重试成功' } }],
        });

      const client = new OpenAILLMClient(testConfig);
      const result = await client.chat(testMessages);

      expect(result).toBe('重试成功');
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it('should retry once when LLM returns empty response', async () => {
      mockCreate
        .mockResolvedValueOnce({
          choices: [{ message: { content: null } }],
        })
        .mockResolvedValueOnce({
          choices: [{ message: { content: '第二次成功' } }],
        });

      const client = new OpenAILLMClient(testConfig);
      const result = await client.chat(testMessages);

      expect(result).toBe('第二次成功');
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });
  });

  describe('chat - error behavior', () => {
    it('should throw error when both attempts fail', async () => {
      mockCreate
        .mockRejectedValueOnce(new Error('First failure'))
        .mockRejectedValueOnce(new Error('Second failure'));

      const client = new OpenAILLMClient(testConfig);

      await expect(client.chat(testMessages)).rejects.toThrow('LLM调用失败(重试后仍失败): Second failure');
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it('should throw error when both attempts return empty content', async () => {
      mockCreate
        .mockResolvedValueOnce({
          choices: [{ message: { content: null } }],
        })
        .mockResolvedValueOnce({
          choices: [{ message: { content: '' } }],
        });

      const client = new OpenAILLMClient(testConfig);

      await expect(client.chat(testMessages)).rejects.toThrow('LLM调用失败(重试后仍失败)');
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it('should throw error when both attempts timeout', async () => {
      mockCreate
        .mockRejectedValueOnce(new Error('Request timed out'))
        .mockRejectedValueOnce(new Error('Request timed out'));

      const client = new OpenAILLMClient(testConfig);

      await expect(client.chat(testMessages, { timeout: 1000 })).rejects.toThrow('LLM调用失败(重试后仍失败): Request timed out');
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });
  });

  describe('chat - message formatting', () => {
    it('should pass messages with correct role and content', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'ok' } }],
      });

      const messages: ChatMessage[] = [
        { role: 'system', content: 'System prompt' },
        { role: 'user', content: 'User message' },
        { role: 'assistant', content: 'Previous response' },
      ];

      const client = new OpenAILLMClient(testConfig);
      await client.chat(messages);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            { role: 'system', content: 'System prompt' },
            { role: 'user', content: 'User message' },
            { role: 'assistant', content: 'Previous response' },
          ],
        }),
        expect.anything(),
      );
    });
  });
});
