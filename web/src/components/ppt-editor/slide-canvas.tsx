'use client';

import { useCallback, useMemo } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PresentationSlide {
  index: number;
  type: string;
  content: Record<string, unknown>;
  layout?: string;
}

export interface SlideCanvasProps {
  slide: PresentationSlide;
  onContentChange: (content: Record<string, unknown>) => void;
  editable?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Extracts text content from a slide's content object and converts to HTML
 * for TipTap editing. Non-text fields (images, charts) are excluded.
 */
function slideContentToHtml(content: Record<string, unknown>): string {
  const parts: string[] = [];

  if (typeof content.title === 'string' && content.title) {
    parts.push(`<h1>${escapeHtml(content.title)}</h1>`);
  }

  if (typeof content.subtitle === 'string' && content.subtitle) {
    parts.push(`<h2>${escapeHtml(content.subtitle)}</h2>`);
  }

  if (typeof content.heading === 'string' && content.heading) {
    parts.push(`<h2>${escapeHtml(content.heading)}</h2>`);
  }

  if (typeof content.body === 'string' && content.body) {
    // Split by newlines and wrap in paragraphs
    const paragraphs = content.body.split('\n').filter(Boolean);
    for (const p of paragraphs) {
      parts.push(`<p>${escapeHtml(p)}</p>`);
    }
  }

  if (typeof content.text === 'string' && content.text) {
    const paragraphs = content.text.split('\n').filter(Boolean);
    for (const p of paragraphs) {
      parts.push(`<p>${escapeHtml(p)}</p>`);
    }
  }

  if (Array.isArray(content.bullets)) {
    parts.push('<ul>');
    for (const bullet of content.bullets) {
      if (typeof bullet === 'string') {
        parts.push(`<li>${escapeHtml(bullet)}</li>`);
      }
    }
    parts.push('</ul>');
  }

  if (Array.isArray(content.points)) {
    parts.push('<ul>');
    for (const point of content.points) {
      if (typeof point === 'string') {
        parts.push(`<li>${escapeHtml(point)}</li>`);
      }
    }
    parts.push('</ul>');
  }

  return parts.join('') || '<p></p>';
}

/**
 * Converts TipTap HTML back to a slide content object,
 * preserving non-text fields from the original content.
 */
function htmlToSlideContent(
  html: string,
  originalContent: Record<string, unknown>
): Record<string, unknown> {
  const updated: Record<string, unknown> = { ...originalContent };

  // Parse the HTML to extract text content
  const parser = typeof DOMParser !== 'undefined' ? new DOMParser() : null;
  if (!parser) return updated;

  const doc = parser.parseFromString(html, 'text/html');
  const body = doc.body;

  // Extract title from h1
  const h1 = body.querySelector('h1');
  if (h1 && 'title' in originalContent) {
    updated.title = h1.textContent || '';
  }

  // Extract subtitle/heading from h2
  const h2 = body.querySelector('h2');
  if (h2) {
    if ('subtitle' in originalContent) {
      updated.subtitle = h2.textContent || '';
    } else if ('heading' in originalContent) {
      updated.heading = h2.textContent || '';
    }
  }

  // Extract body text from paragraphs
  const paragraphs = body.querySelectorAll('p');
  if (paragraphs.length > 0) {
    const bodyText = Array.from(paragraphs)
      .map((p) => p.textContent || '')
      .filter(Boolean)
      .join('\n');
    if ('body' in originalContent) {
      updated.body = bodyText;
    } else if ('text' in originalContent) {
      updated.text = bodyText;
    }
  }

  // Extract bullets from ul/li
  const ul = body.querySelector('ul');
  if (ul) {
    const items = Array.from(ul.querySelectorAll('li')).map(
      (li) => li.textContent || ''
    );
    if ('bullets' in originalContent) {
      updated.bullets = items;
    } else if ('points' in originalContent) {
      updated.points = items;
    }
  }

  return updated;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Checks if the slide content has image fields
 */
function getImageFields(content: Record<string, unknown>): string[] {
  const imageKeys: string[] = [];
  for (const [key, value] of Object.entries(content)) {
    if (
      typeof value === 'string' &&
      (key.includes('image') ||
        key.includes('img') ||
        key.includes('photo') ||
        key.includes('background') ||
        value.match(/\.(png|jpg|jpeg|gif|svg|webp)$/i))
    ) {
      imageKeys.push(key);
    }
  }
  return imageKeys;
}

// ─── Slide Canvas Component ──────────────────────────────────────────────────

export function SlideCanvas({
  slide,
  onContentChange,
  editable = true,
}: SlideCanvasProps) {
  const initialHtml = useMemo(
    () => slideContentToHtml(slide.content),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [slide.index, JSON.stringify(slide.content)]
  );

  const imageFields = useMemo(() => getImageFields(slide.content), [slide.content]);

  const handleUpdate = useCallback(
    (html: string) => {
      const updatedContent = htmlToSlideContent(html, slide.content);
      onContentChange(updatedContent);
    },
    [slide.content, onContentChange]
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        bold: {},
        italic: {},
        bulletList: {},
        orderedList: {},
      }),
      Placeholder.configure({
        placeholder: '编辑幻灯片内容...',
      }),
    ],
    content: initialHtml,
    editable,
    onUpdate: ({ editor: ed }) => {
      handleUpdate(ed.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          'prose prose-sm max-w-none focus:outline-none min-h-[200px] px-6 py-4',
      },
    },
  });

  // Sync content when slide changes
  // We use a key-based approach via the parent, but also handle programmatic updates
  useMemo(() => {
    if (editor && initialHtml !== editor.getHTML()) {
      editor.commands.setContent(initialHtml, { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialHtml]);

  return (
    <div className="flex h-full flex-col">
      {/* Slide type indicator */}
      <div className="flex items-center gap-2 border-b bg-slate-50 px-4 py-1.5">
        <span className="rounded bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
          {slide.type || 'content'}
        </span>
        {slide.layout && (
          <span className="text-xs text-slate-400">布局: {slide.layout}</span>
        )}
      </div>

      {/* Editor area */}
      <div className="flex-1 overflow-y-auto">
        <div
          className={cn(
            'rounded-none border-0 bg-white',
            !editable && 'opacity-75 cursor-not-allowed'
          )}
        >
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* Image placeholders (non-editable) */}
      {imageFields.length > 0 && (
        <div className="border-t bg-slate-50 px-4 py-3">
          <p className="mb-2 text-xs font-medium text-slate-500">图片区域</p>
          <div className="flex flex-wrap gap-2">
            {imageFields.map((key) => (
              <div
                key={key}
                className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2"
              >
                <ImageIcon size={14} className="text-slate-400" />
                <span className="text-xs text-slate-500">{key}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
