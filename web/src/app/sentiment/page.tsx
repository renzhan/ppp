'use client';

import { Suspense, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { Search, MessageCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { Loading } from '@/components/ui/loading';
import { WordCloud } from '@/components/ui/word-cloud';
import { Button } from '@/components/ui/button';
import { FilterField } from '@/components/ui/filter-field';
import { CardFooter } from '@/components/ui/card';
import {
  listTableCellClass,
  listTableHeadClass,
  listTableHeaderRowClass,
  listTableRowClass,
  listTableWrapperClass,
} from '@/components/ui/data-list';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDate } from '@/lib/project-meta';
import { generatePageNumbers } from '@/lib/pagination';
import { cn } from '@/lib/utils';

const selectTriggerClass =
  'h-9 rounded border-gray-200 bg-white text-gray-900 focus-visible:ring-brand/25 disabled:bg-gray-50 disabled:text-gray-400';

interface TreeNode {
  id: string;
  label: string;
  children?: TreeNode[];
}

interface Project {
  id: string;
  projectName: string;
  category: string;
  brand: string;
  businessLine?: string | null;
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
  neutral: 'text-gray-600 border-gray-600',
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

  const handleProjectChange = (projectId: string) => {
    setSelectedProjectId(projectId);
    // Sync left-side filters (品类、品牌、业务线) based on selected project
    if (projectId && projectsData?.items) {
      const project = projectsData.items.find((p) => p.id === projectId);
      if (project) {
        setFilters({
          category: project.category || '',
          brand: project.brand || '',
          businessLine: project.businessLine || '',
        });
      }
    }
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

  const pieChartTotal = useMemo(
    () => pieChartData.reduce((sum, item) => sum + item.value, 0),
    [pieChartData]
  );

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
      <div>
        <h1 className="text-2xl tracking-tight text-gray-900">舆情系统</h1>
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <FilterField label="品类：">
          <Select value={filters.category} onValueChange={handleCategoryChange}>
            <SelectTrigger className={selectTriggerClass} />
            <SelectContent>
              <SelectItem value="">请选择</SelectItem>
              {(treeData ?? []).map((node) => (
                <SelectItem key={node.id} value={node.id}>
                  {node.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label="品牌：">
          <Select
            value={filters.brand}
            onValueChange={handleBrandChange}
            disabled={!filters.category}
          >
            <SelectTrigger className={selectTriggerClass} />
            <SelectContent>
              <SelectItem value="">请选择</SelectItem>
              {brandOptions.map((node) => (
                <SelectItem key={node.id} value={node.id}>
                  {node.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label="业务线：">
          <Select
            value={filters.businessLine}
            onValueChange={handleBusinessLineChange}
            disabled={!filters.brand}
          >
            <SelectTrigger className={selectTriggerClass} />
            <SelectContent>
              <SelectItem value="">请选择</SelectItem>
              {businessLineOptions.map((node) => (
                <SelectItem key={node.id} value={node.id}>
                  {node.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label="项目名称：">
          <Select value={selectedProjectId} onValueChange={handleProjectChange}>
            <SelectTrigger className={selectTriggerClass} />
            <SelectContent>
              <SelectItem value="">请选择</SelectItem>
              {(projectsData?.items ?? []).map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.projectName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        <div className="flex min-w-0 items-center">
          <Button
            type="button"
            variant="primary"
            size="sm"
            className="w-full shrink-0 gap-1 px-4"
            onClick={handleViewSentiment}
            disabled={!selectedProjectId}
          >
            <Search size={16} />
            查看舆情
          </Button>
        </div>
      </div>

      {/* Sentiment Data Display */}
      {!activeProjectId ? (
        <div className="rounded-lg border bg-white px-6 py-16 text-center">
          <MessageCircle size={48} className="mx-auto mb-4 text-gray-300" />
          <p className="text-sm text-gray-500">请选择项目并点击"查看舆情"按钮查看舆情数据</p>
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
              <h3 className="mb-3 text-sm font-medium text-gray-900">情感倾向分布</h3>
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
                      formatter={(value) => {
                        const item = pieChartData.find((d) => d.name === value);
                        const count = item?.value ?? 0;
                        const pct =
                          pieChartTotal > 0
                            ? ((count / pieChartTotal) * 100).toFixed(1)
                            : '0.0';
                        return `${value} ${count} (${pct}%)`;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[280px] items-center justify-center text-sm text-gray-400">暂无情感分布数据</div>
              )}
            </div>

            {/* Comment Trend - Bar Chart */}
            <div className="rounded-lg border bg-white p-4">
              <h3 className="mb-3 text-sm font-medium text-gray-900">评论数变化趋势</h3>
              {trendChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={trendChartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" height={50} />
                    <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" name="评论数" fill="#F5A623" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[280px] items-center justify-center text-sm text-gray-400">暂无趋势数据</div>
              )}
            </div>
          </div>

          {/* Row 2: Keywords */}
          <div className="rounded-lg border bg-white p-4">
            <h3 className="mb-3 text-sm font-medium text-gray-900">关键词高频分布统计</h3>
            {keywordsData.length > 0 ? (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Word Cloud */}
                <div>
                  <h4 className="mb-2 text-xs font-medium text-gray-600">关键词云</h4>
                  <div className="h-[320px] rounded-md border border-gray-100 bg-gray-50">
                    <WordCloud words={keywordsData} />
                  </div>
                </div>

                {/* Keyword Frequency Table with frequency rate */}
                <div>
                  <h4 className="mb-2 text-xs font-medium text-gray-600">高频词指数</h4>
                  <div className="max-h-[320px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0">
                        <tr className="border-b bg-gray-50 text-left">
                          <th className="px-3 py-2 font-medium text-gray-600">关键词</th>
                          <th className="px-3 py-2 font-medium text-gray-600">数量</th>
                          <th className="px-3 py-2 font-medium text-gray-600">频率</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {keywordsData.map((kw, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-900">{kw.word}</td>
                            <td className="px-3 py-2 text-gray-700">{kw.count}</td>
                            <td className="px-3 py-2 text-gray-500">
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
              <p className="py-8 text-center text-sm text-gray-400">暂无关键词数据</p>
            )}
          </div>

          {/* Row 3: Comments List with tabs and pagination */}
          <div className="rounded-lg border bg-white p-4">
            <h3 className="mb-3 text-sm font-medium text-gray-900">评论文本</h3>

            {/* Tabs */}
            <div className="mb-4 flex gap-1 border-b border-gray-200">
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
                        ? (tab === 'all' ? 'text-gray-900 border-gray-900' : SENTIMENT_TAB_COLORS[tab])
                        : 'text-gray-500 border-transparent hover:text-gray-700'
                    }`}
                  >
                    {label} ({count})
                  </button>
                );
              })}
            </div>

            {/* Comments Table */}
            {filteredComments.length > 0 ? (
              <>
                <div className={cn('overflow-x-auto', listTableWrapperClass)}>
                  <Table>
                    <TableHeader>
                      <TableRow className={listTableHeaderRowClass}>
                        <TableHead className={listTableHeadClass}>情感倾向</TableHead>
                        <TableHead className={listTableHeadClass}>评论内容</TableHead>
                        <TableHead className={listTableHeadClass}>发布者</TableHead>
                        <TableHead className={listTableHeadClass}>发布时间</TableHead>
                        <TableHead className={listTableHeadClass}>评论点赞数</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedComments.map((comment, index) => (
                        <TableRow key={comment.id} className={listTableRowClass(index)}>
                          <TableCell className={cn(listTableCellClass, 'whitespace-nowrap')}>
                            <span
                              className="text-sm"
                              style={{ color: SENTIMENT_COLORS[comment.sentiment] }}
                            >
                              {SENTIMENT_LABELS[comment.sentiment]}
                            </span>
                          </TableCell>
                          <TableCell className={cn(listTableCellClass, 'max-w-[400px]')}>
                            {comment.content}
                          </TableCell>
                          <TableCell className={cn(listTableCellClass, 'whitespace-nowrap')}>
                            {comment.author}
                          </TableCell>
                          <TableCell className={cn(listTableCellClass, 'whitespace-nowrap text-gray-800')}>
                            {comment.date || '-'}
                          </TableCell>
                          <TableCell className={cn(listTableCellClass, 'whitespace-nowrap')}>
                            {comment.likes}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <CardFooter className="flex flex-wrap items-center justify-between gap-3 px-0 pb-0 pt-4">
                  <p className="text-sm text-gray-500">
                    共 {filteredComments.length} 条记录，第 {commentPage}/{totalPages} 页
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      onClick={() => setCommentPage((p) => Math.max(1, p - 1))}
                      disabled={commentPage <= 1}
                    >
                      <ChevronLeft size={16} />
                    </Button>
                    {generatePageNumbers(commentPage, totalPages).map((p, idx) =>
                      p === '...' ? (
                        <span key={`ellipsis-${idx}`} className="px-1 text-gray-400">
                          ...
                        </span>
                      ) : (
                        <Button
                          key={p}
                          type="button"
                          variant={commentPage === p ? 'primary' : 'outline'}
                          size="icon-sm"
                          onClick={() => setCommentPage(p as number)}
                          className={cn('text-sm', commentPage === p && 'pointer-events-none')}
                        >
                          {p}
                        </Button>
                      )
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      onClick={() => setCommentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={commentPage >= totalPages}
                    >
                      <ChevronRight size={16} />
                    </Button>
                  </div>
                </CardFooter>
              </>
            ) : (
              <p className="py-8 text-center text-sm text-gray-400">暂无评论数据</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
