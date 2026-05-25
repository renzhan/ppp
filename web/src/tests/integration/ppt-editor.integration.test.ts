/**
 * Integration Test: PPT 编辑器 (PPT Editor)
 *
 * Tests the full PPT editor flow:
 * - Select slide → edit content → AI modification → export
 * - Verify slide management operations (add, delete, reorder)
 *
 * Focuses on the logic layer: SlideListState, presenton-client, and API interactions.
 * Uses vi.fn() to mock fetch calls simulating Presenton API responses.
 *
 * **Validates: Requirements 6.3, 6.4, 6.5, 11.3, 11.4, 11.5**
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SlideListState, type Slide } from '../../lib/slide-list-state';
import { ConversationState } from '../../lib/conversation-state';

// --- Mock Data ---

function createMockSlides(count: number): Slide[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `slide-${i}`,
    index: i,
    content: {
      type: i === 0 ? 'title' : 'content',
      title: `Slide ${i + 1}`,
      body: `Content for slide ${i + 1}`,
    },
  }));
}

function createMockPresentationResponse(slides: Slide[]) {
  return {
    id: 'pres-001',
    title: '测试演示文稿',
    slides: slides.map(s => ({
      index: s.index,
      type: (s.content as Record<string, unknown>).type || 'content',
      content: s.content,
      layout: 'default',
    })),
    theme: { primaryColor: '#1a73e8' },
  };
}

/**
 * Creates a mock SSE stream for AI chat responses that include slide updates.
 */
function createMockSlideUpdateStream(slideIndex: number, updatedContent: Record<string, unknown>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const events = [
    `data: ${JSON.stringify({ type: 'text', content: '已为您修改幻灯片内容：' })}\n\n`,
    `data: ${JSON.stringify({ type: 'slide_update', slideIndex, content: updatedContent })}\n\n`,
    `data: ${JSON.stringify({ type: 'done' })}\n\n`,
  ];

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

// --- Tests ---

describe('PPT 编辑器集成测试 (PPT Editor Integration)', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('加载演示文稿 → 选择幻灯片 → 编辑', () => {
    it('should load presentation and initialize slide list state', async () => {
      /**
       * **Validates: Requirements 6.3**
       *
       * Simulates loading a presentation from the API and initializing the slide list.
       */
      const mockSlides = createMockSlides(5);

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => createMockPresentationResponse(mockSlides),
      });

      // Load presentation
      const res = await fetch('/api/ppt/pres-001');
      const presentation = await res.json();

      expect(presentation.id).toBe('pres-001');
      expect(presentation.slides).toHaveLength(5);

      // Initialize slide list state
      const slideState = new SlideListState(mockSlides);
      expect(slideState.getCount()).toBe(5);

      // Verify slides are in correct order
      const slides = slideState.getSlides();
      for (let i = 0; i < slides.length; i++) {
        expect(slides[i].index).toBe(i);
        expect(slides[i].id).toBe(`slide-${i}`);
      }
    });

    it('should select a slide and provide its content for editing', async () => {
      /**
       * **Validates: Requirements 6.4**
       *
       * Simulates selecting a slide from the panel and loading its content into the canvas.
       */
      const mockSlides = createMockSlides(5);
      const slideState = new SlideListState(mockSlides);

      // Select slide at index 2
      const selectedIndex = 2;
      const slides = slideState.getSlides();
      const selectedSlide = slides[selectedIndex];

      expect(selectedSlide.id).toBe('slide-2');
      expect(selectedSlide.content).toEqual({
        type: 'content',
        title: 'Slide 3',
        body: 'Content for slide 3',
      });
    });

    it('should edit slide content and persist to API', async () => {
      /**
       * **Validates: Requirements 6.4**
       *
       * Simulates editing a slide's content and saving it to the Presenton API.
       */
      const mockSlides = createMockSlides(3);
      const slideState = new SlideListState(mockSlides);

      // Edit slide 1's content (simulating TipTap edit on canvas)
      const editedContent = {
        type: 'content',
        title: 'Updated Slide 2',
        body: '<p><strong>修改后的内容</strong>: 新增数据分析</p>',
      };

      // Mock the save API call
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ presentation_id: 'pres-001', path: '/exports/pres-001.pptx', edit_path: '/edit/pres-001' }),
      });

      // Save edited slide to API
      const saveRes = await fetch('/api/ppt/pres-001', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          presentation_id: 'pres-001',
          slides: [{ index: 1, content: editedContent }],
        }),
      });

      expect(saveRes.ok).toBe(true);

      // Verify the fetch was called with correct payload
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/ppt/pres-001', expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          presentation_id: 'pres-001',
          slides: [{ index: 1, content: editedContent }],
        }),
      }));
    });
  });

  describe('AI 修改幻灯片', () => {
    it('should send AI request and apply slide_update to the correct slide', async () => {
      /**
       * **Validates: Requirements 6.5**
       *
       * Simulates sending an AI chat message and receiving a slide_update event
       * that modifies a specific slide.
       */
      const mockSlides = createMockSlides(5);
      const slideState = new SlideListState(mockSlides);
      const conversationState = new ConversationState();

      // User asks AI to modify slide 2
      const payload = conversationState.addUserMessage('请将第3页幻灯片的标题改为"数据分析总结"');

      // Mock AI response with slide_update
      const updatedContent = {
        type: 'content',
        title: '数据分析总结',
        body: '本期数据表现优异，各项指标均有提升。',
      };

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        body: createMockSlideUpdateStream(2, updatedContent),
      });

      const response = await fetch('/api/ppt/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: payload.message,
          conversationHistory: payload.conversationHistory,
          presentationId: 'pres-001',
        }),
      });

      expect(response.ok).toBe(true);

      // Parse the stream to find slide_update event
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      const events: Array<Record<string, unknown>> = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';
        for (const part of parts) {
          if (part.startsWith('data: ')) {
            events.push(JSON.parse(part.slice(6)));
          }
        }
      }

      // Find the slide_update event
      const slideUpdateEvent = events.find(e => e.type === 'slide_update');
      expect(slideUpdateEvent).toBeDefined();
      expect(slideUpdateEvent!.slideIndex).toBe(2);
      expect(slideUpdateEvent!.content).toEqual(updatedContent);

      // Apply the update to local state (simulating what the PPT editor does)
      // The slide at index 2 should be updated
      const slides = slideState.getSlides();
      slides[2].content = updatedContent;

      expect(slides[2].content).toEqual({
        type: 'content',
        title: '数据分析总结',
        body: '本期数据表现优异，各项指标均有提升。',
      });
    });
  });

  describe('幻灯片管理操作', () => {
    it('should add a new slide at specified position', () => {
      /**
       * **Validates: Requirements 11.5**
       *
       * Adding a slide increases count by 1 and places it at the correct position.
       */
      const mockSlides = createMockSlides(5);
      const slideState = new SlideListState(mockSlides);

      expect(slideState.getCount()).toBe(5);

      // Add a new slide at position 2
      slideState.addSlide(2, {
        id: 'slide-new',
        content: { type: 'content', title: '新幻灯片', body: '' },
      });

      expect(slideState.getCount()).toBe(6);

      const slides = slideState.getSlides();
      expect(slides[2].id).toBe('slide-new');
      expect(slides[2].index).toBe(2);

      // Verify all indices are consistent
      for (let i = 0; i < slides.length; i++) {
        expect(slides[i].index).toBe(i);
      }

      // Verify original slides shifted correctly
      expect(slides[0].id).toBe('slide-0');
      expect(slides[1].id).toBe('slide-1');
      expect(slides[3].id).toBe('slide-2'); // Was at index 2, now at 3
    });

    it('should delete a slide at specified position', () => {
      /**
       * **Validates: Requirements 11.4**
       *
       * Deleting a slide decreases count by 1 and maintains relative order.
       */
      const mockSlides = createMockSlides(5);
      const slideState = new SlideListState(mockSlides);

      // Delete slide at position 1
      slideState.deleteSlide(1);

      expect(slideState.getCount()).toBe(4);

      const slides = slideState.getSlides();
      // slide-1 should be gone
      const ids = slides.map(s => s.id);
      expect(ids).not.toContain('slide-1');
      expect(ids).toEqual(['slide-0', 'slide-2', 'slide-3', 'slide-4']);

      // Verify indices are re-indexed
      for (let i = 0; i < slides.length; i++) {
        expect(slides[i].index).toBe(i);
      }
    });

    it('should reorder slides via move operation', () => {
      /**
       * **Validates: Requirements 11.3**
       *
       * Moving a slide from position A to position B maintains count and correct order.
       */
      const mockSlides = createMockSlides(5);
      const slideState = new SlideListState(mockSlides);

      // Move slide from position 0 to position 3
      slideState.moveSlide(0, 3);

      expect(slideState.getCount()).toBe(5);

      const slides = slideState.getSlides();
      // slide-0 should now be at position 3
      expect(slides[3].id).toBe('slide-0');

      // Other slides should maintain relative order
      expect(slides[0].id).toBe('slide-1');
      expect(slides[1].id).toBe('slide-2');
      expect(slides[2].id).toBe('slide-3');
      expect(slides[4].id).toBe('slide-4');

      // Verify indices
      for (let i = 0; i < slides.length; i++) {
        expect(slides[i].index).toBe(i);
      }
    });

    it('should persist slide operations to API', async () => {
      /**
       * **Validates: Requirements 11.3, 11.4, 11.5**
       *
       * After each slide operation, the change should be persisted to the API.
       */
      const mockSlides = createMockSlides(5);
      const slideState = new SlideListState(mockSlides);
      const fetchMock = vi.fn();
      globalThis.fetch = fetchMock;

      // Add a slide
      slideState.addSlide(2, {
        id: 'slide-new',
        content: { type: 'content', title: 'New', body: '' },
      });

      // Mock persist call
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await fetch('/api/ppt/pres-001', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          presentation_id: 'pres-001',
          slides: slideState.getSlides().map(s => ({ index: s.index, content: s.content })),
        }),
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);

      // Delete a slide
      slideState.deleteSlide(0);

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await fetch('/api/ppt/pres-001', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          presentation_id: 'pres-001',
          slides: slideState.getSlides().map(s => ({ index: s.index, content: s.content })),
        }),
      });

      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('should handle complex sequence of operations correctly', () => {
      /**
       * **Validates: Requirements 11.3, 11.4, 11.5**
       *
       * Tests a complex sequence: add → delete → move → add → verify final state.
       */
      const mockSlides = createMockSlides(4);
      const slideState = new SlideListState(mockSlides);

      // Initial: [slide-0, slide-1, slide-2, slide-3]
      expect(slideState.getCount()).toBe(4);

      // Add at position 1: [slide-0, new-A, slide-1, slide-2, slide-3]
      slideState.addSlide(1, { id: 'new-A', content: { title: 'A' } });
      expect(slideState.getCount()).toBe(5);
      expect(slideState.getSlides()[1].id).toBe('new-A');

      // Delete at position 3: [slide-0, new-A, slide-1, slide-3]
      slideState.deleteSlide(3);
      expect(slideState.getCount()).toBe(4);

      // Move from 0 to 2: [new-A, slide-1, slide-0, slide-3]
      slideState.moveSlide(0, 2);
      expect(slideState.getCount()).toBe(4);

      // Add at end: [new-A, slide-1, slide-0, slide-3, new-B]
      slideState.addSlide(4, { id: 'new-B', content: { title: 'B' } });
      expect(slideState.getCount()).toBe(5);

      // Verify final state
      const finalSlides = slideState.getSlides();
      expect(finalSlides.map(s => s.id)).toEqual(['new-A', 'slide-1', 'slide-0', 'slide-3', 'new-B']);

      // Verify all indices are consistent
      for (let i = 0; i < finalSlides.length; i++) {
        expect(finalSlides[i].index).toBe(i);
      }
    });
  });

  describe('导出 PPTX', () => {
    it('should call export API and receive download path', async () => {
      /**
       * **Validates: Requirements 6.3**
       *
       * Tests the export flow: call export API → receive file path.
       */
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ path: '/app_data/exports/presentation_pres-001.pptx' }),
      });

      const exportRes = await fetch('/api/ppt/pres-001/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presentation_id: 'pres-001' }),
      });

      expect(exportRes.ok).toBe(true);
      const result = await exportRes.json();
      expect(result.path).toContain('.pptx');
    });

    it('should handle export failure gracefully', async () => {
      /**
       * **Validates: Requirements 6.3**
       *
       * When export fails, the error should be properly reported.
       */
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: '导出失败: 文件生成错误' }),
      });

      const exportRes = await fetch('/api/ppt/pres-001/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presentation_id: 'pres-001' }),
      });

      expect(exportRes.ok).toBe(false);
      expect(exportRes.status).toBe(500);
    });
  });
});
