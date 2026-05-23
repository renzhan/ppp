'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 px-4">
      {/* Tech-feel background decorations */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute left-1/2 top-1/4 h-64 w-64 -translate-x-1/2 rounded-full bg-cyan-500/5 blur-3xl" />
      </div>

      {/* Main card */}
      <div className="relative z-10 w-full max-w-md">
        <div className="rounded-2xl border border-white/10 bg-white/5 px-8 py-10 shadow-2xl backdrop-blur-xl">
          {/* Brand header */}
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold tracking-wide text-white">
              派盘盘
            </h1>
            <p className="mt-2 text-sm text-blue-200/80">
              数字营销AI 交付与资产沉淀平台
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username */}
            <div>
              <label
                htmlFor="username"
                className="mb-1.5 block text-sm font-medium text-slate-300"
              >
                用户名
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="请输入用户名"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-slate-400 transition-colors focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/20"
                autoComplete="username"
                required
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-slate-300"
              >
                密码
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入密码"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 pr-10 text-sm text-white placeholder-slate-400 transition-colors focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/20"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  aria-label={showPassword ? '隐藏密码' : '显示密码'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Auto login checkbox + Change password link */}
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="rememberMe"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-500 bg-white/5 text-blue-500 focus:ring-blue-400/50"
                />
                <label
                  htmlFor="rememberMe"
                  className="ml-2 text-sm text-slate-300"
                >
                  自动登录
                </label>
              </div>
              <Link
                href="/change-password"
                className="text-sm text-blue-300 hover:text-blue-200 transition-colors"
              >
                修改密码
              </Link>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400/50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? '登录中...' : '登 录'}
            </button>
          </form>
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10 mt-8 text-center">
        <div className="flex items-center justify-center gap-4 text-sm text-slate-400">
          <a href="#" className="hover:text-slate-200 transition-colors">帮助</a>
          <span className="text-slate-600">|</span>
          <a href="#" className="hover:text-slate-200 transition-colors">隐私</a>
          <span className="text-slate-600">|</span>
          <a href="#" className="hover:text-slate-200 transition-colors">条款</a>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          copyright © 2026 派芽技术部出品
        </p>
      </div>
    </div>
  );
}
