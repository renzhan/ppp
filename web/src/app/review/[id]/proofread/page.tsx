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
}

interface ReviewDetail {
  id: string;
  projectId: string;
  status: string;
  modules: Record<string, unknown>;
  presentationId?: string | null;
  reportContent: unknown;
  project: {
    id: string;
    projectName: string;
    category: string;
    brand: string;
    businessLine: string | null;
  };
}

type StreamingStatus = 'idle' | 'connecting' | 'generating' | 'streaming' | 'done' | 'error';

// ─── Page Component ──────────────────────────────────────────────────────────

export default function ProofreadPage({ params }: { params: { id: string } }) {
  const { id } = params;

  // State
  const [review, setReview] = useState<ReviewDetail | null>(null);
  const [isLoadingReview, setIsLoadingReview] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [presentationId, setPresentationId] = useState<string | null>(null);
  const [presentation, setPresentation] = useState<PresentationData | null>(null);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [streamingStatus, setStreamingStatus] = useState<StreamingStatus>('idle');
  const [streamProgress, setStreamProgress] = useState<{ current: number; total: number } | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [editingEnabled, setEditingEnabled] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);

  const eventSourceRef = useRef<EventSource | null>(null);
  const streamTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasStartedRef = useRef(false);
  const exportDropdownRef = useRef<HTMLDivElement>(null);

  // ─── Fetch Review Data ───────────────────────────────────────────────────

  useEffect(() => {
    const fetchReview = async () => {
      try {
        const res = await fetch(`/api/reviews/${id}`);
        if (!res.ok) throw new Error('获取复盘详情失败');
        const data: ReviewDetail = await res.json();
        setReview(data);

        if (data.presentationId) {
          setPresentationId(data.presentationId);
        }
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : '加载失败');
      } finally {
        setIsLoadingReview(false);
      }
    };

    fetchReview();
  }, [id]);

  // ─── SSE Streaming Logic ─────────────────────────────────────────────────

  const connectToStream = useCallback((presId: string) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    if (streamTimeoutRef.current) {
      clearTimeout(streamTimeoutRef.current);
    }

    setStreamingStatus('streaming');
    setStreamError(null);

    const eventSource = new EventSource(
      `/api/ppt/presentation/stream/${presId}`
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
                    id: presId,
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
            // Not a valid slide JSON chunk - skip
          }
        } else if (data.type === 'slide_assets') {
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
                  id: presId,
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
          const newSlide: PresentationSlide = {
            index: data.index,
            type: data.data?.type || 'content',
            content: data.data?.content || {},
            layout: data.data?.layout,
          };

          setPresentation((prev) => {
            if (!prev) {
              return {
                id: presId,
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
          if (streamTimeoutRef.current) {
            clearTimeout(streamTimeoutRef.current);
          }
          eventSource.close();
          setStreamingStatus('done');
          setEditingEnabled(true);

          const presData = data.presentation;
          if (presData) {
            setPresentation({
              id: presData.id || presId,
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
          if (streamTimeoutRef.current) {
            clearTimeout(streamTimeoutRef.current);
          }
          eventSource.close();
          setStreamingStatus('done');
          setEditingEnabled(true);

          if (data.presentation) {
            setPresentation((prev) => ({
              ...prev,
              id: data.presentation.id || presId,
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

    eventSource.addEventListener('response', handleSSEMessage);
    eventSource.onmessage = handleSSEMessage;

    eventSource.onerror = () => {
      if (streamTimeoutRef.current) {
        clearTimeout(streamTimeoutRef.current);
      }
      eventSource.close();

      setPresentation((prev) => {
        if (prev && prev.slides.length > 0) {
          setStreamingStatus('done');
          setEditingEnabled(true);
          return prev;
        }
        setStreamingStatus('error');
        setStreamError('SSE 连接失败或中断');
        return prev;
      });
    };
  }, []);

  // ─── Generate PPT ────────────────────────────────────────────────────────

  const generatePPT = useCallback(async (reviewData: ReviewDetail) => {
    setStreamingStatus('generating');
    setStreamError(null);

    try {
      // Build modules map from review data
      const modules: Record<string, { status: 'show' | 'hide'; paragraphs?: Array<{ content: string }> }> = {};
      if (reviewData.modules && typeof reviewData.modules === 'object') {
        for (const [key, value] of Object.entries(reviewData.modules)) {
          if (typeof value === 'object' && value !== null) {
            modules[key] = value as { status: 'show' | 'hide'; paragraphs?: Array<{ content: string }> };
          }
        }
      }

      const generateRes = await fetch('/api/ppt/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName: reviewData.project.projectName,
          brand: reviewData.project.brand,
          category: reviewData.project.category,
          modules,
          n_slides: 15,
          language: '中文',
          tone: 'professional',
          reviewId: id,
        }),
      });

      if (!generateRes.ok) {
        const errData = await generateRes.json().catch(() => ({ error: '生成 PPT 失败' }));
        throw new Error(errData.error || '生成 PPT 失败');
      }

      const { presentationId: newPresentationId } = await generateRes.json();
      setPresentationId(newPresentationId);

      // Persist presentationId to the review record
      await fetch(`/api/reviews/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presentationId: newPresentationId }),
      }).catch(() => {
        // Non-critical: if save fails, we still have it in state
      });

      // Connect to SSE stream for slide generation
      connectToStream(newPresentationId);
    } catch (err) {
      setStreamingStatus('error');
      setStreamError(err instanceof Error ? err.message : '生成 PPT 失败');
    }
  }, [id, connectToStream]);

  // ─── Load Existing Presentation ──────────────────────────────────────────

  const loadPresentation = useCallback(async (presId: string) => {
    setStreamingStatus('connecting');
    try {
      const res = await fetch(`/api/ppt/${presId}`);
      if (res.ok) {
        const data: PresentationData = await res.json();
        if (data.slides && data.slides.length > 0) {
          setPresentation(data);
          setStreamingStatus('done');
          setEditingEnabled(true);
          return;
        }
      }
    } catch {
      // Fetch failed - try streaming
    }

    // No existing slides - connect to stream (generation might still be in progress)
    connectToStream(presId);
  }, [connectToStream]);

  // ─── Main Effect: Decide what to do on mount ─────────────────────────────

  useEffect(() => {
    if (isLoadingReview || !review || hasStartedRef.current) return;
    hasStartedRef.current = true;

    if (presentationId) {
      // Already have a presentationId - load it
      loadPresentation(presentationId);
    } else {
      // No presentationId - auto-generate
      generatePPT(review);
    }
  }, [isLoadingReview, review, presentationId, loadPresentation, generatePPT]);

  // ─── Cleanup on unmount ──────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (streamTimeoutRef.current) {
        clearTimeout(streamTimeoutRef.current);
      }
    };
  }, []);

  // ─── Close export dropdown on click outside ──────────────────────────────

  useEffect(() => {
    if (!exportDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(e.target as Node)) {
        setExportDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [exportDropdownOpen]);

  // ─── Slide Operations ────────────────────────────────────────────────────

  const handleSelectSlide = useCallback((index: number) => {
    setActiveSlideIndex(index);
  }, []);

  const handleReorderSlides = useCallback(
    async (fromIndex: number, toIndex: number) => {
      if (!presentation || !presentationId) return;

      setPresentation((prev) => {
        if (!prev) return prev;
        const slides = [...prev.slides];
        const [moved] = slides.splice(fromIndex, 1);
        slides.splice(toIndex, 0, moved);
        const reindexed = slides.map((s, i) => ({ ...s, index: i }));
        return { ...prev, slides: reindexed };
      });

      if (activeSlideIndex === fromIndex) {
        setActiveSlideIndex(toIndex);
      } else if (fromIndex < activeSlideIndex && toIndex >= activeSlideIndex) {
        setActiveSlideIndex(activeSlideIndex - 1);
      } else if (fromIndex > activeSlideIndex && toIndex <= activeSlideIndex) {
        setActiveSlideIndex(activeSlideIndex + 1);
      }

      try {
        await fetch(`/api/ppt/${presentationId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'reorder', fromIndex, toIndex }),
        });
      } catch (err) {
        console.error('Failed to persist slide reorder:', err);
      }
    },
    [presentation, activeSlideIndex, presentationId]
  );

  const handleDeleteSlide = useCallback(
    async (index: number) => {
      if (!presentation || !presentationId || presentation.slides.length <= 1) return;

      setPresentation((prev) => {
        if (!prev) return prev;
        const slides = prev.slides.filter((_, i) => i !== index);
        const reindexed = slides.map((s, i) => ({ ...s, index: i }));
        return { ...prev, slides: reindexed };
      });

      if (activeSlideIndex >= index && activeSlideIndex > 0) {
        setActiveSlideIndex(activeSlideIndex - 1);
      }

      try {
        await fetch(`/api/ppt/${presentationId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete', index }),
        });
      } catch (err) {
        console.error('Failed to persist slide deletion:', err);
      }
    },
    [presentation, activeSlideIndex, presentationId]
  );

  const handleAddSlide = useCallback(
    async (atIndex: number) => {
      if (!presentation || !presentationId) return;

      const newSlide: PresentationSlide = {
        index: atIndex,
        type: 'content',
        content: { title: '', body: '' },
      };

      setPresentation((prev) => {
        if (!prev) return prev;
        const slides = [...prev.slides];
        slides.splice(atIndex, 0, newSlide);
        const reindexed = slides.map((s, i) => ({ ...s, index: i }));
        return { ...prev, slides: reindexed };
      });

      if (atIndex <= activeSlideIndex) {
        setActiveSlideIndex(activeSlideIndex + 1);
      }

      try {
        await fetch(`/api/ppt/${presentationId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'add', index: atIndex, slide: newSlide }),
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
          slides[activeSlideIndex] = { ...slides[activeSlideIndex], content };
        }
        return { ...prev, slides };
      });
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
    if (!presentationId) return;
    setIsExporting(true);
    setExportDropdownOpen(false);
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

  // ─── Download PDF ────────────────────────────────────────────────────────

  const handleDownloadPDF = useCallback(async () => {
    if (!presentationId) return;
    setIsExporting(true);
    setExportDropdownOpen(false);
    try {
      const res = await fetch(`/api/ppt/${presentationId}/export?format=pdf`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('导出 PDF 失败');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${presentation?.title || 'presentation'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export PDF failed:', err);
    } finally {
      setIsExporting(false);
    }
  }, [presentationId, presentation?.title]);

  // ─── Reconnect / Retry Handler ───────────────────────────────────────────

  const handleRetry = useCallback(() => {
    setStreamError(null);
    if (presentationId) {
      connectToStream(presentationId);
    } else if (review) {
      generatePPT(review);
    }
  }, [presentationId, review, connectToStream, generatePPT]);

  // ─── Loading State ───────────────────────────────────────────────────────

  if (isLoadingReview) {
    return <Loading size="lg" text="正在加载复盘数据..." className="py-20" />;
  }

  if (loadError || !review) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <AlertCircle size={48} className="text-rose-400" />
        <p className="text-sm text-rose-600">{loadError || '复盘记录不存在'}</p>
        <Link
          href={`/review/${id}`}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
        >
          <ArrowLeft size={14} />
          返回复盘详情
        </Link>
      </div>
    );
  }

  // ─── Generating State (calling /api/ppt/generate) ────────────────────────

  if (streamingStatus === 'generating') {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <Loader2 size={32} className="animate-spin text-blue-600" />
        <p className="text-sm text-slate-600">正在生成 PPT，请稍候...</p>
        <p className="text-xs text-slate-400">这可能需要 1-2 分钟</p>
      </div>
    );
  }

  // ─── Connecting State ────────────────────────────────────────────────────

  if (streamingStatus === 'connecting' && !presentation) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <Loader2 size={32} className="animate-spin text-blue-600" />
        <p className="text-sm text-slate-600">正在加载演示文稿...</p>
      </div>
    );
  }

  // ─── Error State (no slides loaded) ──────────────────────────────────────

  if (streamingStatus === 'error' && !presentation) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <AlertCircle size={48} className="text-rose-400" />
        <p className="text-sm text-rose-600">{streamError || '连接失败'}</p>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRetry}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            <RotateCcw size={14} />
            重试
          </button>
          <Link
            href={`/review/${id}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            <ArrowLeft size={14} />
            返回复盘详情
          </Link>
        </div>
      </div>
    );
  }

  // ─── Main PPT Editor View ────────────────────────────────────────────────

  const slides = presentation?.slides || [];
  const currentSlide = slides[activeSlideIndex];

  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b bg-white px-4 py-2">
        <div className="flex items-center gap-3">
          <Link
            href={`/review/${id}`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition hover:bg-slate-50"
            aria-label="返回复盘详情"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-base font-semibold text-gray-900">
              {presentation?.title || 'PPT 编辑器'}
            </h1>
            <p className="text-xs text-slate-500">{review.project.projectName}</p>
          </div>
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
              onClick={handleRetry}
              className="flex items-center gap-1.5 rounded-md bg-amber-50 px-2.5 py-1 transition hover:bg-amber-100"
            >
              <WifiOff size={12} className="text-amber-600" />
              <span className="text-xs text-amber-700">连接中断 - 点击重连</span>
            </button>
          )}

          {/* Export dropdown */}
          <div className="relative" ref={exportDropdownRef}>
            <button
              onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
              disabled={isExporting || !editingEnabled}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-blue-600 px-3 text-xs font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
              aria-label="导出"
            >
              {isExporting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Download size={14} />
              )}
              下载
              <svg className="ml-0.5 h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {exportDropdownOpen && (
              <div className="absolute right-0 top-full z-50 mt-1 w-32 rounded-md border border-slate-200 bg-white py-1 shadow-lg">
                <button
                  onClick={handleDownloadPPTX}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                >
                  <Presentation size={12} />
                  PPTX
                </button>
                <button
                  onClick={handleDownloadPDF}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                >
                  <Download size={12} />
                  PDF
                </button>
              </div>
            )}
          </div>
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
                      <p className="text-sm text-slate-500">正在生成幻灯片...</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <Presentation size={32} className="text-slate-300" />
                      <p className="text-sm text-slate-400">无幻灯片内容</p>
                    </div>
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
        {presentationId && (
          <PPTChatPanel
            presentationId={presentationId}
            onSlideUpdate={handleSlideUpdate}
          />
        )}
      </div>
    </div>
  );
}
