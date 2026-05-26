'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Download,
  Loader2,
  Presentation,
  AlertCircle,
  RotateCcw,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { Loading } from '@/components/ui/loading';
import { SlidePanel } from '@/components/ppt-editor/slide-panel';
import { SlideCanvas } from '@/components/ppt-editor/slide-canvas';
import { PPTChatPanel } from '@/components/ppt-editor/ppt-chat-panel';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PresentationSlide {
  index: number;
  type: string;
  content: Record<string, unknown>;
  layout?: string;
}

interface PresentationData {
  id: string;
  title: string;
  slides: PresentationSlide[];
  theme?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

type StreamingStatus = 'idle' | 'connecting' | 'streaming' | 'done' | 'error';

// ─── Page Component ──────────────────────────────────────────────────────────

export default function PPTEditorPage({
  params,
}: {
  params: { id: string; presentationId: string };
}) {
  const { id, presentationId } = params;

  // State
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [presentation, setPresentation] = useState<PresentationData | null>(null);
  const [streamingStatus, setStreamingStatus] = useState<StreamingStatus>('idle');
  const [streamProgress, setStreamProgress] = useState<{ current: number; total: number } | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [editingEnabled, setEditingEnabled] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const streamTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── SSE Streaming Logic ─────────────────────────────────────────────────

  const connectToStream = useCallback(() => {
    // Clean up any existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    if (streamTimeoutRef.current) {
      clearTimeout(streamTimeoutRef.current);
    }

    setStreamingStatus('connecting');
    setStreamError(null);

    const eventSource = new EventSource(
      `/api/ppt/presentation/stream/${presentationId}`
    );
    eventSourceRef.current = eventSource;

    // Set a connection timeout (300 seconds)
    streamTimeoutRef.current = setTimeout(() => {
      eventSource.close();
      setStreamingStatus('error');
      setStreamError('连接超时，PPT 生成时间过长');
    }, 300_000);

    eventSource.onopen = () => {
      setStreamingStatus('streaming');
    };

    // Presenton sends SSE with "event: response" field, so we need addEventListener
    // (onmessage only fires for events without an event field)
    const handleSSEMessage = (event: MessageEvent) => {
      // Reset timeout on each message
      if (streamTimeoutRef.current) {
        clearTimeout(streamTimeoutRef.current);
      }
      streamTimeoutRef.current = setTimeout(() => {
        eventSource.close();
        setStreamingStatus('error');
        setStreamError('连接超时，长时间未收到数据');
      }, 300_000);

      try {
        const data = JSON.parse(event.data);

        if (data.type === 'chunk') {
          // Presenton sends slide data as JSON chunks
          // Try to parse the chunk as a slide object
          try {
            const slideData = JSON.parse(data.chunk);
            if (slideData && typeof slideData.index === 'number' && slideData.content) {
              const newSlide: PresentationSlide = {
                index: slideData.index,
                type: slideData.content?.type || 'content',
                content: slideData.content || {},
                layout: slideData.layout,
              };

              setPresentation((prev) => {
                if (!prev) {
                  return {
                    id: presentationId,
                    title: 'PPT 生成中...',
                    slides: [newSlide],
                  };
                }
                const updatedSlides = [...prev.slides];
                if (slideData.index < updatedSlides.length) {
                  updatedSlides[slideData.index] = newSlide;
                } else {
                  updatedSlides.push(newSlide);
                }
                return { ...prev, slides: updatedSlides };
              });

              setStreamProgress((prev) => ({
                current: (prev?.current || 0) + 1,
                total: prev?.total || 15,
              }));
            }
          } catch {
            // Not a valid slide JSON chunk - skip (could be opening/closing brackets)
          }
        } else if (data.type === 'slide_assets') {
          // Presenton sends slide_assets with the final slide data including assets
          if (data.slide && typeof data.slide_index === 'number') {
            const newSlide: PresentationSlide = {
              index: data.slide_index,
              type: data.slide.content?.type || 'content',
              content: data.slide.content || {},
              layout: data.slide.layout,
            };

            setPresentation((prev) => {
              if (!prev) {
                return {
                  id: presentationId,
                  title: 'PPT 生成中...',
                  slides: [newSlide],
                };
              }
              const updatedSlides = [...prev.slides];
              if (data.slide_index < updatedSlides.length) {
                updatedSlides[data.slide_index] = newSlide;
              } else {
                while (updatedSlides.length <= data.slide_index) {
                  updatedSlides.push({ index: updatedSlides.length, type: 'content', content: {} });
                }
                updatedSlides[data.slide_index] = newSlide;
              }
              return { ...prev, slides: updatedSlides };
            });
          }
        } else if (data.type === 'slide') {
          // Legacy format support
          const newSlide: PresentationSlide = {
            index: data.index,
            type: data.data?.type || 'content',
            content: data.data?.content || {},
            layout: data.data?.layout,
          };

          setPresentation((prev) => {
            if (!prev) {
              return {
                id: presentationId,
                title: 'PPT 生成中...',
                slides: [newSlide],
              };
            }
            const updatedSlides = [...prev.slides];
            if (data.index < updatedSlides.length) {
              updatedSlides[data.index] = newSlide;
            } else {
              updatedSlides.push(newSlide);
            }
            return { ...prev, slides: updatedSlides };
          });
        } else if (data.type === 'progress') {
          setStreamProgress({
            current: data.current,
            total: data.total,
          });
        } else if (data.type === 'complete') {
          // Presenton sends complete event with full presentation data
          if (streamTimeoutRef.current) {
            clearTimeout(streamTimeoutRef.current);
          }
          eventSource.close();
          setStreamingStatus('done');
          setEditingEnabled(true);

          // The complete event has the presentation data under the "presentation" key
          const presData = data.presentation;
          if (presData) {
            setPresentation({
              id: presData.id || presentationId,
              title: presData.title || 'Presentation',
              slides: (presData.slides || []).map((s: Record<string, unknown>, i: number) => ({
                index: (s.index as number) ?? i,
                type: (s.content as Record<string, unknown>)?.type as string || 'content',
                content: (s.content as Record<string, unknown>) || {},
                layout: s.layout as string,
              })),
              theme: presData.theme,
            });
          }
        } else if (data.type === 'done') {
          // Legacy done event
          if (streamTimeoutRef.current) {
            clearTimeout(streamTimeoutRef.current);
          }
          eventSource.close();
          setStreamingStatus('done');
          setEditingEnabled(true);

          if (data.presentation) {
            setPresentation((prev) => ({
              ...prev,
              id: data.presentation.id || presentationId,
              title: data.presentation.title || prev?.title || 'Presentation',
              slides: data.presentation.slides || prev?.slides || [],
              theme: data.presentation.theme || prev?.theme,
            }));
          }
        } else if (data.type === 'error') {
          if (streamTimeoutRef.current) {
            clearTimeout(streamTimeoutRef.current);
          }
          eventSource.close();
          setStreamingStatus('error');
          setStreamError(data.detail || data.message || 'PPT 生成过程中出错');
        }
      } catch {
        // Malformed JSON - skip
      }
    };

    // Listen for named "response" events (Presenton uses event: response)
    eventSource.addEventListener('response', handleSSEMessage);
    // Also listen for unnamed messages (fallback)
    eventSource.onmessage = handleSSEMessage;

    eventSource.onerror = () => {
      if (streamTimeoutRef.current) {
        clearTimeout(streamTimeoutRef.current);
      }
      eventSource.close();

      // If we already have slides and status was streaming, treat as done
      setPresentation((prev) => {
        if (prev && prev.slides.length > 0 && streamingStatus === 'streaming') {
          setStreamingStatus('done');
          setEditingEnabled(true);
          return prev;
        }
        setStreamingStatus('error');
        setStreamError('SSE 连接失败或中断');
        return prev;
      });
    };
  }, [presentationId, streamingStatus]);

  // ─── Initial Load Logic ──────────────────────────────────────────────────

  useEffect(() => {
    // Try to fetch existing presentation first
    const fetchPresentation = async () => {
      try {
        const res = await fetch(`/api/ppt/${presentationId}`);
        if (res.ok) {
          const data: PresentationData = await res.json();
          if (data.slides && data.slides.length > 0) {
            // Presentation already exists with slides - enable editing directly
            setPresentation(data);
            setStreamingStatus('done');
            setEditingEnabled(true);
            return;
          }
        }
      } catch {
        // Fetch failed - try streaming
      }

      // No existing presentation or empty slides - connect to stream
      connectToStream();
    };

    fetchPresentation();

    // Cleanup on unmount
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (streamTimeoutRef.current) {
        clearTimeout(streamTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presentationId]);

  // ─── Slide Operations ────────────────────────────────────────────────────

  const handleSelectSlide = useCallback((index: number) => {
    setActiveSlideIndex(index);
  }, []);

  const handleReorderSlides = useCallback(
    async (fromIndex: number, toIndex: number) => {
      if (!presentation) return;

      // Optimistic update
      setPresentation((prev) => {
        if (!prev) return prev;
        const slides = [...prev.slides];
        const [moved] = slides.splice(fromIndex, 1);
        slides.splice(toIndex, 0, moved);
        // Re-index slides
        const reindexed = slides.map((s, i) => ({ ...s, index: i }));
        return { ...prev, slides: reindexed };
      });

      // Adjust active index
      if (activeSlideIndex === fromIndex) {
        setActiveSlideIndex(toIndex);
      } else if (
        fromIndex < activeSlideIndex &&
        toIndex >= activeSlideIndex
      ) {
        setActiveSlideIndex(activeSlideIndex - 1);
      } else if (
        fromIndex > activeSlideIndex &&
        toIndex <= activeSlideIndex
      ) {
        setActiveSlideIndex(activeSlideIndex + 1);
      }

      // Persist to API
      try {
        await fetch(`/api/ppt/${presentationId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'reorder',
            fromIndex,
            toIndex,
          }),
        });
      } catch (err) {
        console.error('Failed to persist slide reorder:', err);
      }
    },
    [presentation, activeSlideIndex, presentationId]
  );

  const handleDeleteSlide = useCallback(
    async (index: number) => {
      if (!presentation || presentation.slides.length <= 1) return;

      // Optimistic update
      setPresentation((prev) => {
        if (!prev) return prev;
        const slides = prev.slides.filter((_, i) => i !== index);
        const reindexed = slides.map((s, i) => ({ ...s, index: i }));
        return { ...prev, slides: reindexed };
      });

      // Adjust active index
      if (activeSlideIndex >= index && activeSlideIndex > 0) {
        setActiveSlideIndex(activeSlideIndex - 1);
      }

      // Persist to API
      try {
        await fetch(`/api/ppt/${presentationId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'delete',
            index,
          }),
        });
      } catch (err) {
        console.error('Failed to persist slide deletion:', err);
      }
    },
    [presentation, activeSlideIndex, presentationId]
  );

  const handleAddSlide = useCallback(
    async (atIndex: number) => {
      if (!presentation) return;

      const newSlide: PresentationSlide = {
        index: atIndex,
        type: 'content',
        content: { title: '', body: '' },
      };

      // Optimistic update
      setPresentation((prev) => {
        if (!prev) return prev;
        const slides = [...prev.slides];
        slides.splice(atIndex, 0, newSlide);
        const reindexed = slides.map((s, i) => ({ ...s, index: i }));
        return { ...prev, slides: reindexed };
      });

      // Adjust active index
      if (atIndex <= activeSlideIndex) {
        setActiveSlideIndex(activeSlideIndex + 1);
      }

      // Persist to API
      try {
        await fetch(`/api/ppt/${presentationId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'add',
            index: atIndex,
            slide: newSlide,
          }),
        });
      } catch (err) {
        console.error('Failed to persist slide addition:', err);
      }
    },
    [presentation, activeSlideIndex, presentationId]
  );

  // ─── Content Change Handler ──────────────────────────────────────────────

  const handleContentChange = useCallback(
    (content: Record<string, unknown>) => {
      if (!presentation) return;

      setPresentation((prev) => {
        if (!prev) return prev;
        const slides = [...prev.slides];
        if (slides[activeSlideIndex]) {
          slides[activeSlideIndex] = {
            ...slides[activeSlideIndex],
            content,
          };
        }
        return { ...prev, slides };
      });

      // Debounced persist could be added here
    },
    [presentation, activeSlideIndex]
  );

  // ─── AI Slide Update Handler ─────────────────────────────────────────────

  const handleSlideUpdate = useCallback(
    (slideIndex: number, content: Record<string, unknown>) => {
      setPresentation((prev) => {
        if (!prev) return prev;
        const slides = [...prev.slides];
        if (slides[slideIndex]) {
          slides[slideIndex] = {
            ...slides[slideIndex],
            content: { ...slides[slideIndex].content, ...content },
          };
        }
        return { ...prev, slides };
      });
    },
    []
  );

  // ─── Download PPTX ──────────────────────────────────────────────────────

  const handleDownloadPPTX = useCallback(async () => {
    setIsExporting(true);
    try {
      const res = await fetch(`/api/ppt/${presentationId}/export`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('导出失败');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${presentation?.title || 'presentation'}.pptx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export PPTX failed:', err);
    } finally {
      setIsExporting(false);
    }
  }, [presentationId, presentation?.title]);

  // ─── Reconnect Handler ───────────────────────────────────────────────────

  const handleReconnect = useCallback(() => {
    setStreamError(null);
    connectToStream();
  }, [connectToStream]);

  // ─── Render: Streaming / Loading State ───────────────────────────────────

  if (streamingStatus === 'connecting' && !presentation) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <Loader2 size={32} className="animate-spin text-blue-600" />
        <p className="text-sm text-slate-600">正在连接 PPT 生成服务...</p>
      </div>
    );
  }

  if (streamingStatus === 'error' && !presentation) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <AlertCircle size={48} className="text-rose-400" />
        <p className="text-sm text-rose-600">
          {streamError || '连接失败'}
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={handleReconnect}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            <RotateCcw size={14} />
            重新连接
          </button>
          <Link
            href={`/review/${id}/proofread`}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            <ArrowLeft size={14} />
            返回审校台
          </Link>
        </div>
      </div>
    );
  }

  if (fetchError && !presentation) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <Presentation size={48} className="text-slate-300" />
        <p className="text-sm text-rose-600">{fetchError}</p>
        <Link
          href={`/review/${id}/proofread`}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
        >
          <ArrowLeft size={14} />
          返回审校台
        </Link>
      </div>
    );
  }

  const slides = presentation?.slides || [];
  const currentSlide = slides[activeSlideIndex];

  return (
    <div className="flex h-screen flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b bg-white px-4 py-2">
        <div className="flex items-center gap-3">
          <Link
            href={`/review/${id}/proofread`}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 px-3 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
            aria-label="返回审校台"
          >
            <ArrowLeft size={14} />
            返回审校台
          </Link>
          <div className="h-5 w-px bg-slate-200" />
          <h1 className="text-sm font-semibold text-slate-800">
            {presentation?.title || 'PPT 编辑器'}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Streaming status indicator */}
          {streamingStatus === 'streaming' && (
            <div className="flex items-center gap-1.5 rounded-md bg-blue-50 px-2.5 py-1">
              <Wifi size={12} className="animate-pulse text-blue-600" />
              <span className="text-xs text-blue-700">
                生成中
                {streamProgress
                  ? ` (${streamProgress.current}/${streamProgress.total})`
                  : '...'}
              </span>
            </div>
          )}
          {streamingStatus === 'done' && (
            <div className="flex items-center gap-1.5 rounded-md bg-emerald-50 px-2.5 py-1">
              <Wifi size={12} className="text-emerald-600" />
              <span className="text-xs text-emerald-700">生成完毕</span>
            </div>
          )}
          {streamingStatus === 'error' && presentation && (
            <button
              onClick={handleReconnect}
              className="flex items-center gap-1.5 rounded-md bg-amber-50 px-2.5 py-1 transition hover:bg-amber-100"
            >
              <WifiOff size={12} className="text-amber-600" />
              <span className="text-xs text-amber-700">连接中断 - 点击重连</span>
            </button>
          )}

          <button
            onClick={handleDownloadPPTX}
            disabled={isExporting || !editingEnabled}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-blue-600 px-3 text-xs font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
            aria-label="下载 PPTX"
          >
            {isExporting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Download size={14} />
            )}
            下载 PPTX
          </button>
        </div>
      </header>

      {/* Three-panel layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel: Slide thumbnails */}
        <SlidePanel
          slides={slides}
          activeIndex={activeSlideIndex}
          onSelectSlide={handleSelectSlide}
          onReorderSlides={handleReorderSlides}
          onDeleteSlide={handleDeleteSlide}
          onAddSlide={handleAddSlide}
        />

        {/* Center panel: Slide canvas */}
        <main className="flex flex-1 flex-col overflow-hidden bg-slate-100">
          <div className="flex flex-1 items-center justify-center p-6">
            <div className="flex aspect-[16/9] w-full max-w-4xl flex-col overflow-hidden rounded-lg border bg-white shadow-sm">
              {currentSlide ? (
                <SlideCanvas
                  key={activeSlideIndex}
                  slide={currentSlide}
                  onContentChange={handleContentChange}
                  editable={editingEnabled}
                />
              ) : (
                <div className="flex flex-1 items-center justify-center">
                  {streamingStatus === 'streaming' ? (
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 size={24} className="animate-spin text-blue-500" />
                      <p className="text-sm text-slate-500">
                        正在生成幻灯片...
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">无幻灯片内容</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Slide navigation bar */}
          <div className="flex items-center justify-center border-t bg-white px-4 py-2">
            <span className="text-xs text-slate-500">
              {slides.length > 0
                ? `${activeSlideIndex + 1} / ${slides.length}`
                : '0 / 0'}
            </span>
            {!editingEnabled && streamingStatus === 'streaming' && (
              <span className="ml-3 text-xs text-blue-500">
                （生成完毕后可编辑）
              </span>
            )}
          </div>
        </main>

        {/* Right panel: AI Chat */}
        <PPTChatPanel
          presentationId={presentationId}
          onSlideUpdate={handleSlideUpdate}
        />
      </div>
    </div>
  );
}
