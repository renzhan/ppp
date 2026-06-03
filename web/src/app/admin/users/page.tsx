'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Upload,
  Edit2,
  KeyRound,
  UserX,
  UserCheck,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Loading } from '@/components/ui/loading';
import {
  listEmptyClass,
  listErrorClass,
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

const ROLE_OPTIONS = [
  { value: '组长', label: '组长' },
  { value: 'AD', label: 'AD' },
  { value: 'AM', label: 'AM' },
  { value: '投手', label: '投手' },
  { value: '执行', label: '执行' },
  { value: 'admin', label: '管理员' },
] as const;

const selectTriggerClass =
  'h-10 rounded-lg border-gray-300 bg-white text-gray-900 focus-visible:ring-brand/20';

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/users');
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      if (res.status === 403) {
        router.push('/');
        return;
      }
      const data = await res.json();
      setUsers(data.users || []);
    } catch {
      setMessage({ type: 'error', text: '获取用户列表失败' });
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleToggleActive = async (user: User) => {
    const action = user.isActive ? '禁用' : '启用';
    if (!confirm(`确定要${action}用户 "${user.username}" 吗？`)) return;

    try {
      const method = user.isActive ? 'DELETE' : 'PUT';
      const url = `/api/admin/users/${user.id}`;
      const res = await fetch(url, {
        method,
        ...(method === 'PUT' && {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive: !user.isActive }),
        }),
      });

      if (res.ok) {
        showMsg('success', `${action}成功`);
        fetchUsers();
      } else {
        const data = await res.json();
        showMsg('error', data.error || `${action}失败`);
      }
    } catch {
      showMsg('error', '操作失败');
    }
  };

  if (loading) {
    return <Loading size="lg" text="正在加载用户列表..." className="py-20" />;
  }

  return (
      <div className="space-y-6">


        <div className="flex items-start justify-between space-y-0">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">用户管理</h1>
            <p className="text-sm text-gray-500">管理系统账户，支持添加、编辑、禁用与批量导入。</p>
          </div>
         
          <div className="flex shrink-0 gap-3">
            <Button variant="secondary" size="sm" className="gap-2" onClick={() => setShowImportModal(true)}>
              <Upload size={16} />
              批量导入
            </Button>
            <Button variant="primary" size="sm" className="gap-2" onClick={() => setShowAddModal(true)}>
              <Plus size={16} />
              添加用户
            </Button>
          </div>
        </div>

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

          {users.length ? (
            <div className={listTableWrapperClass}>
              <Table className="text-sm">
                <TableHeader>
                  <TableRow className={listTableHeaderRowClass}>
                    <TableHead className={listTableHeadClass}>用户名</TableHead>
                    <TableHead className={listTableHeadClass}>显示名称</TableHead>
                    <TableHead className={listTableHeadClass}>角色</TableHead>
                    <TableHead className={listTableHeadClass}>状态</TableHead>
                    <TableHead className={listTableHeadClass}>最后登录</TableHead>
                    <TableHead className={listTableHeadClass}>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user, index) => (
                    <TableRow key={user.id} className={listTableRowClass(index)}>
                      <TableCell className="py-3 font-medium">{user.username}</TableCell>
                      <TableCell className="py-3 text-gray-600">
                        {user.displayName || '-'}
                      </TableCell>
                      <TableCell className="py-3">
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                            user.role === 'admin'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-brand-100 text-brand-700'
                          )}
                        >
                          {user.role === 'admin' ? '管理员' : user.role}
                        </span>
                      </TableCell>
                      <TableCell className="py-3">
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
                      <TableCell className="py-3 text-gray-500">
                        {user.lastLoginAt
                          ? new Date(user.lastLoginAt).toLocaleString('zh-CN')
                          : '从未登录'}
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => {
                              setSelectedUser(user);
                              setShowEditModal(true);
                            }}
                            title="编辑"
                          >
                            <Edit2 size={15} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => {
                              setSelectedUser(user);
                              setShowResetModal(true);
                            }}
                            title="重置密码"
                            className="hover:text-orange-600"
                          >
                            <KeyRound size={15} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleToggleActive(user)}
                            title={user.isActive ? '禁用' : '启用'}
                            className={user.isActive ? 'hover:text-red-600' : 'hover:text-green-600'}
                          >
                            {user.isActive ? <UserX size={15} /> : <UserCheck size={15} />}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className={listEmptyClass}>暂无用户</div>
          )}
        </div>
      
      {showAddModal && (
        <AddUserModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            showMsg('success', '用户创建成功');
            fetchUsers();
          }}
        />
      )}

      {showImportModal && (
        <ImportModal
          onClose={() => setShowImportModal(false)}
          onSuccess={(msg) => {
            setShowImportModal(false);
            showMsg('success', msg);
            fetchUsers();
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
            fetchUsers();
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
            fetchUsers();
          }}
        />
      )}
    </div>
  );
}

function ModalWrapper({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg">{title}</CardTitle>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="关闭">
            <X size={20} />
          </Button>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  );
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
      <SelectTrigger className={selectTriggerClass} />
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
    role: '执行',
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
    <ModalWrapper title="添加用户" onClose={onClose}>
      <ModalError error={error} />
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="用户名 *" htmlFor="add-username">
          <Input
            id="add-username"
            variant="form"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            required
          />
        </FormField>
        <FormField label="显示名称" htmlFor="add-displayName">
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
    <ModalWrapper title={`编辑用户 - ${user.username}`} onClose={onClose}>
      <ModalError error={error} />
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="显示名称" htmlFor="edit-displayName">
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
    <ModalWrapper title={`重置密码 - ${user.username}`} onClose={onClose}>
      <ModalError error={error} />
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-gray-500">重置后用户下次登录需要重新设置密码。</p>
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
          submitLabel="确认重置"
          loadingLabel="重置中..."
        />
      </form>
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
    <ModalWrapper title="批量导入用户" onClose={onClose}>
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
            className="cursor-pointer file:mr-4 file:rounded-lg file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100"
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
