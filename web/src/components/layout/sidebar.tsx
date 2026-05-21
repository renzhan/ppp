'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutList, PlusCircle, PanelLeftClose, PanelLeft, Users, Bot, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: '项目列表', icon: LayoutList },
  { href: '/projects/new', label: '新建项目', icon: PlusCircle },
  { href: '/admin/agents', label: 'Agent 管理', icon: Bot, adminOnly: true },
  { href: '/admin/users', label: '用户管理', icon: Users, adminOnly: true },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.user) setUserRole(data.user.role);
      })
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  return (
    <aside
      className={cn(
        'flex h-screen flex-col border-r bg-white transition-all duration-200',
        collapsed ? 'w-16' : 'w-56'
      )}
    >
      <div className="flex h-14 items-center justify-between border-b px-4">
        {!collapsed && (
          <span className="text-sm font-semibold text-gray-800">营销复盘系统</span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          aria-label={collapsed ? '展开侧边栏' : '收起侧边栏'}
        >
          {collapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      <nav className="flex-1 space-y-1 px-2 py-3">
        {navItems
          .filter((item) => !('adminOnly' in item) || userRole === 'admin')
          .map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/') || pathname.startsWith(item.href + '?');
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                )}
                title={collapsed ? item.label : undefined}
              >
                <Icon size={18} className="shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
      </nav>

      {/* Logout button */}
      <div className="border-t px-2 py-3">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
          title={collapsed ? '退出登录' : undefined}
        >
          <LogOut size={18} className="shrink-0" />
          {!collapsed && <span>退出登录</span>}
        </button>
      </div>
    </aside>
  );
}
