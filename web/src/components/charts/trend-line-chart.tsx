'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { type Rating, RATING_COLORS } from './kpi-bar-chart';

export interface TrendLineChartSeries {
  key: string;
  name: string;
  rating?: Rating;
  color?: string;
}

export interface TrendLineChartProps {
  data: Record<string, unknown>[];
  series: TrendLineChartSeries[];
  xAxisKey?: string;
  title?: string;
  height?: number;
  showLegend?: boolean;
}

/**
 * Line chart for trends over time.
 * Each series can be color-coded by rating.
 */
export function TrendLineChart({
  data,
  series,
  xAxisKey = 'date',
  title,
  height = 300,
  showLegend = true,
}: TrendLineChartProps) {
  const getLineColor = (s: TrendLineChartSeries): string => {
    if (s.color) return s.color;
    if (s.rating) return RATING_COLORS[s.rating];
    return '#6b7280';
  };

  return (
    <div className="w-full">
      {title && (
        <h3 className="text-sm font-medium text-gray-700 mb-2">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <LineChart
          data={data}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={xAxisKey} tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          {showLegend && <Legend />}
          {series.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={getLineColor(s)}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
