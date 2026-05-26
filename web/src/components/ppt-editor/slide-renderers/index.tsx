'use client';

import React from 'react';
import { IntroSlideRenderer } from './intro-slide-renderer';
import { BasicInfoRenderer } from './basic-info-renderer';
import { BulletWithIconsRenderer } from './bullet-with-icons-renderer';
import { ChartWithBulletsRenderer } from './chart-with-bullets-renderer';
import { MetricsRenderer } from './metrics-renderer';
import { TableInfoRenderer } from './table-info-renderer';
import { NumberedBulletsRenderer } from './numbered-bullets-renderer';

// ─── Layout type to renderer mapping ─────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RendererComponent = React.FC<{ content: any; editable?: boolean; onContentChange?: (content: any) => void }>;

const LAYOUT_RENDERERS: Record<string, RendererComponent> = {
  'general:intro-slide': IntroSlideRenderer,
  'general:basic-info': BasicInfoRenderer,
  'general:bullet-with-icons': BulletWithIconsRenderer,
  'general:chart-with-bullets': ChartWithBulletsRenderer,
  'general:metrics': MetricsRenderer,
  'general:table-info': TableInfoRenderer,
  'general:numbered-bullets': NumberedBulletsRenderer,
};

// ─── Fallback renderer for unknown layouts ───────────────────────────────────

function FallbackRenderer({ content }: { content: Record<string, unknown> }) {
  const title = typeof content.title === 'string' ? content.title : null;

  return (
    <div className="flex h-full w-full flex-col items-center justify-center px-10 py-8 text-center">
      {title && (
        <h1 className="text-2xl font-bold text-gray-900 mb-4">{title}</h1>
      )}
      <div className="max-w-md text-xs text-gray-500 leading-relaxed">
        <pre className="whitespace-pre-wrap text-left bg-gray-50 rounded-lg p-4 overflow-auto max-h-[60%]">
          {JSON.stringify(content, null, 2)}
        </pre>
      </div>
    </div>
  );
}

// ─── Main slide renderer dispatcher ──────────────────────────────────────────

interface SlideRendererProps {
  layout: string;
  content: Record<string, unknown>;
  editable?: boolean;
  onContentChange?: (content: Record<string, unknown>) => void;
}

export function SlideRenderer({ layout, content, editable, onContentChange }: SlideRendererProps) {
  const Renderer = LAYOUT_RENDERERS[layout];

  if (Renderer) {
    return <Renderer content={content} editable={editable} onContentChange={onContentChange} />;
  }

  return <FallbackRenderer content={content} />;
}

export {
  IntroSlideRenderer,
  BasicInfoRenderer,
  BulletWithIconsRenderer,
  ChartWithBulletsRenderer,
  MetricsRenderer,
  TableInfoRenderer,
  NumberedBulletsRenderer,
};
