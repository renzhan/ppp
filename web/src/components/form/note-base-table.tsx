'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CardFooter } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';
import {
  listTableHeadClass,
  listTableHeaderRowClass,
  listTableRowClass,
  listTableWrapperClass,
} from '@/components/ui/data-list';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface NoteRecord {
  id: string;
  noteId: string;
  noteLink: string | null;
  kolNickName: string | null;
  totalPlatformPrice: number;
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

const selectTriggerClass =
  'h-8 min-w-[88px] rounded border-gray-200 bg-white text-xs text-gray-700 focus-visible:ring-brand/25';

export function NoteBaseTable({ projectId }: NoteBaseTableProps) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [jumpPage, setJumpPage] = useState('');

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
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const notes = data?.notes ?? [];
  const updatedAt = data?.updatedAt;

  if (!isLoading && total === 0) {
    return null;
  }

  const handleExport = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/notes?page=1&pageSize=10000`);
      if (!res.ok) return;
      const allData: NotesResponse = await res.json();

      const headers = ['序号', '笔记链接', '笔记id', '博主名称', '内容方向', '总消耗'];
      const rows = allData.notes.map((note, idx) => {
        const contentDirection = note.components
          ? String((note.components as Record<string, unknown>).contentDirection ?? '')
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
        ...rows.map((row) =>
          row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
        ),
      ].join('\n');

      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `笔记底表数据_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      // ignore
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

  const truncateLink = (link: string | null, maxLen = 14): string => {
    if (!link) return '';
    if (link.length <= maxLen) return link;
    return link.slice(0, maxLen) + '...';
  };

  const handleJump = () => {
    const val = parseInt(jumpPage, 10);
    if (val >= 1 && val <= totalPages) setPage(val);
  };

  return (
    <div className="space-y-3 pt-6">
      <div className="flex items-center justify-between rounded-lg bg-[#F5F5F5] px-4 py-3 text-sm">

          <span className="text-gray-500">
            笔记数据共计{total}条
            {updatedAt && `，数据更新时间${formatDate(updatedAt)}`}
          </span>
       
        <Button variant="primary" size="sm" onClick={handleExport} className="shrink-0">
          导出现有数据
        </Button>
      </div>

      <div className={listTableWrapperClass}>
        <Table className="text-sm">
          <TableHeader>
            <TableRow className={listTableHeaderRowClass}>
              <TableHead className={cn(listTableHeadClass, 'w-16')}>序号</TableHead>
              <TableHead className={listTableHeadClass}>笔记链接</TableHead>
              <TableHead className={listTableHeadClass}>笔记id</TableHead>
              <TableHead className={listTableHeadClass}>博主名称</TableHead>
              <TableHead className={listTableHeadClass}>内容方向</TableHead>
              <TableHead className={cn(listTableHeadClass, 'text-right')}>总消耗</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-gray-400">
                  加载中...
                </TableCell>
              </TableRow>
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-red-500">
                  加载失败，请刷新重试
                </TableCell>
              </TableRow>
            ) : (
              notes.map((note, idx) => (
                <TableRow key={note.id} className={listTableRowClass(idx)}>
                  <TableCell className="py-3 text-gray-500">
                    {(page - 1) * pageSize + idx + 1}
                  </TableCell>
                  <TableCell className="py-3">
                    {note.noteLink ? (
                      <a
                        href={note.noteLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand hover:underline"
                        title={note.noteLink}
                      >
                        {truncateLink(note.noteLink)}
                      </a>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell className="py-3 font-mono text-xs text-gray-600">
                    {note.noteId}
                  </TableCell>
                  <TableCell className="py-3">{note.kolNickName || '-'}</TableCell>
                  <TableCell className="py-3">{getContentDirection(note) || '-'}</TableCell>
                  <TableCell className="py-3 text-right tabular-nums">
                    {Number(note.totalPlatformPrice).toLocaleString('zh-CN', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {total > 0 && (
     
        <CardFooter className="flex flex-wrap items-center justify-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            <ChevronLeft size={16} />
          </Button>
          {generatePageNumbers(page, totalPages).map((p, i) =>
            p === '...' ? (
              <span key={`ellipsis-${i}`} className="px-1 text-gray-400">
                ...
              </span>
            ) : (
              <Button
                key={p}
                type="button"
                variant={page === p ? 'primary' : 'outline'}
                size="icon-sm"
                onClick={() => setPage(p as number)}
                className={cn('text-sm', page === p && 'pointer-events-none')}
              >
                {p}
              </Button>
            )
          )}
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            <ChevronRight size={16} />
          </Button>

          <Select
            value={String(pageSize)}
            className="flex-0"
            onValueChange={(v) => {
              setPageSize(Number(v));
              setPage(1);
            }}
          >
            <SelectTrigger className={selectTriggerClass} />
            <SelectContent>
              <SelectItem value="10">10条/页</SelectItem>
              <SelectItem value="20">20条/页</SelectItem>
              <SelectItem value="50">50条/页</SelectItem>
              <SelectItem value="100">100条/页</SelectItem>
            </SelectContent>
          </Select>

          <span className="text-xs text-gray-500">跳至</span>
          <Input
            variant="filter"
            type="number"
            min={1}
            max={totalPages}
            value={jumpPage}
            onChange={(e) => setJumpPage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleJump();
            }}
            className="h-8 w-12 px-1 text-center text-xs"
          />
          <span className="text-xs text-gray-500">页</span>
          </CardFooter>
      )}
    </div>
  );
}

function generatePageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 9) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | '...')[] = [];
  const showPages = new Set<number>();
  showPages.add(1);
  showPages.add(total);
  for (let i = Math.max(1, current - 2); i <= Math.min(total, current + 2); i++) {
    showPages.add(i);
  }

  const sorted = Array.from(showPages).sort((a, b) => a - b);
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) pages.push('...');
    pages.push(sorted[i]);
  }

  return pages;
}
