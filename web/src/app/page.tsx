'use client';

import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CalendarDays, FileText, MoreHorizontal, Plus, RotateCcw, Search, Tag, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Loading } from '@/components/ui/loading';
import {
  PROJECT_STATUS_BADGES,
  PROJECT_STATUS_LABELS,
  PROJECT_TYPES,
  formatDateRange,
  type ProjectStatus,
} from '@/lib/project-meta';

interface ReportVersionSummary {
  id: string;
  versionNumber: number;
  status: string;
  generatedAt: string;
}

interface Project {
  id: string;
  projectName: string;
  brand: string;
  category: string;
  projectType: string;
  startDate: string;
  endDate: string;
  createdAt: string;
  status: ProjectStatus;
  reportVersions: ReportVersionSummary[];
}

interface ProjectsResponse {
  items: Project[];
  totalItems: number;
}

interface FiltersResponse {
  brands: string[];
  categories: string[];
}

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: '全部状态' },
  { value: 'draft', label: '待复盘' },
  { value: 'generating', label: '生成中' },
  { value: 'reviewing', label: '待审校' },
  { value: 'finalized', label: '终版' },
];

export default function ProjectListPage() {
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({
    brand: '',
    category: '',
    projectType: '',
    status: '',
  });

  const { data: filterOptions } = useQuery<FiltersResponse>({
    queryKey: ['project-filters'],
    queryFn: async () => {
      const response = await fetch('/api/projects/filters');
      if (!response.ok) {
        throw new Error('获取筛选项失败');
      }
      return response.json();
    },
    staleTime: 60_000,
  });

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set('page', '1');
    params.set('pageSize', '60');
    if (search) params.set('search', search);
    if (filters.brand) params.set('brand', filters.brand);
    if (filters.category) params.set('category', filters.category);
    if (filters.projectType) params.set('projectType', filters.projectType);
    if (filters.status) params.set('status', filters.status);
    return params.toString();
  }, [filters, search]);

  const { data, isLoading, isError, error } = useQuery<ProjectsResponse>({
    queryKey: ['projects', queryString],
    queryFn: async () => {
      const response = await fetch(`/api/projects?${queryString}`);
      if (!response.ok) {
        throw new Error('获取项目列表失败');
      }
      return response.json();
    },
  });

  const resetFilters = () => {
    setSearch('');
    setFilters({
      brand: '',
      category: '',
      projectType: '',
      status: '',
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="项目管理"
        description="全部项目默认可见，可按品牌、品类、项目名称、项目时间和项目类型筛选。"
        actions={
          <Link
            href="/projects/new"
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            <Plus size={16} />
            新建项目
          </Link>
        }
      />

      <div className="rounded-lg border bg-white p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_repeat(4,minmax(0,0.9fr))_auto]">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索项目名称或品牌"
              className="h-11 w-full rounded-lg border border-slate-200 py-2 pl-10 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <FilterSelect
            value={filters.category}
            onChange={(value) => setFilters((prev) => ({ ...prev, category: value }))}
            options={[
              { value: '', label: '全部品类' },
              ...(filterOptions?.categories || []).map((item) => ({ value: item, label: item })),
            ]}
          />
          <FilterSelect
            value={filters.brand}
            onChange={(value) => setFilters((prev) => ({ ...prev, brand: value }))}
            options={[
              { value: '', label: '全部品牌' },
              ...(filterOptions?.brands || []).map((item) => ({ value: item, label: item })),
            ]}
          />
          <FilterSelect
            value={filters.projectType}
            onChange={(value) => setFilters((prev) => ({ ...prev, projectType: value }))}
            options={[
              { value: '', label: '全部项目类型' },
              ...PROJECT_TYPES.map((item) => ({ value: item, label: item })),
            ]}
          />
          <FilterSelect
            value={filters.status}
            onChange={(value) => setFilters((prev) => ({ ...prev, status: value }))}
            options={STATUS_OPTIONS}
          />

          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <RotateCcw size={14} />
            重置
          </button>
        </div>
      </div>

      {isLoading ? (
        <Loading size="lg" text="正在加载项目列表..." className="py-20" />
      ) : isError ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-sm text-rose-600">
          {(error as Error).message || '获取项目列表失败'}
        </div>
      ) : data?.items.length ? (
        <div className="grid gap-5 xl:grid-cols-3 md:grid-cols-2">
          {data.items.map((project) => {
            const latestVersion = project.reportVersions[0];
            const statusLabel = PROJECT_STATUS_LABELS[project.status] || project.status;
            const primaryAction = getPrimaryAction(project);

            return <ProjectCard key={project.id} project={project} latestVersion={latestVersion} statusLabel={statusLabel} primaryAction={primaryAction} />;
          })}
        </div>
      ) : (
        <div className="rounded-lg border bg-white px-6 py-16 text-center text-sm text-slate-500">
          暂无项目数据
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-11 rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
    >
      {options.map((option) => (
        <option key={`${option.value}-${option.label}`} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function MetaRow({
  icon: Icon,
  text,
}: {
  icon: typeof CalendarDays;
  text: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon size={16} className="text-slate-400" />
      <span>{text}</span>
    </div>
  );
}

function ProjectCard({
  project,
  latestVersion,
  statusLabel,
  primaryAction,
}: {
  project: Project;
  latestVersion: ReportVersionSummary | undefined;
  statusLabel: string;
  primaryAction: { label: string; href: string };
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/projects/${project.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('删除失败');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  return (
    <>
      <article
        className="relative cursor-pointer overflow-hidden rounded-lg border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        onClick={() => router.push(`/projects/${project.id}`)}
      >
        <div className={`h-1 ${getProjectTypeBar(project.projectType)}`} />
        <div className="space-y-5 p-6">
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <span className="inline-flex rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                  {project.projectType}
                </span>
                <div className="pt-1">
                  <p className="text-2xl font-semibold text-slate-900">{project.brand}</p>
                  <p className="mt-1 text-base text-slate-600">{project.projectName}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span
                  className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${PROJECT_STATUS_BADGES[project.status]}`}
                >
                  {statusLabel}
                </span>
                <div className="relative" ref={menuRef}>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                  >
                    <MoreHorizontal size={18} />
                  </button>
                  {menuOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }} />
                      <div className="absolute right-0 top-full z-20 mt-1 w-36 overflow-hidden rounded-lg border bg-white py-1 shadow-lg">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setMenuOpen(false); router.push(`/projects/${project.id}`); }}
                          className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50"
                        >
                          <FileText size={14} />
                          详情
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setMenuOpen(false); setConfirmDelete(true); }}
                          className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-rose-600 transition hover:bg-rose-50"
                        >
                          <Trash2 size={14} />
                          删除
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3 text-sm text-slate-600" onClick={(e) => e.stopPropagation()}>
            <MetaRow icon={CalendarDays} text={formatDateRange(project.startDate, project.endDate)} />
            <MetaRow icon={FileText} text={`状态：${statusLabel}`} />
            <MetaRow
              icon={Tag}
              text={`最新版本：${latestVersion ? `V${latestVersion.versionNumber}.0` : '无'}`}
            />
          </div>

          <div onClick={(e) => e.stopPropagation()}>
            <Link
              href={primaryAction.href}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              {primaryAction.label}
            </Link>
          </div>
        </div>
      </article>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setConfirmDelete(false)}>
          <div className="w-96 rounded-lg bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-900">确认删除</h3>
            <p className="mt-2 text-sm text-slate-600">
              确定要删除项目「{project.projectName}」吗？此操作不可恢复，所有关联数据（笔记、标注、版本等）将被一并删除。
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="inline-flex h-10 items-center rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="inline-flex h-10 items-center rounded-lg bg-rose-600 px-4 text-sm font-medium text-white transition hover:bg-rose-700 disabled:opacity-60"
              >
                {deleteMutation.isPending ? '删除中...' : '确认删除'}
              </button>
            </div>
            {deleteMutation.isError && (
              <p className="mt-3 text-xs text-rose-500">{(deleteMutation.error as Error).message}</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function getPrimaryAction(project: Project) {
  switch (project.status) {
    case 'draft':
    case 'uploading':
      return { label: '上传数据', href: `/projects/${project.id}/upload` };
    case 'generating':
      return { label: '查看进度', href: `/projects/${project.id}/generate` };
    case 'reviewing':
      return { label: '进入审校', href: `/projects/${project.id}/versions` };
    case 'finalized':
      return { label: '下载报告', href: `/projects/${project.id}/versions` };
    default:
      return { label: '查看详情', href: `/projects/${project.id}` };
  }
}

function getProjectTypeBar(projectType: string) {
  switch (projectType) {
    case '新品上市':
      return 'bg-lime-500';
    case '日常种草':
      return 'bg-sky-500';
    case '节点营销':
      return 'bg-amber-500';
    case '竞品防御':
      return 'bg-violet-500';
    default:
      return 'bg-slate-300';
  }
}
