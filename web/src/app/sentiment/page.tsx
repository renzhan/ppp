'use client';

import { Suspense, useMemo, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { Search, Download, FileText, MessageCircle } from 'lucide-react';
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
}

interface SentimentDataItem {
  id: string;
  dataContent: Record<string, unknown>;
  periodStart: string | null;
  periodEnd: string | null;
  createdAt: string;
}

interface SentimentResponse {
  projectId: string;
  sentimentDistribution: SentimentDataItem[];
  trend: SentimentDataItem[];
  keywords: SentimentDataItem[];
  negativeComments: SentimentDataItem[];
}

interface ExportRecord {
  id: string;
  projectId: string;
  exportType: string;
  fileName: string;
  fileUrl: string | null;
  exportedBy: string;
  createdAt: string;
}

const SENTIMENT_COLORS: Record<string, string> = {
  positive: '#22c55e',
  neutral: '#94a3b8',
  negative: '#ef4444',
};

const SENTIMENT_LABELS: Record<string, string> = {
  positive: '正向',
  neutral: '中性',
  negative: '负向',
};

export default function SentimentPage() {
  return (
    <Suspense fallback={<Loading size="lg" text="加载中..." className="py-20" />}>
      <SentimentPageContent />
    </Suspense>
  );
}

function SentimentPageContent() {
  const searchParams = useSearchParams();
  const initialProjectId = searchParams.get('projectId') || '';

  const [filters, setFilters] = useState({
    category: '',
    brand: '',
    businessLine: '',
  });
  const [selectedProjectId, setSelectedProjectId] = useState(initialProjectId);
  const [activeProjectId, setActiveProjectId] = useState(initialProjectId);
  const [showExportRecords, setShowExportRecords] = useState(false);

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

  // Fetch projects for project name selector
  const { data: projectsData } = useQuery<{ items: Project[] }>({
    queryKey: ['projects-for-sentiment', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('pageSize', '200');
      if (filters.category) params.set('category', filters.category);
      if (filters.brand) params.set('brand', filters.brand);
      if (filters.businessLine) params.set('businessLine', filters.businessLine);
      const response = await fetch(`/api/projects?${params.toString()}`);
      if (!response.ok) throw new Error('获取项目列表失败');
      return response.json();
    },
    staleTime: 30_000,
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

  // Fetch sentiment data for active project
  const {
    data: sentimentData,
    isLoading: isSentimentLoading,
    isError: isSentimentError,
    error: sentimentError,
  } = useQuery<SentimentResponse>({
    queryKey: ['sentiment', activeProjectId],
    queryFn: async () => {
      const response = await fetch(`/api/sentiment/${activeProjectId}`);
      if (!response.ok) throw new Error('获取舆情数据失败');
      return response.json();
    },
    enabled: !!activeProjectId,
  });

  // Fetch export records
  const { data: exportRecordsData, refetch: refetchExportRecords } = useQuery<{
    records: ExportRecord[];
  }>({
    queryKey: ['sentiment-export-records', activeProjectId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (activeProjectId) params.set('projectId', activeProjectId);
      const response = await fetch(`/api/sentiment/export-records?${params.toString()}`);
      if (!response.ok) throw new Error('获取导出记录失败');
      return response.json();
    },
    enabled: showExportRecords && !!activeProjectId,
  });

  // Export mutation
  const exportMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/sentiment/${activeProjectId}/export`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('导出失败');
      return response.json();
    },
    onSuccess: (data) => {
      refetchExportRecords();
      if (data.fileUrl) {
        window.open(data.fileUrl, '_blank');
      }
    },
  });

  const handleCategoryChange = (value: string) => {
    setFilters((prev) => ({ ...prev, category: value, brand: '', businessLine: '' }));
    setSelectedProjectId('');
  };

  const handleBrandChange = (value: string) => {
    setFilters((prev) => ({ ...prev, brand: value, businessLine: '' }));
    setSelectedProjectId('');
  };

  const handleBusinessLineChange = (value: string) => {
    setFilters((prev) => ({ ...prev, businessLine: value }));
    setSelectedProjectId('');
  };

  const handleViewSentiment = () => {
    if (selectedProjectId) {
      setActiveProjectId(selectedProjectId);
    }
  };

  // Parse sentiment distribution data for pie chart
  const pieChartData = useMemo(() => {
    if (!sentimentData?.sentimentDistribution?.length) return [];
    const latest = sentimentData.sentimentDistribution[0];
    const content = latest.dataContent as Record<string, number>;
    return Object.entries(content).map(([key, value]) => ({
      name: SENTIMENT_LABELS[key] || key,
      value: value,
      color: SENTIMENT_COLORS[key] || '#94a3b8',
    }));
  }, [sentimentData]);

  // Parse trend data for line chart
  const trendChartData = useMemo(() => {
    if (!sentimentData?.trend?.length) return [];
    return sentimentData.trend.map((item) => {
      const content = item.dataContent as Record<string, unknown>;
      return {
        date: item.periodStart ? formatDate(item.periodStart) : '',
        ...content,
      };
    });
  }, [sentimentData]);

  // Parse keywords data
  const keywordsData = useMemo(() => {
    if (!sentimentData?.keywords?.length) return [];
    const latest = sentimentData.keywords[0];
    const content = latest.dataContent as { keywords?: Array<{ word: string; count: number }> };
    return content.keywords ?? [];
  }, [sentimentData]);

  // Parse negative comments
  const negativeComments = useMemo(() => {
    if (!sentimentData?.negativeComments?.length) return [];
    return sentimentData.negativeComments.map((item) => {
      const content = item.dataContent as { content?: string; source?: string; author?: string; date?: string };
      return {
        id: item.id,
        content: content.content ?? '',
        source: content.source ?? '',
        author: content.author ?? '',
        date: content.date ?? '',
      };
    });
  }, [sentimentData]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">舆情系统</h1>
          <p className="mt-1 text-sm text-slate-500">查看项目评论分析、情感分布和关键词统计。</p>
        </div>
        {activeProjectId && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => exportMutation.mutate()}
              disabled={exportMutation.isPending}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              <Download size={16} />
              {exportMutation.isPending ? '导出中...' : '导出'}
            </button>
            <button
              type="button"
              onClick={() => setShowExportRecords(!showExportRecords)}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <FileText size={16} />
              查看导出记录
            </button>
          </div>
        )}
      </div>

      {/* Filter Bar */}
      <div className="rounded-lg border bg-white p-4">
        <div className="flex flex-wrap items-end gap-3">
          {/* Category */}
          <div className="min-w-[140px]">
            <label className="mb-1 block text-xs font-medium text-slate-600">品类</label>
            <select
              value={filters.category}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="">全部品类</option>
              {(treeData ?? []).map((node) => (
                <option key={node.id} value={node.id}>{node.label}</option>
              ))}
            </select>
          </div>

          {/* Brand */}
          <div className="min-w-[140px]">
            <label className="mb-1 block text-xs font-medium text-slate-600">品牌</label>
            <select
              value={filters.brand}
              onChange={(e) => handleBrandChange(e.target.value)}
              disabled={!filters.category}
              className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50"
            >
              <option value="">全部品牌</option>
              {brandOptions.map((node) => (
                <option key={node.id} value={node.id}>{node.label}</option>
              ))}
            </select>
          </div>

          {/* Business Line */}
          <div className="min-w-[140px]">
            <label className="mb-1 block text-xs font-medium text-slate-600">业务线</label>
            <select
              value={filters.businessLine}
              onChange={(e) => handleBusinessLineChange(e.target.value)}
              disabled={!filters.brand}
              className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50"
            >
              <option value="">全部业务线</option>
              {businessLineOptions.map((node) => (
                <option key={node.id} value={node.id}>{node.label}</option>
              ))}
            </select>
          </div>

          {/* Project Name */}
          <div className="min-w-[180px]">
            <label className="mb-1 block text-xs font-medium text-slate-600">项目名称</label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="">选择项目</option>
              {(projectsData?.items ?? []).map((project) => (
                <option key={project.id} value={project.id}>{project.projectName}</option>
              ))}
            </select>
          </div>

          {/* View Sentiment Button */}
          <button
            type="button"
            onClick={handleViewSentiment}
            disabled={!selectedProjectId}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-violet-600 px-4 text-sm font-medium text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Search size={14} />
            查看舆情
          </button>
        </div>
      </div>

      {/* Export Records Panel */}
      {showExportRecords && (
        <div className="rounded-lg border bg-white p-4">
          <h3 className="mb-3 text-sm font-medium text-slate-900">导出记录</h3>
          {exportRecordsData?.records?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left">
                    <th className="whitespace-nowrap px-3 py-2 font-medium text-slate-600">文件名</th>
                    <th className="whitespace-nowrap px-3 py-2 font-medium text-slate-600">导出时间</th>
                    <th className="whitespace-nowrap px-3 py-2 font-medium text-slate-600">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {exportRecordsData.records.map((record) => (
                    <tr key={record.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 text-slate-700">{record.fileName}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                        {formatDate(record.createdAt)}
                      </td>
                      <td className="px-3 py-2">
                        {record.fileUrl && (
                          <a
                            href={record.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-medium text-blue-600 hover:underline"
                          >
                            下载
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-slate-500">暂无导出记录</p>
          )}
        </div>
      )}

      {/* Export Error */}
      {exportMutation.isError && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">
          {(exportMutation.error as Error).message || '导出失败'}
        </div>
      )}

      {/* Sentiment Data Display */}
      {!activeProjectId ? (
        <div className="rounded-lg border bg-white px-6 py-16 text-center">
          <MessageCircle size={48} className="mx-auto mb-4 text-slate-300" />
          <p className="text-sm text-slate-500">请选择项目并点击"查看舆情"按钮查看舆情数据</p>
        </div>
      ) : isSentimentLoading ? (
        <Loading size="lg" text="正在加载舆情数据..." className="py-20" />
      ) : isSentimentError ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-sm text-rose-600">
          {(sentimentError as Error).message || '获取舆情数据失败'}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Charts Row */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Sentiment Distribution Pie Chart */}
            <div className="rounded-lg border bg-white p-4">
              <h3 className="mb-3 text-sm font-medium text-slate-900">情感倾向分布</h3>
              {pieChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieChartData}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      dataKey="value"
                      nameKey="name"
                      label={({ name, percent }) =>
                        `${name} ${((percent ?? 0) * 100).toFixed(1)}%`
                      }
                    >
                      {pieChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [Number(value).toLocaleString(), '数量']} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[300px] items-center justify-center text-sm text-slate-400">
                  暂无情感分布数据
                </div>
              )}
            </div>

            {/* Comment Trend Line Chart */}
            <div className="rounded-lg border bg-white p-4">
              <h3 className="mb-3 text-sm font-medium text-slate-900">评论数变化趋势</h3>
              {trendChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={trendChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="count"
                      name="评论数"
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[300px] items-center justify-center text-sm text-slate-400">
                  暂无趋势数据
                </div>
              )}
            </div>
          </div>

          {/* Keywords Section */}
          <div className="rounded-lg border bg-white p-4">
            <h3 className="mb-3 text-sm font-medium text-slate-900">关键词高频分布</h3>
            {keywordsData.length > 0 ? (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Tag Cloud */}
                <div>
                  <h4 className="mb-2 text-xs font-medium text-slate-600">关键词云</h4>
                  <div className="flex flex-wrap gap-2 rounded-md border border-slate-100 bg-slate-50 p-4">
                    {keywordsData.map((kw, idx) => {
                      const maxCount = Math.max(...keywordsData.map((k) => k.count));
                      const minSize = 12;
                      const maxSize = 28;
                      const size = maxCount > 0
                        ? minSize + ((kw.count / maxCount) * (maxSize - minSize))
                        : minSize;
                      return (
                        <span
                          key={idx}
                          className="inline-block text-violet-700"
                          style={{ fontSize: `${size}px` }}
                        >
                          {kw.word}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* Keyword Frequency Table */}
                <div>
                  <h4 className="mb-2 text-xs font-medium text-slate-600">关键词频次</h4>
                  <div className="max-h-[300px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-slate-50 text-left">
                          <th className="px-3 py-2 font-medium text-slate-600">排名</th>
                          <th className="px-3 py-2 font-medium text-slate-600">关键词</th>
                          <th className="px-3 py-2 font-medium text-slate-600">频次</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {keywordsData.map((kw, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="px-3 py-2 text-slate-500">{idx + 1}</td>
                            <td className="px-3 py-2 text-slate-900">{kw.word}</td>
                            <td className="px-3 py-2 text-slate-700">{kw.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-slate-400">暂无关键词数据</p>
            )}
          </div>

          {/* Negative Comments List */}
          <div className="rounded-lg border bg-white p-4">
            <h3 className="mb-3 text-sm font-medium text-slate-900">负向评论列表</h3>
            {negativeComments.length > 0 ? (
              <div className="space-y-3">
                {negativeComments.map((comment) => (
                  <div
                    key={comment.id}
                    className="rounded-md border border-rose-100 bg-rose-50/50 p-3"
                  >
                    <p className="text-sm text-slate-800">{comment.content}</p>
                    <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                      {comment.source && <span>来源: {comment.source}</span>}
                      {comment.author && <span>作者: {comment.author}</span>}
                      {comment.date && <span>时间: {comment.date}</span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-slate-400">暂无负向评论数据</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
