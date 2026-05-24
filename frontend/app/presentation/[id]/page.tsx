'use client'

import { use, useEffect, useCallback, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { AppShell } from '@/components/layout'
import { SlidePanel } from '@/components/presentation/slide-panel'
import { Toolbar } from '@/components/presentation/toolbar'
import { useAppDispatch } from '@/store'
import { setPresentation, setPresentationLoading, setPresentationError } from '@/store/slices/presentation'
import { setActiveSlide } from '@/store/slices/editor'
import { setTheme } from '@/store/slices/theme'
import { getPresentation, editPresentation, exportPptx, exportPdf } from '@/lib/presenton-client'
import type { SlideData } from '@/lib/presenton-client'

// Lazy load the SlideEditor component (code-splitting for performance)
const SlideEditor = dynamic(
  () => import('@/components/presentation/slide-editor'),
  { ssr: false, loading: () => <EditorSkeleton /> }
)

function EditorSkeleton() {
  return (
    <div className="flex flex-1 items-center justify-center bg-gray-100">
      <div className="text-sm text-gray-400">Loading editor...</div>
    </div>
  )
}

export default function PresentationEditorPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const dispatch = useAppDispatch()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [slides, setSlides] = useState<SlideData[]>([])

  // Load presentation data
  useEffect(() => {
    let cancelled = false

    async function load() {
      setIsLoading(true)
      setError(null)
      dispatch(setPresentationLoading(true))

      try {
        const presentation = await getPresentation(id)
        if (cancelled) return

        dispatch(
          setPresentation({
            id: presentation.id,
            title: presentation.title,
            slides: presentation.slides.map((s) => ({
              index: s.index,
              type: s.type as 'title' | 'content' | 'chart' | 'table' | 'image',
              content: s.content,
              layout: s.layout,
              notes: s.notes ?? null,
            })),
            template: presentation.template,
          })
        )
        dispatch(
          setTheme({
            primaryColor: presentation.theme.primary_color,
            secondaryColor: presentation.theme.secondary_color,
            fontFamily: presentation.theme.font_family,
            background: presentation.theme.background,
          })
        )
        dispatch(setActiveSlide(0))
        setSlides(presentation.slides)
      } catch (err) {
        if (cancelled) return
        const message = err instanceof Error ? err.message : 'Failed to load presentation'
        setError(message)
        dispatch(setPresentationError(message))
      } finally {
        if (!cancelled) {
          setIsLoading(false)
          dispatch(setPresentationLoading(false))
        }
      }
    }

    load()
    return () => { cancelled = true }
  }, [id, dispatch])

  // Handle content changes from the editor
  const handleContentChange = useCallback(
    (index: number, content: string) => {
      setSlides((prev) =>
        prev.map((s, i) =>
          i === index ? { ...s, content: { ...s.content, text: content } } : s
        )
      )
    },
    []
  )

  // Save presentation
  const handleSave = useCallback(async () => {
    setIsSaving(true)
    try {
      await editPresentation({
        presentation_id: id,
        slides,
      })
    } catch {
      // Error handling - could show a toast
    } finally {
      setIsSaving(false)
    }
  }, [id, slides])

  // Export handlers
  const handleExportPptx = useCallback(async () => {
    try {
      const result = await exportPptx({ presentation_id: id })
      window.open(result.url, '_blank')
    } catch {
      // Error handling
    }
  }, [id])

  const handleExportPdf = useCallback(async () => {
    try {
      const result = await exportPdf({ presentation_id: id })
      window.open(result.url, '_blank')
    } catch {
      // Error handling
    }
  }, [id])

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
          <p className="text-gray-500">Loading presentation...</p>
        </div>
      </AppShell>
    )
  }

  if (error) {
    return (
      <AppShell>
        <div className="flex h-[calc(100vh-4rem)] flex-col items-center justify-center gap-4">
          <p className="text-red-600">{error}</p>
          <Link href="/presentation" className="text-sm text-blue-600 hover:underline">
            Back to presentations
          </Link>
        </div>
      </AppShell>
    )
  }

  return (
    <div className="flex h-screen flex-col">
      {/* Toolbar */}
      <Toolbar
        onSave={handleSave}
        onExportPptx={handleExportPptx}
        onExportPdf={handleExportPdf}
        isSaving={isSaving}
      />

      {/* Main editor layout: slide panel | editor | properties */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Slide panel */}
        <SlidePanel />

        {/* Center: Slide editor (lazy loaded) */}
        <SlideEditor onContentChange={handleContentChange} />

        {/* Right: Properties panel */}
        <aside className="w-64 overflow-y-auto border-l bg-white p-4">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Properties
          </h2>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Slide Type
              </label>
              <p className="text-sm text-gray-800">
                {slides[0]?.type ?? '—'}
              </p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Layout
              </label>
              <p className="text-sm text-gray-800">
                {slides[0]?.layout ?? '—'}
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
