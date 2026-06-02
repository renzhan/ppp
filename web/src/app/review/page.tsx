'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Plus, Pencil, BookOpen, Search } from 'lucide-react';
import { Loading } from '@/components/ui/loading';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  listEmptyClass,
  listErrorClass,
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
}

export default function ReviewListPage() {
  const [search, setSearch] = useState('');

  const { data, isLoading, isError, error } = useQuery<ReviewsResponse>({
    queryKey: ['reviews'],
    queryFn: async () => {
      const response = await fetch('/api/reviews');
      if (!response.ok) throw new Error('获取复盘列表失败');
      return response.json();
    },
  });

  const filteredItems = useMemo(() => {
    const items = data?.items ?? [];
    const keyword = search.trim().toLowerCase();
    if (!keyword) return items;
    return items.filter(
      (item) =>
        item.projectName.toLowerCase().includes(keyword) ||
        (item.createdByDisplayName ?? '').toLowerCase().includes(keyword)
    );
  }, [data?.items, search]);

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div className="space-y-1">
          <CardTitle className='text-md'>复盘系统</CardTitle>
          <CardDescription>管理所有复盘记录，查看复盘报告和进入审校台。</CardDescription>
        </div>
        <Button variant="primary" size="sm" className="shrink-0 gap-2" asChild>
          <Link href="/review/new">
            <Plus size={16} />
            开始新的复盘
          </Link>
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="relative max-w-sm">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            aria-hidden
          />
          <Input
            variant="filter"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索项目名称或复盘者"
            className="pl-9"
          />
        </div>

        {isLoading ? (
          <Loading size="lg" text="正在加载复盘列表..." className="py-16" />
        ) : isError ? (
          <div className={listErrorClass}>{(error as Error).message || '获取复盘列表失败'}</div>
        ) : filteredItems.length ? (
          <div className={listTableWrapperClass}>
            <Table className="text-sm">
              <TableHeader>
                <TableRow className={listTableHeaderRowClass}>
                  <TableHead className={listTableHeadClass}>项目名称</TableHead>
                  <TableHead className={listTableHeadClass}>复盘者</TableHead>
                  <TableHead className={listTableHeadClass}>更新时间</TableHead>
                  <TableHead className={listTableHeadClass}>状态</TableHead>
                  <TableHead className={listTableHeadClass}>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((review, index) => (
                  <TableRow key={review.id} className={listTableRowClass(index)}>
                    <TableCell className="max-w-[240px] truncate py-3 font-medium text-gray-900">
                      {review.projectName}
                    </TableCell>
                    <TableCell className="whitespace-nowrap py-3">
                      {review.createdByDisplayName || '-'}
                    </TableCell>
                    <TableCell className="whitespace-nowrap py-3">
                      {formatDate(review.updatedAt)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap py-3">
                      <StatusBadge status={review.status} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap py-3">
                      <div className="flex items-center gap-3">
                        <Button
                          variant="text-link"
                          size="sm"
                          className="h-auto gap-1 px-0 text-xs"
                          asChild
                        >
                          <Link href={`/review/new?editId=${review.id}`}>
                            <Pencil size={12} />
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
                            <BookOpen size={12} />
                            审校台
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
      </CardContent>
    </Card>
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
