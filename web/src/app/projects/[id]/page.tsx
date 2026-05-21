'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Circle,
  FileBarChart,
  FileSpreadsheet,
  Sparkles,
  Upload,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Loading } from '@/components/ui/loading';
import {
  LAUNCH_PHASES,
  PROJECT_STATUS_BADGES,
  PROJECT_STATUS_LABELS,
  formatDateRange,
  normalizeLaunchPhases,
  type ProjectStatus,
} from '@/lib/project-meta';

interface ProjectDetail {
  id: string;
  projectName: string;
  brand: string;
  category: string;
  projectType: string;
  spuName?: string | null;
  startDate: string;
  endDate: string;
  status: ProjectStatus;
  launchPhases?: unknown;
  reportVersions: Array<{
    id: string;
    versionNumber: number;
    status: string;
    generatedAt: string;
  }>;
}

const steps = [
  { key: 'create', label: '创建项目', description: '完善项目信息' },
  { key: 'upload', label: '上传数据', description: '策划报告 / 执行底表 / 投流底表' },
  { key: 'generate', label: '生成报告', description: 'AI 异步生成版本' },
  { key: 'review', label: '审校报告', description: '人工修改与确认终版' },
];

export default function ProjectDetailPage() {
  const params = useParams();
  const projectId = params.id as string;

  const { data: project, isLoading, isError, error } = useQuery<ProjectDetail>({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}`);
      if (!response.ok) {
        throw new Error('获取项目详情失败');
      }
      return response.json();
    },
  });

  if (isLoading) {
    return <Loading size="lg" text="正在加载项目详情..." className="py-20" />;
  }

  if (isError || !project) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-sm text-rose-600">
        {(error as Error)?.message || '获取项目详情失败'}
      </div>
    );
  }

  const statusLabel = PROJECT_STATUS_LABELS[project.status];
  const launchPhases = normalizeLaunchPhases(project.launchPhases);
  const latestVersion = project.reportVersions[0];
  const currentStep = getCurrentStep(project.status);
  const actions = getActions(project);

  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/"
        title={project.projectName}
        description={`${project.brand} · ${project.category} · ${project.projectType}`}
        actions={
          <span
            className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${PROJECT_STATUS_BADGES[project.status]}`}
          >
            {statusLabel}
          </span>
        }
      />

      <section className="rounded-lg border bg-white shadow-sm">
        <div className="border-b px-6 py-5">
          <h2 className="text-xl font-semibold text-slate-900">项目详情</h2>
        </div>
        <div className="grid gap-8 px-6 py-6 lg:grid-cols-2">
          <div className="space-y-4">
            <DetailRow label="品牌" value={project.brand} />
            <DetailRow label="品类" value={project.category} />
            <DetailRow label="类型" value={project.projectType} />
            <DetailRow label="项目总周期" value={formatDateRange(project.startDate, project.endDate)} />
            <DetailRow label="SPU" value={project.spuName || '-'} />
          </div>
          <div className="space-y-4">
            <DetailRow label="主题" value={project.projectName} />
            <DetailRow label="状态" value={statusLabel} />
            <div className="space-y-3">
              <span className="text-sm text-slate-500">传播周期</span>
              <div className="space-y-3">
                {LAUNCH_PHASES.map((phase) => (
                  <div key={phase.key} className="flex flex-wrap items-center gap-3">
                    <span className={`inline-flex rounded-md px-2.5 py-1 text-xs font-medium ${phase.accentClass}`}>
                      {phase.label}
                    </span>
                    <span className="text-sm font-medium text-slate-800">
                      {formatDateRange(
                        launchPhases[phase.key].startDate,
                        launchPhases[phase.key].endDate
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <DetailRow
              label="最新版本"
              value={latestVersion ? `V${latestVersion.versionNumber}.0` : '无'}
            />
          </div>
        </div>
      </section>

      <section className="rounded-lg border bg-white shadow-sm">
        <div className="border-b px-6 py-5">
          <h2 className="text-xl font-semibold text-slate-900">项目进度</h2>
        </div>
        <div className="space-y-6 px-6 py-6">
          <div className="grid gap-4 xl:grid-cols-4">
            {steps.map((step, index) => {
              const active = index === currentStep;
              const done = index < currentStep;
              return (
                <div key={step.key} className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50 p-4">
                  <div
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                      done
                        ? 'bg-emerald-100 text-emerald-600'
                        : active
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    {done ? <CheckCircle2 size={16} /> : active ? index + 1 : <Circle size={16} />}
                  </div>
                  <div>
                    <p className="text-base font-semibold text-slate-900">{step.label}</p>
                    <p className="mt-1 text-sm text-slate-500">{step.description}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-3">
            {actions.map((action) => (
              <Link
                key={action.href + action.label}
                href={action.href}
                className={`inline-flex h-11 items-center gap-2 rounded-lg px-4 text-sm font-medium transition ${
                  action.variant === 'primary'
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <action.icon size={16} />
                {action.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-lg border bg-white shadow-sm">
        <div className="flex items-center justify-between border-b px-6 py-5">
          <div className="flex items-center gap-3">
            <FileBarChart size={20} className="text-slate-500" />
            <div>
              <h2 className="text-xl font-semibold text-slate-900">复盘报告管理</h2>
              <p className="mt-1 text-sm text-slate-500">{project.reportVersions.length} 个版本</p>
            </div>
          </div>
          <Link
            href={`/projects/${project.id}/generate`}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            <Sparkles size={16} />
            新建报告
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b bg-slate-50">
              <tr>
                <th className="px-6 py-3 font-medium text-slate-600">版本</th>
                <th className="px-6 py-3 font-medium text-slate-600">生成时间</th>
                <th className="px-6 py-3 font-medium text-slate-600">状态</th>
                <th className="px-6 py-3 font-medium text-slate-600">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {project.reportVersions.length ? (
                project.reportVersions.map((version) => (
                  <tr key={version.id}>
                    <td className="px-6 py-4 font-medium text-slate-900">V{version.versionNumber}.0</td>
                    <td className="px-6 py-4 text-slate-600">{formatDateRange(version.generatedAt, version.generatedAt)}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                        {version.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <Link
                        href={`/projects/${project.id}/review/${version.id}`}
                        className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 transition hover:text-blue-700"
                      >
                        进入审校
                        <ArrowRight size={14} />
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-slate-500">
                    还没有生成报告版本
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-sm text-slate-500">{label}：</span>
      <span className="text-lg font-medium text-slate-900">{value}</span>
    </div>
  );
}

function getCurrentStep(status: ProjectStatus) {
  switch (status) {
    case 'draft':
      return 0;
    case 'uploading':
      return 1;
    case 'generating':
      return 2;
    case 'reviewing':
      return 3;
    case 'finalized':
      return 3;
    default:
      return 0;
  }
}

function getActions(project: ProjectDetail) {
  const actions: Array<{
    label: string;
    href: string;
    icon: typeof Upload;
    variant: 'primary' | 'secondary';
  }> = [];

  if (project.status === 'draft' || project.status === 'uploading') {
    actions.push(
      {
        label: '上传数据',
        href: `/projects/${project.id}/upload`,
        icon: Upload,
        variant: 'primary',
      },
      {
        label: '开始生成',
        href: `/projects/${project.id}/generate`,
        icon: FileBarChart,
        variant: 'secondary',
      },
      {
        label: 'PPT 查看/导出',
        href: `/projects/${project.id}/ppt`,
        icon: FileBarChart,
        variant: 'secondary',
      }
    );
  }

  if (project.status === 'generating') {
    actions.push(
      {
        label: '查看生成进度',
        href: `/projects/${project.id}/generate`,
        icon: FileBarChart,
        variant: 'primary',
      },
      {
        label: 'PPT 查看/导出',
        href: `/projects/${project.id}/ppt`,
        icon: FileBarChart,
        variant: 'secondary',
      }
    );
  }

  if (project.status === 'reviewing') {
    actions.push(
      {
        label: '进入审校',
        href: `/projects/${project.id}/versions`,
        icon: FileSpreadsheet,
        variant: 'primary',
      },
      {
        label: 'PPT 查看/导出',
        href: `/projects/${project.id}/ppt`,
        icon: FileBarChart,
        variant: 'secondary',
      }
    );
  }

  if (project.status === 'finalized') {
    actions.push(
      {
        label: '查看终版',
        href: `/projects/${project.id}/versions`,
        icon: FileSpreadsheet,
        variant: 'primary',
      },
      {
        label: 'PPT 查看/导出',
        href: `/projects/${project.id}/ppt`,
        icon: FileBarChart,
        variant: 'secondary',
      }
    );
  }

  return actions;
}
