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
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  listEmptyClass,
  listErrorClass,
  listTableHeadClass,
  listTableHeaderRowClass,
  listTableRowClass,
  listTableWrapperClass,
} from '@/components/ui/data-list';
import { FilterField } from '@/components/ui/filter-field';
import { Loading } from '@/components/ui/loading';
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
import { WordCloud } from '@/components/ui/word-cloud';
import { formatDate } from '@/lib/project-meta';
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
    if (!sentimentData?.trend?.length) return [];
    return sentimentData.trend
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

  const headerActions = activeProjectId ? (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="primary"
        size="sm"
        className="gap-1.5"
        onClick={() => exportMutation.mutate()}
        disabled={exportMutation.isPending}
      >
        <Download size={16} />
        {exportMutation.isPending ? '导出中...' : '导出'}
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="gap-1.5"
        onClick={() => setShowExportRecords(!showExportRecords)}
      >
        <FileText size={16} />
        查看导出记录
      </Button>
    </div>
  ) : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="舆情系统"
        description="查看项目评论分析、情感分布和关键词统计。"
        actions={headerActions}
      />



          <div className="flex  justify-between">
            <div className='flex flex-wrap items-end gap-4'>
            <FilterField label="品类：" className="min-w-[140px] flex-1 sm:max-w-[200px]">
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
            <FilterField label="品牌：" className="min-w-[180px] flex-1 sm:max-w-[200px]">
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
            <FilterField label="品牌业务线：" className="min-w-[220px] flex-1 sm:max-w-[200px]">
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
            <FilterField label="项目名称：" className="min-w-[180px] flex-[2] sm:max-w-[280px]">
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
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
            </div>
            <Button
              type="button"
              variant="primary"
              size="sm"
              className="mb-0.5 shrink-0 gap-1.5"
              onClick={handleViewSentiment}
              disabled={!selectedProjectId}
            >
              <Search size={14} />
              查看舆情
            </Button>
          </div>

   

      {showExportRecords && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">导出记录</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {exportRecordsData?.records?.length ? (
              <div className={listTableWrapperClass}>
                <Table className="text-sm">
                  <TableHeader>
                    <TableRow className={listTableHeaderRowClass}>
                      <TableHead className={listTableHeadClass}>文件名</TableHead>
                      <TableHead className={listTableHeadClass}>导出时间</TableHead>
                      <TableHead className={listTableHeadClass}>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {exportRecordsData.records.map((record, index) => (
                      <TableRow key={record.id} className={listTableRowClass(index)}>
                        <TableCell className="py-2.5">{record.fileName}</TableCell>
                        <TableCell className="whitespace-nowrap py-2.5">
                          {formatDate(record.createdAt)}
                        </TableCell>
                        <TableCell className="py-2.5">
                          {record.fileUrl && (
                            <Button variant="text-link" size="sm" className="h-auto p-0 text-xs" asChild>
                              <a href={record.fileUrl} target="_blank" rel="noopener noreferrer">
                                下载
                              </a>
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-sm text-gray-500">暂无导出记录</p>
            )}
          </CardContent>
        </Card>
      )}

      {exportMutation.isError && (
        <div className={listErrorClass}>
          {(exportMutation.error as Error).message || '导出失败'}
        </div>
      )}

      {!activeProjectId ? (
        <Card>
          <CardContent className={cn(listEmptyClass, 'border-0 shadow-none')}>
            <MessageCircle size={48} className="mx-auto mb-4 text-gray-300" />
            请选择项目并点击「查看舆情」按钮查看舆情数据
          </CardContent>
        </Card>
      ) : isSentimentLoading ? (
        <Loading size="lg" text="正在加载舆情数据..." className="py-20" />
      ) : isSentimentError ? (
        <div className={listErrorClass}>
          {(sentimentError as Error).message || '获取舆情数据失败'}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">情感倾向分布</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
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
                <div className="flex h-[280px] items-center justify-center text-sm text-gray-400">暂无情感分布数据</div>
              )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">评论数变化趋势</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
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
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">关键词高频分布统计</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
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
                  <div className={cn(listTableWrapperClass, 'max-h-[320px] overflow-y-auto')}>
                    <Table className="text-sm">
                      <TableHeader className="sticky top-0 z-10">
                        <TableRow className={listTableHeaderRowClass}>
                          <TableHead className={listTableHeadClass}>关键词</TableHead>
                          <TableHead className={listTableHeadClass}>数量</TableHead>
                          <TableHead className={listTableHeadClass}>频率</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {keywordsData.map((kw, idx) => (
                          <TableRow key={idx} className={listTableRowClass(idx)}>
                            <TableCell className="py-2">{kw.word}</TableCell>
                            <TableCell className="py-2">{kw.count}</TableCell>
                            <TableCell className="py-2 text-gray-500">
                              {totalKeywordCount > 0
                                ? `${((kw.count / totalKeywordCount) * 100).toFixed(2)}%`
                                : '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-gray-400">暂无关键词数据</p>
            )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">评论文本</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="mb-4 flex gap-1 border-b border-gray-200">
                {(['all', 'positive', 'negative', 'neutral'] as const).map((tab) => {
                  const label = tab === 'all' ? '全部' : SENTIMENT_LABELS[tab];
                  const count =
                    tab === 'all'
                      ? allComments.length
                      : allComments.filter((c) => c.sentiment === tab).length;
                  const isActive = commentFilter === tab;
                  return (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => {
                        setCommentFilter(tab);
                        setCommentPage(1);
                      }}
                      className={cn(
                        '-mb-px border-b-2 px-4 py-2 text-sm font-medium transition',
                        isActive
                          ? tab === 'all'
                            ? 'border-brand text-brand'
                            : SENTIMENT_TAB_COLORS[tab]
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      )}
                    >
                      {label} ({count})
                    </button>
                  );
                })}
              </div>

              {paginatedComments.length > 0 ? (
                <>
                  <div className={listTableWrapperClass}>
                    <Table className="min-w-[640px] text-sm">
                      <TableHeader>
                        <TableRow className={listTableHeaderRowClass}>
                          <TableHead className={listTableHeadClass}>时间</TableHead>
                          <TableHead className={listTableHeadClass}>描述</TableHead>
                          <TableHead className={listTableHeadClass}>情感倾向</TableHead>
                          <TableHead className={cn(listTableHeadClass, 'text-right')}>
                            评论点赞数量
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedComments.map((comment, index) => (
                          <TableRow key={comment.id} className={listTableRowClass(index)}>
                            <TableCell className="whitespace-nowrap py-3 text-brand">
                              {comment.date || '-'}
                            </TableCell>
                            <TableCell className="max-w-[400px] py-3">{comment.content}</TableCell>
                            <TableCell className="whitespace-nowrap py-3">
                              <Badge
                                variant="outline"
                                className="border-transparent bg-transparent font-normal"
                                style={{ color: SENTIMENT_COLORS[comment.sentiment] }}
                              >
                                {SENTIMENT_LABELS[comment.sentiment]}
                              </Badge>
                            </TableCell>
                            <TableCell className="whitespace-nowrap py-3 text-right">
                              {comment.likes}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {totalPages > 1 && (
                    <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
                      <span className="text-xs text-gray-500">
                        共 {filteredComments.length} 条，每页 {PAGE_SIZE} 条
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          onClick={() => setCommentPage((p) => Math.max(1, p - 1))}
                          disabled={commentPage <= 1}
                          aria-label="上一页"
                        >
                          <ChevronLeft size={14} />
                        </Button>
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
                            <Button
                              key={page}
                              type="button"
                              variant={page === commentPage ? 'primary' : 'outline'}
                              size="icon-sm"
                              onClick={() => setCommentPage(page)}
                              className="text-sm"
                            >
                              {page}
                            </Button>
                          );
                        })}
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          onClick={() => setCommentPage((p) => Math.min(totalPages, p + 1))}
                          disabled={commentPage >= totalPages}
                          aria-label="下一页"
                        >
                          <ChevronRight size={14} />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="py-8 text-center text-sm text-gray-400">暂无评论数据</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
