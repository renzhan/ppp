'use client';

import React from 'react';
import { Loader2, Presentation } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PptPanelProps {
  presentationId?: string;
  onGenerate?: () => void;
  isGenerating?: boolean;
}

// ─── PPT Panel Component ─────────────────────────────────────────────────────

export function PptPanel({
  presentationId,
  onGenerate,
  isGenerating = false,
}: PptPanelProps) {
  // If presentationId exists, the page renders the iframe directly — nothing to show here
  if (presentationId) {
    return null;
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-12">
      <Presentation size={48} className="text-gray-300" />
      <div className="text-center">
        <p className="text-lg font-medium text-gray-600">PPT 尚未生成</p>
        <p className="mt-1 text-sm text-gray-400">
          点击按钮从当前报告内容生成 PPT
        </p>
      </div>
      <button
        onClick={onGenerate}
        disabled={isGenerating}
        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-base font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {isGenerating ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Presentation size={16} />
        )}
        生成 PPT
      </button>
      {isGenerating && (
        <p className="text-xs text-gray-400 animate-pulse">AI 正在生成，通常需要 1-3 分钟...</p>
      )}
    </div>
  );
}
