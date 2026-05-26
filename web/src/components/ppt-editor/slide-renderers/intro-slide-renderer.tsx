'use client';

import React, { useCallback } from 'react';
import { InlineEditableText } from '../inline-editable-text';

interface IntroSlideContent {
  title?: string;
  subtitle?: string;
  author?: string;
  date?: string;
}

interface IntroSlideRendererProps {
  content: IntroSlideContent;
  editable?: boolean;
  onContentChange?: (content: IntroSlideContent) => void;
}

export function IntroSlideRenderer({ content, editable, onContentChange }: IntroSlideRendererProps) {
  const { title, subtitle, author, date } = content;

  const handleFieldChange = useCallback((field: string, value: string) => {
    onContentChange?.({ ...content, [field]: value });
  }, [content, onContentChange]);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center px-12 py-10 text-center bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Title */}
      <h1 className="text-4xl font-bold text-gray-900 mb-4 max-w-[80%]">
        {editable && onContentChange ? (
          <InlineEditableText
            content={title || ''}
            onContentChange={(v) => handleFieldChange('title', v)}
            placeholder="输入标题..."
            editable={editable}
          />
        ) : (
          title || 'Presentation Title'
        )}
      </h1>

      {/* Subtitle */}
      {(subtitle || editable) && (
        <p className="text-lg text-gray-600 mb-8 max-w-[70%]">
          {editable && onContentChange ? (
            <InlineEditableText
              content={subtitle || ''}
              onContentChange={(v) => handleFieldChange('subtitle', v)}
              placeholder="输入副标题..."
              editable={editable}
            />
          ) : (
            subtitle
          )}
        </p>
      )}

      {/* Divider */}
      <div className="w-20 h-1 bg-purple-600 rounded-full mb-6" />

      {/* Author & Date */}
      <div className="flex flex-col items-center gap-1">
        {(author || editable) && (
          <span className="text-sm font-medium text-gray-700">
            {editable && onContentChange ? (
              <InlineEditableText
                content={author || ''}
                onContentChange={(v) => handleFieldChange('author', v)}
                placeholder="作者"
                editable={editable}
              />
            ) : (
              author
            )}
          </span>
        )}
        {(date || editable) && (
          <span className="text-xs text-gray-500">
            {editable && onContentChange ? (
              <InlineEditableText
                content={date || ''}
                onContentChange={(v) => handleFieldChange('date', v)}
                placeholder="日期"
                editable={editable}
              />
            ) : (
              date
            )}
          </span>
        )}
      </div>
    </div>
  );
}
