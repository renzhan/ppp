'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect } from 'react';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

interface TipTapEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  editable?: boolean;
  className?: string;
  onEditorReady?: (editor: ReturnType<typeof useEditor>) => void;
}

// ─── TipTap Editor Component ─────────────────────────────────────────────────

export function TipTapEditor({
  content,
  onChange,
  placeholder = '开始编辑...',
  editable = true,
  className,
  onEditorReady,
}: TipTapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        undoRedo: {
          depth: 100,
        },
        bold: {},
        italic: {},
        bulletList: {},
        orderedList: {},
        blockquote: {},
        codeBlock: {},
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableCell,
      TableHeader,
      Placeholder.configure({
        placeholder,
      }),
    ],
    content,
    editable,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          'prose prose-sm sm:prose-base max-w-none focus:outline-none min-h-[300px] px-4 py-3',
      },
    },
  });

  // Sync editable prop changes
  useEffect(() => {
    if (editor && editor.isEditable !== editable) {
      editor.setEditable(editable);
    }
  }, [editor, editable]);

  // Sync external content changes (e.g., chapter switching)
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content, { emitUpdate: false });
    }
  }, [editor, content]);

  // Expose editor instance to parent via callback
  useEffect(() => {
    if (editor && onEditorReady) {
      onEditorReady(editor);
    }
  }, [editor, onEditorReady]);

  return (
    <div
      className={cn(
        'rounded-lg border border-gray-200 bg-white',
        !editable && 'opacity-75 cursor-not-allowed',
        className
      )}
    >
      <EditorContent editor={editor} />
    </div>
  );
}

export { type TipTapEditorProps };
