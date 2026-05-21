'use client';

import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Download,
  RefreshCw,
  Loader2,
  AlertCircle,
  Presentation,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PptPanelProps {
  projectId: string;
  versionId: string;
  pptInfo?: {
    presentationId?: string;
    editUrl?: string;
    downloadUrl?: string;
  };
  reportContent?: Record<string, unknown>;
  projectName: string;
  brand: string;
  category: string;
  /** 全宽模式（中间区域显示） */
  fullWidth?: boolean;
}

interface PresentationDetail {
  id: string;
  title: string;
  slides: Array<{ index: number; content: Record<string, unknown> }>;
  editorUrl?: string;
}

// ─── PPT Panel Component ─────────────────────────────────────────────────────

export function PptPanel({
  projectId,
  versionId,
  pptInfo,
  reportContent,
  projectName,
  brand,
  category,
  fullWidth = false,
}: PptPanelProps) {
  const queryClient = useQueryClient();
  const presentationId = pptInfo?.presentationId;

  // 获取 PPT 详情
  const {
    data: presentation,
    isLoading,
    isError,
    error,
  } = useQuery<PresentationDetail>({
    queryKey: ['presentation', presentationId],
    queryFn: async () => {
      const res = await fetch(`/api/ppt/${presentationId}`);
      if (!res.ok) throw new Error('获取 PPT 详情失败');
      return res.json();
    },
    enabled: !!presentationId,
    staleTime: 60000,
  });

  // 生成/重新生成 PPT
  const regenerateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/ppt/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName,
          brand,
          category,
          modules: reportContent,
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
      // 更新 ppt 信息到 review version
      fetch(`/api/review/${versionId}/ppt`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          presentationId: data.presentationId,
          editUrl: data.editUrl,
          downloadUrl: data.downloadUrl,
        }),
      }).then(() => {
        queryClient.invalidateQueries({ queryKey: ['reviewData', versionId] });
        queryClient.invalidateQueries({ queryKey: ['presentation', data.presentationId] });
      });
    },
  });

  // 导出下载
  const handleExport = () => {
    if (!presentationId) return;
    window.open(`/api/ppt/${presentationId}/export`, '_blank');
  };

  const slides = presentation?.slides || [];

  // Presenton 编辑器 URL
  const editorUrl = presentation?.editorUrl
    || (presentationId ? `http://localhost:5000/presentation?id=${presentationId}` : '');

  // ─── No PPT generated ─────────────────────────────────────────────────────

  if (!presentationId) {
    return (
      <div className={`flex h-full flex-col items-center justify-center gap-4 ${fullWidth ? 'p-12' : 'p-6'}`}>
        <Presentation size={fullWidth ? 48 : 32} className="text-gray-300" />
        <div className="text-center">
          <p className={`font-medium text-gray-600 ${fullWidth ? 'text-lg' : 'text-sm'}`}>PPT 尚未生成</p>
          <p className={`mt-1 text-gray-400 ${fullWidth ? 'text-sm' : 'text-xs'}`}>
            点击按钮从当前报告内容生成 PPT
          </p>
        </div>
        <button
          onClick={() => regenerateMutation.mutate()}
          disabled={regenerateMutation.isPending}
          className={`inline-flex items-center gap-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 ${
            fullWidth ? 'px-6 py-3 text-base font-medium' : 'px-4 py-2 text-sm font-medium'
          }`}
        >
          {regenerateMutation.isPending ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Presentation size={16} />
          )}
          生成 PPT
        </button>
        {regenerateMutation.isPending && (
          <p className="text-xs text-gray-400 animate-pulse">AI 正在生成，通常需要 1-3 分钟...</p>
        )}
        {regenerateMutation.isError && (
          <p className="text-xs text-red-500">{regenerateMutation.error?.message}</p>
        )}
      </div>
    );
  }

  // ─── Loading ───────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 size={16} className="animate-spin text-gray-400" />
        <span className="ml-2 text-sm text-gray-500">加载 PPT...</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6">
        <AlertCircle size={24} className="text-red-400" />
        <p className="text-xs text-red-500">{(error as Error)?.message}</p>
      </div>
    );
  }

  // ─── Full Width: Embed Presenton editor (原版渲染+编辑+AI) ─────────────────

  if (fullWidth) {
    return (
      <div className="flex h-full flex-col">
        {/* Toolbar */}
        <div className="flex items-center justify-between border-b bg-white px-4 py-2 shrink-0">
          <div className="flex items-center gap-3">
            <Presentation size={16} className="text-blue-600" />
            <span className="text-sm font-medium text-gray-900">
              {(presentation?.title || 'PPT').substring(0, 40)}
              {(presentation?.title?.length || 0) > 40 ? '...' : ''}
            </span>
            <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
              {slides.length} 页
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              <Download size={13} /> 下载 PPTX
            </button>
            <button
              onClick={() => regenerateMutation.mutate()}
              disabled={regenerateMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              {regenerateMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              重新生成
            </button>
          </div>
        </div>

        {/* Presenton Editor iframe - 原版渲染效果，支持手动编辑和AI对话 */}
        <div className="flex-1 overflow-hidden">
          <iframe
            src={editorUrl}
            className="h-full w-full border-0"
            title="PPT 编辑器"
            allow="clipboard-write; clipboard-read"
          />
        </div>
      </div>
    );
  }

  // ─── Sidebar mode (右侧面板，紧凑列表) ────────────────────────────────────

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-xs font-medium text-gray-700">{slides.length} 页</span>
        <div className="flex gap-1">
          <button onClick={handleExport} className="rounded p-1 text-gray-400 hover:bg-gray-100" title="下载">
            <Download size={13} />
          </button>
          <button
            onClick={() => regenerateMutation.mutate()}
            disabled={regenerateMutation.isPending}
            className="rounded p-1 text-gray-400 hover:bg-gray-100"
            title="重新生成"
          >
            {regenerateMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {slides.map((slide, idx) => (
          <div key={idx} className="rounded border bg-white p-3 text-xs">
            {typeof slide.content?.title === 'string' && slide.content.title ? (
              <p className="font-medium text-gray-900 mb-1">{slide.content.title}</p>
            ) : null}
            {typeof slide.content?.description === 'string' && slide.content.description ? (
              <p className="text-gray-500 line-clamp-2">{slide.content.description}</p>
            ) : null}
            {!slide.content?.title && !slide.content?.description ? (
              <p className="text-gray-400 italic">第 {idx + 1} 页</p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
