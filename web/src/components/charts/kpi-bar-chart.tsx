'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';

export type Rating = 'S' | 'A' | 'B' | 'C' | 'D';

export const RATING_COLORS: Record<Rating, string> = {
  S: '#166534', // 深绿
  A: '#4ade80', // 浅绿
  B: '#3b82f6', // 蓝色
  C: '#f97316', // 橙色
  D: '#ef4444', // 红色
};

export interface KpiBarChartDataItem {
  name: string;
  actual: number;
  target: number;
  rating?: Rating;
}

export interface KpiBarChartProps {
  data: KpiBarChartDataItem[];
  title?: string;
  height?: number;
  showLegend?: boolean;
}

/**
 * Bar chart for KPI comparison (actual vs target).
 * Bars are color-coded by rating.
 */
export function KpiBarChart({
  data,
  title,
  height = 300,
  showLegend = true,
}: KpiBarChartProps) {
  return (
    <div className="w-full">
      {title && (
        <h3 className="text-sm font-medium text-gray-700 mb-2">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={data}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip
            formatter={(value, name) => [
              Number(value).toLocaleString(),
              name === 'actual' ? '实际值' : '目标值',
            ]}
          />
          {showLegend && (
            <Legend
              formatter={(value: string) =>
                value === 'actual' ? '实际值' : '目标值'
              }
            />
          )}
          <Bar dataKey="target" fill="#e5e7eb" name="target" barSize={20} />
          <Bar dataKey="actual" name="actual" barSize={20}>
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.rating ? RATING_COLORS[entry.rating] : '#6b7280'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
