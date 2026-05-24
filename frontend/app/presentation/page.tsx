'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/layout'
import { Button, Input, Card, CardHeader, CardTitle, CardContent } from '@/components/ui'
import { generatePresentation, getTemplates } from '@/lib/presenton-client'
import type { Template } from '@/lib/presenton-client'
import { useQuery, useMutation } from '@tanstack/react-query'

export default function PresentationGeneratorPage() {
  const router = useRouter()
  const [content, setContent] = useState('')
  const [slideCount, setSlideCount] = useState(10)
  const [language, setLanguage] = useState('zh')
  const [selectedTemplate, setSelectedTemplate] = useState('general')

  const { data: templates } = useQuery<Template[]>({
    queryKey: ['presenton', 'templates'],
    queryFn: () => getTemplates(),
  })

  const generate = useMutation({
    mutationFn: () =>
      generatePresentation({
        content,
        n_slides: slideCount,
        language,
        template: selectedTemplate,
        tone: 'professional',
        verbosity: 'standard',
        include_title_slide: true,
      }),
    onSuccess: (result) => {
      router.push(`/presentation/${result.presentation_id}`)
    },
  })

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Generate Presentation</h1>
          <p className="mt-1 text-sm text-gray-500">
            Create a new AI-powered presentation from your content.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Content</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Content input */}
            <div>
              <label htmlFor="content" className="mb-1 block text-sm font-medium text-gray-700">
                Presentation Content
              </label>
              <textarea
                id="content"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                rows={8}
                placeholder="Enter the content for your presentation. You can paste text, markdown, or a topic description..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            </div>

            {/* Settings row */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="slideCount" className="mb-1 block text-sm font-medium text-gray-700">
                  Number of Slides
                </label>
                <Input
                  id="slideCount"
                  type="number"
                  min={3}
                  max={50}
                  value={slideCount}
                  onChange={(e) => setSlideCount(Number(e.target.value))}
                />
              </div>

              <div>
                <label htmlFor="language" className="mb-1 block text-sm font-medium text-gray-700">
                  Language
                </label>
                <select
                  id="language"
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
                <label htmlFor="template" className="mb-1 block text-sm font-medium text-gray-700">
                  Template
                </label>
                <select
                  id="template"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={selectedTemplate}
                  onChange={(e) => setSelectedTemplate(e.target.value)}
                >
                  <option value="general">General</option>
                  {templates?.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Error display */}
            {generate.isError && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                Failed to generate presentation. Please try again.
              </div>
            )}

            {/* Submit */}
            <div className="flex justify-end">
              <Button
                onClick={() => generate.mutate()}
                disabled={!content.trim() || generate.isPending}
              >
                {generate.isPending ? 'Generating...' : 'Generate Presentation'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
