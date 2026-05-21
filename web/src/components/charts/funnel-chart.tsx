'use client';

import {
  FunnelChart as RechartsFunnelChart,
  Funnel,
  Tooltip,
  LabelList,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { type Rating, RATING_COLORS } from './kpi-bar-chart';

export interface FunnelChartDataItem {
  name: string;
  value: number;
  rating?: Rating;
  color?: string;
}

export interface FunnelChartProps {
  data: FunnelChartDataItem[];
  title?: string;
  height?: number;
}

const DEFAULT_FUNNEL_COLORS = [
  '#166534',
  '#4ade80',
  '#3b82f6',
  '#f97316',
  '#ef4444',
];

/**
 * Funnel chart for conversion analysis.
 * Each stage can be color-coded by rating.
 */
export function FunnelChart({
  data,
  title,
  height = 300,
}: FunnelChartProps) {
  const getStageColor = (
    item: FunnelChartDataItem,
    index: number,
  ): string => {
    if (item.color) return item.color;
    if (item.rating) return RATING_COLORS[item.rating];
    return DEFAULT_FUNNEL_COLORS[index % DEFAULT_FUNNEL_COLORS.length];
  };

  return (
    <div className="w-full">
      {title && (
        <h3 className="text-sm font-medium text-gray-700 mb-2">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <RechartsFunnelChart>
          <Tooltip
            formatter={(value) => [
              Number(value).toLocaleString(),
              '数值',
            ]}
          />
          <Funnel dataKey="value" data={data} isAnimationActive>
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={getStageColor(entry, index)}
              />
            ))}
            <LabelList
              position="right"
              dataKey="name"
              fill="#374151"
              fontSize={12}
            />
          </Funnel>
        </RechartsFunnelChart>
      </ResponsiveContainer>
    </div>
  );
}
