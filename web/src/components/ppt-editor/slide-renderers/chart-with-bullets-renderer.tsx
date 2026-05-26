'use client';

import React from 'react';

interface ChartDataItem {
  name?: string;
  label?: string;
  value: number;
}

interface BulletItem {
  title?: string;
  description?: string;
}

interface ChartWithBulletsContent {
  title?: string;
  description?: string;
  chartData?: {
    type?: string;
    data?: ChartDataItem[];
  } | ChartDataItem[];
  bullets?: BulletItem[];
  bulletPoints?: BulletItem[];
}

interface ChartWithBulletsRendererProps {
  content: ChartWithBulletsContent;
}

function SimpleBarChart({ data }: { data: ChartDataItem[] }) {
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="flex items-end gap-2 h-full w-full px-2 pb-4 pt-2">
      {data.map((item, index) => {
        const heightPercent = (item.value / maxValue) * 100;
        return (
          <div key={index} className="flex-1 flex flex-col items-center justify-end h-full">
            <div
              className="w-full rounded-t-sm bg-purple-500 transition-all min-h-[4px]"
              style={{ height: `${heightPercent}%` }}
            />
            <span className="mt-1 text-[9px] text-gray-500 truncate w-full text-center">
              {item.name || item.label || `#${index + 1}`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function ChartWithBulletsRenderer({ content }: ChartWithBulletsRendererProps) {
  const { title, description } = content;
  const bullets = content.bullets || content.bulletPoints || [];

  // Normalize chart data - handle both array and object with data property
  let chartItems: ChartDataItem[] = [];
  if (Array.isArray(content.chartData)) {
    chartItems = content.chartData;
  } else if (content.chartData?.data && Array.isArray(content.chartData.data)) {
    chartItems = content.chartData.data;
  }

  return (
    <div className="flex h-full w-full px-10 py-8">
      {/* Left - title, description, chart */}
      <div className="flex-1 flex flex-col pr-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          {title || 'Data Overview'}
        </h1>
        {description && (
          <p className="text-xs text-gray-600 mb-4 leading-relaxed">
            {description}
          </p>
        )}

        {/* Chart area */}
        <div className="flex-1 rounded-lg border border-gray-100 bg-gray-50/50 p-3 min-h-0">
          {chartItems.length > 0 ? (
            <SimpleBarChart data={chartItems} />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-gray-400">
              No chart data
            </div>
          )}
        </div>
      </div>

      {/* Right - bullet boxes */}
      <div className="w-[40%] flex flex-col justify-center space-y-3">
        {bullets.map((bullet, index) => (
          <div
            key={index}
            className="rounded-xl bg-purple-600 px-4 py-3 text-white shadow-sm"
          >
            {bullet.title && (
              <h3 className="text-sm font-semibold mb-0.5">{bullet.title}</h3>
            )}
            {bullet.description && (
              <p className="text-xs opacity-90 leading-relaxed">
                {bullet.description}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
