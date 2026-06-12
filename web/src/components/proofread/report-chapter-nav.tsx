'use client';

import { Loader2, Check, X, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChapterData {
  id: string;
  title: string;
  number: number;
  content: string;
}

interface ChapterStatus {
  id: string;
  title: string;
  number: number;
  status: 'pending' | 'generating' | 'completed' | 'error';
  tokensUsed?: number;
}

export interface ReportChapterNavProps {
  chapterStatuses: ChapterStatus[];
  chapters: ChapterData[];
  activeChapterId: string | null;
  onSelectChapter: (id: string) => void;
}

/**
 * ReportChapterNav - 左侧章节导览面板
 * 显示所有章节及其生成状态（pending/generating/completed/error）
 */
export function ReportChapterNav({
  chapterStatuses,
  chapters,
  activeChapterId,
  onSelectChapter,
}: ReportChapterNavProps) {
  return (
    <aside className="flex h-full w-full flex-shrink-0 flex-col overflow-x-hidden overflow-y-auto border-r bg-gray-50">
      <nav className="flex-1 py-3">
        {chapterStatuses.map((chapterStatus) => (
          <button
            key={chapterStatus.id}
            type="button"
            onClick={() => onSelectChapter(chapterStatus.id)}
            className={cn(
              'flex w-full items-center gap-2.5 px-5 py-3.5 text-left text-sm transition-colors',
              activeChapterId === chapterStatus.id
                ? 'border-l-2 border-brand bg-white text-brand font-medium'
                : 'border-l-2 border-transparent text-gray-600 hover:bg-white hover:text-gray-900',
              chapterStatus.status === 'pending' && 'opacity-60'
            )}
          >
            {/* Status indicator */}
            <span className="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center">
              {chapterStatus.status === 'pending' && (
                <Circle size={14} className="text-gray-400" />
              )}
              {chapterStatus.status === 'generating' && (
                <Loader2 size={14} className="animate-spin text-brand" />
              )}
              {chapterStatus.status === 'completed' && (
                <Check size={14} className="text-green-500" />
              )}
              {chapterStatus.status === 'error' && (
                <X size={14} className="text-red-500" />
              )}
            </span>

            {/* Chapter title and token count */}
            <span className="flex min-w-0 flex-col">
              <span className={cn(
                'truncate leading-snug',
                chapterStatus.status === 'pending' && 'text-gray-400'
              )}>
                {chapterStatus.title}
              </span>
              {chapterStatus.status === 'generating' && chapterStatus.tokensUsed != null && chapterStatus.tokensUsed > 0 && (
                <span className="text-xs text-gray-400">
                  {chapterStatus.tokensUsed} tokens
                </span>
              )}
            </span>
          </button>
        ))}
      </nav>
    </aside>
  );
}
