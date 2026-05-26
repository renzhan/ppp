'use client';

import React, { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';

interface InlineEditableTextProps {
  content: string;
  onContentChange?: (content: string) => void;
  className?: string;
  placeholder?: string;
  editable?: boolean;
}

/**
 * Convert simple markdown (bold, italic) to HTML for TipTap
 */
function markdownToHtml(text: string): string {
  if (!text) return '';
  let html = text
    // Escape HTML entities first
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Bold: **text** or __text__
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    // Italic: *text* or _text_
    .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>')
    // Newlines to <br> or <p>
    .replace(/\n/g, '<br>');
  return `<p>${html}</p>`;
}

/**
 * Convert TipTap HTML back to markdown-like plain text
 */
function htmlToMarkdown(html: string): string {
  if (!html) return '';
  let text = html
    // Convert strong/b to **
    .replace(/<strong>(.*?)<\/strong>/g, '**$1**')
    .replace(/<b>(.*?)<\/b>/g, '**$1**')
    // Convert em/i to *
    .replace(/<em>(.*?)<\/em>/g, '*$1*')
    .replace(/<i>(.*?)<\/i>/g, '*$1*')
    // Convert <br> to newline
    .replace(/<br\s*\/?>/g, '\n')
    // Convert </p><p> to newline
    .replace(/<\/p>\s*<p>/g, '\n')
    // Strip remaining tags
    .replace(/<[^>]+>/g, '')
    // Decode entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
  return text.trim();
}

/**
 * Inline editable text component using TipTap.
 * Supports markdown bold (**text**) rendering.
 * Click to edit directly in place.
 */
export function InlineEditableText({
  content,
  onContentChange,
  className = '',
  placeholder = '点击编辑...',
  editable = true,
}: InlineEditableTextProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder }),
    ],
    content: markdownToHtml(content),
    editable,
    editorProps: {
      attributes: {
        class: `outline-none focus:outline-none focus:ring-1 focus:ring-blue-200 focus:bg-blue-50/30 rounded px-0.5 -mx-0.5 transition-all duration-200 ${className}`,
        'data-placeholder': placeholder,
      },
    },
    onBlur: ({ editor: ed }) => {
      if (onContentChange) {
        const html = ed.getHTML();
        const markdown = htmlToMarkdown(html);
        onContentChange(markdown);
      }
    },
    immediatelyRender: false,
  });

  // Sync content when prop changes externally
  useEffect(() => {
    if (!editor) return;
    const currentMarkdown = htmlToMarkdown(editor.getHTML());
    if ((content || '') !== currentMarkdown) {
      editor.commands.setContent(markdownToHtml(content));
    }
  }, [content, editor]);

  if (!editor) {
    return <span className={className}>{content || placeholder}</span>;
  }

  return (
    <EditorContent
      editor={editor}
      className="inline-editable-text w-full"
      style={{
        lineHeight: 'inherit',
        fontSize: 'inherit',
        fontWeight: 'inherit',
        fontFamily: 'inherit',
        color: 'inherit',
        textAlign: 'inherit',
      }}
    />
  );
}
