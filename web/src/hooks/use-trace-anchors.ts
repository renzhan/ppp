'use client';

import { useEffect, type RefObject } from 'react';

/**
 * Hook: 扫描容器内的数据元素（表格、含数字的段落），注入溯源锚点按钮。
 * 
 * 识别策略：
 * 1. 带 data-trace-id 属性的元素（LLM标记的）
 * 2. 所有 .report-table 表格
 * 3. 所有 table 元素
 * 
 * 点击锚点时调用 onAnchorClick(traceId)。
 */
export function useTraceAnchors(
  containerRef: RefObject<HTMLElement | null>,
  content: string,
  onAnchorClick: (traceId: string) => void
) {
  useEffect(() => {
    if (!containerRef.current) return;

    // Small delay to ensure DOM is stable after React render
    const timer = setTimeout(() => {
      if (!containerRef.current) return;

      // Remove previously injected anchors
      const existingBtns = containerRef.current.querySelectorAll('.trace-anchor-btn');
      existingBtns.forEach((btn) => btn.remove());

      // Strategy 1: Elements with explicit data-trace-id
      const traceElements = containerRef.current.querySelectorAll('[data-trace-id]');

      // Strategy 2: All tables (auto-assign trace-id based on position)
      const tables = containerRef.current.querySelectorAll('table');

      // Collect all elements to annotate
      const elementsToAnnotate: Array<{ el: HTMLElement; traceId: string }> = [];

      traceElements.forEach((el) => {
        const traceId = el.getAttribute('data-trace-id');
        if (traceId) {
          elementsToAnnotate.push({ el: el as HTMLElement, traceId });
        }
      });

      tables.forEach((table, idx) => {
        // Skip if already has data-trace-id
        if (table.getAttribute('data-trace-id')) return;
        const autoTraceId = `auto_table_${idx}`;
        table.setAttribute('data-trace-id', autoTraceId);
        elementsToAnnotate.push({ el: table as HTMLElement, traceId: autoTraceId });
      });

      // Inject anchor buttons
      elementsToAnnotate.forEach(({ el, traceId }) => {
        if (el.querySelector('.trace-anchor-btn')) return;

        const btn = document.createElement('button');
        btn.className = 'trace-anchor-btn';
        btn.title = '查看数据来源';
        btn.textContent = '📊';
        btn.setAttribute('contenteditable', 'false');
        btn.addEventListener('mousedown', (e) => {
          e.stopPropagation();
          e.preventDefault();
          onAnchorClick(traceId);
        });

        el.style.position = 'relative';
        el.appendChild(btn);
      });
    }, 150);

    return () => clearTimeout(timer);
  }); // No dependency array - run on every render to keep anchors in sync
}
