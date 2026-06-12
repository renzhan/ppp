'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, ChevronLeft, ChevronRight, Database, Calculator } from 'lucide-react';

interface TraceColumn {
  key: string;
  label: string;
  type: string;
}

interface CalculationTrace {
  metric: string;
  formula: string;
  inputs: Record<string, number | string>;
  result: number | string;
}

interface TraceDataResponse {
  traceId: string;
  chapterNumber: number;
  label: string;
  sourceTable: string;
  sourceQuery: string;
  columns: TraceColumn[];
  rows: Record<string, unknown>[];
  pagination: {
    page: number;
    pageSize: number;
    totalPages: number;
    totalRows: number;
  };
  calculations: CalculationTrace[];
}

interface TraceDataPanelProps {
  reviewId: string;
  traceId: string;
  onClose: () => void;
}

export function TraceDataPanel({ reviewId, traceId, onClose }: TraceDataPanelProps) {
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // 切换 traceId 时重置页码为1
  useEffect(() => {
    setPage(1);
  }, [traceId]);

  const { data, isLoading, error } = useQuery<TraceDataResponse>({
    queryKey: ['trace', reviewId, traceId, page],
    queryFn: async () => {
      const res = await fetch(
        `/api/reviews/${reviewId}/trace/${traceId}?page=${page}&pageSize=${pageSize}`
      );
      if (!res.ok) throw new Error('加载失败');
      return res.json();
    },
  });

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-white">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Database size={14} className="text-blue-600" />
          <span className="text-sm font-medium text-slate-800">
            {data?.label || '数据溯源'}
          </span>
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <X size={16} />
        </button>
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <span className="text-xs text-slate-400">加载中...</span>
          </div>
        )}

        {error && (
          <div className="py-4 text-center text-xs text-slate-500">
            <p className="mb-2">该段落的溯源数据尚未生成</p>
            <p className="text-slate-400">重新生成报告后将自动记录数据来源</p>
          </div>
        )}

        {data && (
          <>
            {/* Source info */}
            <div className="mb-3 rounded bg-slate-50 p-2">
              <p className="text-xs text-slate-500">
                <span className="font-medium">来源表：</span>{data.sourceTable}
              </p>
              <details className="mt-1">
                <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-600">
                  查看SQL
                </summary>
                <pre className="mt-1 whitespace-pre-wrap rounded bg-slate-100 p-2 text-xs text-slate-600">
                  {data.sourceQuery}
                </pre>
              </details>
            </div>

            {/* Data table */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100">
                    {data.columns.map((col) => (
                      <th
                        key={col.key}
                        className="border border-slate-200 px-2 py-1.5 text-left font-medium text-slate-600"
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      {data.columns.map((col) => (
                        <td
                          key={col.key}
                          className="border border-slate-200 px-2 py-1.5 text-slate-700"
                        >
                          {String(row[col.key] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                共{data.pagination.totalRows}行，第{data.pagination.page}/{data.pagination.totalPages}页
              </span>
              <div className="flex gap-1">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="inline-flex items-center gap-0.5 rounded border px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-30"
                >
                  <ChevronLeft size={12} />
                  上一页
                </button>
                <button
                  disabled={page >= data.pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="inline-flex items-center gap-0.5 rounded border px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-30"
                >
                  下一页
                  <ChevronRight size={12} />
                </button>
              </div>
            </div>

            {/* Calculations */}
            {data.calculations && data.calculations.length > 0 && (
              <div className="mt-4 border-t pt-3">
                <div className="mb-2 flex items-center gap-1.5">
                  <Calculator size={12} className="text-blue-600" />
                  <span className="text-xs font-medium text-slate-600">计算公式</span>
                </div>
                <div className="space-y-2">
                  {data.calculations.map((calc, i) => (
                    <div key={i} className="rounded bg-blue-50 p-2">
                      <div className="flex items-baseline gap-2">
                        <span className="text-xs font-medium text-blue-800">{calc.metric}</span>
                        <span className="font-mono text-xs text-slate-600">{calc.formula}</span>
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        {Object.entries(calc.inputs).map(([k, v]) => `${k} = ${v}`).join('，')}
                      </div>
                      <div className="mt-0.5 text-xs font-medium text-blue-700">
                        = {calc.result}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
