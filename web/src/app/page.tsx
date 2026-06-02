'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Plus, Search, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import { Loading } from '@/components/ui/loading';
import { formatDate } from '@/lib/project-meta';

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

export default function ProjectListPage() {
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({
    category: '',
    brand: '',
    businessLine: '',
    executionStartDateFrom: '',
    executionStartDateTo: '',
    endDateFrom: '',
    endDateTo: '',
  });
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Fetch tree structure for cascade selectors
  const { data: treeData } = useQuery<TreeNode[]>({
    queryKey: ['tree-structure'],
    queryFn: async () => {
      const response = await fetch('/api/tree-structure');
      if (!response.ok) throw new Error('获取树结构失败');
      return response.json();
    },
    staleTime: 60_000,
  });

  // Derive brand and business line options from tree
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

  // Build query string
  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));
    if (search) params.set('search', search);
    if (filters.category) params.set('category', filters.category);
    if (filters.brand) params.set('brand', filters.brand);
    if (filters.businessLine) params.set('businessLine', filters.businessLine);
    if (filters.executionStartDateFrom) params.set('executionStartDateFrom', filters.executionStartDateFrom);
    if (filters.executionStartDateTo) params.set('executionStartDateTo', filters.executionStartDateTo);
    if (filters.endDateFrom) params.set('endDateFrom', filters.endDateFrom);
    if (filters.endDateTo) params.set('endDateTo', filters.endDateTo);
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
      executionStartDateFrom: '',
      executionStartDateTo: '',
      endDateFrom: '',
      endDateTo: '',
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">项目管理</h1>
          <p className="mt-1 text-sm text-gray-500">管理所有项目，支持按品类、品牌、业务线、项目名称和日期筛选。</p>
        </div>
        <Link
          href="/projects/new"
          className="inline-flex h-10 items-center gap-2 rounded-md bg-brand px-5 text-sm font-medium text-white transition hover:bg-brand-600"
        >
          <Plus size={16} />
          新建项目
        </Link>
      </div>

      {/* Filter Bar */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-end gap-4">
          {/* Category */}
          <div className="min-w-[140px]">
            <label className="mb-1 block text-xs text-gray-500">品类</label>
            <select
              value={filters.category}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="h-10 w-full rounded-sm border border-gray-300 px-3 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
            >
              <option value="">全部品类</option>
              {(treeData ?? []).map((node) => (
                <option key={node.id} value={node.id}>{node.label}</option>
              ))}
            </select>
          </div>

          {/* Brand */}
          <div className="min-w-[140px]">
            <label className="mb-1 block text-xs text-gray-500">品牌</label>
            <select
              value={filters.brand}
              onChange={(e) => handleBrandChange(e.target.value)}
              disabled={!filters.category}
              className="h-10 w-full rounded-sm border border-gray-300 px-3 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-gray-50"
            >
              <option value="">全部品牌</option>
              {brandOptions.map((node) => (
                <option key={node.id} value={node.id}>{node.label}</option>
              ))}
            </select>
          </div>

          {/* Business Line */}
          <div className="min-w-[140px]">
            <label className="mb-1 block text-xs text-gray-500">产品线</label>
            <select
              value={filters.businessLine}
              onChange={(e) => handleBusinessLineChange(e.target.value)}
              disabled={!filters.brand}
              className="h-10 w-full rounded-sm border border-gray-300 px-3 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-gray-50"
            >
              <option value="">全部产品线</option>
              {businessLineOptions.map((node) => (
                <option key={node.id} value={node.id}>{node.label}</option>
              ))}
            </select>
          </div>

          {/* Project Name Search */}
          <div className="min-w-[180px]">
            <label className="mb-1 block text-xs text-gray-500">项目名称</label>
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="搜索项目名称"
                className="h-10 w-full rounded-sm border border-gray-300 pl-9 pr-3 text-sm placeholder:text-gray-400 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </div>
          </div>

          {/* Execution Start Date Range */}
          <div className="min-w-[140px]">
            <label className="mb-1 block text-xs text-gray-500">开始执行日期</label>
            <input
              type="date"
              value={filters.executionStartDateFrom}
              onChange={(e) => { setFilters((prev) => ({ ...prev, executionStartDateFrom: e.target.value })); setPage(1); }}
              className="h-10 w-full rounded-sm border border-gray-300 px-3 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </div>
          <div className="min-w-[140px]">
            <label className="mb-1 block text-xs text-gray-500">项目结束日期</label>
            <input
              type="date"
              value={filters.endDateFrom}
              onChange={(e) => { setFilters((prev) => ({ ...prev, endDateFrom: e.target.value })); setPage(1); }}
              className="h-10 w-full rounded-sm border border-gray-300 px-3 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </div>

          {/* Query (Search triggers automatically, but adding explicit button for spec compliance) */}
          <button
            type="button"
            onClick={() => setPage(1)}
            className="inline-flex h-10 items-center gap-1.5 rounded-md bg-brand px-6 text-sm font-medium text-white transition hover:bg-brand-600"
          >
            <Search size={14} />
            查询
          </button>

          {/* Reset */}
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex h-10 items-center gap-1.5 rounded-md border border-gray-300 bg-white px-6 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            <RotateCcw size={14} />
            重置
          </button>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <Loading size="lg" text="正在加载项目列表..." className="py-20" />
      ) : isError ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-sm text-rose-600">
          {(error as Error).message || '获取项目列表失败'}
        </div>
      ) : data?.items.length ? (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left">
                  <th className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-600">品类</th>
                  <th className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-600">品牌</th>
                  <th className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-600">业务线</th>
                  <th className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-600">项目名称</th>
                  <th className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-600">创建者</th>
                  <th className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-600">笔记数量</th>
                  <th className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-600">立项时间</th>
                  <th className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-600">参与者</th>
                  <th className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-600">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.items.map((project) => (
                  <tr key={project.id} className="bg-white text-sm text-gray-900 border-b transition hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-3">{project.category || '-'}</td>
                    <td className="whitespace-nowrap px-4 py-3">{project.brand || '-'}</td>
                    <td className="whitespace-nowrap px-4 py-3">{project.businessLine || '-'}</td>
                    <td className="max-w-[200px] truncate px-4 py-3 font-medium">{project.projectName}</td>
                    <td className="whitespace-nowrap px-4 py-3">{project.createdByDisplayName || '-'}</td>
                    <td className="whitespace-nowrap px-4 py-3">{project.noteCount ?? 0}</td>
                    <td className="whitespace-nowrap px-4 py-3">{formatDate(project.startDate)}</td>
                    <td className="max-w-[150px] truncate px-4 py-3">
                      {project.participants?.length > 0 ? `${project.participants.length}人` : '-'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/projects/${project.id}/edit`}
                          className="inline-flex items-center rounded px-2 py-1 text-xs font-medium text-brand transition hover:bg-brand-50"
                        >
                          编辑
                        </Link>
                        <Link
                          href={`/review/new?projectId=${project.id}`}
                          className="inline-flex items-center rounded px-2 py-1 text-xs font-medium text-emerald-600 transition hover:bg-emerald-50"
                        >
                          复盘
                        </Link>
                        <Link
                          href="/planning"
                          className="inline-flex items-center rounded px-2 py-1 text-xs font-medium text-amber-600 transition hover:bg-amber-50"
                        >
                          策划
                        </Link>
                        <Link
                          href={`/sentiment?projectId=${project.id}`}
                          className="inline-flex items-center rounded px-2 py-1 text-xs font-medium text-violet-600 transition hover:bg-violet-50"
                        >
                          舆情监控
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-sm text-gray-500">
              共 {data.totalItems} 条记录，第 {data.page}/{totalPages} 页
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="inline-flex h-8 w-8 items-center justify-center rounded-sm bg-white border border-gray-300 text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft size={16} />
              </button>
              {generatePageNumbers(page, totalPages).map((p, idx) =>
                p === '...' ? (
                  <span key={`ellipsis-${idx}`} className="px-1 text-gray-400">...</span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPage(p as number)}
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-sm text-sm font-medium transition ${
                      page === p
                        ? 'bg-brand text-white'
                        : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
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
                className="inline-flex h-8 w-8 items-center justify-center rounded-sm bg-white border border-gray-300 text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border bg-white px-6 py-16 text-center text-sm text-gray-500">
          暂无项目数据
        </div>
      )}
    </div>
  );
}

/**
 * Generate page number array with ellipsis for pagination display.
 * Shows at most 7 page buttons with ellipsis for gaps.
 */
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
