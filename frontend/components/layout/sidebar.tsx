'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

interface NavItem {
  label: string
  href: string
  icon?: React.ReactNode
}

const pppNavItems: NavItem[] = [
  { label: 'Dashboard', href: '/' },
  { label: 'Projects', href: '/projects' },
  { label: 'Planning', href: '/planning' },
  { label: 'Sentiment', href: '/sentiment' },
  { label: 'Admin', href: '/admin' },
]

const presentonNavItems: NavItem[] = [
  { label: 'Presentations', href: '/presentation' },
  { label: 'Templates', href: '/presentation/templates' },
]

/**
 * Side navigation component with links for PPP and Presenton routes.
 * Highlights the active route and groups navigation by domain.
 */
export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname()

  return (
    <aside
      className={cn(
        'flex h-full w-64 flex-col border-r border-gray-200 bg-gray-50',
        className
      )}
    >
      <div className="flex h-14 items-center border-b border-gray-200 px-4">
        <Link href="/" className="text-lg font-bold text-gray-900">
          PPP Platform
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto p-4" aria-label="Main navigation">
        <div className="mb-6">
          <h2 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Business
          </h2>
          <ul className="space-y-1">
            {pppNavItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'block rounded-md px-2 py-1.5 text-sm font-medium transition-colors',
                    pathname === item.href
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                  )}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Presentations
          </h2>
          <ul className="space-y-1">
            {presentonNavItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'block rounded-md px-2 py-1.5 text-sm font-medium transition-colors',
                    pathname === item.href || pathname?.startsWith(item.href + '/')
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                  )}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </aside>
  )
}
