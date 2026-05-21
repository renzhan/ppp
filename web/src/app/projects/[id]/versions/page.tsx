'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Copy,
  ExternalLink,
  GitCompare,
  Clock,
  FileText,
  Pencil,
  CheckCircle2,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Loading } from '@/components/ui/loading';
import { useState } from 'react';

interface VersionItem {
  id: string;
  versionNumber: number;
  generatedAt: string;
  status: string;
  config: Record<string, unknown>;
  createdBy: string | null;
  editCount: number;
  moduleCount: number;
}

interface VersionListResponse {
  projectId: string;
  versions: VersionItem[];
}

interface DiffSummary {
  totalModules: number;
  added: number;
  removed: number;
  modified: number;
  unchanged: number;
  configChanged: boolean;
}

interface DiffResponse {
  v1: { id: string; versionNumber: number; generatedAt: string; status: string };
  v2: { id: string; versionNumber: number; generatedAt: string; status: string };
  summary: DiffSummary;
  moduleDiffs: Array<{
    moduleId: string;
    changeType: 'added' | 'removed' | 'modified' | 'unchanged';
    v1Status?: string;
    v2Status?: string;
  }>;
  decisionChanges: Array<{
    moduleId: string;
    v1Status: string;
    v2Status: string;
    changed: boolean;
  }>;
}

const statusLabels: Record<string, string> = {
  draft: '草稿',
  reviewing: '审校中',
  finalized: '已完成',
};

const statusIcons: Record<string, typeof FileText> = {
  draft: FileText,
  reviewing: Pencil,
  finalized: CheckCircle2,
};

export default function VersionManagementPage() {
  const params = useParams();
  const projectId = params.id as string;
  const queryClient = useQueryClient();

  const [diffVersions, setDiffVersions] = useState<{ v1: string; v2: string } | null>(null);

  const {
    data,
    isLoading,
    isError,
    error,
  } = useQuery<VersionListResponse>({
    queryKey: ['versions', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/versions/${projectId}`);
      if (!res.ok) throw new Error('获取版本列表失败');
      return res.json();
    },
  });

  const { data: diffData, isLoading: isDiffLoading } = useQuery<DiffResponse>({
    queryKey: ['version-diff', diffVersions?.v1, diffVersions?.v2],
    queryFn: async () => {
      if (!diffVersions) throw new Error('No versions selected');
      const res = await fetch(`/api/versions/diff/${diffVersions.v1}/${diffVersions.v2}`);
      if (!res.ok) throw new Error('获取版本差异失败');
      return res.json();
    },
    enabled: !!diffVersions,
  });

  const copyMutation = useMutation({
    mutationFn: async (versionId: string) => {
      const res = await fetch(`/api/versions/${projectId}/copy/${versionId}`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('复制版本失败');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['versions', projectId] });
    },
  });

  if (isLoading) {
    return <Loading size="lg" text="加载版本列表..." className="py-20" />;
  }

  if (isError || !data) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm text-red-600">{(error as Error)?.message || '加载失败'}</p>
      </div>
    );
  }

  const versions = data.versions;

  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/"
        title="版本管理"
        description={`共 ${versions.length} 个版本`}
      />

      {/* Version List */}
      <div className="space-y-3">
        {versions.length === 0 ? (
          <div className="rounded-lg border bg-white p-12 text-center">
            <FileText size={40} className="mx-auto text-gray-300" />
            <p className="mt-3 text-sm text-gray-500">暂无报告版本</p>
            <p className="mt-1 text-xs text-gray-400">
              请先在报告生成页面生成报告
            </p>
            <Link
              href={`/projects/${projectId}/generate`}
              className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm text-white hover:bg-primary/90"
            >
              去生成报告
            </Link>
          </div>
        ) : (
          versions.map((version, index) => {
            const StatusIcon = statusIcons[version.status] || FileText;
            const nextVersion = versions[index + 1];

            return (
              <div
                key={version.id}
                className="rounded-lg border bg-white p-5 transition-shadow hover:shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100">
                      <StatusIcon size={16} className="text-gray-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-gray-900">
                          版本 {version.versionNumber}
                        </h3>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            version.status === 'finalized'
                              ? 'bg-green-100 text-green-700'
                              : version.status === 'reviewing'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {statusLabels[version.status] || version.status}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {new Date(version.generatedAt).toLocaleString('zh-CN')}
                        </span>
                        <span className="flex items-center gap-1">
                          <Pencil size={12} />
                          {version.editCount} 次编辑
                        </span>
                        {version.createdBy && (
                          <span className="text-gray-400">
                            {version.createdBy}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {/* Diff with previous version */}
                    {nextVersion && (
                      <button
                        onClick={() =>
                          setDiffVersions({ v1: nextVersion.id, v2: version.id })
                        }
                        className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                        title="与上一版本对比"
                      >
                        <GitCompare size={14} />
                        对比
                      </button>
                    )}

                    {/* Copy version */}
                    <button
                      onClick={() => copyMutation.mutate(version.id)}
                      disabled={copyMutation.isPending}
                      className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                      title="基于此版本创建副本"
                    >
                      <Copy size={14} />
                      复制
                    </button>

                    {/* Link to review platform */}
                    <Link
                      href={`/projects/${projectId}/review/${version.id}`}
                      className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-white hover:bg-primary/90"
                    >
                      <ExternalLink size={14} />
                      审校
                    </Link>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Copy mutation feedback */}
      {copyMutation.isSuccess && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          版本复制成功！新版本已创建。
        </div>
      )}
      {copyMutation.isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          复制失败：{(copyMutation.error as Error)?.message || '未知错误'}
        </div>
      )}

      {/* Diff View */}
      {diffVersions && (
        <DiffView
          diffData={diffData ?? null}
          isLoading={isDiffLoading}
          onClose={() => setDiffVersions(null)}
        />
      )}
    </div>
  );
}

function DiffView({
  diffData,
  isLoading,
  onClose,
}: {
  diffData: DiffResponse | null;
  isLoading: boolean;
  onClose: () => void;
}) {
  if (isLoading) {
    return (
      <div className="rounded-lg border bg-white p-6">
        <Loading size="sm" text="加载差异对比..." />
      </div>
    );
  }

  if (!diffData) return null;

  const changeTypeLabels: Record<string, string> = {
    added: '新增',
    removed: '删除',
    modified: '修改',
    unchanged: '未变',
  };

  const changeTypeColors: Record<string, string> = {
    added: 'bg-green-100 text-green-700',
    removed: 'bg-red-100 text-red-700',
    modified: 'bg-yellow-100 text-yellow-700',
    unchanged: 'bg-gray-100 text-gray-500',
  };

  return (
    <div className="rounded-lg border bg-white p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-900">
          版本对比：v{diffData.v1.versionNumber} → v{diffData.v2.versionNumber}
        </h2>
        <button
          onClick={onClose}
          className="text-xs text-gray-500 hover:text-gray-700"
        >
          关闭
        </button>
      </div>

      {/* Summary */}
      <div className="mb-4 flex items-center gap-4 text-xs">
        <span className="rounded bg-green-100 px-2 py-0.5 text-green-700">
          +{diffData.summary.added} 新增
        </span>
        <span className="rounded bg-red-100 px-2 py-0.5 text-red-700">
          -{diffData.summary.removed} 删除
        </span>
        <span className="rounded bg-yellow-100 px-2 py-0.5 text-yellow-700">
          ~{diffData.summary.modified} 修改
        </span>
        <span className="rounded bg-gray-100 px-2 py-0.5 text-gray-500">
          {diffData.summary.unchanged} 未变
        </span>
        {diffData.summary.configChanged && (
          <span className="rounded bg-purple-100 px-2 py-0.5 text-purple-700">
            配置已变更
          </span>
        )}
      </div>

      {/* Module diffs */}
      <div className="space-y-2">
        {diffData.moduleDiffs
          .filter((d) => d.changeType !== 'unchanged')
          .map((diff) => (
            <div
              key={diff.moduleId}
              className="flex items-center justify-between rounded border px-3 py-2"
            >
              <span className="text-sm text-gray-700">{diff.moduleId}</span>
              <span
                className={`rounded px-2 py-0.5 text-xs font-medium ${
                  changeTypeColors[diff.changeType]
                }`}
              >
                {changeTypeLabels[diff.changeType]}
              </span>
            </div>
          ))}
        {diffData.moduleDiffs.filter((d) => d.changeType !== 'unchanged').length === 0 && (
          <p className="text-xs text-gray-500">两个版本内容完全相同</p>
        )}
      </div>

      {/* Decision changes */}
      {diffData.decisionChanges.some((d) => d.changed) && (
        <div className="mt-4">
          <h3 className="mb-2 text-xs font-medium text-gray-700">模块决策变更</h3>
          <div className="space-y-1">
            {diffData.decisionChanges
              .filter((d) => d.changed)
              .map((d) => (
                <div
                  key={d.moduleId}
                  className="flex items-center gap-2 text-xs text-gray-600"
                >
                  <span className="font-medium">{d.moduleId}</span>
                  <span className="text-gray-400">{d.v1Status}</span>
                  <span className="text-gray-400">→</span>
                  <span className="font-medium">{d.v2Status}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
