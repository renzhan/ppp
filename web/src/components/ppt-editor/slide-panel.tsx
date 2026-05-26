'use client';

import { useState, useCallback, useRef } from 'react';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SlideRenderer } from './slide-renderers';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PresentationSlide {
  index: number;
  type: string;
  content: Record<string, unknown>;
  layout?: string;
}

export interface SlidePanelProps {
  slides: PresentationSlide[];
  activeIndex: number;
  onSelectSlide: (index: number) => void;
  onReorderSlides: (fromIndex: number, toIndex: number) => void;
  onDeleteSlide: (index: number) => void;
  onAddSlide: (atIndex: number) => void;
}

// ─── Layout types that have visual renderers ─────────────────────────────────

const VISUAL_LAYOUTS = new Set([
  'general:intro-slide',
  'general:basic-info',
  'general:bullet-with-icons',
  'general:chart-with-bullets',
  'general:metrics',
  'general:table-info',
  'general:numbered-bullets',
]);

// ─── Slide Panel Component ───────────────────────────────────────────────────

export function SlidePanel({
  slides,
  activeIndex,
  onSelectSlide,
  onReorderSlides,
  onDeleteSlide,
  onAddSlide,
}: SlidePanelProps) {
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragItemRef = useRef<number | null>(null);

  // ─── Drag and Drop Handlers ──────────────────────────────────────────────

  const handleDragStart = useCallback(
    (e: React.DragEvent<HTMLDivElement>, index: number) => {
      dragItemRef.current = index;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(index));
      // Add a slight delay to allow the drag image to render
      (e.currentTarget as HTMLElement).style.opacity = '0.5';
    },
    []
  );

  const handleDragEnd = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    (e.currentTarget as HTMLElement).style.opacity = '1';
    setDragOverIndex(null);
    dragItemRef.current = null;
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>, index: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (dragItemRef.current !== null && dragItemRef.current !== index) {
        setDragOverIndex(index);
      }
    },
    []
  );

  const handleDragLeave = useCallback(() => {
    setDragOverIndex(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>, toIndex: number) => {
      e.preventDefault();
      setDragOverIndex(null);
      const fromIndex = dragItemRef.current;
      if (fromIndex !== null && fromIndex !== toIndex) {
        onReorderSlides(fromIndex, toIndex);
      }
      dragItemRef.current = null;
    },
    [onReorderSlides]
  );

  // ─── Helpers ─────────────────────────────────────────────────────────────

  const getSlideTitle = (slide: PresentationSlide): string => {
    if (!slide.content) return '';
    if (typeof slide.content.title === 'string') return slide.content.title;
    if (typeof slide.content.heading === 'string') return slide.content.heading;
    return '';
  };

  return (
    <aside className="flex w-56 flex-shrink-0 flex-col overflow-hidden border-r bg-slate-50">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-3 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          幻灯片
        </h2>
        <div className="flex items-center gap-1">
          <span className="text-xs text-slate-400">{slides.length} 页</span>
          <button
            type="button"
            onClick={() => onAddSlide(slides.length)}
            className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-400 transition hover:bg-slate-200 hover:text-slate-600"
            aria-label="添加幻灯片"
            title="添加幻灯片"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* Slide list */}
      <nav
        className="flex-1 overflow-y-auto p-2 space-y-1.5"
        aria-label="幻灯片列表"
      >
        {slides.map((slide, idx) => (
          <div
            key={`slide-${idx}`}
            draggable
            onDragStart={(e) => handleDragStart(e, idx)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => handleDragOver(e, idx)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, idx)}
            className={cn(
              'group relative flex w-full cursor-pointer flex-col rounded-lg border p-2 transition',
              idx === activeIndex
                ? 'border-blue-300 bg-blue-50 ring-1 ring-blue-200'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
              dragOverIndex === idx && 'border-blue-400 ring-2 ring-blue-200'
            )}
            onClick={() => onSelectSlide(idx)}
            role="button"
            tabIndex={0}
            aria-label={`幻灯片 ${idx + 1}`}
            aria-current={idx === activeIndex ? 'true' : undefined}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectSlide(idx);
              }
            }}
          >
            {/* Drag handle */}
            <div className="absolute left-1 top-1/2 -translate-y-1/2 opacity-0 transition group-hover:opacity-100">
              <GripVertical size={12} className="text-slate-400" />
            </div>

            {/* Slide thumbnail */}
            <div className="mb-1.5 aspect-[16/9] w-full overflow-hidden rounded bg-white border border-slate-100">
              {slide.layout && VISUAL_LAYOUTS.has(slide.layout) ? (
                <div className="w-full h-full origin-top-left scale-[0.18] pointer-events-none" style={{ width: '555%', height: '555%' }}>
                  <SlideRenderer layout={slide.layout} content={slide.content} />
                </div>
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                  {idx + 1}
                </div>
              )}
            </div>

            {/* Slide title */}
            <span className="truncate text-xs text-slate-600">
              {getSlideTitle(slide) || `幻灯片 ${idx + 1}`}
            </span>

            {/* Delete button (visible on hover) */}
            {slides.length > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteSlide(idx);
                }}
                className="absolute right-1 top-1 hidden h-5 w-5 items-center justify-center rounded bg-rose-100 text-rose-500 transition hover:bg-rose-200 group-hover:flex"
                aria-label={`删除幻灯片 ${idx + 1}`}
                title="删除幻灯片"
              >
                <Trash2 size={10} />
              </button>
            )}

            {/* Add slide between (visible on hover) */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAddSlide(idx + 1);
              }}
              className="absolute -bottom-2.5 left-1/2 z-10 hidden h-4 w-4 -translate-x-1/2 items-center justify-center rounded-full border border-blue-300 bg-white text-blue-500 transition hover:bg-blue-50 group-hover:flex"
              aria-label={`在幻灯片 ${idx + 1} 后添加`}
              title="在此处添加幻灯片"
            >
              <Plus size={10} />
            </button>
          </div>
        ))}
      </nav>
    </aside>
  );
}
