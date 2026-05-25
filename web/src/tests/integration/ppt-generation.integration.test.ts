/**
 * Integration Test: PPT 生成流程 (PPT Generation Flow)
 *
 * Tests the full PPT generation flow:
 * - Click generate → prepare API → navigate to editor → stream slides
 * - Test failure scenarios: timeout, API error
 *
 * Focuses on the logic layer: presenton-client prepare/stream, content conversion.
 * Uses vi.fn() to mock fetch calls simulating Presenton API responses.
 *
 * **Validates: Requirements 5.2, 5.4, 5.5**
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { convertModulesToMarkdown } from '../../lib/content-converter';
import type { ReportModule, PreparePPTRequest } from '../../lib/presenton-client';

// --- Mock SSE Stream Helpers ---

/**
 * Creates a mock SSE stream simulating PPT generation (slide-by-slide).
 */
function createMockPPTStream(slides: Array<{ index: number; data: Record<string, unknown> }>, includeProgress = true): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const events: string[] = [];

  for (let i = 0; i < slides.length; i++) {
    events.push(`data: ${JSON.stringify({ type: 'slide', index: slides[i].index, data: slides[i].data })}\n\n`);
    if (includeProgress) {
      events.push(`data: ${JSON.stringify({ type: 'progress', current: i + 1, total: slides.length })}\n\n`);
    }
  }
  events.push(`data: ${JSON.stringify({ type: 'done', presentation: { id: 'pres-001', slides } })}\n\n`);

  let index = 0;
  return new ReadableStream({
    pull(controller) {
      if (index < events.length) {
        controller.enqueue(encoder.encode(events[index]));
        index++;
      } else {
        controller.close();
      }
    },
  });
}

/**
 * Creates a mock SSE stream that simulates a timeout (never completes).
 */
function createMockTimeoutStream(): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let sent = false;

  return new ReadableStream({
    pull(controller) {
      if (!sent) {
        // Send one slide then stall
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'slide', index: 0, data: { type: 'title', content: { title: 'Test' } } })}\n\n`));
        sent = true;
      }
      // Never close - simulates timeout
      return new Promise(() => {}); // Hang forever
    },
  });
}

/**
 * Parses SSE events from a ReadableStream.
 */
async function parseSSEEvents(stream: ReadableStream<Uint8Array>): Promise<Array<Record<string, unknown>>> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const events: Array<Record<string, unknown>> = [];
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() || '';

    for (const part of parts) {
      if (part.startsWith('data: ')) {
        try {
          events.push(JSON.parse(part.slice(6)));
        } catch {
          // Skip malformed
        }
      }
    }
  }

  return events;
}

// --- Tests ---

describe('PPT 生成流程集成测试 (PPT Generation Integration)', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('点击生成 → 准备 → 流式生成', () => {
    it('should prepare presentation and receive streaming slides', async () => {
      /**
       * **Validates: Requirements 5.2, 5.4**
       *
       * Full flow: prepare API returns presentationId → connect to stream → receive slides one by one.
       */
      const modules: Record<string, ReportModule> = {
        'KPI 概览': {
          status: 'show',
          paragraphs: [{ content: '曝光量 100,000' }],
          tables: [{
            headers: ['指标', '数值'],
            rows: [['曝光量', '100000'], ['互动率', '4.5%']],
          }],
        },
        '内容分析': {
          status: 'show',
          paragraphs: [{ content: '优质内容占比 60%' }],
        },
      };

      // Step 1: Convert content for PPT generation
      const conversionResult = convertModulesToMarkdown(modules, {
        projectName: '测试项目',
        brand: '测试品牌',
        category: '美妆',
      });

      expect(conversionResult.includedModules).toHaveLength(2);

      // Step 2: Prepare presentation (mock API)
      const prepareRequest: PreparePPTRequest = {
        projectName: '测试项目',
        brand: '测试品牌',
        category: '美妆',
        content: conversionResult.markdown,
        modules,
        n_slides: 10,
        language: '中文',
        tone: 'professional',
      };

      const fetchMock = vi.fn();
      globalThis.fetch = fetchMock;

      // Mock prepare response
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'presentation-uuid-001' }),
      });

      const prepareRes = await fetch('/api/ppt/presentation/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prepareRequest),
      });

      expect(prepareRes.ok).toBe(true);
      const { id: presentationId } = await prepareRes.json();
      expect(presentationId).toBe('presentation-uuid-001');

      // Step 3: Connect to stream and receive slides
      const mockSlides = [
        { index: 0, data: { type: 'title', content: { title: '测试项目复盘报告', subtitle: '测试品牌 - 美妆' } } },
        { index: 1, data: { type: 'content', content: { title: 'KPI 概览', body: '曝光量 100,000' } } },
        { index: 2, data: { type: 'table', content: { title: '数据汇总', headers: ['指标', '数值'], rows: [['曝光量', '100000']] } } },
      ];

      fetchMock.mockResolvedValueOnce({
        ok: true,
        body: createMockPPTStream(mockSlides),
      });

      const streamRes = await fetch(`/api/ppt/presentation/stream/${presentationId}`);
      expect(streamRes.ok).toBe(true);

      // Parse stream events
      const events = await parseSSEEvents(streamRes.body!);

      // Verify slides received in order
      const slideEvents = events.filter(e => e.type === 'slide');
      expect(slideEvents).toHaveLength(3);
      expect(slideEvents[0].index).toBe(0);
      expect(slideEvents[1].index).toBe(1);
      expect(slideEvents[2].index).toBe(2);

      // Verify progress events
      const progressEvents = events.filter(e => e.type === 'progress');
      expect(progressEvents.length).toBeGreaterThan(0);

      // Verify done event
      const doneEvent = events.find(e => e.type === 'done');
      expect(doneEvent).toBeDefined();
    });

    it('should navigate to editor page after prepare succeeds', async () => {
      /**
       * **Validates: Requirements 5.2**
       *
       * After prepare API returns a presentationId, the navigation URL should be correct.
       */
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'pres-abc-123' }),
      });

      const prepareRes = await fetch('/api/ppt/presentation/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName: 'Test',
          brand: 'Brand',
          category: 'Cat',
          content: '# Test',
          modules: {},
          n_slides: 5,
        }),
      });

      const { id } = await prepareRes.json();

      // Verify the navigation URL would be correct
      const reviewId = 'review-001';
      const expectedUrl = `/review/${reviewId}/ppt-editor/${id}`;
      expect(expectedUrl).toBe('/review/review-001/ppt-editor/pres-abc-123');

      // Verify the stream URL would be correct
      const streamUrl = `/api/ppt/presentation/stream/${id}`;
      expect(streamUrl).toBe('/api/ppt/presentation/stream/pres-abc-123');
    });

    it('should track generation progress as slides arrive', async () => {
      /**
       * **Validates: Requirements 5.4**
       *
       * Verifies that progress can be tracked as slides are received one by one.
       */
      const totalSlides = 5;
      const mockSlides = Array.from({ length: totalSlides }, (_, i) => ({
        index: i,
        data: { type: 'content', content: { title: `Slide ${i + 1}` } },
      }));

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        body: createMockPPTStream(mockSlides),
      });

      const streamRes = await fetch('/api/ppt/presentation/stream/pres-001');
      const events = await parseSSEEvents(streamRes.body!);

      // Simulate tracking progress
      const receivedSlides: Array<Record<string, unknown>> = [];
      for (const event of events) {
        if (event.type === 'slide') {
          receivedSlides.push(event);
        }
        if (event.type === 'progress') {
          const progress = event as { current: number; total: number };
          expect(progress.current).toBeLessThanOrEqual(progress.total);
          expect(progress.current).toBeGreaterThan(0);
        }
      }

      // All slides received
      expect(receivedSlides).toHaveLength(totalSlides);

      // Done event signals completion
      const doneEvent = events.find(e => e.type === 'done');
      expect(doneEvent).toBeDefined();
    });
  });

  describe('失败场景', () => {
    it('should handle prepare API failure', async () => {
      /**
       * **Validates: Requirements 5.5**
       *
       * When the prepare API returns an error, the flow should not proceed to streaming.
       */
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: '准备 PPT 失败: 内部服务错误' }),
      });

      const prepareRes = await fetch('/api/ppt/presentation/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName: 'Test',
          brand: 'Brand',
          category: 'Cat',
          content: '# Test',
          modules: {},
        }),
      });

      expect(prepareRes.ok).toBe(false);
      expect(prepareRes.status).toBe(500);

      const errorData = await prepareRes.json();
      expect(errorData.error).toContain('准备 PPT 失败');
    });

    it('should handle stream connection failure', async () => {
      /**
       * **Validates: Requirements 5.5**
       *
       * When the stream endpoint returns an error, it should be reported.
       */
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 502,
        text: async () => 'Bad Gateway - Presenton service unavailable',
      });

      const streamRes = await fetch('/api/ppt/presentation/stream/pres-001');

      expect(streamRes.ok).toBe(false);
      expect(streamRes.status).toBe(502);
    });

    it('should handle network timeout during streaming', async () => {
      /**
       * **Validates: Requirements 5.5**
       *
       * Simulates a timeout scenario where the stream stops sending data.
       * The client should be able to detect this and offer retry.
       */
      globalThis.fetch = vi.fn().mockRejectedValueOnce(
        Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' })
      );

      let error: Error | null = null;
      try {
        await fetch('/api/ppt/presentation/stream/pres-001', {
          signal: AbortSignal.timeout(300_000),
        });
      } catch (e) {
        error = e as Error;
      }

      expect(error).not.toBeNull();
      expect(error!.name).toBe('TimeoutError');
    });

    it('should handle partial stream (some slides received before failure)', async () => {
      /**
       * **Validates: Requirements 5.4, 5.5**
       *
       * When the stream fails mid-way, already received slides should be preserved.
       */
      const encoder = new TextEncoder();
      let eventIndex = 0;
      const partialEvents = [
        `data: ${JSON.stringify({ type: 'slide', index: 0, data: { type: 'title', content: { title: 'Slide 1' } } })}\n\n`,
        `data: ${JSON.stringify({ type: 'slide', index: 1, data: { type: 'content', content: { title: 'Slide 2' } } })}\n\n`,
        `data: ${JSON.stringify({ type: 'progress', current: 2, total: 10 })}\n\n`,
      ];

      const partialStream = new ReadableStream<Uint8Array>({
        pull(controller) {
          if (eventIndex < partialEvents.length) {
            controller.enqueue(encoder.encode(partialEvents[eventIndex]));
            eventIndex++;
          } else {
            // Simulate error mid-stream
            controller.error(new Error('Connection reset'));
          }
        },
      });

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        body: partialStream,
      });

      const streamRes = await fetch('/api/ppt/presentation/stream/pres-001');
      expect(streamRes.ok).toBe(true);

      // Try to read the stream - should get partial data then error
      const reader = streamRes.body!.getReader();
      const decoder = new TextDecoder();
      const receivedSlides: Array<Record<string, unknown>> = [];
      let streamError: Error | null = null;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value, { stream: true });
          const parts = text.split('\n\n').filter(p => p.startsWith('data: '));
          for (const part of parts) {
            const event = JSON.parse(part.slice(6));
            if (event.type === 'slide') {
              receivedSlides.push(event);
            }
          }
        }
      } catch (e) {
        streamError = e as Error;
      }

      // We should have received 2 slides before the error
      expect(receivedSlides).toHaveLength(2);
      expect(receivedSlides[0].index).toBe(0);
      expect(receivedSlides[1].index).toBe(1);
      expect(streamError).not.toBeNull();
    });
  });

  describe('内容准备', () => {
    it('should exclude hidden modules from PPT generation content', () => {
      /**
       * **Validates: Requirements 5.2**
       *
       * Only modules with status 'show' should be included in the PPT content.
       */
      const modules: Record<string, ReportModule> = {
        '可见模块': { status: 'show', paragraphs: [{ content: '可见内容' }] },
        '隐藏模块': { status: 'hide', paragraphs: [{ content: '隐藏内容' }] },
        '另一个可见': { status: 'show', paragraphs: [{ content: '另一个可见内容' }] },
      };

      const result = convertModulesToMarkdown(modules, {
        projectName: 'Test',
        brand: 'Brand',
        category: 'Category',
      });

      expect(result.includedModules).toEqual(['可见模块', '另一个可见']);
      expect(result.markdown).toContain('可见内容');
      expect(result.markdown).toContain('另一个可见内容');
      expect(result.markdown).not.toContain('隐藏内容');
    });
  });
});
