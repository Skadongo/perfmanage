'use client';

import React, { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { createClient } from '@/lib/supabase/client';

// Stable singleton — avoids re-creating the client on every render
const supabase = createClient();

interface KPIDataPoint {
  period: string;
  avgSupervisorRating: number;
  avgSelfRating: number;
  submissionRate: number;
  approvalRate: number;
  totalReviews: number;
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-border rounded-lg p-3 shadow-elevated text-xs">
        <p className="font-700 text-foreground mb-2">{label}</p>
        {payload.map((p, i) => (
          <div key={`yoy-tt-${i}`} className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="text-muted-foreground">{p.name}:</span>
            <span className="font-700 tabular-nums">{p.value.toFixed(1)}{p.name === 'Submission Rate %' || p.name === 'Approval Rate %' ? '%' : ''}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function KPIYearOnYearChart() {
  const [data, setData] = useState<KPIDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const { data: reviews, error: err } = await supabase
          .from('mid_year_reviews')
          .select('review_year, review_period, supervisor_rating, self_rating, review_status')
          .order('review_year', { ascending: true });

        if (err) throw err;

        if (!reviews || reviews.length === 0) {
          setData([]);
          return;
        }

        // Group by year + period
        const grouped: Record<string, { supervisorRatings: number[]; selfRatings: number[]; total: number; submitted: number; approved: number }> = {};

        reviews.forEach((r) => {
          const key = `${r.review_period === 'mid-year' ? 'Mid' : 'End'} ${r.review_year}`;
          if (!grouped[key]) {
            grouped[key] = { supervisorRatings: [], selfRatings: [], total: 0, submitted: 0, approved: 0 };
          }
          grouped[key].total++;
          if (r.supervisor_rating) grouped[key].supervisorRatings.push(r.supervisor_rating);
          if (r.self_rating) grouped[key].selfRatings.push(r.self_rating);
          if (['submitted', 'reviewed', 'approved'].includes(r.review_status)) grouped[key].submitted++;
          if (r.review_status === 'approved') grouped[key].approved++;
        });

        const points: KPIDataPoint[] = Object.entries(grouped).map(([period, g]) => {
          const avgSup = g.supervisorRatings.length > 0
            ? (g.supervisorRatings.reduce((a, b) => a + b, 0) / g.supervisorRatings.length) * 20
            : 0;
          const avgSelf = g.selfRatings.length > 0
            ? (g.selfRatings.reduce((a, b) => a + b, 0) / g.selfRatings.length) * 20
            : 0;
          return {
            period,
            avgSupervisorRating: Math.round(avgSup * 10) / 10,
            avgSelfRating: Math.round(avgSelf * 10) / 10,
            submissionRate: g.total > 0 ? Math.round((g.submitted / g.total) * 100 * 10) / 10 : 0,
            approvalRate: g.total > 0 ? Math.round((g.approved / g.total) * 100 * 10) / 10 : 0,
            totalReviews: g.total,
          };
        });

        setData(points);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load KPI trend data');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <div className="bg-white rounded-xl border border-border shadow-card p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-700 text-foreground">Staff KPI Trends — Year on Year</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Avg Supervisor Rating · Self Rating · Submission & Approval Rates</p>
        </div>
        <div className="flex flex-wrap gap-3 text-[11px]">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-0.5 bg-primary inline-block" />Supervisor Rating</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-0.5 bg-teal-500 inline-block" />Self Rating</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-0.5 bg-violet-500 inline-block" />Submission %</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-0.5 bg-amber-500 inline-block" />Approval %</span>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-[260px]">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <div className="flex items-center justify-center h-[260px] text-xs text-red-600">{error}</div>
      )}

      {!loading && !error && data.length === 0 && (
        <div className="flex items-center justify-center h-[260px] text-xs text-muted-foreground">No review data available</div>
      )}

      {!loading && !error && data.length > 0 && (
        <>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(215,15%,88%)" vertical={false} />
              <XAxis dataKey="period" tick={{ fontSize: 11, fontFamily: 'DM Sans', fill: 'hsl(215,15%,48%)' }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fontFamily: 'DM Sans', fill: 'hsl(215,15%,48%)' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={60} stroke="#1a5f7a" strokeDasharray="3 3" strokeWidth={1} />
              <ReferenceLine y={80} stroke="#14b8a6" strokeDasharray="3 3" strokeWidth={1} />
              <Line type="monotone" dataKey="avgSupervisorRating" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: 'hsl(var(--primary))', r: 3 }} name="Supervisor Rating" />
              <Line type="monotone" dataKey="avgSelfRating" stroke="#14b8a6" strokeWidth={2} dot={{ fill: '#14b8a6', r: 3 }} name="Self Rating" />
              <Line type="monotone" dataKey="submissionRate" stroke="#8b5cf6" strokeWidth={2} dot={{ fill: '#8b5cf6', r: 3 }} name="Submission Rate %" />
              <Line type="monotone" dataKey="approvalRate" stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b', r: 3 }} name="Approval Rate %" />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-[10px] text-muted-foreground mt-2 text-center">
            Ratings scaled 0–100 (1–5 scale × 20) · Dashed lines: 60% and 80% benchmarks
          </p>
        </>
      )}
    </div>
  );
}