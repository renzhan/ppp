'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Loader2, X, ChevronDown } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { CascadeSelector, CascadeSelectorValue } from '@/components/form/cascade-selector';
import { NoteBaseUploader } from '@/components/form/note-base-uploader';
import { NoteBaseTable } from '@/components/form/note-base-table';

interface User {
  id: string;
  username: string;
  displayName: string | null;
  role: string;
}

interface ProjectDetail {
  id: string;
  projectName: string;
  brand: string;
  category: string;
  businessLine: string | null;
  startDate: string;
  participants: string[];
  noteCount: number;
}

interface FormState {
  cascade: CascadeSelectorValue;
  projectName: string;
  startDate: string;
  participants: string[];
}

type FormErrors = Record<string, string>;

export default function EditProjectPage({ params }: { params: { id: string } }) {
  const projectId = params.id;
  const router = useRouter();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [showParticipantDropdown, setShowParticipantDropdown] = useState(false);
  const participantRef = useRef<HTMLDivElement>(null);

  // Fetch project detail
  const { data: project, isLoading: projectLoading } = useQuery<ProjectDetail>({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}`);
      if (!res.ok) throw new Error('获取项目详情失败');
      return res.json();
    },
  });

  // Fetch all users for participant selector
  const { data: usersData } = useQuery<{ users: User[] }>({
    queryKey: ['all-users'],
    queryFn: async () => {
      const res = await fetch('/api/admin/users');
      if (!res.ok) throw new Error('获取用户列表失败');
      return res.json();
    },
  });

  const allUsers = usersData?.users ?? [];

  // Initialize form when project loads
  useEffect(() => {
    if (project && !form) {
      setForm({
        cascade: {
          category: project.category || '',
          brand: project.brand || '',
          businessLine: project.businessLine || '',
        },
        projectName: project.projectName || '',
        startDate: project.startDate ? project.startDate.slice(0, 10) : '',
        participants: project.participants || [],
      });
    }
  }, [project, form]);

  // Available participants
  const availableParticipants = useMemo(() => {
    return allUsers;
  }, [allUsers]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (participantRef.current && !participantRef.current.contains(e.target as Node)) {
        setShowParticipantDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const updateProjectMutation = useMutation({
    mutationFn: async () => {
      if (!form) throw new Error('表单未初始化');
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: form.cascade.category,
          brand: form.cascade.brand,
          businessLine: form.cascade.businessLine || null,
          projectName: form.projectName,
          startDate: form.startDate,
          participants: form.participants,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '更新项目失败');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      router.push('/');
    },
  });

  const validate = () => {
    if (!form) return false;
    const nextErrors: FormErrors = {};
    if (!form.cascade.category) nextErrors.category = '请选择品类';
    if (!form.cascade.brand) nextErrors.brand = '请选择品牌';
    if (!form.projectName.trim()) nextErrors.projectName = '请输入项目名称';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    updateProjectMutation.mutate();
  };

  const handleCascadeChange = (value: CascadeSelectorValue) => {
    setForm((prev) => prev ? { ...prev, cascade: value } : prev);
    setErrors((prev) => { const n = { ...prev }; delete n.category; delete n.brand; return n; });
  };

  const toggleParticipant = (userId: string) => {
    setForm((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        participants: prev.participants.includes(userId)
          ? prev.participants.filter((id) => id !== userId)
          : [...prev.participants, userId],
      };
    });
  };

  const removeParticipant = (userId: string) => {
    setForm((prev) => {
      if (!prev) return prev;
      return { ...prev, participants: prev.participants.filter((id) => id !== userId) };
    });
  };

  const getDisplayName = (userId: string) => {
    const user = allUsers.find((u) => u.id === userId);
    return user?.displayName || user?.username || userId;
  };

  if (projectLoading || !form) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="编辑项目"
        description={project?.projectName || ''}
        backHref="/"
      />

      <div className="rounded-lg border bg-white px-8 py-10 shadow-sm">
        <div className="mx-auto max-w-3xl space-y-8">
          {/* 品类/品牌/业务线 */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-900">
              品类 / 品牌 / 业务线 <span className="text-rose-500">*</span>
            </label>
            <CascadeSelector value={form.cascade} onChange={handleCascadeChange} />
            {(errors.category || errors.brand) && (
              <p className="text-xs text-rose-500">{errors.category || errors.brand}</p>
            )}
          </div>

          {/* 项目名称 */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-900">
              项目名称 <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={form.projectName}
              onChange={(e) => {
                setForm((prev) => prev ? { ...prev, projectName: e.target.value } : prev);
                setErrors((prev) => { const n = { ...prev }; delete n.projectName; return n; });
              }}
              className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            {errors.projectName && <p className="text-xs text-rose-500">{errors.projectName}</p>}
          </div>

          {/* 立项时间 */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-900">立项时间</label>
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm((prev) => prev ? { ...prev, startDate: e.target.value } : prev)}
              className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {/* 参与者 */}
          <div className="space-y-2" ref={participantRef}>
            <label className="block text-sm font-medium text-slate-900">参与者</label>
            <div className="relative">
              <div
                onClick={() => setShowParticipantDropdown(!showParticipantDropdown)}
                className="flex min-h-[44px] w-full cursor-pointer flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm transition hover:border-slate-300"
              >
                {form.participants.length === 0 && (
                  <span className="text-slate-400">点击选择参与者</span>
                )}
                {form.participants.map((userId) => (
                  <span
                    key={userId}
                    className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700"
                  >
                    {getDisplayName(userId)}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removeParticipant(userId); }}
                      className="ml-0.5 rounded-full p-0.5 transition hover:bg-blue-100"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
                <ChevronDown size={16} className="ml-auto text-slate-400" />
              </div>
              {showParticipantDropdown && (
                <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                  {availableParticipants.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-slate-400">暂无可选用户</div>
                  ) : (
                    availableParticipants.map((user) => {
                      const isSelected = form.participants.includes(user.id);
                      return (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => toggleParticipant(user.id)}
                          className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition ${
                            isSelected ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <span className={`flex h-4 w-4 items-center justify-center rounded border ${
                            isSelected ? 'border-blue-500 bg-blue-500' : 'border-slate-300'
                          }`}>
                            {isSelected && (
                              <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </span>
                          <span>{user.displayName || user.username}</span>
                          {user.role && user.role !== 'admin' && (
                            <span className="ml-auto text-xs text-slate-400">{user.role}</span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 笔记底表上传 */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-900">笔记底表</label>
            <p className="text-xs text-slate-500">
              {project?.noteCount ? `当前已有 ${project.noteCount} 条笔记数据。重新上传将覆盖现有数据。` : '尚未上传笔记底表，上传后可用于复盘分析。'}
            </p>
            <NoteBaseUploader
              projectId={projectId}
              onUploadSuccess={() => {
                queryClient.invalidateQueries({ queryKey: ['project', projectId] });
                queryClient.invalidateQueries({ queryKey: ['projects'] });
                queryClient.invalidateQueries({ queryKey: ['project-notes', projectId] });
              }}
              onUploadError={() => {}}
            />
            {/* 笔记记录表格 */}
            <NoteBaseTable projectId={projectId} />
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => router.push('/')}
              className="inline-flex h-10 items-center rounded-lg border border-slate-200 px-5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={updateProjectMutation.isPending}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-6 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {updateProjectMutation.isPending && <Loader2 size={16} className="animate-spin" />}
              保存修改
            </button>
          </div>

          {updateProjectMutation.isError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
              {(updateProjectMutation.error as Error).message || '更新项目失败'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
