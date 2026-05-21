'use client';

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { type Rating, RATING_COLORS } from './kpi-bar-chart';

export interface DistributionPieChartDataItem {
  name: string;
  value: number;
  rating?: Rating;
  color?: string;
}

export interface DistributionPieChartProps {
  data: DistributionPieChartDataItem[];
  title?: string;
  height?: number;
  showLegend?: boolean;
  innerRadius?: number;
  outerRadius?: number;
}

const DEFAULT_COLORS = [
  '#166534',
  '#4ade80',
  '#3b82f6',
  '#f97316',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
  '#84cc16',
];

/**
 * Pie chart for distribution data.
 * Slices are color-coded by rating or custom color.
 */
export function DistributionPieChart({
  data,
  title,
  height = 300,
  showLegend = true,
  innerRadius = 0,
  outerRadius = 80,
}: DistributionPieChartProps) {
  const getSliceColor = (
    item: DistributionPieChartDataItem,
    index: number,
  ): string => {
    if (item.color) return item.color;
    if (item.rating) return RATING_COLORS[item.rating];
    return DEFAULT_COLORS[index % DEFAULT_COLORS.length];
  };

  return (
    <div className="w-full">
      {title && (
        <h3 className="text-sm font-medium text-gray-700 mb-2">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            dataKey="value"
            nameKey="name"
            label={({ name, percent }) =>
              `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
            }
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={getSliceColor(entry, index)}
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => [
              Number(value).toLocaleString(),
              '数值',
            ]}
          />
          {showLegend && <Legend />}
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
