'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { CascadeSelector, CascadeSelectorValue } from '@/components/form/cascade-selector';
import { NoteBaseUploader } from '@/components/form/note-base-uploader';
import { ParticipantMultiSelect } from '@/components/form/participant-multi-select';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { listErrorClass } from '@/components/ui/data-list';
import { FilterField } from '@/components/ui/filter-field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface User {
  id: string;
  username: string;
  displayName: string | null;
  role: string;
}

interface ImportedProject {
  id: string;
  projectName: string;
  category: string;
  brand: string;
  businessLine: string | null;
}

interface FormState {
  cascade: CascadeSelectorValue;
  projectName: string;
  startDate: string;
  executionStartDate: string;
  endDate: string;
  participants: string[];
}

type FormErrors = Record<string, string>;

function getTodayString(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function NewProjectPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    cascade: { category: '', brand: '', businessLine: '' },
    projectName: '',
    startDate: getTodayString(),
    executionStartDate: '',
    endDate: '',
    participants: [],
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null);
  const [pendingNoteFile, setPendingNoteFile] = useState<File | null>(null);
  const [noteUploadStatus, setNoteUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [noteUploadMessage, setNoteUploadMessage] = useState<string>('');
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const { data: meData } = useQuery<{ user: User }>({
    queryKey: ['auth-me'],
    queryFn: async () => {
      const res = await fetch('/api/auth/me');
      if (!res.ok) throw new Error('获取用户信息失败');
      return res.json();
    },
  });

  const { data: usersData } = useQuery<{ users: User[] }>({
    queryKey: ['all-users'],
    queryFn: async () => {
      const res = await fetch('/api/admin/users');
      if (!res.ok) throw new Error('获取用户列表失败');
      return res.json();
    },
  });

  const { data: importedProjects } = useQuery<ImportedProject[]>({
    queryKey: ['all-projects-suggestions'],
    queryFn: async () => {
      const res = await fetch('/api/projects?pageSize=500');
      if (!res.ok) throw new Error('获取项目列表失败');
      const data = await res.json();
      return (data.items ?? []).map(
        (p: {
          id: string;
          projectName: string;
          category: string;
          brand: string;
          businessLine: string | null;
        }) => ({
          id: p.id,
          projectName: p.projectName,
          category: p.category,
          brand: p.brand,
          businessLine: p.businessLine,
        })
      );
    },
  });

  const currentUser = meData?.user;
  const allUsers = usersData?.users ?? [];

  const filteredSuggestions = useMemo(() => {
    if (!importedProjects) return [];
    let filtered = importedProjects;
    if (form.cascade.category) {
      filtered = filtered.filter((p) => p.category === form.cascade.category);
    }
    if (form.cascade.brand) {
      filtered = filtered.filter((p) => p.brand === form.cascade.brand);
    }
    if (form.cascade.businessLine) {
      filtered = filtered.filter((p) => p.businessLine === form.cascade.businessLine);
    }
    if (form.projectName.trim()) {
      const query = form.projectName.toLowerCase();
      filtered = filtered.filter((p) => p.projectName.toLowerCase().includes(query));
    }
    return filtered.slice(0, 20);
  }, [
    importedProjects,
    form.cascade.category,
    form.cascade.brand,
    form.cascade.businessLine,
    form.projectName,
  ]);

  const availableParticipants = useMemo(() => {
    if (!currentUser) return allUsers;
    return allUsers.filter((u) => u.id !== currentUser.id);
  }, [allUsers, currentUser]);

  const creatorName = currentUser
    ? currentUser.displayName || currentUser.username
    : '加载中...';

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const createProjectMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: form.cascade.category,
          brand: form.cascade.brand,
          businessLine: form.cascade.businessLine || null,
          projectName: form.projectName,
          startDate: form.startDate,
          executionStartDate: form.executionStartDate || null,
          endDate: form.endDate || null,
          createdBy: currentUser?.id,
          participants: form.participants,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '创建项目失败');
      }
      return data;
    },
    onSuccess: async (project) => {
      setCreatedProjectId(project.id);
      if (pendingNoteFile) {
        setNoteUploadStatus('uploading');
        try {
          const formData = new FormData();
          formData.append('file', pendingNoteFile);
          const res = await fetch(`/api/upload/note-base/${project.id}`, {
            method: 'POST',
            body: formData,
          });
          if (res.ok) {
            const result = await res.json();
            const count = result.count ?? result.imported ?? 0;
            setNoteUploadStatus('success');
            setNoteUploadMessage(`笔记底表解析成功，共导入 ${count} 条记录`);
          } else {
            const err = await res.json().catch(() => ({ error: '解析失败' }));
            setNoteUploadStatus('error');
            setNoteUploadMessage(err.error || '笔记底表解析失败');
          }
        } catch {
          setNoteUploadStatus('error');
          setNoteUploadMessage('笔记底表上传失败，请稍后在项目编辑页重新上传');
        }
      }
    },
  });

  const validate = () => {
    const nextErrors: FormErrors = {};
    if (!form.cascade.category) nextErrors.category = '请选择品类';
    if (!form.cascade.brand) nextErrors.brand = '请选择品牌';
    if (!form.projectName.trim()) nextErrors.projectName = '请输入项目名称';
    if (!form.startDate) nextErrors.startDate = '请选择立项时间';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    createProjectMutation.mutate();
  };

  const handleCascadeChange = (value: CascadeSelectorValue) => {
    setForm((prev) => ({ ...prev, cascade: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next.category;
      delete next.brand;
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="新建项目"
        description="填写项目基础信息，笔记底表可在创建后通过编辑上传。"
        backHref="/"
      />

      <Card>
        <CardContent className="space-y-6 py-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <CascadeSelector value={form.cascade} onChange={handleCascadeChange} />
            <FilterField label="项目名称：">
              <div ref={suggestionsRef} className="relative min-w-0 flex-1">
                <Input
                  variant="filter"
                  value={form.projectName}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, projectName: e.target.value }));
                    setErrors((prev) => {
                      const n = { ...prev };
                      delete n.projectName;
                      return n;
                    });
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  placeholder="请输入"
                />
                {showSuggestions && filteredSuggestions.length > 0 && (
                  <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-gray-200 bg-white py-1 shadow-md">
                    {filteredSuggestions.map((project) => (
                      <li key={project.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setForm((prev) => ({ ...prev, projectName: project.projectName }));
                            setShowSuggestions(false);
                          }}
                          className="w-full px-3 py-2.5 text-left text-sm text-gray-800 transition hover:bg-brand-50"
                        >
                          {project.projectName}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </FilterField>
          </div>
          {(errors.category || errors.brand || errors.projectName) && (
            <p className="text-xs text-rose-500">
              {errors.category || errors.brand || errors.projectName}
            </p>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-[1fr_2fr_1fr]">
            <FilterField label="创建者：">
              <Input variant="filter" value={creatorName} readOnly disabled className="bg-gray-50" />
            </FilterField>
            <FilterField label="参与者：">
              <ParticipantMultiSelect
                users={availableParticipants}
                value={form.participants}
                onChange={(participants) => setForm((prev) => ({ ...prev, participants }))}
                placeholder="请选择"
              />
            </FilterField>
            <FilterField label="立项时间：">
              <Input
                variant="filter"
                type="date"
                value={form.startDate}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, startDate: e.target.value }));
                  setErrors((prev) => {
                    const n = { ...prev };
                    delete n.startDate;
                    return n;
                  });
                }}
              />
            </FilterField>
          </div>
          {errors.startDate && <p className="text-xs text-rose-500">{errors.startDate}</p>}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FilterField label="开始执行日期：">
              <Input
                variant="filter"
                type="date"
                value={form.executionStartDate}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, executionStartDate: e.target.value }))
                }
              />
            </FilterField>
            <FilterField label="项目结束日期：">
              <Input
                variant="filter"
                type="date"
                value={form.endDate}
                onChange={(e) => setForm((prev) => ({ ...prev, endDate: e.target.value }))}
              />
            </FilterField>
          </div>

          <div className="space-y-3 border-t border-gray-100 pt-6">
            <div>
              <Label className="text-base font-medium text-gray-900">笔记底表</Label>
              <p className="mt-1 text-xs text-gray-500">
                可选上传，创建项目后将自动解析。也可后续通过编辑项目上传。
              </p>
            </div>
            {createdProjectId && pendingNoteFile ? (
              <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                <p className="text-sm font-medium text-gray-800">{pendingNoteFile.name}</p>
                {noteUploadStatus === 'uploading' && (
                  <p className="mt-1 flex items-center gap-2 text-xs text-brand">
                    <Loader2 size={12} className="animate-spin" />
                    正在解析笔记底表...
                  </p>
                )}
                {noteUploadStatus === 'success' && (
                  <p className="mt-1 text-xs text-emerald-600">✓ {noteUploadMessage}</p>
                )}
                {noteUploadStatus === 'error' && (
                  <p className="mt-1 text-xs text-amber-600">⚠ {noteUploadMessage}</p>
                )}
              </div>
            ) : (
              <NoteBaseUploader
                projectId={createdProjectId ?? undefined}
                onFileSelect={(file) => setPendingNoteFile(file)}
                onFileClear={() => setPendingNoteFile(null)}
                onUploadSuccess={() => {}}
                onUploadError={() => {}}
              />
            )}
          </div>

          {createProjectMutation.isError && (
            <div className={listErrorClass}>
              {(createProjectMutation.error as Error).message || '创建项目失败'}
            </div>
          )}

          {createdProjectId ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                项目创建成功！
              </div>
              <div className="flex justify-center">
                <Button type="button" variant="submit" onClick={() => router.push('/')}>
                  返回项目列表
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex justify-center pt-2">
              <Button
                type="button"
                variant="submit"
                size="lg"
                className="min-w-[150px]"
                disabled={createProjectMutation.isPending}
                onClick={handleSubmit}
              >
                {createProjectMutation.isPending && (
                  <Loader2 size={18} className="mr-2 animate-spin" />
                )}
                创建项目
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
