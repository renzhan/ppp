'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  ArrowLeft,
  Download,
  ExternalLink,
  Loader2,
  Presentation,
  RefreshCw,
  AlertCircle,
  FileText,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/page-header';
import { Loading } from '@/components/ui/loading';

interface ProjectDetail {
  id: string;
  projectName: string;
  brand: string;
  category: string;
}

interface SlideContent {
  title?: string;
  description?: string;
  bulletPoints?: string | string[];
  metrics?: string;
  tableData?: unknown;
  chartData?: unknown;
  image?: unknown;
}

interface SlideData {
  id: string;
  index: number;
  layout: string;
  layout_group: string;
  content: SlideContent;
  speaker_note?: string;
}

interface PresentationData {
  id: string;
  title: string;
  slides: SlideData[];
  editorUrl?: string;
  n_slides?: number;
  language?: string;
  created_at?: string;
}

export default function ProjectPptPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const [currentSlide, setCurrentSlide] = useState(0);
  const [presentationId, setPresentationId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'slides' | 'iframe'>('slides');

  // 获取项目信息
  const { data: project, isLoading: projectLoading } = useQuery<ProjectDetail>({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}`);
      if (!res.ok) throw new Error('获取项目失败');
      return res.json();
    },
  });

  // 获取 PPT 详情
  const {
    data: presentation,
    isLoading: pptLoading,
    isError: pptError,
    refetch: refetchPpt,
  } = useQuery<PresentationData>({
    queryKey: ['presentation', presentationId],
    queryFn: async () => {
      const res = await fetch(`/api/ppt/${presentationId}`);
      if (!res.ok) throw new Error('获取 PPT 详情失败');
      return res.json();
    },
    enabled: !!presentationId,
  });

  // 生成 PPT
  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/ppt/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName: project?.projectName || '复盘报告',
          brand: project?.brand || '',
          category: project?.category || '',
          modules: {},
          language: '中文',
          tone: 'professional',
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'PPT 生成失败');
      }
      return res.json();
    },
    onSuccess: (data) => {
      setPresentationId(data.presentationId);
    },
  });

  // 导出下载
  const handleExport = () => {
    if (!presentationId) return;
    window.open(`/api/ppt/${presentationId}/export`, '_blank');
  };

  // 在 Presenton 编辑器中打开
  const handleOpenEditor = () => {
    if (!presentation?.editorUrl) return;
    window.open(presentation.editorUrl, '_blank');
  };

  if (projectLoading) {
    return <Loading size="lg" text="加载项目信息..." className="py-20" />;
  }

  const slides = presentation?.slides || [];
  const slide = slides[currentSlide];

  return (
    <div className="space-y-6">
      <PageHeader
        backHref={`/projects/${projectId}`}
        title="PPT 查看与导出"
        description={project ? `${project.projectName} · ${project.brand}` : ''}
        actions={
          <div className="flex items-center gap-2">
            {presentationId && (
              <>
                <button
                  onClick={handleExport}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Download size={16} />
                  导出 PPTX
                </button>
                <button
                  onClick={handleOpenEditor}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <ExternalLink size={16} />
                  在编辑器中打开
                </button>
              </>
            )}
            <button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {generateMutation.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <RefreshCw size={16} />
              )}
              {presentationId ? '重新生成' : '生成 PPT'}
            </button>
          </div>
        }
      />

      {/* 生成错误提示 */}
      {generateMutation.isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} />
            {generateMutation.error?.message}
          </div>
        </div>
      )}

      {/* 未生成状态 */}
      {!presentationId && !generateMutation.isPending && (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 py-20">
          <Presentation size={48} className="text-slate-300" />
          <h3 className="mt-4 text-lg font-medium text-slate-600">尚未生成 PPT</h3>
          <p className="mt-2 text-sm text-slate-400">
            点击"生成 PPT"按钮，系统将基于复盘报告数据自动生成演示文稿
          </p>
          <button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Presentation size={16} />
            生成 PPT
          </button>
        </div>
      )}

      {/* 生成中 */}
      {generateMutation.isPending && (
        <div className="flex flex-col items-center justify-center rounded-lg border bg-white py-20">
          <Loader2 size={32} className="animate-spin text-blue-500" />
          <p className="mt-4 text-sm text-slate-600">正在生成 PPT，请稍候...</p>
          <p className="mt-1 text-xs text-slate-400">AI 正在组装幻灯片内容，通常需要 1-3 分钟</p>
        </div>
      )}

      {/* PPT 加载中 */}
      {presentationId && pptLoading && (
        <Loading size="lg" text="加载 PPT 数据..." className="py-20" />
      )}

      {/* PPT 加载失败 */}
      {pptError && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-red-200 bg-red-50 py-10">
          <AlertCircle size={24} className="text-red-400" />
          <p className="mt-2 text-sm text-red-600">加载 PPT 失败</p>
          <button
            onClick={() => refetchPpt()}
            className="mt-3 rounded-md border px-3 py-1.5 text-xs text-slate-600 hover:bg-white"
          >
            重试
          </button>
        </div>
      )}

      {/* PPT 查看器 */}
      {presentation && slides.length > 0 && (
        <div className="rounded-lg border bg-white shadow-sm">
          {/* 工具栏 */}
          <div className="flex items-center justify-between border-b px-6 py-3">
            <div className="flex items-center gap-3">
              <Presentation size={18} className="text-blue-600" />
              <span className="text-sm font-semibold text-slate-900">
                {presentation.title}
              </span>
              <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                {slides.length} 页
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode('slides')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                  viewMode === 'slides'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                幻灯片视图
              </button>
              <button
                onClick={() => setViewMode('iframe')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                  viewMode === 'iframe'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                编辑器视图
              </button>
            </div>
          </div>

          {viewMode === 'iframe' && presentation.editorUrl ? (
            <div className="h-[700px] w-full">
              <iframe
                src={presentation.editorUrl}
                className="h-full w-full border-0"
                title="Presenton Editor"
                allow="clipboard-write"
              />
            </div>
          ) : (
            <>
              {/* 幻灯片导航 */}
              <div className="flex items-center justify-between border-b bg-slate-50 px-6 py-2">
                <button
                  onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))}
                  disabled={currentSlide === 0}
                  className="rounded-md p-1.5 text-slate-500 hover:bg-slate-200 disabled:opacity-30"
                >
                  <ChevronLeft size={18} />
                </button>
                <div className="flex items-center gap-1 overflow-x-auto px-2">
                  {slides.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentSlide(idx)}
                      className={`h-7 w-7 rounded text-xs font-medium transition-colors ${
                        idx === currentSlide
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-slate-600 hover:bg-slate-200 border'
                      }`}
                    >
                      {idx + 1}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setCurrentSlide(Math.min(slides.length - 1, currentSlide + 1))}
                  disabled={currentSlide >= slides.length - 1}
                  className="rounded-md p-1.5 text-slate-500 hover:bg-slate-200 disabled:opacity-30"
                >
                  <ChevronRight size={18} />
                </button>
              </div>

              {/* 当前幻灯片内容 */}
              {slide && (
                <div className="p-6">
                  <div className="mx-auto max-w-4xl rounded-lg border bg-white p-8 shadow-md" style={{ aspectRatio: '16/9' }}>
                    {/* 幻灯片标题 */}
                    {slide.content.title ? (
                      <h2 className="mb-4 text-2xl font-bold text-slate-900">
                        {slide.content.title}
                      </h2>
                    ) : null}

                    {/* 幻灯片描述 */}
                    {slide.content.description ? (
                      <p className="mb-4 text-sm text-slate-600 leading-relaxed">
                        {slide.content.description}
                      </p>
                    ) : null}

                    {/* Bullet Points */}
                    {slide.content?.bulletPoints && (
                      <div className="space-y-2">
                        {(Array.isArray(slide.content.bulletPoints)
                          ? (slide.content.bulletPoints as string[])
                          : String(slide.content.bulletPoints).split('\n').filter(Boolean)
                        ).map((point, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
                            <span className="text-sm text-slate-700">{String(point).replace(/^[•\-]\s*/, '')}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Metrics */}
                    {slide.content?.metrics && typeof slide.content.metrics === 'string' && slide.content.metrics.trim() && (
                      <div className="mt-4 grid grid-cols-3 gap-4">
                        {String(slide.content.metrics).split('\n').filter(Boolean).map((m, i) => (
                          <div key={i} className="rounded-lg bg-blue-50 p-3 text-center">
                            <span className="text-xs text-slate-600">{m}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 其他内容字段 */}
                    {Object.entries(slide.content as Record<string, unknown> || {})
                      .filter(([key]) => !['title', 'description', 'bulletPoints', 'metrics', '__speaker_note__', '__image_prompt__'].includes(key) && !key.startsWith('_'))
                      .map(([key, value]) => {
                        if (!value || (typeof value === 'string' && !value.trim())) return null;
                        return (
                          <div key={key} className="mt-3">
                            <span className="text-xs font-medium text-slate-400 uppercase">{key}</span>
                            <p className="mt-1 text-sm text-slate-700">
                              {typeof value === 'string' ? value : JSON.stringify(value)}
                            </p>
                          </div>
                        );
                      })}
                  </div>

                  {/* Speaker notes */}
                  {slide.speaker_note && (
                    <div className="mx-auto mt-4 max-w-4xl rounded-lg border border-amber-200 bg-amber-50 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <FileText size={14} className="text-amber-600" />
                        <span className="text-xs font-medium text-amber-700">演讲者备注</span>
                      </div>
                      <p className="text-xs text-amber-800 leading-relaxed">
                        {slide.speaker_note.substring(0, 300)}
                        {slide.speaker_note.length > 300 && '...'}
                      </p>
                    </div>
                  )}

                  {/* 幻灯片元信息 */}
                  <div className="mx-auto mt-3 max-w-4xl flex items-center gap-3 text-xs text-slate-400">
                    <span>布局: {slide.layout}</span>
                    <span>·</span>
                    <span>第 {currentSlide + 1} / {slides.length} 页</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
