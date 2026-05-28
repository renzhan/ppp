'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react';

interface NoteRecord {
  id: string;
  noteId: string;
  noteLink: string | null;
  kolNickName: string | null;
  kolFanNum: number;
  noteType: string | null;
  spuName: string | null;
  impNum: number;
  readNum: number;
  engageNum: number;
  likeNum: number;
  favNum: number;
  cmtNum: number;
  shareNum: number;
  followNum: number;
  kolPrice: number;
  serviceFee: number;
  totalPlatformPrice: number;
  isUnderwater: boolean;
  underwaterPrice: number;
  heatImpNum: number;
  heatReadNum: number;
  createdAt: string;
  components: Record<string, unknown> | null;
}

interface NotesResponse {
  notes: NoteRecord[];
  total: number;
  page: number;
  pageSize: number;
  updatedAt: string | null;
}

export interface NoteBaseTableProps {
  projectId: string;
}

/**
 * NoteBaseTable - 笔记底表数据展示组件
 *
 * 在笔记底表上传区域下方展示已导入的笔记记录，支持分页。
 * 显示字段：序号、笔记链接、笔记id、博主名称、内容方向、总消耗
 */
export function NoteBaseTable({ projectId }: NoteBaseTableProps) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { data, isLoading, isError } = useQuery<NotesResponse>({
    queryKey: ['project-notes', projectId, page, pageSize],
    queryFn: async () => {
      const res = await fetch(
        `/api/projects/${projectId}/notes?page=${page}&pageSize=${pageSize}`
      );
      if (!res.ok) throw new Error('获取笔记数据失败');
      return res.json();
    },
    enabled: !!projectId,
  });

  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);
  const notes = data?.notes ?? [];
  const updatedAt = data?.updatedAt;

  // Don't render anything if no data
  if (!isLoading && total === 0) {
    return null;
  }

  const handleExport = async () => {
    // Trigger a download of all notes as CSV
    try {
      const res = await fetch(
        `/api/projects/${projectId}/notes?page=1&pageSize=10000`
      );
      if (!res.ok) return;
      const allData: NotesResponse = await res.json();

      const headers = ['序号', '笔记链接', '笔记id', '博主名称', '内容方向', '总消耗'];
      const rows = allData.notes.map((note, idx) => {
        const contentDirection = note.components
          ? (note.components as Record<string, unknown>).contentDirection ?? ''
          : '';
        return [
          idx + 1,
          note.noteLink ?? '',
          note.noteId,
          note.kolNickName ?? '',
          contentDirection,
          Number(note.totalPlatformPrice).toFixed(2),
        ];
      });

      const csvContent = [
        headers.join(','),
        ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
      ].join('\n');

      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `笔记底表数据_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      // Silently fail
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
  };

  const getContentDirection = (note: NoteRecord): string => {
    if (note.components && typeof note.components === 'object') {
      return String((note.components as Record<string, unknown>).contentDirection ?? '');
    }
    return '';
  };

  const truncateLink = (link: string | null, maxLen = 20): string => {
    if (!link) return '';
    if (link.length <= maxLen) return link;
    return link.slice(0, maxLen) + '...';
  };

  return (
    <div className="mt-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-600">
          <span className="font-medium">总计</span>
          <span className="ml-4 text-slate-500">
            笔记数据共计{total}条
            {updatedAt && `，数据更新时间${formatDate(updatedAt)}`}
          </span>
        </div>
        <button
          type="button"
          onClick={handleExport}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
        >
          <Download size={14} />
          导出现有数据
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="whitespace-nowrap px-4 py-2.5 text-left font-medium text-slate-600">序号</th>
              <th className="whitespace-nowrap px-4 py-2.5 text-left font-medium text-slate-600">笔记链接</th>
              <th className="whitespace-nowrap px-4 py-2.5 text-left font-medium text-slate-600">笔记id</th>
              <th className="whitespace-nowrap px-4 py-2.5 text-left font-medium text-slate-600">博主名称</th>
              <th className="whitespace-nowrap px-4 py-2.5 text-left font-medium text-slate-600">内容方向</th>
              <th className="whitespace-nowrap px-4 py-2.5 text-right font-medium text-slate-600">总消耗</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  加载中...
                </td>
              </tr>
            ) : isError ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-red-500">
                  加载失败，请刷新重试
                </td>
              </tr>
            ) : notes.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  暂无数据
                </td>
              </tr>
            ) : (
              notes.map((note, idx) => (
                <tr
                  key={note.id}
                  className="border-b border-slate-100 transition hover:bg-slate-50 last:border-b-0"
                >
                  <td className="px-4 py-2.5 text-slate-500">
                    {(page - 1) * pageSize + idx + 1}
                  </td>
                  <td className="px-4 py-2.5">
                    {note.noteLink ? (
                      <a
                        href={note.noteLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                        title={note.noteLink}
                      >
                        {truncateLink(note.noteLink)}
                      </a>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-600">
                    {note.noteId}
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">
                    {note.kolNickName || <span className="text-slate-400">-</span>}
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">
                    {getContentDirection(note) || <span className="text-slate-400">-</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">
                    {Number(note.totalPlatformPrice).toLocaleString('zh-CN', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="上一页"
            >
              <ChevronLeft size={16} />
            </button>
            {generatePageNumbers(page, totalPages).map((p, i) =>
              p === '...' ? (
                <span key={`ellipsis-${i}`} className="px-1 text-slate-400">...</span>
              ) : (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p as number)}
                  className={`inline-flex h-8 w-8 items-center justify-center rounded border text-sm transition ${
                    page === p
                      ? 'border-blue-500 bg-blue-500 text-white'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {p}
                </button>
              )
            )}
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="下一页"
            >
              <ChevronRight size={16} />
            </button>

            {/* Page size selector */}
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="ml-2 h-8 rounded border border-slate-200 px-2 text-xs text-slate-600 outline-none"
            >
              <option value={10}>10条/页</option>
              <option value={20}>20条/页</option>
              <option value={50}>50条/页</option>
              <option value={100}>100条/页</option>
            </select>

            {/* Jump to page */}
            <span className="ml-2 text-xs text-slate-500">跳至</span>
            <input
              type="number"
              min={1}
              max={totalPages}
              className="h-8 w-12 rounded border border-slate-200 px-2 text-center text-xs outline-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const val = parseInt((e.target as HTMLInputElement).value, 10);
                  if (val >= 1 && val <= totalPages) {
                    setPage(val);
                  }
                }
              }}
            />
            <span className="text-xs text-slate-500">页</span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Generate page number array with ellipsis for pagination display.
 * Shows: first, last, current, and 2 neighbors of current.
 */
function generatePageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | '...')[] = [];
  const showPages = new Set<number>();

  // Always show first and last
  showPages.add(1);
  showPages.add(total);

  // Show current and neighbors
  for (let i = Math.max(1, current - 2); i <= Math.min(total, current + 2); i++) {
    showPages.add(i);
  }

  const sorted = Array.from(showPages).sort((a, b) => a - b);

  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) {
      pages.push('...');
    }
    pages.push(sorted[i]);
  }

  return pages;
}
