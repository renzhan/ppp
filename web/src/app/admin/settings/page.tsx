'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Loading } from '@/components/ui/loading';
import { listErrorClass } from '@/components/ui/data-list';
import { cn } from '@/lib/utils';

interface ImportResult {
  imported: number;
  treeNodesCreated: number;
  errors: string[];
}

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">系统设置</h1>
        <p className="text-sm text-gray-500">管理项目底表导入和个人密码修改。</p>
      </div>
      <ProjectBaseImportSection />
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
    if (file) handleFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleClick = () => fileInputRef.current?.click();

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0 pb-2">
        <Upload size={20} className="text-brand" />
        <CardTitle className="text-lg">项目底表导入</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <CardDescription className="mt-0">
          上传 .xlsx 格式的项目底表文件，系统将解析品类、品牌、业务线等字段并生成级联选择器数据源。
        </CardDescription>

        <div
          role="button"
          tabIndex={0}
          onClick={handleClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') handleClick();
          }}
          onDrop={handleDrop}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setDragOver(false);
          }}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-8 transition-colors',
            dragOver ? 'border-brand bg-brand-50' : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-white',
            uploading && 'pointer-events-none opacity-60'
          )}
        >
          {uploading ? (
            <Loading size="sm" text="正在上传并解析..." />
          ) : (
            <>
              <Upload className="mb-2 h-10 w-10 text-gray-400" strokeWidth={1.5} />
              <p className="text-sm text-gray-600">
                拖拽文件到此处，或{' '}
                <span className="font-medium text-brand">点击选择文件</span>
              </p>
              <p className="mt-1 text-xs text-gray-400">仅支持 .xlsx 格式</p>
            </>
          )}
        </div>

        <Input
          ref={fileInputRef}
          type="file"
          accept=".xlsx"
          onChange={handleInputChange}
          className="hidden"
          aria-label="上传项目底表"
        />

        {result && (
          <div className="rounded-lg bg-green-50 px-4 py-3" role="status" aria-live="polite">
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

        {error && (
          <div className={listErrorClass} role="alert">
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PasswordChangeSection() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

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
        setTimeout(() => router.push('/login'), 1500);
      }
    } catch {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0 pb-2">
        <Lock size={20} className="text-brand" />
        <CardTitle className="text-lg">密码修改</CardTitle>
      </CardHeader>
      <CardContent>
        <CardDescription className="mb-4 mt-0">
          修改您的登录密码。修改成功后需要重新登录。
        </CardDescription>

        {success && (
          <div className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700" role="status">
            {success}
          </div>
        )}

        {error && (
          <div className={cn(listErrorClass, 'mb-4')} role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="max-w-md space-y-4">
          <FormField label="当前密码" htmlFor="currentPassword">
            <PasswordInput
              id="currentPassword"
              variant="form"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="请输入当前密码"
              autoComplete="current-password"
              required
            />
          </FormField>

          <FormField label="新密码" htmlFor="newPassword">
            <PasswordInput
              id="newPassword"
              variant="form"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="请输入新密码（至少6位）"
              autoComplete="new-password"
              required
              minLength={6}
            />
          </FormField>

          <FormField label="确认新密码" htmlFor="confirmPassword">
            <Input
              id="confirmPassword"
              variant="form"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="请再次输入新密码"
              autoComplete="new-password"
              required
              minLength={6}
            />
          </FormField>

          <Button type="submit" variant="primary" disabled={loading}>
            {loading ? '修改中...' : '确认修改'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
