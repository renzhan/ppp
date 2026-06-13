'use client';

import { ParsedNoteBaseRow } from '@/lib/note-base-parser';

interface NoteBasePreviewProps {
  records: ParsedNoteBaseRow[];
  warnings?: string[];
}

/** Reverse map: field key → Chinese label (canonical display names) */
const METRICS_LABELS: Record<string, string> = {
  // 基础数据指标 — 使用最终版底表规范的全称
  impNum: '曝光量',
  readNum: '阅读量',
  engageNum: '互动量',
  likeNum: '点赞量',
  favNum: '收藏量',
  cmtNum: '评论量',
  shareNum: '分享量',
  followNum: '关注量',
  // 爆文标记
  isViral1kEngage: '是否千互',
  isViral1kLike: '是否千赞',
  // 效率指标
  ctr: 'CTR',
  cpm: 'CPM',
  cpc: 'CPC',
  cpe: 'CPE',
  totalCpm: '总CPM',
  totalCpe: '总CPE',
  totalCpc: '总CPC',
  // 自然流量
  organicImpNum: '自然曝光量',
  organicReadNum: '自然阅读量',
  organicEngageNum: '自然互动',
  organicCtr: '自然CTR',
  organicCpm: '自然流CPM',
  organicCpe: '自然流CPE',
  organicCpc: '自然流CPC',
  // 推广/投流数据
  heatImpNum: '推广曝光量',
  heatReadNum: '推广阅读量',
  heatEngageNum: '投流互动量',
  heatCtr: '投流CTR',
  heatCpm: '投流CPM',
  heatCpe: '投流CPE',
  heatCpc: '投流CPC',
  heatNewTi: '投流新增TI',
  heatCpti: '投流CPTI',
  // 回搜
  searchCount: '回搜数',
  searchRate: '回搜率',
  // 日期
  notePublishDate: '笔记发布日期',
  dataUpdateDate: '数据更新日期',
};

/**
 * 核心字段列定义 — 对应最终版底表规范的核心列
 * 笔记Id、内容形式、内容方向、笔记类型
 */
const CORE_COLUMNS: { key: string; label: string; getValue: (r: ParsedNoteBaseRow) => string }[] = [
  { key: 'noteId', label: '笔记Id', getValue: (r) => r.noteId },
  { key: 'cooperationForm', label: '内容形式', getValue: (r) => r.cooperationForm || '-' },
  { key: 'contentDirection', label: '内容方向', getValue: (r) => r.contentDirection || '-' },
  { key: 'kolType', label: '笔记类型', getValue: (r) => r.kolType || '-' },
];

/** 费用列 — 对应最终版底表规范的费用列 */
const COST_COLUMNS: { key: string; label: string; getValue: (r: ParsedNoteBaseRow) => string }[] = [
  { key: 'contentCost', label: '资源含税成本价', getValue: (r) => formatNum(r.contentCost) },
  { key: 'contentSettlement', label: '资源含税售价', getValue: (r) => formatNum(r.contentSettlement) },
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
