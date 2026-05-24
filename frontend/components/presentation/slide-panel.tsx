'use client'

import { useAppDispatch, useAppSelector, type RootState } from '@/store'
import { setActiveSlide } from '@/store/slices/editor'
import type { Slide } from '@/store/slices/presentation'

export function SlidePanel() {
  const dispatch = useAppDispatch()
  const slides = useAppSelector((state: RootState) => state.presentation.data.slides)
  const activeIndex = useAppSelector((state: RootState) => state.presentation.editor.activeSlideIndex)

  return (
    <aside className="flex w-56 flex-col gap-2 overflow-y-auto border-r bg-gray-50 p-3">
      <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
        Slides
      </h2>
      {slides.length === 0 ? (
        <p className="text-xs text-gray-400">No slides yet</p>
      ) : (
        slides.map((slide: Slide, index: number) => (
          <button
            key={index}
            onClick={() => dispatch(setActiveSlide(index))}
            className={`group relative rounded-md border p-2 text-left transition ${
              index === activeIndex
                ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
            aria-label={`Slide ${index + 1}`}
            aria-current={index === activeIndex ? 'true' : undefined}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-600">
                {index + 1}
              </span>
              <span className="text-xs text-gray-400">{slide.type}</span>
            </div>
            <div className="mt-1 truncate text-xs text-gray-500">
              {slide.layout}
            </div>
          </button>
        ))
      )}
    </aside>
  )
}
