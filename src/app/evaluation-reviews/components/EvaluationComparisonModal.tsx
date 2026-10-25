'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface KpiRatingEntry {
  kpi_id: string;
  kpi_label: string;
  perspective: string;
  target: string;
  self_rating: number | null;
  self_comment: string;
  supervisor_rating: number | null;
  supervisor_comment: string;
}

interface CompetencyRatingEntry {
  competency_id: string;
  competency_name: string;
  self_rating: number | null;
  self_comment: string;
  supervisor_rating: number | null;
  supervisor_comment: string;
}

interface ComparisonRecord {
  id: string;
  staff_id: string;
  review_status: string;
  review_year: number;
  review_period: string;
  self_rating: number | null;
  supervisor_rating: number | null;
  supervisor_comments: string | null;
  approval_comments: string | null;
  rejected_reason: string | null;
  comparison_feedback: string | null;
  rating_variance_notes: string | null;
  kpi_achievements: string | null;
  supervisor_kpi_ratings: KpiRatingEntry[] | null;
  supervisor_competency_ratings: CompetencyRatingEntry[] | null;
  staff?: { full_name: string; job_title: string; departments?: { name: string } | null } | null;
  supervisor?: { full_name: string } | null;
  workplan?: {
    fiscal_year: string;
    perspectives_objectives: PerspectiveRow[];
  } | null;
}

interface PerspectiveRow {
  id: string;
  perspective: string;
  objective: string;
  kpis: string[];
  weight: number;
  target: string;
}

interface EvaluationComparisonModalProps {
  reviewId: string;
  open: boolean;
  onClose: () => void;
  onActionComplete: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const RATING_CONFIG: Record<number, { label: string; color: string; bg: string; border: string }> = {
  5: { label: 'Outstanding',          color: 'text-emerald-700', bg: 'bg-emerald-50',  border: 'border-emerald-300' },
  4: { label: 'Exceeds Expectations', color: 'text-sky-700',     bg: 'bg-sky-50',      border: 'border-sky-300' },
  3: { label: 'Meets Expectations',   color: 'text-blue-700',    bg: 'bg-blue-50',     border: 'border-blue-300' },
  2: { label: 'Needs Improvement',    color: 'text-amber-700',   bg: 'bg-amber-50',    border: 'border-amber-300' },
  1: { label: 'Unsatisfactory',       color: 'text-red-700',     bg: 'bg-red-50',      border: 'border-red-300' },
};

const DEFAULT_COMPETENCIES = [
  { id: 'gc-1', name: 'Communication',                 description: 'Ability to convey information clearly and effectively' },
  { id: 'gc-2', name: 'Teamwork & Collaboration',      description: 'Works cooperatively with others and supports colleagues' },
  { id: 'gc-3', name: 'Initiative & Problem Solving',  description: 'Proactively identifies issues and takes ownership of tasks' },
  { id: 'gc-4', name: 'Professionalism & Work Ethics', description: 'Demonstrates integrity, punctuality, and accountability' },
  { id: 'gc-5', name: 'Adaptability & Learning',       description: 'Embraces change and continuously develops skills' },
];

const PERSPECTIVE_COLORS: Record<string, { badge: string; bar: string }> = {
  'Financial/Stewardship':        { badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', bar: 'bg-emerald-500' },
  'Customer/Stakeholder':         { badge: 'bg-sky-100 text-sky-700 border-sky-200',             bar: 'bg-sky-500' },
  'Internal Business Processes':  { badge: 'bg-violet-100 text-violet-700 border-violet-200',    bar: 'bg-violet-500' },
  'Innovation Learning & Growth': { badge: 'bg-amber-100 text-amber-700 border-amber-200',       bar: 'bg-amber-500' },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function RatingBadge({ value, size = 'md' }: { value: number | null; size?: 'sm' | 'md' }) {
  if (!value) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs text-muted-foreground bg-muted/50 border border-border">
        Not rated
      </span>
    );
  }
  const cfg = RATING_CONFIG[value];
  const sizeClass = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm';
  return (
    <div className="flex items-center gap-2">
      <span className={`${sizeClass} rounded-lg font-700 border-2 flex items-center justify-center ${cfg.bg} ${cfg.color} ${cfg.border}`}>
        {value}
      </span>
      <span className={`text-xs font-600 ${cfg.color}`}>{cfg.label}</span>
    </div>
  );
}

function VarianceBadge({ self, supervisor }: { self: number | null; supervisor: number | null }) {
  if (!self || !supervisor) return null;
  const diff = supervisor - self;
  if (diff === 0) return (
    <span className="inline-flex items-center gap-1 text-[10px] font-600 px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
      <Icon name="MinusIcon" size={10} /> Equal
    </span>
  );
  if (diff > 0) return (
    <span className="inline-flex items-center gap-1 text-[10px] font-600 px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
      <Icon name="ArrowUpIcon" size={10} /> +{diff}
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-600 px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
      <Icon name="ArrowDownIcon" size={10} /> {diff}
    </span>
  );
}

function RatingSelector({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((r) => (
        <button
          key={r}
          type="button"
          disabled={disabled}
          onClick={() => onChange(r)}
          className={`w-8 h-8 rounded-md text-xs font-700 border-2 transition-all ${
            value === r
              ? `${RATING_CONFIG[r].bg} ${RATING_CONFIG[r].color} ${RATING_CONFIG[r].border} shadow-sm scale-105`
              : 'bg-muted/40 border-border text-muted-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed'
          }`}
          title={RATING_CONFIG[r]?.label}
        >
          {r}
        </button>
      ))}
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export default function EvaluationComparisonModal({
  reviewId,
  open,
  onClose,
  onActionComplete,
}: EvaluationComparisonModalProps) {
  const [record, setRecord] = useState<ComparisonRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'kpis' | 'competencies' | 'overall'>('kpis');

  // Editable supervisor fields
  const [kpiRatings, setKpiRatings] = useState<KpiRatingEntry[]>([]);
  const [competencyRatings, setCompetencyRatings] = useState<CompetencyRatingEntry[]>([]);
  const [overallSupervisorRating, setOverallSupervisorRating] = useState<number>(0);
  const [supervisorComments, setSupervisorComments] = useState('');
  const [comparisonFeedback, setComparisonFeedback] = useState('');
  const [approvalComments, setApprovalComments] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [confirmAction, setConfirmAction] = useState<'approve' | 'reject' | null>(null);

  // Stable supabase client ref
  const supabaseRef = useRef(createClient());

  const fetchRecord = useCallback(async () => {
    if (!reviewId) return;
    const supabase = supabaseRef.current;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchErr } = await supabase
        .from('mid_year_reviews')
        .select(`
          id, staff_id, review_status, review_year, review_period,
          self_rating, supervisor_rating, supervisor_comments,
          approval_comments, rejected_reason, comparison_feedback,
          rating_variance_notes, kpi_achievements,
          supervisor_kpi_ratings, supervisor_competency_ratings,
          staff:staff_id (
            full_name, job_title,
            departments:department_id ( name )
          ),
          supervisor:supervisor_id ( full_name ),
          workplan:workplan_id (
            fiscal_year,
            perspectives_objectives
          )
        `)
        .eq('id', reviewId)
        .single();

      if (fetchErr) throw fetchErr;
      setRecord(data as ComparisonRecord);

      // Parse self-assessment sections from kpi_achievements text
      const kpiText = (data as ComparisonRecord).kpi_achievements ?? '';
      const kpiSection = kpiText.split('\n\nCOMPETENCIES:\n')[0] ?? '';
      const competencySection = kpiText.split('\n\nCOMPETENCIES:\n')[1]?.split('\n\nOBJECTIVES:\n')[0] ?? '';

      // Build KPI entries from workplan
      const perspectives: PerspectiveRow[] = (data as any)?.workplan?.perspectives_objectives ?? [];
      const existingKpiRatings: KpiRatingEntry[] = (data as any)?.supervisor_kpi_ratings ?? [];

      const builtKpiRatings: KpiRatingEntry[] = [];
      perspectives.forEach((p) => {
        (p.kpis ?? []).forEach((kpi, idx) => {
          const kpiId = `${p.id}-kpi-${idx}`;
          const existing = existingKpiRatings.find((e) => e.kpi_id === kpiId);
          // Extract self-rating from text if available
          const selfRatingMatch = kpiSection.match(new RegExp(`${kpi}[^\\n]*Rating:\\s*(\\d)`, 'i'));
          const selfRating = selfRatingMatch ? parseInt(selfRatingMatch[1]) : null;
          builtKpiRatings.push({
            kpi_id: kpiId,
            kpi_label: kpi,
            perspective: p.perspective,
            target: p.target ?? '',
            self_rating: selfRating,
            self_comment: '',
            supervisor_rating: existing?.supervisor_rating ?? null,
            supervisor_comment: existing?.supervisor_comment ?? '',
          });
        });
      });
      setKpiRatings(builtKpiRatings);

      // Build competency entries
      const existingCompRatings: CompetencyRatingEntry[] = (data as any)?.supervisor_competency_ratings ?? [];
      const builtCompRatings: CompetencyRatingEntry[] = DEFAULT_COMPETENCIES.map((c) => {
        const existing = existingCompRatings.find((e) => e.competency_id === c.id);
        const selfRatingMatch = competencySection.match(new RegExp(`${c.name}[^\\n]*Rating:\\s*(\\d)`, 'i'));
        const selfRating = selfRatingMatch ? parseInt(selfRatingMatch[1]) : null;
        return {
          competency_id: c.id,
          competency_name: c.name,
          self_rating: selfRating,
          self_comment: '',
          supervisor_rating: existing?.supervisor_rating ?? null,
          supervisor_comment: existing?.supervisor_comment ?? '',
        };
      });
      setCompetencyRatings(builtCompRatings);

      // Pre-fill overall fields
      setOverallSupervisorRating((data as any)?.supervisor_rating ?? 0);
      setSupervisorComments((data as any)?.supervisor_comments ?? '');
      setComparisonFeedback((data as any)?.comparison_feedback ?? '');
      setApprovalComments((data as any)?.approval_comments ?? '');
      setRejectionReason((data as any)?.rejected_reason ?? '');
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load evaluation record.');
    } finally {
      setLoading(false);
    }
  }, [reviewId]);

  useEffect(() => {
    if (open && reviewId) fetchRecord();
  }, [open, reviewId, fetchRecord]);

  if (!open) return null;

  // ── Helpers ──────────────────────────────────────────────────────────────

  function updateKpiSupervisorRating(kpiId: string, rating: number) {
    setKpiRatings((prev) =>
      prev.map((k) => (k.kpi_id === kpiId ? { ...k, supervisor_rating: rating } : k))
    );
  }

  function updateKpiSupervisorComment(kpiId: string, comment: string) {
    setKpiRatings((prev) =>
      prev.map((k) => (k.kpi_id === kpiId ? { ...k, supervisor_comment: comment } : k))
    );
  }

  function updateCompetencySupervisorRating(compId: string, rating: number) {
    setCompetencyRatings((prev) =>
      prev.map((c) => (c.competency_id === compId ? { ...c, supervisor_rating: rating } : c))
    );
  }

  function updateCompetencySupervisorComment(compId: string, comment: string) {
    setCompetencyRatings((prev) =>
      prev.map((c) => (c.competency_id === compId ? { ...c, supervisor_comment: comment } : c))
    );
  }

  // Compute average supervisor rating from KPI ratings
  const computedAvgRating = (() => {
    const rated = kpiRatings.filter((k) => k.supervisor_rating && k.supervisor_rating > 0);
    if (rated.length === 0) return overallSupervisorRating;
    const avg = rated.reduce((sum, k) => sum + (k.supervisor_rating ?? 0), 0) / rated.length;
    return Math.round(avg * 10) / 10;
  })();

  const selfAvgRating = (() => {
    const rated = kpiRatings.filter((k) => k.self_rating && k.self_rating > 0);
    if (rated.length === 0) return record?.self_rating ?? 0;
    const avg = rated.reduce((sum, k) => sum + (k.self_rating ?? 0), 0) / rated.length;
    return Math.round(avg * 10) / 10;
  })();

  // ── Save / Approve / Reject ───────────────────────────────────────────────

  async function handleSave(action?: 'approve' | 'reject') {
    setSaving(true);
    try {
      const finalRating = overallSupervisorRating > 0 ? overallSupervisorRating : (computedAvgRating > 0 ? Math.round(computedAvgRating) : null);

      const updatePayload: Record<string, unknown> = {
        supervisor_kpi_ratings: kpiRatings,
        supervisor_competency_ratings: competencyRatings,
        supervisor_rating: finalRating,
        supervisor_comments: supervisorComments || null,
        comparison_feedback: comparisonFeedback || null,
        supervisor_reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (action === 'approve') {
        updatePayload.review_status = 'approved';
        updatePayload.approval_comments = approvalComments || null;
        updatePayload.approved_at = new Date().toISOString();
        // Advance workplan stage
        if (record?.workplan) {
          await supabaseRef.current
            .from('workplan_settings')
            .update({ workflow_stage: 'mid_year_approved', updated_at: new Date().toISOString() })
            .eq('id', (record as any).workplan_id);
        }
        // Log activity
        await supabaseRef.current.from('activity_logs').insert({
          activity_type: 'evaluation_approved',
          actor_name: record?.supervisor?.full_name ?? 'Supervisor',
          action_description: `Approved mid-year evaluation for ${record?.staff?.full_name}`,
          subject_name: record?.staff?.full_name,
          subject_detail: `${record?.review_year} ${record?.review_period}`,
          icon_name: 'CheckCircleIcon',
          icon_bg: 'bg-emerald-50',
          icon_color: 'text-emerald-600',
        });
      } else if (action === 'reject') {
        updatePayload.review_status = 'rejected';
        updatePayload.rejected_reason = rejectionReason || null;
        // Log activity
        await supabaseRef.current.from('activity_logs').insert({
          activity_type: 'evaluation_rejected',
          actor_name: record?.supervisor?.full_name ?? 'Supervisor',
          action_description: `Rejected mid-year evaluation for ${record?.staff?.full_name}`,
          subject_name: record?.staff?.full_name,
          subject_detail: rejectionReason,
          icon_name: 'XCircleIcon',
          icon_bg: 'bg-rose-50',
          icon_color: 'text-rose-600',
        });
      } else {
        updatePayload.review_status = 'reviewed';
      }

      const { error: updateErr } = await supabaseRef.current
        .from('mid_year_reviews')
        .update(updatePayload)
        .eq('id', reviewId);

      if (updateErr) throw updateErr;

      onActionComplete();
      onClose();
    } catch (err: any) {
      setError(err?.message ?? 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
      setConfirmAction(null);
    }
  }

  const canApproveReject = record?.review_status === 'submitted' || record?.review_status === 'reviewed';

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[94vh] flex flex-col">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-xl">
              <Icon name="ScaleIcon" size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="font-700 text-foreground text-base">Evaluation Comparison</h2>
              {record && (
                <p className="text-xs text-muted-foreground">
                  {record.staff?.full_name} · {record.staff?.job_title} · {record.review_year} {record.review_period === 'mid-year' ? 'Mid-Year' : 'End-Year'}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {record && (
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-600 border ${
                record.review_status === 'approved' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                record.review_status === 'rejected' ? 'bg-rose-50 border-rose-200 text-rose-700' :
                record.review_status === 'reviewed' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                record.review_status === 'submitted'? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-slate-100 border-slate-200 text-slate-600'
              }`}>
                {record.review_status.charAt(0).toUpperCase() + record.review_status.slice(1)}
              </span>
            )}
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
              <Icon name="XMarkIcon" size={18} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3">
              <Icon name="ArrowPathIcon" size={28} className="text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">Loading evaluation data…</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3">
              <Icon name="ExclamationTriangleIcon" size={28} className="text-red-500" />
              <p className="text-sm font-600 text-red-700">{error}</p>
              <button onClick={fetchRecord} className="text-xs text-primary hover:underline">Retry</button>
            </div>
          </div>
        ) : record ? (
          <>
            {/* ── Overall Score Banner ── */}
            <div className="px-6 py-4 bg-muted/20 border-b border-border flex-shrink-0">
              <div className="grid grid-cols-3 gap-4">
                {/* Staff Self Rating */}
                <div className="bg-sky-50 border border-sky-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-sky-200 flex items-center justify-center">
                      <Icon name="UserIcon" size={12} className="text-sky-700" />
                    </div>
                    <p className="text-[11px] font-700 text-sky-700 uppercase tracking-wider">Staff Self-Rating</p>
                  </div>
                  <p className="text-3xl font-700 text-sky-800 tabular-nums font-mono">
                    {selfAvgRating > 0 ? selfAvgRating.toFixed(1) : (record.self_rating ?? '—')}
                    <span className="text-base font-500 ml-1 text-sky-600">/5.0</span>
                  </p>
                  {(record.self_rating ?? 0) > 0 && (
                    <p className="text-xs text-sky-600 mt-1">{RATING_CONFIG[Math.round(record.self_rating ?? 0)]?.label}</p>
                  )}
                </div>

                {/* Variance */}
                <div className="bg-white border border-border rounded-xl p-4 flex flex-col items-center justify-center">
                  <p className="text-[11px] font-700 text-muted-foreground uppercase tracking-wider mb-2">Rating Variance</p>
                  {(record.self_rating ?? 0) > 0 && computedAvgRating > 0 ? (
                    <>
                      <VarianceBadge self={record.self_rating} supervisor={Math.round(computedAvgRating)} />
                      <p className="text-[10px] text-muted-foreground mt-2 text-center">
                        {Math.abs(computedAvgRating - (record.self_rating ?? 0)).toFixed(1)} point difference
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">Pending supervisor ratings</p>
                  )}
                </div>

                {/* Supervisor Rating */}
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                      <Icon name="StarIcon" size={12} className="text-primary" />
                    </div>
                    <p className="text-[11px] font-700 text-primary uppercase tracking-wider">Supervisor Rating</p>
                  </div>
                  <p className="text-3xl font-700 text-primary tabular-nums font-mono">
                    {computedAvgRating > 0 ? computedAvgRating.toFixed(1) : '—'}
                    <span className="text-base font-500 ml-1 text-primary/60">/5.0</span>
                  </p>
                  {computedAvgRating > 0 && (
                    <p className="text-xs text-primary/70 mt-1">{RATING_CONFIG[Math.round(computedAvgRating)]?.label}</p>
                  )}
                </div>
              </div>
            </div>

            {/* ── Tabs ── */}
            <div className="flex border-b border-border px-6 flex-shrink-0">
              {([
                { key: 'kpis',          label: 'KPI Comparison',         icon: 'ChartBarIcon' },
                { key: 'competencies',  label: 'Competency Comparison',  icon: 'AcademicCapIcon' },
                { key: 'overall',       label: 'Overall Feedback',       icon: 'ChatBubbleLeftRightIcon' },
              ] as const).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-600 border-b-2 transition-colors -mb-px ${
                    activeTab === tab.key
                      ? 'border-primary text-primary' :'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon name={tab.icon as Parameters<typeof Icon>[0]['name']} size={14} />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ── Tab Content ── */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

              {/* KPI Comparison Tab */}
              {activeTab === 'kpis' && (
                <div className="space-y-3">
                  {kpiRatings.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-12 text-center">
                      <Icon name="ClipboardDocumentListIcon" size={32} className="text-muted-foreground" />
                      <p className="text-sm font-600 text-foreground">No KPIs found</p>
                      <p className="text-xs text-muted-foreground">No workplan KPIs are linked to this evaluation.</p>
                    </div>
                  ) : (
                    kpiRatings.map((kpi) => {
                      const perspColor = PERSPECTIVE_COLORS[kpi.perspective] ?? { badge: 'bg-slate-100 text-slate-700 border-slate-200', bar: 'bg-slate-400' };
                      return (
                        <div key={kpi.kpi_id} className="border border-border rounded-xl overflow-hidden">
                          {/* KPI Header */}
                          <div className="flex items-start justify-between gap-3 px-4 py-3 bg-muted/20">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-600 text-foreground leading-snug">{kpi.kpi_label}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`text-[10px] font-600 px-2 py-0.5 rounded-full border ${perspColor.badge}`}>
                                  {kpi.perspective}
                                </span>
                                {kpi.target && (
                                  <span className="text-[10px] text-muted-foreground">Target: {kpi.target}</span>
                                )}
                              </div>
                            </div>
                            <VarianceBadge self={kpi.self_rating} supervisor={kpi.supervisor_rating} />
                          </div>

                          {/* Side-by-side ratings */}
                          <div className="grid grid-cols-2 divide-x divide-border">
                            {/* Staff Self */}
                            <div className="p-4 bg-sky-50/30">
                              <p className="text-[10px] font-700 text-sky-700 uppercase tracking-wider mb-2 flex items-center gap-1">
                                <Icon name="UserIcon" size={10} /> Staff Self-Rating
                              </p>
                              <RatingBadge value={kpi.self_rating} />
                              {kpi.self_comment && (
                                <p className="text-xs text-muted-foreground mt-2 leading-relaxed italic">"{kpi.self_comment}"</p>
                              )}
                            </div>

                            {/* Supervisor */}
                            <div className="p-4">
                              <p className="text-[10px] font-700 text-primary uppercase tracking-wider mb-2 flex items-center gap-1">
                                <Icon name="StarIcon" size={10} /> Supervisor Rating
                              </p>
                              <RatingSelector
                                value={kpi.supervisor_rating ?? 0}
                                onChange={(v) => updateKpiSupervisorRating(kpi.kpi_id, v)}
                                disabled={record.review_status === 'approved' || record.review_status === 'rejected'}
                              />
                              <textarea
                                value={kpi.supervisor_comment}
                                onChange={(e) => updateKpiSupervisorComment(kpi.kpi_id, e.target.value)}
                                disabled={record.review_status === 'approved' || record.review_status === 'rejected'}
                                placeholder="Add supervisor comment for this KPI…"
                                rows={2}
                                className="mt-2 w-full text-xs border border-border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none placeholder:text-muted-foreground/60 disabled:bg-muted/30 disabled:cursor-not-allowed"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* Competency Comparison Tab */}
              {activeTab === 'competencies' && (
                <div className="space-y-3">
                  {competencyRatings.map((comp) => (
                    <div key={comp.competency_id} className="border border-border rounded-xl overflow-hidden">
                      <div className="px-4 py-3 bg-muted/20">
                        <p className="text-sm font-600 text-foreground">{comp.competency_name}</p>
                      </div>
                      <div className="grid grid-cols-2 divide-x divide-border">
                        {/* Staff Self */}
                        <div className="p-4 bg-sky-50/30">
                          <p className="text-[10px] font-700 text-sky-700 uppercase tracking-wider mb-2 flex items-center gap-1">
                            <Icon name="UserIcon" size={10} /> Staff Self-Rating
                          </p>
                          <RatingBadge value={comp.self_rating} />
                        </div>

                        {/* Supervisor */}
                        <div className="p-4">
                          <p className="text-[10px] font-700 text-primary uppercase tracking-wider mb-2 flex items-center gap-1">
                            <Icon name="StarIcon" size={10} /> Supervisor Rating
                          </p>
                          <RatingSelector
                            value={comp.supervisor_rating ?? 0}
                            onChange={(v) => updateCompetencySupervisorRating(comp.competency_id, v)}
                            disabled={record.review_status === 'approved' || record.review_status === 'rejected'}
                          />
                          <textarea
                            value={comp.supervisor_comment}
                            onChange={(e) => updateCompetencySupervisorComment(comp.competency_id, e.target.value)}
                            disabled={record.review_status === 'approved' || record.review_status === 'rejected'}
                            placeholder="Add supervisor comment…"
                            rows={2}
                            className="mt-2 w-full text-xs border border-border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none placeholder:text-muted-foreground/60 disabled:bg-muted/30 disabled:cursor-not-allowed"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Overall Feedback Tab */}
              {activeTab === 'overall' && (
                <div className="space-y-5">
                  {/* Overall Supervisor Rating */}
                  <div className="border border-border rounded-xl p-5">
                    <h4 className="text-sm font-700 text-foreground mb-3 flex items-center gap-2">
                      <Icon name="StarIcon" size={16} className="text-primary" />
                      Overall Supervisor Rating
                    </h4>
                    <div className="flex items-center gap-4">
                      <RatingSelector
                        value={overallSupervisorRating}
                        onChange={setOverallSupervisorRating}
                        disabled={record.review_status === 'approved' || record.review_status === 'rejected'}
                      />
                      {overallSupervisorRating > 0 && (
                        <span className={`text-sm font-600 ${RATING_CONFIG[overallSupervisorRating]?.color}`}>
                          {RATING_CONFIG[overallSupervisorRating]?.label}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Auto-computed from KPI ratings: <span className="font-600 text-foreground">{computedAvgRating > 0 ? computedAvgRating.toFixed(1) : '—'}</span>
                      {' '}· Override with manual rating above if needed.
                    </p>
                  </div>

                  {/* Supervisor Comments */}
                  <div className="border border-border rounded-xl p-5">
                    <h4 className="text-sm font-700 text-foreground mb-3 flex items-center gap-2">
                      <Icon name="ChatBubbleLeftRightIcon" size={16} className="text-primary" />
                      Supervisor Narrative Feedback
                    </h4>
                    <textarea
                      value={supervisorComments}
                      onChange={(e) => setSupervisorComments(e.target.value)}
                      disabled={record.review_status === 'approved' || record.review_status === 'rejected'}
                      placeholder="Provide overall narrative feedback on the staff member's performance, strengths, and areas for development…"
                      rows={4}
                      className="w-full text-sm border border-border rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none placeholder:text-muted-foreground/60 disabled:bg-muted/30 disabled:cursor-not-allowed"
                    />
                  </div>

                  {/* Comparison Feedback */}
                  <div className="border border-border rounded-xl p-5">
                    <h4 className="text-sm font-700 text-foreground mb-3 flex items-center gap-2">
                      <Icon name="ScaleIcon" size={16} className="text-primary" />
                      Rating Variance Notes
                    </h4>
                    <textarea
                      value={comparisonFeedback}
                      onChange={(e) => setComparisonFeedback(e.target.value)}
                      disabled={record.review_status === 'approved' || record.review_status === 'rejected'}
                      placeholder="Note any significant differences between self-ratings and supervisor ratings, and explain the rationale…"
                      rows={3}
                      className="w-full text-sm border border-border rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none placeholder:text-muted-foreground/60 disabled:bg-muted/30 disabled:cursor-not-allowed"
                    />
                  </div>

                  {/* Staff Self-Assessment Summary */}
                  {record.kpi_achievements && (
                    <div className="border border-sky-200 bg-sky-50/40 rounded-xl p-5">
                      <h4 className="text-sm font-700 text-sky-800 mb-3 flex items-center gap-2">
                        <Icon name="UserIcon" size={16} className="text-sky-600" />
                        Staff Self-Assessment Summary
                      </h4>
                      <p className="text-xs text-sky-900 leading-relaxed whitespace-pre-wrap">
                        {record.kpi_achievements.slice(0, 600)}{record.kpi_achievements.length > 600 ? '…' : ''}
                      </p>
                    </div>
                  )}

                  {/* Approval / Rejection section */}
                  {canApproveReject && (
                    <div className="border border-border rounded-xl p-5 space-y-4">
                      <h4 className="text-sm font-700 text-foreground flex items-center gap-2">
                        <Icon name="ClipboardDocumentCheckIcon" size={16} className="text-primary" />
                        Approval Decision
                      </h4>

                      {/* Approval comments */}
                      <div>
                        <label className="text-xs font-600 text-foreground mb-1.5 block">
                          Approval Comments <span className="text-muted-foreground font-400">(required to approve)</span>
                        </label>
                        <textarea
                          value={approvalComments}
                          onChange={(e) => setApprovalComments(e.target.value)}
                          placeholder="Provide approval comments and any final remarks for the staff member…"
                          rows={3}
                          className="w-full text-sm border border-border rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none placeholder:text-muted-foreground/60"
                        />
                      </div>

                      {/* Rejection reason */}
                      <div>
                        <label className="text-xs font-600 text-foreground mb-1.5 block">
                          Rejection Reason <span className="text-muted-foreground font-400">(required to reject)</span>
                        </label>
                        <textarea
                          value={rejectionReason}
                          onChange={(e) => setRejectionReason(e.target.value)}
                          placeholder="Explain why this evaluation is being rejected and what needs to be corrected…"
                          rows={3}
                          className="w-full text-sm border border-border rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none placeholder:text-muted-foreground/60"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Confirm Dialog ── */}
            {confirmAction && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 rounded-2xl">
                <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm mx-4 space-y-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto ${
                    confirmAction === 'approve' ? 'bg-emerald-100' : 'bg-rose-100'
                  }`}>
                    <Icon
                      name={confirmAction === 'approve' ? 'CheckCircleIcon' : 'XCircleIcon'}
                      size={24}
                      className={confirmAction === 'approve' ? 'text-emerald-600' : 'text-rose-600'}
                    />
                  </div>
                  <div className="text-center">
                    <h3 className="font-700 text-foreground">
                      {confirmAction === 'approve' ? 'Approve Evaluation?' : 'Reject Evaluation?'}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {confirmAction === 'approve' ?'This will approve the evaluation and advance the workflow stage.' :'This will reject the evaluation and notify the staff member.'}
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setConfirmAction(null)}
                      className="flex-1 px-4 py-2 text-sm font-600 text-muted-foreground border border-border rounded-lg hover:bg-muted transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleSave(confirmAction)}
                      disabled={saving}
                      className={`flex-1 px-4 py-2 text-sm font-600 text-white rounded-lg transition-all active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2 ${
                        confirmAction === 'approve' ?'bg-emerald-600 hover:bg-emerald-700' :'bg-rose-600 hover:bg-rose-700'
                      }`}
                    >
                      {saving ? <Icon name="ArrowPathIcon" size={14} className="animate-spin" /> : null}
                      {confirmAction === 'approve' ? 'Confirm Approve' : 'Confirm Reject'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Footer Actions ── */}
            <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-border flex-shrink-0 bg-muted/10">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-600 text-muted-foreground border border-border rounded-lg hover:bg-muted transition-colors"
              >
                Close
              </button>

              <div className="flex items-center gap-2">
                {/* Save Review (no final decision) */}
                {canApproveReject && (
                  <button
                    onClick={() => handleSave()}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-600 text-foreground border border-border rounded-lg hover:bg-muted transition-all active:scale-95 disabled:opacity-60"
                  >
                    {saving ? <Icon name="ArrowPathIcon" size={14} className="animate-spin" /> : <Icon name="BookmarkIcon" size={14} />}
                    Save Review
                  </button>
                )}

                {/* Reject */}
                {canApproveReject && (
                  <button
                    onClick={() => {
                      if (!rejectionReason.trim()) {
                        setActiveTab('overall');
                        return;
                      }
                      setConfirmAction('reject');
                    }}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-600 text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 transition-all active:scale-95 disabled:opacity-60"
                  >
                    <Icon name="XCircleIcon" size={14} />
                    Reject
                  </button>
                )}

                {/* Approve */}
                {canApproveReject && (
                  <button
                    onClick={() => {
                      if (!approvalComments.trim()) {
                        setActiveTab('overall');
                        return;
                      }
                      setConfirmAction('approve');
                    }}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-600 text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-60"
                  >
                    <Icon name="CheckCircleIcon" size={14} />
                    Approve
                  </button>
                )}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
