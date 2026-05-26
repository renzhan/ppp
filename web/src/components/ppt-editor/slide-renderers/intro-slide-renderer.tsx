'use client';

import React from 'react';

interface IntroSlideContent {
  title?: string;
  description?: string;
  presenterName?: string;
  presentationDate?: string;
}

interface IntroSlideRendererProps {
  content: IntroSlideContent;
}

export function IntroSlideRenderer({ content }: IntroSlideRendererProps) {
  const { title, description, presenterName, presentationDate } = content;

  const getInitials = (name: string) =>
    name.split(' ').map((w) => w.charAt(0).toUpperCase()).join('');

  return (
    <div className="flex h-full w-full items-center px-10 py-8">
      {/* Left - decorative placeholder */}
      <div className="flex-1 flex items-center justify-center pr-6">
        <div className="w-full max-w-[280px] aspect-[4/3] rounded-xl bg-gradient-to-br from-purple-100 to-purple-50 flex items-center justify-center shadow-inner">
          <span className="text-4xl font-bold text-purple-300">
            {getInitials(title || 'P')}
          </span>
        </div>
      </div>

      {/* Right - content */}
      <div className="flex-1 flex flex-col justify-center space-y-4 pl-6">
        <h1 className="text-3xl font-bold text-gray-900 leading-tight">
          {title || 'Untitled Presentation'}
        </h1>

        <div className="w-16 h-1 bg-purple-600 rounded-full" />

        {description && (
          <p className="text-sm text-gray-600 leading-relaxed">
            {description}
          </p>
        )}

        {/* Presenter info */}
        {(presenterName || presentationDate) && (
          <div className="mt-4 flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
            {presenterName && (
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-600 text-xs font-bold text-white">
                {getInitials(presenterName)}
              </div>
            )}
            <div className="flex flex-col">
              {presenterName && (
                <span className="text-sm font-semibold text-gray-900">
                  {presenterName}
                </span>
              )}
              {presentationDate && (
                <span className="text-xs text-gray-500">{presentationDate}</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
