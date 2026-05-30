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
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">用户管理</h1>
        <div className="flex gap-3">
          <button
            onClick={() => setShowImportModal(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Upload size={16} />
            批量导入
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
          >
            <Plus size={16} />
            添加用户
          </button>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`mb-4 rounded-lg px-4 py-3 text-sm ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700'
              : 'bg-red-50 text-red-600'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-sm font-medium text-gray-600">用户名</th>
                <th className="px-4 py-3 text-sm font-medium text-gray-600">显示名称</th>
                <th className="px-4 py-3 text-sm font-medium text-gray-600">角色</th>
                <th className="px-4 py-3 text-sm font-medium text-gray-600">状态</th>
                <th className="px-4 py-3 text-sm font-medium text-gray-600">最后登录</th>
                <th className="px-4 py-3 text-sm font-medium text-gray-600">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map((user) => (
                <tr key={user.id} className="bg-white text-sm text-gray-900 border-b hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">
                    {user.username}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {user.displayName || '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        user.role === 'admin'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-brand-100 text-brand-700'
                      }`}
                    >
                      {user.role === 'admin' ? '管理员' : user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        user.isActive
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {user.isActive ? '正常' : '已禁用'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {user.lastLoginAt
                      ? new Date(user.lastLoginAt).toLocaleString('zh-CN')
                      : '从未登录'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setSelectedUser(user);
                          setShowEditModal(true);
                        }}
                        className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-brand"
                        title="编辑"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedUser(user);
                          setShowResetModal(true);
                        }}
                        className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-orange-600"
                        title="重置密码"
                      >
                        <KeyRound size={15} />
                      </button>
                      <button
                        onClick={() => handleToggleActive(user)}
                        className={`rounded p-1.5 text-gray-500 hover:bg-gray-100 ${
                          user.isActive ? 'hover:text-red-600' : 'hover:text-green-600'
                        }`}
                        title={user.isActive ? '禁用' : '启用'}
                      >
                        {user.isActive ? <UserX size={15} /> : <UserCheck size={15} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {users.length === 0 && (
          <div className="py-12 text-center text-gray-500">暂无用户</div>
        )}
      </div>

      {/* Add User Modal */}
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

      {/* Import Modal */}
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

      {/* Edit Modal */}
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

      {/* Reset Password Modal */}
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


// ============================================================
// Modal Components
// ============================================================

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
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
      {error && (
        <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            用户名 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            显示名称
          </label>
          <input
            type="text"
            value={form.displayName}
            onChange={(e) => setForm({ ...form, displayName: e.target.value })}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            角色
          </label>
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
          >
            <option value="组长">组长</option>
            <option value="AD">AD</option>
            <option value="AM">AM</option>
            <option value="投手">投手</option>
            <option value="执行">执行</option>
            <option value="admin">管理员</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            初始密码 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="至少6位"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            required
            minLength={6}
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
          >
            {loading ? '创建中...' : '创建'}
          </button>
        </div>
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
      {error && (
        <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            显示名称
          </label>
          <input
            type="text"
            value={form.displayName}
            onChange={(e) => setForm({ ...form, displayName: e.target.value })}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            角色
          </label>
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
          >
            <option value="组长">组长</option>
            <option value="AD">AD</option>
            <option value="AM">AM</option>
            <option value="投手">投手</option>
            <option value="执行">执行</option>
            <option value="admin">管理员</option>
          </select>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
          >
            {loading ? '保存中...' : '保存'}
          </button>
        </div>
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
      {error && (
        <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-gray-500">
          重置后用户下次登录需要重新设置密码。
        </p>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            新密码 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="至少6位"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            required
            minLength={6}
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
          >
            {loading ? '重置中...' : '确认重置'}
          </button>
        </div>
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

      // Show import errors if any
      if (data.errors && data.errors.length > 0) {
        setImportErrors(data.errors);
      }

      let msg = `导入完成：成功 ${data.imported} 个用户`;
      if (data.errors && data.errors.length > 0) {
        msg += `，${data.errors.length} 条错误`;
      }
      if (!data.errors || data.errors.length === 0) {
        onSuccess(msg);
      } else {
        // Keep modal open to show errors, but show success count
        setError('');
      }
    } catch {
      setError('网络错误');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalWrapper title="批量导入用户" onClose={onClose}>
      {error && (
        <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      )}
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
          <a
            href="/api/admin/import/users/template"
            download
            className="mt-2 inline-flex items-center gap-1 text-brand underline hover:text-brand-600"
          >
            下载导入模板
          </a>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Excel文件 <span className="text-red-500">*</span>
          </label>
          <input
            type="file"
            accept=".xlsx"
            onChange={(e) => {
              setFile(e.target.files?.[0] || null);
              setError('');
              setImportErrors([]);
            }}
            className="w-full text-sm text-gray-500 file:mr-4 file:rounded-lg file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100"
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
          >
            {loading ? '导入中...' : '开始导入'}
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
}
