'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from 'recharts';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';

interface StageData {
  stage: string;
  label: string;
  shortLabel: string;
  count: number;
  color: string;
  barColor: string;
  isPending: boolean;
  completionOrder: number;
}

interface ReviewStatusData {
  status: string;
  label: string;
  count: number;
  color: string;
}

interface WorkflowStats {
  stages: StageData[];
  total: number;
  totalPendingApprovals: number;
  overallCompletionRate: number;
  reviewStatuses: ReviewStatusData[];
  totalReviews: number;
  pendingReviews: number;
  submittedReviews: number;
  approvedReviews: number;
}

const STAGE_CONFIG: Omit<StageData, 'count'>[] = [
  { stage: 'workplan_pending',  label: 'Workplan – Pending Approval', shortLabel: 'WP Pending',  color: 'text-amber-700',   barColor: '#f59e0b', isPending: true,  completionOrder: 1 },
  { stage: 'workplan_approved', label: 'Workplan – Approved',         shortLabel: 'WP Approved', color: 'text-emerald-700', barColor: '#10b981', isPending: false, completionOrder: 2 },
  { stage: 'mid_year_pending',  label: 'Mid-Year – Pending Approval', shortLabel: 'MY Pending',  color: 'text-amber-700',   barColor: '#f59e0b', isPending: true,  completionOrder: 3 },
  { stage: 'mid_year_approved', label: 'Mid-Year – Approved',         shortLabel: 'MY Approved', color: 'text-sky-700',     barColor: '#0ea5e9', isPending: false, completionOrder: 4 },
  { stage: 'end_year_pending',  label: 'End-Year – Pending Approval', shortLabel: 'EY Pending',  color: 'text-amber-700',   barColor: '#f59e0b', isPending: true,  completionOrder: 5 },
  { stage: 'end_year_approved', label: 'End-Year – Approved',         shortLabel: 'EY Approved', color: 'text-violet-700',  barColor: '#7c3aed', isPending: false, completionOrder: 6 },
];

const REVIEW_STATUS_CONFIG: { status: string; label: string; color: string }[] = [
  { status: 'draft',     label: 'Draft',     color: '#94a3b8' },
  { status: 'submitted', label: 'Submitted', color: '#3b82f6' },
  { status: 'reviewed',  label: 'Reviewed',  color: '#f59e0b' },
  { status: 'approved',  label: 'Approved',  color: '#10b981' },
  { status: 'rejected',  label: 'Rejected',  color: '#ef4444' },
];

const CustomBarTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number; payload: StageData }[]; label?: string }) => {
  if (active && payload && payload.length) {
    const d = payload[0];
    return (
      <div className="bg-white border border-border rounded-lg shadow-lg p-3 text-xs">
        <p className="font-700 text-foreground mb-1">{label}</p>
        <p className="text-muted-foreground">
          <span className="font-700 text-foreground">{d.value}</span> staff member{d.value !== 1 ? 's' : ''}
        </p>
        {d.payload?.isPending && (
          <p className="text-amber-600 font-600 mt-0.5">⚠ Awaiting supervisor approval</p>
        )}
      </div>
    );
  }
  return null;
};

const CustomPieTooltip = ({ active, payload }: { active?: boolean; payload?: { name: string; value: number; payload: ReviewStatusData }[] }) => {
  if (active && payload && payload.length) {
    const d = payload[0];
    return (
      <div className="bg-white border border-border rounded-lg shadow-lg p-3 text-xs">
        <p className="font-700 text-foreground mb-1">{d.name}</p>
        <p className="text-muted-foreground">
          <span className="font-700 text-foreground">{d.value}</span> review{d.value !== 1 ? 's' : ''}
        </p>
      </div>
    );
  }
  return null;
};

export default function WorkflowProgressPanel() {
  const [stats, setStats] = useState<WorkflowStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch workplan stage data
      const { data: workplanData, error: wpError } = await supabase
        .from('workplan_settings')
        .select('workflow_stage');

      if (wpError) throw wpError;

      // Fetch mid-year review status data
      const { data: reviewData, error: rvError } = await supabase
        .from('mid_year_reviews')
        .select('review_status, review_period');

      if (rvError) throw rvError;

      // Process workplan stages
      const workplanRows = workplanData ?? [];
      const total = workplanRows.length;
      const countMap: Record<string, number> = {};
      workplanRows.forEach((r: { workflow_stage: string }) => {
        countMap[r.workflow_stage] = (countMap[r.workflow_stage] || 0) + 1;
      });

      const stages: StageData[] = STAGE_CONFIG.map(cfg => ({
        ...cfg,
        count: countMap[cfg.stage] ?? 0,
      }));

      const totalPendingApprovals = stages.filter(s => s.isPending).reduce((sum, s) => sum + s.count, 0);
      const endYearApproved = countMap['end_year_approved'] ?? 0;
      const overallCompletionRate = total > 0 ? Math.round((endYearApproved / total) * 100) : 0;

      // Process review statuses
      const reviewRows = reviewData ?? [];
      const totalReviews = reviewRows.length;
      const statusCountMap: Record<string, number> = {};
      reviewRows.forEach((r: { review_status: string }) => {
        statusCountMap[r.review_status] = (statusCountMap[r.review_status] || 0) + 1;
      });

      const reviewStatuses: ReviewStatusData[] = REVIEW_STATUS_CONFIG
        .map(cfg => ({
          ...cfg,
          count: statusCountMap[cfg.status] ?? 0,
        }))
        .filter(s => s.count > 0);

      const pendingReviews = (statusCountMap['draft'] ?? 0);
      const submittedReviews = (statusCountMap['submitted'] ?? 0) + (statusCountMap['reviewed'] ?? 0);
      const approvedReviews = statusCountMap['approved'] ?? 0;

      setStats({
        stages,
        total,
        totalPendingApprovals,
        overallCompletionRate,
        reviewStatuses,
        totalReviews,
        pendingReviews,
        submittedReviews,
        approvedReviews,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load workflow progress';
      console.error('WorkflowProgressPanel fetch error:', err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();

    // Real-time subscriptions for live updates
    const wpChannel = supabase
      .channel('workflow_progress_workplans')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workplan_settings' }, () => {
        fetchStats();
      })
      .subscribe();

    const rvChannel = supabase
      .channel('workflow_progress_reviews')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mid_year_reviews' }, () => {
        fetchStats();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(wpChannel);
      supabase.removeChannel(rvChannel);
    };
  }, [fetchStats]);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-border shadow-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-muted/40 animate-pulse" />
          <div className="h-4 w-48 rounded bg-muted/40 animate-pulse" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-muted/30 animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="h-52 rounded-xl bg-muted/20 animate-pulse" />
          <div className="h-52 rounded-xl bg-muted/20 animate-pulse" />
        </div>
        <div className="h-48 rounded-xl bg-muted/20 animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
        <Icon name="ExclamationCircleIcon" size={18} className="text-red-500 flex-shrink-0" />
        <p className="text-sm text-red-700">{error}</p>
        <button onClick={fetchStats} className="ml-auto text-xs font-600 text-red-600 hover:underline">Retry</button>
      </div>
    );
  }

  if (!stats) return null;

  const {
    stages, total, totalPendingApprovals, overallCompletionRate,
    reviewStatuses, totalReviews, pendingReviews, submittedReviews, approvedReviews,
  } = stats;

  const chartData = stages.map(s => ({ name: s.shortLabel, count: s.count, ...s }));

  // Stage-level completion rates: % of total staff who have reached AT LEAST this stage
  const stageCompletionRates = stages.map((s, idx) => {
    const atOrBeyond = stages.slice(idx).reduce((sum, ss) => sum + ss.count, 0);
    return total > 0 ? Math.round((atOrBeyond / total) * 100) : 0;
  });

  const pendingStages = stages.filter(s => s.isPending && s.count > 0);

  // Review completion rate
  const reviewCompletionRate = totalReviews > 0
    ? Math.round(((submittedReviews + approvedReviews) / totalReviews) * 100)
    : 0;

  return (
    <div className="bg-white rounded-xl border border-border shadow-card p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="ArrowPathIcon" size={16} className="text-primary" />
          <h3 className="text-sm font-700 text-foreground">Real-Time Evaluation Progress</h3>
          <span className="text-xs text-muted-foreground">· {total} workplan{total !== 1 ? 's' : ''} · {totalReviews} review{totalReviews !== 1 ? 's' : ''} tracked</span>
        </div>
        <button
          onClick={fetchStats}
          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          title="Refresh data"
        >
          <Icon name="ArrowPathIcon" size={14} />
        </button>
      </div>

      {/* KPI summary strip — 4 cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 flex flex-col gap-1">
          <span className="text-[10px] font-600 uppercase tracking-wider text-primary/70">Total Workplans</span>
          <span className="text-2xl font-700 tabular-nums font-mono text-primary">{total}</span>
          <span className="text-[10px] text-muted-foreground">Jul 2025 – Jun 2026</span>
        </div>

        <div className={`rounded-xl p-3 flex flex-col gap-1 border ${totalPendingApprovals > 0 ? 'bg-amber-50 border-amber-200' : 'bg-muted/20 border-border'}`}>
          <span className={`text-[10px] font-600 uppercase tracking-wider ${totalPendingApprovals > 0 ? 'text-amber-700' : 'text-muted-foreground'}`}>
            Pending Approvals
          </span>
          <span className={`text-2xl font-700 tabular-nums font-mono ${totalPendingApprovals > 0 ? 'text-amber-700' : 'text-muted-foreground'}`}>
            {totalPendingApprovals}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {totalPendingApprovals > 0 ? 'Awaiting supervisor action' : 'No pending approvals'}
          </span>
        </div>

        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex flex-col gap-1">
          <span className="text-[10px] font-600 uppercase tracking-wider text-emerald-700">Cycle Completion</span>
          <span className="text-2xl font-700 tabular-nums font-mono text-emerald-700">{overallCompletionRate}%</span>
          <span className="text-[10px] text-muted-foreground">End-Year approved / total</span>
        </div>

        <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 flex flex-col gap-1">
          <span className="text-[10px] font-600 uppercase tracking-wider text-sky-700">Review Completion</span>
          <span className="text-2xl font-700 tabular-nums font-mono text-sky-700">{reviewCompletionRate}%</span>
          <span className="text-[10px] text-muted-foreground">{approvedReviews} approved · {submittedReviews} submitted</span>
        </div>
      </div>

      {/* Pending approvals alert */}
      {pendingStages.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex flex-wrap items-center gap-3">
          <Icon name="ClockIcon" size={15} className="text-amber-600 flex-shrink-0" />
          <span className="text-xs font-600 text-amber-800">Pending supervisor approvals:</span>
          {pendingStages.map(s => (
            <span key={s.stage} className="inline-flex items-center gap-1 text-[11px] font-600 bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              {s.label}: <span className="font-800">{s.count}</span>
            </span>
          ))}
        </div>
      )}

      {/* Charts row: Stage Distribution + Review Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Stage Distribution Bar Chart */}
        <div>
          <p className="text-xs font-700 uppercase tracking-wider text-muted-foreground mb-3">Stage Distribution Chart</p>
          {total === 0 ? (
            <div className="flex flex-col items-center justify-center h-44 text-sm text-muted-foreground gap-2 bg-muted/10 rounded-xl border border-border">
              <Icon name="ChartBarIcon" size={28} className="text-muted-foreground/40" />
              <span>No workplans submitted yet</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} allowDecimals={false} />
                <Tooltip content={<CustomBarTooltip />} />
                <Bar dataKey="count" name="Staff" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.barColor} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-2">
            {[
              { color: '#f59e0b', label: 'Pending Approval' },
              { color: '#10b981', label: 'Workplan Approved' },
              { color: '#0ea5e9', label: 'Mid-Year Approved' },
              { color: '#7c3aed', label: 'End-Year Approved' },
            ].map(item => (
              <span key={item.label} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: item.color }} />
                {item.label}
              </span>
            ))}
          </div>
        </div>

        {/* Review Status Distribution Pie/Bar Chart */}
        <div>
          <p className="text-xs font-700 uppercase tracking-wider text-muted-foreground mb-3">
            Review Status Distribution
            <span className="ml-2 font-500 normal-case text-muted-foreground/70">({totalReviews} total reviews)</span>
          </p>
          {totalReviews === 0 ? (
            <div className="flex flex-col items-center justify-center h-44 text-sm text-muted-foreground gap-2 bg-muted/10 rounded-xl border border-border">
              <Icon name="ClipboardDocumentListIcon" size={28} className="text-muted-foreground/40" />
              <span>No reviews submitted yet</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={reviewStatuses}
                  dataKey="count"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  outerRadius={75}
                  innerRadius={40}
                  paddingAngle={2}
                >
                  {reviewStatuses.map((entry, index) => (
                    <Cell key={`pie-cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomPieTooltip />} />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 10, color: '#64748b' }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
          {/* Review quick stats */}
          {totalReviews > 0 && (
            <div className="flex items-center gap-4 mt-2 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                Draft: <strong className="text-foreground ml-0.5">{pendingReviews}</strong>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                Submitted: <strong className="text-foreground ml-0.5">{submittedReviews}</strong>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Approved: <strong className="text-foreground ml-0.5">{approvedReviews}</strong>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Stage completion rates */}
      <div>
        <p className="text-xs font-700 uppercase tracking-wider text-muted-foreground mb-3">Stage Completion Rates</p>
        {total === 0 ? (
          <p className="text-xs text-muted-foreground italic">No workplans to calculate rates from.</p>
        ) : (
          <div className="space-y-2.5">
            {stages.map((s, idx) => {
              const rate = stageCompletionRates[idx];
              return (
                <div key={s.stage} className="flex items-center gap-3">
                  <div className="w-28 flex-shrink-0">
                    <span className="text-[11px] font-600 text-foreground leading-tight">{s.shortLabel}</span>
                  </div>
                  <div className="flex-1 bg-muted/30 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${rate}%`, backgroundColor: s.barColor }}
                    />
                  </div>
                  <div className="w-20 flex items-center justify-end gap-2 flex-shrink-0">
                    <span className="text-[11px] font-700 tabular-nums text-foreground">{rate}%</span>
                    <span className={`text-[10px] font-600 px-1.5 py-0.5 rounded-full ${
                      s.isPending ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {s.count}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <p className="text-[10px] text-muted-foreground mt-2">
          Rate = % of staff who have reached this stage or beyond · Count = staff currently at this stage
        </p>
      </div>
    </div>
  );
}
