'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export interface NavigationProps {
  className?: string
  children?: React.ReactNode
}

/**
 * Top navigation bar component.
 * Provides a consistent header across the application with space for
 * branding, search, and user actions.
 */
export function Navigation({ className, children }: NavigationProps) {
  return (
    <header
      className={cn(
        'flex h-14 items-center justify-between border-b border-gray-200 bg-white px-6',
        className
      )}
    >
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-gray-500">
          PPP + Presenton
        </span>
      </div>

      <div className="flex items-center gap-4">
        {children}
      </div>
    </header>
  )
}
