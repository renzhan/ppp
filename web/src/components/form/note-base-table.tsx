'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DISPLAY_ONLY_COLUMN_MAP } from '@/lib/note-base-parser';

interface NoteBaseRecord {
  id: string;
  projectId: string;
  noteId: string;
  noteLink: string | null;
  kolNickName: string | null;
  kolFanNum: number | null;
  cooperationForm: string | null;
  isRegistered: boolean;
  contentDirection: string | null;
  kolType: string | null;
  spuName: string | null;
  contentCost: number;
  contentSettlement: number;
  adSpend: number;
  totalCost: number;
  metrics: Record<string, number | string> | null;
  createdAt: string;
}

interface NoteBaseResponse {
  records: NoteBaseRecord[];
  count: number;
}

export interface NoteBaseTableProps {
  projectId: string;
}

/** Reverse map: field key → Chinese label */
const METRICS_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(DISPLAY_ONLY_COLUMN_MAP).map(([label, key]) => [key, label])
);

/** Get all unique metric keys from records */
function getMetricKeys(records: NoteBaseRecord[]): string[] {
  const keys = new Set<string>();
  for (const r of records) {
    if (r.metrics) {
      for (const k of Object.keys(r.metrics)) {
        keys.add(k);
      }
    }
  }
  return Array.from(keys);
}

function formatMetricValue(value: unknown): string {
  if (value == null || value === '') return '-';
  const num = Number(value);
  if (isNaN(num)) return String(value);
  if (num > 0 && num < 1) return (num * 100).toFixed(2) + '%';
  if (Number.isInteger(num)) return num.toLocaleString();
  return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/**
 * NoteBaseTable - 笔记底表数据展示组件
 *
 * 查询 /api/projects/:id/note-base 端点，展示所有 note_base 字段 + metrics JSON 字段。
 * 支持横向滚动，序号列固定在左侧。
 */
export function NoteBaseTable({ projectId }: NoteBaseTableProps) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { data, isLoading, isError } = useQuery<NoteBaseResponse>({
    queryKey: ['project-note-base', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/note-base`);
      if (!res.ok) throw new Error('获取笔记底表数据失败');
      return res.json();
    },
    enabled: !!projectId,
  });

  const allRecords = data?.records ?? [];
  const total = data?.count ?? 0;
  const totalPages = Math.ceil(total / pageSize);
  const metricKeys = getMetricKeys(allRecords);

  // Client-side pagination
  const paginatedRecords = allRecords.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  // Don't render anything if no data
  if (!isLoading && total === 0) {
    return null;
  }

  return (
    <div className="mt-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">
          <span className="font-medium">笔记底表</span>
          <span className="ml-4 text-gray-500">共计 {total} 条记录</span>
        </div>
      </div>

      {/* Table with horizontal scroll */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="sticky left-0 z-10 bg-gray-50 whitespace-nowrap px-3 py-2.5 text-center text-xs font-medium text-gray-600 border-r border-gray-200 min-w-[36px]">#</th>
              <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-medium text-gray-600">博主昵称</th>
              <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-medium text-gray-600">笔记ID</th>
              <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-medium text-gray-600">是否报备</th>
              <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-medium text-gray-600">合作形式</th>
              <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-medium text-gray-600">内容方向</th>
              <th className="whitespace-nowrap px-3 py-2.5 text-right text-xs font-medium text-gray-600">达人金额</th>
              <th className="whitespace-nowrap px-3 py-2.5 text-right text-xs font-medium text-gray-600">投流金额</th>
              <th className="whitespace-nowrap px-3 py-2.5 text-right text-xs font-medium text-gray-600">总消耗</th>
              {/* Dynamic metric columns from metrics JSON */}
              {metricKeys.map((key) => (
                <th key={key} className="whitespace-nowrap px-3 py-2.5 text-right text-xs font-medium text-gray-600">
                  {METRICS_LABELS[key] || key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={9 + metricKeys.length} className="px-4 py-8 text-center text-gray-400">加载中...</td>
              </tr>
            ) : isError ? (
              <tr>
                <td colSpan={9 + metricKeys.length} className="px-4 py-8 text-center text-red-500">加载失败，请刷新重试</td>
              </tr>
            ) : paginatedRecords.length === 0 ? (
              <tr>
                <td colSpan={9 + metricKeys.length} className="px-4 py-8 text-center text-gray-400">暂无数据</td>
              </tr>
            ) : (
              paginatedRecords.map((record, idx) => (
                <tr key={record.id} className="border-b last:border-b-0 hover:bg-gray-50">
                  <td className="sticky left-0 z-10 bg-white whitespace-nowrap px-3 py-2 text-center text-xs text-gray-500 border-r border-gray-200">
                    {(page - 1) * pageSize + idx + 1}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-700">{record.kolNickName || '-'}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {record.noteLink ? (
                      <a href={record.noteLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs font-mono">
                        {record.noteId}
                      </a>
                    ) : (
                      <span className="text-xs font-mono text-gray-600">{record.noteId}</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-700">{record.isRegistered ? '是' : '否'}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-700">{record.cooperationForm || '-'}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-700">{record.contentDirection || '-'}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-xs tabular-nums text-gray-700">{Number(record.contentCost).toLocaleString()}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-xs tabular-nums text-gray-700">{Number(record.adSpend).toLocaleString()}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-xs tabular-nums text-gray-700">{Number(record.totalCost).toLocaleString()}</td>
                  {/* Dynamic metric values */}
                  {metricKeys.map((key) => (
                    <td key={key} className="whitespace-nowrap px-3 py-2 text-right text-xs tabular-nums text-gray-700">
                      {formatMetricValue(record.metrics?.[key])}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-sm text-gray-500">共 {total} 条，第 {page}/{totalPages} 页</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="inline-flex h-8 w-8 items-center justify-center rounded-sm bg-white border border-gray-300 text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="上一页"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs text-gray-600">{page} / {totalPages}</span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="inline-flex h-8 w-8 items-center justify-center rounded-sm bg-white border border-gray-300 text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="下一页"
            >
              <ChevronRight size={16} />
            </button>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              className="ml-2 h-8 rounded-sm border border-gray-300 px-2 text-xs text-gray-600 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            >
              <option value={10}>10条/页</option>
              <option value={20}>20条/页</option>
              <option value={50}>50条/页</option>
              <option value={100}>100条/页</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
