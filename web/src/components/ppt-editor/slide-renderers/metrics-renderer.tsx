'use client';

import React from 'react';

interface MetricItem {
  label?: string;
  value?: string;
  description?: string;
}

interface MetricsContent {
  title?: string;
  metrics?: MetricItem[];
}

interface MetricsRendererProps {
  content: MetricsContent;
}

export function MetricsRenderer({ content }: MetricsRendererProps) {
  const { title, metrics = [] } = content;

  const getGridCols = (count: number) => {
    if (count <= 2) return 'grid-cols-2';
    return 'grid-cols-3';
  };

  return (
    <div className="flex h-full w-full flex-col items-center justify-center px-10 py-8">
      {/* Title */}
      <h1 className="text-3xl font-bold text-gray-900 text-center mb-8">
        {title || 'Key Metrics'}
      </h1>

      {/* Metrics grid */}
      <div className={`grid ${getGridCols(metrics.length)} gap-6 w-full max-w-[90%]`}>
        {metrics.map((metric, index) => (
          <div key={index} className="flex flex-col items-center text-center space-y-2">
            {/* Label */}
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              {metric.label}
            </span>

            {/* Value */}
            <span className="text-3xl font-bold text-purple-600">
              {metric.value}
            </span>

            {/* Description box */}
            {metric.description && (
              <div className="mt-2 w-full rounded-lg bg-purple-600 px-3 py-2.5 shadow-sm">
                <p className="text-xs text-white leading-relaxed">
                  {metric.description}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
