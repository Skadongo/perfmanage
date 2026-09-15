'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
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

export default React.memo(function AtRiskStaffTable({ supervisorId }: Props) {
  const [staffList, setStaffList] = useState<AtRiskStaffRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Stable client ref — never recreated across renders
  const supabaseRef = useRef(createClient());
  const isMounted = useRef(true);

  const fetchAtRiskStaff = useCallback(async () => {
    const supabase = supabaseRef.current;
    const cacheKey = `at-risk-staff:${supervisorId ?? 'org'}`;

    try {
      const records = await cachedFetch<AtRiskStaffRecord[]>(
        cacheKey,
        async () => {
          // Build reviews query — scope to direct reports if supervisorId provided
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
            .limit(20);

          if (supervisorId) {
            reviewsQuery = reviewsQuery.eq('supervisor_id', supervisorId);
          }

          // Only fetch staff without reviews — limit tightly
          let staffQuery = supabase
            .from('staff')
            .select('id, full_name, job_title, supervisor_name, departments:department_id ( name )')
            .eq('employment_status', 'active')
            .limit(20);

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

          // Only add staff without reviews up to fill the 10-item cap
          const remaining = 10 - result.length;
          if (remaining > 0) {
            for (const staff of (allStaff as any[]).slice(0, remaining + reviewedStaffIds.size)) {
              if (reviewedStaffIds.has(staff.id)) continue;
              if (result.length >= 10) break;
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
          }

          result.sort((a, b) => {
            if (a.status === 'overdue' && b.status !== 'overdue') return -1;
            if (a.status !== 'overdue' && b.status === 'overdue') return 1;
            return a.progress - b.progress;
          });

          return result.slice(0, 10);
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
            {staffList.map((staff, idx) => (
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
            {supervisorId ? 'Direct reports requiring attention' : 'Staff requiring immediate attention'} · Q1 2026
          </p>
        </div>
        {!loading && !error && (
          <span className="text-[11px] bg-red-50 text-red-700 border border-red-200 px-2 py-1 rounded-md font-600">
            {overdueCount} Overdue · {atRiskCount} At Risk
          </span>
        )}
      </div>
      {renderBody()}
    </div>
  );
});