'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  MessageCircle,
  Send,
  Sparkles,
  BarChart3,
  LayoutList,
  Pen,
  Check,
  Loader2,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AiAssistantPanelProps {
  reviewId: string;
  chapterTitle: string;
  chapterContent: string;
  onApplySuggestion: (content: string) => void;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  suggestion?: string;
}

interface ConversationHistoryEntry {
  role: 'user' | 'assistant';
  content: string;
}

// ─── Preset Commands ─────────────────────────────────────────────────────────

interface PresetCommand {
  label: string;
  icon: React.ReactNode;
  prompt: string;
}

const PRESET_COMMANDS: PresetCommand[] = [
  {
    label: '优化表达',
    icon: <Sparkles className="h-3.5 w-3.5" />,
    prompt: '请优化以下内容的表达，使其更加专业、简洁、有说服力。',
  },
  {
    label: '补充数据',
    icon: <BarChart3 className="h-3.5 w-3.5" />,
    prompt: '请根据内容补充相关数据支撑，增强论证力度。',
  },
  {
    label: '调整结构',
    icon: <LayoutList className="h-3.5 w-3.5" />,
    prompt: '请调整以下内容的结构，使逻辑更清晰、层次更分明。',
  },
  {
    label: '润色文本',
    icon: <Pen className="h-3.5 w-3.5" />,
    prompt: '请润色以下文本，提升文字质量和可读性。',
  },
];

// ─── Constants ───────────────────────────────────────────────────────────────

const STREAM_TIMEOUT_MS = 30_000; // 30 seconds no-data timeout

// ─── AI Assistant Panel Component ────────────────────────────────────────────

export function AiAssistantPanel({
  reviewId,
  chapterTitle,
  chapterContent,
  onApplySuggestion,
}: AiAssistantPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [serviceAvailable, setServiceAvailable] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isTimedOut, setIsTimedOut] = useState(false);
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);
  const [conversationHistory, setConversationHistory] = useState<ConversationHistoryEntry[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTimedOutRef = useRef(false);

  // Check service availability on mount
  useEffect(() => {
    checkServiceHealth();
  }, []);

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

  // Check Presenton service health
  const checkServiceHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/ppt/health', { signal: AbortSignal.timeout(5_000) });
      if (res.ok) {
        setServiceAvailable(true);
        setErrorMessage(null);
      } else {
        setServiceAvailable(false);
        setErrorMessage('AI 服务暂时不可用，请稍后重试');
      }
    } catch {
      setServiceAvailable(false);
      setErrorMessage('AI 服务暂时不可用，请稍后重试');
    }
  }, []);

  // Reset the no-data timeout timer
  const resetStreamTimeout = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      // Timeout: no data received for 30 seconds
      isTimedOutRef.current = true;
      setIsTimedOut(true);
      setIsLoading(false);
      abortControllerRef.current?.abort();
      // Update the streaming message to show timeout
      setMessages((prev) =>
        prev.map((msg) =>
          msg.isStreaming
            ? { ...msg, isStreaming: false, content: msg.content || '请求超时，未收到回复。' }
            : msg
        )
      );
    }, STREAM_TIMEOUT_MS);
  }, []);

  // Send a message (user input or preset command)
  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading || !serviceAvailable) return;

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

      // Prepare request body with conversation history
      const requestBody = {
        message: trimmedText,
        context: {
          chapterTitle,
          chapterContent,
        },
        conversationHistory,
      };

      // Abort any previous request
      abortControllerRef.current?.abort();
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      // Track this message for potential retry
      setLastFailedMessage(trimmedText);

      // Start the no-data timeout
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
        let suggestion: string | undefined;
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // Reset timeout on each data chunk
          resetStreamTimeout();

          buffer += decoder.decode(value, { stream: true });

          // Parse SSE events from buffer
          const lines = buffer.split('\n');
          // Keep the last incomplete line in the buffer
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine || !trimmedLine.startsWith('data:')) continue;

            const dataStr = trimmedLine.slice(5).trim();
            if (!dataStr) continue;

            try {
              const event = JSON.parse(dataStr);

              if (event.type === 'text') {
                accumulatedContent += event.content || '';
                // Update message with accumulated content (streaming effect)
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessageId
                      ? { ...msg, content: accumulatedContent }
                      : msg
                  )
                );
              } else if (event.type === 'suggestion') {
                suggestion = event.content || '';
              } else if (event.type === 'done') {
                // Stream complete
                break;
              }
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
                  suggestion,
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
        // Clear timeout
        if (timeoutRef.current) clearTimeout(timeoutRef.current);

        if (error instanceof Error && error.name === 'AbortError') {
          // Request was aborted (timeout or user action) - don't show additional error
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
          // Network or other error
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

          // Check if service is still available
          checkServiceHealth();
        }

        setIsLoading(false);
      }
    },
    [isLoading, serviceAvailable, chapterTitle, chapterContent, conversationHistory, resetStreamTimeout, checkServiceHealth]
  );

  // Retry the last failed or timed-out message
  const handleRetry = useCallback(() => {
    if (lastFailedMessage) {
      // Remove the last assistant message (failed/timed-out)
      setMessages((prev) => {
        const lastAssistantIdx = prev.findLastIndex(m => m.role === 'assistant');
        if (lastAssistantIdx >= 0) {
          return prev.filter((_, i) => i !== lastAssistantIdx);
        }
        return prev;
      });
      // Remove the corresponding user message
      setMessages((prev) => {
        const lastUserIdx = prev.findLastIndex(m => m.role === 'user');
        if (lastUserIdx >= 0) {
          return prev.filter((_, i) => i !== lastUserIdx);
        }
        return prev;
      });
      setIsTimedOut(false);
      isTimedOutRef.current = false;
      setErrorMessage(null);
      sendMessage(lastFailedMessage);
    }
  }, [lastFailedMessage, sendMessage]);

  // Handle preset command click
  const handlePresetClick = useCallback(
    (command: PresetCommand) => {
      sendMessage(command.prompt);
    },
    [sendMessage]
  );

  // Handle input submit
  const handleSubmit = useCallback(() => {
    sendMessage(inputValue);
  }, [inputValue, sendMessage]);

  // Handle key press in input
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  // Handle apply suggestion
  const handleApplySuggestion = useCallback(
    (suggestion: string) => {
      onApplySuggestion(suggestion);
    },
    [onApplySuggestion]
  );

  return (
    <aside className="flex w-72 flex-shrink-0 flex-col border-l bg-white">
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <MessageCircle size={16} className="text-blue-600" />
        <h2 className="text-sm font-semibold text-slate-800">AI 助手</h2>
        {!serviceAvailable && (
          <span className="ml-auto inline-flex items-center gap-1 text-xs text-amber-600">
            <AlertCircle size={12} />
            离线
          </span>
        )}
      </div>

      {/* Service unavailable banner */}
      {!serviceAvailable && errorMessage && (
        <div className="border-b bg-amber-50 px-3 py-2">
          <p className="text-xs text-amber-700">{errorMessage}</p>
          <button
            type="button"
            onClick={checkServiceHealth}
            className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-amber-700 hover:text-amber-900"
          >
            <RotateCcw size={10} />
            重新检查
          </button>
        </div>
      )}

      {/* Preset command buttons */}
      <div className="border-b px-3 py-2">
        <div className="flex flex-wrap gap-1.5">
          {PRESET_COMMANDS.map((command) => (
            <button
              key={command.label}
              type="button"
              onClick={() => handlePresetClick(command)}
              disabled={isLoading || !serviceAvailable}
              className={cn(
                'inline-flex items-center gap-1 rounded-full border border-slate-200 px-2.5 py-1 text-xs font-medium transition-colors',
                'text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300',
                (isLoading || !serviceAvailable) && 'cursor-not-allowed opacity-50'
              )}
              aria-label={command.label}
            >
              {command.icon}
              <span>{command.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <MessageCircle size={32} className="mb-2 text-slate-300" />
            <p className="text-xs text-slate-400">
              选择预设命令或输入问题，AI 助手将基于当前章节内容为您提供建议
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id}>
            <div
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

            {/* Apply suggestion button */}
            {msg.role === 'assistant' && msg.suggestion && !msg.isStreaming && (
              <div className="mt-1.5 mr-4">
                <button
                  type="button"
                  onClick={() => handleApplySuggestion(msg.suggestion!)}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium',
                    'text-emerald-700 transition-colors hover:bg-emerald-100',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300'
                  )}
                  aria-label="应用建议到编辑器"
                >
                  <Check size={12} />
                  <span>应用</span>
                </button>
              </div>
            )}
          </div>
        ))}

        {/* Timeout warning with retry */}
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

        {/* Error with retry (non-timeout) */}
        {!isTimedOut && errorMessage && lastFailedMessage && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
            <p className="text-xs text-rose-700">{errorMessage}</p>
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
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={serviceAvailable ? '输入问题或指令...' : 'AI 服务不可用'}
            disabled={isLoading || !serviceAvailable}
            className={cn(
              'flex-1 rounded-md border border-slate-200 px-3 py-2 text-xs',
              'focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-100',
              'placeholder:text-slate-400',
              (isLoading || !serviceAvailable) && 'cursor-not-allowed opacity-50'
            )}
            aria-label="AI助手输入框"
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!inputValue.trim() || isLoading || !serviceAvailable}
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
