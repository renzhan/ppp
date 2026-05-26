'use client';

import React, { useCallback } from 'react';
import { InlineEditableText } from '../inline-editable-text';

interface BulletItem {
  title?: string;
  description?: string;
  icon?: string | { __icon_url__?: string; __icon_query__?: string };
}

interface BulletWithIconsContent {
  title?: string;
  description?: string;
  bullets?: BulletItem[];
  bulletPoints?: BulletItem[];
}

interface BulletWithIconsRendererProps {
  content: BulletWithIconsContent;
  editable?: boolean;
  onContentChange?: (content: BulletWithIconsContent) => void;
}

const BULLET_COLORS = [
  'bg-purple-600',
  'bg-blue-600',
  'bg-emerald-600',
  'bg-amber-600',
];

export function BulletWithIconsRenderer({ content, editable, onContentChange }: BulletWithIconsRendererProps) {
  const { title, description } = content;
  const bullets = content.bullets || content.bulletPoints || [];
  const bulletsKey = content.bullets ? 'bullets' : 'bulletPoints';

  const handleTitleChange = useCallback((newTitle: string) => {
    onContentChange?.({ ...content, title: newTitle });
  }, [content, onContentChange]);

  const handleDescriptionChange = useCallback((newDesc: string) => {
    onContentChange?.({ ...content, description: newDesc });
  }, [content, onContentChange]);

  const handleBulletFieldChange = useCallback((index: number, field: string, value: string) => {
    const updatedBullets = [...bullets];
    updatedBullets[index] = { ...updatedBullets[index], [field]: value };
    onContentChange?.({ ...content, [bulletsKey]: updatedBullets });
  }, [bullets, bulletsKey, content, onContentChange]);

  return (
    <div className="flex h-full w-full flex-col px-10 py-8">
      {/* Title */}
      <h1 className="text-3xl font-bold text-gray-900 mb-2">
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

      {(description || editable) && (
        <p className="text-sm text-gray-600 mb-6 leading-relaxed">
          {editable && onContentChange ? (
            <InlineEditableText
              content={description || ''}
              onContentChange={handleDescriptionChange}
              placeholder="输入描述..."
              editable={editable}
            />
          ) : (
            description
          )}
        </p>
      )}

      {/* Bullet points */}
      <div className="flex-1 flex flex-col justify-center space-y-4">
        {bullets.map((bullet, index) => (
          <div key={index} className="flex items-start gap-4">
            {/* Icon circle */}
            <div
              className={`flex-shrink-0 w-10 h-10 rounded-lg ${BULLET_COLORS[index % BULLET_COLORS.length]} flex items-center justify-center shadow-sm`}
            >
              <span className="text-white text-sm font-bold">
                {bullet.title?.charAt(0)?.toUpperCase() || (index + 1).toString()}
              </span>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              {(bullet.title || editable) && (
                <h3 className="text-base font-semibold text-gray-900 mb-0.5">
                  {editable && onContentChange ? (
                    <InlineEditableText
                      content={bullet.title || ''}
                      onContentChange={(v) => handleBulletFieldChange(index, 'title', v)}
                      placeholder="要点标题..."
                      editable={editable}
                    />
                  ) : (
                    bullet.title
                  )}
                </h3>
              )}
              {(bullet.description || editable) && (
                <p className="text-xs text-gray-600 leading-relaxed">
                  {editable && onContentChange ? (
                    <InlineEditableText
                      content={bullet.description || ''}
                      onContentChange={(v) => handleBulletFieldChange(index, 'description', v)}
                      placeholder="要点描述..."
                      editable={editable}
                    />
                  ) : (
                    bullet.description
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
