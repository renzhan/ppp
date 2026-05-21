'use client';

import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import {
  LAUNCH_PHASES,
  PROJECT_TYPES,
  createEmptyLaunchPhases,
  type LaunchPhaseKey,
  type LaunchPhases,
} from '@/lib/project-meta';

interface FormState {
  category: string;
  brand: string;
  spuName: string;
  projectName: string;
  projectType: string;
  launchPhases: LaunchPhases;
}

type FormErrors = Record<string, string>;

const initialState: FormState = {
  category: '',
  brand: '',
  spuName: '',
  projectName: '',
  projectType: '',
  launchPhases: createEmptyLaunchPhases(),
};

export default function NewProjectPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initialState);
  const [errors, setErrors] = useState<FormErrors>({});

  const createProjectMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '创建项目失败');
      }

      return data;
    },
    onSuccess: (project) => {
      router.push(`/projects/${project.id}`);
    },
  });

  const canSubmit = useMemo(() => {
    return !createProjectMutation.isPending;
  }, [createProjectMutation.isPending]);

  const updateField = (key: keyof Omit<FormState, 'launchPhases'>, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const updatePhase = (phaseKey: LaunchPhaseKey, key: 'startDate' | 'endDate', value: string) => {
    setForm((prev) => ({
      ...prev,
      launchPhases: {
        ...prev.launchPhases,
        [phaseKey]: {
          ...prev.launchPhases[phaseKey],
          [key]: value,
        },
      },
    }));

    setErrors((prev) => {
      const next = { ...prev };
      delete next[`${phaseKey}.${key}`];
      delete next[phaseKey];
      return next;
    });
  };

  const validate = () => {
    const nextErrors: FormErrors = {};

    if (!form.category.trim()) nextErrors.category = '请选择品类';
    if (!form.brand.trim()) nextErrors.brand = '请输入品牌名称';
    if (!form.projectName.trim()) nextErrors.projectName = '请输入项目名称';
    if (!form.projectType) nextErrors.projectType = '请选择项目类型';

    for (const phase of LAUNCH_PHASES) {
      const value = form.launchPhases[phase.key];
      if (!value.startDate) {
        nextErrors[`${phase.key}.startDate`] = `请选择${phase.label}开始日期`;
      }
      if (!value.endDate) {
        nextErrors[`${phase.key}.endDate`] = `请选择${phase.label}结束日期`;
      }
      if (value.startDate && value.endDate && value.startDate > value.endDate) {
        nextErrors[phase.key] = `${phase.label}开始日期不能晚于结束日期`;
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) {
      return;
    }
    createProjectMutation.mutate();
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="新建项目"
        description="先完成项目基础信息，策划报告与底表在复盘阶段上传。"
      />

      <div className="rounded-lg border bg-white px-8 py-10 shadow-sm">
        <div className="mx-auto max-w-5xl">
          <div className="space-y-8">
            <div className="grid gap-6 md:grid-cols-2">
              <Field
                label="品类"
                required
                error={errors.category}
                value={form.category}
                onChange={(value) => updateField('category', value)}
                placeholder="请输入品类"
              />
              <Field
                label="品牌名称"
                required
                error={errors.brand}
                value={form.brand}
                onChange={(value) => updateField('brand', value)}
                placeholder="请输入品牌名称"
              />
            </div>

            <Field
              label="项目名称"
              required
              error={errors.projectName}
              value={form.projectName}
              onChange={(value) => updateField('projectName', value)}
              placeholder="请输入项目名称"
            />

            <div className="space-y-3">
              <label className="block text-sm font-medium text-slate-900">
                项目类型 <span className="text-rose-500">*</span>
              </label>
              <div className="space-y-3">
                {PROJECT_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => updateField('projectType', type)}
                    className={`flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                      form.projectType === type
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <span
                      className={`h-4 w-4 rounded-full border ${
                        form.projectType === type
                          ? 'border-blue-500 bg-blue-500 ring-4 ring-blue-100'
                          : 'border-slate-300'
                      }`}
                    />
                    <span>{type}</span>
                  </button>
                ))}
              </div>
              {errors.projectType && <p className="text-xs text-rose-500">{errors.projectType}</p>}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-900">传播周期</label>
                <p className="mt-1 text-xs text-slate-500">按预热期、爆发期、持续期分别录入时间。</p>
              </div>

              <div className="space-y-3">
                {LAUNCH_PHASES.map((phase) => {
                  const value = form.launchPhases[phase.key];
                  return (
                    <div key={phase.key} className="grid gap-3 md:grid-cols-[88px_minmax(0,1fr)]">
                      <div className="pt-2">
                        <span
                          className={`inline-flex rounded-md px-3 py-1 text-sm font-medium ${phase.accentClass}`}
                        >
                          {phase.label}
                        </span>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <input
                          type="date"
                          value={value.startDate}
                          onChange={(event) => updatePhase(phase.key, 'startDate', event.target.value)}
                          className="h-11 rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                        <input
                          type="date"
                          value={value.endDate}
                          onChange={(event) => updatePhase(phase.key, 'endDate', event.target.value)}
                          className="h-11 rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                        {(errors[`${phase.key}.startDate`] || errors[`${phase.key}.endDate`] || errors[phase.key]) && (
                          <p className="sm:col-span-2 text-xs text-rose-500">
                            {errors[`${phase.key}.startDate`] ||
                              errors[`${phase.key}.endDate`] ||
                              errors[phase.key]}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <Field
              label="涉及SPU"
              value={form.spuName}
              onChange={(value) => updateField('spuName', value)}
              placeholder="请输入一个或多个 SPU，使用顿号或逗号分隔"
            />
          </div>

          <div className="mt-10 flex items-center justify-end">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="inline-flex h-12 items-center gap-2 rounded-lg bg-blue-600 px-6 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {createProjectMutation.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <span>创建</span>
              )}
            </button>
          </div>

          {createProjectMutation.isError && (
            <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
              {(createProjectMutation.error as Error).message || '创建项目失败'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required = false,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  required?: boolean;
  error?: string;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-900">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
      {error && <p className="text-xs text-rose-500">{error}</p>}
    </div>
  );
}
