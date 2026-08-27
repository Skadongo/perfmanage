'use client';

import React, { useState, useEffect } from 'react';
import StatusBadge from '@/components/ui/StatusBadge';
import ProgressBar from '@/components/ui/ProgressBar';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { cachedFetch } from '@/lib/cache';

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

const AT_RISK_CACHE_TTL = 2 * 60_000; // 2 minutes

export default function AtRiskStaffTable({ supervisorId }: Props) {
  const [staffList, setStaffList] = useState<AtRiskStaffRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cacheKey = `at-risk-staff:${supervisorId ?? 'org'}`;

    async function fetchAtRiskStaff() {
      const supabase = createClient();
      try {
        const records = await cachedFetch<AtRiskStaffRecord[]>(
          cacheKey,
          async () => {
            // Run both queries in parallel — single round-trip
            const [reviewsResult, allStaffResult] = await Promise.all([
              (() => {
                let q = supabase
                  .from('mid_year_reviews')
                  .select(`
                    id,
                    review_status,
                    self_rating,
                    supervisor_rating,
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
                  .order('created_at', { ascending: false });
                if (supervisorId) q = q.eq('supervisor_id', supervisorId);
                return q;
              })(),
              (() => {
                let q = supabase
                  .from('staff')
                  .select(`
                    id,
                    full_name,
                    job_title,
                    supervisor_name,
                    departments:department_id ( name )
                  `)
                  .eq('employment_status', 'active')
                  .limit(50);
                if (supervisorId) q = q.eq('supervisor_id', supervisorId);
                return q;
              })(),
            ]);

            if (reviewsResult.error) throw new Error('Failed to load staff data');
            if (allStaffResult.error) throw new Error('Failed to load staff data');

            const reviews = reviewsResult.data || [];
            const allStaff = allStaffResult.data || [];

            const reviewedStaffIds = new Set(
              reviews.map((r: any) => r.staff?.id).filter(Boolean)
            );

            const result: AtRiskStaffRecord[] = [];

            reviews.forEach((review: any) => {
              const staff = review.staff;
              if (!staff) return;

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
            });

            allStaff.forEach((staff: any) => {
              if (reviewedStaffIds.has(staff.id)) return;
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
            });

            result.sort((a, b) => {
              if (a.status === 'overdue' && b.status !== 'overdue') return -1;
              if (a.status !== 'overdue' && b.status === 'overdue') return 1;
              return a.progress - b.progress;
            });

            return result.slice(0, 10);
          },
          AT_RISK_CACHE_TTL
        );

        setStaffList(records);
      } catch (err: any) {
        setError(err?.message || 'An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    }

    fetchAtRiskStaff();
  }, [supervisorId]);

  const overdueCount = staffList.filter(s => s.status === 'overdue').length;
  const atRiskCount = staffList.filter(s => s.status === 'at-risk').length;

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

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="ml-3 text-sm text-muted-foreground">Loading staff data…</span>
        </div>
      )}

      {error && !loading && (
        <div className="flex items-center justify-center py-12 text-red-500 text-sm gap-2">
          <Icon name="ExclamationTriangleIcon" size={16} className="text-red-500" />
          {error}
        </div>
      )}

      {!loading && !error && staffList.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
          <Icon name="CheckCircleIcon" size={32} className="text-emerald-400" />
          <p className="text-sm font-600 text-emerald-700">All staff on track!</p>
          <p className="text-xs text-muted-foreground">No at-risk or overdue KPIs found.</p>
        </div>
      )}

      {!loading && !error && staffList.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-5 py-3 text-xs font-600 text-muted-foreground">Staff Member</th>
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground hidden md:table-cell">KPI / Issue</th>
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground hidden lg:table-cell">Current Status</th>
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground hidden lg:table-cell">Progress</th>
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground hidden xl:table-cell">Due Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {staffList.map((staff) => (
                <tr key={staff.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-5 py-3.5">
                    <div>
                      <p className="font-600 text-foreground text-sm">{staff.name}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[160px]">{staff.role}</p>
                      <p className="text-[11px] text-muted-foreground/70 truncate max-w-[160px]">{staff.perspective}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 hidden md:table-cell">
                    <p className="text-sm text-foreground">{staff.kpi}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Supervisor: {staff.supervisor}</p>
                  </td>
                  <td className="px-4 py-3.5 hidden lg:table-cell">
                    <p className="text-sm text-foreground">{staff.current}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Target: {staff.target}</p>
                  </td>
                  <td className="px-4 py-3.5 hidden lg:table-cell">
                    <div className="flex items-center gap-2">
                      <ProgressBar value={staff.progress} max={100} size="sm" color={staff.status === 'overdue' ? 'danger' : 'warning'} className="w-20" />
                      <span className="text-xs font-600 tabular-nums text-muted-foreground">{staff.progress}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <StatusBadge status={staff.status} />
                  </td>
                  <td className="px-4 py-3.5 hidden xl:table-cell">
                    <p className="text-xs text-muted-foreground">{staff.dueDate}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}