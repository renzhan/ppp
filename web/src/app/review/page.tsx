'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Plus, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { Loading } from '@/components/ui/loading';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CardFooter } from '@/components/ui/card';
import {
  listEmptyClass,
  listErrorClass,
  listFilterToDataGapClass,
  listTableActionCellClass,
  listTableActionHeadClass,
  listTableCellClass,
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
import { formatDate } from '@/lib/project-meta';
import { generatePageNumbers } from '@/lib/pagination';
import { cn } from '@/lib/utils';

interface ReviewItem {
  id: string;
  projectId: string;
  projectName: string;
  category: string;
  brand: string;
  businessLine: string | null;
  status: string;
  createdBy: string;
  createdByDisplayName: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ReviewsResponse {
  items: ReviewItem[];
  totalItems: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export default function ReviewListPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));
    if (search.trim()) params.set('search', search.trim());
    return params.toString();
  }, [page, search]);

  const { data, isLoading, isError, error } = useQuery<ReviewsResponse>({
    queryKey: ['reviews', queryString],
    queryFn: async () => {
      const response = await fetch(`/api/reviews?${queryString}`);
      if (!response.ok) throw new Error('获取复盘列表失败');
      return response.json();
    },
  });

  const totalPages = data?.totalPages ?? 1;
  const items = data?.items ?? [];

  return (
    <div className="space-y-6">

      <div className="flex items-start justify-between space-y-0">

          <h1 className="text-2xl tracking-tight text-gray-900">复盘信息</h1>

        <Button variant="primary" size="sm" className="shrink-0 gap-1 px-4" asChild>
          <Link href="/review/new">
            <Plus size={16} />
            新建复盘
          </Link>
        </Button>
      </div>
    <div className="">
      <div className="space-y-4">
        <div className="relative max-w-sm">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            aria-hidden
          />
          <Input
            variant="filter"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="搜索项目名称或复盘者"
            className="pl-9"
          />
        </div>
      </div>
        <div className={listFilterToDataGapClass}>
          {isLoading ? (
            <Loading size="lg" text="正在加载复盘列表..." className="py-16" />
          ) : isError ? (
            <div className={listErrorClass}>{(error as Error).message || '获取复盘列表失败'}</div>
          ) : items.length ? (
            <div className={listTableWrapperClass}>
              <Table className="text-sm">
                <TableHeader>
                  <TableRow className={listTableHeaderRowClass}>
                    <TableHead className={listTableHeadClass}>项目名称</TableHead>
                    <TableHead className={listTableHeadClass}>复盘报告ID</TableHead>
                    <TableHead className={listTableHeadClass}>复盘者</TableHead>
                    <TableHead className={listTableHeadClass}>更新时间</TableHead>
                    <TableHead className={listTableHeadClass}>状态</TableHead>
                    <TableHead className={listTableActionHeadClass}>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((review, index) => (
                    <TableRow key={review.id} className={listTableRowClass(index)}>
                      <TableCell
                        className={cn(listTableCellClass, 'max-w-[200px] truncate text-gray-900')}
                      >
                        {review.projectName}
                      </TableCell>
                      <TableCell className={cn(listTableCellClass, 'whitespace-nowrap')}>
                        {review.id}
                      </TableCell>
                      <TableCell className={cn(listTableCellClass, 'whitespace-nowrap')}>
                        {review.createdByDisplayName || '-'}
                      </TableCell>
                      <TableCell className={cn(listTableCellClass, 'whitespace-nowrap')}>
                        {formatDate(review.updatedAt)}
                      </TableCell>
                      <TableCell className={cn(listTableCellClass, 'whitespace-nowrap')}>
                        <StatusBadge status={review.status} />
                      </TableCell>
                      <TableCell className={cn(listTableActionCellClass, 'whitespace-nowrap')}>
                        <div className="flex items-center justify-center gap-3">
                          <Button
                            variant="text-link"
                            size="sm"
                            className="h-auto gap-1 px-0 text-xs"
                            asChild
                          >
                            <Link href={`/review/new?editId=${review.id}`}>
                              编辑
                            </Link>
                          </Button>
                          <Button
                            variant="text-link"
                            size="sm"
                            className="h-auto gap-1 px-0 text-xs"
                            asChild
                          >
                            <Link href={`/review/${review.id}/proofread`}>
                              审校
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className={listEmptyClass}>
              {search.trim()
                ? '未找到匹配的复盘记录'
                : '暂无复盘记录，点击「开始新的复盘」创建第一个复盘。'}
            </div>
          )}
        </div>
      </div>

      {items.length ? (
        <CardFooter className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-gray-500">
            共 {data?.totalItems ?? 0} 条记录，第 {data?.page ?? page}/{totalPages} 页
          </p>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              <ChevronLeft size={16} />
            </Button>
            {generatePageNumbers(page, totalPages).map((p, idx) =>
              p === '...' ? (
                <span key={`ellipsis-${idx}`} className="px-1 text-gray-400">
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
          </div>
        </CardFooter>
      ) : null}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    draft: { label: '草稿', className: 'bg-gray-100 text-gray-700' },
    generating: { label: '生成中', className: 'bg-amber-100 text-amber-700' },
    completed: { label: '已完成', className: 'bg-emerald-100 text-emerald-700' },
  };

  const { label, className } = config[status] ?? {
    label: status,
    className: 'bg-gray-100 text-gray-700',
  };

  return (
    <span
      className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', className)}
    >
      {label}
    </span>
  );
}
