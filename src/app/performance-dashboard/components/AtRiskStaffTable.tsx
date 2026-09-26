'use client';

import React from 'react';
import useSWR from 'swr';
import StatusBadge from '@/components/ui/StatusBadge';
import ProgressBar from '@/components/ui/ProgressBar';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';

interface AtRiskStaffRecord {
  id: string;
  name: string;
  role: string;
  perspective: string;
  kpi: string;
  current: string;
  target: string;
  progress: number;
  status: 'at-risk' | 'overdue';
  dueDate: string;
  supervisor: string;
}

interface Props {
  /** When set, only shows direct reports of this supervisor */
  supervisorId?: string | null;
}

/** Current review year for accuracy gap: filter by current year */
function getCurrentReviewYear(): number {
  return new Date().getFullYear();
}

// Fix 6: Standalone fetcher outside component — stable reference for SWR
async function fetchAtRiskStaff(supervisorId: string | null | undefined): Promise<AtRiskStaffRecord[]> {
  const supabase = createClient();
  const currentYear = getCurrentReviewYear();

  // Accuracy gap fix: filter by current review year
  let reviewsQuery = supabase
    .from('mid_year_reviews')
    .select(`
      id,
      review_status,
      self_rating,
      submitted_at,
      review_year,
      staff:staff_id (
        id,
        full_name,
        job_title,
        supervisor_name,
        departments:department_id ( name )
      )
    `)
    .in('review_status', ['draft', 'submitted', 'rejected'])
    .eq('review_year', currentYear)
    .order('created_at', { ascending: false })
    .limit(50);

  if (supervisorId) {
    reviewsQuery = reviewsQuery.eq('supervisor_id', supervisorId);
  }

  // Accuracy gap fix: staff without reviews in current year
  let staffQuery = supabase
    .from('staff')
    .select('id, full_name, job_title, supervisor_name, departments:department_id ( name )')
    .eq('employment_status', 'active')
    .limit(50);

  if (supervisorId) {
    staffQuery = staffQuery.eq('supervisor_id', supervisorId);
  }

  const [reviewsResult, allStaffResult] = await Promise.all([reviewsQuery, staffQuery]);

  if (reviewsResult.error) throw new Error('Failed to load staff data');
  if (allStaffResult.error) throw new Error('Failed to load staff data');

  const reviews = reviewsResult.data || [];
  const allStaff = allStaffResult.data || [];

  const reviewedStaffIds = new Set(
    reviews.map((r: any) => r.staff?.id).filter(Boolean)
  );

  const result: AtRiskStaffRecord[] = [];

  for (const review of reviews as any[]) {
    const staff = review.staff;
    if (!staff) continue;

    const deptName = staff.departments?.name || 'General';
    const isOverdue = review.review_status === 'draft' || review.review_status === 'rejected';
    const selfRating = review.self_rating;
    const progress = selfRating != null && selfRating > 0
      ? Math.min(100, Math.round((selfRating / 5) * 100))
      : 0;

    result.push({
      id: review.id,
      name: staff.full_name,
      role: staff.job_title,
      perspective: deptName,
      kpi: isOverdue ? 'Mid-Year Review Submission' : 'Performance Review',
      current: isOverdue ? 'Not submitted' : selfRating != null ? `Rating: ${selfRating}/5` : 'Pending rating',
      target: 'Submitted & Approved',
      progress: isOverdue ? 20 : progress,
      status: isOverdue ? 'overdue' : 'at-risk',
      dueDate: `30 Jun ${currentYear}`,
      supervisor: staff.supervisor_name || 'Not assigned',
    });
  }

  for (const staff of allStaff as any[]) {
    if (reviewedStaffIds.has(staff.id)) continue;
    const deptName = staff.departments?.name || 'General';
    result.push({
      id: `no-review-${staff.id}`,
      name: staff.full_name,
      role: staff.job_title,
      perspective: deptName,
      kpi: 'Mid-Year Review Submission',
      current: 'No review started',
      target: 'Submitted & Approved',
      progress: 0,
      status: 'overdue',
      dueDate: `30 Jun ${currentYear}`,
      supervisor: staff.supervisor_name || 'Not assigned',
    });
  }

  result.sort((a, b) => {
    if (a.status === 'overdue' && b.status !== 'overdue') return -1;
    if (a.status !== 'overdue' && b.status === 'overdue') return 1;
    return a.progress - b.progress;
  });

  return result.slice(0, 10);
}

// Fix 6: Convert AtRiskStaffTable from useEffect+useState to SWR
// SWR serves cached result instantly on revisit and revalidates in background
export default React.memo(function AtRiskStaffTable({ supervisorId }: Props) {
  const { data: staffList, isLoading, error } = useSWR(
    ['at-risk-staff', supervisorId ?? 'org'],
    () => fetchAtRiskStaff(supervisorId),
    {
      revalidateOnFocus: false,
      dedupingInterval: 60_000, // 60 s dedup — stale-while-revalidate pattern
      fallbackData: undefined,
    }
  );

  const list = staffList ?? [];
  const overdueCount = list.filter(s => s.status === 'overdue').length;
  const atRiskCount = list.filter(s => s.status === 'at-risk').length;
  const currentYear = getCurrentReviewYear();

  const renderBody = () => {
    if (isLoading && !staffList) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="ml-3 text-sm text-muted-foreground">Loading staff data…</span>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex items-center justify-center py-12 text-red-500 text-sm gap-2">
          <Icon name="ExclamationTriangleIcon" size={16} className="text-red-500" />
          {error?.message || 'An unexpected error occurred'}
        </div>
      );
    }

    if (list.length === 0) {
      return (
        <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
          {supervisorId ? 'All your direct reports are on track.' : 'No at-risk staff found.'}
        </div>
      );
    }

    return (
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-4 py-3 text-[11px] font-600 uppercase tracking-wider text-muted-foreground whitespace-nowrap">Staff Member</th>
              <th className="text-left px-4 py-3 text-[11px] font-600 uppercase tracking-wider text-muted-foreground whitespace-nowrap">Role</th>
              <th className="text-left px-4 py-3 text-[11px] font-600 uppercase tracking-wider text-muted-foreground whitespace-nowrap">KPI</th>
              <th className="text-left px-4 py-3 text-[11px] font-600 uppercase tracking-wider text-muted-foreground whitespace-nowrap">Progress</th>
              <th className="text-left px-4 py-3 text-[11px] font-600 uppercase tracking-wider text-muted-foreground whitespace-nowrap">Current / Target</th>
              <th className="text-left px-4 py-3 text-[11px] font-600 uppercase tracking-wider text-muted-foreground whitespace-nowrap">Status</th>
              <th className="text-left px-4 py-3 text-[11px] font-600 uppercase tracking-wider text-muted-foreground whitespace-nowrap">Due Date</th>
              <th className="text-left px-4 py-3 text-[11px] font-600 uppercase tracking-wider text-muted-foreground whitespace-nowrap">Supervisor</th>
              <th className="px-4 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {list.map((staff, idx) => (
              <tr
                key={staff.id}
                className={`group border-b border-border last:border-0 transition-colors cursor-pointer hover:bg-muted/50 ${
                  idx % 2 === 0 ? 'bg-white' : 'bg-muted/10'
                }`}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-primary text-[10px] font-700">
                        {staff.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </span>
                    </div>
                    <span className="font-500 text-foreground whitespace-nowrap">{staff.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">{staff.role}</td>
                <td className="px-4 py-3">
                  <div>
                    <p className="text-xs font-600 text-foreground">{staff.kpi}</p>
                    <p className="text-[10px] text-muted-foreground">{staff.perspective}</p>
                  </div>
                </td>
                <td className="px-4 py-3 min-w-[120px]">
                  <ProgressBar
                    value={staff.progress}
                    colorClass={staff.status === 'overdue' ? 'bg-red-400' : 'bg-amber-400'}
                  />
                  <span className="text-[10px] text-muted-foreground tabular-nums">{staff.progress}%</span>
                </td>
                <td className="px-4 py-3">
                  <div>
                    <p className="text-xs text-foreground">{staff.current}</p>
                    <p className="text-[10px] text-muted-foreground">{staff.target}</p>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={staff.status} />
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{staff.dueDate}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{staff.supervisor}</td>
                <td className="px-4 py-3">
                  <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted">
                    <Icon name="ChevronRightIcon" size={14} className="text-muted-foreground" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl border border-border shadow-card">
      <div className="flex items-center justify-between p-5 border-b border-border">
        <div>
          <h3 className="text-sm font-700 text-foreground">
            {supervisorId ? 'Your Team — At-Risk & Overdue KPIs' : 'At-Risk & Overdue KPIs'}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {supervisorId ? 'Direct reports requiring attention' : 'Staff requiring immediate attention'} · {currentYear}
          </p>
        </div>
        {!isLoading && !error && (
          <span className="text-[11px] bg-red-50 text-red-700 border border-red-200 px-2 py-1 rounded-md font-600">
            {overdueCount} Overdue · {atRiskCount} At Risk
          </span>
        )}
      </div>
      {renderBody()}
    </div>
  );
});