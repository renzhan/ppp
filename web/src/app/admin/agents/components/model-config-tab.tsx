'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Star, Pencil, Trash2, Loader2 } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ModelConfig {
  id: string;
  name: string;
  maskedApiKey?: string;
  apiKey?: string;
  baseUrl: string;
  modelName: string;
  timeoutMs: number;
  maxRetries: number;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ModelConfigFormData {
  name: string;
  apiKey: string;
  baseUrl: string;
  modelName: string;
  timeoutMs: number;
  maxRetries: number;
  isDefault: boolean;
}

interface ApiError {
  error: string;
  message: string;
  details?: Record<string, string>;
  references?: string[];
}

// ─── API helpers ─────────────────────────────────────────────────────────────

async function fetchModels(): Promise<ModelConfig[]> {
  const res = await fetch('/api/agent-mgmt/models');
  if (!res.ok) throw new Error('Failed to fetch model configurations');
  return res.json();
}

async function createModel(data: ModelConfigFormData): Promise<ModelConfig> {
  const res = await fetch('/api/agent-mgmt/models', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err: ApiError = await res.json();
    throw err;
  }
  return res.json();
}

async function updateModel(id: string, data: Partial<ModelConfigFormData>): Promise<ModelConfig> {
  const res = await fetch(`/api/agent-mgmt/models/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err: ApiError = await res.json();
    throw err;
  }
  return res.json();
}

async function deleteModel(id: string): Promise<void> {
  const res = await fetch(`/api/agent-mgmt/models/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const err: ApiError = await res.json();
    throw err;
  }
}

async function setDefaultModel(id: string): Promise<void> {
  const res = await fetch(`/api/agent-mgmt/models/${id}/set-default`, { method: 'POST' });
  if (!res.ok) {
    const err: ApiError = await res.json();
    throw err;
  }
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function ModelConfigTab() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<ModelConfig | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ModelConfig | null>(null);
  const [deleteError, setDeleteError] = useState<ApiError | null>(null);

  const { data: models = [], isLoading, error } = useQuery({
    queryKey: ['model-configs'],
    queryFn: fetchModels,
  });

  const setDefaultMutation = useMutation({
    mutationFn: setDefaultModel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['model-configs'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteModel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['model-configs'] });
      setDeleteTarget(null);
      setDeleteError(null);
    },
    onError: (err: ApiError) => {
      setDeleteError(err);
    },
  });

  const handleCreate = () => {
    setEditingConfig(null);
    setModalOpen(true);
  };

  const handleEdit = (config: ModelConfig) => {
    setEditingConfig(config);
    setModalOpen(true);
  };

  const handleDeleteClick = (config: ModelConfig) => {
    setDeleteTarget(config);
    setDeleteError(null);
  };

  const handleDeleteConfirm = () => {
    if (deleteTarget) {
      deleteMutation.mutate(deleteTarget.id);
    }
  };

  const handleSetDefault = (id: string) => {
    setDefaultMutation.mutate(id);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setEditingConfig(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        <span className="ml-2 text-sm text-gray-500">加载中...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        加载 Model 配置失败，请稍后重试。
      </div>
    );
  }

  return (
    <div>
      {/* Header with Create button */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-medium text-gray-900">Model 配置列表</h2>
        <button
          onClick={handleCreate}
          className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} />
          新建
        </button>
      </div>

      {/* Table */}
      {models.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
          <p className="text-sm text-gray-500">暂无 Model 配置，点击"新建"创建第一个配置。</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">名称</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">模型</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Base URL</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">API Key</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">默认</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {models.map((config) => (
                <tr key={config.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                    {config.name}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                    {config.modelName}
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-sm text-gray-600" title={config.baseUrl}>
                    {config.baseUrl}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500 font-mono">
                    {config.maskedApiKey || '****'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    {config.isDefault ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
                        <Star size={12} className="fill-yellow-500 text-yellow-500" />
                        默认
                      </span>
                    ) : (
                      <button
                        onClick={() => handleSetDefault(config.id)}
                        disabled={setDefaultMutation.isPending}
                        className="text-xs text-gray-400 hover:text-blue-600 transition-colors"
                      >
                        设为默认
                      </button>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleEdit(config)}
                        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-blue-600 transition-colors"
                        title="编辑"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(config)}
                        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600 transition-colors"
                        title="删除"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Modal */}
      {modalOpen && (
        <ModelFormModal
          config={editingConfig}
          onClose={handleModalClose}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['model-configs'] });
            handleModalClose();
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deleteTarget && (
        <DeleteConfirmDialog
          config={deleteTarget}
          error={deleteError}
          isPending={deleteMutation.isPending}
          onConfirm={handleDeleteConfirm}
          onCancel={() => {
            setDeleteTarget(null);
            setDeleteError(null);
          }}
        />
      )}
    </div>
  );
}

// ─── Form Modal ──────────────────────────────────────────────────────────────

interface ModelFormModalProps {
  config: ModelConfig | null;
  onClose: () => void;
  onSuccess: () => void;
}

function ModelFormModal({ config, onClose, onSuccess }: ModelFormModalProps) {
  const isEditing = !!config;

  const [formData, setFormData] = useState<ModelConfigFormData>({
    name: config?.name || '',
    apiKey: '',
    baseUrl: config?.baseUrl || '',
    modelName: config?.modelName || '',
    timeoutMs: config?.timeoutMs ?? 30000,
    maxRetries: config?.maxRetries ?? 2,
    isDefault: config?.isDefault ?? false,
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const createMutation = useMutation({
    mutationFn: (data: ModelConfigFormData) => createModel(data),
    onSuccess,
    onError: (err: ApiError) => {
      setFormError(err.message);
      if (err.details) setFieldErrors(err.details);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<ModelConfigFormData>) => updateModel(config!.id, data),
    onSuccess,
    onError: (err: ApiError) => {
      setFormError(err.message);
      if (err.details) setFieldErrors(err.details);
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});

    if (isEditing) {
      // Only send changed fields; skip apiKey if empty (means no change)
      const payload: Partial<ModelConfigFormData> = {};
      if (formData.name !== config.name) payload.name = formData.name;
      if (formData.apiKey) payload.apiKey = formData.apiKey;
      if (formData.baseUrl !== config.baseUrl) payload.baseUrl = formData.baseUrl;
      if (formData.modelName !== config.modelName) payload.modelName = formData.modelName;
      if (formData.timeoutMs !== config.timeoutMs) payload.timeoutMs = formData.timeoutMs;
      if (formData.maxRetries !== config.maxRetries) payload.maxRetries = formData.maxRetries;
      if (formData.isDefault !== config.isDefault) payload.isDefault = formData.isDefault;
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleChange = (field: keyof ModelConfigFormData, value: string | number | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear field error on change
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-4 text-lg font-semibold text-gray-900">
          {isEditing ? '编辑 Model 配置' : '新建 Model 配置'}
        </h3>

        {formError && (
          <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <FormField
            label="名称"
            required
            error={fieldErrors['name']}
          >
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="例如：GPT-4o 生产配置"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </FormField>

          {/* API Key */}
          <FormField
            label="API Key"
            required={!isEditing}
            error={fieldErrors['apiKey']}
            hint={isEditing ? '留空表示不修改' : undefined}
          >
            <input
              type="password"
              value={formData.apiKey}
              onChange={(e) => handleChange('apiKey', e.target.value)}
              placeholder={isEditing ? '留空表示不修改' : 'sk-...'}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </FormField>

          {/* Base URL */}
          <FormField
            label="Base URL"
            required
            error={fieldErrors['baseUrl']}
          >
            <input
              type="url"
              value={formData.baseUrl}
              onChange={(e) => handleChange('baseUrl', e.target.value)}
              placeholder="https://api.openai.com/v1"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </FormField>

          {/* Model Name */}
          <FormField
            label="模型名称"
            required
            error={fieldErrors['modelName']}
          >
            <input
              type="text"
              value={formData.modelName}
              onChange={(e) => handleChange('modelName', e.target.value)}
              placeholder="gpt-4o"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </FormField>

          {/* Timeout & Retries row */}
          <div className="grid grid-cols-2 gap-4">
            <FormField label="超时时间 (ms)" error={fieldErrors['timeoutMs']}>
              <input
                type="number"
                value={formData.timeoutMs}
                onChange={(e) => handleChange('timeoutMs', parseInt(e.target.value) || 30000)}
                min={1000}
                step={1000}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </FormField>
            <FormField label="最大重试次数" error={fieldErrors['maxRetries']}>
              <input
                type="number"
                value={formData.maxRetries}
                onChange={(e) => handleChange('maxRetries', parseInt(e.target.value) || 0)}
                min={0}
                max={10}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </FormField>
          </div>

          {/* Is Default */}
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={formData.isDefault}
              onChange={(e) => handleChange('isDefault', e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            设为默认配置
          </label>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isPending && <Loader2 size={14} className="animate-spin" />}
              {isEditing ? '保存' : '创建'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Delete Confirmation Dialog ──────────────────────────────────────────────

interface DeleteConfirmDialogProps {
  config: ModelConfig;
  error: ApiError | null;
  isPending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function DeleteConfirmDialog({ config, error, isPending, onConfirm, onCancel }: DeleteConfirmDialogProps) {
  const hasConflict = error?.error === 'REFERENCE_CONFLICT';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onCancel}>
      <div
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-gray-900">确认删除</h3>

        {hasConflict ? (
          <div className="mt-3">
            <p className="text-sm text-red-700">
              无法删除配置 <span className="font-medium">&ldquo;{config.name}&rdquo;</span>，因为以下 Agent 正在引用该配置：
            </p>
            <ul className="mt-2 list-disc pl-5 text-sm text-gray-700">
              {error!.references?.map((ref, i) => (
                <li key={i}>{ref}</li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-gray-500">
              请先修改这些 Agent 的 Model 配置后再删除。
            </p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-gray-600">
            确定要删除 Model 配置 <span className="font-medium">&ldquo;{config.name}&rdquo;</span> 吗？此操作不可撤销。
          </p>
        )}

        <div className="mt-5 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            {hasConflict ? '关闭' : '取消'}
          </button>
          {!hasConflict && (
            <button
              onClick={onConfirm}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {isPending && <Loader2 size={14} className="animate-spin" />}
              删除
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Shared Form Field ───────────────────────────────────────────────────────

interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}

function FormField({ label, required, error, hint, children }: FormFieldProps) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
      {hint && !error && (
        <p className="mt-1 text-xs text-gray-400">{hint}</p>
      )}
      {error && (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}
