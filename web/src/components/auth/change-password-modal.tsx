'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { PasswordInput } from '@/components/ui/password-input';
import { listErrorClass } from '@/components/ui/data-list';
import { cn } from '@/lib/utils';

export interface ChangePasswordModalProps {
  open: boolean;
  /** 首次登录强制改密：无需当前密码、不可关闭 */
  requireChange?: boolean;
  /** 嵌入独立页面时使用，不渲染全屏遮罩 */
  embedded?: boolean;
  onClose?: () => void;
  onSuccess?: () => void;
}

export function ChangePasswordModal({
  open,
  requireChange = false,
  embedded = false,
  onClose,
  onSuccess,
}: ChangePasswordModalProps) {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    setSuccess('');
    setLoading(false);
  }, [open]);

  if (!open) return null;

  const handleBackdropClick = () => {
    if (!requireChange && !loading) onClose?.();
  };

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

    if (!requireChange && !currentPassword) {
      setError('请输入当前密码');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          requireChange
            ? { newPassword }
            : { oldPassword: currentPassword, newPassword }
        ),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || '密码修改失败');
        return;
      }

      if (requireChange) {
        onSuccess?.();
        return;
      }

      setSuccess('密码修改成功，即将跳转到登录页...');
      setTimeout(() => {
        onSuccess?.();
        router.push('/login');
      }, 1500);
    } catch {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const card = (
    <Card
      className={cn('w-full max-w-md', embedded ? 'shadow-xl' : 'shadow-2xl')}
      onClick={embedded ? undefined : (e) => e.stopPropagation()}
    >
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <Lock size={20} className="text-brand" />
          <CardTitle className="text-lg">
            {requireChange ? '设置新密码' : '密码修改'}
          </CardTitle>
        </div>
        {!requireChange && onClose && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="关闭"
            disabled={loading}
          >
            <X size={20} />
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <CardDescription className="mb-4 mt-0">
          {requireChange
            ? '首次登录请设置您的专属密码'
            : '修改您的登录密码。修改成功后需要重新登录。'}
        </CardDescription>

        {success && (
          <div
            className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700"
            role="status"
          >
            {success}
          </div>
        )}

        {error && (
          <div className={cn(listErrorClass, 'mb-4')} role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!requireChange && (
            <FormField label="当前密码" htmlFor="change-current-password">
              <PasswordInput
                id="change-current-password"
                variant="form"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="请输入当前密码"
                autoComplete="current-password"
                required
              />
            </FormField>
          )}

          <FormField label="新密码" htmlFor="change-new-password">
            <PasswordInput
              id="change-new-password"
              variant="form"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="请输入新密码（至少6位）"
              autoComplete="new-password"
              required
              minLength={6}
            />
          </FormField>

          <FormField label="确认新密码" htmlFor="change-confirm-password">
            <PasswordInput
              id="change-confirm-password"
              variant="form"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="请再次输入新密码"
              autoComplete="new-password"
              required
              minLength={6}
            />
          </FormField>

          <div className="flex gap-3 pt-1 justify-end">
            {!requireChange && onClose && (
              <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
                取消
              </Button>
            )}
            <Button type="submit" variant="primary" disabled={loading || !!success}>
              {loading ? '修改中...' : '确认修改'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );

  if (embedded) {
    return card;
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      onClick={handleBackdropClick}
      role="presentation"
    >
      {card}
    </div>
  );
}
