'use client';

import React from 'react';

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
}

export function NumberedBulletsRenderer({ content }: NumberedBulletsRendererProps) {
  const { title } = content;
  const items = content.items || content.bulletPoints || [];

  return (
    <div className="flex h-full w-full flex-col px-10 py-8">
      {/* Title */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 leading-tight">
          {title || 'Key Points'}
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
              {item.title && (
                <h3 className="text-sm font-semibold text-gray-900 mb-0.5">
                  {item.title}
                </h3>
              )}
              {item.description && (
                <p className="text-xs text-gray-600 leading-relaxed">
                  {item.description}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
