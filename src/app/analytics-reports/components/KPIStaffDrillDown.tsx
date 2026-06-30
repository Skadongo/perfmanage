'use client';

import React, { useState, useEffect } from 'react';
import Icon from '@/components/ui/AppIcon';
import ProgressBar from '@/components/ui/ProgressBar';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface KPIStaffDrillDownProps {
  metric: {
    id: string;
    label: string;
    value: string;
    sub: string;
    color: string;
    icon: string;
    bg: string;
  } | null;
  onClose: () => void;
}

interface StaffDetail {
  id: string;
  name: string;
  role: string;
  department: string;
  selfRating: number;
  supervisorRating: number;
  status: string;
  submittedAt: string | null;
  reviewYear: number;
}

type TrendFilter = 'all' | 'submitted' | 'approved' | 'draft' | 'at-risk';
type CompareMode = 'self-vs-supervisor' | 'by-department' | 'by-role';

// Roles that can see all staff data
const FULL_ACCESS_ROLES = ['executive_director', 'deputy_director', 'hr_admin_officer'];

const ROLE_LABELS: Record<string, string> = {
  executive_director: 'Director General',
  deputy_director: 'Director of Operations and Institutional Development',
  programme_manager: 'Programme Manager',
  finance_manager: 'Finance Manager',
  hr_admin_officer: 'HR & Admin Officer',
  programme_officer: 'Programme Officer',
  finance_officer: 'Finance Officer',
  admin_officer: 'Admin Officer',
  project_coordinator: 'Project Coordinator',
};

type ViewScope = 'full' | 'team' | 'self';

export default function KPIStaffDrillDown({ metric, onClose }: KPIStaffDrillDownProps) {
  const { user } = useAuth();
  const [staff, setStaff] = useState<StaffDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [trendFilter, setTrendFilter] = useState<TrendFilter>('all');
  const [compareMode, setCompareMode] = useState<CompareMode>('self-vs-supervisor');
  const [searchQuery, setSearchQuery] = useState('');
  const [yearFilter, setYearFilter] = useState<number>(2026);
  const [viewScope, setViewScope] = useState<ViewScope>('full');

  useEffect(() => {
    if (!metric) return;
    setLoading(true);
    const supabase = createClient();

    async function fetchStaff() {
      try {
        // 1. Determine current user's staff record and role
        let currentStaffId: string | null = null;
        let currentRole: string | null = null;
        let scope: ViewScope = 'self';
        let teamStaffIds: string[] = [];

        if (user?.email) {
          const { data: staffRecord } = await supabase
            .from('staff')
            .select('id, system_role')
            .eq('email', user.email)
            .single();

          if (staffRecord) {
            currentStaffId = staffRecord.id;
            currentRole = staffRecord.system_role;

            if (FULL_ACCESS_ROLES.includes(currentRole || '')) {
              scope = 'full';
            } else {
              // Check if this person is a supervisor (others report to them)
              const { data: directReports } = await supabase
                .from('staff')
                .select('id')
                .eq('supervisor_id', currentStaffId);

              if (directReports && directReports.length > 0) {
                scope = 'team';
                teamStaffIds = [currentStaffId, ...directReports.map((r: any) => r.id)];
              } else {
                scope = 'self';
              }
            }
          }
        }

        setViewScope(scope);

        // 2. Build query based on scope
        let query = supabase
          .from('mid_year_reviews')
          .select(`
            id, review_status, self_rating, supervisor_rating,
            submitted_at, review_year,
            staff:staff_id (
              id, full_name, job_title, system_role,
              departments:department_id ( name )
            )
          `)
          .eq('review_year', yearFilter)
          .order('created_at', { ascending: false });

        if (scope === 'self' && currentStaffId) {
          query = query.eq('staff_id', currentStaffId);
        } else if (scope === 'team' && teamStaffIds.length > 0) {
          query = query.in('staff_id', teamStaffIds);
        }
        // scope === 'full' → no additional filter

        const { data: reviews } = await query;

        const mapped: StaffDetail[] = (reviews || [])
          .filter((r: any) => r.staff)
          .map((r: any) => ({
            id: r.id,
            name: r.staff.full_name,
            role: ROLE_LABELS[r.staff.system_role] || r.staff.job_title || '—',
            department: r.staff.departments?.name || 'General',
            selfRating: r.self_rating ?? 0,
            supervisorRating: r.supervisor_rating ?? 0,
            status: r.review_status,
            submittedAt: r.submitted_at,
            reviewYear: r.review_year,
          }));

        setStaff(mapped);
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }
    fetchStaff();
  }, [metric, yearFilter, user]);

  if (!metric) return null;

  const filtered = staff.filter((s) => {
    const matchSearch = !searchQuery || s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.department.toLowerCase().includes(searchQuery.toLowerCase());
    const matchFilter =
      trendFilter === 'all' ? true :
      trendFilter === 'submitted' ? ['submitted', 'reviewed', 'approved'].includes(s.status) :
      trendFilter === 'approved' ? s.status === 'approved' :
      trendFilter === 'draft' ? s.status === 'draft' :
      trendFilter === 'at-risk' ? (s.selfRating > 0 && s.selfRating <= 2) || s.status === 'draft' : true;
    return matchSearch && matchFilter;
  });

  // Comparative analysis data
  const byDept = filtered.reduce<Record<string, { count: number; avgSelf: number; avgSup: number; selfSum: number; supSum: number; supCount: number }>>((acc, s) => {
    if (!acc[s.department]) acc[s.department] = { count: 0, avgSelf: 0, avgSup: 0, selfSum: 0, supSum: 0, supCount: 0 };
    acc[s.department].count++;
    if (s.selfRating > 0) { acc[s.department].selfSum += s.selfRating; }
    if (s.supervisorRating > 0) { acc[s.department].supSum += s.supervisorRating; acc[s.department].supCount++; }
    return acc;
  }, {});
  Object.values(byDept).forEach((d) => {
    d.avgSelf = d.count > 0 ? Math.round((d.selfSum / d.count) * 10) / 10 : 0;
    d.avgSup = d.supCount > 0 ? Math.round((d.supSum / d.supCount) * 10) / 10 : 0;
  });

  const byRole = filtered.reduce<Record<string, { count: number; avgSelf: number; selfSum: number; supSum: number; supCount: number }>>((acc, s) => {
    if (!acc[s.role]) acc[s.role] = { count: 0, avgSelf: 0, selfSum: 0, supSum: 0, supCount: 0 };
    acc[s.role].count++;
    if (s.selfRating > 0) acc[s.role].selfSum += s.selfRating;
    if (s.supervisorRating > 0) { acc[s.role].supSum += s.supervisorRating; acc[s.role].supCount++; }
    return acc;
  }, {});
  Object.values(byRole).forEach((r) => {
    r.avgSelf = r.count > 0 ? Math.round((r.selfSum / r.count) * 10) / 10 : 0;
  });

  const avgSelf = filtered.length > 0 ? Math.round((filtered.reduce((a, s) => a + (s.selfRating || 0), 0) / filtered.length) * 10) / 10 : 0;
  const avgSup = filtered.filter(s => s.supervisorRating > 0).length > 0
    ? Math.round((filtered.filter(s => s.supervisorRating > 0).reduce((a, s) => a + s.supervisorRating, 0) / filtered.filter(s => s.supervisorRating > 0).length) * 10) / 10
    : 0;

  const statusColor = (status: string) => {
    if (status === 'approved') return 'bg-emerald-100 text-emerald-700';
    if (status === 'submitted' || status === 'reviewed') return 'bg-sky-100 text-sky-700';
    if (status === 'rejected') return 'bg-red-100 text-red-700';
    return 'bg-amber-100 text-amber-700';
  };

  const ratingColor = (r: number) => {
    if (r >= 4) return 'text-emerald-700';
    if (r >= 3) return 'text-sky-700';
    if (r >= 2) return 'text-amber-700';
    if (r > 0) return 'text-red-700';
    return 'text-muted-foreground';
  };

  const scopeBadge = viewScope === 'full'
    ? { label: 'Full Organisation View', color: 'bg-violet-100 text-violet-700' }
    : viewScope === 'team'
    ? { label: 'Team View', color: 'bg-sky-100 text-sky-700' }
    : { label: 'My Data Only', color: 'bg-amber-100 text-amber-700' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border bg-gradient-to-r from-primary/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${metric.bg} flex items-center justify-center`}>
              <Icon name={metric.icon as Parameters<typeof Icon>[0]['name']} size={20} className={metric.color} />
            </div>
            <div>
              <h2 className="text-base font-700 text-foreground">{metric.label} — Staff Detail</h2>
              <p className="text-xs text-muted-foreground">{metric.value} · {metric.sub}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Scope badge */}
            <span className={`text-[10px] font-600 px-2.5 py-1 rounded-full ${scopeBadge.color}`}>
              {scopeBadge.label}
            </span>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
              <Icon name="XMarkIcon" size={18} />
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-border bg-muted/20">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <Icon name="MagnifyingGlassIcon" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder={viewScope === 'self' ? 'Your record…' : 'Search staff or department…'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Year filter */}
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(Number(e.target.value))}
            className="text-xs border border-border rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {[2026, 2025, 2024].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          {/* Trend filter */}
          <div className="flex gap-1">
            {(['all', 'submitted', 'approved', 'draft', 'at-risk'] as TrendFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setTrendFilter(f)}
                className={`px-2.5 py-1 text-[11px] font-600 rounded-lg capitalize transition-colors ${
                  trendFilter === f ? 'bg-primary text-white' : 'bg-white border border-border text-muted-foreground hover:border-primary/40'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Compare mode — only show for team/full scope */}
          {viewScope !== 'self' && (
            <div className="flex gap-1">
              {([
                { id: 'self-vs-supervisor', label: 'Self vs Sup' },
                { id: 'by-department', label: 'By Dept' },
                { id: 'by-role', label: 'By Role' },
              ] as { id: CompareMode; label: string }[]).map((m) => (
                <button
                  key={m.id}
                  onClick={() => setCompareMode(m.id)}
                  className={`px-2.5 py-1 text-[11px] font-600 rounded-lg transition-colors ${
                    compareMode === m.id ? 'bg-violet-600 text-white' : 'bg-white border border-border text-muted-foreground hover:border-violet-300'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mr-3" />
              <span className="text-sm text-muted-foreground">Loading staff data…</span>
            </div>
          ) : (
            <div className="p-5 space-y-5">
              {/* Restricted view notice for self-only */}
              {viewScope === 'self' && (
                <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <Icon name="InformationCircleIcon" size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800">
                    You are viewing your own appraisal data only. HR officers and Directors have access to full organisation metrics.
                  </p>
                </div>
              )}

              {/* Team view notice */}
              {viewScope === 'team' && (
                <div className="flex items-start gap-3 bg-sky-50 border border-sky-200 rounded-xl p-3">
                  <Icon name="UsersIcon" size={16} className="text-sky-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-sky-800">
                    Showing metrics for your team ({filtered.length} member{filtered.length !== 1 ? 's' : ''}). Contact HR for organisation-wide data.
                  </p>
                </div>
              )}

              {/* Summary strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Total Staff', value: filtered.length, color: 'text-foreground', bg: 'bg-muted/40' },
                  { label: 'Avg Self Rating', value: avgSelf > 0 ? `${avgSelf}/5` : '—', color: 'text-sky-700', bg: 'bg-sky-50' },
                  { label: 'Avg Supervisor', value: avgSup > 0 ? `${avgSup}/5` : '—', color: 'text-violet-700', bg: 'bg-violet-50' },
                  { label: 'Approved', value: filtered.filter(s => s.status === 'approved').length, color: 'text-emerald-700', bg: 'bg-emerald-50' },
                ].map((s) => (
                  <div key={s.label} className={`${s.bg} rounded-xl p-3 text-center`}>
                    <p className={`text-xl font-700 tabular-nums font-mono ${s.color}`}>{s.value}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Comparative Analysis — only for team/full scope */}
              {viewScope !== 'self' && compareMode === 'by-department' && (
                <div className="bg-white border border-border rounded-xl p-4">
                  <h3 className="text-sm font-700 text-foreground mb-3">Department Comparison</h3>
                  <div className="space-y-3">
                    {Object.entries(byDept).map(([dept, stats]) => (
                      <div key={dept} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-600 text-foreground">{dept}</span>
                          <div className="flex items-center gap-3 text-[11px]">
                            <span className="text-sky-700">Self: {stats.avgSelf}/5</span>
                            <span className="text-violet-700">Sup: {stats.avgSup}/5</span>
                            <span className="text-muted-foreground">{stats.count} staff</span>
                          </div>
                        </div>
                        <div className="flex gap-1 h-2">
                          <div className="flex-1 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-sky-400 rounded-full" style={{ width: `${(stats.avgSelf / 5) * 100}%` }} />
                          </div>
                          <div className="flex-1 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-violet-400 rounded-full" style={{ width: `${(stats.avgSup / 5) * 100}%` }} />
                          </div>
                        </div>
                      </div>
                    ))}
                    {Object.keys(byDept).length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4">No data for selected filters</p>
                    )}
                  </div>
                </div>
              )}

              {viewScope !== 'self' && compareMode === 'by-role' && (
                <div className="bg-white border border-border rounded-xl p-4">
                  <h3 className="text-sm font-700 text-foreground mb-3">Role Comparison</h3>
                  <div className="space-y-2">
                    {Object.entries(byRole).map(([role, stats]) => (
                      <div key={role} className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-48 truncate flex-shrink-0">{role}</span>
                        <div className="flex-1">
                          <ProgressBar value={(stats.avgSelf / 5) * 100} colorClass="bg-sky-400" height="h-1.5" />
                        </div>
                        <span className="text-[11px] font-700 text-sky-700 w-10 text-right">{stats.avgSelf}/5</span>
                        <span className="text-[10px] text-muted-foreground w-12 text-right">{stats.count} staff</span>
                      </div>
                    ))}
                    {Object.keys(byRole).length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4">No data for selected filters</p>
                    )}
                  </div>
                </div>
              )}

              {/* Staff table */}
              <div className="bg-white border border-border rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20">
                  <h3 className="text-sm font-700 text-foreground">
                    {viewScope === 'self' ? 'My Appraisal' : viewScope === 'team' ? 'Team Detail' : 'Staff Detail'} ({filtered.length})
                  </h3>
                  {viewScope !== 'self' && compareMode === 'self-vs-supervisor' && (
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-400 inline-block" />Self Rating</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-400 inline-block" />Supervisor Rating</span>
                    </div>
                  )}
                </div>
                {filtered.length === 0 ? (
                  <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
                    No staff match the selected filters
                  </div>
                ) : (
                  <div className="overflow-x-auto scrollbar-thin">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border bg-muted/10">
                          <th className="text-left px-4 py-2.5 font-600 text-muted-foreground uppercase tracking-wider">Staff</th>
                          <th className="text-left px-4 py-2.5 font-600 text-muted-foreground uppercase tracking-wider">Department</th>
                          <th className="text-left px-4 py-2.5 font-600 text-muted-foreground uppercase tracking-wider">Status</th>
                          <th className="text-left px-4 py-2.5 font-600 text-muted-foreground uppercase tracking-wider">Self Rating</th>
                          <th className="text-left px-4 py-2.5 font-600 text-muted-foreground uppercase tracking-wider">Sup Rating</th>
                          {viewScope !== 'self' && compareMode === 'self-vs-supervisor' && (
                            <th className="text-left px-4 py-2.5 font-600 text-muted-foreground uppercase tracking-wider">Comparison</th>
                          )}
                          <th className="text-left px-4 py-2.5 font-600 text-muted-foreground uppercase tracking-wider">Submitted</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((s, idx) => {
                          const variance = s.supervisorRating > 0 && s.selfRating > 0 ? s.supervisorRating - s.selfRating : null;
                          return (
                            <tr key={s.id} className={`border-b border-border last:border-0 ${idx % 2 === 0 ? 'bg-white' : 'bg-muted/10'} hover:bg-primary/5 transition-colors`}>
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                    <span className="text-primary text-[10px] font-700">
                                      {s.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                    </span>
                                  </div>
                                  <div>
                                    <p className="font-600 text-foreground">{s.name}</p>
                                    <p className="text-[10px] text-muted-foreground truncate max-w-[140px]">{s.role}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-2.5 text-muted-foreground">{s.department}</td>
                              <td className="px-4 py-2.5">
                                <span className={`text-[10px] font-600 px-2 py-0.5 rounded-full capitalize ${statusColor(s.status)}`}>
                                  {s.status}
                                </span>
                              </td>
                              <td className="px-4 py-2.5">
                                <span className={`font-700 tabular-nums font-mono ${ratingColor(s.selfRating)}`}>
                                  {s.selfRating > 0 ? `${s.selfRating}/5` : '—'}
                                </span>
                              </td>
                              <td className="px-4 py-2.5">
                                <span className={`font-700 tabular-nums font-mono ${ratingColor(s.supervisorRating)}`}>
                                  {s.supervisorRating > 0 ? `${s.supervisorRating}/5` : '—'}
                                </span>
                              </td>
                              {viewScope !== 'self' && compareMode === 'self-vs-supervisor' && (
                                <td className="px-4 py-2.5 min-w-[120px]">
                                  {variance !== null ? (
                                    <div className="flex items-center gap-2">
                                      <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                                        <div
                                          className={`h-full rounded-full ${variance >= 0 ? 'bg-emerald-400' : 'bg-red-400'}`}
                                          style={{ width: `${Math.min(Math.abs(variance) / 4 * 100, 100)}%` }}
                                        />
                                      </div>
                                      <span className={`text-[10px] font-700 ${variance > 0 ? 'text-emerald-700' : variance < 0 ? 'text-red-700' : 'text-muted-foreground'}`}>
                                        {variance > 0 ? `+${variance}` : variance}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </td>
                              )}
                              <td className="px-4 py-2.5 text-muted-foreground">
                                {s.submittedAt ? new Date(s.submittedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
