'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Plus, Loader2, Trash2, Crown, Bot } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Agent {
  id: string;
  name: string;
  description: string | null;
  type: string; // "master" | "workspace"
  workspaceId: string | null;
  modelConfigId: string | null;
  systemPrompt: string | null;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  workspace?: { id: string; name: string } | null;
  modelConfig?: { id: string; name: string } | null;
}

interface Workspace {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  isEnabled: boolean;
}

interface ModelConfig {
  id: string;
  name: string;
  modelName: string;
  isDefault: boolean;
}

interface CreateAgentFormData {
  name: string;
  workspaceId: string;
  modelConfigId: string;
  description: string;
}

interface ApiError {
  error: string;
  message: string;
  details?: Record<string, string>;
  references?: string[];
}

// ─── API helpers ─────────────────────────────────────────────────────────────

async function fetchAgents(): Promise<Agent[]> {
  const res = await fetch('/api/agent-mgmt/agents');
  if (!res.ok) throw new Error('Failed to fetch agents');
  return res.json();
}

async function fetchWorkspaces(): Promise<Workspace[]> {
  const res = await fetch('/api/agent-mgmt/workspaces');
  if (!res.ok) throw new Error('Failed to fetch workspaces');
  return res.json();
}

async function fetchModels(): Promise<ModelConfig[]> {
  const res = await fetch('/api/agent-mgmt/models');
  if (!res.ok) throw new Error('Failed to fetch model configurations');
  return res.json();
}

async function createAgent(data: {
  name: string;
  workspaceId: string;
  modelConfigId?: string;
  description?: string;
}): Promise<Agent> {
  const res = await fetch('/api/agent-mgmt/agents', {
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

async function toggleAgent(id: string, enabled: boolean): Promise<Agent> {
  const res = await fetch(`/api/agent-mgmt/agents/${id}/toggle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  });
  if (!res.ok) {
    const err: ApiError = await res.json();
    throw err;
  }
  return res.json();
}

async function deleteAgent(id: string): Promise<void> {
  const res = await fetch(`/api/agent-mgmt/agents/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const err: ApiError = await res.json();
    throw err;
  }
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function AgentTab() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Agent | null>(null);

  const { data: agents = [], isLoading, error } = useQuery({
    queryKey: ['agents'],
    queryFn: fetchAgents,
  });

  const { data: workspaces = [] } = useQuery({
    queryKey: ['workspaces'],
    queryFn: fetchWorkspaces,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => toggleAgent(id, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAgent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      setDeleteTarget(null);
    },
  });

  const handleToggle = (agent: Agent) => {
    toggleMutation.mutate({ id: agent.id, enabled: !agent.isEnabled });
  };

  const handleNavigateToDetail = (agentId: string) => {
    router.push(`/admin/agents/${agentId}`);
  };

  // Separate master agent and workspace agents
  const masterAgent = agents.find((a) => a.type === 'master');
  const workspaceAgents = agents.filter((a) => a.type === 'workspace');

  // Group workspace agents by workspace
  const agentsByWorkspace = new Map<string, { workspace: Workspace; agents: Agent[] }>();
  for (const ws of workspaces) {
    agentsByWorkspace.set(ws.id, { workspace: ws, agents: [] });
  }
  for (const agent of workspaceAgents) {
    if (agent.workspaceId) {
      const group = agentsByWorkspace.get(agent.workspaceId);
      if (group) {
        group.agents.push(agent);
      } else {
        // Workspace not in list (edge case), create a placeholder
        agentsByWorkspace.set(agent.workspaceId, {
          workspace: {
            id: agent.workspaceId,
            name: agent.workspace?.name || '未知工作区',
            description: null,
            icon: null,
            isEnabled: true,
          },
          agents: [agent],
        });
      }
    }
  }

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
        加载 Agent 列表失败，请稍后重试。
      </div>
    );
  }

  return (
    <div>
      {/* Header with Create button */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-medium text-gray-900">Agent 列表</h2>
        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} />
          新建 Agent
        </button>
      </div>

      {/* Master Agent Section */}
      {masterAgent && (
        <div className="mb-6">
          <h3 className="mb-2 text-sm font-medium text-gray-500 uppercase tracking-wider">
            Master Agent
          </h3>
          <div className="rounded-lg border border-gray-200 bg-white">
            <AgentRow
              agent={masterAgent}
              onToggle={handleToggle}
              onNavigate={handleNavigateToDetail}
              onDelete={() => {}}
              isMaster
              togglePending={toggleMutation.isPending}
            />
          </div>
        </div>
      )}

      {/* Workspace Agents grouped by workspace */}
      <div className="space-y-6">
        {Array.from(agentsByWorkspace.values())
          .filter((group) => group.agents.length > 0 || true) // Show all workspaces
          .map((group) => (
            <div key={group.workspace.id}>
              <h3 className="mb-2 text-sm font-medium text-gray-500 uppercase tracking-wider">
                {group.workspace.name}
              </h3>
              {group.agents.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center">
                  <p className="text-sm text-gray-400">该工作区暂无 Agent</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
                  {group.agents.map((agent) => (
                    <AgentRow
                      key={agent.id}
                      agent={agent}
                      onToggle={handleToggle}
                      onNavigate={handleNavigateToDetail}
                      onDelete={(a) => setDeleteTarget(a)}
                      isMaster={false}
                      togglePending={toggleMutation.isPending}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
      </div>

      {/* Create Modal */}
      {modalOpen && (
        <AgentFormModal
          onClose={() => setModalOpen(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['agents'] });
            setModalOpen(false);
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deleteTarget && (
        <DeleteConfirmDialog
          agent={deleteTarget}
          isPending={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

// ─── Agent Row ───────────────────────────────────────────────────────────────

interface AgentRowProps {
  agent: Agent;
  onToggle: (agent: Agent) => void;
  onNavigate: (id: string) => void;
  onDelete: (agent: Agent) => void;
  isMaster: boolean;
  togglePending: boolean;
}

function AgentRow({ agent, onToggle, onNavigate, onDelete, isMaster, togglePending }: AgentRowProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex-shrink-0">
          {isMaster ? (
            <Crown size={18} className="text-yellow-500" />
          ) : (
            <Bot size={18} className="text-gray-400" />
          )}
        </div>
        <div className="min-w-0">
          <button
            onClick={() => onNavigate(agent.id)}
            className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline truncate block"
          >
            {agent.name}
          </button>
          {agent.description && (
            <p className="text-xs text-gray-500 truncate">{agent.description}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 flex-shrink-0">
        {/* Model config badge */}
        {agent.modelConfig && (
          <span className="hidden sm:inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
            {agent.modelConfig.name}
          </span>
        )}

        {/* Toggle switch */}
        <button
          onClick={() => onToggle(agent)}
          disabled={togglePending}
          className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
            agent.isEnabled ? 'bg-blue-600' : 'bg-gray-200'
          }`}
          role="switch"
          aria-checked={agent.isEnabled}
          aria-label={`${agent.isEnabled ? '禁用' : '启用'} ${agent.name}`}
        >
          <span
            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              agent.isEnabled ? 'translate-x-4' : 'translate-x-0'
            }`}
          />
        </button>

        {/* Delete button (not for master) */}
        {!isMaster && (
          <button
            onClick={() => onDelete(agent)}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600 transition-colors"
            title="删除"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Create Agent Modal ──────────────────────────────────────────────────────

interface AgentFormModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

function AgentFormModal({ onClose, onSuccess }: AgentFormModalProps) {
  const [formData, setFormData] = useState<CreateAgentFormData>({
    name: '',
    workspaceId: '',
    modelConfigId: '',
    description: '',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const { data: workspaces = [] } = useQuery({
    queryKey: ['workspaces'],
    queryFn: fetchWorkspaces,
  });

  const { data: models = [] } = useQuery({
    queryKey: ['model-configs'],
    queryFn: fetchModels,
  });

  const createMutation = useMutation({
    mutationFn: createAgent,
    onSuccess,
    onError: (err: ApiError) => {
      setFormError(err.message);
      if (err.details) setFieldErrors(err.details);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});

    // Client-side validation
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) errors.name = '名称不能为空';
    if (!formData.workspaceId) errors.workspaceId = '请选择工作区';

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    createMutation.mutate({
      name: formData.name.trim(),
      workspaceId: formData.workspaceId,
      modelConfigId: formData.modelConfigId || undefined,
      description: formData.description.trim() || undefined,
    });
  };

  const handleChange = (field: keyof CreateAgentFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
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
        <h3 className="mb-4 text-lg font-semibold text-gray-900">新建 Agent</h3>

        {formError && (
          <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <FormField label="名称" required error={fieldErrors['name']}>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="例如：复盘文档生成 Agent"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </FormField>

          {/* Workspace */}
          <FormField label="工作区" required error={fieldErrors['workspaceId']}>
            <select
              value={formData.workspaceId}
              onChange={(e) => handleChange('workspaceId', e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">请选择工作区</option>
              {workspaces.map((ws) => (
                <option key={ws.id} value={ws.id}>
                  {ws.name}
                </option>
              ))}
            </select>
          </FormField>

          {/* Model Config */}
          <FormField label="Model 配置" error={fieldErrors['modelConfigId']}>
            <select
              value={formData.modelConfigId}
              onChange={(e) => handleChange('modelConfigId', e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">使用默认配置</option>
              {models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name} ({model.modelName})
                  {model.isDefault ? ' ★ 默认' : ''}
                </option>
              ))}
            </select>
          </FormField>

          {/* Description */}
          <FormField label="描述" error={fieldErrors['description']}>
            <textarea
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Agent 的功能描述..."
              rows={3}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
            />
          </FormField>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={createMutation.isPending}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {createMutation.isPending && <Loader2 size={14} className="animate-spin" />}
              创建
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Delete Confirmation Dialog ──────────────────────────────────────────────

interface DeleteConfirmDialogProps {
  agent: Agent;
  isPending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function DeleteConfirmDialog({ agent, isPending, onConfirm, onCancel }: DeleteConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onCancel}>
      <div
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-gray-900">确认删除</h3>
        <p className="mt-3 text-sm text-gray-600">
          确定要删除 Agent <span className="font-medium">&ldquo;{agent.name}&rdquo;</span> 吗？此操作不可撤销。
        </p>

        <div className="mt-5 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {isPending && <Loader2 size={14} className="animate-spin" />}
            删除
          </button>
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
  children: React.ReactNode;
}

function FormField({ label, required, error, children }: FormFieldProps) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
      {error && (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}
