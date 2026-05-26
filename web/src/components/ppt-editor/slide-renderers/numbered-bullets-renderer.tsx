'use client';

import React, { useCallback } from 'react';
import { InlineEditableText } from '../inline-editable-text';

interface NumberedItem {
  title?: string;
  description?: string;
}

interface NumberedBulletsContent {
  title?: string;
  items?: NumberedItem[];
  bulletPoints?: NumberedItem[];
}

interface NumberedBulletsRendererProps {
  content: NumberedBulletsContent;
  editable?: boolean;
  onContentChange?: (content: NumberedBulletsContent) => void;
}

export function NumberedBulletsRenderer({ content, editable, onContentChange }: NumberedBulletsRendererProps) {
  const { title } = content;
  const items = content.items || content.bulletPoints || [];
  const itemsKey = content.items ? 'items' : 'bulletPoints';

  const handleTitleChange = useCallback((newTitle: string) => {
    onContentChange?.({ ...content, title: newTitle });
  }, [content, onContentChange]);

  const handleItemFieldChange = useCallback((index: number, field: string, value: string) => {
    const updatedItems = [...items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    onContentChange?.({ ...content, [itemsKey]: updatedItems });
  }, [items, itemsKey, content, onContentChange]);

  return (
    <div className="flex h-full w-full flex-col px-10 py-8">
      {/* Title */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 leading-tight">
          {editable && onContentChange ? (
            <InlineEditableText
              content={title || ''}
              onContentChange={handleTitleChange}
              placeholder="输入标题..."
              editable={editable}
            />
          ) : (
            title || 'Key Points'
          )}
        </h1>
        <div className="w-16 h-1 bg-purple-600 rounded-full mt-2" />
      </div>

      {/* Numbered items grid */}
      <div className="flex-1 grid grid-cols-2 gap-x-8 gap-y-4 content-center">
        {items.map((item, index) => (
          <div key={index} className="flex items-start gap-3">
            {/* Number */}
            <span className="flex-shrink-0 text-2xl font-bold text-gray-800">
              {String(index + 1).padStart(2, '0')}
            </span>

            {/* Content */}
            <div className="flex-1 pt-1">
              {(item.title || editable) && (
                <h3 className="text-sm font-semibold text-gray-900 mb-0.5">
                  {editable && onContentChange ? (
                    <InlineEditableText
                      content={item.title || ''}
                      onContentChange={(v) => handleItemFieldChange(index, 'title', v)}
                      placeholder="标题..."
                      editable={editable}
                    />
                  ) : (
                    item.title
                  )}
                </h3>
              )}
              {(item.description || editable) && (
                <p className="text-xs text-gray-600 leading-relaxed">
                  {editable && onContentChange ? (
                    <InlineEditableText
                      content={item.description || ''}
                      onContentChange={(v) => handleItemFieldChange(index, 'description', v)}
                      placeholder="描述..."
                      editable={editable}
                    />
                  ) : (
                    item.description
                  )}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
