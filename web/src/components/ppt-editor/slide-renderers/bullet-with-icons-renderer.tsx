'use client';

import React from 'react';

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
}

const BULLET_COLORS = [
  'bg-purple-600',
  'bg-blue-600',
  'bg-emerald-600',
  'bg-amber-600',
];

export function BulletWithIconsRenderer({ content }: BulletWithIconsRendererProps) {
  const { title, description } = content;
  const bullets = content.bullets || content.bulletPoints || [];

  return (
    <div className="flex h-full w-full flex-col px-10 py-8">
      {/* Title */}
      <h1 className="text-3xl font-bold text-gray-900 mb-2">
        {title || 'Key Points'}
      </h1>

      {description && (
        <p className="text-sm text-gray-600 mb-6 leading-relaxed">
          {description}
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
              {bullet.title && (
                <h3 className="text-base font-semibold text-gray-900 mb-0.5">
                  {bullet.title}
                </h3>
              )}
              {bullet.description && (
                <p className="text-xs text-gray-600 leading-relaxed">
                  {bullet.description}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
