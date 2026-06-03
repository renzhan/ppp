'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  ChevronDown,
  Save,
  FileText,
} from 'lucide-react';
import { Loading } from '@/components/ui/loading';
import { ReportChapterNav } from '@/components/proofread/report-chapter-nav';
import { ReportAiChat } from '@/components/proofread/report-ai-chat';
import { TraceDataPanel } from '@/components/proofread/trace-data-panel';
import { useChartRenderer } from '@/components/charts/echarts-renderer';
import { useResizablePanel } from '@/hooks/use-resizable-panel';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ChapterData {
  id: string;
  title: string;
  number: number;
  content: string;
  traceIds?: Array<{ traceId: string; label: string }>;
}

interface ChapterStatus {
  id: string;
  title: string;
  number: number;
  status: 'pending' | 'generating' | 'completed' | 'error';
  tokensUsed?: number;
}

// ─── Chapter Definitions ─────────────────────────────────────────────────────

const CHAPTER_DEFS: Array<{ id: string; title: string; number: number }> = [
  { id: 'projectReview', title: '项目回顾', number: 2 },
  { id: 'dataOverview', title: '数据总览', number: 3 },
  { id: 'highlights', title: '项目亮点', number: 4 },
  { id: 'quadrantAnalysis', title: '综合分析', number: 5 },
  { id: 'contentAnalysis', title: '内容分析', number: 6 },
  { id: 'trafficAnalysis', title: '投流分析', number: 7 },
  { id: 'optimization', title: '优化建议', number: 9 },
];

interface ReviewDetail {
  id: string;
  projectId: string;
  status: string;
  reportContent: {
    type?: string;
    chapters?: ChapterData[];
    generatedAt?: string;
  } | null;
  project: {
    id: string;
    projectName: string;
    category: string;
    brand: string;
    businessLine: string | null;
  };
}

type PageStatus = 'loading' | 'generating' | 'ready' | 'error';

// ─── Page Component ──────────────────────────────────────────────────────────

export default function ProofreadPage({ params }: { params: { id: string } }) {
  const { id } = params;

  const [review, setReview] = useState<ReviewDetail | null>(null);
  const [pageStatus, setPageStatus] = useState<PageStatus>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [chapters, setChapters] = useState<ChapterData[]>([]);
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [activeTraceId, setActiveTraceId] = useState<string | null>(null);
  const [chapterStatuses, setChapterStatuses] = useState<ChapterStatus[]>([]);

  const eventSourceRef = useRef<EventSource | null>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const hasStartedRef = useRef(false);
  const mainRef = useRef<HTMLDivElement>(null);

  // Derive active chapter content for chart rendering
  const activeChapterContent = chapters.find((c) => c.id === activeChapterId)?.content || '';

  // Chart rendering for the active chapter
  useChartRenderer(contentRef, activeChapterContent);

  // Trace anchors - show available trace items for active chapter
  const activeChapterTraceIds = chapters.find((c) => c.id === activeChapterId)?.traceIds || [];

  // Resizable panels
  const leftPanel = useResizablePanel({ defaultWidth: 160, minWidth: 120, maxWidth: 320, side: 'left' });
  const rightPanel = useResizablePanel({ defaultWidth: 288, minWidth: 200, maxWidth: 500, side: 'right' });

  // Scroll to top when switching chapters
  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTop = 0;
    }
  }, [activeChapterId]);

  // ─── Fetch Review ────────────────────────────────────────────────────────

  useEffect(() => {
    const fetchReview = async () => {
      try {
        const res = await fetch(`/api/reviews/${id}`);
        if (!res.ok) throw new Error('获取复盘详情失败');
        const data: ReviewDetail = await res.json();
        setReview(data);

        // If report already exists, load it
        if (data.reportContent?.type === 'chapters' && data.reportContent.chapters?.length) {
          setChapters(data.reportContent.chapters);
          setActiveChapterId(data.reportContent.chapters[0].id);
          // Initialize chapterStatuses from loaded chapters (all completed)
          setChapterStatuses(
            data.reportContent.chapters.map((ch: ChapterData) => ({
              id: ch.id,
              title: ch.title,
              number: ch.number,
              status: 'completed' as const,
            }))
          );
          if (data.status === 'completed') {
            setPageStatus('ready');
          } else {
            // Still generating - show what we have and connect to stream for updates
            setPageStatus('generating');
            connectToStream();
          }
        } else if (data.status === 'generating') {
          // Status is generating but no content yet - connect to stream
          setPageStatus('generating');
          connectToStream();
        } else {
          // No report yet - start generation
          setPageStatus('generating');
          startGeneration();
        }
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : '加载失败');
        setPageStatus('error');
      }
    };

    if (!hasStartedRef.current) {
      hasStartedRef.current = true;
      fetchReview();
    }
  }, [id]);

  // ─── Start Generation ────────────────────────────────────────────────────

  const startGeneration = useCallback(() => {
    setPageStatus('generating');
    setChapters([]);
    setChapterStatuses(
      CHAPTER_DEFS.map((def) => ({
        id: def.id,
        title: def.title,
        number: def.number,
        status: 'pending' as const,
      }))
    );
    connectToStream();
  }, []);

  // ─── SSE Stream Connection ───────────────────────────────────────────────

  const connectToStream = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventSource = new EventSource(`/api/generate-report/${id}/stream`);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'start') {
          // Generation started - initialize all chapter statuses to pending
          setPageStatus('generating');
          setChapterStatuses(
            CHAPTER_DEFS.map((def) => ({
              id: def.id,
              title: def.title,
              number: def.number,
              status: 'pending' as const,
            }))
          );
        } else if (data.type === 'progress') {
          // Chapter generation progress update
          setChapterStatuses(prev => prev.map(cs =>
            cs.id === data.chapterId
              ? { ...cs, status: 'generating', tokensUsed: data.tokensUsed }
              : cs
          ));
        } else if (data.type === 'chapter') {
          // New chapter received
          const chapter = data.chapter as ChapterData;
          setChapters((prev) => {
            const existing = prev.find((c) => c.id === chapter.id);
            if (existing) {
              return prev.map((c) => (c.id === chapter.id ? chapter : c));
            }
            return [...prev, chapter];
          });
          // Mark chapter status as completed
          setChapterStatuses(prev => prev.map(cs =>
            cs.id === chapter.id
              ? { ...cs, status: 'completed' }
              : cs
          ));
          // Auto-select first chapter
          setActiveChapterId((prev) => prev ?? chapter.id);
        } else if (data.type === 'done') {
          eventSource.close();
          setPageStatus('ready');
        } else if (data.type === 'error') {
          eventSource.close();
          setErrorMessage(data.message || '生成失败');
          if (chapters.length > 0) {
            setPageStatus('ready'); // Show partial results
          } else {
            setPageStatus('error');
          }
        }
      } catch {
        // Skip malformed events
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      if (chapters.length > 0) {
        setPageStatus('ready');
      } else {
        setPageStatus('error');
        setErrorMessage('连接中断');
      }
    };
  }, [id, chapters.length]);

  // ─── Cleanup ─────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  // ─── Close export dropdown on outside click ──────────────────────────────

  useEffect(() => {
    if (!exportOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [exportOpen]);

  // ─── Save Report ────────────────────────────────────────────────────────

  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chaptersRef = useRef(chapters);
  chaptersRef.current = chapters;
  const savingRef = useRef(false);

  const handleSave = useCallback(async () => {
    if (!review || chaptersRef.current.length === 0 || savingRef.current) return;
    savingRef.current = true;
    setIsSaving(true);
    try {
      await fetch(`/api/reviews/${id}/report`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: { type: 'chapters', chapters: chaptersRef.current, generatedAt: new Date().toISOString() },
        }),
      });
      setLastSavedAt(new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }));
    } catch {
      // Silently fail
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  }, [review, id]);

  // ─── Auto-save: debounce 5s after content changes ────────────────────────

  const triggerAutoSave = useCallback(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    autoSaveTimerRef.current = setTimeout(() => {
      if (chaptersRef.current.length > 0 && pageStatus === 'ready') {
        handleSave();
      }
    }, 5000);
  }, [handleSave, pageStatus]);

  // Cleanup auto-save timer
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, []);

  // ─── Export Functions ────────────────────────────────────────────────────

  const handleExportPDF = async () => {
    setExportOpen(false);
    const { buildFullExportHtml } = await import('@/lib/report-export');
    const fullHtml = buildFullExportHtml(chapters, review?.project.projectName + '-复盘' || '复盘报告');

    // Open a hidden iframe to render the HTML with ECharts, then capture as PDF
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.left = '-9999px';
    iframe.style.top = '-9999px';
    iframe.style.width = '900px';
    iframe.style.height = '1200px';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) {
      document.body.removeChild(iframe);
      return;
    }

    iframeDoc.open();
    iframeDoc.write(fullHtml);
    iframeDoc.close();

    // Wait for ECharts to render, then capture with html2canvas + jsPDF
    setTimeout(async () => {
      try {
        const html2canvas = (await import('html2canvas')).default;
        const { jsPDF } = await import('jspdf');

        const container = iframeDoc.querySelector('.report-container') as HTMLElement;
        if (!container) {
          document.body.removeChild(iframe);
          return;
        }

        const canvas = await html2canvas(container, {
          scale: 2,
          useCORS: true,
          logging: false,
          width: 900,
          windowWidth: 900,
        });

        const imgData = canvas.toDataURL('image/png');
        const imgWidth = 210; // A4 width in mm
        const pageHeight = 297; // A4 height in mm
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        const pdf = new jsPDF('p', 'mm', 'a4');
        let heightLeft = imgHeight;
        let position = 0;

        // First page
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        // Additional pages if content overflows
        while (heightLeft > 0) {
          position = -(imgHeight - heightLeft);
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
          heightLeft -= pageHeight;
        }

        const filename = `${review?.project.projectName || '复盘报告'}.pdf`;
        pdf.save(filename);
      } catch (err) {
        console.error('PDF export failed:', err);
        // Fallback to print
        const win = window.open('', '_blank');
        if (win) {
          win.document.write(fullHtml);
          win.document.close();
          setTimeout(() => win.print(), 1500);
        }
      } finally {
        document.body.removeChild(iframe);
      }
    }, 2000); // Wait 2s for ECharts to render
  };

  const handleExportWord = async () => {
    setExportOpen(false);
    const { buildWordExportHtml } = await import('@/lib/report-export');
    const { renderChartsToImages } = await import('@/lib/chart-to-image');

    // Render chart placeholders to base64 images
    const chaptersWithChartImages = await renderChartsToImages(chapters);

    const wordHtml = buildWordExportHtml(chaptersWithChartImages, review?.project.projectName + '-复盘' || '复盘报告');
    const blob = new Blob(['\uFEFF' + wordHtml], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${review?.project.projectName || '复盘报告'}.doc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Update Chapter Content (from editor) ────────────────────────────────

  const handleContentChange = useCallback((chapterId: string, newContent: string) => {
    setChapters((prev) =>
      prev.map((c) => (c.id === chapterId ? { ...c, content: newContent } : c))
    );
    triggerAutoSave();
  }, [triggerAutoSave]);

  // ─── Apply AI suggestion ─────────────────────────────────────────────────

  const handleApplySuggestion = useCallback((content: string) => {
    if (!activeChapterId) return;
    setChapters((prev) =>
      prev.map((c) => (c.id === activeChapterId ? { ...c, content } : c))
    );
    triggerAutoSave();
  }, [activeChapterId, triggerAutoSave]);

  // ─── Loading State ───────────────────────────────────────────────────────

  if (pageStatus === 'loading') {
    return <Loading size="lg" text="正在加载复盘数据..." className="py-20" />;
  }

  if (pageStatus === 'error' && chapters.length === 0) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <AlertCircle size={48} className="text-rose-400" />
        <p className="text-sm text-rose-600">{errorMessage || '加载失败'}</p>
        <Link
          href={`/review/${id}`}
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
        >
          <ArrowLeft size={14} />
          返回复盘详情
        </Link>
      </div>
    );
  }

  // ─── Active chapter ──────────────────────────────────────────────────────

  const activeChapter = chapters.find((c) => c.id === activeChapterId) || chapters[0];

  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b bg-white  py-2">
        <div className="flex items-center gap-3 text-lg">
          <Link
            href="/review"
            className=" text-gray-500 hover:text-gray-700"
          >
            复盘系统
          </Link>
          <span className=" text-gray-300">/</span>
          <span className="text-gray-700">审校台</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={isSaving || chapters.length === 0}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-gray-200 px-3 text-xs font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
          >
            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {isSaving ? '保存中' : '保存'}
          </button>
          {lastSavedAt && (
            <span className="text-[10px] text-gray-400">已保存 {lastSavedAt}</span>
          )}

          {/* Export dropdown */}
          <div className="relative" ref={exportRef}>
            <button
              onClick={() => setExportOpen(!exportOpen)}
              disabled={chapters.length === 0}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-brand px-3 text-xs font-medium text-white transition hover:bg-brand-600 disabled:opacity-50"
            >
              下载
              <ChevronDown size={12} />
            </button>
            {exportOpen && (
              <div className="absolute right-0 top-full z-50 mt-1 w-28 rounded-md border border-gray-200 bg-white py-1 shadow-lg">
                <button
                  onClick={handleExportPDF}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
                >
                  PDF
                </button>
                <button
                  onClick={handleExportWord}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
                >
                  Word
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Report title area */}
      <div className="border-b bg-white px-0 py-4">
        <h1 className="text-xl font-bold text-gray-900">
          {review?.project.projectName || ''}-复盘
        </h1>
        <p className="mt-1 text-xs text-gray-500">
          {review?.reportContent?.generatedAt
            ? `${new Date(review.reportContent.generatedAt).toLocaleString('zh-CN')}`
            : ''}
          {review?.project.brand && ` · ${review.project.brand}`}
        </p>
      </div>

      {/* Three-panel layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Chapter navigation (resizable) */}
        <div className="flex-shrink-0 overflow-y-auto" style={{ width: leftPanel.width }}>
          <ReportChapterNav
            chapterStatuses={chapterStatuses}
            chapters={chapters}
            activeChapterId={activeChapterId}
            onSelectChapter={setActiveChapterId}
          />
        </div>
        {/* Left resize handle */}
        <div
          className="w-1 cursor-col-resize bg-transparent hover:bg-blue-200 active:bg-blue-300 transition-colors flex-shrink-0"
          onMouseDown={leftPanel.handleMouseDown}
        />

        {/* Center: Content editor */}
        <main ref={mainRef} className="flex-1 overflow-y-auto bg-white px-8 py-6 min-w-0">
          {pageStatus === 'generating' && chapters.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-4">
              <Loader2 size={32} className="animate-spin text-brand" />
              <p className="text-sm text-gray-600">正在生成复盘报告...</p>
              <p className="text-xs text-gray-400">按章节逐步生成，请稍候</p>
            </div>
          ) : activeChapterId && chapterStatuses.find(cs => cs.id === activeChapterId)?.status === 'generating' && !chapters.find(c => c.id === activeChapterId) ? (
            <div className="flex h-full flex-col items-center justify-center gap-4">
              <Loader2 size={32} className="animate-spin text-brand" />
              <p className="text-sm text-gray-600">正在生成中...</p>
              <p className="text-xs text-gray-400">
                {chapterStatuses.find(cs => cs.id === activeChapterId)?.title || '章节'}正在生成，请稍候
              </p>
            </div>
          ) : activeChapter ? (
            <div className="mx-auto max-w-3xl">
              {/* Trace toolbar - show available data sources for this chapter */}
              {activeChapterTraceIds.length > 0 && (
                <div className="mb-3 flex flex-wrap items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                  <span className="text-xs text-slate-500 mr-1">📊 数据溯源：</span>
                  {activeChapterTraceIds.map((t) => (
                    <button
                      key={t.traceId}
                      onClick={() => setActiveTraceId(t.traceId)}
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] transition ${
                        activeTraceId === t.traceId
                          ? 'border-blue-400 bg-blue-50 text-blue-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-600'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              )}
              <div
                ref={contentRef}
                className="report-editor-content"
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => {
                  if (activeChapter) {
                    handleContentChange(activeChapter.id, e.currentTarget.innerHTML);
                  }
                }}
                dangerouslySetInnerHTML={{ __html: activeChapter.content }}
              />
              {pageStatus === 'generating' && (
                <div className="mt-4 flex items-center gap-2 text-xs text-brand">
                  <Loader2 size={12} className="animate-spin" />
                  后续章节生成中...
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-gray-400">选择左侧章节查看内容</p>
            </div>
          )}
        </main>

        {/* Right resize handle */}
        <div
          className="w-1 cursor-col-resize bg-transparent hover:bg-blue-200 active:bg-blue-300 transition-colors flex-shrink-0"
          onMouseDown={rightPanel.handleMouseDown}
        />
        {/* Right: AI Chat or Trace Panel (resizable) */}
        <div className="flex-shrink-0 overflow-hidden" style={{ width: rightPanel.width }}>
          {activeTraceId ? (
            <TraceDataPanel
              reviewId={id}
              traceId={activeTraceId}
              onClose={() => setActiveTraceId(null)}
            />
          ) : (
            <ReportAiChat
              reviewId={id}
              chapterTitle={activeChapter?.title || ''}
              chapterContent={activeChapter?.content || ''}
              onApplySuggestion={handleApplySuggestion}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Helper: Report editor styles (injected via global CSS or style tag) ───
// Styles are applied via the className "report-editor-content" in globals.css
