'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/page-header';
import { CascadeSelector, CascadeSelectorValue } from '@/components/form/cascade-selector';
import { NoteBaseUploader } from '@/components/form/note-base-uploader';
import { NoteBaseTable } from '@/components/form/note-base-table';
import { ParticipantMultiSelect } from '@/components/form/participant-multi-select';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FilterField } from '@/components/ui/filter-field';
import { Input } from '@/components/ui/input';
import { Loading } from '@/components/ui/loading';
import { listErrorClass } from '@/components/ui/data-list';

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
  createdBy: string | null;
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

  const { data: project, isLoading: projectLoading } = useQuery<ProjectDetail>({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}`);
      if (!res.ok) throw new Error('获取项目详情失败');
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

  const allUsers = usersData?.users ?? [];

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

  const creatorName = useMemo(() => {
    if (!project?.createdBy) return '-';
    const user = allUsers.find((u) => u.id === project.createdBy);
    return user?.displayName || user?.username || project.createdBy;
  }, [project?.createdBy, allUsers]);

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
    setForm((prev) => (prev ? { ...prev, cascade: value } : prev));
    setErrors((prev) => {
      const n = { ...prev };
      delete n.category;
      delete n.brand;
      return n;
    });
  };

  if (projectLoading || !form) {
    return <Loading size="lg" text="正在加载项目信息..." className="py-20" />;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="编辑项目" description={project?.projectName || ''} backHref="/" />


        <div className="space-y-6 ">
      
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <CascadeSelector value={form.cascade} onChange={handleCascadeChange} />
            <FilterField label="项目名称：">
              <Input
                variant="filter"
                value={form.projectName}
                onChange={(e) => {
                  setForm((prev) => (prev ? { ...prev, projectName: e.target.value } : prev));
                  setErrors((prev) => {
                    const n = { ...prev };
                    delete n.projectName;
                    return n;
                  });
                }}
                placeholder="请输入"
              />
            </FilterField>
          </div>
          {(errors.category || errors.brand || errors.projectName) && (
            <p className="text-xs text-rose-500">
              {errors.category || errors.brand || errors.projectName}
            </p>
          )}

     
          <div className="grid grid-cols-1 gap-4 
            sm:grid-cols-2 
            xl:grid-cols-[1fr_2fr_1fr]">
            <FilterField label="创建者：">
              <Input variant="filter" value={creatorName} readOnly disabled className="bg-gray-50" />
            </FilterField>
            <FilterField label="参与者：">
              <ParticipantMultiSelect
                users={allUsers}
                value={form.participants}
                onChange={(participants) =>
                  setForm((prev) => (prev ? { ...prev, participants } : prev))
                }
              />
            </FilterField>
            <FilterField label="立项时间：">
              <Input
                variant="filter"
                type="date"
                value={form.startDate}
                onChange={(e) =>
                  setForm((prev) => (prev ? { ...prev, startDate: e.target.value } : prev))
                }
                placeholder="请输入"
              />
            </FilterField>
          </div>

          {/* 笔记底表 */}
          <div className="space-y-1 border-t border-gray-100 pt-6">
            <h3 className="text-lg font-medium text-gray-900">笔记底表</h3>
            {project?.noteCount ? (
              <p className="text-xs text-gray-500">
                当前已有 {project.noteCount} 条笔记数据，重新上传将覆盖现有数据。
              </p>
            ) : null}
            <NoteBaseUploader
              projectId={projectId}
              onUploadSuccess={() => {
                queryClient.invalidateQueries({ queryKey: ['project', projectId] });
                queryClient.invalidateQueries({ queryKey: ['projects'] });
                queryClient.invalidateQueries({ queryKey: ['project-notes', projectId] });
              }}
              onUploadError={() => {}}
            />
            <NoteBaseTable projectId={projectId} />
          </div>

          {updateProjectMutation.isError && (
            <div className={listErrorClass}>
              {(updateProjectMutation.error as Error).message || '更新项目失败'}
            </div>
          )}

          <div className="flex justify-center items-center gap-3">
            <Button
              type="button"
              variant="submit"
              size="lg"
              disabled={updateProjectMutation.isPending}
              onClick={handleSubmit}
              className="min-w-[150px]"
            >
              {updateProjectMutation.isPending && (
                <Loader2 size={18} className="mr-2 animate-spin" />
              )}
              保存修改
            </Button>
            <Button variant="outline" className="text-gray-500" asChild>
              <Link href="/">取消并返回列表</Link>
            </Button>
          </div>
        </div>

    </div>
  );
}
