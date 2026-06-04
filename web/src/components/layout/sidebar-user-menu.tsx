'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronRight, KeyRound, LogOut, User } from 'lucide-react';
import { ChangePasswordModal } from '@/components/auth/change-password-modal';
import { cn } from '@/lib/utils';

interface SidebarUserMenuProps {
  userName: string | null;
  collapsed?: boolean;
}

export function SidebarUserMenu({ userName, collapsed }: SidebarUserMenuProps) {
  const [open, setOpen] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  return (
    <div ref={rootRef} className={cn('relative', collapsed ? 'px-2' : 'px-2')}>
      <ChangePasswordModal
        open={showChangePassword}
        onClose={() => setShowChangePassword(false)}
      />

      {open && (
        <div
          className={cn(
            'absolute z-50 min-w-[168px] rounded-xl border border-gray-100 bg-white p-1.5 shadow-[0_8px_24px_rgba(15,23,42,0.12)] animate-in',
            collapsed
              ? 'bottom-0 left-full ml-2'
              : 'bottom-full left-3 right-3 mb-2'
          )}
          role="menu"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              setShowChangePassword(true);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-xs text-gray-500 transition-colors hover:bg-gray-50"
          >
            <KeyRound size={16} className="shrink-0 text-gray-400" />
            修改密码
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              void handleLogout();
            }}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs text-gray-500 transition-colors hover:bg-gray-50"
          >
            <LogOut size={16} className="shrink-0 text-gray-400" />
            退出登录
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'flex w-full items-center rounded-lg transition-colors hover:bg-gray-100',
          collapsed ? 'justify-center p-2' : 'gap-2 px-2 py-1'
        )}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100">
          <User size={18} className="text-gray-500" />
        </div>
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1 truncate text-left text-xs font-medium text-gray-500">
              {userName ?? '未登录'}
            </span>
            <ChevronRight
              size={16}
              className={cn('shrink-0 text-gray-400 transition-transform', open && 'rotate-90')}
            />
          </>
        )}
      </button>
    </div>
  );
}
