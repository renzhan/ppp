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
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { Search, Download, FileText, MessageCircle, ChevronLeft, ChevronRight } from 'lucide-react';
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
  comments: SentimentDataItem[];
}

interface CommentItem {
  id: string;
  content: string;
  author: string;
  date: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  likes: number;
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

const SENTIMENT_TAB_COLORS: Record<string, string> = {
  positive: 'text-green-600 border-green-600',
  neutral: 'text-slate-600 border-slate-600',
  negative: 'text-red-600 border-red-600',
};

const PAGE_SIZE = 10;

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
  const [commentFilter, setCommentFilter] = useState<'all' | 'positive' | 'negative' | 'neutral'>('all');
  const [commentPage, setCommentPage] = useState(1);

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
      const data = await response.json();
      console.log('[SentimentPage] API 返回数据:', {
        keys: Object.keys(data),
        trend: data.trend?.length ?? 'undefined',
        keywords: data.keywords?.length ?? 'undefined',
        comments: data.comments?.length ?? 'undefined',
        negativeComments: data.negativeComments?.length ?? 'undefined',
        sentimentDistribution: data.sentimentDistribution?.length ?? 'undefined',
      });
      if (data.trend?.length > 0) {
        console.log('[SentimentPage] trend[0]:', data.trend[0]);
      }
      if (data.keywords?.length > 0) {
        console.log('[SentimentPage] keywords[0].dataContent:', data.keywords[0].dataContent);
      }
      return data;
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
      setCommentFilter('all');
      setCommentPage(1);
    }
  };

  // Parse sentiment distribution data for pie chart (donut style with counts in legend)
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

  // Parse trend data for bar chart
  const trendChartData = useMemo(() => {
    if (!sentimentData?.trend?.length) {
      console.log('[SentimentPage] trend 数据为空, sentimentData.trend =', sentimentData?.trend);
      return [];
    }
    console.log('[SentimentPage] trend 原始数据条数:', sentimentData.trend.length, '前3条:', sentimentData.trend.slice(0, 3));
    const result = sentimentData.trend
      .filter((item) => item.periodStart)
      .sort((a, b) => (a.periodStart! > b.periodStart! ? 1 : -1))
      .map((item) => {
        const content = item.dataContent as Record<string, unknown>;
        return {
          date: item.periodStart ? formatDate(item.periodStart) : '',
          count: Number(content.count ?? 0),
          positive: Number(content.positive ?? 0),
          neutral: Number(content.neutral ?? 0),
          negative: Number(content.negative ?? 0),
        };
      });
    console.log('[SentimentPage] trend 处理后:', result.length, '条, 前3条:', result.slice(0, 3));
    return result;
  }, [sentimentData]);

  // Parse keywords data
  const keywordsData = useMemo(() => {
    if (!sentimentData?.keywords?.length) return [];
    const latest = sentimentData.keywords[0];
    const content = latest.dataContent as { keywords?: Array<{ word: string; count: number }> };
    return content.keywords ?? [];
  }, [sentimentData]);

  // Total keyword count for frequency calculation
  const totalKeywordCount = useMemo(() => {
    return keywordsData.reduce((sum, kw) => sum + kw.count, 0);
  }, [keywordsData]);

  // Parse all comments
  const allComments = useMemo((): CommentItem[] => {
    if (!sentimentData?.comments?.length) return [];
    return sentimentData.comments.map((item) => {
      const content = item.dataContent as {
        content?: string;
        author?: string;
        date?: string;
        sentiment?: string;
        likes?: number;
      };
      return {
        id: item.id,
        content: content.content ?? '',
        author: content.author ?? '匿名用户',
        date: content.date ?? '',
        sentiment: (content.sentiment as CommentItem['sentiment']) ?? 'neutral',
        likes: content.likes ?? 0,
      };
    });
  }, [sentimentData]);

  // Filtered and paginated comments
  const filteredComments = useMemo(() => {
    if (commentFilter === 'all') return allComments;
    return allComments.filter((c) => c.sentiment === commentFilter);
  }, [allComments, commentFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredComments.length / PAGE_SIZE));
  const paginatedComments = useMemo(() => {
    const start = (commentPage - 1) * PAGE_SIZE;
    return filteredComments.slice(start, start + PAGE_SIZE);
  }, [filteredComments, commentPage]);

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
                      <td className="whitespace-nowrap px-3 py-2 text-slate-700">{formatDate(record.createdAt)}</td>
                      <td className="px-3 py-2">
                        {record.fileUrl && (
                          <a href={record.fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-blue-600 hover:underline">下载</a>
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
          {/* Row 1: Pie Chart + Bar Chart */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Sentiment Distribution - Donut Chart */}
            <div className="rounded-lg border bg-white p-4">
              <h3 className="mb-3 text-sm font-medium text-slate-900">情感倾向分布</h3>
              {pieChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={pieChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      dataKey="value"
                      nameKey="name"
                    >
                      {pieChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [Number(value).toLocaleString(), '数量']} />
                    <Legend
                      formatter={(value, entry) => {
                        const item = pieChartData.find((d) => d.name === value);
                        return `${value} ${item?.value ?? 0}`;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[280px] items-center justify-center text-sm text-slate-400">暂无情感分布数据</div>
              )}
            </div>

            {/* Comment Trend - Bar Chart */}
            <div className="rounded-lg border bg-white p-4">
              <h3 className="mb-3 text-sm font-medium text-slate-900">评论数变化趋势</h3>
              {trendChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={trendChartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" height={50} />
                    <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" name="评论数" fill="#8b5cf6" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[280px] items-center justify-center text-sm text-slate-400">暂无趋势数据</div>
              )}
            </div>
          </div>

          {/* Row 2: Keywords */}
          <div className="rounded-lg border bg-white p-4">
            <h3 className="mb-3 text-sm font-medium text-slate-900">关键词高频分布统计</h3>
            {keywordsData.length > 0 ? (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Word Cloud */}
                <div>
                  <h4 className="mb-2 text-xs font-medium text-slate-600">关键词云</h4>
                  <div className="flex min-h-[200px] flex-wrap items-center justify-center gap-x-3 gap-y-2 rounded-md border border-slate-100 bg-slate-50 p-6">
                    {keywordsData.map((kw, idx) => {
                      const maxCount = keywordsData[0]?.count || 1;
                      const ratio = kw.count / maxCount;
                      // 更大的字体差异：14px ~ 42px
                      const size = 14 + ratio * 28;
                      // 颜色深浅：频次越高颜色越深
                      const opacity = 0.4 + ratio * 0.6;
                      return (
                        <span
                          key={idx}
                          className="inline-block font-medium"
                          style={{
                            fontSize: `${size}px`,
                            color: `rgba(79, 70, 229, ${opacity})`,
                          }}
                        >
                          {kw.word}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* Keyword Frequency Table with frequency rate */}
                <div>
                  <h4 className="mb-2 text-xs font-medium text-slate-600">高频词指数</h4>
                  <div className="max-h-[320px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0">
                        <tr className="border-b bg-slate-50 text-left">
                          <th className="px-3 py-2 font-medium text-slate-600">关键词</th>
                          <th className="px-3 py-2 font-medium text-slate-600">数量</th>
                          <th className="px-3 py-2 font-medium text-slate-600">频率</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {keywordsData.map((kw, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="px-3 py-2 text-slate-900">{kw.word}</td>
                            <td className="px-3 py-2 text-slate-700">{kw.count}</td>
                            <td className="px-3 py-2 text-slate-500">
                              {totalKeywordCount > 0 ? ((kw.count / totalKeywordCount) * 100).toFixed(2) + '%' : '-'}
                            </td>
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

          {/* Row 3: Comments List with tabs and pagination */}
          <div className="rounded-lg border bg-white p-4">
            <h3 className="mb-3 text-sm font-medium text-slate-900">评论文本</h3>

            {/* Tabs */}
            <div className="mb-4 flex gap-1 border-b border-slate-200">
              {(['all', 'positive', 'negative', 'neutral'] as const).map((tab) => {
                const label = tab === 'all' ? '全部' : SENTIMENT_LABELS[tab];
                const count = tab === 'all'
                  ? allComments.length
                  : allComments.filter((c) => c.sentiment === tab).length;
                const isActive = commentFilter === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => { setCommentFilter(tab); setCommentPage(1); }}
                    className={`px-4 py-2 text-sm font-medium transition border-b-2 -mb-px ${
                      isActive
                        ? (tab === 'all' ? 'text-blue-600 border-blue-600' : SENTIMENT_TAB_COLORS[tab])
                        : 'text-slate-500 border-transparent hover:text-slate-700'
                    }`}
                  >
                    {label} ({count})
                  </button>
                );
              })}
            </div>

            {/* Comments Table */}
            {paginatedComments.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-slate-50 text-left">
                        <th className="whitespace-nowrap px-3 py-2 font-medium text-slate-600">时间</th>
                        <th className="px-3 py-2 font-medium text-slate-600">描述</th>
                        <th className="whitespace-nowrap px-3 py-2 font-medium text-slate-600">情感倾向</th>
                        <th className="whitespace-nowrap px-3 py-2 text-right font-medium text-slate-600">评论点赞数量</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {paginatedComments.map((comment) => (
                        <tr key={comment.id} className="hover:bg-slate-50">
                          <td className="whitespace-nowrap px-3 py-3 text-sm text-blue-600">{comment.date || '-'}</td>
                          <td className="max-w-[400px] px-3 py-3 text-sm text-slate-800">{comment.content}</td>
                          <td className="whitespace-nowrap px-3 py-3">
                            <span
                              className="text-sm"
                              style={{ color: SENTIMENT_COLORS[comment.sentiment] }}
                            >
                              {SENTIMENT_LABELS[comment.sentiment]}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-right text-sm text-slate-700">{comment.likes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-4 flex items-center justify-between border-t pt-3">
                    <span className="text-xs text-slate-500">
                      共 {filteredComments.length} 条，每页 {PAGE_SIZE} 条
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setCommentPage((p) => Math.max(1, p - 1))}
                        disabled={commentPage <= 1}
                        className="inline-flex h-8 w-8 items-center justify-center rounded border text-slate-600 transition hover:bg-slate-50 disabled:opacity-30"
                      >
                        <ChevronLeft size={14} />
                      </button>
                      {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                        let page: number;
                        if (totalPages <= 7) {
                          page = i + 1;
                        } else if (commentPage <= 4) {
                          page = i + 1;
                        } else if (commentPage >= totalPages - 3) {
                          page = totalPages - 6 + i;
                        } else {
                          page = commentPage - 3 + i;
                        }
                        return (
                          <button
                            key={page}
                            type="button"
                            onClick={() => setCommentPage(page)}
                            className={`inline-flex h-8 w-8 items-center justify-center rounded text-sm transition ${
                              page === commentPage
                                ? 'bg-blue-600 text-white'
                                : 'border text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            {page}
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => setCommentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={commentPage >= totalPages}
                        className="inline-flex h-8 w-8 items-center justify-center rounded border text-slate-600 transition hover:bg-slate-50 disabled:opacity-30"
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="py-8 text-center text-sm text-slate-400">暂无评论数据</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
