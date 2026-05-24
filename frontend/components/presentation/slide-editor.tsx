'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useAppSelector, type RootState } from '@/store'

export interface SlideEditorProps {
  onContentChange?: (index: number, content: string) => void
}

/**
 * Main slide editor component with TipTap rich text editing.
 * This component is lazy-loaded via Next.js dynamic() import.
 */
export function SlideEditor({ onContentChange }: SlideEditorProps) {
  const slides = useAppSelector((state: RootState) => state.presentation.data.slides)
  const activeIndex = useAppSelector((state: RootState) => state.presentation.editor.activeSlideIndex)
  const showNotes = useAppSelector((state: RootState) => state.presentation.editor.showNotes)
  const zoom = useAppSelector((state: RootState) => state.presentation.editor.zoom)

  const activeSlide = slides[activeIndex] ?? null

  const slideContent = activeSlide
    ? (activeSlide.content?.text as string) ?? (activeSlide.content?.title as string) ?? ''
    : ''

  const editor = useEditor({
    extensions: [StarterKit],
    content: slideContent,
    onUpdate: ({ editor: ed }) => {
      onContentChange?.(activeIndex, ed.getHTML())
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[200px] p-4',
        'aria-label': 'Slide content editor',
      },
    },
  })

  if (!activeSlide) {
    return (
      <div className="flex flex-1 items-center justify-center text-gray-400">
        Select a slide to edit
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Slide canvas */}
      <div
        className="flex flex-1 items-center justify-center overflow-auto bg-gray-100 p-8"
        style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'center center' }}
      >
        <div className="aspect-[16/9] w-full max-w-3xl rounded-lg border bg-white shadow-lg">
          {/* Slide type indicator */}
          <div className="border-b px-4 py-2">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-400">
              {activeSlide.type} — {activeSlide.layout}
            </span>
          </div>

          {/* TipTap editor */}
          <div className="p-4">
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>

      {/* Notes panel */}
      {showNotes && (
        <div className="border-t bg-white p-4">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Speaker Notes
          </h3>
          <p className="text-sm text-gray-600">
            {activeSlide.notes ?? 'No notes for this slide.'}
          </p>
        </div>
      )}
    </div>
  )
}

export default SlideEditor
