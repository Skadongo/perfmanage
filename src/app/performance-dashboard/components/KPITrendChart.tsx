'use client';

import React, { useEffect, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { DrillDownFilter } from './StaffDrillDownModal';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';
import { cachedFetch } from '@/lib/cache';

interface TrendPoint {
  month: string;
  onTrack: number;
  atRisk: number;
  overdue: number;
}

const SERIES = [
  { key: 'onTrack', label: 'On Track', color: '#10b981', status: 'on-track' as DrillDownFilter['status'] },
  { key: 'atRisk', label: 'At Risk', color: '#f59e0b', status: 'at-risk' as DrillDownFilter['status'] },
  { key: 'overdue', label: 'Overdue', color: '#ef4444', status: 'overdue' as DrillDownFilter['status'] },
];

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const KPI_TREND_CACHE_TTL = 5 * 60_000; // 5 minutes — trend data changes slowly

const CustomTooltip = ({
  active,
  payload,
  label,
  onSeriesClick,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  onSeriesClick?: (series: typeof SERIES[0], month: string) => void;
}) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-border rounded-lg p-3 shadow-elevated text-xs">
        <p className="font-700 text-foreground mb-2">{label}</p>
        {payload.map((p, i) => {
          const series = SERIES.find((s) => s.key === p.name);
          return (
            <div
              key={`tt-${i}`}
              className="flex items-center gap-2 mb-1 cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5 transition-colors"
              onClick={() => series && onSeriesClick && onSeriesClick(series, label || '')}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
              <span className="text-muted-foreground capitalize">{series?.label || p.name}:</span>
              <span className="font-700 tabular-nums">{p.value}%</span>
              <span className="text-muted-foreground/60 ml-auto">→</span>
            </div>
          );
        })}
        <p className="text-[10px] text-muted-foreground mt-1.5 border-t border-border pt-1.5">Click a row to drill down</p>
      </div>
    );
  }
  return null;
};

interface Props {
  onPointClick: (filter: DrillDownFilter) => void;
}

export default function KPITrendChart({ onPointClick }: Props) {
  const [data, setData] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('');

  useEffect(() => {
    async function fetchTrendData() {
      const supabase = createClient();
      try {
        const points = await cachedFetch<TrendPoint[]>(
          'kpi-trend-chart',
          async () => {
            const { data: reviews } = await supabase
              .from('mid_year_reviews')
              // Only fetch the columns we need — avoids transferring large JSONB fields
              .select('review_status, supervisor_rating, created_at, review_year')
              .order('created_at', { ascending: true });

            const reviewList = reviews || [];
            if (reviewList.length === 0) return [];

            // Group by month (YYYY-MM) in a single pass
            const monthMap: Record<string, { onTrack: number; atRisk: number; overdue: number; total: number }> = {};

            for (const r of reviewList) {
              const date = new Date(r.created_at);
              const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
              if (!monthMap[key]) {
                monthMap[key] = { onTrack: 0, atRisk: 0, overdue: 0, total: 0 };
              }
              monthMap[key].total += 1;

              const status = r.review_status;
              const rating = r.supervisor_rating as number | null;

              if (status === 'approved' || (rating != null && rating >= 4)) {
                monthMap[key].onTrack += 1;
              } else if (status === 'submitted' || status === 'reviewed' || (rating != null && rating >= 3)) {
                monthMap[key].atRisk += 1;
              } else {
                monthMap[key].overdue += 1;
              }
            }

            const sortedKeys = Object.keys(monthMap).sort();
            return sortedKeys.map((key) => {
              const [year, monthNum] = key.split('-');
              const label = `${MONTH_LABELS[parseInt(monthNum) - 1]} ${year}`;
              const entry = monthMap[key];
              const total = entry.total || 1;
              return {
                month: label,
                onTrack: Math.round((entry.onTrack / total) * 100),
                atRisk: Math.round((entry.atRisk / total) * 100),
                overdue: Math.round((entry.overdue / total) * 100),
              };
            });
          },
          KPI_TREND_CACHE_TTL
        );

        if (points.length > 0) {
          setDateRange(`${points[0].month} – ${points[points.length - 1].month}`);
        }
        setData(points);
      } catch {
        setData([]);
      } finally {
        setLoading(false);
      }
    }

    fetchTrendData();
  }, []);

  const handleSeriesClick = (series: typeof SERIES[0], month: string) => {
    onPointClick({
      type: 'kpi-trend',
      label: `KPI Trend: ${series.label}`,
      subLabel: `${month} · ${series.label} staff`,
      status: series.status,
      color: series.color,
    });
  };

  return (
    <div className="bg-white rounded-xl border border-border shadow-card p-5 h-full">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-700 text-foreground">KPI Status Trend</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {dateRange || 'All periods'} · All staff roles
          </p>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          {SERIES.map((s) => (
            <button
              key={s.key}
              onClick={() => handleSeriesClick(s, 'Latest')}
              className="flex items-center gap-1.5 hover:opacity-80 active:scale-95 transition-all focus:outline-none focus:ring-1 focus:ring-primary/30 rounded px-1 py-0.5"
              aria-label={`View ${s.label} staff`}
              title={`Click to view ${s.label} staff`}
            >
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: s.color }} />
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-[220px]">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && data.length === 0 && (
        <div className="flex flex-col items-center justify-center h-[220px] text-muted-foreground gap-2">
          <Icon name="ChartBarIcon" size={32} className="text-muted-foreground/30" />
          <p className="text-xs">No review data available yet.</p>
          <p className="text-[11px] text-muted-foreground/60">Trend will appear once reviews are submitted.</p>
        </div>
      )}

      {!loading && data.length > 0 && (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="gradOnTrack" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradAtRisk" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradOverdue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(215,15%,88%)" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 10, fontFamily: 'DM Sans', fill: 'hsl(215,15%,48%)' }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 10, fontFamily: 'DM Sans', fill: 'hsl(215,15%,48%)' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip content={<CustomTooltip onSeriesClick={handleSeriesClick} />} />
            {SERIES.map((s) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                stroke={s.color}
                strokeWidth={2}
                fill={`url(#grad${s.key.charAt(0).toUpperCase() + s.key.slice(1)})`}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}