'use client';

import { use, useState, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import {
  ArrowLeft,
  Save,
  Download,
  FileText,
  MessageCircle,
  Send,
  Table2,
  X,
  ChevronRight,
} from 'lucide-react';
import { Loading } from '@/components/ui/loading';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ReportSection {
  title: string;
  content: string;
}

interface ReportData {
  id: string;
  reportContent: ReportSection[] | Record<string, unknown> | string | null;
}

interface ReviewDetail {
  id: string;
  projectId: string;
  status: string;
  modules: Record<string, boolean>;
  reportContent: unknown;
  project: {
    id: string;
    projectName: string;
    category: string;
    brand: string;
    businessLine: string | null;
  };
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface NoteRecord {
  id: string;
  kolNickName: string | null;
  kolFanNum: number | null;
  noteLink: string | null;
  noteId: string | null;
  impNum: number;
  readNum: number;
  likeNum: number;
  favNum: number;
  cmtNum: number;
  shareNum: number;
}

// ─── Helper: Parse report content into sections ──────────────────────────────

function parseReportSections(content: unknown): ReportSection[] {
  if (!content) return [];

  if (typeof content === 'string') {
    // Try to split by headings
    const lines = content.split('\n');
    const sections: ReportSection[] = [];
    let currentTitle = '报告内容';
    let currentContent: string[] = [];

    for (const line of lines) {
      const headingMatch = line.match(/^#{1,3}\s+(.+)/);
      if (headingMatch) {
        if (currentContent.length > 0) {
          sections.push({ title: currentTitle, content: currentContent.join('\n') });
        }
        currentTitle = headingMatch[1];
        currentContent = [];
      } else {
        currentContent.push(line);
      }
    }
    if (currentContent.length > 0 || sections.length === 0) {
      sections.push({ title: currentTitle, content: currentContent.join('\n') });
    }
    return sections;
  }

  if (Array.isArray(content)) {
    return content.map((item, idx) => ({
      title: item.title || `章节 ${idx + 1}`,
      content: typeof item.content === 'string' ? item.content : JSON.stringify(item.content || '', null, 2),
    }));
  }

  if (typeof content === 'object' && content !== null) {
    return Object.entries(content as Record<string, unknown>).map(([key, value]) => ({
      title: key,
      content: typeof value === 'string' ? value : JSON.stringify(value, null, 2),
    }));
  }

  return [];
}

// ─── Page Component ──────────────────────────────────────────────────────────

export default function ProofreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  // State
  const [activeChapterIdx, setActiveChapterIdx] = useState(0);
  const [editorContent, setEditorContent] = useState('');
  const [sections, setSections] = useState<ReportSection[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [showSourceData, setShowSourceData] = useState(false);

  // AI Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Fetch review detail
  const { data: review, isLoading: reviewLoading } = useQuery<ReviewDetail>({
    queryKey: ['review', id],
    queryFn: async () => {
      const res = await fetch(`/api/reviews/${id}`);
      if (!res.ok) throw new Error('获取复盘详情失败');
      return res.json();
    },
  });

  // Fetch report content
  const { data: reportData, isLoading: reportLoading } = useQuery<ReportData>({
    queryKey: ['review-report', id],
    queryFn: async () => {
      const res = await fetch(`/api/reviews/${id}/report`);
      if (!res.ok) throw new Error('获取报告内容失败');
      return res.json();
    },
  });

  // Fetch source data (notes) for comparison
  const { data: sourceNotes, isLoading: notesLoading } = useQuery<NoteRecord[]>({
    queryKey: ['review-source-notes', review?.projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${review!.projectId}/notes`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.notes || [];
    },
    enabled: !!review?.projectId && showSourceData,
  });

  // Initialize sections from report data
  useEffect(() => {
    if (reportData?.reportContent) {
      const parsed = parseReportSections(reportData.reportContent);
      setSections(parsed);
      if (parsed.length > 0) {
        setEditorContent(parsed[0].content);
      }
    }
  }, [reportData]);

  // Update editor content when chapter changes
  useEffect(() => {
    if (sections[activeChapterIdx]) {
      setEditorContent(sections[activeChapterIdx].content);
    }
  }, [activeChapterIdx, sections]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (content: unknown) => {
      const res = await fetch(`/api/reviews/${id}/report`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error('保存失败');
      return res.json();
    },
  });

  // Save handler
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setSaveMessage(null);

    // Update current section content
    const updatedSections = [...sections];
    if (updatedSections[activeChapterIdx]) {
      updatedSections[activeChapterIdx] = {
        ...updatedSections[activeChapterIdx],
        content: editorContent,
      };
    }
    setSections(updatedSections);

    try {
      await saveMutation.mutateAsync(updatedSections);
      setSaveMessage('保存成功');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch {
      setSaveMessage('保存失败，请重试');
    } finally {
      setIsSaving(false);
    }
  }, [sections, activeChapterIdx, editorContent, saveMutation]);

  // Chapter navigation
  const handleChapterClick = useCallback((idx: number) => {
    // Save current content before switching
    setSections((prev) => {
      const updated = [...prev];
      if (updated[activeChapterIdx]) {
        updated[activeChapterIdx] = { ...updated[activeChapterIdx], content: editorContent };
      }
      return updated;
    });
    setActiveChapterIdx(idx);
  }, [activeChapterIdx, editorContent]);

  // AI Chat handler
  const handleSendMessage = useCallback(() => {
    if (!chatInput.trim()) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: chatInput.trim(),
    };

    setChatMessages((prev) => [...prev, userMessage]);
    setChatInput('');

    // Simulate AI response (in production, this would call an AI API)
    setTimeout(() => {
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: `关于"${userMessage.content}"的分析：这是一个AI助手的模拟回复。在实际使用中，AI会基于报告内容和源数据为您提供专业的分析和建议。`,
      };
      setChatMessages((prev) => [...prev, assistantMessage]);
    }, 1000);
  }, [chatInput]);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Loading state
  if (reviewLoading || reportLoading) {
    return <Loading size="lg" text="正在加载审校台..." className="py-20" />;
  }

  if (!review) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-sm text-rose-600">
        复盘记录不存在
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col">
      {/* Top toolbar */}
      <div className="flex items-center justify-between border-b bg-white px-4 py-2">
        <div className="flex items-center gap-3">
          <Link
            href={`/review/${id}`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition hover:bg-slate-50"
            aria-label="返回复盘详情"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-base font-semibold text-gray-900">审校台</h1>
            <p className="text-xs text-slate-500">{review.project.projectName}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSourceData(!showSourceData)}
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition',
              showSourceData
                ? 'border-blue-300 bg-blue-50 text-blue-700'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            )}
          >
            <Table2 size={14} />
            查看源数据对照
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-blue-600 px-3 text-xs font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            <Save size={14} />
            {isSaving ? '保存中...' : '保存'}
          </button>
          <a
            href={`/api/reviews/${id}/export?format=pdf`}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 px-3 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
            download
          >
            <Download size={14} />
            PDF
          </a>
          <a
            href={`/api/reviews/${id}/export?format=word`}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 px-3 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
            download
          >
            <FileText size={14} />
            Word
          </a>
          {saveMessage && (
            <span className={cn(
              'text-xs',
              saveMessage === '保存成功' ? 'text-emerald-600' : 'text-rose-600'
            )}>
              {saveMessage}
            </span>
          )}
        </div>
      </div>

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel: Chapter directory */}
        <aside className="w-56 flex-shrink-0 overflow-y-auto border-r bg-slate-50 p-3">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            章节目录
          </h2>
          <nav className="space-y-0.5" aria-label="章节导航">
            {sections.length === 0 ? (
              <p className="text-xs text-slate-400 italic">暂无章节内容</p>
            ) : (
              sections.map((section, idx) => (
                <button
                  key={idx}
                  onClick={() => handleChapterClick(idx)}
                  className={cn(
                    'flex w-full items-center gap-1.5 rounded-md px-2.5 py-2 text-left text-sm transition',
                    idx === activeChapterIdx
                      ? 'bg-blue-100 font-medium text-blue-800'
                      : 'text-slate-600 hover:bg-slate-100'
                  )}
                >
                  <ChevronRight
                    size={12}
                    className={cn(
                      'flex-shrink-0 transition-transform',
                      idx === activeChapterIdx && 'rotate-90'
                    )}
                  />
                  <span className="truncate">{section.title}</span>
                </button>
              ))
            )}
          </nav>
        </aside>

        {/* Center panel: Editor */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Source data comparison panel (toggle) */}
          {showSourceData && (
            <SourceDataPanel
              notes={sourceNotes || []}
              isLoading={notesLoading}
              onClose={() => setShowSourceData(false)}
            />
          )}

          {/* Editor area */}
          <div className="flex-1 overflow-y-auto p-6">
            {sections.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">
                暂无报告内容，请先生成复盘报告
              </div>
            ) : (
              <div className="mx-auto max-w-3xl">
                <h2 className="mb-4 text-lg font-semibold text-slate-800">
                  {sections[activeChapterIdx]?.title || ''}
                </h2>
                <textarea
                  value={editorContent}
                  onChange={(e) => setEditorContent(e.target.value)}
                  className="min-h-[500px] w-full resize-y rounded-lg border border-slate-200 bg-white p-4 text-sm leading-relaxed text-slate-700 shadow-sm focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  placeholder="在此编辑报告内容..."
                  aria-label="报告内容编辑区"
                />
              </div>
            )}
          </div>
        </div>

        {/* Right panel: AI Assistant */}
        <aside className="flex w-72 flex-shrink-0 flex-col border-l bg-white">
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <MessageCircle size={16} className="text-blue-600" />
            <h2 className="text-sm font-semibold text-slate-800">AI 助手</h2>
          </div>

          {/* Chat messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {chatMessages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <MessageCircle size={32} className="mb-2 text-slate-300" />
                <p className="text-xs text-slate-400">
                  向AI助手提问关于报告内容的问题
                </p>
              </div>
            )}
            {chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  'rounded-lg px-3 py-2 text-xs leading-relaxed',
                  msg.role === 'user'
                    ? 'ml-4 bg-blue-600 text-white'
                    : 'mr-4 bg-slate-100 text-slate-700'
                )}
              >
                {msg.content}
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Chat input */}
          <div className="border-t p-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="输入问题..."
                className="flex-1 rounded-md border border-slate-200 px-3 py-2 text-xs focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-100"
                aria-label="AI助手输入框"
              />
              <button
                onClick={handleSendMessage}
                disabled={!chatInput.trim()}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-blue-600 text-white transition hover:bg-blue-700 disabled:opacity-50"
                aria-label="发送消息"
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

// ─── Source Data Panel Component ─────────────────────────────────────────────

function SourceDataPanel({
  notes,
  isLoading,
  onClose,
}: {
  notes: NoteRecord[];
  isLoading: boolean;
  onClose: () => void;
}) {
  return (
    <div className="border-b bg-slate-50">
      <div className="flex items-center justify-between px-4 py-2">
        <h3 className="text-sm font-semibold text-slate-700">源数据对照</h3>
        <button
          onClick={onClose}
          className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-200 hover:text-slate-600"
          aria-label="关闭源数据面板"
        >
          <X size={14} />
        </button>
      </div>

      <div className="max-h-64 overflow-auto px-4 pb-3">
        {isLoading ? (
          <Loading size="sm" text="加载源数据..." className="py-4" />
        ) : notes.length === 0 ? (
          <p className="py-4 text-center text-xs text-slate-400">暂无源数据</p>
        ) : (
          <div className="overflow-x-auto rounded-md border bg-white">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-slate-100">
                  <th className="whitespace-nowrap px-3 py-2 text-left font-medium text-slate-600">博主昵称</th>
                  <th className="whitespace-nowrap px-3 py-2 text-left font-medium text-slate-600">粉丝量</th>
                  <th className="whitespace-nowrap px-3 py-2 text-left font-medium text-slate-600">笔记ID</th>
                  <th className="whitespace-nowrap px-3 py-2 text-right font-medium text-slate-600">曝光量</th>
                  <th className="whitespace-nowrap px-3 py-2 text-right font-medium text-slate-600">阅读量</th>
                  <th className="whitespace-nowrap px-3 py-2 text-right font-medium text-slate-600">点赞</th>
                  <th className="whitespace-nowrap px-3 py-2 text-right font-medium text-slate-600">收藏</th>
                  <th className="whitespace-nowrap px-3 py-2 text-right font-medium text-slate-600">评论</th>
                  <th className="whitespace-nowrap px-3 py-2 text-right font-medium text-slate-600">分享</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {notes.slice(0, 50).map((note) => (
                  <tr key={note.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-3 py-1.5 text-slate-700">{note.kolNickName || '-'}</td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-slate-700">{note.kolFanNum ?? '-'}</td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-slate-500 font-mono">{note.noteId || '-'}</td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-right text-slate-700">{note.impNum}</td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-right text-slate-700">{note.readNum}</td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-right text-slate-700">{note.likeNum}</td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-right text-slate-700">{note.favNum}</td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-right text-slate-700">{note.cmtNum}</td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-right text-slate-700">{note.shareNum}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {notes.length > 50 && (
              <div className="border-t px-3 py-2 text-center text-xs text-slate-400">
                显示前 50 条，共 {notes.length} 条数据
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
