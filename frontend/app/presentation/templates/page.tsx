'use client'

import Link from 'next/link'
import { AppShell } from '@/components/layout'
import { Card, CardContent } from '@/components/ui'
import { getTemplates } from '@/lib/presenton-client'
import type { Template } from '@/lib/presenton-client'
import { useQuery } from '@tanstack/react-query'

export default function TemplateGalleryPage() {
  const { data: templates, isLoading, isError } = useQuery<Template[]>({
    queryKey: ['presenton', 'templates'],
    queryFn: () => getTemplates(),
  })

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Template Gallery</h1>
            <p className="mt-1 text-sm text-gray-500">
              Browse available presentation templates.
            </p>
          </div>
          <Link
            href="/presentation"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Create Presentation
          </Link>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-gray-500">Loading templates...</div>
        ) : isError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
            Failed to load templates. Please try again.
          </div>
        ) : !templates || templates.length === 0 ? (
          <div className="py-12 text-center text-gray-500">
            No templates available.
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((template) => (
              <Card key={template.id} className="overflow-hidden transition hover:shadow-md">
                <div className="aspect-[16/9] bg-gray-100">
                  {template.thumbnail ? (
                    <img
                      src={template.thumbnail}
                      alt={template.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-gray-400">
                      <span className="text-3xl">📊</span>
                    </div>
                  )}
                </div>
                <CardContent className="p-4">
                  <h3 className="font-medium text-gray-900">{template.name}</h3>
                  <p className="mt-1 text-sm text-gray-500">{template.description}</p>
                  <Link
                    href={`/presentation?template=${template.id}`}
                    className="mt-3 inline-block text-sm font-medium text-blue-600 hover:text-blue-700"
                  >
                    Use template →
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
