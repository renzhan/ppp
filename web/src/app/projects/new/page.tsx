'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Loader2, X, ChevronDown } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { CascadeSelector, CascadeSelectorValue } from '@/components/form/cascade-selector';
import { LingxiTaxonomySelector, LingxiTaxonomyValue } from '@/components/form/lingxi-taxonomy-selector';
import { NoteBasePreview } from '@/components/form/note-base-preview';
import { ParsedNoteBaseRow } from '@/lib/note-base-parser';

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
      <PageHeader
        title="新建项目"
        description="填写项目基础信息，笔记底表可在创建后通过编辑上传。"
        backHref="/"
      />

      <div className="rounded-lg border bg-white px-8 py-10 shadow-sm">
        <div className="mx-auto max-w-3xl space-y-8">
          {/* 品类/品牌/业务线 - CascadeSelector */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-900">
              品类 / 品牌 / 业务线 <span className="text-rose-500">*</span>
            </label>
            <CascadeSelector
              value={form.cascade}
              onChange={handleCascadeChange}
            />
            {(errors.category || errors.brand) && (
              <p className="text-xs text-rose-500">{errors.category || errors.brand}</p>
            )}
          </div>

          {/* 项目名称 - with suggestions */}
          <div className="space-y-2" ref={suggestionsRef}>
            <label className="block text-sm font-medium text-gray-900">
              项目名称 <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={form.projectName}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, projectName: e.target.value }));
                  setErrors((prev) => { const n = { ...prev }; delete n.projectName; return n; });
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="输入项目名称或从已导入项目中选择"
                className="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
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
          </div>

          {/* 灵犀账号ID + 行业选择 */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-900">灵犀账号ID</label>
            <p className="text-xs text-gray-500">输入灵犀账号ID后点击"获取行业"，选择行业分类供灵犀数据爬取使用</p>
            <LingxiTaxonomySelector
              value={form.lingxiTaxonomy}
              onChange={(val) => setForm((prev) => ({ ...prev, lingxiTaxonomy: val }))}
            />
          </div>

          {/* 创建者 - auto-filled, read-only */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-900">创建者</label>
            <input
              type="text"
              value={currentUser ? (currentUser.displayName || currentUser.username) : '加载中...'}
              readOnly
              disabled
              className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-500 outline-none"
            />
          </div>

          {/* 参与者 - multi-select */}
          <div className="space-y-2" ref={participantRef}>
            <label className="block text-sm font-medium text-gray-900">参与者</label>
            <div className="relative">
              <div
                onClick={() => setShowParticipantDropdown(!showParticipantDropdown)}
                className="flex min-h-[44px] w-full cursor-pointer flex-wrap items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm transition hover:border-gray-300 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20"
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
                    <input
                      type="text"
                      value={participantSearch}
                      onChange={(e) => setParticipantSearch(e.target.value)}
                      placeholder="搜索姓名..."
                      className="h-8 w-full rounded border border-gray-200 px-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand/20"
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
          </div>

          {/* 开始执行日期 */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-900">开始执行日期</label>
            <input
              type="date"
              value={form.executionStartDate}
              onChange={(e) => setForm((prev) => ({ ...prev, executionStartDate: e.target.value }))}
              className="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </div>

          {/* 项目结束日期 */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-900">项目结束日期</label>
            <input
              type="date"
              value={form.endDate}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, endDate: e.target.value }));
                setErrors((prev) => { const n = { ...prev }; delete n.endDate; return n; });
              }}
              className="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
            {errors.endDate && <p className="text-xs text-rose-500">{errors.endDate}</p>}
          </div>

          {/* 笔记底表上传 - optional */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-900">笔记底表（可选）</label>
            <p className="text-xs text-gray-500">
              可选上传，创建项目时将自动保存到数据库。也可后续通过编辑项目上传。
            </p>
            <div>
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-gray-300 bg-white px-4 py-6 transition-colors hover:border-gray-400 hover:bg-gray-50">
                <svg className="mb-2 h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                {pendingNoteFile ? (
                  <p className="text-sm text-emerald-600 font-medium">已选择: {pendingNoteFile.name}</p>
                ) : (
                  <>
                    <p className="text-sm text-gray-600">
                      点击选择 <span className="font-medium text-brand">.xlsx</span> 笔记底表文件
                    </p>
                    <p className="mt-1 text-xs text-gray-400">创建项目时将自动保存</p>
                  </>
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
                      // 立即调用解析端点预览数据
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
                          const allWarnings = [
                            data.error || '解析失败',
                            ...(data.warnings || []),
                          ];
                          setParseWarnings(allWarnings);
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
                  className="mt-2 text-xs text-gray-500 hover:text-rose-500"
                >
                  取消选择
                </button>
              )}
              {/* 解析中提示 */}
              {isParsing && (
                <div className="mt-2 flex items-center gap-2 text-xs text-brand">
                  <Loader2 size={12} className="animate-spin" />
                  正在解析预览...
                </div>
              )}
              {/* 解析预览 */}
              {!isParsing && parsedPreviewRecords.length > 0 && (
                <NoteBasePreview records={parsedPreviewRecords} warnings={parseWarnings} />
              )}
              {/* 解析失败提示（无记录时） */}
              {!isParsing && parsedPreviewRecords.length === 0 && parseWarnings.length > 0 && (
                <div className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  {parseWarnings.map((w, i) => <p key={i}>{w}</p>)}
                </div>
              )}
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end pt-4">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={createProjectMutation.isPending}
              className="inline-flex h-12 items-center gap-2 rounded-lg bg-brand px-6 text-sm font-medium text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {createProjectMutation.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : null}
              <span>创建项目</span>
            </button>
          </div>

          {createProjectMutation.isError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
              {(createProjectMutation.error as Error).message || '创建项目失败'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
