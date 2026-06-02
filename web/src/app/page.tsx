'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { Loading } from '@/components/ui/loading';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FilterField } from '@/components/ui/filter-field';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  listEmptyClass,
  listErrorClass,
  listTableHeadClass,
  listTableHeaderRowClass,
  listTableRowClass,
  listTableWrapperClass,
} from '@/components/ui/data-list';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';
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

interface TreeNode {
  id: string;
  label: string;
  children?: TreeNode[];
}

interface Project {
  id: string;
  projectName: string;
  brand: string;
  category: string;
  businessLine: string | null;
  startDate: string;
  endDate: string;
  createdAt: string;
  createdBy: string | null;
  createdByDisplayName: string | null;
  noteCount: number;
  participants: string[];
}

interface ProjectsResponse {
  items: Project[];
  totalItems: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const selectTriggerClass =
  'h-9 rounded border-gray-200 bg-white text-gray-900 focus-visible:ring-brand/25 disabled:bg-gray-50 disabled:text-gray-400';

export default function ProjectListPage() {
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({
    category: '',
    brand: '',
    businessLine: '',
    dateFrom: '',
    dateTo: '',
  });
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data: treeData } = useQuery<TreeNode[]>({
    queryKey: ['tree-structure'],
    queryFn: async () => {
      const response = await fetch('/api/tree-structure');
      if (!response.ok) throw new Error('获取树结构失败');
      return response.json();
    },
    staleTime: 60_000,
  });

  const brandOptions = useMemo(() => {
    if (!treeData || !filters.category) return [];
    const categoryNode = treeData.find((n) => n.id === filters.category);
    return categoryNode?.children ?? [];
  }, [treeData, filters.category]);

  const businessLineOptions = useMemo(() => {
    if (!treeData || !filters.category || !filters.brand) return [];
    const categoryNode = treeData.find((n) => n.id === filters.category);
    const brandNode = categoryNode?.children?.find((n) => n.id === filters.brand);
    return brandNode?.children ?? [];
  }, [treeData, filters.category, filters.brand]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));
    if (search) params.set('search', search);
    if (filters.category) params.set('category', filters.category);
    if (filters.brand) params.set('brand', filters.brand);
    if (filters.businessLine) params.set('businessLine', filters.businessLine);
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.set('dateTo', filters.dateTo);
    return params.toString();
  }, [filters, search, page]);

  const { data, isLoading, isError, error } = useQuery<ProjectsResponse>({
    queryKey: ['projects', queryString],
    queryFn: async () => {
      const response = await fetch(`/api/projects?${queryString}`);
      if (!response.ok) throw new Error('获取项目列表失败');
      return response.json();
    },
  });

  const resetFilters = () => {
    setSearch('');
    setFilters({
      category: '',
      brand: '',
      businessLine: '',
      dateFrom: '',
      dateTo: '',
    });
    setPage(1);
  };

  const handleCategoryChange = (value: string) => {
    setFilters((prev) => ({ ...prev, category: value, brand: '', businessLine: '' }));
    setPage(1);
  };

  const handleBrandChange = (value: string) => {
    setFilters((prev) => ({ ...prev, brand: value, businessLine: '' }));
    setPage(1);
  };

  const handleBusinessLineChange = (value: string) => {
    setFilters((prev) => ({ ...prev, businessLine: value }));
    setPage(1);
  };

  const totalPages = data?.totalPages ?? 1;

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0 items-center">
        <div className="space-y-1">
          <CardTitle className='text-md'>项目基础信息</CardTitle>
        </div>
        <Button variant="primary" size="sm" className="shrink-0 gap-1 px-4" asChild>
          <Link href="/projects/new">
            <Plus size={16} />
            新建
          </Link>
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <FilterField label="品类：">
            <Select value={filters.category} onValueChange={handleCategoryChange}>
              <SelectTrigger className={selectTriggerClass} />
              <SelectContent>
                <SelectItem value="">请选择</SelectItem>
                {(treeData ?? []).map((node) => (
                  <SelectItem key={node.id} value={node.id}>
                    {node.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>

          <FilterField label="品牌：">
            <Select
              value={filters.brand}
              onValueChange={handleBrandChange}
              disabled={!filters.category}
            >
              <SelectTrigger className={selectTriggerClass} />
              <SelectContent>
                <SelectItem value="">请选择</SelectItem>
                {brandOptions.map((node) => (
                  <SelectItem key={node.id} value={node.id}>
                    {node.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>

          <FilterField label="品牌业务线：">
            <Select
              value={filters.businessLine}
              onValueChange={handleBusinessLineChange}
              disabled={!filters.brand}
            >
              <SelectTrigger className={selectTriggerClass} />
              <SelectContent>
                <SelectItem value="">请选择</SelectItem>
                {businessLineOptions.map((node) => (
                  <SelectItem key={node.id} value={node.id}>
                    {node.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>

          <FilterField label="项目名称：">
            <Input
              variant="filter"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="请输入"
            />
          </FilterField>
        </div>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <FilterField label="立项日期：" className="min-w-0 flex-1 lg:max-w-xl">
            <div className="flex items-center gap-2">
              <Input
                variant="filter"
                type="date"
                className="w-44"
                value={filters.dateFrom}
                onChange={(e) => {
                  setFilters((prev) => ({ ...prev, dateFrom: e.target.value }));
                  setPage(1);
                }}
              />
              <span className="shrink-0 text-sm text-gray-500">至</span>
              <Input
                variant="filter"
                type="date"
                className="w-44"
                value={filters.dateTo}
                onChange={(e) => {
                  setFilters((prev) => ({ ...prev, dateTo: e.target.value }));
                  setPage(1);
                }}
              />
            </div>
          </FilterField>

          <div className="flex shrink-0 items-center gap-3">
            <Button
              type="button"
              variant="primary"
              size="sm"
              className="min-w-[88px]"
              onClick={() => setPage(1)}
            >
              查询
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="min-w-[88px]"
              onClick={resetFilters}
            >
              重置
            </Button>
          </div>
        </div>

        {isLoading ? (
          <Loading size="lg" text="正在加载项目列表..." className="py-16" />
        ) : isError ? (
          <div className={listErrorClass}>{(error as Error).message || '获取项目列表失败'}</div>
        ) : data?.items.length ? (
          <div className={listTableWrapperClass}>
            <Table className="min-w-[960px] text-sm">
              <TableHeader >
                <TableRow className={listTableHeaderRowClass}>
                  <TableHead className={listTableHeadClass}>品类</TableHead>
                  <TableHead className={listTableHeadClass}>品牌</TableHead>
                  <TableHead className={listTableHeadClass}>业务线</TableHead>
                  <TableHead className={cn(listTableHeadClass, 'min-w-[220px]')}>项目名称</TableHead>
                  <TableHead className={listTableHeadClass}>创建者</TableHead>
                  <TableHead className={listTableHeadClass}>笔记数量</TableHead>
                  <TableHead className={listTableHeadClass}>立项时间</TableHead>
                  <TableHead className={listTableHeadClass}>参与者</TableHead>
                  <TableHead className={listTableHeadClass}>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((project, index) => (
                  <TableRow key={project.id} className={listTableRowClass(index)}>
                    <TableCell className="whitespace-nowrap py-3">{project.category || '-'}</TableCell>
                    <TableCell className="whitespace-nowrap py-3">{project.brand || '-'}</TableCell>
                    <TableCell className="whitespace-nowrap py-3">
                      {project.businessLine || '-'}
                    </TableCell>
                    <TableCell className="max-w-[280px] truncate py-3">
                      {project.projectName}
                    </TableCell>
                    <TableCell className="whitespace-nowrap py-3">
                      {project.createdByDisplayName || '-'}
                    </TableCell>
                    <TableCell className="whitespace-nowrap py-3">{project.noteCount ?? 0}</TableCell>
                    <TableCell className="whitespace-nowrap py-3">
                      {formatDate(project.startDate)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap py-3">
                      {project.participants?.length > 0
                        ? `${project.participants.length}人`
                        : '-'}
                    </TableCell>
                    <TableCell className="whitespace-nowrap py-3">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <Button variant="text-link" size="sm" className="h-auto px-0 text-xs" asChild>
                          <Link href={`/projects/${project.id}/edit`}>编辑</Link>
                        </Button>
                        <Button variant="text-link" size="sm" className="h-auto px-0 text-xs" asChild>
                          <Link href={`/review/new?projectId=${project.id}`}>复盘</Link>
                        </Button>
                        <Button variant="text-link" size="sm" className="h-auto px-0 text-xs" asChild>
                          <Link href="/planning">策划</Link>
                        </Button>
                        <Button variant="text-link" size="sm" className="h-auto px-0 text-xs" asChild>
                          <Link href={`/sentiment?projectId=${project.id}`}>舆情监控</Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className={listEmptyClass}>暂无项目数据</div>
        )}
      </CardContent>

      {data?.items.length ? (
        <CardFooter className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-gray-500">
            共 {data.totalItems} 条记录，第 {data.page}/{totalPages} 页
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
    </Card>
  );
}

function generatePageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | '...')[] = [];

  if (current <= 4) {
    for (let i = 1; i <= 5; i++) pages.push(i);
    pages.push('...');
    pages.push(total);
  } else if (current >= total - 3) {
    pages.push(1);
    pages.push('...');
    for (let i = total - 4; i <= total; i++) pages.push(i);
  } else {
    pages.push(1);
    pages.push('...');
    for (let i = current - 1; i <= current + 1; i++) pages.push(i);
    pages.push('...');
    pages.push(total);
  }

  return pages;
}
