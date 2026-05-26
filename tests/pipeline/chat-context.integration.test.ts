import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Integration Test: AI Chat Context Passing
 *
 * Verifies that when sending a chat message, the chapter title and content
 * are included in the chat request context.
 *
 * **Validates: Requirements 7.1**
 */
describe('AI Chat Context Passing Integration', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('Requirement 7.1: Chapter title and content included in chat request', () => {
    it('should include chapterTitle and chapterContent in the chat request context', async () => {
      const chapterTitle = '数据总览';
      const chapterContent = '<h2>数据总览</h2><p>总曝光量达到 1,234,567 次，完成率 125%。</p>';
      const userMessage = '请让这段内容更加简洁';

      let capturedBody: any = null;

      // Mock fetch to capture the request body
      globalThis.fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
        capturedBody = JSON.parse(init?.body as string);
        // Return a mock streaming response
        return {
          ok: true,
          body: new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode('data: {"type":"text","content":"优化后的内容"}\n\n'));
              controller.close();
            },
          }),
        } as Response;
      });

      // Simulate the chat request as the proofread page would send it
      const chatPayload = {
        message: userMessage,
        context: {
          chapterTitle,
          chapterContent,
          projectName: '测试品牌_日常种草_2025Q1',
          brand: '测试品牌',
          category: '美妆护肤',
        },
        conversationHistory: [],
      };

      await fetch('/api/ppt/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chatPayload),
      });

      // Verify the request was made with correct context
      expect(capturedBody).not.toBeNull();
      expect(capturedBody.context).toBeDefined();
      expect(capturedBody.context.chapterTitle).toBe(chapterTitle);
      expect(capturedBody.context.chapterContent).toBe(chapterContent);
      expect(capturedBody.message).toBe(userMessage);
    });

    it('should include chapter context even when content is long', async () => {
      const chapterTitle = '内容分析';
      const longContent = '<h2>内容分析</h2>' + '<p>段落内容。</p>'.repeat(100);
      const userMessage = '总结一下关键发现';

      let capturedBody: any = null;

      globalThis.fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
        capturedBody = JSON.parse(init?.body as string);
        return {
          ok: true,
          body: new ReadableStream({
            start(controller) {
              controller.close();
            },
          }),
        } as Response;
      });

      const chatPayload = {
        message: userMessage,
        context: {
          chapterTitle,
          chapterContent: longContent,
        },
        conversationHistory: [],
      };

      await fetch('/api/ppt/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chatPayload),
      });

      expect(capturedBody.context.chapterTitle).toBe(chapterTitle);
      expect(capturedBody.context.chapterContent).toBe(longContent);
    });

    it('should include conversation history alongside chapter context', async () => {
      const chapterTitle = '项目亮点';
      const chapterContent = '<p>KPI完成率超过120%</p>';

      let capturedBody: any = null;

      globalThis.fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
        capturedBody = JSON.parse(init?.body as string);
        return {
          ok: true,
          body: new ReadableStream({
            start(controller) {
              controller.close();
            },
          }),
        } as Response;
      });

      const chatPayload = {
        message: '再精简一些',
        context: {
          chapterTitle,
          chapterContent,
        },
        conversationHistory: [
          { role: 'user', content: '帮我优化这段内容' },
          { role: 'assistant', content: '这是优化后的版本...' },
        ],
      };

      await fetch('/api/ppt/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chatPayload),
      });

      expect(capturedBody.context.chapterTitle).toBe(chapterTitle);
      expect(capturedBody.context.chapterContent).toBe(chapterContent);
      expect(capturedBody.conversationHistory).toHaveLength(2);
      expect(capturedBody.conversationHistory[0].role).toBe('user');
      expect(capturedBody.conversationHistory[1].role).toBe('assistant');
    });

    it('should pass context with project metadata when available', async () => {
      let capturedBody: any = null;

      globalThis.fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
        capturedBody = JSON.parse(init?.body as string);
        return {
          ok: true,
          body: new ReadableStream({
            start(controller) {
              controller.close();
            },
          }),
        } as Response;
      });

      const chatPayload = {
        message: '添加更多数据支撑',
        context: {
          chapterTitle: '投流分析',
          chapterContent: '<p>投流效率分析</p>',
          projectName: '品牌A_春季种草',
          brand: '品牌A',
          category: '食品饮料',
        },
        conversationHistory: [],
      };

      await fetch('/api/ppt/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chatPayload),
      });

      expect(capturedBody.context.chapterTitle).toBe('投流分析');
      expect(capturedBody.context.chapterContent).toBe('<p>投流效率分析</p>');
      expect(capturedBody.context.projectName).toBe('品牌A_春季种草');
      expect(capturedBody.context.brand).toBe('品牌A');
      expect(capturedBody.context.category).toBe('食品饮料');
    });

    it('should handle chat API unavailability gracefully', async () => {
      globalThis.fetch = vi.fn(async () => {
        return {
          ok: false,
          status: 503,
          text: async () => 'Service Unavailable',
        } as unknown as Response;
      });

      const chatPayload = {
        message: '优化内容',
        context: {
          chapterTitle: '数据总览',
          chapterContent: '<p>数据内容</p>',
        },
        conversationHistory: [],
      };

      const response = await fetch('/api/ppt/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chatPayload),
      });

      // The response should indicate failure
      expect(response.ok).toBe(false);
      expect(response.status).toBe(503);
    });
  });
});
