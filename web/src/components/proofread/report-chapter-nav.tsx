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
    <aside className="w-48 flex-shrink-0 overflow-y-auto border-r bg-gray-50">
      <nav className="py-4">
        {chapterStatuses.map((chapterStatus) => (
          <button
            key={chapterStatus.id}
            type="button"
            onClick={() => onSelectChapter(chapterStatus.id)}
            className={cn(
              'flex w-full items-center gap-2 px-4 py-2 text-left text-xs transition-colors',
              activeChapterId === chapterStatus.id
                ? 'border-l-2 border-brand bg-white text-brand font-medium'
                : 'border-l-2 border-transparent text-gray-600 hover:bg-white hover:text-gray-900',
              chapterStatus.status === 'pending' && 'opacity-60'
            )}
          >
            {/* Status indicator */}
            <span className="inline-flex h-4 w-4 flex-shrink-0 items-center justify-center">
              {chapterStatus.status === 'pending' && (
                <Circle size={12} className="text-gray-400" />
              )}
              {chapterStatus.status === 'generating' && (
                <Loader2 size={12} className="animate-spin text-brand" />
              )}
              {chapterStatus.status === 'completed' && (
                <Check size={12} className="text-green-500" />
              )}
              {chapterStatus.status === 'error' && (
                <X size={12} className="text-red-500" />
              )}
            </span>

            {/* Chapter title and token count */}
            <span className="flex flex-col min-w-0">
              <span className={cn(
                'truncate',
                chapterStatus.status === 'pending' && 'text-gray-400'
              )}>
                {chapterStatus.title}
              </span>
              {chapterStatus.status === 'generating' && chapterStatus.tokensUsed != null && chapterStatus.tokensUsed > 0 && (
                <span className="text-[10px] text-gray-400">
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
