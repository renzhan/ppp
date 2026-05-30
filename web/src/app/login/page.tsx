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
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Left Panel - Brand showcase (55% width on desktop, full width on mobile) */}
      <div
        className="order-2 md:order-1 w-full md:w-[55%] min-h-[200px] md:min-h-screen relative"
        style={{
          backgroundImage: 'url(/images/login-bg.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      />


      {/* Right Panel - Login form (45% width on desktop, full width on mobile, appears first on mobile) */}
      <div className="order-1 md:order-2 w-full md:w-[45%] bg-white flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Form header */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900">欢迎登录</h2>
            <p className="mt-2 text-sm text-gray-500">你的小盘 盯着每一盘</p>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username */}
            <div>
              <label
                htmlFor="username"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                用户名
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="请输入用户名"
                className="w-full rounded-sm border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                autoComplete="username"
                required
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-gray-700"
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
                  className="w-full rounded-sm border border-gray-300 bg-white px-3 py-2.5 pr-10 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
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
                  className="h-4 w-4 rounded border-gray-300 bg-white text-brand focus:ring-brand/50"
                />
                <label
                  htmlFor="rememberMe"
                  className="ml-2 text-sm text-gray-600"
                >
                  自动登录
                </label>
              </div>
              <Link
                href="/change-password"
                className="text-sm text-brand hover:underline transition-colors"
              >
                修改密码
              </Link>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-brand h-[44px] px-4 text-sm font-medium text-white transition-all hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand/50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? '登录中...' : '登 录'}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-8 text-center">
            <div className="flex items-center justify-center gap-4 text-sm text-gray-500">
              <a href="#" className="hover:text-gray-700 transition-colors">帮助</a>
              <span className="text-gray-300">|</span>
              <a href="#" className="hover:text-gray-700 transition-colors">隐私</a>
              <span className="text-gray-300">|</span>
              <a href="#" className="hover:text-gray-700 transition-colors">条款</a>
            </div>
            <p className="mt-2 text-xs text-gray-400">
              copyright © 2026 派芽技术部出品
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
