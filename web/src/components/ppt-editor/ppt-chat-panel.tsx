'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  MessageCircle,
  Send,
  Loader2,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PPTChatPanelProps {
  presentationId: string;
  onSlideUpdate: (slideIndex: number, content: Record<string, unknown>) => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

interface ConversationHistoryEntry {
  role: 'user' | 'assistant';
  content: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STREAM_TIMEOUT_MS = 30_000; // 30 seconds no-data timeout

// ─── PPT Chat Panel Component ────────────────────────────────────────────────

export function PPTChatPanel({
  presentationId,
  onSlideUpdate,
}: PPTChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isTimedOut, setIsTimedOut] = useState(false);
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);
  const [conversationHistory, setConversationHistory] = useState<ConversationHistoryEntry[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTimedOutRef = useRef(false);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // Reset the no-data timeout timer
  const resetStreamTimeout = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      isTimedOutRef.current = true;
      setIsTimedOut(true);
      setIsLoading(false);
      abortControllerRef.current?.abort();
      setMessages((prev) =>
        prev.map((msg) =>
          msg.isStreaming
            ? { ...msg, isStreaming: false, content: msg.content || '请求超时，未收到回复。' }
            : msg
        )
      );
    }, STREAM_TIMEOUT_MS);
  }, []);

  // Send a message
  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;

      const trimmedText = text.trim();
      setIsTimedOut(false);
      isTimedOutRef.current = false;
      setErrorMessage(null);
      setLastFailedMessage(null);

      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: trimmedText,
      };

      setMessages((prev) => [...prev, userMessage]);
      setInputValue('');
      setIsLoading(true);

      // Create assistant message placeholder for streaming
      const assistantMessageId = `assistant-${Date.now()}`;
      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        isStreaming: true,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // Prepare request body with presentationId
      const requestBody = {
        message: trimmedText,
        presentationId,
        conversationHistory,
      };

      // Abort any previous request
      abortControllerRef.current?.abort();
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      setLastFailedMessage(trimmedText);
      resetStreamTimeout();

      try {
        const response = await fetch('/api/ppt/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(`请求失败 (${response.status})`);
        }

        if (!response.body) {
          throw new Error('响应无数据流');
        }

        // Read the SSE stream
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulatedContent = '';
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          resetStreamTimeout();
          buffer += decoder.decode(value, { stream: true });

          // Parse SSE events from buffer
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine || !trimmedLine.startsWith('data:')) continue;

            const dataStr = trimmedLine.slice(5).trim();
            if (!dataStr) continue;

            try {
              const event = JSON.parse(dataStr);

              if (event.type === 'text' || event.type === 'chunk') {
                accumulatedContent += event.content || event.chunk || '';
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessageId
                      ? { ...msg, content: accumulatedContent }
                      : msg
                  )
                );
              } else if (event.type === 'slide_update') {
                // Handle slide update - update the corresponding slide in real-time
                const slideIndex = event.slideIndex ?? event.slide_index;
                const slideContent = event.content || event.data;
                if (typeof slideIndex === 'number' && slideContent) {
                  onSlideUpdate(slideIndex, slideContent);
                }
                // Also show a note in the chat
                accumulatedContent += `\n[已更新幻灯片 ${(slideIndex ?? 0) + 1}]`;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessageId
                      ? { ...msg, content: accumulatedContent }
                      : msg
                  )
                );
              } else if (event.type === 'done' || event.type === 'complete') {
                break;
              }
              // Ignore 'status' and 'trace' events silently
            } catch {
              // Skip malformed JSON lines
              continue;
            }
          }
        }

        // Clear timeout
        if (timeoutRef.current) clearTimeout(timeoutRef.current);

        // Finalize the assistant message
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  content: accumulatedContent || '（无回复内容）',
                  isStreaming: false,
                }
              : msg
          )
        );

        // Update conversation history
        setConversationHistory((prev) => [
          ...prev,
          { role: 'user', content: trimmedText },
          { role: 'assistant', content: accumulatedContent },
        ]);

        setLastFailedMessage(null);
        setIsLoading(false);
      } catch (error: unknown) {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);

        if (error instanceof Error && error.name === 'AbortError') {
          if (!isTimedOutRef.current) {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId
                  ? { ...msg, content: msg.content || '请求已取消', isStreaming: false }
                  : msg
              )
            );
          }
        } else {
          const errMsg = error instanceof Error ? error.message : '请求失败';
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, content: `错误：${errMsg}`, isStreaming: false }
                : msg
            )
          );
          setLastFailedMessage(trimmedText);
          setErrorMessage(errMsg);
        }

        setIsLoading(false);
      }
    },
    [isLoading, presentationId, conversationHistory, resetStreamTimeout, onSlideUpdate]
  );

  // Retry the last failed message
  const handleRetry = useCallback(() => {
    if (lastFailedMessage) {
      // Remove the last assistant + user messages
      setMessages((prev) => {
        const lastAssistantIdx = prev.findLastIndex((m) => m.role === 'assistant');
        const lastUserIdx = prev.findLastIndex((m) => m.role === 'user');
        return prev.filter(
          (_, i) => i !== lastAssistantIdx && i !== lastUserIdx
        );
      });
      setIsTimedOut(false);
      isTimedOutRef.current = false;
      setErrorMessage(null);
      sendMessage(lastFailedMessage);
    }
  }, [lastFailedMessage, sendMessage]);

  // Handle input submit
  const handleSubmit = useCallback(() => {
    sendMessage(inputValue);
  }, [inputValue, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  return (
    <aside className="flex w-72 flex-shrink-0 flex-col border-l bg-white">
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <MessageCircle size={16} className="text-blue-600" />
        <h2 className="text-sm font-semibold text-slate-800">AI 助手</h2>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <MessageCircle size={32} className="mb-2 text-slate-300" />
            <p className="text-xs text-slate-400">
              通过 AI 对话修改幻灯片内容
            </p>
            <p className="mt-1 text-xs text-slate-300">
              例如：&ldquo;把第3页的标题改为...&rdquo;
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              'rounded-lg px-3 py-2 text-xs leading-relaxed',
              msg.role === 'user'
                ? 'ml-4 bg-blue-600 text-white'
                : 'mr-4 bg-slate-100 text-slate-700'
            )}
          >
            {msg.isStreaming && !msg.content ? (
              <span className="inline-flex items-center gap-1 text-slate-400">
                <Loader2 size={12} className="animate-spin" />
                思考中...
              </span>
            ) : (
              <span className="whitespace-pre-wrap">{msg.content}</span>
            )}
            {msg.isStreaming && msg.content && (
              <span className="inline-block ml-0.5 w-1.5 h-3.5 bg-slate-400 animate-pulse" />
            )}
          </div>
        ))}

        {/* Timeout warning */}
        {isTimedOut && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
            <p className="text-xs text-amber-700">请求超时（30秒无数据），请重试。</p>
            <button
              type="button"
              onClick={handleRetry}
              className="mt-1 inline-flex items-center gap-1 rounded-md border border-amber-300 bg-white px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50"
            >
              <RotateCcw size={10} />
              重试
            </button>
          </div>
        )}

        {/* Error with retry */}
        {!isTimedOut && errorMessage && lastFailedMessage && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
            <div className="flex items-start gap-1.5">
              <AlertCircle size={12} className="mt-0.5 text-rose-500" />
              <p className="text-xs text-rose-700">{errorMessage}</p>
            </div>
            <button
              type="button"
              onClick={handleRetry}
              className="mt-1 inline-flex items-center gap-1 rounded-md border border-rose-300 bg-white px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50"
            >
              <RotateCcw size={10} />
              重试
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t p-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入修改指令..."
            disabled={isLoading}
            className={cn(
              'flex-1 rounded-md border border-slate-200 px-3 py-2 text-xs',
              'focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-100',
              'placeholder:text-slate-400',
              isLoading && 'cursor-not-allowed opacity-50'
            )}
            aria-label="AI 对话输入框"
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!inputValue.trim() || isLoading}
            className={cn(
              'inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors',
              'bg-blue-600 text-white hover:bg-blue-700',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300',
              'disabled:cursor-not-allowed disabled:opacity-50'
            )}
            aria-label="发送消息"
          >
            {isLoading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Send size={14} />
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}
