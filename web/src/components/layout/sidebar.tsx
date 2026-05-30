'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FolderKanban,
  BarChart3,
  Lightbulb,
  MessageCircle,
  Users,
  Settings,
  PanelLeftClose,
  PanelLeft,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: '项目管理', icon: FolderKanban },
  { href: '/review', label: '复盘系统', icon: BarChart3 },
  { href: '/planning', label: '策划系统', icon: Lightbulb },
  { href: '/sentiment', label: '舆情系统', icon: MessageCircle },
  { href: '/admin/users', label: '账户管理', icon: Users, adminOnly: true },
  { href: '/admin/settings', label: '系统设置', icon: Settings, adminOnly: true },
];

interface SidebarProps {
  /** Whether the sidebar is in collapsed (icon-only) mode. Controlled by parent. */
  collapsed?: boolean;
  /** Callback to toggle collapse state. Controlled by parent. */
  onToggleCollapse?: () => void;
}

export function Sidebar({ collapsed: controlledCollapsed, onToggleCollapse }: SidebarProps) {
  // Internal state fallback when not controlled by parent
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const pathname = usePathname();

  const collapsed = controlledCollapsed ?? internalCollapsed;
  const handleToggle = onToggleCollapse ?? (() => setInternalCollapsed(!internalCollapsed));

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
        'flex h-screen flex-col bg-white border-r border-gray-200 transition-all duration-200',
        collapsed ? 'w-16' : 'w-[220px]'
      )}
    >
      <div className="flex h-14 items-center justify-between border-b border-gray-200 px-4">
        {!collapsed && (
          <img src="/images/logo.png" alt="派盘盘" className="h-8 object-contain" />
        )}
        {collapsed && (
          <img src="/images/logo.png" alt="派盘盘" className="h-7 w-7 object-contain object-left" />
        )}
        <button
          onClick={handleToggle}
          className="rounded p-1 text-gray-400 hover:text-gray-600"
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
                  'flex items-center gap-3 px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'text-brand border-l-[3px] border-brand bg-brand-50 rounded-r-md'
                    : 'text-gray-700 hover:bg-gray-50 rounded-md'
                )}
                title={collapsed ? item.label : undefined}
              >
                <Icon size={20} className="shrink-0" />
                {!collapsed && <span className="text-sm">{item.label}</span>}
              </Link>
            );
          })}
      </nav>

      {/* Logout button */}
      <div className="border-t border-gray-200 px-2 py-3">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          title={collapsed ? '退出登录' : undefined}
        >
          <LogOut size={20} className="shrink-0" />
          {!collapsed && <span>退出登录</span>}
        </button>
      </div>
    </aside>
  );
}
