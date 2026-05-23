'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Loading } from '@/components/ui/loading';

const PRESENTON_BASE_URL = process.env.NEXT_PUBLIC_PRESENTON_BASE_URL || 'http://localhost:5000';

interface ReviewData {
  id: string;
  projectId: string;
  versionNumber: number;
  generatedAt: string;
  status: string;
  config: Record<string, unknown>;
  content: Record<string, unknown>;
  modules: Array<{ moduleId: string; moduleName: string; status: string; reason: string; degradedFields?: string[] }>;
  edits: Array<{ id: string; moduleId: string; editType: string; editedAt: string }>;
  project: {
    id: string;
    projectName: string;
    brand: string;
    category: string;
    projectType: string;
  };
}

export default function ReviewPlatformPage() {
  const params = useParams();
  const versionId = params.versionId as string;
  const queryClient = useQueryClient();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [autoGenerateTriggered, setAutoGenerateTriggered] = useState(false);

  // Fetch review data
  const { data: reviewData, isLoading, isError, error } = useQuery<ReviewData>({
    queryKey: ['reviewData', versionId],
    queryFn: async () => {
      const res = await fetch(`/api/review/${versionId}`);
      if (!res.ok) throw new Error('获取报告数据失败');
      return res.json();
    },
  });

  // PPT generation mutation
  const generateMutation = useMutation({
    mutationFn: async (data: { projectName: string; brand: string; category: string; modules: Record<string, unknown> }) => {
      const res = await fetch('/api/ppt/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'PPT 生成失败' }));
        throw new Error(err.error || 'PPT 生成失败');
      }
      return res.json() as Promise<{ presentationId: string; editUrl: string; downloadUrl: string }>;
    },
    onSuccess: async (result) => {
      // Save presentationId to review config
      await fetch(`/api/review/${versionId}/ppt`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          presentationId: result.presentationId,
          editUrl: result.editUrl,
          downloadUrl: result.downloadUrl,
        }),
      });
      // Reload review data to pick up the new presentationId
      queryClient.invalidateQueries({ queryKey: ['reviewData', versionId] });
    },
  });

  // Auto-generate PPT when no presentationId is available
  useEffect(() => {
    if (!reviewData || autoGenerateTriggered) return;
    const presentationId = (reviewData.config as { ppt?: { presentationId?: string } })?.ppt?.presentationId;
    if (!presentationId) {
      setAutoGenerateTriggered(true);
      // Build modules data for generation
      const modulesData: Record<string, unknown> = {};
      if (reviewData.content && typeof reviewData.content === 'object') {
        for (const mod of reviewData.modules) {
          const moduleContent = (reviewData.content as Record<string, unknown>)[mod.moduleId];
          if (moduleContent) {
            modulesData[mod.moduleId] = moduleContent;
          }
        }
      }
      generateMutation.mutate({
        projectName: reviewData.project.projectName,
        brand: reviewData.project.brand,
        category: reviewData.project.category,
        modules: modulesData,
      });
    }
  }, [reviewData, autoGenerateTriggered]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loading size="lg" text="加载审校台..." />
      </div>
    );
  }

  // Error state
  if (isError || !reviewData) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3">
        <AlertTriangle size={32} className="text-red-400" />
        <p className="text-sm text-red-600">
          {(error as Error)?.message || '加载报告数据失败'}
        </p>
        <button
          onClick={() => queryClient.invalidateQueries({ queryKey: ['reviewData', versionId] })}
          className="rounded-md border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
        >
          重试
        </button>
      </div>
    );
  }

  const presentationId = (reviewData.config as { ppt?: { presentationId?: string } })?.ppt?.presentationId;

  // PPT is available - show iframe full screen
  if (presentationId) {
    return (
      <div className="-m-6 h-screen">
        <iframe
          ref={iframeRef}
          src={`${PRESENTON_BASE_URL}/presentation?id=${presentationId}&locale=zh`}
          className="h-full w-full border-0"
          title="PPT 编辑器"
          allow="clipboard-write; clipboard-read"
        />
      </div>
    );
  }

  // Generating PPT
  if (generateMutation.isPending) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <Loader2 size={36} className="animate-spin text-blue-500" />
        <p className="text-lg font-medium text-gray-600">正在生成 PPT...</p>
        <p className="text-sm text-gray-400">AI 正在生成复盘报告，通常需要 2-5 分钟</p>
      </div>
    );
  }

  // Generation failed
  if (generateMutation.isError) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3">
        <AlertTriangle size={32} className="text-red-400" />
        <p className="text-sm text-red-600">{generateMutation.error.message}</p>
        <button
          onClick={() => {
            setAutoGenerateTriggered(false);
          }}
          className="rounded-md border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
        >
          重试
        </button>
      </div>
    );
  }

  // Fallback (should not normally reach here)
  return (
    <div className="flex h-screen items-center justify-center">
      <Loading size="lg" text="准备中..." />
    </div>
  );
}
