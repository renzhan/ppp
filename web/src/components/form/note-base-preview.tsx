'use client';

import { ParsedNoteBaseRow, DISPLAY_ONLY_COLUMN_MAP } from '@/lib/note-base-parser';

interface NoteBasePreviewProps {
  records: ParsedNoteBaseRow[];
  warnings?: string[];
}

/** Reverse map: field key → Chinese label */
const METRICS_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(DISPLAY_ONLY_COLUMN_MAP).map(([label, key]) => [key, label])
);

/**
 * 核心字段列定义 — 对应 Excel 中有映射关系的列
 * 按 Excel 中实际出现的顺序排列
 */
const CORE_COLUMNS: { key: string; label: string; getValue: (r: ParsedNoteBaseRow) => string }[] = [
  { key: 'kolNickName', label: '博主昵称', getValue: (r) => r.kolNickName || '-' },
  { key: 'noteId', label: '笔记ID', getValue: (r) => r.noteId },
  { key: 'isRegistered', label: '是否报备', getValue: (r) => r.isRegistered ? '是' : '否' },
  { key: 'cooperationForm', label: '合作形式', getValue: (r) => r.cooperationForm || '-' },
  { key: 'contentDirection', label: '内容方向', getValue: (r) => r.contentDirection || '-' },
];

/** 费用列 */
const COST_COLUMNS: { key: string; label: string; getValue: (r: ParsedNoteBaseRow) => string }[] = [
  { key: 'contentCost', label: '达人金额', getValue: (r) => formatNum(r.contentCost) },
  { key: 'adSpend', label: '投流金额', getValue: (r) => formatNum(r.adSpend) },
  { key: 'totalCost', label: '总消耗', getValue: (r) => formatNum(r.totalCost) },
];

/** Get all unique metric keys from records, preserving a consistent order */
function getMetricKeys(records: ParsedNoteBaseRow[]): string[] {
  const keys = new Set<string>();
  for (const r of records) {
    if (r.displayMetrics) {
      for (const k of Object.keys(r.displayMetrics)) {
        keys.add(k);
      }
    }
  }
  return Array.from(keys);
}

function formatNum(val: number | undefined | null): string {
  if (val == null || val === 0) return '0';
  if (Number.isInteger(val)) return val.toLocaleString();
  return val.toLocaleString(undefined, { maximumFractionDigits: 2 });
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
 * NoteBasePreview - 笔记底表解析预览组件
 *
 * 展示 Excel 中的所有字段：核心字段 + 费用字段 + 所有数据指标字段
 */
export function NoteBasePreview({ records, warnings }: NoteBasePreviewProps) {
  if (records.length === 0) {
    return null;
  }

  const metricKeys = getMetricKeys(records);

  return (
    <div className="mt-3 space-y-2">
      {/* Summary */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-600">
          解析成功，共 <span className="font-medium text-brand">{records.length}</span> 条有效记录
        </p>
      </div>

      {/* Warnings */}
      {warnings && warnings.length > 0 && (
        <div className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {warnings.slice(0, 3).map((w, i) => (
            <p key={i}>{w}</p>
          ))}
          {warnings.length > 3 && <p>...还有 {warnings.length - 3} 条警告</p>}
        </div>
      )}

      {/* Table — 展示所有字段 */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white max-h-[400px] overflow-y-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b bg-gray-50 sticky top-0 z-20">
              <th className="sticky left-0 z-30 bg-gray-50 whitespace-nowrap px-3 py-2 text-center text-xs font-medium text-gray-600 border-r border-gray-200 min-w-[36px]">
                #
              </th>
              {/* Core columns */}
              {CORE_COLUMNS.map((col) => (
                <th key={col.key} className="whitespace-nowrap px-3 py-2 text-left text-xs font-medium text-gray-600">
                  {col.label}
                </th>
              ))}
              {/* Cost columns */}
              {COST_COLUMNS.map((col) => (
                <th key={col.key} className="whitespace-nowrap px-3 py-2 text-right text-xs font-medium text-gray-600">
                  {col.label}
                </th>
              ))}
              {/* All metric columns from displayMetrics */}
              {metricKeys.map((key) => (
                <th key={key} className="whitespace-nowrap px-3 py-2 text-right text-xs font-medium text-gray-600">
                  {METRICS_LABELS[key] || key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {records.slice(0, 100).map((record, idx) => (
              <tr key={record.noteId + idx} className="border-b last:border-b-0 hover:bg-gray-50">
                <td className="sticky left-0 z-10 bg-white whitespace-nowrap px-3 py-1.5 text-center text-xs text-gray-500 border-r border-gray-200">
                  {idx + 1}
                </td>
                {/* Core columns */}
                {CORE_COLUMNS.map((col) => (
                  <td key={col.key} className="whitespace-nowrap px-3 py-1.5 text-xs text-gray-700">
                    {col.key === 'noteId' && record.noteLink ? (
                      <a href={record.noteLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-mono">
                        {record.noteId}
                      </a>
                    ) : (
                      col.getValue(record)
                    )}
                  </td>
                ))}
                {/* Cost columns */}
                {COST_COLUMNS.map((col) => (
                  <td key={col.key} className="whitespace-nowrap px-3 py-1.5 text-right text-xs tabular-nums text-gray-700">
                    {col.getValue(record)}
                  </td>
                ))}
                {/* Metric columns */}
                {metricKeys.map((key) => (
                  <td key={key} className="whitespace-nowrap px-3 py-1.5 text-right text-xs tabular-nums text-gray-700">
                    {formatMetricValue(record.displayMetrics?.[key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {records.length > 100 && (
        <p className="text-xs text-gray-400">仅显示前 100 条，共 {records.length} 条</p>
      )}
    </div>
  );
}
