'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { AppShell } from '@/components/layout'
import { Button, Input, Card, CardHeader, CardTitle, CardContent } from '@/components/ui'
import { useExportPpt } from '@/lib/ppp-api'

export default function PptGenerationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const [slideCount, setSlideCount] = useState(15)
  const [language, setLanguage] = useState('zh')
  const [template, setTemplate] = useState('general')

  const exportPpt = useExportPpt()

  const handleGenerate = () => {
    exportPpt.mutate({
      projectId: id,
      options: { slideCount, language, template },
    })
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Breadcrumb */}
        <nav className="text-sm text-gray-500">
          <Link href="/projects" className="hover:text-gray-700">
            Projects
          </Link>
          <span className="mx-2">/</span>
          <Link href={`/projects/${id}`} className="hover:text-gray-700">
            Project
          </Link>
          <span className="mx-2">/</span>
          <Link href={`/review/${id}`} className="hover:text-gray-700">
            Review
          </Link>
          <span className="mx-2">/</span>
          <span className="text-gray-900">Generate PPT</span>
        </nav>

        <div>
          <h1 className="text-2xl font-bold tracking-tight">Generate Presentation</h1>
          <p className="mt-1 text-sm text-gray-500">
            Create a PowerPoint presentation from this project&apos;s review report.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Generation Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="ppt-slides" className="mb-1 block text-sm font-medium text-gray-700">
                  Number of Slides
                </label>
                <Input
                  id="ppt-slides"
                  type="number"
                  min={5}
                  max={50}
                  value={slideCount}
                  onChange={(e) => setSlideCount(Number(e.target.value))}
                />
              </div>

              <div>
                <label htmlFor="ppt-language" className="mb-1 block text-sm font-medium text-gray-700">
                  Language
                </label>
                <select
                  id="ppt-language"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                >
                  <option value="zh">Chinese</option>
                  <option value="en">English</option>
                  <option value="ja">Japanese</option>
                  <option value="ko">Korean</option>
                </select>
              </div>

              <div>
                <label htmlFor="ppt-template" className="mb-1 block text-sm font-medium text-gray-700">
                  Template
                </label>
                <select
                  id="ppt-template"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                >
                  <option value="general">General</option>
                  <option value="business">Business</option>
                  <option value="marketing">Marketing</option>
                  <option value="minimal">Minimal</option>
                </select>
              </div>
            </div>

            {/* Success result */}
            {exportPpt.isSuccess && (
              <div className="rounded-md border border-green-200 bg-green-50 p-4">
                <p className="text-sm font-medium text-green-800">
                  Presentation generated successfully!
                </p>
                <div className="mt-2 flex gap-3">
                  <Link
                    href={exportPpt.data.editUrl}
                    className="text-sm font-medium text-blue-600 hover:text-blue-700"
                  >
                    Open in Editor →
                  </Link>
                  <a
                    href={exportPpt.data.downloadUrl}
                    className="text-sm font-medium text-blue-600 hover:text-blue-700"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Download PPTX
                  </a>
                </div>
              </div>
            )}

            {/* Error */}
            {exportPpt.isError && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                Failed to generate presentation. Please try again.
              </div>
            )}

            {/* Submit */}
            <div className="flex justify-end">
              <Button
                onClick={handleGenerate}
                disabled={exportPpt.isPending}
              >
                {exportPpt.isPending ? 'Generating...' : 'Generate PPT'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
