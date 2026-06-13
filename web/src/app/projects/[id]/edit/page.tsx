'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Loader2, X, ChevronDown } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { CascadeSelector, CascadeSelectorValue } from '@/components/form/cascade-selector';
import { LingxiTaxonomySelector, LingxiTaxonomyValue } from '@/components/form/lingxi-taxonomy-selector';
import { NoteBaseUploader } from '@/components/form/note-base-uploader';
import { NoteBaseTable } from '@/components/form/note-base-table';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

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
  executionStartDate: string | null;
  endDate: string | null;
  participants: string[];
  noteCount: number;
  createdBy: string | null;
  lingxiAccountId: string | null;
  lingxiTaxonomyCode: string | null;
  lingxiTaxonomyPath: string | null;
}

interface FormState {
  cascade: CascadeSelectorValue;
  projectName: string;
  executionStartDate: string;
  endDate: string;
  participants: string[];
  lingxiTaxonomy: LingxiTaxonomyValue;
}

type FormErrors = Record<string, string>;

export default function EditProjectPage({ params }: { params: { id: string } }) {
  const projectId = params.id;
  const router = useRouter();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [showParticipantDropdown, setShowParticipantDropdown] = useState(false);
  const [participantSearch, setParticipantSearch] = useState('');
  const participantRef = useRef<HTMLDivElement>(null);

  // Reset form when projectId changes (navigating between projects)
  useEffect(() => {
    setForm(null);
  }, [projectId]);

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
  const { data: usersData } = useQuery<{ items: User[] }>({
    queryKey: ['all-users'],
    queryFn: async () => {
      const res = await fetch('/api/admin/users');
      if (!res.ok) throw new Error('获取用户列表失败');
      return res.json();
    },
  });

  const allUsers = usersData?.items ?? [];

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
        executionStartDate: project.executionStartDate ? project.executionStartDate.slice(0, 10) : '',
        endDate: project.endDate ? project.endDate.slice(0, 10) : '',
        participants: project.participants || [],
        lingxiTaxonomy: {
          accountId: project.lingxiAccountId || '',
          taxonomyCode: project.lingxiTaxonomyCode || '',
          taxonomyPath: project.lingxiTaxonomyPath || '',
        },
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
          executionStartDate: form.executionStartDate || null,
          endDate: form.endDate || null,
          participants: form.participants,
          lingxiAccountId: form.lingxiTaxonomy.accountId || null,
          lingxiTaxonomyCode: form.lingxiTaxonomy.taxonomyCode || null,
          lingxiTaxonomyPath: form.lingxiTaxonomy.taxonomyPath || null,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '更新项目失败');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      router.push('/');
    },
  });

  const validate = () => {
    if (!form) return false;
    const nextErrors: FormErrors = {};
    // 5 required fields only: 品类, 品牌, 业务线, 项目名称, 创建者
    if (!form.cascade.category) nextErrors.category = '请选择品类';
    if (!form.cascade.brand) nextErrors.brand = '请选择品牌';
    if (!form.cascade.businessLine) nextErrors.businessLine = '请选择业务线';
    if (!form.projectName.trim()) nextErrors.projectName = '请输入项目名称';
    // Date-range check only when both dates are filled
    if (form.executionStartDate && form.endDate && form.endDate <= form.executionStartDate) {
      nextErrors.endDate = '项目结束日期必须大于开始执行日期';
    }
    if (form.endDate && form.endDate > new Date().toISOString().split('T')[0]) {
      nextErrors.endDate = '项目结束日期不能超过今天';
    }
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

  const creatorDisplayName = project?.createdBy
    ? getDisplayName(project.createdBy)
    : '-';

  if (projectLoading || !form) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="编辑项目" backHref="/" titleClassName="font-normal" />

      <Card>
        <CardContent className="p-8">
          <div className="mx-auto space-y-6">
            {/* 品类/品牌/业务线 */}
            <CascadeSelector value={form.cascade} onChange={handleCascadeChange} />
            {(errors.category || errors.brand) && (
              <p className="text-xs text-rose-500">{errors.category || errors.brand}</p>
            )}

            {/* 项目名称 */}
            <FormField
              label={<>项目名称 <span className="text-rose-500">*</span></>}
              htmlFor="projectName"
            >
              <Input
                id="projectName"
                type="text"
                variant="form"
                value={form.projectName}
                onChange={(e) => {
                  setForm((prev) => prev ? { ...prev, projectName: e.target.value } : prev);
                  setErrors((prev) => { const n = { ...prev }; delete n.projectName; return n; });
                }}
                placeholder="请输入项目名称（不能与其它项目重名）"
              />
              {errors.projectName && <p className="text-xs text-rose-500">{errors.projectName}</p>}
            </FormField>

            {/* 创建者 */}
            <FormField label="创建者" htmlFor="creator">
              <Input
                id="creator"
                type="text"
                variant="form"
                value={creatorDisplayName}
                readOnly
                disabled
                className="bg-gray-50 text-gray-500"
              />
            </FormField>

            {/* 参与者 */}
            <FormField label="参与者">
              <div className="relative" ref={participantRef}>
                <div
                  onClick={() => setShowParticipantDropdown(!showParticipantDropdown)}
                  className="flex min-h-[40px] w-full cursor-pointer flex-wrap items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm transition hover:border-gray-400"
                >
                  {form.participants.length === 0 && (
                    <span className="text-gray-400">点击选择参与者</span>
                  )}
                  {form.participants.map((userId) => (
                    <span
                      key={userId}
                      className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand"
                    >
                      {getDisplayName(userId)}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); removeParticipant(userId); }}
                        className="ml-0.5 rounded-full p-0.5 transition hover:bg-brand-100"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                  <ChevronDown size={16} className="ml-auto text-gray-400" />
                </div>
                {showParticipantDropdown && (
                  <div className="absolute z-10 mt-1 max-h-60 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
                    <div className="border-b px-3 py-2">
                      <Input
                        type="text"
                        variant="form"
                        value={participantSearch}
                        onChange={(e) => setParticipantSearch(e.target.value)}
                        placeholder="搜索姓名..."
                        className="h-8"
                        autoFocus
                      />
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      {availableParticipants.filter((u) => {
                        if (!participantSearch.trim()) return true;
                        const q = participantSearch.toLowerCase();
                        return (u.displayName || '').toLowerCase().includes(q) || u.username.toLowerCase().includes(q);
                      }).length === 0 ? (
                        <div className="px-3 py-2 text-sm text-gray-400">无匹配用户</div>
                      ) : (
                        availableParticipants.filter((u) => {
                          if (!participantSearch.trim()) return true;
                          const q = participantSearch.toLowerCase();
                          return (u.displayName || '').toLowerCase().includes(q) || u.username.toLowerCase().includes(q);
                        }).map((user) => {
                          const isSelected = form.participants.includes(user.id);
                          return (
                            <button
                              key={user.id}
                              type="button"
                              onClick={() => toggleParticipant(user.id)}
                              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition ${
                                isSelected ? 'bg-brand-50 text-brand' : 'text-gray-700 hover:bg-gray-50'
                              }`}
                            >
                              <span className={`flex h-4 w-4 items-center justify-center rounded border ${
                                isSelected ? 'border-brand bg-brand' : 'border-gray-300'
                              }`}>
                                {isSelected && (
                                  <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </span>
                              <span>{user.displayName || user.username}</span>
                              {user.role && user.role !== 'admin' && (
                                <span className="ml-auto text-xs text-gray-400">{user.role}</span>
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            </FormField>

            {/* 开始执行日期 & 项目结束日期 */}
            <div className="grid grid-cols-2 gap-4">
              <FormField label="开始执行日期" htmlFor="executionStartDate">
                <Input
                  id="executionStartDate"
                  type="date"
                  variant="form"
                  className="flex-1"
                  value={form.executionStartDate}
                  onChange={(e) => setForm((prev) => prev ? { ...prev, executionStartDate: e.target.value } : prev)}
                />
                {errors.executionStartDate && <p className="text-xs text-rose-500">{errors.executionStartDate}</p>}
              </FormField>
              <FormField label="项目结束日期" htmlFor="endDate">
                <Input
                  id="endDate"
                  type="date"
                  variant="form"
                  className="flex-1"
                  value={form.endDate}
                  onChange={(e) => {
                    setForm((prev) => prev ? { ...prev, endDate: e.target.value } : prev);
                    setErrors((prev) => { const n = { ...prev }; delete n.endDate; return n; });
                  }}
                />
                {errors.endDate && <p className="text-xs text-rose-500">{errors.endDate}</p>}
              </FormField>
            </div>

            {/* 灵犀数据获取 */}
            <FormField label="灵犀数据获取">
              <LingxiTaxonomySelector
                value={form.lingxiTaxonomy}
                onChange={(val) => setForm((prev) => prev ? { ...prev, lingxiTaxonomy: val } : prev)}
              />
              {errors.lingxiTaxonomy && <p className="text-xs text-rose-500">{errors.lingxiTaxonomy}</p>}
            </FormField>

            {/* 业务底表 */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="font-normal text-gray-500">业务底表</Label>
                <a
                  href="/down/projects-template.xlsx"
                  download
                  className="text-sm text-brand hover:underline"
                >
                  业务底表模版下载
                </a>
              </div>
              {errors.noteBase && <p className="text-xs text-rose-500">{errors.noteBase}</p>}
              <NoteBaseUploader
                projectId={projectId}
                onUploadSuccess={() => {
                  queryClient.invalidateQueries({ queryKey: ['project', projectId] });
                  queryClient.invalidateQueries({ queryKey: ['projects'] });
                  queryClient.invalidateQueries({ queryKey: ['project-note-base', projectId] });
                }}
                onUploadError={() => {}}
              />
              <NoteBaseTable projectId={projectId} />
            </div>

            {updateProjectMutation.isError && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
                {(updateProjectMutation.error as Error).message || '更新项目失败'}
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="justify-end gap-3 px-8 pb-8">
          <Button type="button" variant="outline" onClick={() => router.push('/')}>
            取消
          </Button>
          <Button
            type="button"
            variant="submit"
            onClick={handleSubmit}
            disabled={updateProjectMutation.isPending}
          >
            {updateProjectMutation.isPending && <Loader2 size={16} className="animate-spin" />}
            保存修改
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
