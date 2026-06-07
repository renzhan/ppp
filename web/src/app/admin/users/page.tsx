'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Upload, User, Lock, UserX, UserCheck, X, ChevronLeft, ChevronRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { FilterField } from '@/components/ui/filter-field';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Loading } from '@/components/ui/loading';
import {
  listEmptyClass,
  listErrorClass,
  listFilterToDataGapClass,
  listTableActionCellClass,
  listTableActionHeadClass,
  listTableCellClass,
  listTableHeadClass,
  listTableHeaderRowClass,
  listTableRowClass,
  listTableWrapperClass,
} from '@/components/ui/data-list';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { showToast } from '@/lib/notification';
import { generatePageNumbers } from '@/lib/pagination';
import { cn } from '@/lib/utils';

interface User {
  id: string;
  username: string;
  displayName: string | null;
  role: string;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

interface UsersResponse {
  items: User[];
  totalItems: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const ROLE_OPTIONS = [
  { value: 'VP', label: 'VP' },
  { value: 'AD', label: 'AD' },
  { value: 'AM', label: 'AM' },
  { value: '组长', label: '组长' },
  { value: 'AE', label: 'AE' },
  { value: 'admin', label: '管理员' },
] as const;

const ROLE_FILTER_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'admin', label: '管理员' },
  { value: 'VP', label: 'VP' },
  { value: 'AD', label: 'AD' },
  { value: 'AM', label: 'AM' },
  { value: '组长', label: '组长' },
  { value: 'AE', label: 'AE' },
] as const;

const selectTriggerClass =
  'h-9 rounded border-gray-200 bg-white text-gray-900 focus-visible:ring-brand/25 disabled:bg-gray-50 disabled:text-gray-400';

const modalSelectTriggerClass =
  'h-10 rounded-lg border-gray-300 bg-white text-gray-900 focus-visible:ring-brand/20';

function formatRole(role: string) {
  return role === 'admin' ? '管理员' : role;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showToggleModal, setShowToggleModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [roleFilter, setRoleFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));
    if (roleFilter) params.set('role', roleFilter);
    if (search.trim()) params.set('search', search.trim());
    return params.toString();
  }, [page, pageSize, roleFilter, search]);

  const {
    data,
    isLoading,
    isError,
    error,
  } = useQuery<UsersResponse>({
    queryKey: ['admin-users', queryString],
    queryFn: async () => {
      const res = await fetch(`/api/admin/users?${queryString}`);
      if (res.status === 401) {
        router.push('/login');
        throw new Error('未登录');
      }
      if (res.status === 403) {
        router.push('/');
        throw new Error('无权限');
      }
      if (!res.ok) throw new Error('获取用户列表失败');
      return res.json();
    },
  });

  const refetchUsers = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-users'] });
  };

  const totalPages = data?.totalPages ?? 1;
  const users = data?.items ?? [];
  const hasFilters = Boolean(roleFilter || search.trim());

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between space-y-0">
        <h1 className="text-2xl tracking-tight text-gray-900">账户信息</h1>
        <div className="flex shrink-0 gap-3">
          <Button variant="secondary" size="sm" className="gap-1 px-4" onClick={() => setShowImportModal(true)}>
            <Upload size={16} />
            批量导入
          </Button>
          <Button variant="primary" size="sm" className="shrink-0 gap-1 px-4" onClick={() => setShowAddModal(true)}>
            <Plus size={16} />
            新建用户
          </Button>
        </div>
      </div>

      <div className="">
        <div className="space-y-4">
          {message && (
            <div
              className={cn(
                'rounded-lg px-4 py-3 text-sm',
                message.type === 'success'
                  ? 'bg-green-50 text-green-700'
                  : 'bg-red-50 text-red-600'
              )}
            >
              {message.text}
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <FilterField label="角色：">
              <Select
                value={roleFilter}
                onValueChange={(value) => {
                  setRoleFilter(value);
                  setPage(1);
                }}
              >
                <SelectTrigger className={selectTriggerClass} />
                <SelectContent>
                  {ROLE_FILTER_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value || 'all'} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>
            <FilterField label="真名或花名：">
              <Input
                variant="filter"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="请输入"
              />
            </FilterField>
          </div>
        </div>
        <div className={listFilterToDataGapClass}>
          {isLoading ? (
            <Loading size="lg" text="正在加载用户列表..." className="py-16" />
          ) : isError ? (
            <div className={listErrorClass}>{(error as Error).message || '获取用户列表失败'}</div>
          ) : users.length ? (
            <div className={listTableWrapperClass}>
              <Table className="text-sm">
                <TableHeader>
                  <TableRow className={listTableHeaderRowClass}>
                    <TableHead className={listTableHeadClass}>真名</TableHead>
                    <TableHead className={listTableHeadClass}>花名</TableHead>
                    <TableHead className={listTableHeadClass}>角色</TableHead>
                    <TableHead className={listTableHeadClass}>状态</TableHead>
                    <TableHead className={listTableHeadClass}>最后登录</TableHead>
                    <TableHead className={listTableActionHeadClass}>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user, index) => (
                    <TableRow key={user.id} className={listTableRowClass(index)}>
                      <TableCell className={cn(listTableCellClass, 'text-gray-600')}>
                        {user.displayName || '-'}
                      </TableCell>
                      <TableCell className={listTableCellClass}>{user.username}</TableCell>
                      <TableCell className={listTableCellClass}>{formatRole(user.role)}</TableCell>
                      <TableCell className={listTableCellClass}>
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                            user.isActive
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          )}
                        >
                          {user.isActive ? '正常' : '已禁用'}
                        </span>
                      </TableCell>
                      <TableCell className={cn(listTableCellClass, 'text-gray-500')}>
                        {user.lastLoginAt
                          ? new Date(user.lastLoginAt).toLocaleString('zh-CN')
                          : '从未登录'}
                      </TableCell>
                      <TableCell className={cn(listTableActionCellClass, 'whitespace-nowrap')}>
                        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
                          <Button
                            variant="text-link"
                            size="sm"
                            className="h-auto px-0 text-xs"
                            onClick={() => {
                              setSelectedUser(user);
                              setShowEditModal(true);
                            }}
                          >
                            编辑
                          </Button>
                          <Button
                            variant="text-link"
                            size="sm"
                            className="h-auto px-0 text-xs"
                            onClick={() => {
                              setSelectedUser(user);
                              setShowResetModal(true);
                            }}
                          >
                            重置密码
                          </Button>
                          <Button
                            variant="text-link"
                            size="sm"
                            className="h-auto px-0 text-xs"
                            onClick={() => {
                              setSelectedUser(user);
                              setShowToggleModal(true);
                            }}
                          >
                            {user.isActive ? '禁用' : '启用'}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className={listEmptyClass}>
              {hasFilters ? '未找到匹配的账户' : '暂无用户'}
            </div>
          )}
        </div>
      </div>

      {users.length ? (
        <CardFooter className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-gray-500">
            共 {data?.totalItems ?? 0} 条记录，第 {data?.page ?? page}/{totalPages} 页
          </p>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              <ChevronLeft size={16} />
            </Button>
            {generatePageNumbers(page, totalPages).map((p, idx) =>
              p === '...' ? (
                <span key={`ellipsis-${idx}`} className="px-1 text-gray-400">
                  ...
                </span>
              ) : (
                <Button
                  key={p}
                  type="button"
                  variant={page === p ? 'primary' : 'outline'}
                  size="icon-sm"
                  onClick={() => setPage(p as number)}
                  className={cn('text-sm', page === p && 'pointer-events-none')}
                >
                  {p}
                </Button>
              )
            )}
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              <ChevronRight size={16} />
            </Button>
          </div>
        </CardFooter>
      ) : null}

      {showAddModal && (
        <AddUserModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            showMsg('success', '用户创建成功');
            refetchUsers();
          }}
        />
      )}

      {showImportModal && (
        <ImportModal
          onClose={() => setShowImportModal(false)}
          onSuccess={(msg) => {
            setShowImportModal(false);
            showMsg('success', msg);
            refetchUsers();
          }}
        />
      )}

      {showEditModal && selectedUser && (
        <EditUserModal
          user={selectedUser}
          onClose={() => {
            setShowEditModal(false);
            setSelectedUser(null);
          }}
          onSuccess={() => {
            setShowEditModal(false);
            setSelectedUser(null);
            showMsg('success', '用户更新成功');
            refetchUsers();
          }}
        />
      )}

      {showResetModal && selectedUser && (
        <ResetPasswordModal
          user={selectedUser}
          onClose={() => {
            setShowResetModal(false);
            setSelectedUser(null);
          }}
          onSuccess={() => {
            setShowResetModal(false);
            setSelectedUser(null);
            showMsg('success', '密码重置成功');
            refetchUsers();
          }}
        />
      )}

      {showToggleModal && selectedUser && (
        <ToggleActiveModal
          user={selectedUser}
          onClose={() => {
            setShowToggleModal(false);
            setSelectedUser(null);
          }}
          onSuccess={() => {
            const action = selectedUser.isActive ? '禁用' : '启用';
            setShowToggleModal(false);
            setSelectedUser(null);
            showToast({
              type: 'success',
              title: `${action}成功`,
              message: `账户「${selectedUser.username}」已${action}`,
            });
            refetchUsers();
          }}
        />
      )}
    </div>
  );
}

function ModalWrapper({
  title,
  icon: Icon,
  onClose,
  children,
}: {
  title: string;
  icon: LucideIcon;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const modal = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
          <div className="flex items-center gap-2">
            <Icon size={20} className="text-brand" />
            <CardTitle className="text-lg">{title}</CardTitle>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="关闭">
            <X size={20} />
          </Button>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  );

  if (!mounted) return null;

  return createPortal(modal, document.body);
}

function RoleSelect({
  value,
  onValueChange,
}: {
  value: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={modalSelectTriggerClass} />
      <SelectContent>
        {ROLE_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ModalError({ error }: { error: string }) {
  if (!error) return null;
  return <div className={cn(listErrorClass, 'mb-3 p-3')}>{error}</div>;
}

function ModalActions({
  onClose,
  loading,
  submitLabel,
  loadingLabel,
}: {
  onClose: () => void;
  loading: boolean;
  submitLabel: string;
  loadingLabel: string;
}) {
  return (
    <div className="flex justify-end gap-3 pt-2">
      <Button type="button" variant="secondary" onClick={onClose}>
        取消
      </Button>
      <Button type="submit" variant="primary" disabled={loading}>
        {loading ? loadingLabel : submitLabel}
      </Button>
    </div>
  );
}

function AddUserModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    username: '',
    displayName: '',
    role: 'AE',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '创建失败');
        return;
      }
      onSuccess();
    } catch {
      setError('网络错误');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalWrapper title="添加用户" icon={User} onClose={onClose}>
      <ModalError error={error} />
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="花名 *" htmlFor="add-username">
          <Input
            id="add-username"
            variant="form"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            required
          />
        </FormField>
        <FormField label="真名" htmlFor="add-displayName">
          <Input
            id="add-displayName"
            variant="form"
            value={form.displayName}
            onChange={(e) => setForm({ ...form, displayName: e.target.value })}
          />
        </FormField>
        <FormField label="角色">
          <RoleSelect value={form.role} onValueChange={(role) => setForm({ ...form, role })} />
        </FormField>
        <FormField label="初始密码 *" htmlFor="add-password">
          <Input
            id="add-password"
            variant="form"
            type="text"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="至少6位"
            required
            minLength={6}
          />
        </FormField>
        <ModalActions
          onClose={onClose}
          loading={loading}
          submitLabel="创建"
          loadingLabel="创建中..."
        />
      </form>
    </ModalWrapper>
  );
}

function EditUserModal({
  user,
  onClose,
  onSuccess,
}: {
  user: User;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    displayName: user.displayName || '',
    role: user.role,
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '更新失败');
        return;
      }
      onSuccess();
    } catch {
      setError('网络错误');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalWrapper title="编辑账户" icon={User} onClose={onClose}>
      <ModalError error={error} />
      <form onSubmit={handleSubmit} className="space-y-4">
      <FormField label="花名" htmlFor="edit-displayName">
          <Input
            id="displayName"
            variant="form"
            disabled
            value={user.username}
          />
        </FormField>
        <FormField label="真名" htmlFor="edit-displayName">
          <Input
            id="edit-displayName"
            variant="form"
            value={form.displayName}
            onChange={(e) => setForm({ ...form, displayName: e.target.value })}
          />
        </FormField>
        <FormField label="角色">
          <RoleSelect value={form.role} onValueChange={(role) => setForm({ ...form, role })} />
        </FormField>
        <ModalActions
          onClose={onClose}
          loading={loading}
          submitLabel="保存"
          loadingLabel="保存中..."
        />
      </form>
    </ModalWrapper>
  );
}

function ResetPasswordModal({
  user,
  onClose,
  onSuccess,
}: {
  user: User;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`/api/admin/users/${user.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '重置失败');
        return;
      }
      onSuccess();
    } catch {
      setError('网络错误');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalWrapper title="重置密码" icon={Lock} onClose={onClose}>
      <ModalError error={error} />
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="花名" htmlFor="reset-username">
          <Input
            id="reset-username"
            variant="form"
            disabled
            value={user.username}
          />
        </FormField>
        <FormField label="新密码 *" htmlFor="reset-password">
          <Input
            id="reset-password"
            variant="form"
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="至少6位"
            required
            minLength={6}
          />
        </FormField>
        <ModalActions
          onClose={onClose}
          loading={loading}
          submitLabel="确认"
          loadingLabel="重置中..."
        />
      </form>
    </ModalWrapper>
  );
}

function ToggleActiveModal({
  user,
  onClose,
  onSuccess,
}: {
  user: User;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const action = user.isActive ? '禁用' : '启用';
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setError('');
    setLoading(true);

    try {
      const method = user.isActive ? 'DELETE' : 'PUT';
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method,
        ...(method === 'PUT' && {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive: !user.isActive }),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `${action}失败`);
        return;
      }
      onSuccess();
    } catch {
      setError('操作失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalWrapper title={`${action}账户`} icon={user.isActive ? UserX : UserCheck} onClose={onClose}>
      <ModalError error={error} />
      <p className="text-sm text-gray-700">
        确定要{action}账户&ldquo;{user.username}&rdquo;吗？
      </p>
      <div className="flex justify-end gap-3 pt-6">
        <Button type="button" variant="secondary" onClick={onClose}>
          取消
        </Button>
        <Button type="button" variant="primary" disabled={loading} onClick={handleConfirm}>
          {loading ? `${action}中...` : '确认'}
        </Button>
      </div>
    </ModalWrapper>
  );
}

function ImportModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: (msg: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('请选择Excel文件');
      return;
    }
    setError('');
    setImportErrors([]);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/admin/import/users', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '导入失败');
        return;
      }

      if (data.errors && data.errors.length > 0) {
        setImportErrors(data.errors);
      }

      const msg = `导入完成：成功 ${data.imported} 个用户${
        data.errors?.length ? `，${data.errors.length} 条错误` : ''
      }`;

      if (!data.errors || data.errors.length === 0) {
        onSuccess(msg);
      }
    } catch {
      setError('网络错误');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalWrapper title="批量导入用户" icon={Upload} onClose={onClose}>
      <ModalError error={error} />
      {importErrors.length > 0 && (
        <div className="mb-3 max-h-40 overflow-y-auto rounded-lg bg-orange-50 px-3 py-2 text-xs text-orange-700">
          <p className="mb-1 font-medium">导入错误：</p>
          <ul className="list-inside list-disc space-y-0.5">
            {importErrors.map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">
          <p>Excel文件(.xlsx)需包含列：用户名、显示名、角色</p>
          <p className="mt-1">有效角色值：组长、AD、AM、投手、执行</p>
          <p className="mt-1">系统将为每个用户自动生成初始密码，首次登录需修改密码。</p>
          <Button variant="text-link" size="sm" className="mt-2 h-auto px-0 text-xs" asChild>
            <a href="/api/admin/import/users/template" download>
              下载导入模板
            </a>
          </Button>
        </div>
        <FormField label="Excel文件 *">
          <Input
            variant="form"
            type="file"
            accept=".xlsx"
            onChange={(e) => {
              setFile(e.target.files?.[0] || null);
              setError('');
              setImportErrors([]);
            }}
            className="cursor-pointer file:mr-4 p-0 file:rounded-lg file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100"
          />
        </FormField>
        <ModalActions
          onClose={onClose}
          loading={loading}
          submitLabel="开始导入"
          loadingLabel="导入中..."
        />
      </form>
    </ModalWrapper>
  );
}
