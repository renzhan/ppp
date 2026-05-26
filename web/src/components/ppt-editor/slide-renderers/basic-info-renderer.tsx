'use client';

import React, { useCallback } from 'react';
import { InlineEditableText } from '../inline-editable-text';

interface BasicInfoContent {
  title?: string;
  content?: string;
  description?: string;
}

interface BasicInfoRendererProps {
  content: BasicInfoContent;
  editable?: boolean;
  onContentChange?: (content: BasicInfoContent) => void;
}

export function BasicInfoRenderer({ content, editable, onContentChange }: BasicInfoRendererProps) {
  const { title, content: bodyContent, description } = content;
  const text = bodyContent || description || '';
  const textKey = bodyContent !== undefined ? 'content' : 'description';

  const handleTitleChange = useCallback((newTitle: string) => {
    onContentChange?.({ ...content, title: newTitle });
  }, [content, onContentChange]);

  const handleTextChange = useCallback((newText: string) => {
    onContentChange?.({ ...content, [textKey]: newText });
  }, [content, textKey, onContentChange]);

  return (
    <div className="flex h-full w-full items-center px-10 py-8">
      {/* Left - decorative area */}
      <div className="flex-1 flex items-center justify-center pr-6">
        <div className="w-full max-w-[280px] aspect-[4/3] rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center shadow-inner">
          <svg className="w-16 h-16 text-blue-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
      </div>

      {/* Right - content */}
      <div className="flex-1 flex flex-col justify-center space-y-4 pl-6">
        <h1 className="text-3xl font-bold text-gray-900 leading-tight">
          {editable && onContentChange ? (
            <InlineEditableText
              content={title || ''}
              onContentChange={handleTitleChange}
              placeholder="输入标题..."
              editable={editable}
            />
          ) : (
            title || 'Information'
          )}
        </h1>

        <div className="w-16 h-1 bg-purple-600 rounded-full" />

        {(text || editable) && (
          <div className="text-sm text-gray-600 leading-relaxed">
            {editable && onContentChange ? (
              <InlineEditableText
                content={text}
                onContentChange={handleTextChange}
                placeholder="输入正文内容..."
                editable={editable}
              />
            ) : (
              <span className="whitespace-pre-line">{text}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
