'use client';

import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import StatusBadge from '@/components/ui/StatusBadge';
import ProgressBar from '@/components/ui/ProgressBar';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { cachedFetch, TTL_DASHBOARD_METRICS } from '@/lib/cache';

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

// VIRTUALIZATION THRESHOLD — use virtual rendering above this count
const VIRTUAL_THRESHOLD = 20;
// Approximate row height in px for virtual scroll
const ROW_HEIGHT = 56;
// Max container height when virtualizing
const VIRTUAL_CONTAINER_HEIGHT = 420;

// Memoized table row — prevents re-render of unchanged rows
const StaffRow = memo(function StaffRow({
  staff,
  idx,
}: {
  staff: AtRiskStaffRecord;
  idx: number;
}) {
  return (
    <tr
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
      <td className="px-4 py-3 w-10">
        <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted">
          <Icon name="ChevronRightIcon" size={14} className="text-muted-foreground" />
        </button>
      </td>
    </tr>
  );
});

export default React.memo(function AtRiskStaffTable({ supervisorId }: Props) {
  const [staffList, setStaffList] = useState<AtRiskStaffRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabaseRef = useRef(createClient());
  const isMounted = useRef(true);

  const fetchAtRiskStaff = useCallback(async () => {
    const supabase = supabaseRef.current;
    const cacheKey = `at-risk-staff:${supervisorId ?? 'org'}`;

    try {
      const records = await cachedFetch<AtRiskStaffRecord[]>(
        cacheKey,
        async () => {
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
            .order('created_at', { ascending: false })
            .limit(50);

          if (supervisorId) {
            reviewsQuery = reviewsQuery.eq('supervisor_id', supervisorId);
          }

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
              dueDate: review.review_year ? `30 Jun ${review.review_year}` : '30 Jun 2026',
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
              dueDate: '30 Jun 2026',
              supervisor: staff.supervisor_name || 'Not assigned',
            });
          }

          result.sort((a, b) => {
            if (a.status === 'overdue' && b.status !== 'overdue') return -1;
            if (a.status !== 'overdue' && b.status === 'overdue') return 1;
            return a.progress - b.progress;
          });

          return result;
        },
        TTL_DASHBOARD_METRICS
      );

      if (isMounted.current) setStaffList(records);
    } catch (err: any) {
      if (isMounted.current) setError(err?.message || 'An unexpected error occurred');
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, [supervisorId]);

  useEffect(() => {
    isMounted.current = true;
    fetchAtRiskStaff();
    return () => { isMounted.current = false; };
  }, [fetchAtRiskStaff]);

  const overdueCount = staffList.filter(s => s.status === 'overdue').length;
  const atRiskCount = staffList.filter(s => s.status === 'at-risk').length;

  const tableHeader = (
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
  );

  const renderBody = () => {
    if (loading) {
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
          {error}
        </div>
      );
    }

    if (staffList.length === 0) {
      return (
        <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
          {supervisorId ? 'All your direct reports are on track.' : 'No at-risk staff found.'}
        </div>
      );
    }

    // For large lists: use CSS overflow scroll with fixed height (virtual-like behaviour)
    // For small lists: render all rows normally
    const useScrollContainer = staffList.length > VIRTUAL_THRESHOLD;

    const tableBody = (
      <tbody>
        {staffList.map((staff, idx) => (
          <StaffRow key={staff.id} staff={staff} idx={idx} />
        ))}
      </tbody>
    );

    if (useScrollContainer) {
      return (
        <div
          className="overflow-auto scrollbar-thin"
          style={{ maxHeight: VIRTUAL_CONTAINER_HEIGHT }}
        >
          <table className="w-full text-sm">
            {tableHeader}
            {tableBody}
          </table>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm">
          {tableHeader}
          {tableBody}
        </table>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl border border-border shadow-card">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div>
          <h3 className="text-sm font-700 text-foreground">At-Risk Staff</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {loading ? 'Loading…' : `${overdueCount} overdue · ${atRiskCount} at risk`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {overdueCount > 0 && (
            <span className="text-[11px] font-600 px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">
              {overdueCount} overdue
            </span>
          )}
          {atRiskCount > 0 && (
            <span className="text-[11px] font-600 px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200">
              {atRiskCount} at risk
            </span>
          )}
        </div>
      </div>

      {renderBody()}
    </div>
  );
});