'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { Menu, PanelLeft, PanelLeftClose } from 'lucide-react';
import { Sidebar } from './sidebar';

const NO_SHELL_PATHS = ['/login', '/change-password'];

const BP_XL = 1280;
const BP_MD = 768;

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

  const toggleSidebar = () => {
    if (sidebarMode === 'expanded') {
      setSidebarMode('collapsed');
    } else if (sidebarMode === 'collapsed') {
      setSidebarMode('expanded');
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#f1f1f1]">
      {showHamburger && mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 transition-opacity duration-200"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <div
        className={
          showHamburger
            ? `fixed bottom-0 left-0 top-0 z-50 transition-transform duration-200 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`
            : 'relative h-full shrink-0'
        }
      >
        <Sidebar collapsed={sidebarCollapsed} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="relative z-30 flex shrink-0 items-center gap-3  bg-[#f5f5f5] py-2 px-6">
          {showHamburger ? (
            <button
              type="button"
              onClick={() => setMobileOpen(!mobileOpen)}
              className="rounded-md p-1.5 text-gray-600 transition-colors hover:bg-white/60"
              aria-label="打开导航菜单"
            >
              <Menu size={20} />
            </button>
          ) : (
            <button
              type="button"
              onClick={toggleSidebar}
              className="rounded-md p-1.5 text-[#666666] transition-colors hover:bg-white/60 hover:text-gray-800"
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

        <main className="min-h-0 flex-1 overflow-y-auto bg-[#f5f5f5] p-6 pt-0">
          <div className="rounded-xl border border-gray-100 bg-white py-6 px-8 text-card-foreground shadow-sm">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

