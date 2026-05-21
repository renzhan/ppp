'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from './sidebar';

// Pages that should NOT show the sidebar
const NO_SHELL_PATHS = ['/login', '/change-password'];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isNoShell = NO_SHELL_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  );

  if (isNoShell) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  );
}
