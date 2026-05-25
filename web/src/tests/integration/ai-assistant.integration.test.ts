/**
 * Integration Test: AI 助手 (AI Assistant)
 *
 * Tests the full AI assistant flow:
 * - Send message → receive streaming reply → apply suggestion to editor
 * - Verify conversation history accumulates correctly
 *
 * Focuses on the logic layer: ConversationState, streaming parsing, and editor integration.
 * Uses vi.fn() to mock fetch calls simulating Presenton Chat API responses.
 *
 * **Validates: Requirements 4.1, 4.4, 10.4**
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConversationState, type ConversationEntry } from '../../lib/conversation-state';
import { ChapterState, type Section } from '../../lib/chapter-state';

// --- Mock SSE Stream Helpers ---

/**
 * Creates a mock ReadableStream that simulates SSE streaming from Presenton Chat API.
 */
function createMockSSEStream(events: Array<{ type: string; content?: string; slideIndex?: number }>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let index = 0;

  return new ReadableStream({
    pull(controller) {
      if (index < events.length) {
        const event = events[index];
        const data = JSON.stringify(event);
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        index++;
      } else {
        controller.close();
      }
    },
  });
}

/**
 * Parses SSE events from a ReadableStream (simulates frontend SSE parsing logic).
 */
async function parseSSEStream(stream: ReadableStream<Uint8Array>): Promise<Array<{ type: string; content?: string }>> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const events: Array<{ type: string; content?: string }> = [];
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const jsonStr = line.slice(6);
        try {
          events.push(JSON.parse(jsonStr));
        } catch {
          // Skip malformed events
        }
      }
    }
  }

  return events;
}

// --- Tests ---

describe('AI 助手集成测试 (AI Assistant Integration)', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('发送消息 → 接收流式回复', () => {
    it('should send message with chapter context and receive streaming response', async () => {
      /**
       * **Validates: Requirements 4.1**
       *
       * Simulates sending a message to the AI assistant with current chapter context,
       * and receiving a streaming response.
       */
      const conversationState = new ConversationState();

      // Simulate current chapter context
      const chapterContext = {
        chapterTitle: 'KPI 概览',
        chapterContent: '<h2>KPI</h2><p>曝光量: 100,000</p>',
        projectName: '测试项目',
        brand: '测试品牌',
        category: '美妆',
      };

      // User sends a message
      const payload = conversationState.addUserMessage('请帮我优化这段 KPI 数据的表达');

      // Build the full request (as the AI assistant panel would)
      const requestBody = {
        message: payload.message,
        context: chapterContext,
        conversationHistory: payload.conversationHistory,
      };

      // Mock streaming response from Presenton Chat API
      const mockEvents = [
        { type: 'text', content: '以下是优化后的' },
        { type: 'text', content: 'KPI 数据表达：' },
        { type: 'text', content: '\n\n曝光量达到 10 万次，' },
        { type: 'text', content: '表现优异。' },
        { type: 'done' },
      ];

      const mockStream = createMockSSEStream(mockEvents);

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        body: mockStream,
        headers: new Headers({ 'Content-Type': 'text/event-stream' }),
      });

      // Make the request
      const response = await fetch('/api/ppt/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      expect(response.ok).toBe(true);

      // Parse the streaming response
      const events = await parseSSEStream(response.body!);

      // Verify we received all text events
      const textEvents = events.filter(e => e.type === 'text');
      expect(textEvents.length).toBe(4);

      // Reconstruct full response
      const fullResponse = textEvents.map(e => e.content).join('');
      expect(fullResponse).toContain('KPI 数据表达');
      expect(fullResponse).toContain('曝光量达到 10 万次');

      // Verify done event received
      expect(events[events.length - 1].type).toBe('done');

      // Add assistant response to conversation state
      conversationState.addAssistantResponse(fullResponse);

      // Verify the fetch was called with correct payload
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/ppt/chat', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(requestBody),
      }));
    });

    it('should handle suggestion-type responses with apply capability', async () => {
      /**
       * **Validates: Requirements 4.4**
       *
       * Tests that when AI returns a suggestion, it can be applied to the editor.
       */
      const conversationState = new ConversationState();
      const sections: Section[] = [
        { title: 'KPI 概览', content: '<p>曝光量: 100000</p>' },
        { title: '分析', content: '<p>分析内容</p>' },
      ];
      const chapterState = new ChapterState(sections);

      // User asks for optimization
      const payload = conversationState.addUserMessage('优化表达');

      // Mock response with a suggestion
      const mockEvents = [
        { type: 'text', content: '建议将数据表达优化为：' },
        { type: 'suggestion', content: '<p><strong>曝光量</strong>: 10 万次，环比增长 15%</p>' },
        { type: 'done' },
      ];

      const mockStream = createMockSSEStream(mockEvents);

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        body: mockStream,
      });

      const response = await fetch('/api/ppt/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: payload.message, conversationHistory: payload.conversationHistory }),
      });

      const events = await parseSSEStream(response.body!);

      // Find the suggestion event
      const suggestionEvent = events.find(e => e.type === 'suggestion');
      expect(suggestionEvent).toBeDefined();
      expect(suggestionEvent!.content).toContain('<strong>曝光量</strong>');

      // Simulate "apply suggestion" - replace editor content
      if (suggestionEvent?.content) {
        chapterState.editContent(suggestionEvent.content);
      }

      // Verify the suggestion was applied to the editor
      expect(chapterState.getCurrentContent()).toBe('<p><strong>曝光量</strong>: 10 万次，环比增长 15%</p>');
    });
  });

  describe('对话历史累积', () => {
    it('should accumulate conversation history across multiple turns', async () => {
      /**
       * **Validates: Requirements 10.4**
       *
       * Simulates a multi-turn conversation and verifies that each subsequent
       * request includes the full prior conversation history.
       */
      const conversationState = new ConversationState();
      const fetchMock = vi.fn();
      globalThis.fetch = fetchMock;

      // Turn 1: User sends first message
      const payload1 = conversationState.addUserMessage('分析 KPI 数据');
      expect(payload1.conversationHistory).toHaveLength(0); // No prior history

      fetchMock.mockResolvedValueOnce({
        ok: true,
        body: createMockSSEStream([
          { type: 'text', content: 'KPI 分析结果：曝光量表现良好' },
          { type: 'done' },
        ]),
      });

      await fetch('/api/ppt/chat', {
        method: 'POST',
        body: JSON.stringify({ message: payload1.message, conversationHistory: payload1.conversationHistory }),
      });

      // Simulate receiving and storing assistant response
      conversationState.addAssistantResponse('KPI 分析结果：曝光量表现良好');

      // Turn 2: User sends follow-up
      const payload2 = conversationState.addUserMessage('能否更详细地分析互动率？');
      expect(payload2.conversationHistory).toHaveLength(2); // 1 user + 1 assistant
      expect(payload2.conversationHistory[0]).toEqual({ role: 'user', content: '分析 KPI 数据' });
      expect(payload2.conversationHistory[1]).toEqual({ role: 'assistant', content: 'KPI 分析结果：曝光量表现良好' });

      fetchMock.mockResolvedValueOnce({
        ok: true,
        body: createMockSSEStream([
          { type: 'text', content: '互动率为 4.5%，高于行业平均' },
          { type: 'done' },
        ]),
      });

      await fetch('/api/ppt/chat', {
        method: 'POST',
        body: JSON.stringify({ message: payload2.message, conversationHistory: payload2.conversationHistory }),
      });

      conversationState.addAssistantResponse('互动率为 4.5%，高于行业平均');

      // Turn 3: User sends another follow-up
      const payload3 = conversationState.addUserMessage('给出改进建议');
      expect(payload3.conversationHistory).toHaveLength(4); // 2 user + 2 assistant
      expect(payload3.conversationHistory[2]).toEqual({ role: 'user', content: '能否更详细地分析互动率？' });
      expect(payload3.conversationHistory[3]).toEqual({ role: 'assistant', content: '互动率为 4.5%，高于行业平均' });

      // Verify full history integrity (includes the 3rd user message just added)
      const fullHistory = conversationState.getHistory();
      expect(fullHistory).toHaveLength(5); // 3 user + 2 assistant (3rd turn not yet responded)
      expect(fullHistory.map(h => h.role)).toEqual(['user', 'assistant', 'user', 'assistant', 'user']);
    });

    it('should maintain separate conversation histories for different sessions', () => {
      /**
       * **Validates: Requirements 10.4**
       *
       * Each ConversationState instance maintains its own independent history.
       */
      const session1 = new ConversationState();
      const session2 = new ConversationState();

      // Session 1 conversation
      session1.addUserMessage('Session 1 message');
      session1.addAssistantResponse('Session 1 response');

      // Session 2 conversation
      session2.addUserMessage('Session 2 message');
      session2.addAssistantResponse('Session 2 response');

      // Verify independence
      const payload1 = session1.addUserMessage('Follow up 1');
      const payload2 = session2.addUserMessage('Follow up 2');

      expect(payload1.conversationHistory[0].content).toBe('Session 1 message');
      expect(payload2.conversationHistory[0].content).toBe('Session 2 message');
      expect(payload1.conversationHistory).toHaveLength(2);
      expect(payload2.conversationHistory).toHaveLength(2);
    });
  });

  describe('错误处理', () => {
    it('should handle API unavailability gracefully', async () => {
      /**
       * **Validates: Requirements 4.1**
       *
       * When Presenton Chat API is unavailable, the error should be captured.
       */
      const conversationState = new ConversationState();
      const payload = conversationState.addUserMessage('测试消息');

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: async () => 'Service Unavailable',
      });

      const response = await fetch('/api/ppt/chat', {
        method: 'POST',
        body: JSON.stringify({ message: payload.message, conversationHistory: payload.conversationHistory }),
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(503);

      // Conversation history should NOT include the failed message's response
      // (user message was already added to state, but no assistant response)
      expect(conversationState.getHistory()).toHaveLength(1);
      expect(conversationState.getHistory()[0]).toEqual({ role: 'user', content: '测试消息' });
    });

    it('should handle timeout errors', async () => {
      /**
       * **Validates: Requirements 4.1**
       *
       * When the request times out, the error should be properly reported.
       */
      globalThis.fetch = vi.fn().mockRejectedValueOnce(
        Object.assign(new Error('Timeout'), { name: 'TimeoutError' })
      );

      let error: Error | null = null;
      try {
        await fetch('/api/ppt/chat', {
          method: 'POST',
          body: JSON.stringify({ message: 'test' }),
        });
      } catch (e) {
        error = e as Error;
      }

      expect(error).not.toBeNull();
      expect(error!.name).toBe('TimeoutError');
    });
  });
});
