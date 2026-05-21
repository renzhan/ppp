'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Loader2, History, Globe, Building2 } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Skill {
  id: string;
  name: string;
  description: string | null;
  content: string;
  scope: 'public' | 'workspace';
  workspaceId: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  workspace?: { id: string; name: string } | null;
}

interface SkillVersion {
  id: string;
  skillId: string;
  version: number;
  content: string;
  createdAt: string;
}

interface Workspace {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  isEnabled: boolean;
}

interface SkillFormData {
  name: string;
  description: string;
  content: string;
  scope: 'public' | 'workspace';
  workspaceId: string;
}

interface ApiError {
  error: string;
  message: string;
  details?: Record<string, string>;
  references?: string[];
}

// ─── API helpers ─────────────────────────────────────────────────────────────

async function fetchSkills(): Promise<Skill[]> {
  const res = await fetch('/api/agent-mgmt/skills');
  if (!res.ok) throw new Error('Failed to fetch skills');
  return res.json();
}

async function fetchWorkspaces(): Promise<Workspace[]> {
  const res = await fetch('/api/agent-mgmt/workspaces');
  if (!res.ok) throw new Error('Failed to fetch workspaces');
  return res.json();
}

async function createSkill(data: SkillFormData): Promise<Skill> {
  const payload: Record<string, unknown> = {
    name: data.name,
    description: data.description,
    content: data.content,
    scope: data.scope,
  };
  if (data.scope === 'workspace' && data.workspaceId) {
    payload.workspaceId = data.workspaceId;
  }
  const res = await fetch('/api/agent-mgmt/skills', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err: ApiError = await res.json();
    throw err;
  }
  return res.json();
}

async function updateSkill(id: string, data: Partial<SkillFormData>): Promise<Skill> {
  const res = await fetch(`/api/agent-mgmt/skills/${id}`, {
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

async function deleteSkill(id: string): Promise<void> {
  const res = await fetch(`/api/agent-mgmt/skills/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const err: ApiError = await res.json();
    throw err;
  }
}

async function fetchVersionHistory(id: string): Promise<SkillVersion[]> {
  const res = await fetch(`/api/agent-mgmt/skills/${id}/versions`);
  if (!res.ok) throw new Error('Failed to fetch version history');
  return res.json();
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function SkillTab() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Skill | null>(null);
  const [deleteError, setDeleteError] = useState<ApiError | null>(null);
  const [versionTarget, setVersionTarget] = useState<Skill | null>(null);

  const { data: skills = [], isLoading, error } = useQuery({
    queryKey: ['skills'],
    queryFn: fetchSkills,
  });

  const { data: workspaces = [] } = useQuery({
    queryKey: ['workspaces'],
    queryFn: fetchWorkspaces,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSkill,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills'] });
      setDeleteTarget(null);
      setDeleteError(null);
    },
    onError: (err: ApiError) => {
      setDeleteError(err);
    },
  });

  const handleCreate = () => {
    setEditingSkill(null);
    setModalOpen(true);
  };

  const handleEdit = (skill: Skill) => {
    setEditingSkill(skill);
    setModalOpen(true);
  };

  const handleDeleteClick = (skill: Skill) => {
    setDeleteTarget(skill);
    setDeleteError(null);
  };

  const handleDeleteConfirm = () => {
    if (deleteTarget) {
      deleteMutation.mutate(deleteTarget.id);
    }
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setEditingSkill(null);
  };

  // Separate public skills and workspace-scoped skills
  const publicSkills = skills.filter((s) => s.scope === 'public');
  const workspaceSkills = skills.filter((s) => s.scope === 'workspace');

  // Group workspace skills by workspace
  const skillsByWorkspace = new Map<string, { workspace: Workspace; skills: Skill[] }>();
  for (const ws of workspaces) {
    skillsByWorkspace.set(ws.id, { workspace: ws, skills: [] });
  }
  for (const skill of workspaceSkills) {
    if (skill.workspaceId) {
      const group = skillsByWorkspace.get(skill.workspaceId);
      if (group) {
        group.skills.push(skill);
      } else {
        skillsByWorkspace.set(skill.workspaceId, {
          workspace: {
            id: skill.workspaceId,
            name: skill.workspace?.name || '未知工作区',
            description: null,
            icon: null,
            isEnabled: true,
          },
          skills: [skill],
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
        加载 Skill 列表失败，请稍后重试。
      </div>
    );
  }

  return (
    <div>
      {/* Header with Create button */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-medium text-gray-900">Skill 列表</h2>
        <button
          onClick={handleCreate}
          className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} />
          新建 Skill
        </button>
      </div>

      {/* Public Skills Section */}
      <div className="mb-6">
        <h3 className="mb-2 text-sm font-medium text-gray-500 uppercase tracking-wider">
          公用 Skill
        </h3>
        {publicSkills.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center">
            <p className="text-sm text-gray-400">暂无公用 Skill</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
            {publicSkills.map((skill) => (
              <SkillRow
                key={skill.id}
                skill={skill}
                onEdit={handleEdit}
                onDelete={handleDeleteClick}
                onViewVersions={setVersionTarget}
              />
            ))}
          </div>
        )}
      </div>

      {/* Workspace Skills grouped by workspace */}
      <div className="space-y-6">
        {Array.from(skillsByWorkspace.values())
          .filter((group) => group.skills.length > 0)
          .map((group) => (
            <div key={group.workspace.id}>
              <h3 className="mb-2 text-sm font-medium text-gray-500 uppercase tracking-wider">
                {group.workspace.name}
              </h3>
              <div className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
                {group.skills.map((skill) => (
                  <SkillRow
                    key={skill.id}
                    skill={skill}
                    onEdit={handleEdit}
                    onDelete={handleDeleteClick}
                    onViewVersions={setVersionTarget}
                  />
                ))}
              </div>
            </div>
          ))}
      </div>

      {/* Create/Edit Modal */}
      {modalOpen && (
        <SkillFormModal
          skill={editingSkill}
          onClose={handleModalClose}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['skills'] });
            handleModalClose();
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deleteTarget && (
        <DeleteConfirmDialog
          skill={deleteTarget}
          error={deleteError}
          isPending={deleteMutation.isPending}
          onConfirm={handleDeleteConfirm}
          onCancel={() => {
            setDeleteTarget(null);
            setDeleteError(null);
          }}
        />
      )}

      {/* Version History Modal */}
      {versionTarget && (
        <VersionHistoryModal
          skill={versionTarget}
          onClose={() => setVersionTarget(null)}
        />
      )}
    </div>
  );
}

// ─── Skill Row ───────────────────────────────────────────────────────────────

interface SkillRowProps {
  skill: Skill;
  onEdit: (skill: Skill) => void;
  onDelete: (skill: Skill) => void;
  onViewVersions: (skill: Skill) => void;
}

function SkillRow({ skill, onEdit, onDelete, onViewVersions }: SkillRowProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900 truncate">
            {skill.name}
          </span>
          {/* Scope badge */}
          {skill.scope === 'public' ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
              <Globe size={10} />
              公用
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
              <Building2 size={10} />
              专属
            </span>
          )}
          {/* Version badge */}
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
            v{skill.version}
          </span>
        </div>
        {skill.description && (
          <p className="mt-0.5 text-xs text-gray-500 truncate">{skill.description}</p>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0 ml-4">
        <button
          onClick={() => onViewVersions(skill)}
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-blue-600 transition-colors"
          title="版本历史"
        >
          <History size={16} />
        </button>
        <button
          onClick={() => onEdit(skill)}
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-blue-600 transition-colors"
          title="编辑"
        >
          <Pencil size={16} />
        </button>
        <button
          onClick={() => onDelete(skill)}
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600 transition-colors"
          title="删除"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

// ─── Skill Form Modal ────────────────────────────────────────────────────────

interface SkillFormModalProps {
  skill: Skill | null;
  onClose: () => void;
  onSuccess: () => void;
}

function SkillFormModal({ skill, onClose, onSuccess }: SkillFormModalProps) {
  const isEditing = !!skill;

  const [formData, setFormData] = useState<SkillFormData>({
    name: skill?.name || '',
    description: skill?.description || '',
    content: skill?.content || '',
    scope: skill?.scope || 'public',
    workspaceId: skill?.workspaceId || '',
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const { data: workspaces = [] } = useQuery({
    queryKey: ['workspaces'],
    queryFn: fetchWorkspaces,
  });

  const createMutation = useMutation({
    mutationFn: (data: SkillFormData) => createSkill(data),
    onSuccess,
    onError: (err: ApiError) => {
      setFormError(err.message);
      if (err.details) setFieldErrors(err.details);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<SkillFormData>) => updateSkill(skill!.id, data),
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

    // Client-side validation
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) errors.name = '名称不能为空';
    if (!formData.description.trim()) errors.description = '描述不能为空';
    if (!formData.content.trim()) errors.content = '内容不能为空';
    if (formData.scope === 'workspace' && !formData.workspaceId) {
      errors.workspaceId = '请选择工作区';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    if (isEditing) {
      const payload: Partial<SkillFormData> = {};
      if (formData.name !== skill.name) payload.name = formData.name.trim();
      if (formData.description !== (skill.description || '')) payload.description = formData.description.trim();
      if (formData.content !== skill.content) payload.content = formData.content;
      // Only send if there are changes
      if (Object.keys(payload).length === 0) {
        onSuccess();
        return;
      }
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate({
        ...formData,
        name: formData.name.trim(),
        description: formData.description.trim(),
      });
    }
  };

  const handleChange = (field: keyof SkillFormData, value: string) => {
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
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-4 text-lg font-semibold text-gray-900">
          {isEditing ? '编辑 Skill' : '新建 Skill'}
        </h3>

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
              placeholder="例如：文档格式化 Skill"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </FormField>

          {/* Description */}
          <FormField label="描述" required error={fieldErrors['description']}>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Skill 的功能描述"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </FormField>

          {/* Scope */}
          {!isEditing && (
            <FormField label="作用域" required error={fieldErrors['scope']}>
              <select
                value={formData.scope}
                onChange={(e) => handleChange('scope', e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="public">公用 - 所有 Agent 可引用</option>
                <option value="workspace">工作区专属 - 仅指定工作区 Agent 可引用</option>
              </select>
            </FormField>
          )}

          {/* Workspace (when scope=workspace) */}
          {!isEditing && formData.scope === 'workspace' && (
            <FormField label="所属工作区" required error={fieldErrors['workspaceId']}>
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
          )}

          {/* Content (Markdown editor) */}
          <FormField label="内容 (Markdown)" required error={fieldErrors['content']}>
            <textarea
              value={formData.content}
              onChange={(e) => handleChange('content', e.target.value)}
              placeholder="在此输入 Skill 的 Markdown 内容..."
              rows={12}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y"
            />
          </FormField>

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
  skill: Skill;
  error: ApiError | null;
  isPending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function DeleteConfirmDialog({ skill, error, isPending, onConfirm, onCancel }: DeleteConfirmDialogProps) {
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
              无法删除 Skill <span className="font-medium">&ldquo;{skill.name}&rdquo;</span>，因为以下 Agent 正在引用该 Skill：
            </p>
            <ul className="mt-2 list-disc pl-5 text-sm text-gray-700">
              {error!.references?.map((ref, i) => (
                <li key={i}>{ref}</li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-gray-500">
              请先取消这些 Agent 对该 Skill 的引用后再删除。
            </p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-gray-600">
            确定要删除 Skill <span className="font-medium">&ldquo;{skill.name}&rdquo;</span> 吗？此操作不可撤销。
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

// ─── Version History Modal ───────────────────────────────────────────────────

interface VersionHistoryModalProps {
  skill: Skill;
  onClose: () => void;
}

function VersionHistoryModal({ skill, onClose }: VersionHistoryModalProps) {
  const { data: versions = [], isLoading } = useQuery({
    queryKey: ['skill-versions', skill.id],
    queryFn: () => fetchVersionHistory(skill.id),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-lg bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            版本历史 - {skill.name}
          </h3>
          <button
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            ✕
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            <span className="ml-2 text-sm text-gray-500">加载中...</span>
          </div>
        ) : versions.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">暂无版本记录</p>
        ) : (
          <div className="space-y-4">
            {versions.map((ver) => (
              <div
                key={ver.id}
                className="rounded-lg border border-gray-200 p-4"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                    v{ver.version}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(ver.createdAt).toLocaleString('zh-CN')}
                  </span>
                </div>
                <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded bg-gray-50 p-3 text-xs text-gray-700 font-mono">
                  {ver.content}
                </pre>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            关闭
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
