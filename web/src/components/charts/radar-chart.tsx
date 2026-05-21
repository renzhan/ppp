'use client';

import {
  RadarChart as RechartsRadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { type Rating, RATING_COLORS } from './kpi-bar-chart';

export interface RadarChartDataItem {
  dimension: string;
  value: number;
  fullMark?: number;
}

export interface RadarChartSeries {
  key: string;
  name: string;
  rating?: Rating;
  color?: string;
  fillOpacity?: number;
}

export interface RadarChartProps {
  data: RadarChartDataItem[];
  series: RadarChartSeries[];
  title?: string;
  height?: number;
  showLegend?: boolean;
}

/**
 * Radar chart for multi-dimension comparison.
 * Each series can be color-coded by rating.
 */
export function RadarChart({
  data,
  series,
  title,
  height = 300,
  showLegend = true,
}: RadarChartProps) {
  const getColor = (s: RadarChartSeries): string => {
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
        <RechartsRadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
          <PolarGrid />
          <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 12 }} />
          <PolarRadiusAxis tick={{ fontSize: 10 }} />
          <Tooltip />
          {showLegend && <Legend />}
          {series.map((s) => (
            <Radar
              key={s.key}
              name={s.name}
              dataKey={s.key}
              stroke={getColor(s)}
              fill={getColor(s)}
              fillOpacity={s.fillOpacity ?? 0.3}
            />
          ))}
        </RechartsRadarChart>
      </ResponsiveContainer>
    </div>
  );
}
