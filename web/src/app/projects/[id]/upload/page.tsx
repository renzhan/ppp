'use client';

import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import {
  CheckCircle2,
  CloudDownload,
  FileSpreadsheet,
  FileText,
  Loader2,
  Sparkles,
  TrendingUp,
  Upload,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { parseNoteIds } from '@/lib/note-id-parser';

type UploadStepKey = 'plan' | 'sheets' | 'external' | 'notes';

interface UploadResult {
  success: boolean;
  title: string;
  description: string;
}

interface ParsedPlanSummary {
  projectObjective?: string | null;
  targetAudience?: string | null;
  coreMessage?: string | null;
  strategy?: string | null;
}

const steps: Array<{
  key: UploadStepKey;
  label: string;
  icon: typeof FileText;
}> = [
  { key: 'plan', label: '策划报告', icon: FileText },
  { key: 'sheets', label: '执行底表+投流', icon: FileSpreadsheet },
  { key: 'external', label: '派查查同步', icon: Sparkles },
  { key: 'notes', label: '蒲公英/聚光', icon: CloudDownload },
];

export default function ProjectUploadPage() {
  const params = useParams();
  const projectId = params.id as string;
  const [activeStep, setActiveStep] = useState<UploadStepKey>('plan');
  const [result, setResult] = useState<UploadResult | null>(null);
  const [planSummary, setPlanSummary] = useState<ParsedPlanSummary | null>(null);

  return (
    <div className="space-y-6">
      <PageHeader
        title="数据上传"
        description="先上传策划报告，再上传执行底表+投流底表（单个 Excel 多 sheet），最后同步派查查和笔记维度数据。"
      />

      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-5">
          {steps.map((step, index) => {
            const active = step.key === activeStep;
            const Icon = step.icon;
            return (
              <button
                key={step.key}
                type="button"
                onClick={() => {
                  setActiveStep(step.key);
                  setResult(null);
                }}
                className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition ${
                  active
                    ? 'border-brand bg-brand-50 text-brand'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                    active ? 'bg-brand text-white' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {index + 1}
                </div>
                <div>
                  <p className="text-sm font-medium">{step.label}</p>
                  <div className="mt-1 flex items-center gap-1 text-xs opacity-80">
                    <Icon size={12} />
                    <span>{step.key === 'external' ? 'mock 同步' : '上传解析'}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-lg border bg-white p-6 shadow-sm">
        {activeStep === 'plan' && (
          <PlanUploadPanel
            projectId={projectId}
            onResult={setResult}
            onSummary={setPlanSummary}
          />
        )}
        {activeStep === 'sheets' && (
          <CombinedSheetUploadPanel
            projectId={projectId}
            onResult={setResult}
          />
        )}
        {activeStep === 'external' && (
          <ExternalSyncPanel projectId={projectId} onResult={setResult} />
        )}
        {activeStep === 'notes' && (
          <NoteFetchPanel projectId={projectId} onResult={setResult} />
        )}
      </div>

      {planSummary && activeStep === 'plan' && (
        <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-emerald-800">
            <CheckCircle2 size={16} />
            <span>策划报告解析结果</span>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <SummaryItem label="项目目标" value={planSummary.projectObjective} />
            <SummaryItem label="目标人群" value={planSummary.targetAudience} />
            <SummaryItem label="核心信息" value={planSummary.coreMessage} />
            <SummaryItem label="传播策略" value={planSummary.strategy} />
          </div>
        </section>
      )}

      {result && (
        <section
          className={`rounded-lg border p-4 ${
            result.success
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          <div className="flex items-center gap-2 text-sm font-medium">
            <CheckCircle2 size={16} />
            <span>{result.title}</span>
          </div>
          <p className="mt-2 text-sm opacity-90">{result.description}</p>
        </section>
      )}
    </div>
  );
}

function PlanUploadPanel({
  projectId,
  onResult,
  onSummary,
}: {
  projectId: string;
  onResult: (result: UploadResult) => void;
  onSummary: (summary: ParsedPlanSummary | null) => void;
}) {
  const mutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      const parseResponse = await fetch('/api/upload/plan-parse', {
        method: 'POST',
        body: formData,
      });
      const parseData = await parseResponse.json();

      if (!parseResponse.ok || !parseData.success) {
        throw new Error(parseData.error || '策划报告解析失败');
      }

      const saveResponse = await fetch(`/api/projects/${projectId}/ai-content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentType: 'plan_parse',
          generatedContent: JSON.stringify(parseData.data),
        }),
      });
      const saveData = await saveResponse.json();
      if (!saveResponse.ok) {
        throw new Error(saveData.error || '策划报告保存失败');
      }

      return parseData.data as ParsedPlanSummary;
    },
    onSuccess: (data) => {
      onSummary(data);
      onResult({
        success: true,
        title: '策划报告上传完成',
        description: '项目背景信息已入库，后续生成报告时会自动参与分析。',
      });
    },
    onError: (error) => {
      onSummary(null);
      onResult({
        success: false,
        title: '策划报告上传失败',
        description: (error as Error).message,
      });
    },
  });

  return (
    <FileUploadPanel
      title="上传策划报告"
      description="支持 PDF、Word、PPT。系统会用 AI 解析项目背景、目标人群、核心信息和传播策略。"
      accept=".pdf,.doc,.docx,.ppt,.pptx"
      supportText="支持 .pdf / .doc / .docx / .ppt / .pptx"
      buttonText="上传并解析"
      isPending={mutation.isPending}
      onSubmit={([file]) => file && mutation.mutate(file)}
    />
  );
}

function SpreadsheetUploadPanel({
  title,
  description,
  accept,
  supportText,
  endpoint,
  projectId,
  successTitle,
  onResult,
}: {
  title: string;
  description: string;
  accept: string;
  supportText: string;
  endpoint: string;
  projectId: string;
  successTitle: string;
  onResult: (result: UploadResult) => void;
}) {
  const mutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('projectId', projectId);

      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) {
        const detailMsg = data.details?.length
          ? data.details.map((d: { row: number; column: string; reason: string }) => `[行${d.row}列${d.column}] ${d.reason}`).join('; ')
          : '';
        throw new Error(detailMsg ? `${data.error}: ${detailMsg}` : (data.error || `${title}失败`));
      }
      return data as {
        successCount?: number;
        failureCount?: number;
      };
    },
    onSuccess: (data) => {
      onResult({
        success: true,
        title: successTitle,
        description: `成功解析 ${data.successCount ?? 0} 条记录。`,
      });
    },
    onError: (error) => {
      onResult({
        success: false,
        title: `${title}失败`,
        description: (error as Error).message,
      });
    },
  });

  return (
    <FileUploadPanel
      title={title}
      description={description}
      accept={accept}
      supportText={supportText}
      buttonText="上传并入库"
      isPending={mutation.isPending}
      onSubmit={(files) => mutation.mutate(files[0])}
    />
  );
}

function CombinedSheetUploadPanel({
  projectId,
  onResult,
}: {
  projectId: string;
  onResult: (result: UploadResult) => void;
}) {
  const mutation = useMutation({
    mutationFn: async (files: File[]) => {
      const allParts: string[] = [];
      let allWarnings = '';
      let hasWarning = false;

      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('projectId', projectId);

        const response = await fetch('/api/upload/combined', {
          method: 'POST',
          body: formData,
        });
        const data = await response.json();
        if (!response.ok) {
          const detailMsg = data.details?.length
            ? data.details.map((d: { reason: string }) => d.reason).join('; ')
            : '';
          throw new Error(`${file.name}: ${detailMsg || data.error || '底表上传失败'}`);
        }

        const fileParts: string[] = [];
        if (data.annotationPersisted) fileParts.push(`业务标注 ${data.annotationsCount} 条`);
        if (data.juguangPersisted) fileParts.push(`投流数据 ${data.juguangCount} 条`);
        if (data.pugongyingPersisted) fileParts.push(`笔记数据 ${data.pugongyingCount} 条`);

        if (fileParts.length > 0) {
          allParts.push(`${file.name}: ${fileParts.join('，')}`);
        } else {
          const sheetInfo = data.sheets?.length
            ? data.sheets.map((s: { name: string; type: string; firstHeaders: string }) => `"${s.name}"→${s.type}${s.type === 'unknown' ? `(${s.firstHeaders})` : ''}`).join('; ')
            : '';
          allParts.push(`${file.name}: 未识别到数据 (${sheetInfo || '无sheet'})`);
        }

        if (data.errors?.length) {
          const warns = data.errors.map((e: { sheet: string; reason: string }) => `[${e.sheet}] ${e.reason}`).join('; ');
          allWarnings = (allWarnings ? allWarnings + ' | ' : '') + `${file.name}: ${warns}`;
          hasWarning = true;
        }
      }

      return {
        summary: allParts.join('；'),
        warnings: hasWarning ? allWarnings : '',
      };
    },
    onSuccess: (data) => {
      onResult({
        success: true,
        title: '底表上传完成',
        description: data.warnings ? `${data.summary} 警告: ${data.warnings}` : data.summary,
      });
    },
    onError: (error) => {
      onResult({
        success: false,
        title: '底表上传失败',
        description: (error as Error).message,
      });
    },
  });

  return (
    <FileUploadPanel
      title="上传执行底表+投流底表"
      description="上传一个或多个 Excel 文件（含多个 sheet），自动识别执行底表（业务标注）和投流底表（聚光投放数据）并分别入库。"
      accept=".xlsx,.xls"
      supportText="支持 .xlsx（可选多个文件、多个 sheet 自动识别）"
      buttonText="上传并解析全表"
      isPending={mutation.isPending}
      onSubmit={(files) => mutation.mutate(files)}
      multiple
    />
  );
}

function ExternalSyncPanel({
  projectId,
  onResult,
}: {
  projectId: string;
  onResult: (result: UploadResult) => void;
}) {
  const mutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/projects/${projectId}/external-sync`, {
        method: 'POST',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '派查查同步失败');
      }
      return data as { provider: string; recordCount: number };
    },
    onSuccess: (data) => {
      onResult({
        success: true,
        title: '派查查同步完成',
        description: `已写入 ${data.recordCount} 条 ${data.provider} mock 数据。`,
      });
    },
    onError: (error) => {
      onResult({
        success: false,
        title: '派查查同步失败',
        description: (error as Error).message,
      });
    },
  });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">派查查数据同步</h2>
        <p className="mt-2 text-sm text-gray-500">
          根据项目基础信息 mock 一份灵犀千瓜数据，供报告生成和审校台演示使用。
        </p>
      </div>

      <div className="rounded-lg border border-brand-100 bg-brand-50 p-5 text-sm text-brand-800">
        当前没有真实接口，这一步会按项目品牌、类型和周期生成一份模拟外部数据并入库。
      </div>

      <button
        type="button"
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand px-5 text-sm font-medium text-white transition hover:bg-brand-600 disabled:opacity-60"
      >
        {mutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
        开始同步
      </button>
    </div>
  );
}

function NoteFetchPanel({
  projectId,
  onResult,
}: {
  projectId: string;
  onResult: (result: UploadResult) => void;
}) {
  const [noteIdInput, setNoteIdInput] = useState('');
  const parsedIds = useMemo(() => parseNoteIds(noteIdInput), [noteIdInput]);

  const mutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/upload/api-fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          noteIds: parsedIds,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '笔记数据拉取失败');
      }
      return data as { total: number; succeeded: number; failed: number };
    },
    onSuccess: (data) => {
      onResult({
        success: data.failed === 0,
        title: '蒲公英 / 聚光数据拉取完成',
        description: `共处理 ${data.total} 个笔记 ID，成功 ${data.succeeded} 个，失败 ${data.failed} 个。`,
      });
    },
    onError: (error) => {
      onResult({
        success: false,
        title: '笔记数据拉取失败',
        description: (error as Error).message,
      });
    },
  });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">录入小红书 ID</h2>
        <p className="mt-2 text-sm text-gray-500">
          输入笔记 ID，mock 获取蒲公英与聚光侧数据，补齐后续复盘分析所需字段。
        </p>
      </div>

      <textarea
        value={noteIdInput}
        onChange={(event) => setNoteIdInput(event.target.value)}
        rows={7}
        placeholder={'每行一个笔记 ID，或用逗号分隔多个 ID。'}
        className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
      />

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {parsedIds.length > 0 ? `已识别 ${parsedIds.length} 个笔记 ID` : '请输入至少一个笔记 ID'}
        </p>
        <button
          type="button"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || parsedIds.length === 0}
          className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand px-5 text-sm font-medium text-white transition hover:bg-brand-600 disabled:opacity-60"
        >
          {mutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <CloudDownload size={16} />}
          开始拉取
        </button>
      </div>
    </div>
  );
}

function FileUploadPanel({
  title,
  description,
  accept,
  supportText,
  buttonText,
  isPending,
  onSubmit,
  multiple = false,
}: {
  title: string;
  description: string;
  accept: string;
  supportText: string;
  buttonText: string;
  isPending: boolean;
  onSubmit: (files: File[]) => void;
  multiple?: boolean;
}) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    if (multiple) {
      setSelectedFiles(Array.from(fileList));
    } else {
      setSelectedFiles([fileList[0]]);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <p className="mt-2 text-sm text-gray-500">{description}</p>
      </div>

      {selectedFiles.length > 0 ? (
        <div className="space-y-3 rounded-lg border border-brand-200 bg-brand-50 p-4">
          <div className="space-y-2">
            {selectedFiles.map((file, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <FileText size={16} className="text-brand shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                  <p className="text-xs text-gray-500">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedFiles([])}
              className="inline-flex h-10 items-center rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              重新选择
            </button>
            <button
              type="button"
              onClick={() => selectedFiles.length > 0 && onSubmit(selectedFiles)}
              disabled={isPending}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-white transition hover:bg-brand-600 disabled:opacity-60"
            >
              {isPending ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              {buttonText}{multiple ? ` (${selectedFiles.length}个文件)` : ''}
            </button>
          </div>
        </div>
      ) : (
        <label
          className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-12 text-center transition ${
            isDragging
              ? 'border-brand bg-[#FFF8E1]'
              : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
          }`}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            handleFiles(event.dataTransfer.files);
          }}
        >
          <Upload size={28} className="mb-3 text-gray-400" />
          <p className="text-sm font-medium text-gray-700">拖拽文件到此处，或点击选择文件</p>
          <p className="mt-2 text-xs text-gray-500">{supportText}</p>
          <input
            type="file"
            accept={accept}
            multiple={multiple}
            onChange={(event) => handleFiles(event.target.files)}
            className="hidden"
          />
        </label>
      )}
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="rounded-lg border border-emerald-100 bg-white px-4 py-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-2 text-sm text-gray-800">{value?.trim() ? value : '暂无'}</p>
    </div>
  );
}
