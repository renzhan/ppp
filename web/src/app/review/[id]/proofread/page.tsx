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
import { useChartRenderer } from '@/components/charts/echarts-renderer';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ChapterData {
  id: string;
  title: string;
  number: number;
  content: string;
}

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

  const eventSourceRef = useRef<EventSource | null>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const hasStartedRef = useRef(false);

  // Derive active chapter content for chart rendering
  const activeChapterContent = chapters.find((c) => c.id === activeChapterId)?.content || '';

  // Chart rendering for the active chapter
  useChartRenderer(contentRef, activeChapterContent);

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
          setPageStatus('ready');
        } else if (data.status === 'generating') {
          // Connect to stream
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
          // Generation started
          setPageStatus('generating');
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

  const handleSave = async () => {
    if (!review || chapters.length === 0) return;
    setIsSaving(true);
    try {
      await fetch(`/api/reviews/${id}/report`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: { type: 'chapters', chapters, generatedAt: new Date().toISOString() },
        }),
      });
    } catch {
      // Silently fail
    } finally {
      setIsSaving(false);
    }
  };

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
  }, []);

  // ─── Apply AI suggestion ─────────────────────────────────────────────────

  const handleApplySuggestion = useCallback((content: string) => {
    if (!activeChapterId) return;
    setChapters((prev) =>
      prev.map((c) => (c.id === activeChapterId ? { ...c, content } : c))
    );
  }, [activeChapterId]);

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
      <header className="flex items-center justify-between border-b bg-white px-4 py-2">
        <div className="flex items-center gap-3">
          <Link
            href="/review"
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            复盘系统
          </Link>
          <span className="text-xs text-gray-300">/</span>
          <span className="text-xs text-gray-700">审校台</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={isSaving || chapters.length === 0}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-gray-200 px-3 text-xs font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
          >
            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            保存
          </button>

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
      <div className="border-b bg-white px-8 py-4">
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
        {/* Left: Chapter navigation */}
        <ReportChapterNav
          chapters={chapters}
          activeChapterId={activeChapterId}
          onSelectChapter={setActiveChapterId}
          isGenerating={pageStatus === 'generating'}
        />

        {/* Center: Content editor */}
        <main className="flex-1 overflow-y-auto bg-white px-8 py-6">
          {pageStatus === 'generating' && chapters.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-4">
              <Loader2 size={32} className="animate-spin text-brand" />
              <p className="text-sm text-gray-600">正在生成复盘报告...</p>
              <p className="text-xs text-gray-400">按章节逐步生成，请稍候</p>
            </div>
          ) : activeChapter ? (
            <div className="mx-auto max-w-3xl">
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

        {/* Right: AI Chat */}
        <ReportAiChat
          reviewId={id}
          chapterTitle={activeChapter?.title || ''}
          chapterContent={activeChapter?.content || ''}
          onApplySuggestion={handleApplySuggestion}
        />
      </div>
    </div>
  );
}

// ─── Helper: Report editor styles (injected via global CSS or style tag) ───
// Styles are applied via the className "report-editor-content" in globals.css
