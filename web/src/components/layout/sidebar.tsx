'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutGrid,
  History,
  Waypoints,
  MessageCircle,
  UserRound,
  Settings,
  PanelLeft,
  PanelLeftClose,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SidebarUserMenu } from './sidebar-user-menu';

const navItems = [
  { href: '/', label: '项目管理', icon: LayoutGrid },
  { href: '/review', label: '复盘系统', icon: History },
  { href: '/planning', label: '策划系统', icon: Waypoints },
  { href: '/sentiment', label: '舆情系统', icon: MessageCircle },
  { href: '/admin/users', label: '账户管理', icon: UserRound, adminOnly: true },
  { href: '/admin/settings', label: '系统设置', icon: Settings, adminOnly: true },
] as const;

interface SidebarProps {
  collapsed?: boolean;
  showToggle?: boolean;
  onToggle?: () => void;
}

export function Sidebar({ collapsed = false, showToggle = false, onToggle }: SidebarProps) {
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setUserRole(data.user.role);
          setUserName(data.user.displayName || data.user.username);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <aside
      className={cn(
        'flex h-full flex-col  bg-[#ebebeb] transition-all duration-200',
        collapsed ? 'w-[52px]' : 'w-[155px]'
      )}
    >
      <div
        className={cn(
          'flex h-[65px] shrink-0 items-center border-b border-gray-200/80 bg-white',
          collapsed ? 'justify-right gap-0 px-1' : 'justify-between pl-4 pr-1'
        )}
      >
        <img
          src={collapsed ? '/images/logo-s.jpg' : '/images/logo.jpg'}
          alt="派盘盘"
          className={cn(
            'shrink-0 object-contain',
            collapsed ? 'h-[24px] w-[24px]' : 'h-[24px] w-[109px]'
          )}
        />
        {showToggle && onToggle && (
          <button
            type="button"
            onClick={onToggle}
            className="shrink-0 rounded-md p-1 text-[#666666] transition-colors hover:bg-gray-100 hover:text-gray-800"
            aria-label={collapsed ? '展开侧边栏' : '收起侧边栏'}
          >
            {collapsed ? (
              <PanelLeft size={14} strokeWidth={1.75} />
            ) : (
              <PanelLeftClose size={14} strokeWidth={1.75} />
            )}
          </button>
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-5 mt-6 overflow-y-auto px-2 py-4">
        {navItems
          .filter((item) => !('adminOnly' in item) || userRole === 'admin')
          .map((item) => {
            const isActive =
              item.href === '/'
                ? pathname === '/' || pathname.startsWith('/projects')
                : pathname === item.href ||
                  pathname.startsWith(item.href + '/') ||
                  pathname.startsWith(item.href + '?');
            const Icon = item.icon;
            const displayLabel = item.label;

            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? displayLabel : undefined}
                className={cn(
                  'group flex items-center text-sm font-bold transition-colors justify-center',
                  collapsed
                    ? 'justify-center rounded-lg p-2'
                    : 'gap-1 rounded-lg px-2 py-2',
                  isActive
                    ? 'bg-[#FFF9EB] text-[#ff9100]'
                    : 'text-[#666666] hover:bg-[#FFF9EB]/60 hover:text-[#ff9100]'
                )}
              >
                <Icon
                  size={16}
                  strokeWidth={isActive ? 2.25 : 1.75}
                  className={cn(
                    'shrink-0 transition-colors',
                    isActive ? 'text-[#ff9100]' : 'text-[#666666]',
                    !isActive && 'group-hover:text-[#ff9100]'
                  )}
                />
                {!collapsed && <span className="truncate leading-snug">{displayLabel}</span>}
              </Link>
            );
          })}
      </nav>

      <div className="shrink-0 border-t border-gray-400/20 py-2">
        <SidebarUserMenu userName={userName} collapsed={collapsed} />
      </div>
    </aside>
  );
}
