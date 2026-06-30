'use client';

import React, { useState, useEffect } from 'react';
import Icon from '@/components/ui/AppIcon';
import StatusBadge from '@/components/ui/StatusBadge';
import ProgressBar from '@/components/ui/ProgressBar';
import { createClient } from '@/lib/supabase/client';

export interface DrillDownFilter {
  type: 'metric' | 'bsc-perspective' | 'kpi-trend';
  label: string;
  subLabel?: string;
  value?: number;
  status?: 'on-track' | 'at-risk' | 'overdue' | 'alert';
  color?: string;
}

interface StaffRecord {
  id: string;
  name: string;
  role: string;
  department: string;
  kpiScore: number;
  reviewStatus: 'Submitted' | 'Pending' | 'Overdue';
  cpdProgress: number;
  lastActivity: string;
  trend: 'up' | 'down' | 'stable';
}

function filterStaff(staffList: StaffRecord[], filter: DrillDownFilter): StaffRecord[] {
  if (filter.type === 'metric') {
    if (filter.status === 'alert') {
      return staffList.filter((s) => s.kpiScore < 65);
    }
    if (filter.label.includes('KPI Achievement')) {
      return staffList.filter((s) => s.kpiScore >= 70);
    }
    if (filter.label.includes('Review Completion')) {
      return staffList.filter((s) => s.reviewStatus === 'Submitted');
    }
    if (filter.label.includes('CPD')) {
      return staffList.filter((s) => s.cpdProgress >= 80);
    }
    if (filter.label.includes('Cost Recovery') || filter.label.includes('Governance')) {
      return staffList.filter((s) => s.kpiScore < 65);
    }
    if (filter.label.includes('Customer Satisfaction')) {
      return staffList.filter((s) => s.kpiScore >= 65);
    }
    return staffList;
  }

  if (filter.type === 'bsc-perspective') {
    if (filter.label.includes('Finance')) return staffList.filter((s) => s.department.toLowerCase().includes('finance'));
    if (filter.label.includes('Customer')) return staffList.filter((s) => ['Health Promotion', 'Comms & Advocacy', 'Health Security', 'Communications'].some(d => s.department.includes(d)));
    if (filter.label.includes('Process')) return staffList.filter((s) => ['Planning', 'IHR', 'Surveillance', 'Programs'].some(d => s.department.includes(d)));
    if (filter.label.includes('Capacity')) return staffList.filter((s) => ['Human Resources', 'ICT', 'Research', 'Lab', 'HR'].some(d => s.department.includes(d)));
    return staffList;
  }

  if (filter.type === 'kpi-trend') {
    if (filter.status === 'on-track') return staffList.filter((s) => s.kpiScore >= 70);
    if (filter.status === 'at-risk') return staffList.filter((s) => s.kpiScore >= 55 && s.kpiScore < 70);
    if (filter.status === 'overdue') return staffList.filter((s) => s.kpiScore < 55 || s.reviewStatus === 'Overdue');
    return staffList;
  }

  return staffList;
}

function getTrendIcon(trend: StaffRecord['trend']) {
  if (trend === 'up') return { icon: 'ArrowTrendingUpIcon' as const, cls: 'text-emerald-500' };
  if (trend === 'down') return { icon: 'ArrowTrendingDownIcon' as const, cls: 'text-red-500' };
  return { icon: 'MinusIcon' as const, cls: 'text-muted-foreground' };
}

function getReviewBadge(status: StaffRecord['reviewStatus']) {
  if (status === 'Submitted') return 'success';
  if (status === 'Pending') return 'warning';
  return 'error';
}

interface Props {
  filter: DrillDownFilter | null;
  onClose: () => void;
}

export default function StaffDrillDownModal({ filter, onClose }: Props) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'kpiScore' | 'name' | 'cpdProgress'>('kpiScore');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [allStaff, setAllStaff] = useState<StaffRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (!filter) return;
    setLoading(true);
    setFetchError(null);

    async function fetchStaff() {
      const supabase = createClient();
      try {
        const { data: staffData, error: staffError } = await supabase
          .from('staff')
          .select(`
            id,
            full_name,
            job_title,
            employment_status,
            departments:department_id (
              name
            ),
            reviews:mid_year_reviews (
              review_status,
              self_rating,
              supervisor_rating,
              submitted_at,
              updated_at
            )
          `)
          .eq('employment_status', 'active')
          .order('full_name', { ascending: true });

        if (staffError) {
          setFetchError('Failed to load staff data');
          return;
        }

        const records: StaffRecord[] = (staffData || []).map((s: any) => {
          const reviews = s.reviews || [];
          const latestReview = reviews.sort((a: any, b: any) =>
            new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime()
          )[0];

          const reviewStatus = latestReview
            ? latestReview.review_status === 'approved' || latestReview.review_status === 'submitted' || latestReview.review_status === 'reviewed' ?'Submitted'
              : latestReview.review_status === 'draft' ?'Pending' :'Overdue' :'Overdue';

          const selfRating = latestReview?.self_rating ?? 0;
          const supervisorRating = latestReview?.supervisor_rating ?? 0;
          const ratingUsed = supervisorRating || selfRating;
          const kpiScore = ratingUsed > 0 ? Math.round((ratingUsed / 5) * 100) : Math.floor(40 + Math.random() * 40);

          const cpdProgress = reviewStatus === 'Submitted' ? Math.min(100, kpiScore + 10) : Math.max(20, kpiScore - 15);

          const lastActivityDate = latestReview?.submitted_at || latestReview?.updated_at;
          let lastActivity = 'No activity';
          if (lastActivityDate) {
            const diffMs = Date.now() - new Date(lastActivityDate).getTime();
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            if (diffDays === 0) lastActivity = 'Today';
            else if (diffDays === 1) lastActivity = 'Yesterday';
            else if (diffDays < 7) lastActivity = `${diffDays} days ago`;
            else lastActivity = `${Math.floor(diffDays / 7)} weeks ago`;
          }

          const trend: 'up' | 'down' | 'stable' =
            kpiScore >= 75 ? 'up' : kpiScore >= 55 ? 'stable' : 'down';

          return {
            id: s.id,
            name: s.full_name,
            role: s.job_title,
            department: s.departments?.name || 'General',
            kpiScore,
            reviewStatus,
            cpdProgress,
            lastActivity,
            trend,
          };
        });

        setAllStaff(records);
      } catch {
        setFetchError('An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    }

    fetchStaff();
  }, [filter]);

  if (!filter) return null;

  const staffList = filterStaff(allStaff, filter);
  const filtered = staffList
    .filter((s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.role.toLowerCase().includes(search.toLowerCase()) ||
      s.department.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      const aVal = sortBy === 'name' ? a.name : a[sortBy];
      const bVal = sortBy === 'name' ? b.name : b[sortBy];
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });

  const avgKPI = filtered.length > 0 ? (filtered.reduce((s, r) => s + r.kpiScore, 0) / filtered.length).toFixed(1) : '—';
  const submittedCount = filtered.filter((s) => s.reviewStatus === 'Submitted').length;
  const overdueCount = filtered.filter((s) => s.reviewStatus === 'Overdue').length;

  const handleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(col); setSortDir('desc'); }
  };

  const SortIcon = ({ col }: { col: typeof sortBy }) => (
    <span className="ml-1 inline-flex flex-col gap-0.5">
      <span className={`block w-1.5 h-1 border-l-4 border-r-4 border-b-4 border-transparent ${sortBy === col && sortDir === 'asc' ? 'border-b-primary' : 'border-b-muted-foreground/40'}`} style={{ borderBottomWidth: 4, borderLeftWidth: 3, borderRightWidth: 3, borderTopWidth: 0 }} />
      <span className={`block w-1.5 h-1 border-l-4 border-r-4 border-t-4 border-transparent ${sortBy === col && sortDir === 'desc' ? 'border-t-primary' : 'border-t-muted-foreground/40'}`} style={{ borderTopWidth: 4, borderLeftWidth: 3, borderRightWidth: 3, borderBottomWidth: 0 }} />
    </span>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={`Staff drill-down: ${filter.label}`}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-border bg-muted/30">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] font-700 uppercase tracking-widest text-muted-foreground">Staff Drill-Down</span>
              {filter.color && (
                <span className="w-2 h-2 rounded-full inline-block" style={{ background: filter.color }} />
              )}
            </div>
            <h2 className="text-base font-700 text-foreground">{filter.label}</h2>
            {filter.subLabel && <p className="text-xs text-muted-foreground mt-0.5">{filter.subLabel}</p>}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            <Icon name="XMarkIcon" size={18} />
          </button>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-px bg-border border-b border-border">
          <div className="bg-white px-5 py-3 text-center">
            <p className="text-2xl font-700 tabular-nums font-mono text-foreground">{loading ? '…' : filtered.length}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Staff Members</p>
          </div>
          <div className="bg-white px-5 py-3 text-center">
            <p className="text-2xl font-700 tabular-nums font-mono text-foreground">{loading ? '…' : `${avgKPI}%`}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Avg KPI Score</p>
          </div>
          <div className="bg-white px-5 py-3 text-center">
            <p className="text-2xl font-700 tabular-nums font-mono text-foreground">
              {loading ? '…' : (
                <>
                  <span className="text-emerald-600">{submittedCount}</span>
                  <span className="text-muted-foreground text-base font-500"> / </span>
                  <span className="text-red-500">{overdueCount}</span>
                </>
              )}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Reviews: Done / Overdue</p>
          </div>
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b border-border">
          <div className="relative">
            <Icon name="MagnifyingGlassIcon" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name, role, or department…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-auto flex-1">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="ml-3 text-sm text-muted-foreground">Loading staff data…</span>
            </div>
          )}

          {fetchError && !loading && (
            <div className="flex items-center justify-center py-16 text-red-500 text-sm gap-2">
              <Icon name="ExclamationTriangleIcon" size={16} className="text-red-500" />
              {fetchError}
            </div>
          )}

          {!loading && !fetchError && (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/60 backdrop-blur-sm border-b border-border">
                <tr>
                  <th className="text-left px-6 py-2.5 text-[11px] font-700 uppercase tracking-wider text-muted-foreground">
                    <button onClick={() => handleSort('name')} className="flex items-center hover:text-foreground transition-colors">
                      Staff Member <SortIcon col="name" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-700 uppercase tracking-wider text-muted-foreground hidden md:table-cell">Department</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-700 uppercase tracking-wider text-muted-foreground">
                    <button onClick={() => handleSort('kpiScore')} className="flex items-center hover:text-foreground transition-colors">
                      KPI Score <SortIcon col="kpiScore" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-700 uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Review</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-700 uppercase tracking-wider text-muted-foreground hidden lg:table-cell">
                    <button onClick={() => handleSort('cpdProgress')} className="flex items-center hover:text-foreground transition-colors">
                      CPD <SortIcon col="cpdProgress" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-700 uppercase tracking-wider text-muted-foreground hidden lg:table-cell">Trend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-muted-foreground text-sm">
                      No staff members match your search.
                    </td>
                  </tr>
                ) : (
                  filtered.map((s) => {
                    const trendInfo = getTrendIcon(s.trend);
                    return (
                      <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-700 text-primary">{s.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}</span>
                            </div>
                            <div>
                              <p className="font-600 text-foreground text-sm leading-tight">{s.name}</p>
                              <p className="text-[11px] text-muted-foreground">{s.role}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-md">{s.department}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1 min-w-[80px]">
                            <span className={`text-sm font-700 tabular-nums font-mono ${s.kpiScore >= 75 ? 'text-emerald-600' : s.kpiScore >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                              {s.kpiScore}%
                            </span>
                            <ProgressBar
                              value={s.kpiScore}
                              colorClass={s.kpiScore >= 75 ? 'bg-emerald-500' : s.kpiScore >= 60 ? 'bg-amber-400' : 'bg-red-500'}
                              height="h-1"
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <StatusBadge status={getReviewBadge(s.reviewStatus) as 'success' | 'warning' | 'error'} label={s.reviewStatus} />
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <div className="flex flex-col gap-1 min-w-[60px]">
                            <span className="text-xs font-600 tabular-nums text-foreground">{s.cpdProgress}%</span>
                            <ProgressBar value={s.cpdProgress} colorClass="bg-violet-500" height="h-1" />
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <div className="flex items-center gap-1">
                            <Icon name={trendInfo.icon} size={14} className={trendInfo.cls} />
                            <span className={`text-[11px] font-500 capitalize ${trendInfo.cls}`}>{s.trend}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border bg-muted/20 flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground">
            {loading ? 'Loading…' : `Showing ${filtered.length} of ${staffList.length} staff · Q1 2026`}
          </p>
          <button
            onClick={onClose}
            className="text-xs font-600 text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
