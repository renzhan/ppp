'use client';

import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft, Download, BookOpen } from 'lucide-react';
import { Loading } from '@/components/ui/loading';
import { formatDate } from '@/lib/project-meta';
import { REPORT_MODULE_KEYS } from '@/lib/module-toggle';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ReviewDetail {
  id: string;
  projectId: string;
  status: string;
  benchmark: Record<string, number | null>;
  influencerTiers: Array<{ id: string; name: string; fanRangeMin: number; fanRangeMax: number }>;
  kpiTargets: Record<string, number | null>;
  engagementMetric: string;
  viralMetric: string;
  modules: Record<string, boolean>;
  launchPhases: Array<{ id: string; name: string; startDate: string; endDate: string }>;
  planFileUrl: string | null;
  planFileName: string | null;
  reportContent: unknown;
  createdAt: string;
  updatedAt: string;
  project: {
    id: string;
    projectName: string;
    category: string;
    brand: string;
    businessLine: string | null;
  };
}

interface ReportContent {
  id: string;
  reportContent: unknown;
}

// ─── Module Labels ───────────────────────────────────────────────────────────

const MODULE_LABELS: Record<string, string> = {
  projectReview: '项目回顾',
  dataOverview: '数据总揽',
  highlights: '项目亮点',
  comprehensiveAnalysis: '综合分析',
  contentAnalysis: '内容分析（笔记侧）',
  audienceAnalysis: '人群资产分析',
  launchAnalysis: '投流分析',
  competitorAnalysis: '竞对分析',
  optimization: '优化建议',
};

const BENCHMARK_LABELS: Record<string, string> = {
  ctr: 'CTR (%)',
  cpm: 'CPM',
  cpc: 'CPC',
  cpe: 'CPE',
  engagementRate: '互动率 (%)',
};

const KPI_LABELS: Record<string, string> = {
  totalImpression: '总曝光',
  totalRead: '总阅读',
  totalEngagement: '总互动',
  viralPosts1k: '千爆文数',
  viralPosts10k: '万爆文数',
  cpm: 'CPM',
  cpc: 'CPC',
  cpe: 'CPE',
  ctr: 'CTR (%)',
  searchIndex: '搜索指数',
  socSov: 'SOC/SOV',
  audienceBrandTotal: '人群资产-总-品牌',
  audienceSpuTotal: '人群资产-总-SPU',
  audienceBrandTi: '人群资产-TI-品牌',
  audienceSpuTi: '人群资产-TI-SPU',
};

// ─── Page Component ──────────────────────────────────────────────────────────

export default function ReviewDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const { data: review, isLoading, isError, error } = useQuery<ReviewDetail>({
    queryKey: ['review', id],
    queryFn: async () => {
      const res = await fetch(`/api/reviews/${id}`);
      if (!res.ok) throw new Error('获取复盘详情失败');
      return res.json();
    },
  });

  const { data: reportData } = useQuery<ReportContent>({
    queryKey: ['review-report', id],
    queryFn: async () => {
      const res = await fetch(`/api/reviews/${id}/report`);
      if (!res.ok) throw new Error('获取报告内容失败');
      return res.json();
    },
    enabled: !!review,
  });

  if (isLoading) {
    return <Loading size="lg" text="正在加载复盘详情..." className="py-20" />;
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-sm text-rose-600">
        {(error as Error).message || '获取复盘详情失败'}
      </div>
    );
  }

  if (!review) return null;

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/review"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition hover:bg-slate-50"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">复盘详情</h1>
            <p className="mt-0.5 text-sm text-slate-500">{review.project.projectName}</p>
          </div>
        </div>
        <Link
          href={`/review/${id}/proofread`}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          <BookOpen size={14} />
          进入审校台
        </Link>
      </div>

      {/* Section: 项目信息 */}
      <DetailSection title="项目信息">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <InfoItem label="品类" value={review.project.category || '-'} />
          <InfoItem label="品牌" value={review.project.brand || '-'} />
          <InfoItem label="业务线" value={review.project.businessLine || '-'} />
          <InfoItem label="项目名称" value={review.project.projectName} />
        </div>
      </DetailSection>

      {/* Section: 大盘数据 */}
      <DetailSection title="复盘背景（大盘数据）">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {Object.entries(BENCHMARK_LABELS).map(([key, label]) => (
            <InfoItem
              key={key}
              label={label}
              value={review.benchmark?.[key] != null ? String(review.benchmark[key]) : '-'}
            />
          ))}
        </div>
      </DetailSection>

      {/* Section: KPI配置 */}
      <DetailSection title="复盘目标（KPI）">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {Object.entries(KPI_LABELS).map(([key, label]) => (
            <InfoItem
              key={key}
              label={label}
              value={review.kpiTargets?.[key] != null ? String(review.kpiTargets[key]) : '-'}
            />
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <InfoItem
            label="互动统计口径"
            value={review.engagementMetric === 'include_follow' ? '含关注' : '不含关注'}
          />
          <InfoItem
            label="爆文统计口径"
            value={review.viralMetric === 'like_only' ? '赞' : '转评赞'}
          />
        </div>
      </DetailSection>

      {/* Section: 达人层级 */}
      {review.influencerTiers && review.influencerTiers.length > 0 && (
        <DetailSection title="达人层级配置">
          <div className="overflow-hidden rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="px-4 py-2 text-left font-medium text-slate-600">层级名称</th>
                  <th className="px-4 py-2 text-left font-medium text-slate-600">粉丝范围</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {review.influencerTiers.map((tier) => (
                  <tr key={tier.id}>
                    <td className="px-4 py-2 text-slate-700">{tier.name}</td>
                    <td className="px-4 py-2 text-slate-700">
                      {tier.fanRangeMin.toLocaleString()} - {tier.fanRangeMax.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DetailSection>
      )}

      {/* Section: 报告模块开关 */}
      <DetailSection title="报告模块配置">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {REPORT_MODULE_KEYS.map((key) => {
            const enabled = review.modules?.[key] ?? false;
            return (
              <div
                key={key}
                className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                  enabled
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 bg-slate-50 text-slate-400'
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${enabled ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                {MODULE_LABELS[key] || key}
              </div>
            );
          })}
        </div>
      </DetailSection>

      {/* Section: 投流周期 */}
      {review.launchPhases && review.launchPhases.length > 0 && (
        <DetailSection title="投流周期配置">
          <div className="overflow-hidden rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="px-4 py-2 text-left font-medium text-slate-600">阶段名称</th>
                  <th className="px-4 py-2 text-left font-medium text-slate-600">开始日期</th>
                  <th className="px-4 py-2 text-left font-medium text-slate-600">结束日期</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {review.launchPhases.map((phase) => (
                  <tr key={phase.id}>
                    <td className="px-4 py-2 text-slate-700">{phase.name}</td>
                    <td className="px-4 py-2 text-slate-700">{formatDate(phase.startDate)}</td>
                    <td className="px-4 py-2 text-slate-700">{formatDate(phase.endDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DetailSection>
      )}

      {/* Section: 策划方案下载 */}
      {review.planFileName && (
        <DetailSection title="策划方案">
          <a
            href={review.planFileUrl || '#'}
            download={review.planFileName}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <Download size={16} />
            {review.planFileName}
          </a>
        </DetailSection>
      )}

      {/* Section: 报告内容 */}
      {reportData?.reportContent ? (
        <DetailSection title="复盘报告">
          <ReportContentDisplay content={reportData.reportContent} />
        </DetailSection>
      ) : null}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border bg-white p-6">
      <h2 className="mb-4 text-base font-semibold text-slate-800">{title}</h2>
      {children}
    </section>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-900">{value}</dd>
    </div>
  );
}

function ReportContentDisplay({ content }: { content: unknown }) {
  if (!content) return null;

  // If content is a string, render as HTML
  if (typeof content === 'string') {
    return (
      <div
        className="prose prose-sm max-w-none text-slate-700"
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  }

  // If content is an object with sections, render structured
  if (typeof content === 'object' && content !== null) {
    if (Array.isArray(content)) {
      return (
        <div className="space-y-6">
          {(content as Array<{ title?: string; content?: string }>).map((section, idx) => (
            <div key={idx}>
              {section.title && (
                <h3 className="mb-2 text-sm font-semibold text-slate-800">{section.title}</h3>
              )}
              {section.content && (
                <div
                  className="prose prose-sm max-w-none text-slate-700"
                  dangerouslySetInnerHTML={{ __html: section.content }}
                />
              )}
            </div>
          ))}
        </div>
      );
    }

    // Object with key-value pairs
    const entries = Object.entries(content as Record<string, unknown>);
    return (
      <div className="space-y-4">
        {entries.map(([key, value]) => (
          <div key={key}>
            <h3 className="mb-1 text-sm font-semibold text-slate-800">{key}</h3>
            <div className="text-sm text-slate-700">
              {typeof value === 'string' ? (
                <div dangerouslySetInnerHTML={{ __html: value }} />
              ) : (
                <pre className="whitespace-pre-wrap rounded bg-slate-50 p-3 text-xs">
                  {JSON.stringify(value, null, 2)}
                </pre>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return null;
}
