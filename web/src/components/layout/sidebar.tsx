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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SidebarUserMenu } from './sidebar-user-menu';

const navItems = [
  { href: '/', label: '项目管理', icon: LayoutGrid },
  { href: '/review', label: '复盘系统', icon: History },
  { href: '/planning', label: '策划系统', icon: Waypoints },
  { href: '/sentiment', label: '舆情系统', icon: MessageCircle },
  { href: '/admin/users', label: '账户管理', suffix: '（仅管理员）', icon: UserRound, adminOnly: true },
  { href: '/admin/settings', label: '系统设置', suffix: '（仅管理员）', icon: Settings, adminOnly: true },
] as const;

interface SidebarProps {
  collapsed?: boolean;
}

export function Sidebar({ collapsed = false }: SidebarProps) {
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
        'flex h-full flex-col border-r border-gray-100 bg-[#f8f8f8] transition-all duration-200',
        collapsed ? 'w-[72px]' : 'w-[220px]'
      )}
    >
      <nav className="flex-1 overflow-y-auto py-6 gap-2 flex flex-col">
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
            const displayLabel =
              'suffix' in item && item.suffix && !collapsed
                ? `${item.label}${item.suffix}`
                : item.label;

            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? displayLabel : undefined}
                className={cn(
                  'relative flex items-center text-xs font-medium transition-colors group',
                  collapsed ? 'mx-2 justify-center rounded-lg px-0 py-3' : 'gap-2 px-9 py-3.5',
                  isActive
                    ? 'bg-[#FFF9Eb] text-[#ff9100]'
                    : 'text-[#999999] hover:bg-[#FFF9Eb]/50 hover:text-[#ff9100] bg-[#fcfcfc]',
                  isActive &&
                    !collapsed &&
                    'before:absolute text-[#ffb600] before:left-0 before:top-1/2 before:h-[100%] before:w-[5px] before:-translate-y-1/2  before:bg-brand before:content-[""]'
                )}
              >
                <Icon
                  size={16}
                  strokeWidth={isActive ? 2.25 : 1.75}
                  className={cn(
                    'shrink-0 transition-colors',
                    isActive ? 'text-[#ff9100]' : 'text-[#999999]',
                    !isActive && 'group-hover:text-[#ff9100]'
                  )}
                />

                {!collapsed && <span className="leading-snug">{displayLabel}</span>}
              </Link>
            );
          })}
      </nav>

      <div className="shrink-0 border-t border-gray-200/90 py-1">
        <SidebarUserMenu userName={userName} collapsed={collapsed} />
      </div>
    </aside>
  );
}
