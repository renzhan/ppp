'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  MessageCircle,
  Send,
  Sparkles,
  BarChart3,
  LayoutList,
  Pen,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ReportAiChatProps {
  reviewId: string;
  chapterTitle: string;
  chapterContent: string;
  onApplySuggestion: (content: string) => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

// ─── Preset Commands ─────────────────────────────────────────────────────────

const PRESET_COMMANDS = [
  { label: '优化表达', icon: <Sparkles className="h-3 w-3" />, prompt: '请优化当前章节的表达，使其更加专业简洁。' },
  { label: '补充数据', icon: <BarChart3 className="h-3 w-3" />, prompt: '请根据内容补充相关数据支撑。' },
  { label: '调整结构', icon: <LayoutList className="h-3 w-3" />, prompt: '请调整当前章节结构，使逻辑更清晰。' },
  { label: '润色文案', icon: <Pen className="h-3 w-3" />, prompt: '请润色当前章节文案，提升可读性。' },
];

// ─── Component ───────────────────────────────────────────────────────────────

export function ReportAiChat({
  reviewId,
  chapterTitle,
  chapterContent,
  onApplySuggestion,
}: ReportAiChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Cleanup
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: 'user', content: text.trim() };
    const assistantId = `a-${Date.now()}`;
    const assistantMsg: ChatMessage = { id: assistantId, role: 'assistant', content: '', isStreaming: true };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInputValue('');
    setIsLoading(true);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(`/api/reviews/${reviewId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text.trim(),
          context: { chapterTitle, chapterContent },
          reviewId,
        }),
        signal: controller.signal,
      });

      if (!res.ok) throw new Error('请求失败');
      if (!res.body) throw new Error('无响应流');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const dataStr = trimmed.slice(5).trim();
          if (!dataStr) continue;

          try {
            const event = JSON.parse(dataStr);
            if (event.type === 'apply') {
              // Apply the updated content to the chapter
              onApplySuggestion(event.content);
            } else if (event.type === 'text') {
              accumulated += event.content || '';
              setMessages((prev) =>
                prev.map((m) => m.id === assistantId ? { ...m, content: accumulated } : m)
              );
            } else if (event.type === 'done') {
              break;
            }
          } catch { continue; }
        }
      }

      setMessages((prev) =>
        prev.map((m) => m.id === assistantId ? { ...m, content: accumulated || '（无回复）', isStreaming: false } : m)
      );
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setMessages((prev) =>
        prev.map((m) => m.id === assistantId ? { ...m, content: '请求失败，请重试', isStreaming: false } : m)
      );
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, chapterTitle, chapterContent, reviewId]);

  return (
    <aside className="flex w-72 flex-shrink-0 flex-col border-l bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageCircle size={14} className="text-brand" />
          <h2 className="text-xs font-semibold text-gray-800">AI 助手</h2>
        </div>
        <span className="text-[10px] text-gray-400">当前：{chapterTitle || '-'}</span>
      </div>

      {/* Preset commands */}
      <div className="border-b px-3 py-2">
        <div className="flex flex-wrap gap-1.5">
          {PRESET_COMMANDS.map((cmd) => (
            <button
              key={cmd.label}
              type="button"
              onClick={() => sendMessage(cmd.prompt)}
              disabled={isLoading}
              className={cn(
                'inline-flex items-center gap-1 rounded-full border border-gray-200 px-2 py-0.5 text-[11px] font-medium',
                'text-gray-600 hover:border-brand hover:bg-brand-50 hover:text-brand',
                'disabled:cursor-not-allowed disabled:opacity-50'
              )}
            >
              {cmd.icon}
              {cmd.label}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center py-4 text-center">
            <MessageCircle size={28} className="mb-2 text-gray-200" />
            <p className="text-[11px] text-gray-400">
              AI 审校助手<br />
              输入指令基于当前模块内容进行优化和重新生成
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id}>
            <div className={cn(
              'rounded-lg px-3 py-2 text-xs leading-relaxed',
              msg.role === 'user'
                ? 'ml-4 bg-brand text-white'
                : 'mr-4 bg-gray-100 text-gray-700'
            )}>
              {msg.isStreaming && !msg.content ? (
                <span className="inline-flex items-center gap-1 text-gray-400">
                  <Loader2 size={12} className="animate-spin" />
                  思考中...
                </span>
              ) : (
                <span className="whitespace-pre-wrap">{msg.content}</span>
              )}
              {msg.isStreaming && msg.content && (
                <span className="inline-block ml-0.5 w-1.5 h-3.5 bg-gray-400 animate-pulse" />
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t p-3">
        <div className="relative">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(inputValue); } }}
            placeholder="输入指令查询数据或修改当前模块内容..."
            disabled={isLoading}
            className={cn(
              'w-full rounded-lg border border-gray-300 bg-amber-50 px-3 py-2.5 pr-10 text-xs',
              'focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20',
              'placeholder:text-gray-400',
              'disabled:opacity-50'
            )}
          />
          <button
            type="button"
            onClick={() => sendMessage(inputValue)}
            disabled={!inputValue.trim() || isLoading}
            className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-6 w-6 items-center justify-center rounded-md bg-brand text-white transition hover:bg-brand-600 disabled:opacity-50"
          >
            {isLoading ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
          </button>
        </div>
      </div>
    </aside>
  );
}
