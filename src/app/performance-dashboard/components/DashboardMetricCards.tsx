'use client';

import React from 'react';
import useSWR from 'swr';
import Icon from '@/components/ui/AppIcon';
import ProgressBar from '@/components/ui/ProgressBar';
import type { DrillDownFilter } from './StaffDrillDownModal';
import { createClient } from '@/lib/supabase/client';
import { MetricCardSkeleton } from '@/components/ui/SkeletonLoader';
import { roleCachedFetch, TTL_DASHBOARD_METRICS, SWR_DEDUP_ADMIN, SWR_DEDUP_STAFF } from '@/lib/cache';

// ── Fix: Rename cpdCompletionRate → workplanApprovalRate throughout ────────────
interface MetricData {
  kpiAchievementRate: number | null;
  reviewCompletionRate: number | null;
  reviewsSubmitted: number;
  /** reviewsTotal = active staff count in scope (denominator for completion rate) */
  reviewsTotal: number;
  /** notStartedReviews = staff with no review record yet (reviewsTotal - reviews fetched) */
  notStartedReviews: number;
  workplansTotal: number;
  workplansApproved: number;
  /** Renamed from cpdCompletionRate — measures workplan approval, not CPD */
  workplanApprovalRate: number | null;
  avgSupervisorRating: number | null;
  totalStaff: number;
  /** ISO timestamp from mv_dashboard_summary.last_refreshed — null if not available */
  mvLastRefreshed: string | null;
}

interface Props {
  onMetricClick: (filter: DrillDownFilter) => void;
  visibleMetricIds?: string[];
  showHeroMetric?: boolean;
  staffId?: string | null;
  /** supervisorId — when set, scopes data to direct reports of this supervisor */
  supervisorId?: string | null;
  /** systemRole from UserProfile — used to scope the cache key per role */
  systemRole?: string;
}

/** Derive the current fiscal year string used in workplan_settings.fiscal_year */
function getCurrentFiscalYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const fyStart = month >= 7 ? year : year - 1;
  const fyEnd = fyStart + 1;
  return `FY ${fyStart}-${fyEnd}`;
}

/** Current review year (integer) for mid_year_reviews.review_year */
function getCurrentReviewYear(): number {
  return new Date().getFullYear();
}

export const DASHBOARD_CORE_SWR_KEY = 'dashboard-core';

/** Format an ISO timestamp into a human-readable "Last Updated" string */
function formatLastRefreshed(iso: string | null): string {
  if (!iso) return 'Unknown';
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60_000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    return `${diffDays}d ago`;
  } catch {
    return 'Unknown';
  }
}

/** Determine refresh status badge based on how stale the materialized view is */
function getRefreshStatus(iso: string | null): { label: string; color: string; bg: string; border: string } {
  if (!iso) return { label: 'Unknown', color: 'text-gray-500', bg: 'bg-gray-50', border: 'border-gray-200' };
  try {
    const diffMs = new Date().getTime() - new Date(iso).getTime();
    const diffMins = Math.floor(diffMs / 60_000);
    if (diffMins <= 5) return { label: 'Live', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' };
    if (diffMins <= 15) return { label: 'Recent', color: 'text-sky-700', bg: 'bg-sky-50', border: 'border-sky-200' };
    if (diffMins <= 60) return { label: 'Syncing', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' };
    return { label: 'Stale', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' };
  } catch {
    return { label: 'Unknown', color: 'text-gray-500', bg: 'bg-gray-50', border: 'border-gray-200' };
  }
}

/** Roles that see org-wide data — use longer SWR dedup interval */
const ADMIN_ROLES = new Set(['admin', 'director_general', 'programme_director', 'hr_admin', 'superuser']);

async function fetchMetrics(
  staffId: string | null | undefined,
  supervisorId: string | null | undefined,
  systemRole: string
): Promise<MetricData> {
  return roleCachedFetch(
    'dashboard-metrics',
    systemRole,
    async () => {
      const supabase = createClient();
      const currentFiscalYear = getCurrentFiscalYear();
      const currentReviewYear = getCurrentReviewYear();

      // ── Fix: Read from mv_dashboard_summary for org-wide admin/director views ──
      // For staff-scoped and supervisor-scoped views we still query directly
      // because the MV doesn't have per-supervisor breakdowns.
      const isOrgWide = !staffId && !supervisorId;
      const isAdminRole = ADMIN_ROLES.has(systemRole);

      if (isOrgWide && isAdminRole) {
        // Fast path: read from materialized view (single row, pre-aggregated)
        const [mvResult, staffCountResult, workplansResult] = await Promise.all([
          supabase
            .from('mv_dashboard_summary')
            .select('*')
            .maybeSingle(),
          supabase
            .from('staff')
            .select('id', { count: 'exact', head: true })
            .eq('employment_status', 'active'),
          supabase
            .from('workplan_settings')
            .select('status, workflow_stage')
            .eq('fiscal_year', currentFiscalYear),
        ]);

        const mv = mvResult.data;
        const staffCount = staffCountResult.count ?? 0;
        const workplanList = workplansResult.data || [];

        const submittedReviews = mv ? Number(mv.submitted_reviews) : 0;
        const totalReviews = mv ? Number(mv.total_reviews) : 0;
        // Fix: reviewCompletionRate denominator = active staff (not review count)
        // notStarted = staff who haven't created a review record yet
        const notStartedReviews = Math.max(0, staffCount - totalReviews);
        const reviewDenominator = Math.max(staffCount, 1);
        const reviewCompletionRate = Math.min(100, Math.round((submittedReviews / reviewDenominator) * 100));

        const avgRating = mv?.avg_supervisor_rating ? Number(mv.avg_supervisor_rating) : null;
        // kpiAchievementRate not available from MV — fall back to null for org-wide MV path
        const kpiAchievementRate: number | null = null;

        const approvedWorkplans = workplanList.filter(w =>
          w.status === 'approved' || w.workflow_stage === 'approved'
        ).length;
        const workplanApprovalRate = staffCount > 0
          ? Math.min(100, Math.round((approvedWorkplans / staffCount) * 100))
          : null;

        return {
          kpiAchievementRate,
          reviewCompletionRate,
          reviewsSubmitted: submittedReviews,
          reviewsTotal: staffCount,
          notStartedReviews,
          workplansTotal: workplanList.length,
          workplansApproved: approvedWorkplans,
          workplanApprovalRate,
          avgSupervisorRating: avgRating,
          totalStaff: staffCount,
          mvLastRefreshed: mv?.last_refreshed ?? null,
        };
      }

      // Slow path: direct queries for staff-scoped and supervisor-scoped views
      let reviewsQuery = supabase
        .from('mid_year_reviews')
        .select('review_status, supervisor_rating, staff_id, supervisor_id')
        .eq('review_year', currentReviewYear);

      if (staffId) {
        reviewsQuery = reviewsQuery.eq('staff_id', staffId);
      } else if (supervisorId) {
        reviewsQuery = reviewsQuery.eq('supervisor_id', supervisorId);
      }

      let workplansQuery = supabase
        .from('workplan_settings')
        .select('status, workflow_stage, staff_id')
        .eq('fiscal_year', currentFiscalYear);

      if (staffId) {
        workplansQuery = workplansQuery.eq('staff_id', staffId);
      } else if (supervisorId) {
        workplansQuery = workplansQuery.eq('supervisor_id', supervisorId);
      }

      const mvRefreshQuery = supabase
        .from('mv_dashboard_summary')
        .select('last_refreshed')
        .maybeSingle();

      const [reviewsResult, staffCountResult, workplansResult, mvResult] = await Promise.all([
        reviewsQuery,
        supervisorId
          ? supabase
              .from('staff')
              .select('id', { count: 'exact', head: true })
              .eq('supervisor_id', supervisorId)
              .eq('employment_status', 'active')
          : supabase
              .from('staff')
              .select('id', { count: 'exact', head: true })
              .eq('employment_status', 'active'),
        workplansQuery,
        mvRefreshQuery,
      ]);

      const reviewList = reviewsResult.data || [];
      const workplanList = workplansResult.data || [];
      const staffCount = staffCountResult.count ?? 0;
      const mvLastRefreshed = mvResult.data?.last_refreshed ?? null;

      const submittedReviews = reviewList.filter(r =>
        ['submitted', 'reviewed', 'approved'].includes(r.review_status)
      ).length;

      // Fix: reviewCompletionRate denominator = active staff in scope
      // notStarted = staff who haven't created a review record yet
      const reviewDenominator = staffId ? 1 : Math.max(staffCount, 1);
      const notStartedReviews = staffId ? 0 : Math.max(0, staffCount - reviewList.length);
      const reviewCompletionRate = reviewDenominator > 0
        ? Math.min(100, Math.round((submittedReviews / reviewDenominator) * 100))
        : null;

      const ratedReviews = reviewList.filter(r => r.supervisor_rating != null && (r.supervisor_rating as number) > 0);
      const onTrackReviews = ratedReviews.filter(r => (r.supervisor_rating as number) >= 3).length;
      const kpiAchievementRate = ratedReviews.length > 0
        ? Math.min(100, Math.round((onTrackReviews / ratedReviews.length) * 100))
        : null;

      const ratings = reviewList
        .filter(r => r.supervisor_rating != null && (r.supervisor_rating as number) > 0)
        .map(r => r.supervisor_rating as number);
      const avgSupervisorRating = ratings.length > 0
        ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
        : null;

      const approvedWorkplans = workplanList.filter(w =>
        w.status === 'approved' || w.workflow_stage === 'approved'
      ).length;
      const workplanDenominator = staffId ? 1 : Math.max(staffCount, 1);
      // Fix: renamed from cpdCompletionRate → workplanApprovalRate
      const workplanApprovalRate = workplanDenominator > 0
        ? Math.min(100, Math.round((approvedWorkplans / workplanDenominator) * 100))
        : null;

      return {
        kpiAchievementRate,
        reviewCompletionRate,
        reviewsSubmitted: submittedReviews,
        reviewsTotal: staffId ? reviewList.length : staffCount,
        notStartedReviews,
        workplansTotal: workplanList.length,
        workplansApproved: approvedWorkplans,
        workplanApprovalRate,
        avgSupervisorRating,
        totalStaff: staffCount,
        mvLastRefreshed,
      };
    },
    TTL_DASHBOARD_METRICS,
    staffId ?? supervisorId
  );
}

export default function DashboardMetricCards({
  onMetricClick,
  visibleMetricIds,
  showHeroMetric = true,
  staffId,
  supervisorId,
  systemRole = 'staff_member',
}: Props) {
  // Fix: use longer dedupingInterval for admin/director roles (org-wide stable data)
  const isAdminRole = ADMIN_ROLES.has(systemRole);
  const dedupingInterval = isAdminRole ? SWR_DEDUP_ADMIN : SWR_DEDUP_STAFF;

  const { data: metrics, isLoading } = useSWR(
    [DASHBOARD_CORE_SWR_KEY, systemRole, staffId ?? supervisorId ?? 'org'],
    () => fetchMetrics(staffId, supervisorId, systemRole),
    {
      revalidateOnFocus: false,
      dedupingInterval,
      fallbackData: undefined,
    }
  );

  if (isLoading && !metrics) {
    return <MetricCardSkeleton count={showHeroMetric ? 6 : 4} />;
  }

  const m: MetricData = metrics ?? {
    kpiAchievementRate: null,
    reviewCompletionRate: null,
    reviewsSubmitted: 0,
    reviewsTotal: 0,
    notStartedReviews: 0,
    workplansTotal: 0,
    workplansApproved: 0,
    workplanApprovalRate: null,
    avgSupervisorRating: null,
    totalStaff: 0,
    mvLastRefreshed: null,
  };

  const kpiValue = m.kpiAchievementRate !== null ? `${m.kpiAchievementRate}%` : '—';
  const kpiRaw = m.kpiAchievementRate ?? 0;
  const reviewValue = m.reviewCompletionRate !== null ? `${m.reviewCompletionRate}%` : '—';
  const reviewRaw = m.reviewCompletionRate ?? 0;
  // Fix: use workplanApprovalRate (renamed from cpdCompletionRate)
  const workplanApprovalValue = m.workplanApprovalRate !== null ? `${m.workplanApprovalRate}%` : '—';
  const workplanApprovalRaw = m.workplanApprovalRate ?? 0;
  const avgRatingValue = m.avgSupervisorRating !== null ? `${m.avgSupervisorRating}/5` : '—';

  const lastUpdatedLabel = formatLastRefreshed(m.mvLastRefreshed);
  const refreshStatus = getRefreshStatus(m.mvLastRefreshed);

  // Fix: Build review completion delta with "not started" breakdown for supervisors
  const isSupervisorView = !!supervisorId && !staffId;
  const reviewDeltaLabel = (() => {
    if (m.reviewsTotal === 0) return 'No reviews yet';
    const base = `${m.reviewsSubmitted} of ${m.reviewsTotal} submitted`;
    if (isSupervisorView && m.notStartedReviews > 0) {
      return `${base} · ${m.notStartedReviews} not started`;
    }
    return base;
  })();

  // Fix: reviewCompletionRate tooltip clarifies denominator = active staff
  const reviewDescription = isSupervisorView
    ? `Mid-year reviews submitted (denominator = ${m.reviewsTotal} active direct reports)`
    : 'Mid-year reviews submitted vs active staff';

  const ALL_METRICS = [
    {
      id: 'metric-kpi-achievement',
      label: 'KPI Achievement Rate',
      value: kpiValue,
      rawValue: kpiRaw,
      target: '≥80%',
      delta: m.kpiAchievementRate !== null
        ? (m.kpiAchievementRate >= 80 ? 'On target' : `${80 - m.kpiAchievementRate}% below target`)
        : 'No data yet',
      positive: m.kpiAchievementRate !== null && m.kpiAchievementRate >= 80,
      description: 'Reviews rated On Track or Achieved',
      icon: 'ChartBarIcon',
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      borderColor: 'border-emerald-200',
      progressColor: 'bg-emerald-500',
      hero: true,
      alert: false,
      drillStatus: undefined as DrillDownFilter['status'],
    },
    {
      id: 'metric-review-completion',
      label: 'Review Completion Rate',
      value: reviewValue,
      rawValue: reviewRaw,
      target: '100% by 30 Jun',
      delta: reviewDeltaLabel,
      positive: reviewRaw >= 80,
      description: reviewDescription,
      icon: 'ClipboardDocumentCheckIcon',
      color: 'text-sky-600',
      bgColor: 'bg-sky-50',
      borderColor: 'border-sky-200',
      progressColor: 'bg-sky-500',
      hero: false,
      alert: reviewRaw > 0 && reviewRaw < 50,
      drillStatus: undefined as DrillDownFilter['status'],
    },
    {
      // Fix: renamed from metric-cpd-completion, label updated to "Workplan Approval Rate"
      id: 'metric-workplan-approval',
      label: 'Workplan Approval Rate',
      value: workplanApprovalValue,
      rawValue: workplanApprovalRaw,
      target: '100% by Dec 31',
      delta: m.workplansTotal > 0
        ? `${m.workplansApproved} of ${m.workplansTotal} workplans approved`
        : 'No workplans yet',
      positive: workplanApprovalRaw >= 80,
      description: 'Staff with approved workplans for current fiscal year',
      icon: 'AcademicCapIcon',
      color: 'text-violet-600',
      bgColor: 'bg-violet-50',
      borderColor: 'border-violet-200',
      progressColor: 'bg-violet-500',
      hero: false,
      alert: false,
      drillStatus: undefined as DrillDownFilter['status'],
    },
    {
      id: 'metric-avg-rating',
      label: 'Avg Supervisor Rating',
      value: avgRatingValue,
      rawValue: m.avgSupervisorRating !== null ? (m.avgSupervisorRating / 5) * 100 : 0,
      target: '≥3.5/5 target',
      delta: m.avgSupervisorRating !== null
        ? (m.avgSupervisorRating >= 3.5 ? 'Above target' : 'Below target')
        : 'No ratings yet',
      positive: m.avgSupervisorRating !== null && m.avgSupervisorRating >= 3.5,
      description: 'Average supervisor performance rating',
      icon: 'StarIcon',
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200',
      progressColor: 'bg-amber-500',
      hero: false,
      alert: m.avgSupervisorRating !== null && m.avgSupervisorRating < 3,
      drillStatus: undefined as DrillDownFilter['status'],
    },
    {
      id: 'metric-total-staff',
      label: 'Active Staff',
      value: String(m.totalStaff),
      rawValue: 100,
      target: 'All active',
      delta: `${m.totalStaff} staff members`,
      positive: true,
      description: 'Total active staff in system',
      icon: 'UsersIcon',
      color: 'text-teal-600',
      bgColor: 'bg-teal-50',
      borderColor: 'border-teal-200',
      progressColor: 'bg-teal-500',
      hero: false,
      alert: false,
      drillStatus: undefined as DrillDownFilter['status'],
    },
  ];

  const filteredMetrics = visibleMetricIds
    ? ALL_METRICS.filter(m => visibleMetricIds.includes(m.id))
    : ALL_METRICS;

  const heroMetric = showHeroMetric ? filteredMetrics.find(m => m.hero) : null;
  const regularMetrics = heroMetric
    ? filteredMetrics.filter(m => !m.hero)
    : filteredMetrics;

  return (
    <div className="space-y-2">
      {/* Refresh status bar */}
      <div className="flex items-center justify-between px-0.5">
        <p className="text-[11px] text-muted-foreground font-500 flex items-center gap-1.5">
          <Icon name="ArrowPathIcon" size={11} className="text-muted-foreground" />
          Materialized view synced via pg_cron every 5 min
        </p>
        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-600 ${refreshStatus.bg} ${refreshStatus.color} ${refreshStatus.border}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${refreshStatus.label === 'Live' ? 'bg-emerald-500 animate-pulse' : refreshStatus.label === 'Recent' ? 'bg-sky-500' : refreshStatus.label === 'Syncing' ? 'bg-amber-500' : 'bg-red-500'}`} />
          {refreshStatus.label} · Updated {lastUpdatedLabel}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
        {heroMetric && (
          <button
            onClick={() => onMetricClick({ type: 'metric', label: heroMetric.label, subLabel: `${heroMetric.value} · Target: ${heroMetric.target}`, value: heroMetric.rawValue, status: heroMetric.drillStatus })}
            className="col-span-1 sm:col-span-2 bg-primary rounded-xl p-4 sm:p-5 shadow-card border border-primary/20 flex flex-col gap-3 text-left cursor-pointer hover:brightness-105 active:scale-[0.99] transition-all focus:outline-none focus:ring-2 focus:ring-white/50"
            aria-label={`View staff breakdown for ${heroMetric.label}`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-600 uppercase tracking-wider text-primary-foreground/70">{heroMetric.label}</p>
                <p className="text-3xl sm:text-4xl font-700 text-white mt-1 tabular-nums font-mono">{heroMetric.value}</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
                  <Icon name={heroMetric.icon as Parameters<typeof Icon>[0]['name']} size={22} className="text-white" />
                </div>
              </div>
            </div>
            <ProgressBar value={heroMetric.rawValue} colorClass="bg-white/60" height="h-1.5" />
            <div className="flex items-center justify-between flex-wrap gap-1">
              <p className="text-xs text-primary-foreground/70">{heroMetric.description}</p>
              <span className="text-xs font-600 text-white bg-white/20 px-2 py-0.5 rounded-full">{heroMetric.delta}</span>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-primary-foreground/50">Target: {heroMetric.target}</p>
              <span className="text-[11px] text-white/60 flex items-center gap-1">
                <Icon name="ClockIcon" size={10} className="text-white/50" />
                {lastUpdatedLabel}
              </span>
            </div>
          </button>
        )}

        {regularMetrics.map((metric) => (
          <button
            key={metric.id}
            onClick={() => onMetricClick({ type: 'metric', label: metric.label, subLabel: `${metric.value} · Target: ${metric.target}`, value: metric.rawValue, status: metric.drillStatus })}
            className={`bg-white rounded-xl p-3 sm:p-4 shadow-card border ${metric.alert ? metric.borderColor : 'border-border'} flex flex-col gap-3 ${metric.alert ? metric.bgColor : ''} text-left cursor-pointer hover:shadow-elevated active:scale-[0.99] transition-all focus:outline-none focus:ring-2 focus:ring-primary/30`}
            aria-label={`View staff breakdown for ${metric.label}`}
          >
            <div className="flex items-start justify-between">
              <div className={`w-9 h-9 rounded-lg ${metric.bgColor} flex items-center justify-center`}>
                <Icon name={metric.icon as Parameters<typeof Icon>[0]['name']} size={18} className={metric.color} />
              </div>
              {metric.alert && (
                <span className="text-[10px] font-700 bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full border border-red-200">
                  ⚠ Alert
                </span>
              )}
            </div>
            <div>
              <p className="text-[11px] font-600 uppercase tracking-wider text-muted-foreground">{metric.label}</p>
              <p className={`text-2xl font-700 mt-0.5 tabular-nums font-mono ${metric.color}`}>{metric.value}</p>
            </div>
            <ProgressBar value={metric.rawValue} colorClass={metric.progressColor} height="h-1.5" />
            <div className="flex items-center justify-between flex-wrap gap-1">
              <span className={`text-[11px] font-500 ${metric.positive ? 'text-emerald-600' : 'text-red-600'}`}>
                {metric.delta}
              </span>
              <span className="text-[11px] text-muted-foreground">{metric.target}</span>
            </div>
            {/* Last Updated footer */}
            <div className="flex items-center justify-between pt-0.5 border-t border-border/50">
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Icon name="ClockIcon" size={10} className="text-muted-foreground" />
                {lastUpdatedLabel}
              </span>
              <span className={`text-[10px] font-600 px-1.5 py-0.5 rounded-full border ${refreshStatus.bg} ${refreshStatus.color} ${refreshStatus.border}`}>
                {refreshStatus.label}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}