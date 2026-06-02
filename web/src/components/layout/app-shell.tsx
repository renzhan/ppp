'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { Menu, PanelLeft, PanelLeftClose } from 'lucide-react';
import { Sidebar } from './sidebar';

const NO_SHELL_PATHS = ['/login', '/change-password'];

const BP_XL = 1280;
const BP_MD = 768;
const HEADER_HEIGHT = 'h-[66px]';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
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
    <div className="flex h-screen flex-col overflow-hidden bg-[#f1f1f1]">
      {/* 顶部通栏：100% 页面宽度 */}
      <header
        className={`relative z-30 flex ${HEADER_HEIGHT} w-full shrink-0 items-center gap-4 border-b border-gray-200/80 shadow-sm bg-white`}
      >
        {showHamburger && (
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="rounded-md p-1.5 text-gray-600 transition-colors hover:bg-gray-100"
            aria-label="打开导航菜单"
          >
            <Menu size={22} />
          </button>
        )}
        <img src="/images/logo.jpg" alt="元派盘盘" className="h-[66px] object-contain" />
        {!showHamburger && (
          <button
            type="button"
            onClick={() => {
              if (sidebarMode === 'expanded') {
                setSidebarMode('collapsed');
              } else if (sidebarMode === 'collapsed') {
                setSidebarMode('expanded');
              }
            }}
            className="rounded-md p-1.5 text-[#999999] transition-colors hover:bg-gray-100 hover:text-gray-600"
            aria-label={sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}
          >
            {sidebarCollapsed ? (
              <PanelLeft size={18} strokeWidth={1.75} />
            ) : (
              <PanelLeftClose size={18} strokeWidth={1.75} />
            )}
          </button>
        )}
      </header>

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {showHamburger && mobileOpen && (
          <div
            className="fixed inset-0 top-14 z-40 bg-black/30 transition-opacity duration-200"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
        )}

        <div
          className={
            showHamburger
              ? `fixed bottom-0 left-0 top-14 z-50 transition-transform duration-200 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`
              : 'relative h-full shrink-0'
          }
        >
          <Sidebar collapsed={sidebarCollapsed} />
        </div>

        <main className="min-w-0 flex-1 overflow-y-auto bg-[#F3F4F6] p-6">
          <div className="rounded-xl border border-gray-100 bg-white text-card-foreground shadow-sm p-6">
          {children}
          </div>
        </main>
      </div>
    </div>
  );
}
