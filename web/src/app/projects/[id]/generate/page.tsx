'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import {
  Play,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Bot,
} from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/page-header';
import { Loading } from '@/components/ui/loading';
import {
  sendDesktopNotification,
  showToast,
  flashTabTitle,
  requestNotificationPermission,
} from '@/lib/notification';

type ToneIntensity = 'positive' | 'standard' | 'conservative';
type ModuleStatus = 'show' | 'hide' | 'degraded';

interface ModuleConfig {
  moduleId: string;
  moduleName: string;
  status: ModuleStatus;
  reason: string;
  degradedFields?: string[];
  isOverridden: boolean;
}

interface GenerateConfig {
  modules: ModuleConfig[];
  defaultTone: ToneIntensity;
}

interface GenerationStatus {
  status: 'idle' | 'rating' | 'decision' | 'narrative' | 'assembly' | 'complete' | 'error';
  progress: number;
  message: string;
  versionId?: string;
}

const TONE_OPTIONS: { value: ToneIntensity; label: string; description: string }[] = [
  { value: 'positive', label: '积极版', description: '强调成就和突破，语气自信' },
  { value: 'standard', label: '标准版', description: '客观陈述数据表现，语气中性' },
  { value: 'conservative', label: '保守版', description: '谨慎表达，侧重改进方向' },
];

const PROGRESS_STEPS = [
  { key: 'rating', label: '数据评级中', progress: 25 },
  { key: 'decision', label: '模块决策中', progress: 50 },
  { key: 'narrative', label: '文案生成中', progress: 75 },
  { key: 'assembly', label: '报告组装中', progress: 90 },
  { key: 'complete', label: '生成完成', progress: 100 },
];

export default function GenerateConfigPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [modules, setModules] = useState<ModuleConfig[]>([]);
  const [tone, setTone] = useState<ToneIntensity>('standard');
  const [generationStatus, setGenerationStatus] = useState<GenerationStatus | null>(null);
  const stopFlashRef = useRef<(() => void) | null>(null);

  // Request notification permission on mount
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  // Cleanup tab title flash on unmount
  useEffect(() => {
    return () => {
      if (stopFlashRef.current) {
        stopFlashRef.current();
        stopFlashRef.current = null;
      }
    };
  }, []);

  // Fetch module config from Decision Engine
  const { data: config, isLoading, isError } = useQuery<GenerateConfig>({
    queryKey: ['generateConfig', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/generate/${projectId}/config`);
      if (!res.ok) throw new Error('获取生成配置失败');
      return res.json();
    },
  });

  useEffect(() => {
    if (config) {
      setModules(config.modules);
      setTone(config.defaultTone);
    }
  }, [config]);

  // Poll generation status
  useEffect(() => {
    if (!generationStatus || generationStatus.status === 'complete' || generationStatus.status === 'error') {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/generate/${projectId}/status`);
        if (res.ok) {
          const status: GenerationStatus = await res.json();
          setGenerationStatus(status);
          if (status.status === 'complete' && status.versionId) {
            clearInterval(interval);

            // --- Notification: Success ---
            showToast({
              type: 'success',
              title: '报告生成完成',
              message: '复盘报告已成功生成，即将跳转到审校台。',
            });
            sendDesktopNotification('报告生成完成', '复盘报告已成功生成，点击查看。');

            // Flash tab title if user is not on this page
            if (document.hidden) {
              stopFlashRef.current = flashTabTitle('报告生成完成', document.title);
            }

            // Auto-redirect to review platform after short delay
            setTimeout(() => {
              router.push(`/projects/${projectId}/review/${status.versionId}`);
            }, 1500);
          }
          if (status.status === 'error') {
            clearInterval(interval);

            // --- Notification: Error ---
            showToast({
              type: 'error',
              title: '报告生成失败',
              message: status.message || '生成过程中发生错误，请重试。',
              duration: 8000,
            });

            // Flash tab title if user is not on this page
            if (document.hidden) {
              stopFlashRef.current = flashTabTitle('报告生成失败', document.title);
            }
          }
        }
      } catch {
        // Silently retry on network error
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [generationStatus, projectId, router]);

  // Trigger generation
  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/generate/${projectId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modules: modules.map((m) => ({
            moduleId: m.moduleId,
            status: m.status,
            isOverridden: m.isOverridden,
          })),
          tone,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '触发生成失败');
      }
      return res.json();
    },
    onSuccess: () => {
      setGenerationStatus({ status: 'rating', progress: 10, message: '正在进行数据评级...' });
    },
  });

  const toggleModule = (moduleId: string) => {
    setModules((prev) =>
      prev.map((m) =>
        m.moduleId === moduleId
          ? {
              ...m,
              status: m.status === 'show' || m.status === 'degraded' ? 'hide' : 'show',
              isOverridden: true,
            }
          : m
      )
    );
  };

  const isGenerating = generationStatus !== null && generationStatus.status !== 'error';

  if (isLoading) {
    return <Loading size="lg" text="加载生成配置..." className="py-20" />;
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <PageHeader title="报告生成" description="配置模块和语气，生成复盘报告" />
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm text-red-600">获取配置失败，请确保已上传数据后重试</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="报告生成"
        description="配置模块开关和语气强度，触发报告生成"
        actions={
          <Link
            href="/admin/agents?tab=agents&workspace=复盘文档生成"
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
          >
            <Bot size={14} />
            Agent 配置
          </Link>
        }
      />

      {/* Module Toggles */}
      <div className="rounded-lg border bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">模块配置</h2>
        <p className="mb-4 text-xs text-gray-500">
          以下模块开关由决策引擎根据数据评级自动预设，您可以手动覆盖。
        </p>

        <div className="space-y-3">
          {modules.map((module) => (
            <div
              key={module.moduleId}
              className="flex items-center justify-between rounded-md border px-4 py-3"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">
                    {module.moduleId} {module.moduleName}
                  </span>
                  {module.status === 'degraded' && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700">
                      <AlertCircle size={10} />
                      降级
                    </span>
                  )}
                  {module.isOverridden && (
                    <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs text-brand">
                      已覆盖
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-gray-500">{module.reason}</p>
                {module.degradedFields && module.degradedFields.length > 0 && (
                  <p className="mt-0.5 text-xs text-yellow-600">
                    缺失字段: {module.degradedFields.join(', ')}
                  </p>
                )}
              </div>

              <button
                onClick={() => toggleModule(module.moduleId)}
                disabled={module.moduleId === 'M1' || isGenerating}
                className="ml-4 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={`切换 ${module.moduleName}`}
              >
                {module.status === 'show' || module.status === 'degraded' ? (
                  <ToggleRight size={28} className="text-primary" />
                ) : (
                  <ToggleLeft size={28} className="text-gray-300" />
                )}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Tone Selector */}
      <div className="rounded-lg border bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">全局语气强度</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {TONE_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setTone(option.value)}
              disabled={isGenerating}
              className={`rounded-md border p-4 text-left transition-colors disabled:cursor-not-allowed ${
                tone === option.value
                  ? 'border-primary bg-primary/5'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <p
                className={`text-sm font-medium ${
                  tone === option.value ? 'text-primary' : 'text-gray-900'
                }`}
              >
                {option.label}
              </p>
              <p className="mt-1 text-xs text-gray-500">{option.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Generation Progress */}
      {generationStatus && (
        <div className="rounded-lg border bg-white p-6">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">生成进度</h2>

          {generationStatus.status === 'error' ? (
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle size={16} />
              <span className="text-sm">生成失败: {generationStatus.message}</span>
            </div>
          ) : (
            <>
              {/* Progress Bar */}
              <div className="mb-4 h-2 overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${generationStatus.progress}%` }}
                />
              </div>

              {/* Progress Steps */}
              <div className="flex justify-between">
                {PROGRESS_STEPS.map((step) => {
                  const isActive = generationStatus.status === step.key;
                  const isDone = generationStatus.progress > step.progress;
                  return (
                    <div key={step.key} className="flex flex-col items-center">
                      <div
                        className={`flex h-6 w-6 items-center justify-center rounded-full ${
                          isDone
                            ? 'bg-green-100 text-green-600'
                            : isActive
                              ? 'bg-primary/10 text-primary'
                              : 'bg-gray-100 text-gray-400'
                        }`}
                      >
                        {isDone ? (
                          <CheckCircle2 size={14} />
                        ) : isActive ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <span className="h-2 w-2 rounded-full bg-current" />
                        )}
                      </div>
                      <span
                        className={`mt-1 text-xs ${
                          isActive ? 'font-medium text-primary' : 'text-gray-500'
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {generationStatus.status === 'complete' && (
                <p className="mt-4 text-center text-sm text-green-600">
                  报告生成完成，即将跳转到审校台...
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* Generate Button */}
      {!isGenerating && (
        <div className="flex justify-center">
          <button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {generateMutation.isPending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Play size={16} />
            )}
            生成报告
          </button>
        </div>
      )}

      {generateMutation.isError && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-center text-sm text-red-600">
          {(generateMutation.error as Error)?.message || '触发生成失败，请重试'}
        </div>
      )}
    </div>
  );
}
