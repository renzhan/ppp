'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import {
  ChevronLeft,
  ChevronRight,
  Send,
  Download,
  RefreshCw,
  Check,
  Edit3,
  Eye,
  EyeOff,
  AlertTriangle,
  MessageSquare,
  PanelLeftClose,
  PanelRightClose,
  Sparkles,
  Columns,
  FileText,
  Loader2,
  ArrowUpRight,
  X,
  Bot,
} from 'lucide-react';
import Link from 'next/link';
import { Loading } from '@/components/ui/loading';
import { RatingBadge } from '@/components/ui/rating-badge';
import { PptPanel } from '@/components/ppt/PptPanel';

// ─── Types ───────────────────────────────────────────────────────────────────

type ToneIntensity = 'positive' | 'standard' | 'conservative';
type ModuleStatus = 'show' | 'hide' | 'degraded';
type Rating = 'S' | 'A' | 'B' | 'C' | 'D';

interface ModuleDecision {
  moduleId: string;
  moduleName: string;
  status: ModuleStatus;
  reason: string;
  degradedFields?: string[];
}

interface NarrativeParagraph {
  id: string;
  content: string;
  tone: ToneIntensity;
  relatedMetrics: string[];
  isTransformed: boolean;
}

interface ModuleTable {
  title?: string;
  headers: string[];
  rows: string[][];
}

interface ModuleContent {
  status?: string;
  moduleId?: string;
  paragraphs?: NarrativeParagraph[];
  tables?: ModuleTable[];
  toneUsed?: ToneIntensity;
  attributionUsed?: string;
}

interface ReviewData {
  id: string;
  projectId: string;
  versionNumber: number;
  generatedAt: string;
  status: string;
  config: Record<string, unknown>;
  content: Record<string, ModuleContent>;
  modules: ModuleDecision[];
  edits: Array<{ id: string; moduleId: string; editType: string; editedAt: string }>;
  project: {
    id: string;
    projectName: string;
    brand: string;
    category: string;
    projectType: string;
  };
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const TONE_OPTIONS: { value: ToneIntensity; label: string }[] = [
  { value: 'positive', label: '积极' },
  { value: 'standard', label: '标准' },
  { value: 'conservative', label: '保守' },
];

const MODULE_NAMES: Record<string, string> = {
  M1: '数据总览',
  M2: '项目回顾',
  M3: '项目亮点',
  M4: '未达预期项',
  M5: '内容分析',
  M6: '竞品洞察',
  M7: '投流分析',
  M8: '问题诊断与建议',
};

// ─── Module Navigation Tree (Left Panel) ─────────────────────────────────────

function ModuleNavTree({
  modules,
  activeModuleId,
  onSelect,
}: {
  modules: ModuleDecision[];
  activeModuleId: string;
  onSelect: (moduleId: string) => void;
}) {
  const statusIcon = (status: ModuleStatus) => {
    switch (status) {
      case 'show':
        return <Eye size={14} className="text-green-600" />;
      case 'hide':
        return <EyeOff size={14} className="text-gray-400" />;
      case 'degraded':
        return <AlertTriangle size={14} className="text-yellow-500" />;
    }
  };

  return (
    <nav className="space-y-1" aria-label="模块导航">
      {modules.map((mod) => (
        <button
          key={mod.moduleId}
          onClick={() => onSelect(mod.moduleId)}
          className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
            activeModuleId === mod.moduleId
              ? 'bg-primary/10 font-medium text-primary'
              : 'text-gray-700 hover:bg-gray-100'
          } ${mod.status === 'hide' ? 'opacity-50' : ''}`}
          aria-current={activeModuleId === mod.moduleId ? 'page' : undefined}
        >
          {statusIcon(mod.status)}
          <span className="flex-1 truncate">
            {mod.moduleId} {mod.moduleName}
          </span>
          {mod.status === 'degraded' && (
            <span className="text-xs text-yellow-600">降级</span>
          )}
        </button>
      ))}
    </nav>
  );
}

// ─── Paragraph Editor (Center Panel) ─────────────────────────────────────────

function ParagraphEditor({
  paragraph,
  versionId,
  moduleId,
  onSave,
  onToneChange,
  onTransform,
}: {
  paragraph: NarrativeParagraph;
  versionId: string;
  moduleId: string;
  onSave: (paragraphId: string, content: string) => void;
  onToneChange: (paragraphId: string, tone: ToneIntensity) => void;
  onTransform: (paragraphId: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(paragraph.content);

  const handleSave = () => {
    onSave(paragraph.id, editContent);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditContent(paragraph.content);
    setIsEditing(false);
  };

  return (
    <div className="group relative rounded-lg border border-gray-200 p-4 transition-colors hover:border-gray-300">
      {/* Paragraph content */}
      {isEditing ? (
        <div className="space-y-2">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full resize-none rounded-md border border-gray-300 p-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            rows={4}
            aria-label="编辑段落内容"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90"
            >
              <Check size={12} /> 保存
            </button>
            <button
              onClick={handleCancel}
              className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
            >
              取消
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm leading-relaxed text-gray-800">{paragraph.content}</p>
      )}

      {/* Paragraph metadata and actions */}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Tone toggle */}
          <div className="flex rounded-md border border-gray-200">
            {TONE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onToneChange(paragraph.id, opt.value)}
                className={`px-2 py-0.5 text-xs transition-colors ${
                  paragraph.tone === opt.value
                    ? 'bg-primary/10 font-medium text-primary'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                aria-label={`切换语气为${opt.label}`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Transformed indicator */}
          {paragraph.isTransformed && (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700">
              <ArrowUpRight size={10} /> 已转化
            </span>
          )}

          {/* Related metrics */}
          {paragraph.relatedMetrics?.length > 0 && (
            <span className="text-xs text-gray-400">
              关联: {paragraph.relatedMetrics.join(', ')}
            </span>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              aria-label="编辑段落"
            >
              <Edit3 size={14} />
            </button>
          )}
          {/* Problem to opportunity transformation */}
          {!paragraph.isTransformed && paragraph.tone === 'conservative' && (
            <button
              onClick={() => onTransform(paragraph.id)}
              className="rounded p-1 text-gray-400 hover:bg-green-50 hover:text-green-600"
              aria-label="问题转机会"
              title="问题转机会"
            >
              <Sparkles size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Module Data Table ───────────────────────────────────────────────────────

function ModuleDataTable({
  table,
  columnVisibility,
}: {
  table: ModuleTable;
  columnVisibility: Record<string, boolean>;
}) {
  // Determine which column indices are visible
  const visibleIndices = table.headers
    .map((header, idx) => ({ header, idx }))
    .filter(({ header }) => columnVisibility[header] !== false);

  if (visibleIndices.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-gray-300 p-4 text-center text-xs text-gray-400">
        所有列已隐藏，请在"列管理"中恢复显示
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      {table.title && (
        <div className="border-b bg-gray-50 px-4 py-2">
          <h4 className="text-xs font-medium text-gray-700">{table.title}</h4>
        </div>
      )}
      <table className="w-full text-xs">
        <thead className="border-b bg-gray-50">
          <tr>
            {visibleIndices.map(({ header, idx }) => (
              <th
                key={idx}
                className="px-3 py-2 text-left font-medium text-gray-600"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, rowIdx) => (
            <tr
              key={rowIdx}
              className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}
            >
              {visibleIndices.map(({ idx }) => (
                <td key={idx} className="px-3 py-2 text-gray-700">
                  {row[idx] ?? ''}
                </td>
              ))}
            </tr>
          ))}
          {table.rows.length === 0 && (
            <tr>
              <td
                colSpan={visibleIndices.length}
                className="px-3 py-4 text-center text-gray-400"
              >
                暂无数据
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── Center Panel Content ────────────────────────────────────────────────────

function CenterPanel({
  reviewData,
  activeModuleId,
  versionId,
  columnVisibility,
  onColumnToggle,
}: {
  reviewData: ReviewData;
  activeModuleId: string;
  versionId: string;
  columnVisibility: Record<string, boolean>;
  onColumnToggle: (column: string, visible: boolean) => void;
}) {
  const queryClient = useQueryClient();

  const moduleContent = reviewData.content[activeModuleId] as ModuleContent | undefined;
  const moduleDecision = reviewData.modules.find((m) => m.moduleId === activeModuleId);

  // Mutation for saving paragraph edits
  const editMutation = useMutation({
    mutationFn: async ({ content }: { content: Record<string, unknown> }) => {
      const res = await fetch(`/api/review/${versionId}/module/${activeModuleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error('保存失败');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviewData', versionId] });
    },
  });

  // Mutation for regenerating module
  const regenerateMutation = useMutation({
    mutationFn: async (tone?: ToneIntensity) => {
      const res = await fetch(`/api/review/${versionId}/regenerate/${activeModuleId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tone }),
      });
      if (!res.ok) throw new Error('重新生成失败');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviewData', versionId] });
    },
  });

  // Mutation for tone change on a paragraph
  const toneMutation = useMutation({
    mutationFn: async ({ tone }: { tone: ToneIntensity }) => {
      const res = await fetch(`/api/review/${versionId}/tone`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tone, moduleId: activeModuleId }),
      });
      if (!res.ok) throw new Error('切换语气失败');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviewData', versionId] });
    },
  });

  const handleParagraphSave = (paragraphId: string, content: string) => {
    const paragraphs = moduleContent?.paragraphs?.map((p) =>
      p.id === paragraphId ? { ...p, content } : p
    );
    editMutation.mutate({ content: { paragraphs } });
  };

  const handleToneChange = (_paragraphId: string, tone: ToneIntensity) => {
    toneMutation.mutate({ tone });
  };

  const handleTransform = (paragraphId: string) => {
    // Transform problem to opportunity by regenerating with positive tone
    const paragraphs = moduleContent?.paragraphs?.map((p) =>
      p.id === paragraphId ? { ...p, isTransformed: true, tone: 'positive' as ToneIntensity } : p
    );
    editMutation.mutate({ content: { paragraphs } });
  };

  if (!moduleDecision) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-500">
        选择一个模块查看内容
      </div>
    );
  }

  if (moduleDecision.status === 'hide') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-gray-500">
        <EyeOff size={24} />
        <p className="text-sm">该模块已隐藏</p>
        <p className="text-xs text-gray-400">{moduleDecision.reason}</p>
      </div>
    );
  }

  const paragraphs = moduleContent?.paragraphs ?? [];
  const moduleTables = (moduleContent?.tables ?? []) as ModuleTable[];
  const moduleTableHeaders = Array.from(
    new Set(moduleTables.flatMap((t) => t.headers))
  );

  return (
    <div className="h-full overflow-y-auto">
      {/* Module header */}
      <div className="sticky top-0 z-10 border-b bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {activeModuleId} {moduleDecision.moduleName}
            </h2>
            {moduleDecision.status === 'degraded' && (
              <p className="mt-0.5 text-xs text-yellow-600">
                降级模式 — 缺失: {moduleDecision.degradedFields?.join(', ')}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => regenerateMutation.mutate(undefined)}
              disabled={regenerateMutation.isPending}
              className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              aria-label="重新生成"
            >
              {regenerateMutation.isPending ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <RefreshCw size={12} />
              )}
              重新生成
            </button>
            <button
              onClick={() => {}}
              className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
              aria-label="确认模块"
            >
              <Check size={12} /> 确认
            </button>
          </div>
        </div>
      </div>

      {/* Column visibility controls - show only when module has table data */}
      {moduleContent && moduleTables.length > 0 && (
        <div className="border-b bg-gray-50 px-6 py-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <Columns size={12} />
            <span>数据列:</span>
            {moduleTableHeaders.map((col) => (
              <button
                key={col}
                onClick={() => onColumnToggle(col, columnVisibility[col] === false)}
                className={`rounded px-2 py-0.5 transition-colors ${
                  columnVisibility[col] !== false
                    ? 'bg-white text-gray-700 shadow-sm'
                    : 'text-gray-400 line-through'
                }`}
              >
                {col}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Data Tables */}
      {moduleTables.length > 0 && (
        <div className="space-y-4 px-6 pt-4">
          {moduleTables.map((table, idx) => (
            <ModuleDataTable
              key={idx}
              table={table}
              columnVisibility={columnVisibility}
            />
          ))}
        </div>
      )}

      {/* Paragraphs */}
      <div className="space-y-4 p-6">
        {paragraphs.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">
            暂无内容，点击"重新生成"生成模块文案
          </div>
        ) : (
          paragraphs.map((paragraph) => (
            <ParagraphEditor
              key={paragraph.id}
              paragraph={paragraph}
              versionId={versionId}
              moduleId={activeModuleId}
              onSave={handleParagraphSave}
              onToneChange={handleToneChange}
              onTransform={handleTransform}
            />
          ))
        )}

        {/* Loading states */}
        {(editMutation.isPending || regenerateMutation.isPending || toneMutation.isPending) && (
          <div className="flex items-center justify-center gap-2 py-4 text-sm text-gray-500">
            <Loader2 size={14} className="animate-spin" />
            <span>正在处理...</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── AI Chat Panel (Right Panel) ─────────────────────────────────────────────

function AIChatPanel({
  projectId,
  activeModuleId,
  onInsertToReport,
}: {
  projectId: string;
  activeModuleId: string;
  onInsertToReport: (text: string) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const chatMutation = useMutation({
    mutationFn: async (newMessages: ChatMessage[]) => {
      const res = await fetch(`/api/chat/${projectId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          moduleId: activeModuleId,
        }),
      });
      if (!res.ok) throw new Error('AI 回复失败');
      return res.json();
    },
    onSuccess: (data) => {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.response },
      ]);
    },
  });

  const handleSend = () => {
    if (!input.trim() || chatMutation.isPending) return;

    const userMessage: ChatMessage = { role: 'user', content: input.trim() };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    chatMutation.mutate(updatedMessages);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Chat header */}
      <div className="border-b px-4 py-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <MessageSquare size={14} />
          AI 助手
        </h3>
        <p className="mt-0.5 text-xs text-gray-500">
          归因分析 · 数据查询 · 优化建议
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="py-8 text-center text-xs text-gray-400">
            <MessageSquare size={24} className="mx-auto mb-2 text-gray-300" />
            <p>向 AI 提问关于报告的问题</p>
            <p className="mt-1">例如：这个指标为什么表现不佳？</p>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                msg.role === 'user'
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.role === 'assistant' && (
                <button
                  onClick={() => onInsertToReport(msg.content)}
                  className="mt-2 inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-50"
                  aria-label="插入到报告"
                >
                  <FileText size={10} /> 插入报告
                </button>
              )}
            </div>
          </div>
        ))}

        {chatMutation.isPending && (
          <div className="flex justify-start">
            <div className="rounded-lg bg-gray-100 px-3 py-2">
              <Loader2 size={14} className="animate-spin text-gray-500" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入问题..."
            className="flex-1 resize-none rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            rows={2}
            aria-label="AI 对话输入"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || chatMutation.isPending}
            className="rounded-md bg-primary p-2 text-white hover:bg-primary/90 disabled:opacity-50"
            aria-label="发送消息"
          >
            <Send size={16} />
          </button>
        </div>
        {chatMutation.isError && (
          <p className="mt-1 text-xs text-red-500">发送失败，请重试</p>
        )}
      </div>
    </div>
  );
}

// ─── Toolbar ─────────────────────────────────────────────────────────────────

interface TemplateSummary {
  id: string;
  name: string;
  preview?: string;
}

function ReviewToolbar({
  versionId,
  versionNumber,
  projectName,
  currentTone,
  onToneChange,
  onExport,
  onFinalize,
  isExporting,
  isFinalizing,
  canFinalize,
  isFinalized,
  columnVisibility,
  onColumnToggle,
  availableColumns,
}: {
  versionId: string;
  versionNumber: number;
  projectName: string;
  currentTone: ToneIntensity;
  onToneChange: (tone: ToneIntensity) => void;
  onExport: (format: 'docx' | 'pdf', templateId?: string) => void;
  onFinalize: () => void;
  isExporting: boolean;
  isFinalizing: boolean;
  canFinalize: boolean;
  isFinalized: boolean;
  columnVisibility: Record<string, boolean>;
  onColumnToggle: (column: string, visible: boolean) => void;
  availableColumns: string[];
}) {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showColumnManager, setShowColumnManager] = useState(false);
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [templatesLoading, setTemplatesLoading] = useState(false);

  // Fetch templates when export menu opens
  useEffect(() => {
    if (showExportMenu && templates.length === 0 && !templatesLoading) {
      setTemplatesLoading(true);
      fetch('/api/export/templates')
        .then((res) => res.json())
        .then((data) => {
          setTemplates(data.templates ?? []);
        })
        .catch(() => {
          setTemplates([]);
        })
        .finally(() => {
          setTemplatesLoading(false);
        });
    }
  }, [showExportMenu, templates.length, templatesLoading]);

  const handleExport = (format: 'docx' | 'pdf') => {
    onExport(format, selectedTemplateId || undefined);
    setShowExportMenu(false);
  };

  return (
    <div className="flex items-center justify-between border-b bg-white px-4 py-2">
      {/* Left: Version info */}
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-semibold text-gray-900 truncate max-w-[200px]">
          {projectName}
        </h1>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
          v{versionNumber}
        </span>
        <Link
          href="/admin/agents?tab=agents&workspace=复盘内容审校"
          className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
        >
          <Bot size={12} />
          Agent 配置
        </Link>
      </div>

      {/* Center: Global tone selector */}
      <div className="flex items-center gap-1 rounded-md border border-gray-200 p-0.5">
        {TONE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onToneChange(opt.value)}
            className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
              currentTone === opt.value
                ? 'bg-primary text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
            aria-label={`全局语气: ${opt.label}`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {canFinalize && (
          <button
            onClick={onFinalize}
            disabled={isFinalizing || isFinalized}
            className="inline-flex items-center gap-1 rounded-md border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isFinalizing ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
            {isFinalized ? '已确认终版' : '确认终版'}
          </button>
        )}

        {/* Column Manager */}
        <div className="relative">
          <button
            onClick={() => setShowColumnManager(!showColumnManager)}
            className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
            aria-label="列管理"
          >
            <Columns size={12} /> 列管理
          </button>
          {showColumnManager && (
            <div className="absolute right-0 top-full z-20 mt-1 w-52 rounded-md border bg-white p-2 shadow-lg">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-gray-700">数据列显示</span>
                <button
                  onClick={() => setShowColumnManager(false)}
                  className="text-gray-400 hover:text-gray-600"
                  aria-label="关闭列管理"
                >
                  <X size={12} />
                </button>
              </div>
              {availableColumns.length === 0 ? (
                <p className="px-2 py-2 text-xs text-gray-400">当前模块无数据列</p>
              ) : (
                availableColumns.map((col) => (
                  <label
                    key={col}
                    className="flex items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={columnVisibility[col] !== false}
                      onChange={(e) => onColumnToggle(col, e.target.checked)}
                      className="rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <span className={`text-gray-700 ${columnVisibility[col] === false ? 'line-through text-gray-400' : ''}`}>
                      {col}
                    </span>
                  </label>
                ))
              )}
            </div>
          )}
        </div>

        {/* Export */}
        <div className="relative">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            disabled={isExporting}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90 disabled:opacity-50"
            aria-label="导出报告"
          >
            {isExporting ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Download size={12} />
            )}
            导出
          </button>
          {showExportMenu && !isExporting && (
            <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-md border bg-white py-1 shadow-lg">
              {/* Template selector */}
              <div className="border-b px-3 py-2">
                <label className="text-xs font-medium text-gray-600">排版模板</label>
                {templatesLoading ? (
                  <div className="mt-1 flex items-center gap-1 text-xs text-gray-400">
                    <Loader2 size={10} className="animate-spin" />
                    加载中...
                  </div>
                ) : (
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                    className="mt-1 w-full rounded border border-gray-200 px-2 py-1 text-xs text-gray-700 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    aria-label="选择排版模板"
                  >
                    <option value="">默认模板</option>
                    {templates.map((tpl) => (
                      <option key={tpl.id} value={tpl.id}>
                        {tpl.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              {/* Format buttons */}
              <button
                onClick={() => handleExport('docx')}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
              >
                <FileText size={12} /> Word (.docx)
              </button>
              <button
                onClick={() => handleExport('pdf')}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
              >
                <FileText size={12} /> PDF
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Review Platform Page ───────────────────────────────────────────────

export default function ReviewPlatformPage() {
  const params = useParams();
  const versionId = params.versionId as string;
  const projectId = params.id as string;
  const queryClient = useQueryClient();

  // Panel visibility state
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [activeModuleId, setActiveModuleId] = useState('M1');
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({});
  const [currentTone, setCurrentTone] = useState<ToneIntensity>('standard');
  const [rightPanelTab, setRightPanelTab] = useState<'chat' | 'ppt'>('chat');

  // Fetch review data
  const { data: reviewData, isLoading, isError, error } = useQuery<ReviewData>({
    queryKey: ['reviewData', versionId],
    queryFn: async () => {
      const res = await fetch(`/api/review/${versionId}`);
      if (!res.ok) throw new Error('获取报告数据失败');
      return res.json();
    },
  });

  // Initialize state from fetched data
  useEffect(() => {
    if (reviewData) {
      const config = reviewData.config as Record<string, unknown>;
      if (config.tone) {
        setCurrentTone(config.tone as ToneIntensity);
      }
      if (config.columnVisibility) {
        const colVis = config.columnVisibility as Record<string, Record<string, boolean>>;
        // Flatten column visibility for the active module
        const flatVis: Record<string, boolean> = {};
        Object.values(colVis).forEach((moduleVis) => {
          Object.entries(moduleVis).forEach(([col, vis]) => {
            flatVis[col] = vis;
          });
        });
        setColumnVisibility(flatVis);
      }
      // Set active module to first visible module
      const firstVisible = reviewData.modules.find((m) => m.status !== 'hide');
      if (firstVisible) {
        setActiveModuleId(firstVisible.moduleId);
      }
    }
  }, [reviewData]);

  // Global tone change mutation
  const globalToneMutation = useMutation({
    mutationFn: async (tone: ToneIntensity) => {
      const res = await fetch(`/api/review/${versionId}/tone`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tone }),
      });
      if (!res.ok) throw new Error('切换语气失败');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviewData', versionId] });
    },
  });

  // Column visibility mutation
  const columnMutation = useMutation({
    mutationFn: async ({ column, visible }: { column: string; visible: boolean }) => {
      const res = await fetch(`/api/review/${versionId}/columns`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          columns: { [column]: visible },
          moduleId: activeModuleId,
        }),
      });
      if (!res.ok) throw new Error('更新列显示失败');
      return res.json();
    },
  });

  // Export mutation
  const exportMutation = useMutation({
    mutationFn: async ({ format, templateId }: { format: 'docx' | 'pdf'; templateId?: string }) => {
      const res = await fetch(`/api/export/${versionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format, templateId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '导出失败');
      }
      // Download the file
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report_v${reviewData?.versionNumber ?? 1}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
  });

  const finalizeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/review/${versionId}/finalize`, {
        method: 'POST',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '确认终版失败');
      }
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['reviewData', versionId] });
    },
  });

  const handleToneChange = (tone: ToneIntensity) => {
    setCurrentTone(tone);
    globalToneMutation.mutate(tone);
  };

  const handleColumnToggle = (column: string, visible: boolean) => {
    setColumnVisibility((prev) => ({ ...prev, [column]: visible }));
    columnMutation.mutate({ column, visible });
  };

  // Compute available columns from the active module's table data
  const activeModuleContent = reviewData?.content[activeModuleId] as ModuleContent | undefined;
  const activeModuleTables = (activeModuleContent?.tables ?? []) as ModuleTable[];
  const availableColumns = Array.from(
    new Set(activeModuleTables.flatMap((t) => t.headers))
  );

  const handleInsertToReport = (text: string) => {
    // Insert AI-generated text as a new paragraph in the active module
    const moduleContent = reviewData?.content[activeModuleId];
    const paragraphs = (moduleContent as ModuleContent)?.paragraphs ?? [];
    const newParagraph: NarrativeParagraph = {
      id: `ai-${Date.now()}`,
      content: text,
      tone: currentTone,
      relatedMetrics: [],
      isTransformed: false,
    };
    const updatedParagraphs = [...paragraphs, newParagraph];

    // Save via API
    fetch(`/api/review/${versionId}/module/${activeModuleId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: { paragraphs: updatedParagraphs } }),
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: ['reviewData', versionId] });
    });
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loading size="lg" text="加载审校台..." />
      </div>
    );
  }

  // Error state
  if (isError || !reviewData) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <AlertTriangle size={32} className="text-red-400" />
        <p className="text-sm text-red-600">
          {(error as Error)?.message || '加载报告数据失败'}
        </p>
        <button
          onClick={() => queryClient.invalidateQueries({ queryKey: ['reviewData', versionId] })}
          className="rounded-md border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
        >
          重试
        </button>
      </div>
    );
  }

  return (
    <div className="-m-6 flex h-screen flex-col">
      {/* Toolbar */}
      <ReviewToolbar
        versionId={versionId}
        versionNumber={reviewData.versionNumber}
        projectName={reviewData.project.projectName}
        currentTone={currentTone}
        onToneChange={handleToneChange}
        onExport={(format, templateId) => exportMutation.mutate({ format, templateId })}
        onFinalize={() => finalizeMutation.mutate()}
        isExporting={exportMutation.isPending}
        isFinalizing={finalizeMutation.isPending}
        canFinalize={reviewData.status === 'draft' || reviewData.status === 'reviewing'}
        isFinalized={reviewData.status === 'finalized'}
        columnVisibility={columnVisibility}
        onColumnToggle={handleColumnToggle}
        availableColumns={availableColumns}
      />

      {/* Three-panel layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel: Module Navigation */}
        <aside
          className={`flex-shrink-0 border-r bg-white transition-all duration-200 ${
            leftPanelOpen ? 'w-56' : 'w-0'
          } overflow-hidden`}
          aria-label="模块导航面板"
        >
          <div className="flex h-full w-56 flex-col">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="text-sm font-semibold text-gray-900">模块</h3>
              <button
                onClick={() => setLeftPanelOpen(false)}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                aria-label="收起左侧面板"
              >
                <PanelLeftClose size={14} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              <ModuleNavTree
                modules={reviewData.modules}
                activeModuleId={activeModuleId}
                onSelect={setActiveModuleId}
              />
            </div>
          </div>
        </aside>

        {/* Left panel toggle (when collapsed) */}
        {!leftPanelOpen && (
          <button
            onClick={() => setLeftPanelOpen(true)}
            className="flex-shrink-0 border-r bg-white px-1 py-2 text-gray-400 hover:bg-gray-50 hover:text-gray-600"
            aria-label="展开左侧面板"
          >
            <ChevronRight size={16} />
          </button>
        )}

        {/* Center Panel: Content or PPT */}
        <main className="flex-1 overflow-hidden bg-gray-50" aria-label="内容编辑区">
          {rightPanelTab === 'ppt' ? (
            <div className="h-full overflow-y-auto">
              <PptPanel
                projectId={projectId}
                versionId={versionId}
                pptInfo={(reviewData.config as Record<string, unknown>)?.ppt as { presentationId?: string; editUrl?: string; downloadUrl?: string } | undefined}
                reportContent={reviewData.content}
                projectName={reviewData.project.projectName}
                brand={reviewData.project.brand}
                category={reviewData.project.category}
                fullWidth
              />
            </div>
          ) : (
            <CenterPanel
              reviewData={reviewData}
              activeModuleId={activeModuleId}
              versionId={versionId}
              columnVisibility={columnVisibility}
              onColumnToggle={handleColumnToggle}
            />
          )}
        </main>

        {/* Right panel toggle (when collapsed) */}
        {!rightPanelOpen && (
          <button
            onClick={() => setRightPanelOpen(true)}
            className="flex-shrink-0 border-l bg-white px-1 py-2 text-gray-400 hover:bg-gray-50 hover:text-gray-600"
            aria-label="展开右侧面板"
          >
            <ChevronLeft size={16} />
          </button>
        )}

        {/* Right Panel: AI Chat + PPT */}
        <aside
          className={`flex-shrink-0 border-l bg-white transition-all duration-200 ${
            rightPanelOpen ? 'w-80' : 'w-0'
          } overflow-hidden`}
          aria-label="AI 对话与 PPT 面板"
        >
          <div className="flex h-full w-80 flex-col">
            {/* Tab header */}
            <div className="flex items-center justify-between border-b px-2 py-2">
              <div className="flex items-center gap-1 rounded-md border border-gray-200 p-0.5">
                <button
                  onClick={() => setRightPanelTab('chat')}
                  className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                    rightPanelTab === 'chat'
                      ? 'bg-primary text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  AI 助手
                </button>
                <button
                  onClick={() => setRightPanelTab('ppt')}
                  className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                    rightPanelTab === 'ppt'
                      ? 'bg-primary text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  PPT
                </button>
              </div>
              <button
                onClick={() => setRightPanelOpen(false)}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                aria-label="收起右侧面板"
              >
                <PanelRightClose size={14} />
              </button>
            </div>
            {/* Tab content */}
            <div className="flex-1 overflow-hidden">
              {rightPanelTab === 'chat' ? (
                <AIChatPanel
                  projectId={projectId}
                  activeModuleId={activeModuleId}
                  onInsertToReport={handleInsertToReport}
                />
              ) : (
                <PptPanel
                  projectId={projectId}
                  versionId={versionId}
                  pptInfo={(reviewData.config as Record<string, unknown>)?.ppt as { presentationId?: string; editUrl?: string; downloadUrl?: string } | undefined}
                  reportContent={reviewData.content}
                  projectName={reviewData.project.projectName}
                  brand={reviewData.project.brand}
                  category={reviewData.project.category}
                />
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
