'use client';

import { type Editor } from '@tiptap/react';
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Table,
  Quote,
  Save,
  FileDown,
  FileText,
  Presentation,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

interface EditorToolbarProps {
  editor: Editor | null;
  onGeneratePPT: () => void;
  onSave: () => void;
  onExportPDF: () => void;
  onExportWord: () => void;
  isSaving: boolean;
  isGenerating: boolean;
}

// ─── Toolbar Button ──────────────────────────────────────────────────────────

interface ToolbarButtonProps {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}

function ToolbarButton({ onClick, isActive, disabled, title, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-pressed={isActive}
      className={cn(
        'inline-flex items-center justify-center rounded-md p-2 text-sm transition-colors',
        'hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        isActive && 'bg-gray-200 text-primary',
        disabled && 'cursor-not-allowed opacity-50'
      )}
    >
      {children}
    </button>
  );
}

// ─── Editor Toolbar Component ────────────────────────────────────────────────

export function EditorToolbar({
  editor,
  onGeneratePPT,
  onSave,
  onExportPDF,
  onExportWord,
  isSaving,
  isGenerating,
}: EditorToolbarProps) {
  const isDisabled = !editor || !editor.isEditable;

  return (
    <div
      className="flex flex-wrap items-center gap-1 rounded-t-lg border border-b-0 border-gray-200 bg-gray-50 px-2 py-1"
      role="toolbar"
      aria-label="编辑器工具栏"
    >
      {/* Format buttons */}
      <div className="flex items-center gap-0.5">
        <ToolbarButton
          onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
          isActive={editor?.isActive('heading', { level: 1 })}
          disabled={isDisabled}
          title="标题 1"
        >
          <Heading1 className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={editor?.isActive('heading', { level: 2 })}
          disabled={isDisabled}
          title="标题 2"
        >
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
          isActive={editor?.isActive('heading', { level: 3 })}
          disabled={isDisabled}
          title="标题 3"
        >
          <Heading3 className="h-4 w-4" />
        </ToolbarButton>
      </div>

      <div className="mx-1 h-6 w-px bg-gray-300" aria-hidden="true" />

      <div className="flex items-center gap-0.5">
        <ToolbarButton
          onClick={() => editor?.chain().focus().toggleBold().run()}
          isActive={editor?.isActive('bold')}
          disabled={isDisabled}
          title="加粗"
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          isActive={editor?.isActive('italic')}
          disabled={isDisabled}
          title="斜体"
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
      </div>

      <div className="mx-1 h-6 w-px bg-gray-300" aria-hidden="true" />

      <div className="flex items-center gap-0.5">
        <ToolbarButton
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          isActive={editor?.isActive('bulletList')}
          disabled={isDisabled}
          title="无序列表"
        >
          <List className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          isActive={editor?.isActive('orderedList')}
          disabled={isDisabled}
          title="有序列表"
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
      </div>

      <div className="mx-1 h-6 w-px bg-gray-300" aria-hidden="true" />

      <div className="flex items-center gap-0.5">
        <ToolbarButton
          onClick={() =>
            editor
              ?.chain()
              .focus()
              .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
              .run()
          }
          isActive={editor?.isActive('table')}
          disabled={isDisabled}
          title="插入表格"
        >
          <Table className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
          isActive={editor?.isActive('blockquote')}
          disabled={isDisabled}
          title="引用"
        >
          <Quote className="h-4 w-4" />
        </ToolbarButton>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Action buttons */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving}
          title="保存"
          aria-label="保存"
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            isSaving && 'cursor-not-allowed opacity-50'
          )}
        >
          <Save className="h-4 w-4" />
          <span>{isSaving ? '保存中...' : '保存'}</span>
        </button>

        <button
          type="button"
          onClick={onExportPDF}
          disabled={isDisabled}
          title="导出 PDF"
          aria-label="导出 PDF"
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            isDisabled && 'cursor-not-allowed opacity-50'
          )}
        >
          <FileDown className="h-4 w-4" />
          <span>PDF</span>
        </button>

        <button
          type="button"
          onClick={onExportWord}
          disabled={isDisabled}
          title="导出 Word"
          aria-label="导出 Word"
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            isDisabled && 'cursor-not-allowed opacity-50'
          )}
        >
          <FileText className="h-4 w-4" />
          <span>Word</span>
        </button>

        <button
          type="button"
          onClick={onGeneratePPT}
          disabled={isGenerating || isDisabled}
          title="生成 PPT"
          aria-label="生成 PPT"
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            'bg-primary text-white hover:bg-primary/90',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
            (isGenerating || isDisabled) && 'cursor-not-allowed opacity-50'
          )}
        >
          <Presentation className="h-4 w-4" />
          <span>{isGenerating ? '生成中...' : '生成 PPT'}</span>
        </button>
      </div>
    </div>
  );
}

export { type EditorToolbarProps };
