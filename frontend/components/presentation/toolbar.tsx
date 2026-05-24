'use client'

import { Button } from '@/components/ui'
import { useAppDispatch, useAppSelector, type RootState } from '@/store'
import { setZoom, toggleNotes } from '@/store/slices/editor'

export interface ToolbarProps {
  onSave?: () => void
  onExportPptx?: () => void
  onExportPdf?: () => void
  isSaving?: boolean
}

export function Toolbar({ onSave, onExportPptx, onExportPdf, isSaving }: ToolbarProps) {
  const dispatch = useAppDispatch()
  const zoom = useAppSelector((state: RootState) => state.presentation.editor.zoom)
  const showNotes = useAppSelector((state: RootState) => state.presentation.editor.showNotes)

  const handleZoomIn = () => {
    dispatch(setZoom(Math.min(zoom + 10, 200)))
  }

  const handleZoomOut = () => {
    dispatch(setZoom(Math.max(zoom - 10, 50)))
  }

  return (
    <div className="flex items-center justify-between border-b bg-white px-4 py-2">
      <div className="flex items-center gap-2">
        {/* Zoom controls */}
        <Button variant="outline" size="sm" onClick={handleZoomOut} aria-label="Zoom out">
          −
        </Button>
        <span className="min-w-[3rem] text-center text-sm text-gray-600">
          {zoom}%
        </span>
        <Button variant="outline" size="sm" onClick={handleZoomIn} aria-label="Zoom in">
          +
        </Button>

        <div className="mx-2 h-5 w-px bg-gray-200" />

        {/* Notes toggle */}
        <Button
          variant={showNotes ? 'default' : 'outline'}
          size="sm"
          onClick={() => dispatch(toggleNotes())}
        >
          Notes
        </Button>
      </div>

      <div className="flex items-center gap-2">
        {onExportPdf && (
          <Button variant="outline" size="sm" onClick={onExportPdf}>
            Export PDF
          </Button>
        )}
        {onExportPptx && (
          <Button variant="outline" size="sm" onClick={onExportPptx}>
            Export PPTX
          </Button>
        )}
        {onSave && (
          <Button size="sm" onClick={onSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        )}
      </div>
    </div>
  )
}
