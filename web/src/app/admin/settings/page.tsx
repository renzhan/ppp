'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, Lock, Eye, EyeOff } from 'lucide-react';

interface ImportResult {
  imported: number;
  treeNodesCreated: number;
  errors: string[];
}

export default function AdminSettingsPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">系统设置</h1>
        <p className="mt-1 text-sm text-slate-500">管理项目底表导入和个人密码修改。</p>
      </div>

      {/* Project Base Table Import Section */}
      <ProjectBaseImportSection />

      {/* Password Change Section */}
      <PasswordChangeSection />
    </div>
  );
}

function ProjectBaseImportSection() {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    // Client-side validation: only .xlsx
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      setError('仅支持.xlsx格式文件');
      setResult(null);
      return;
    }

    setUploading(true);
    setError('');
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/admin/import/project-base', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || '导入失败，请稍后重试');
      } else {
        setResult({
          imported: data.imported ?? 0,
          treeNodesCreated: data.treeNodesCreated ?? 0,
          errors: data.errors ?? [],
        });
      }
    } catch {
      setError('网络错误，请检查网络连接后重试');
    } finally {
      setUploading(false);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <section className="rounded-lg border bg-white p-6">
      <div className="mb-4 flex items-center gap-2">
        <Upload size={20} className="text-blue-600" />
        <h2 className="text-lg font-semibold text-gray-900">项目底表导入</h2>
      </div>
      <p className="mb-4 text-sm text-slate-500">
        上传 .xlsx 格式的项目底表文件，系统将解析品类、品牌、业务线等字段并生成级联选择器数据源。
      </p>

      {/* Upload Area */}
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(); }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-8
          transition-colors cursor-pointer
          ${dragOver
            ? 'border-blue-500 bg-blue-50'
            : 'border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-white'
          }
          ${uploading ? 'pointer-events-none opacity-60' : ''}
        `}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-blue-500" />
            <span className="text-sm text-slate-500">正在上传并解析...</span>
          </div>
        ) : (
          <>
            <svg
              className="mb-2 h-10 w-10 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p className="text-sm text-slate-600">
              拖拽文件到此处，或 <span className="font-medium text-blue-600">点击选择文件</span>
            </p>
            <p className="mt-1 text-xs text-slate-400">仅支持 .xlsx 格式</p>
          </>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx"
        onChange={handleInputChange}
        className="hidden"
        aria-label="上传项目底表"
      />

      {/* Success Result */}
      {result && (
        <div className="mt-4 rounded-lg bg-green-50 px-4 py-3" role="status" aria-live="polite">
          <p className="text-sm font-medium text-green-700">
            导入成功：导入 {result.imported} 个项目，创建 {result.treeNodesCreated} 个树节点
          </p>
          {result.errors.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-medium text-amber-700">以下行存在问题：</p>
              <ul className="mt-1 list-inside list-disc text-xs text-amber-600">
                {result.errors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}
    </section>
  );
}

function PasswordChangeSection() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Client-side validation
    if (newPassword !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    if (newPassword.length < 6) {
      setError('新密码长度不能少于6位');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oldPassword: currentPassword,
          newPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || '密码修改失败');
      } else {
        setSuccess('密码修改成功，即将跳转到登录页...');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        // Redirect to login after a short delay
        setTimeout(() => {
          router.push('/login');
        }, 1500);
      }
    } catch {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-lg border bg-white p-6">
      <div className="mb-4 flex items-center gap-2">
        <Lock size={20} className="text-blue-600" />
        <h2 className="text-lg font-semibold text-gray-900">密码修改</h2>
      </div>
      <p className="mb-4 text-sm text-slate-500">
        修改您的登录密码。修改成功后需要重新登录。
      </p>

      {/* Success Message */}
      {success && (
        <div className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700" role="status">
          {success}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="max-w-md space-y-4">
        {/* Current Password */}
        <div>
          <label htmlFor="currentPassword" className="mb-1 block text-sm font-medium text-gray-700">
            当前密码
          </label>
          <div className="relative">
            <input
              id="currentPassword"
              type={showCurrentPassword ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="请输入当前密码"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              required
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              aria-label={showCurrentPassword ? '隐藏密码' : '显示密码'}
            >
              {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* New Password */}
        <div>
          <label htmlFor="newPassword" className="mb-1 block text-sm font-medium text-gray-700">
            新密码
          </label>
          <div className="relative">
            <input
              id="newPassword"
              type={showNewPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="请输入新密码（至少6位）"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              required
              minLength={6}
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowNewPassword(!showNewPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              aria-label={showNewPassword ? '隐藏密码' : '显示密码'}
            >
              {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* Confirm Password */}
        <div>
          <label htmlFor="confirmPassword" className="mb-1 block text-sm font-medium text-gray-700">
            确认新密码
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="请再次输入新密码"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            required
            minLength={6}
            autoComplete="new-password"
          />
        </div>

        {/* Submit Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? '修改中...' : '确认修改'}
          </button>
        </div>
      </form>
    </section>
  );
}
