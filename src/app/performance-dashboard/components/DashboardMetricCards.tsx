'use client';

import React from 'react';
import useSWR from 'swr';
import Icon from '@/components/ui/AppIcon';
import ProgressBar from '@/components/ui/ProgressBar';
import type { DrillDownFilter } from './StaffDrillDownModal';
import { createClient } from '@/lib/supabase/client';
import { MetricCardSkeleton } from '@/components/ui/SkeletonLoader';
import { roleCachedFetch, TTL_DASHBOARD_METRICS } from '@/lib/cache';

interface MetricData {
  kpiAchievementRate: number | null;
  reviewCompletionRate: number | null;
  reviewsSubmitted: number;
  reviewsTotal: number;
  workplansTotal: number;
  workplansApproved: number;
  cpdCompletionRate: number | null;
  avgSupervisorRating: number | null;
  totalStaff: number;
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

// Fetcher used by SWR — runs outside React render cycle
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

      let reviewsQuery = supabase
        .from('mid_year_reviews')
        .select('review_status, supervisor_rating, staff_id, supervisor_id');
      if (staffId) {
        reviewsQuery = reviewsQuery.eq('staff_id', staffId);
      } else if (supervisorId) {
        reviewsQuery = reviewsQuery.eq('supervisor_id', supervisorId);
      }

      let workplansQuery = supabase
        .from('workplan_settings')
        .select('status, workflow_stage, staff_id');
      if (staffId) {
        workplansQuery = workplansQuery.eq('staff_id', staffId);
      } else if (supervisorId) {
        // Get direct reports first
        const { data: directReports } = await supabase
          .from('staff')
          .select('id')
          .eq('supervisor_id', supervisorId)
          .eq('employment_status', 'active');
        const directIds = (directReports || []).map((s: any) => s.id);
        if (directIds.length > 0) {
          workplansQuery = workplansQuery.in('staff_id', directIds);
        }
      }

      const [reviewsResult, staffCountResult, workplansResult] = await Promise.all([
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
      ]);

      const reviewList = reviewsResult.data || [];
      const workplanList = workplansResult.data || [];
      const staffCount = staffCountResult.count ?? 0;

      const submittedReviews = reviewList.filter(r =>
        ['submitted', 'reviewed', 'approved'].includes(r.review_status)
      ).length;
      const denominator = staffId ? Math.max(reviewList.length, 1) : staffCount;
      const reviewCompletionRate = denominator > 0
        ? Math.round((submittedReviews / denominator) * 100)
        : null;

      const ratedReviews = reviewList.filter(r => r.supervisor_rating != null);
      const onTrackReviews = ratedReviews.filter(r => (r.supervisor_rating as number) >= 3).length;
      const kpiAchievementRate = ratedReviews.length > 0
        ? Math.round((onTrackReviews / ratedReviews.length) * 100)
        : null;

      const ratings = reviewList
        .filter(r => r.supervisor_rating != null)
        .map(r => r.supervisor_rating as number);
      const avgSupervisorRating = ratings.length > 0
        ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
        : null;

      const approvedWorkplans = workplanList.filter(w =>
        w.status === 'approved' || w.workflow_stage === 'approved'
      ).length;
      const cpdDenominator = staffId ? Math.max(workplanList.length, 1) : staffCount;
      const cpdCompletionRate = cpdDenominator > 0
        ? Math.round((approvedWorkplans / cpdDenominator) * 100)
        : null;

      return {
        kpiAchievementRate,
        reviewCompletionRate,
        reviewsSubmitted: submittedReviews,
        reviewsTotal: staffId ? reviewList.length : staffCount,
        workplansTotal: workplanList.length,
        workplansApproved: approvedWorkplans,
        cpdCompletionRate,
        avgSupervisorRating,
        totalStaff: staffCount,
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
  // SWR: show stale data instantly while revalidating in background
  const { data: metrics, isLoading } = useSWR(
    ['dashboard-metrics', systemRole, staffId ?? supervisorId ?? 'org'],
    () => fetchMetrics(staffId, supervisorId, systemRole),
    {
      revalidateOnFocus: false,
      dedupingInterval: 30_000, // 30 s dedup window
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
    workplansTotal: 0,
    workplansApproved: 0,
    cpdCompletionRate: null,
    avgSupervisorRating: null,
    totalStaff: 0,
  };

  const kpiValue = m.kpiAchievementRate !== null ? `${m.kpiAchievementRate}%` : '—';
  const kpiRaw = m.kpiAchievementRate ?? 0;
  const reviewValue = m.reviewCompletionRate !== null ? `${m.reviewCompletionRate}%` : '—';
  const reviewRaw = m.reviewCompletionRate ?? 0;
  const cpdValue = m.cpdCompletionRate !== null ? `${m.cpdCompletionRate}%` : '—';
  const cpdRaw = m.cpdCompletionRate ?? 0;
  const avgRatingValue = m.avgSupervisorRating !== null ? `${m.avgSupervisorRating}/5` : '—';

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
      delta: m.reviewsTotal > 0
        ? `${m.reviewsSubmitted} of ${m.reviewsTotal} reviews submitted`
        : 'No reviews yet',
      positive: reviewRaw >= 80,
      description: 'Mid-year reviews submitted',
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
      id: 'metric-cpd-completion',
      label: 'Workplan Completion Rate',
      value: cpdValue,
      rawValue: cpdRaw,
      target: '100% by Dec 31',
      delta: m.workplansTotal > 0
        ? `${m.workplansApproved} of ${m.workplansTotal} workplans approved`
        : 'No workplans yet',
      positive: cpdRaw >= 80,
      description: 'Staff with approved workplans',
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

  // Filter by visibleMetricIds if provided
  const filteredMetrics = visibleMetricIds
    ? ALL_METRICS.filter(m => visibleMetricIds.includes(m.id))
    : ALL_METRICS;

  const heroMetric = showHeroMetric ? filteredMetrics.find(m => m.hero) : null;
  const regularMetrics = heroMetric
    ? filteredMetrics.filter(m => !m.hero)
    : filteredMetrics;

  return (
    /* Responsive grid: 1 col on mobile, 2 on sm, 3 on lg, 4 on xl */
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
      {/* Hero card — spans full width on mobile, 2 cols on sm+ */}
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
              <Icon name="UsersIcon" size={11} className="text-white/60" />
              View staff →
            </span>
          </div>
        </button>
      )}

      {/* Regular cards */}
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
          <div className="flex items-center justify-end">
            <span className="text-[10px] text-muted-foreground flex items-center gap-1 opacity-60">
              <Icon name="UsersIcon" size={10} className="text-muted-foreground" />
              View staff →
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}