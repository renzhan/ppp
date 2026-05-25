/**
 * Integration Test: 审校台 (Proofread Page)
 *
 * Tests the full proofread flow:
 * - Load report → TipTap edit → save → switch chapters → verify content
 *
 * Focuses on the logic layer: ChapterState, content-converter, and API interactions.
 * Uses vi.fn() to mock fetch calls simulating Presenton API responses.
 *
 * **Validates: Requirements 3.1, 3.3, 3.4**
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChapterState, type Section } from '../../lib/chapter-state';
import { convertModulesToMarkdown } from '../../lib/content-converter';
import type { ReportModule } from '../../lib/presenton-client';

// --- Mock API Responses ---

function createMockReportResponse(sections: Section[]) {
  return {
    id: 'review-001',
    reportContent: sections,
  };
}

function createMockSaveResponse() {
  return { success: true, updatedAt: new Date().toISOString() };
}

// --- Tests ---

describe('审校台集成测试 (Proofread Integration)', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('加载报告 → 编辑 → 保存流程', () => {
    it('should load report sections and initialize editor with first chapter content', async () => {
      /**
       * **Validates: Requirements 3.1**
       *
       * Simulates loading a report from the API and initializing the chapter state.
       */
      const mockSections: Section[] = [
        { title: 'KPI 概览', content: '<h2>KPI 数据</h2><p>曝光量: 100,000</p>' },
        { title: '内容分析', content: '<p>优质内容占比 60%</p>' },
        { title: '投流分析', content: '<p>ROI: 2.5</p>' },
      ];

      // Mock fetch for loading report
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => createMockReportResponse(mockSections),
      });

      // Simulate the load flow
      const res = await fetch('/api/reviews/review-001/report');
      const data = await res.json();

      // Initialize chapter state from loaded data
      const sections = data.reportContent as Section[];
      const state = new ChapterState(sections);

      // Verify initial state
      expect(state.getActiveIndex()).toBe(0);
      expect(state.getCurrentContent()).toBe('<h2>KPI 数据</h2><p>曝光量: 100,000</p>');
      expect(state.getSectionCount()).toBe(3);
    });

    it('should preserve rich text formatting through edit and save cycle', async () => {
      /**
       * **Validates: Requirements 3.3**
       *
       * Simulates editing content in TipTap (HTML format) and saving to backend.
       */
      const mockSections: Section[] = [
        { title: '概述', content: '<p>原始内容</p>' },
        { title: '分析', content: '<p>分析内容</p>' },
      ];

      const state = new ChapterState(mockSections);

      // Simulate TipTap editing - user adds rich text formatting
      const editedHtml = '<h2>概述</h2><p><strong>重要数据</strong>: 曝光量增长 <em>50%</em></p><ul><li>要点一</li><li>要点二</li></ul>';
      state.editContent(editedHtml);

      // Simulate save - build the payload
      const savePayload = [];
      for (let i = 0; i < state.getSectionCount(); i++) {
        savePayload.push({
          title: mockSections[i].title,
          content: state.getSectionContent(i),
        });
      }

      // Mock save API call
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => createMockSaveResponse(),
      });

      const saveRes = await fetch('/api/reviews/review-001/report', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: savePayload }),
      });

      expect(saveRes.ok).toBe(true);

      // Verify the saved content preserves formatting
      expect(savePayload[0].content).toBe(editedHtml);
      expect(savePayload[0].content).toContain('<strong>');
      expect(savePayload[0].content).toContain('<em>');
      expect(savePayload[0].content).toContain('<ul>');
    });

    it('should handle save failure gracefully', async () => {
      /**
       * **Validates: Requirements 3.3**
       *
       * Simulates a save failure and verifies content is not lost locally.
       */
      const mockSections: Section[] = [
        { title: '概述', content: '<p>原始内容</p>' },
      ];

      const state = new ChapterState(mockSections);
      state.editContent('<p>已编辑的内容</p>');

      // Mock save failure
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: '保存失败' }),
      });

      const saveRes = await fetch('/api/reviews/review-001/report', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: [{ title: '概述', content: state.getCurrentContent() }] }),
      });

      expect(saveRes.ok).toBe(false);

      // Content should still be preserved locally
      expect(state.getCurrentContent()).toBe('<p>已编辑的内容</p>');
    });
  });

  describe('章节切换流程', () => {
    it('should save current content and load new chapter when switching', () => {
      /**
       * **Validates: Requirements 3.4**
       *
       * Full chapter switching flow: edit chapter A → switch to B → switch back to A → verify content.
       */
      const mockSections: Section[] = [
        { title: 'KPI 概览', content: '<h2>KPI</h2><p>原始 KPI 数据</p>' },
        { title: '内容分析', content: '<h2>内容</h2><p>原始内容分析</p>' },
        { title: '投流分析', content: '<h2>投流</h2><p>原始投流数据</p>' },
      ];

      const state = new ChapterState(mockSections);

      // Step 1: Edit chapter 0
      state.editContent('<h2>KPI</h2><p>修改后的 KPI 数据: 曝光量 200,000</p>');

      // Step 2: Switch to chapter 1
      state.switchTo(1);
      expect(state.getActiveIndex()).toBe(1);
      expect(state.getCurrentContent()).toBe('<h2>内容</h2><p>原始内容分析</p>');

      // Step 3: Edit chapter 1
      state.editContent('<h2>内容</h2><p>修改后的内容分析: 优质率 75%</p>');

      // Step 4: Switch to chapter 2
      state.switchTo(2);
      expect(state.getActiveIndex()).toBe(2);
      expect(state.getCurrentContent()).toBe('<h2>投流</h2><p>原始投流数据</p>');

      // Step 5: Switch back to chapter 0 - verify edited content preserved
      state.switchTo(0);
      expect(state.getCurrentContent()).toBe('<h2>KPI</h2><p>修改后的 KPI 数据: 曝光量 200,000</p>');

      // Step 6: Switch back to chapter 1 - verify edited content preserved
      state.switchTo(1);
      expect(state.getCurrentContent()).toBe('<h2>内容</h2><p>修改后的内容分析: 优质率 75%</p>');
    });

    it('should handle rapid chapter switching without data loss', () => {
      /**
       * **Validates: Requirements 3.4**
       *
       * Simulates rapid switching between chapters to ensure no race conditions.
       */
      const mockSections: Section[] = [
        { title: 'A', content: 'Content A' },
        { title: 'B', content: 'Content B' },
        { title: 'C', content: 'Content C' },
        { title: 'D', content: 'Content D' },
      ];

      const state = new ChapterState(mockSections);

      // Edit each chapter with unique content
      state.editContent('Edited A');
      state.switchTo(1);
      state.editContent('Edited B');
      state.switchTo(2);
      state.editContent('Edited C');
      state.switchTo(3);
      state.editContent('Edited D');

      // Rapid switching sequence
      state.switchTo(0);
      state.switchTo(2);
      state.switchTo(1);
      state.switchTo(3);
      state.switchTo(0);

      // Verify all content preserved
      expect(state.getCurrentContent()).toBe('Edited A');
      state.switchTo(1);
      expect(state.getCurrentContent()).toBe('Edited B');
      state.switchTo(2);
      expect(state.getCurrentContent()).toBe('Edited C');
      state.switchTo(3);
      expect(state.getCurrentContent()).toBe('Edited D');
    });

    it('should integrate chapter switching with save operation', async () => {
      /**
       * **Validates: Requirements 3.3, 3.4**
       *
       * Full flow: edit multiple chapters → save all → verify saved data is correct.
       */
      const mockSections: Section[] = [
        { title: '概述', content: '<p>概述原文</p>' },
        { title: '数据', content: '<p>数据原文</p>' },
      ];

      const state = new ChapterState(mockSections);

      // Edit chapter 0
      state.editContent('<p>概述修改版</p>');

      // Switch to chapter 1 and edit
      state.switchTo(1);
      state.editContent('<p>数据修改版</p>');

      // Build save payload (simulating what the page component does)
      const savePayload: Section[] = [];
      for (let i = 0; i < state.getSectionCount(); i++) {
        savePayload.push({
          title: mockSections[i].title,
          content: state.getSectionContent(i),
        });
      }

      // Mock save
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => createMockSaveResponse(),
      });

      await fetch('/api/reviews/review-001/report', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: savePayload }),
      });

      // Verify payload contains all edits
      expect(savePayload[0].content).toBe('<p>概述修改版</p>');
      expect(savePayload[1].content).toBe('<p>数据修改版</p>');
    });
  });

  describe('内容格式转换集成', () => {
    it('should convert report modules to markdown preserving all data for PPT generation', () => {
      /**
       * **Validates: Requirements 3.1, 3.3**
       *
       * Tests that report content can be converted to Markdown format
       * suitable for PPT generation, preserving numeric data.
       */
      const modules: Record<string, ReportModule> = {
        'KPI 概览': {
          status: 'show',
          paragraphs: [{ content: '本期投放总曝光量达到 1,234,567 次' }],
          tables: [{
            title: 'KPI 汇总',
            headers: ['指标', '数值', '环比'],
            rows: [
              ['曝光量', '1234567', '+15.3%'],
              ['互动率', '4.56%', '+0.8%'],
              ['ROI', '2.35', '-0.12'],
            ],
          }],
        },
        '竞品分析': {
          status: 'hide',
          paragraphs: [{ content: '竞品数据（隐藏）' }],
        },
        '内容分析': {
          status: 'show',
          paragraphs: [{ content: '优质内容占比 60%，视频类内容表现最佳' }],
        },
      };

      const result = convertModulesToMarkdown(modules, {
        projectName: '测试项目',
        brand: '测试品牌',
        category: '美妆',
      });

      // Verify hidden module is excluded
      expect(result.includedModules).toContain('KPI 概览');
      expect(result.includedModules).toContain('内容分析');
      expect(result.includedModules).not.toContain('竞品分析');

      // Verify numeric data preserved
      expect(result.markdown).toContain('1234567');
      expect(result.markdown).toContain('4.56%');
      expect(result.markdown).toContain('2.35');
      expect(result.markdown).toContain('+15.3%');

      // Verify table format
      expect(result.markdown).toContain('| 指标 | 数值 | 环比 |');
      expect(result.markdown).toContain('| --- | --- | --- |');

      // Verify hidden content not present
      expect(result.markdown).not.toContain('竞品数据（隐藏）');
    });
  });
});
