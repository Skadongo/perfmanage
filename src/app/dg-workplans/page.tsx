'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import AppLayout from '@/components/AppLayout';
import Icon from '@/components/ui/AppIcon';
import StatusBadge from '@/components/ui/StatusBadge';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { FISCAL_YEARS, CURRENT_FISCAL_YEAR } from '@/hooks/useWorkplans';

// ─── Types ────────────────────────────────────────────────────────────────────

interface KPIEntry {
  id: string;
  label: string;
  target: string;
}

interface PerspectiveRow {
  id: string;
  perspective: string;
  objective: string;
  keyActivities: string;
  kpis: KPIEntry[];
  weight: number;
}

interface Competency {
  id: string;
  name: string;
  description: string;
  weight: number;
}

interface ReviewRecord {
  id: string;
  review_period: string;
  review_year: number;
  review_status: string;
  self_rating: number | null;
  supervisor_rating: number | null;
  kpi_achievements: string | null;
  challenges_faced: string | null;
  support_needed: string | null;
  supervisor_comments: string | null;
  submitted_at: string | null;
  supervisor_reviewed_at: string | null;
}

interface WorkplanDetail {
  id: string;
  staff_id: string;
  fiscal_year: string;
  status: string;
  workflow_stage: string;
  perspectives_objectives: PerspectiveRow[];
  competencies?: Competency[];
  staff_signature: string | null;
  staff_signed_at: string | null;
  supervisor_signature: string | null;
  supervisor_signed_at: string | null;
  created_at: string;
  updated_at: string;
  staff_name: string;
  job_title: string;
  department: string;
  supervisor_name: string | null;
  reviews: ReviewRecord[];
}

interface WorkplanListItem {
  id: string;
  staff_id: string;
  staff_name: string;
  job_title: string;
  department: string;
  supervisor_name: string | null;
  fiscal_year: string;
  status: string;
  workflow_stage: string;
  updated_at: string;
  created_at: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PERSPECTIVE_COLORS: Record<string, { bg: string; border: string; badge: string; dot: string }> = {
  'Financial/Stewardship':        { bg: 'bg-emerald-50', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-800', dot: 'bg-emerald-500' },
  'Customer/Stakeholder':         { bg: 'bg-sky-50',     border: 'border-sky-200',     badge: 'bg-sky-100 text-sky-800',         dot: 'bg-sky-500' },
  'Internal Business Processes':  { bg: 'bg-violet-50',  border: 'border-violet-200',  badge: 'bg-violet-100 text-violet-800',   dot: 'bg-violet-500' },
  'Innovation Learning & Growth': { bg: 'bg-amber-50',   border: 'border-amber-200',   badge: 'bg-amber-100 text-amber-800',     dot: 'bg-amber-500' },
};

const DEFAULT_COLORS = { bg: 'bg-slate-50', border: 'border-slate-200', badge: 'bg-slate-100 text-slate-800', dot: 'bg-slate-400' };

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  signed: 'Signed',
  approved: 'Approved',
  rejected: 'Rejected',
};

const STAGE_LABELS: Record<string, string> = {
  workplan_pending: 'Workplan Pending',
  workplan_approved: 'Workplan Approved',
  mid_year_pending: 'Mid-Year Pending',
  mid_year_approved: 'Mid-Year Approved',
  end_year_pending: 'End-Year Pending',
  end_year_approved: 'End-Year Complete',
};

const STAGE_COLORS: Record<string, string> = {
  workplan_pending: 'bg-amber-100 text-amber-700',
  workplan_approved: 'bg-emerald-100 text-emerald-700',
  mid_year_pending: 'bg-sky-100 text-sky-700',
  mid_year_approved: 'bg-teal-100 text-teal-700',
  end_year_pending: 'bg-violet-100 text-violet-700',
  end_year_approved: 'bg-green-100 text-green-700',
};

const RATING_LABELS: Record<number, string> = {
  1: 'Unsatisfactory',
  2: 'Needs Improvement',
  3: 'Meets Expectations',
  4: 'Exceeds Expectations',
  5: 'Outstanding',
};

const RATING_COLORS: Record<number, string> = {
  1: 'text-red-600',
  2: 'text-orange-500',
  3: 'text-amber-600',
  4: 'text-emerald-600',
  5: 'text-emerald-700',
};

// ─── WorkplanDetailModal ──────────────────────────────────────────────────────

interface WorkplanDetailModalProps {
  workplanId: string | null;
  onClose: () => void;
}

function WorkplanDetailModal({ workplanId, onClose }: WorkplanDetailModalProps) {
  const supabaseRef = useRef(createClient());
  const [detail, setDetail] = useState<WorkplanDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'scorecard' | 'reviews' | 'signoff'>('scorecard');

  useEffect(() => {
    if (!workplanId) return;
    setLoading(true);
    setError(null);
    setDetail(null);
    setActiveTab('scorecard');

    const supabase = supabaseRef.current;

    async function fetchDetail() {
      try {
        // Fetch workplan with staff info
        const { data: wp, error: wpErr } = await supabase
          .from('workplan_settings')
          .select(`
            id,
            staff_id,
            fiscal_year,
            status,
            workflow_stage,
            perspectives_objectives,
            staff_signature,
            staff_signed_at,
            supervisor_signature,
            supervisor_signed_at,
            created_at,
            updated_at,
            staff:staff_id (
              full_name,
              job_title,
              department:department_id ( name ),
              supervisor:supervisor_id ( full_name )
            )
          `)
          .eq('id', workplanId)
          .single();

        if (wpErr) throw wpErr;
        if (!wp) throw new Error('Workplan not found');

        // Fetch reviews linked to this workplan
        const { data: reviews } = await supabase
          .from('mid_year_reviews')
          .select(`
            id,
            review_period,
            review_year,
            review_status,
            self_rating,
            supervisor_rating,
            kpi_achievements,
            challenges_faced,
            support_needed,
            supervisor_comments,
            submitted_at,
            supervisor_reviewed_at
          `)
          .eq('workplan_id', workplanId)
          .order('review_year', { ascending: false });

        const staffData = wp.staff as any;
        const deptData = staffData?.department as any;
        const supervisorData = staffData?.supervisor as any;

        setDetail({
          id: wp.id,
          staff_id: wp.staff_id,
          fiscal_year: wp.fiscal_year,
          status: wp.status,
          workflow_stage: wp.workflow_stage,
          perspectives_objectives: Array.isArray(wp.perspectives_objectives) ? wp.perspectives_objectives : [],
          staff_signature: wp.staff_signature,
          staff_signed_at: wp.staff_signed_at,
          supervisor_signature: wp.supervisor_signature,
          supervisor_signed_at: wp.supervisor_signed_at,
          created_at: wp.created_at,
          updated_at: wp.updated_at,
          staff_name: staffData?.full_name ?? '—',
          job_title: staffData?.job_title ?? '—',
          department: deptData?.name ?? '—',
          supervisor_name: supervisorData?.full_name ?? null,
          reviews: reviews ?? [],
        });
      } catch (err: any) {
        setError(err?.message ?? 'Failed to load workplan details');
      } finally {
        setLoading(false);
      }
    }

    fetchDetail();
  }, [workplanId]);

  if (!workplanId) return null;

  const perspectives = detail?.perspectives_objectives ?? [];
  const totalBscWeight = perspectives.reduce((s, r) => s + (Number(r.weight) || 0), 0);

  function formatDate(iso: string | null) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm overflow-y-auto py-6 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl min-h-[60vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Icon name="ClipboardDocumentListIcon" size={20} className="text-primary" />
            </div>
            <div>
              {loading ? (
                <div className="space-y-1.5">
                  <div className="w-40 h-4 bg-muted/50 rounded animate-pulse" />
                  <div className="w-28 h-3 bg-muted/40 rounded animate-pulse" />
                </div>
              ) : (
                <>
                  <h2 className="text-base font-700 text-foreground">{detail?.staff_name ?? '—'}</h2>
                  <p className="text-xs text-muted-foreground">{detail?.job_title} · {detail?.department}</p>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {detail && (
              <>
                <StatusBadge status={detail.status} />
                <span className={`text-[10px] font-600 px-2 py-0.5 rounded-full ${STAGE_COLORS[detail.workflow_stage] ?? 'bg-muted/50 text-muted-foreground'}`}>
                  {STAGE_LABELS[detail.workflow_stage] ?? detail.workflow_stage}
                </span>
              </>
            )}
            <button
              onClick={onClose}
              className="ml-2 p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <Icon name="XMarkIcon" size={18} />
            </button>
          </div>
        </div>

        {/* Meta row */}
        {detail && !loading && (
          <div className="flex flex-wrap items-center gap-4 px-6 py-3 bg-muted/10 border-b border-border text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Icon name="CalendarDaysIcon" size={13} />
              Fiscal Year: <strong className="text-foreground">{detail.fiscal_year}</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <Icon name="UserIcon" size={13} />
              Supervisor: <strong className="text-foreground">{detail.supervisor_name ?? '—'}</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <Icon name="ClockIcon" size={13} />
              Updated: <strong className="text-foreground">{formatDate(detail.updated_at)}</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <Icon name="ChartBarIcon" size={13} />
              BSC Weight: <strong className={totalBscWeight === 80 ? 'text-emerald-600' : 'text-amber-600'}>{totalBscWeight}/80</strong>
            </span>
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-1 px-6 pt-4 border-b border-border">
          {(['scorecard', 'reviews', 'signoff'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-xs font-600 rounded-t-lg transition-colors capitalize ${
                activeTab === tab
                  ? 'bg-primary/10 text-primary border-b-2 border-primary' :'text-muted-foreground hover:text-foreground hover:bg-muted/30'
              }`}
            >
              {tab === 'scorecard' ? 'BSC Scorecard' : tab === 'reviews' ? `Reviews (${detail?.reviews?.length ?? 0})` : 'Sign-Off'}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading && (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-border p-4 animate-pulse space-y-2">
                  <div className="w-32 h-4 bg-muted/50 rounded" />
                  <div className="w-full h-3 bg-muted/40 rounded" />
                  <div className="w-3/4 h-3 bg-muted/30 rounded" />
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm py-8 justify-center">
              <Icon name="ExclamationCircleIcon" size={18} />
              {error}
            </div>
          )}

          {!loading && !error && detail && (
            <>
              {/* ── BSC Scorecard Tab ── */}
              {activeTab === 'scorecard' && (
                <div className="space-y-4">
                  {perspectives.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                      <Icon name="ClipboardDocumentListIcon" size={32} className="opacity-30" />
                      <p className="text-sm">No BSC perspectives captured yet</p>
                    </div>
                  ) : (
                    perspectives.map((row, idx) => {
                      const colors = PERSPECTIVE_COLORS[row.perspective] ?? DEFAULT_COLORS;
                      return (
                        <div key={row.id ?? idx} className={`rounded-xl border ${colors.border} ${colors.bg} overflow-hidden`}>
                          {/* Perspective header */}
                          <div className="flex items-center justify-between px-4 py-3 border-b border-inherit">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
                              <span className={`text-[11px] font-700 px-2.5 py-0.5 rounded-full ${colors.badge}`}>
                                {row.perspective}
                              </span>
                            </div>
                            <span className="text-xs font-700 text-foreground tabular-nums">
                              Weight: {row.weight ?? 0}%
                            </span>
                          </div>

                          <div className="px-4 py-3 space-y-3">
                            {/* Objective */}
                            <div>
                              <p className="text-[10px] font-600 uppercase tracking-wide text-muted-foreground mb-0.5">Strategic Objective</p>
                              <p className="text-sm text-foreground">{row.objective || <span className="text-muted-foreground italic">Not specified</span>}</p>
                            </div>

                            {/* Key Activities */}
                            {row.keyActivities && (
                              <div>
                                <p className="text-[10px] font-600 uppercase tracking-wide text-muted-foreground mb-0.5">Key Activities</p>
                                <p className="text-sm text-foreground whitespace-pre-line">{row.keyActivities}</p>
                              </div>
                            )}

                            {/* KPIs */}
                            {Array.isArray(row.kpis) && row.kpis.length > 0 && (
                              <div>
                                <p className="text-[10px] font-600 uppercase tracking-wide text-muted-foreground mb-1.5">SMART KPIs</p>
                                <div className="space-y-1.5">
                                  {row.kpis.map((kpi, ki) => (
                                    <div key={kpi.id ?? ki} className="flex items-start gap-2 bg-white/70 rounded-lg px-3 py-2 border border-white/80">
                                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                                        {ki + 1}
                                      </span>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs text-foreground font-500">{kpi.label}</p>
                                        {kpi.target && (
                                          <p className="text-[11px] text-muted-foreground mt-0.5">
                                            <span className="font-600">Target:</span> {kpi.target}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* ── Reviews Tab ── */}
              {activeTab === 'reviews' && (
                <div className="space-y-4">
                  {detail.reviews.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                      <Icon name="ClipboardDocumentCheckIcon" size={32} className="opacity-30" />
                      <p className="text-sm">No reviews submitted yet</p>
                    </div>
                  ) : (
                    detail.reviews.map((rev) => (
                      <div key={rev.id} className="rounded-xl border border-border bg-white overflow-hidden">
                        {/* Review header */}
                        <div className="flex items-center justify-between px-4 py-3 bg-muted/10 border-b border-border">
                          <div className="flex items-center gap-2">
                            <Icon name="ClipboardDocumentCheckIcon" size={15} className="text-primary" />
                            <span className="text-sm font-700 text-foreground capitalize">
                              {rev.review_period?.replace(/-/g, ' ')} Review — {rev.review_year}
                            </span>
                          </div>
                          <span className={`text-[10px] font-600 px-2 py-0.5 rounded-full ${
                            rev.review_status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                            rev.review_status === 'submitted' ? 'bg-sky-100 text-sky-700' :
                            rev.review_status === 'reviewed' ? 'bg-teal-100 text-teal-700' :
                            rev.review_status === 'rejected'? 'bg-red-100 text-red-700' : 'bg-muted/50 text-muted-foreground'
                          }`}>
                            {rev.review_status?.replace(/_/g, ' ') ?? 'Draft'}
                          </span>
                        </div>

                        <div className="px-4 py-4 space-y-4">
                          {/* Ratings row */}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-muted/10 rounded-lg px-3 py-2.5">
                              <p className="text-[10px] font-600 uppercase tracking-wide text-muted-foreground mb-1">Self Rating</p>
                              {rev.self_rating ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-xl font-700 text-foreground">{rev.self_rating}</span>
                                  <span className={`text-xs font-600 ${RATING_COLORS[rev.self_rating] ?? ''}`}>
                                    {RATING_LABELS[rev.self_rating] ?? '—'}
                                  </span>
                                </div>
                              ) : <p className="text-sm text-muted-foreground">Not rated</p>}
                            </div>
                            <div className="bg-muted/10 rounded-lg px-3 py-2.5">
                              <p className="text-[10px] font-600 uppercase tracking-wide text-muted-foreground mb-1">Supervisor Rating</p>
                              {rev.supervisor_rating ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-xl font-700 text-foreground">{rev.supervisor_rating}</span>
                                  <span className={`text-xs font-600 ${RATING_COLORS[rev.supervisor_rating] ?? ''}`}>
                                    {RATING_LABELS[rev.supervisor_rating] ?? '—'}
                                  </span>
                                </div>
                              ) : <p className="text-sm text-muted-foreground">Not rated</p>}
                            </div>
                          </div>

                          {/* KPI Achievements */}
                          {rev.kpi_achievements && (
                            <div>
                              <p className="text-[10px] font-600 uppercase tracking-wide text-muted-foreground mb-1">KPI Achievements</p>
                              <p className="text-sm text-foreground whitespace-pre-line bg-muted/10 rounded-lg px-3 py-2">{rev.kpi_achievements}</p>
                            </div>
                          )}

                          {/* Challenges */}
                          {rev.challenges_faced && (
                            <div>
                              <p className="text-[10px] font-600 uppercase tracking-wide text-muted-foreground mb-1">Challenges Faced</p>
                              <p className="text-sm text-foreground whitespace-pre-line bg-muted/10 rounded-lg px-3 py-2">{rev.challenges_faced}</p>
                            </div>
                          )}

                          {/* Support Needed */}
                          {rev.support_needed && (
                            <div>
                              <p className="text-[10px] font-600 uppercase tracking-wide text-muted-foreground mb-1">Support Needed</p>
                              <p className="text-sm text-foreground whitespace-pre-line bg-muted/10 rounded-lg px-3 py-2">{rev.support_needed}</p>
                            </div>
                          )}

                          {/* Supervisor Comments */}
                          {rev.supervisor_comments && (
                            <div>
                              <p className="text-[10px] font-600 uppercase tracking-wide text-muted-foreground mb-1">Supervisor Comments</p>
                              <p className="text-sm text-foreground whitespace-pre-line bg-primary/5 border border-primary/10 rounded-lg px-3 py-2">{rev.supervisor_comments}</p>
                            </div>
                          )}

                          {/* Dates */}
                          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-1 border-t border-border">
                            {rev.submitted_at && (
                              <span className="flex items-center gap-1">
                                <Icon name="ClockIcon" size={12} />
                                Submitted: {formatDate(rev.submitted_at)}
                              </span>
                            )}
                            {rev.supervisor_reviewed_at && (
                              <span className="flex items-center gap-1">
                                <Icon name="CheckCircleIcon" size={12} />
                                Reviewed: {formatDate(rev.supervisor_reviewed_at)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* ── Sign-Off Tab ── */}
              {activeTab === 'signoff' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Staff sign-off */}
                    <div className="rounded-xl border border-border bg-white p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Icon name="UserIcon" size={15} className="text-primary" />
                        <p className="text-sm font-700 text-foreground">Staff Sign-Off</p>
                      </div>
                      {detail.staff_signed_at ? (
                        <>
                          <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 mb-2">
                            <p className="text-xs font-600 text-emerald-700 flex items-center gap-1">
                              <Icon name="CheckCircleIcon" size={13} />
                              Signed
                            </p>
                          </div>
                          <p className="text-xs text-muted-foreground">Date: {formatDate(detail.staff_signed_at)}</p>
                          {detail.staff_signature && (
                            <p className="text-xs text-muted-foreground mt-1">Signature: <span className="italic text-foreground">{detail.staff_signature}</span></p>
                          )}
                        </>
                      ) : (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                          <p className="text-xs font-600 text-amber-700 flex items-center gap-1">
                            <Icon name="ClockIcon" size={13} />
                            Awaiting staff signature
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Supervisor sign-off */}
                    <div className="rounded-xl border border-border bg-white p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Icon name="ClipboardDocumentCheckIcon" size={15} className="text-primary" />
                        <p className="text-sm font-700 text-foreground">Supervisor Sign-Off</p>
                      </div>
                      {detail.supervisor_signed_at ? (
                        <>
                          <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 mb-2">
                            <p className="text-xs font-600 text-emerald-700 flex items-center gap-1">
                              <Icon name="CheckCircleIcon" size={13} />
                              Signed
                            </p>
                          </div>
                          <p className="text-xs text-muted-foreground">Date: {formatDate(detail.supervisor_signed_at)}</p>
                          {detail.supervisor_signature && (
                            <p className="text-xs text-muted-foreground mt-1">Signature: <span className="italic text-foreground">{detail.supervisor_signature}</span></p>
                          )}
                        </>
                      ) : (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                          <p className="text-xs font-600 text-amber-700 flex items-center gap-1">
                            <Icon name="ClockIcon" size={13} />
                            Awaiting supervisor signature
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Workplan metadata */}
                  <div className="rounded-xl border border-border bg-muted/10 p-4">
                    <p className="text-[10px] font-600 uppercase tracking-wide text-muted-foreground mb-3">Workplan Metadata</p>
                    <div className="grid grid-cols-2 gap-y-2 text-xs">
                      <span className="text-muted-foreground">Created</span>
                      <span className="text-foreground font-500">{formatDate(detail.created_at)}</span>
                      <span className="text-muted-foreground">Last Updated</span>
                      <span className="text-foreground font-500">{formatDate(detail.updated_at)}</span>
                      <span className="text-muted-foreground">Fiscal Year</span>
                      <span className="text-foreground font-500">{detail.fiscal_year}</span>
                      <span className="text-muted-foreground">Status</span>
                      <span className="text-foreground font-500 capitalize">{detail.status}</span>
                      <span className="text-muted-foreground">Workflow Stage</span>
                      <span className="text-foreground font-500">{STAGE_LABELS[detail.workflow_stage] ?? detail.workflow_stage}</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-muted/5">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-600 text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-muted/30 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );

  function formatDate(iso: string | null) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DGWorkplansPage() {
  const { profile } = useAuth();
  const supabaseRef = useRef(createClient());

  const [workplans, setWorkplans] = useState<WorkplanListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFiscalYear, setSelectedFiscalYear] = useState(CURRENT_FISCAL_YEAR);
  const [statusFilter, setStatusFilter] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedWorkplanId, setSelectedWorkplanId] = useState<string | null>(null);

  const PAGE_SIZE = 20;

  const fetchWorkplans = useCallback(async (targetPage = 1) => {
    setLoading(true);
    setError(null);
    const supabase = supabaseRef.current;

    try {
      const from = (targetPage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let q = supabase
        .from('workplan_settings')
        .select(`
          id,
          staff_id,
          fiscal_year,
          status,
          workflow_stage,
          created_at,
          updated_at,
          staff:staff_id (
            full_name,
            job_title,
            department:department_id ( name ),
            supervisor:supervisor_id ( full_name )
          )
        `, { count: 'exact' })
        .eq('fiscal_year', selectedFiscalYear)
        .order('updated_at', { ascending: false })
        .range(from, to);

      if (statusFilter) q = q.eq('status', statusFilter);
      if (stageFilter) q = q.eq('workflow_stage', stageFilter);

      const { data, error: qErr, count } = await q;
      if (qErr) throw qErr;

      const rows: WorkplanListItem[] = (data ?? []).map((row: any) => {
        const staffData = row.staff as any;
        const deptData = staffData?.department as any;
        const supervisorData = staffData?.supervisor as any;
        return {
          id: row.id,
          staff_id: row.staff_id,
          staff_name: staffData?.full_name ?? '—',
          job_title: staffData?.job_title ?? '—',
          department: deptData?.name ?? '—',
          supervisor_name: supervisorData?.full_name ?? null,
          fiscal_year: row.fiscal_year,
          status: row.status,
          workflow_stage: row.workflow_stage,
          created_at: row.created_at,
          updated_at: row.updated_at,
        };
      });

      setWorkplans(rows);
      setTotalCount(count ?? 0);
      setPage(targetPage);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load workplans');
    } finally {
      setLoading(false);
    }
  }, [selectedFiscalYear, statusFilter, stageFilter]);

  useEffect(() => {
    fetchWorkplans(1);
  }, [fetchWorkplans]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // Client-side search filter
  const filteredWorkplans = searchQuery.trim()
    ? workplans.filter((w) =>
        w.staff_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.job_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.department.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : workplans;

  // Stats
  const stats = {
    total: totalCount,
    submitted: workplans.filter((w) => w.status === 'submitted').length,
    approved: workplans.filter((w) => w.status === 'approved').length,
    draft: workplans.filter((w) => w.status === 'draft').length,
  };

  return (
    <AppLayout>
      <div className="min-h-screen bg-background">
        {/* Page header */}
        <div className="bg-white border-b border-border px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Icon name="ClipboardDocumentListIcon" size={20} className="text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-700 text-foreground">All Staff Workplans</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Director General view — browse, filter and inspect submitted workplans
                </p>
              </div>
            </div>
            <button
              onClick={() => fetchWorkplans(1)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-2 hover:bg-muted/30 transition-colors"
            >
              <Icon name="ArrowPathIcon" size={13} />
              Refresh
            </button>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
            {[
              { label: 'Total Workplans', value: stats.total, color: 'text-foreground', bg: 'bg-muted/20' },
              { label: 'Submitted', value: stats.submitted, color: 'text-sky-700', bg: 'bg-sky-50' },
              { label: 'Approved', value: stats.approved, color: 'text-emerald-700', bg: 'bg-emerald-50' },
              { label: 'Draft', value: stats.draft, color: 'text-amber-700', bg: 'bg-amber-50' },
            ].map((stat) => (
              <div key={stat.label} className={`${stat.bg} rounded-xl px-4 py-3`}>
                <p className="text-[10px] font-600 uppercase tracking-wide text-muted-foreground">{stat.label}</p>
                <p className={`text-2xl font-700 ${stat.color} tabular-nums`}>{stat.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white border-b border-border px-6 py-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Icon name="MagnifyingGlassIcon" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search staff, title, department…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-xs border border-border rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
            </div>

            {/* Fiscal Year */}
            <select
              value={selectedFiscalYear}
              onChange={(e) => { setSelectedFiscalYear(e.target.value); setPage(1); }}
              className="text-xs border border-border rounded-lg px-3 py-2 bg-white text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
            >
              {FISCAL_YEARS.map((fy) => (
                <option key={fy} value={fy}>{fy}{fy === CURRENT_FISCAL_YEAR ? ' (Current)' : ''}</option>
              ))}
            </select>

            {/* Status */}
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="text-xs border border-border rounded-lg px-3 py-2 bg-white text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
            >
              <option value="">All Statuses</option>
              {Object.entries(STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>

            {/* Stage */}
            <select
              value={stageFilter}
              onChange={(e) => { setStageFilter(e.target.value); setPage(1); }}
              className="text-xs border border-border rounded-lg px-3 py-2 bg-white text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
            >
              <option value="">All Stages</option>
              {Object.entries(STAGE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>

            {(statusFilter || stageFilter || searchQuery) && (
              <button
                onClick={() => { setStatusFilter(''); setStageFilter(''); setSearchQuery(''); }}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 border border-border rounded-lg px-3 py-2 hover:bg-muted/30 transition-colors"
              >
                <Icon name="XMarkIcon" size={12} />
                Clear filters
              </button>
            )}

            <span className="ml-auto text-xs text-muted-foreground tabular-nums">
              {totalCount} workplan{totalCount !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Table */}
        <div className="px-6 py-5">
          <div className="bg-white rounded-xl border border-border overflow-hidden">
            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 text-red-600 text-sm px-5 py-4">
                <Icon name="ExclamationCircleIcon" size={16} />
                {error}
              </div>
            )}

            {/* Loading skeleton */}
            {loading && (
              <div className="divide-y divide-border">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 px-5 py-3.5 animate-pulse">
                    <div className="w-8 h-8 rounded-full bg-muted/50" />
                    <div className="flex-1 space-y-1.5">
                      <div className="w-36 h-3.5 bg-muted/50 rounded" />
                      <div className="w-24 h-3 bg-muted/40 rounded" />
                    </div>
                    <div className="w-20 h-5 bg-muted/30 rounded-full" />
                    <div className="w-24 h-5 bg-muted/30 rounded-full" />
                    <div className="w-16 h-3 bg-muted/30 rounded" />
                  </div>
                ))}
              </div>
            )}

            {/* Empty */}
            {!loading && !error && filteredWorkplans.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
                <Icon name="ClipboardDocumentListIcon" size={36} className="opacity-25" />
                <p className="text-sm font-600">No workplans found</p>
                <p className="text-xs">Try adjusting the filters or selecting a different fiscal year</p>
              </div>
            )}

            {/* Data table */}
            {!loading && filteredWorkplans.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/20">
                      <th className="text-left px-5 py-3 font-600 text-muted-foreground">Staff Member</th>
                      <th className="text-left px-4 py-3 font-600 text-muted-foreground hidden sm:table-cell">Department</th>
                      <th className="text-left px-4 py-3 font-600 text-muted-foreground hidden md:table-cell">Supervisor</th>
                      <th className="text-left px-4 py-3 font-600 text-muted-foreground">Status</th>
                      <th className="text-left px-4 py-3 font-600 text-muted-foreground hidden lg:table-cell">Stage</th>
                      <th className="text-left px-4 py-3 font-600 text-muted-foreground hidden md:table-cell">Updated</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredWorkplans.map((row) => {
                      const stageColor = STAGE_COLORS[row.workflow_stage] ?? 'bg-muted/50 text-muted-foreground';
                      const stageLabel = STAGE_LABELS[row.workflow_stage] ?? row.workflow_stage;
                      const updatedDate = row.updated_at
                        ? new Date(row.updated_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                        : '—';
                      const initials = row.staff_name
                        .split(' ')
                        .slice(0, 2)
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase();

                      return (
                        <tr
                          key={row.id}
                          className="hover:bg-muted/10 transition-colors group cursor-pointer"
                          onClick={() => setSelectedWorkplanId(row.id)}
                        >
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                <span className="text-primary text-[10px] font-700">{initials}</span>
                              </div>
                              <div>
                                <p className="font-600 text-foreground">{row.staff_name}</p>
                                <p className="text-muted-foreground text-[11px]">{row.job_title}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-muted-foreground hidden sm:table-cell">{row.department}</td>
                          <td className="px-4 py-3.5 text-muted-foreground hidden md:table-cell">{row.supervisor_name ?? '—'}</td>
                          <td className="px-4 py-3.5">
                            <StatusBadge status={row.status} />
                          </td>
                          <td className="px-4 py-3.5 hidden lg:table-cell">
                            <span className={`inline-flex items-center text-[10px] font-600 px-2 py-0.5 rounded-full ${stageColor}`}>
                              {stageLabel}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-muted-foreground tabular-nums hidden md:table-cell">{updatedDate}</td>
                          <td className="px-4 py-3.5">
                            <button
                              onClick={(e) => { e.stopPropagation(); setSelectedWorkplanId(row.id); }}
                              className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-xs text-primary hover:underline transition-opacity"
                            >
                              <Icon name="EyeIcon" size={13} />
                              View
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {!loading && totalCount > PAGE_SIZE && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-muted/10">
                <span className="text-xs text-muted-foreground">
                  Page {page} of {totalPages} · {totalCount} total
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => fetchWorkplans(page - 1)}
                    disabled={page <= 1}
                    className="p-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <Icon name="ChevronLeftIcon" size={13} />
                  </button>
                  {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
                    const startPage = Math.max(1, Math.min(page - 2, totalPages - 4));
                    const p = startPage + i;
                    if (p > totalPages) return null;
                    return (
                      <button
                        key={p}
                        onClick={() => fetchWorkplans(p)}
                        className={`w-7 h-7 rounded-md text-xs font-600 transition-colors ${
                          p === page ? 'bg-primary text-white' : 'border border-border text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        {p}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => fetchWorkplans(page + 1)}
                    disabled={page >= totalPages}
                    className="p-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <Icon name="ChevronRightIcon" size={13} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedWorkplanId && (
        <WorkplanDetailModal
          workplanId={selectedWorkplanId}
          onClose={() => setSelectedWorkplanId(null)}
        />
      )}
    </AppLayout>
  );
}
