'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Loader2,
  Save,
  Plus,
  X,
  Crown,
  Bot,
  Sparkles,
  Wrench,
  Shield,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AgentDetail {
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
  agentSkills?: { id: string; skill: SkillRef }[];
}

interface SkillRef {
  id: string;
  name: string;
  description: string | null;
  scope: string;
}

interface ModelConfig {
  id: string;
  name: string;
  modelName: string;
  isDefault: boolean;
}

interface Skill {
  id: string;
  name: string;
  description: string | null;
  scope: string;
  workspaceId: string | null;
}

interface NativeTool {
  id: string;
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputFormat: string | null;
  isBuiltin: boolean;
  createdAt: string;
}

interface ApiError {
  error: string;
  message: string;
  details?: Record<string, string>;
}

// ─── API helpers ─────────────────────────────────────────────────────────────

async function fetchAgent(id: string): Promise<AgentDetail> {
  const res = await fetch(`/api/agent-mgmt/agents/${id}`);
  if (!res.ok) {
    const err: ApiError = await res.json();
    throw err;
  }
  return res.json();
}

async function updateAgent(
  id: string,
  data: { name?: string; description?: string; modelConfigId?: string | null; systemPrompt?: string }
): Promise<AgentDetail> {
  const res = await fetch(`/api/agent-mgmt/agents/${id}`, {
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

async function fetchModels(): Promise<ModelConfig[]> {
  const res = await fetch('/api/agent-mgmt/models');
  if (!res.ok) throw new Error('Failed to fetch model configurations');
  return res.json();
}

async function fetchSkills(): Promise<Skill[]> {
  const res = await fetch('/api/agent-mgmt/skills');
  if (!res.ok) throw new Error('Failed to fetch skills');
  return res.json();
}

async function attachSkill(agentId: string, skillId: string): Promise<void> {
  const res = await fetch(`/api/agent-mgmt/agents/${agentId}/skills`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ skillId }),
  });
  if (!res.ok) {
    const err: ApiError = await res.json();
    throw err;
  }
}

async function detachSkill(agentId: string, skillId: string): Promise<void> {
  const res = await fetch(`/api/agent-mgmt/agents/${agentId}/skills/${skillId}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err: ApiError = await res.json();
    throw err;
  }
}

async function fetchNativeTools(): Promise<NativeTool[]> {
  const res = await fetch('/api/agent-mgmt/native-tools');
  if (!res.ok) throw new Error('Failed to fetch native tools');
  return res.json();
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function AgentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const agentId = params.id as string;

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [modelConfigId, setModelConfigId] = useState<string>('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showSkillPicker, setShowSkillPicker] = useState(false);

  // Queries
  const {
    data: agent,
    isLoading: agentLoading,
    error: agentError,
  } = useQuery({
    queryKey: ['agent', agentId],
    queryFn: () => fetchAgent(agentId),
    enabled: !!agentId,
  });

  const { data: models = [] } = useQuery({
    queryKey: ['model-configs'],
    queryFn: fetchModels,
  });

  const { data: allSkills = [] } = useQuery({
    queryKey: ['skills'],
    queryFn: fetchSkills,
  });

  const { data: nativeTools = [] } = useQuery({
    queryKey: ['native-tools'],
    queryFn: fetchNativeTools,
  });

  // Initialize form when agent data loads
  useEffect(() => {
    if (agent) {
      setName(agent.name);
      setDescription(agent.description || '');
      setSystemPrompt(agent.systemPrompt || '');
      setModelConfigId(agent.modelConfigId || '');
    }
  }, [agent]);

  // Mutations
  const saveMutation = useMutation({
    mutationFn: (data: { name?: string; description?: string; modelConfigId?: string | null; systemPrompt?: string }) =>
      updateAgent(agentId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent', agentId] });
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      setSaveError(null);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    },
    onError: (err: ApiError) => {
      setSaveError(err.message || '保存失败');
    },
  });

  const attachMutation = useMutation({
    mutationFn: (skillId: string) => attachSkill(agentId, skillId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent', agentId] });
    },
  });

  const detachMutation = useMutation({
    mutationFn: (skillId: string) => detachSkill(agentId, skillId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent', agentId] });
    },
  });

  // Handlers
  const handleSave = () => {
    setSaveError(null);
    setSaveSuccess(false);

    const payload: { name?: string; description?: string; modelConfigId?: string | null; systemPrompt?: string } = {};

    if (name.trim() !== (agent?.name || '')) payload.name = name.trim();
    if (description.trim() !== (agent?.description || '')) payload.description = description.trim();
    if (systemPrompt !== (agent?.systemPrompt || '')) payload.systemPrompt = systemPrompt;
    if (modelConfigId !== (agent?.modelConfigId || '')) {
      payload.modelConfigId = modelConfigId || null;
    }

    if (Object.keys(payload).length === 0) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      return;
    }

    saveMutation.mutate(payload);
  };

  const handleAttachSkill = (skillId: string) => {
    attachMutation.mutate(skillId);
    setShowSkillPicker(false);
  };

  const handleDetachSkill = (skillId: string) => {
    detachMutation.mutate(skillId);
  };

  // Compute available skills (not already attached)
  const attachedSkillIds = new Set(agent?.agentSkills?.map((as) => as.skill.id) || []);
  const availableSkills = allSkills.filter((s) => !attachedSkillIds.has(s.id));

  // Loading state
  if (agentLoading) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          <span className="ml-2 text-sm text-gray-500">加载中...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (agentError || !agent) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <button
            onClick={() => router.push('/admin/agents')}
            className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft size={16} />
            返回 Agent 列表
          </button>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Agent 不存在或加载失败。
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      {/* Back button */}
      <div className="mb-6">
        <button
          onClick={() => router.push('/admin/agents')}
          className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft size={16} />
          返回 Agent 列表
        </button>
      </div>

      {/* Page header */}
      <div className="mb-8 flex items-center gap-3">
        {agent.type === 'master' ? (
          <Crown size={24} className="text-yellow-500" />
        ) : (
          <Bot size={24} className="text-blue-500" />
        )}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{agent.name}</h1>
          <p className="text-sm text-gray-500">
            {agent.type === 'master' ? 'Master Agent' : '工作区 Agent'}
            {agent.workspace && ` · ${agent.workspace.name}`}
          </p>
        </div>
      </div>

      {/* Save feedback */}
      {saveError && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {saveError}
        </div>
      )}
      {saveSuccess && (
        <div className="mb-4 rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-700">
          保存成功
        </div>
      )}

      <div className="space-y-8">
        {/* ─── Basic Info Section ─── */}
        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-medium text-gray-900">基本信息</h2>
          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                名称 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Description */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">描述</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Agent 的功能描述..."
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
              />
            </div>

            {/* Type (read-only) */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">类型</label>
              <input
                type="text"
                value={agent.type === 'master' ? 'Master Agent' : 'Workspace Agent'}
                readOnly
                className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600 cursor-not-allowed"
              />
            </div>

            {/* Workspace (read-only) */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">所属工作区</label>
              <input
                type="text"
                value={agent.workspace?.name || '无（Master Agent）'}
                readOnly
                className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600 cursor-not-allowed"
              />
            </div>
          </div>
        </section>

        {/* ─── System Prompt Section ─── */}
        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-medium text-gray-900">系统提示词</h2>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={16}
            placeholder="在此输入 Agent 的系统提示词（支持 Markdown 格式）..."
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y"
          />
          <p className="mt-2 text-xs text-gray-400">
            系统提示词将在 Agent 执行任务时作为上下文注入，关联的 Skill 内容也会自动追加。
          </p>
        </section>

        {/* ─── Model Config Section ─── */}
        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-medium text-gray-900">Model 配置</h2>
          <select
            value={modelConfigId}
            onChange={(e) => setModelConfigId(e.target.value)}
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
          <p className="mt-2 text-xs text-gray-400">
            选择该 Agent 使用的 LLM 模型配置，留空则使用系统默认配置。
          </p>
        </section>

        {/* ─── Skills Section ─── */}
        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-medium text-gray-900">关联 Skill</h2>
            <button
              onClick={() => setShowSkillPicker(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors"
            >
              <Plus size={14} />
              添加 Skill
            </button>
          </div>

          {/* Attached skills list */}
          {agent.agentSkills && agent.agentSkills.length > 0 ? (
            <div className="divide-y divide-gray-100 rounded-md border border-gray-200">
              {agent.agentSkills.map((as) => (
                <div
                  key={as.id}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Sparkles size={14} className="text-purple-500 flex-shrink-0" />
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {as.skill.name}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                      {as.skill.scope === 'public' ? '公用' : '专属'}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDetachSkill(as.skill.id)}
                    disabled={detachMutation.isPending}
                    className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600 transition-colors"
                    title="移除"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-gray-300 p-6 text-center">
              <p className="text-sm text-gray-400">暂未关联任何 Skill</p>
            </div>
          )}
        </section>

        {/* ─── Native Tools Section (Read-only) ─── */}
        <NativeToolsSection tools={nativeTools} />

        {/* ─── Save Button ─── */}
        <div className="flex justify-end pb-8">
          <button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saveMutation.isPending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Save size={16} />
            )}
            保存修改
          </button>
        </div>
      </div>

      {/* ─── Skill Picker Modal ─── */}
      {showSkillPicker && (
        <SkillPickerModal
          availableSkills={availableSkills}
          onSelect={handleAttachSkill}
          onClose={() => setShowSkillPicker(false)}
          isPending={attachMutation.isPending}
        />
      )}
    </div>
  );
}

// ─── Skill Picker Modal ──────────────────────────────────────────────────────

interface SkillPickerModalProps {
  availableSkills: Skill[];
  onSelect: (skillId: string) => void;
  onClose: () => void;
  isPending: boolean;
}

function SkillPickerModal({ availableSkills, onSelect, onClose, isPending }: SkillPickerModalProps) {
  const [search, setSearch] = useState('');

  const filtered = availableSkills.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.description && s.description.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[70vh] flex flex-col rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h3 className="text-lg font-semibold text-gray-900">添加 Skill</h3>
          <button
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Search */}
        <div className="border-b border-gray-200 px-6 py-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索 Skill..."
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Skill list */}
        <div className="flex-1 overflow-y-auto px-6 py-3">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">
              {availableSkills.length === 0 ? '没有可添加的 Skill' : '未找到匹配的 Skill'}
            </p>
          ) : (
            <div className="space-y-2">
              {filtered.map((skill) => (
                <button
                  key={skill.id}
                  onClick={() => onSelect(skill.id)}
                  disabled={isPending}
                  className="w-full rounded-md border border-gray-200 px-4 py-3 text-left hover:border-blue-300 hover:bg-blue-50 transition-colors disabled:opacity-50"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">
                      {skill.name}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                      {skill.scope === 'public' ? '公用' : '专属'}
                    </span>
                  </div>
                  {skill.description && (
                    <p className="mt-1 text-xs text-gray-500 truncate">
                      {skill.description}
                    </p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Native Tools Section (Read-only) ────────────────────────────────────────

interface NativeToolsSectionProps {
  tools: NativeTool[];
}

function NativeToolsSection({ tools }: NativeToolsSectionProps) {
  const [expanded, setExpanded] = useState(true);
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());

  const toggleTool = (toolId: string) => {
    setExpandedTools((prev) => {
      const next = new Set(prev);
      if (next.has(toolId)) {
        next.delete(toolId);
      } else {
        next.add(toolId);
      }
      return next;
    });
  };

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <Wrench size={18} className="text-gray-500" />
          <h2 className="text-lg font-medium text-gray-900">原生工具</h2>
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
            <Shield size={10} />
            系统内置
          </span>
        </div>
        {expanded ? (
          <ChevronDown size={18} className="text-gray-400" />
        ) : (
          <ChevronRight size={18} className="text-gray-400" />
        )}
      </button>

      {expanded && (
        <div className="mt-4">
          <p className="mb-3 text-xs text-gray-400">
            以下为系统内置的原生工具，Agent 执行任务时可自动调用。原生工具不可编辑或删除。
          </p>

          {tools.length === 0 ? (
            <div className="rounded-md border border-dashed border-gray-300 p-6 text-center">
              <p className="text-sm text-gray-400">暂无原生工具数据</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tools.map((tool) => (
                <div
                  key={tool.id}
                  className="rounded-md border border-gray-200 bg-gray-50"
                >
                  <button
                    onClick={() => toggleTool(tool.id)}
                    className="flex w-full items-center justify-between px-4 py-3 text-left"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Wrench size={14} className="text-gray-400 flex-shrink-0" />
                      <span className="text-sm font-medium text-gray-900 font-mono">
                        {tool.name}
                      </span>
                      <span className="text-sm text-gray-500 truncate">
                        — {tool.description}
                      </span>
                    </div>
                    {expandedTools.has(tool.id) ? (
                      <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />
                    ) : (
                      <ChevronRight size={14} className="text-gray-400 flex-shrink-0" />
                    )}
                  </button>

                  {expandedTools.has(tool.id) && (
                    <div className="border-t border-gray-200 px-4 py-3">
                      <div className="mb-2">
                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                          输入参数 Schema
                        </span>
                      </div>
                      <pre className="overflow-x-auto rounded-md bg-white border border-gray-200 p-3 text-xs text-gray-700 font-mono">
                        {JSON.stringify(tool.inputSchema, null, 2)}
                      </pre>
                      {tool.outputFormat && (
                        <div className="mt-2 text-xs text-gray-500">
                          输出格式：<span className="font-mono">{tool.outputFormat}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
