'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { User, Menu } from 'lucide-react';
import { Sidebar } from './sidebar';

// Pages that should NOT show the sidebar
const NO_SHELL_PATHS = ['/login', '/change-password'];

// Breakpoints
const BP_XL = 1280;
const BP_MD = 768;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [userName, setUserName] = useState<string | null>(null);

  // Responsive sidebar state
  // 'expanded' = full sidebar, 'collapsed' = icon-only, 'hidden' = off-screen (mobile)
  const [sidebarMode, setSidebarMode] = useState<'expanded' | 'collapsed' | 'hidden'>('expanded');
  const [mobileOpen, setMobileOpen] = useState(false);

  const updateSidebarMode = useCallback(() => {
    const width = window.innerWidth;
    if (width >= BP_XL) {
      setSidebarMode('expanded');
      setMobileOpen(false);
    } else if (width >= BP_MD) {
      setSidebarMode('collapsed');
      setMobileOpen(false);
    } else {
      setSidebarMode('hidden');
    }
  }, []);

  useEffect(() => {
    updateSidebarMode();
    window.addEventListener('resize', updateSidebarMode);
    return () => window.removeEventListener('resize', updateSidebarMode);
  }, [updateSidebarMode]);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setUserName(data.user.displayName || data.user.username);
        }
      })
      .catch(() => {});
  }, []);

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const isNoShell = NO_SHELL_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  );

  if (isNoShell) {
    return <>{children}</>;
  }

  const showHamburger = sidebarMode === 'hidden';
  const sidebarCollapsed = sidebarMode === 'collapsed';

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile overlay backdrop */}
      {showHamburger && mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 transition-opacity duration-200"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar: always visible on md+, overlay on mobile */}
      <div
        className={
          showHamburger
            ? `fixed inset-y-0 left-0 z-50 transition-transform duration-200 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`
            : 'relative'
        }
      >
        <Sidebar collapsed={sidebarCollapsed} onToggleCollapse={() => {
          if (sidebarMode === 'expanded') {
            setSidebarMode('collapsed');
          } else if (sidebarMode === 'collapsed') {
            setSidebarMode('expanded');
          }
        }} />
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar with user info */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-gray-200 px-6">
          <div className="flex items-center">
            {showHamburger && (
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="rounded p-1.5 text-gray-600 hover:bg-gray-100"
                aria-label="打开导航菜单"
              >
                <Menu size={22} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
              <User size={16} className="text-gray-500" />
            </div>
            {userName && (
              <span className="text-sm text-gray-700">{userName}</span>
            )}
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
