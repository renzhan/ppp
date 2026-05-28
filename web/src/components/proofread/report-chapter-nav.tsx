'use client';

import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChapterData {
  id: string;
  title: string;
  number: number;
  content: string;
}

export interface ReportChapterNavProps {
  chapters: ChapterData[];
  activeChapterId: string | null;
  onSelectChapter: (id: string) => void;
  isGenerating: boolean;
}

/**
 * ReportChapterNav - 左侧章节导览面板
 */
export function ReportChapterNav({
  chapters,
  activeChapterId,
  onSelectChapter,
  isGenerating,
}: ReportChapterNavProps) {
  return (
    <aside className="w-48 flex-shrink-0 overflow-y-auto border-r bg-slate-50">
      <nav className="py-4">
        {chapters.map((chapter) => (
          <button
            key={chapter.id}
            type="button"
            onClick={() => onSelectChapter(chapter.id)}
            className={cn(
              'flex w-full items-center gap-2 px-4 py-2 text-left text-xs transition-colors',
              activeChapterId === chapter.id
                ? 'border-l-2 border-blue-600 bg-white text-blue-700 font-medium'
                : 'border-l-2 border-transparent text-slate-600 hover:bg-white hover:text-slate-900'
            )}
          >
            <span className={cn(
              'inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-medium',
              activeChapterId === chapter.id
                ? 'bg-blue-600 text-white'
                : 'bg-slate-200 text-slate-600'
            )}>
              {chapter.number}
            </span>
            <span className="truncate">{chapter.title}</span>
          </button>
        ))}

        {isGenerating && (
          <div className="flex items-center gap-2 px-4 py-2 text-xs text-blue-600">
            <Loader2 size={12} className="animate-spin" />
            <span>生成中...</span>
          </div>
        )}
      </nav>
    </aside>
  );
}
