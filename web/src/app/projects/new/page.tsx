'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Loader2, X, ChevronDown, Upload } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { CascadeSelector, CascadeSelectorValue } from '@/components/form/cascade-selector';
import { LingxiTaxonomySelector, LingxiTaxonomyValue } from '@/components/form/lingxi-taxonomy-selector';
import { NoteBasePreview } from '@/components/form/note-base-preview';
import { ParsedNoteBaseRow } from '@/lib/note-base-parser';
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

interface ImportedProject {
  id: string;
  projectName: string;
  category: string;
  brand: string;
  businessLine: string | null;
  lingxiAccountId: string | null;
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

export default function NewProjectPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    cascade: { category: '', brand: '', businessLine: '' },
    projectName: '',
    executionStartDate: '',
    endDate: '',
    participants: [],
    lingxiTaxonomy: { accountId: '', taxonomyCode: '', taxonomyPath: '' },
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showParticipantDropdown, setShowParticipantDropdown] = useState(false);
  const [participantSearch, setParticipantSearch] = useState('');
  const [pendingNoteFile, setPendingNoteFile] = useState<File | null>(null);
  const [parsedPreviewRecords, setParsedPreviewRecords] = useState<ParsedNoteBaseRow[]>([]);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const participantRef = useRef<HTMLDivElement>(null);

  // Fetch current user
  const { data: meData } = useQuery<{ user: User }>({
    queryKey: ['auth-me'],
    queryFn: async () => {
      const res = await fetch('/api/auth/me');
      if (!res.ok) throw new Error('获取用户信息失败');
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

  // Fetch all projects for name suggestions
  const { data: importedProjects } = useQuery<ImportedProject[]>({
    queryKey: ['all-projects-suggestions'],
    queryFn: async () => {
      const res = await fetch('/api/projects?pageSize=500');
      if (!res.ok) throw new Error('获取项目列表失败');
      const data = await res.json();
      return (data.items ?? []).map((p: { id: string; projectName: string; category: string; brand: string; businessLine: string | null; lingxiAccountId?: string | null }) => ({
        id: p.id,
        projectName: p.projectName,
        category: p.category,
        brand: p.brand,
        businessLine: p.businessLine,
        lingxiAccountId: p.lingxiAccountId || null,
      }));
    },
  });

  const currentUser = meData?.user;
  const allUsers = usersData?.items ?? [];

  // Filter suggestions based on cascade selection and input text
  const filteredSuggestions = useMemo(() => {
    if (!importedProjects) return [];
    let filtered = importedProjects;

    // Filter by cascade selection
    if (form.cascade.category) {
      filtered = filtered.filter((p) => p.category === form.cascade.category);
    }
    if (form.cascade.brand) {
      filtered = filtered.filter((p) => p.brand === form.cascade.brand);
    }
    if (form.cascade.businessLine) {
      filtered = filtered.filter((p) => p.businessLine === form.cascade.businessLine);
    }

    // Further filter by text input
    if (form.projectName.trim()) {
      const query = form.projectName.toLowerCase();
      filtered = filtered.filter((p) => p.projectName.toLowerCase().includes(query));
    }

    return filtered;
  }, [importedProjects, form.cascade.category, form.cascade.brand, form.cascade.businessLine, form.projectName]);

  // Available participants (exclude current user)
  const availableParticipants = useMemo(() => {
    if (!currentUser) return allUsers;
    return allUsers.filter((u) => u.id !== currentUser.id);
  }, [allUsers, currentUser]);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
      if (participantRef.current && !participantRef.current.contains(e.target as Node)) {
        setShowParticipantDropdown(false);
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
          executionStartDate: form.executionStartDate || null,
          endDate: form.endDate || null,
          createdBy: currentUser?.id,
          participants: form.participants,
          lingxiAccountId: form.lingxiTaxonomy.accountId || null,
          lingxiTaxonomyCode: form.lingxiTaxonomy.taxonomyCode || null,
          lingxiTaxonomyPath: form.lingxiTaxonomy.taxonomyPath || null,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '创建项目失败');
      }
      return data;
    },
    onSuccess: async (project) => {
      // Auto-upload pending note file if selected
      if (pendingNoteFile) {
        try {
          const formData = new FormData();
          formData.append('file', pendingNoteFile);
          await fetch(`/api/upload/note-base/${project.id}`, {
            method: 'POST',
            body: formData,
          });
        } catch {
          // Silently fail — user can re-upload in edit page
        }
      }
      // Always redirect to project list
      router.push('/');
    },
  });

  const validate = () => {
    const nextErrors: FormErrors = {};
    if (!form.cascade.category) nextErrors.category = '请选择品类';
    if (!form.cascade.brand) nextErrors.brand = '请选择品牌';
    if (!form.projectName.trim()) nextErrors.projectName = '请输入项目名称';
    if (form.executionStartDate && form.endDate && form.endDate < form.executionStartDate) {
      nextErrors.endDate = '项目结束日期不能早于开始执行日期';
    }
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

  const toggleParticipant = (userId: string) => {
    setForm((prev) => ({
      ...prev,
      participants: prev.participants.includes(userId)
        ? prev.participants.filter((id) => id !== userId)
        : [...prev.participants, userId],
    }));
  };

  const removeParticipant = (userId: string) => {
    setForm((prev) => ({
      ...prev,
      participants: prev.participants.filter((id) => id !== userId),
    }));
  };

  const getDisplayName = (userId: string) => {
    const user = allUsers.find((u) => u.id === userId);
    return user?.displayName || user?.username || userId;
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="新建项目" backHref="/" titleClassName="font-normal" />

      <Card>
        <CardContent className="p-8">
          <div className="mx-auto  space-y-6">
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
              <div className="relative" ref={suggestionsRef}>
                <Input
                  id="projectName"
                  type="text"
                  variant="form"
                  value={form.projectName}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, projectName: e.target.value }));
                    setErrors((prev) => { const n = { ...prev }; delete n.projectName; return n; });
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  placeholder="请输入项目名称（不能与其它项目重名）"
                />
                {showSuggestions && filteredSuggestions.length > 0 && (
                  <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                    {filteredSuggestions.map((project) => (
                      <button
                        key={project.id}
                        type="button"
                        onClick={() => {
                          setForm((prev) => ({
                            ...prev,
                            projectName: project.projectName,
                            lingxiTaxonomy: project.lingxiAccountId
                              ? { accountId: project.lingxiAccountId, taxonomyCode: '', taxonomyPath: '' }
                              : prev.lingxiTaxonomy,
                          }));
                          setShowSuggestions(false);
                        }}
                        className="w-full px-3 py-2 text-left text-sm text-gray-700 transition hover:bg-brand-50 hover:text-brand"
                      >
                        {project.projectName}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {errors.projectName && <p className="text-xs text-rose-500">{errors.projectName}</p>}
            </FormField>

            {/* 创建者 */}
            <FormField label="创建者" htmlFor="creator">
              <Input
                id="creator"
                type="text"
                variant="form"
                value={currentUser ? (currentUser.displayName || currentUser.username) : '加载中...'}
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
                  className="flex min-h-[40px] w-full cursor-pointer flex-wrap items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm transition hover:border-gray-400 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20"
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
                                isSelected
                                  ? 'bg-brand-50 text-brand'
                                  : 'text-gray-700 hover:bg-gray-50'
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
                  onChange={(e) => setForm((prev) => ({ ...prev, executionStartDate: e.target.value }))}
                />
              </FormField>
              <FormField label="项目结束日期" htmlFor="endDate">
                <Input
                  id="endDate"
                  type="date"
                  variant="form"
                  className="flex-1"
                  value={form.endDate}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, endDate: e.target.value }));
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
                onChange={(val) => setForm((prev) => ({ ...prev, lingxiTaxonomy: val }))}
              />
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
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-white px-4 py-6 transition-colors hover:border-gray-400 hover:bg-gray-50">
                <Upload className="mb-2 h-8 w-8 text-gray-400" />
                {pendingNoteFile ? (
                  <p className="text-sm font-medium text-emerald-600">已选择: {pendingNoteFile.name}</p>
                ) : (
                  <p className="text-sm text-gray-600">
                    请上传<span className="font-medium text-brand">.xlsx</span>格式业务底表
                  </p>
                )}
                <input
                  type="file"
                  accept=".xlsx"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (!file.name.toLowerCase().endsWith('.xlsx')) {
                        alert('仅支持 .xlsx 格式文件');
                        return;
                      }
                      setPendingNoteFile(file);
                      setIsParsing(true);
                      setParsedPreviewRecords([]);
                      setParseWarnings([]);
                      try {
                        const formData = new FormData();
                        formData.append('file', file);
                        const res = await fetch('/api/upload/note-base/parse', {
                          method: 'POST',
                          body: formData,
                        });
                        const data = await res.json();
                        if (res.ok && data.success) {
                          setParsedPreviewRecords(data.records);
                          setParseWarnings(data.warnings || []);
                        } else {
                          setParseWarnings([data.error || '解析失败']);
                        }
                      } catch {
                        setParseWarnings(['解析请求失败，请稍后重试']);
                      } finally {
                        setIsParsing(false);
                      }
                    }
                  }}
                />
              </label>
              {pendingNoteFile && (
                <button
                  type="button"
                  onClick={() => {
                    setPendingNoteFile(null);
                    setParsedPreviewRecords([]);
                    setParseWarnings([]);
                  }}
                  className="text-xs text-gray-500 hover:text-rose-500"
                >
                  取消选择
                </button>
              )}
              {isParsing && (
                <div className="flex items-center gap-2 text-xs text-brand">
                  <Loader2 size={12} className="animate-spin" />
                  正在解析预览...
                </div>
              )}
              {!isParsing && parsedPreviewRecords.length > 0 && (
                <NoteBasePreview records={parsedPreviewRecords} warnings={parseWarnings} />
              )}
              {!isParsing && parsedPreviewRecords.length === 0 && parseWarnings.length > 0 && (
                <div className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  {parseWarnings.map((w, i) => <p key={i}>{w}</p>)}
                </div>
              )}
            </div>

            {createProjectMutation.isError && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
                {(createProjectMutation.error as Error).message || '创建项目失败'}
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="justify-end px-8 pb-8">
          <Button
            type="button"
            variant="submit"
            onClick={handleSubmit}
            disabled={createProjectMutation.isPending}
          >
            {createProjectMutation.isPending && <Loader2 size={16} className="animate-spin" />}
            创建项目
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
