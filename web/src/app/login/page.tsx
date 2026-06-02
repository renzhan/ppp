'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { FormField } from '@/components/ui/form-field';
import { Checkbox } from '@/components/ui/checkbox';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, rememberMe }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || '登录失败');
        return;
      }

      if (data.user.mustChangePassword) {
        router.push('/change-password');
      } else {
        router.push('/');
      }
    } catch {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <div
        className="relative order-2 min-h-[200px] w-full md:order-1 md:min-h-screen md:w-[55%]"
        style={{
          backgroundImage: 'url(/images/login-bg.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      />

      <div className="relative order-1 flex w-full items-center justify-center bg-[#fffeee] px-6 py-12 md:order-2 md:w-[45%]">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h2 className="text-4xl font-bold text-[#f5b53f]">欢迎登录</h2>
            <p className="mt-2 text-md text-gray-500">你的小盘 盯着每一盘</p>
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <FormField label="账户" htmlFor="username">
              <Input
                id="username"
                variant="login"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="请输入用户名"
                autoComplete="username"
                required
              />
            </FormField>

            <FormField label="密码" htmlFor="password">
              <PasswordInput
                id="password"
                variant="login"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                autoComplete="current-password"
                required
              />
            </FormField>

            <div className="flex items-center justify-between">
              <label className="flex cursor-pointer items-center gap-2">
                <Checkbox
                  id="rememberMe"
                  checked={rememberMe}
                  onCheckedChange={setRememberMe}
                />
                <span className="text-sm text-gray-500">自动登录</span>
              </label>
  
            </div>

            <Button
              type="submit"
              variant="submit"
              disabled={loading}
              className="w-full rounded-xl text-md"
            >
              {loading ? '登录中...' : '登 录'}
            </Button>
          </form>

          <div className="absolute bottom-2 left-0 right-0 mt-8 text-center">
            <div className="flex items-center justify-center gap-4 text-sm text-gray-500">
              <a href="#" className="transition-colors hover:text-gray-700">
                帮助
              </a>
              <span className="text-gray-300">|</span>
              <a href="#" className="transition-colors hover:text-gray-700">
                隐私
              </a>
              <span className="text-gray-300">|</span>
              <a href="#" className="transition-colors hover:text-gray-700">
                条款
              </a>
            </div>
            <p className="mt-2 text-xs text-gray-400">copyright © 2026 派芽技术部出品</p>
          </div>
        </div>
      </div>
    </div>
  );
}
