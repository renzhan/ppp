'use client'

import * as React from 'react'
import { Sidebar } from './sidebar'
import { Navigation } from './navigation'
import { cn } from '@/lib/utils'

export interface AppShellProps {
  children: React.ReactNode
  /** Optional content to render in the navigation bar (e.g., user menu) */
  navContent?: React.ReactNode
  className?: string
}

/**
 * Main application shell with sidebar navigation and content area.
 * Provides the standard layout structure for the unified platform.
 */
export function AppShell({ children, navContent, className }: AppShellProps) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Navigation>{navContent}</Navigation>
        <main className={cn('flex-1 overflow-y-auto p-6', className)}>
          {children}
        </main>
      </div>
    </div>
  )
}
