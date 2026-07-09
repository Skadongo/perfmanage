'use client';

import React, { useState, useEffect, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

type ReviewStatus = 'draft' | 'submitted' | 'reviewed' | 'approved' | 'rejected';

interface SelfAssessmentRecord {
  id: string;
  staff_id: string;
  supervisor_id: string | null;
  workplan_id: string | null;
  review_status: ReviewStatus;
  review_year: number;
  review_period: string;
  kpi_achievements: string | null;
  challenges_faced: string | null;
  support_needed: string | null;
  self_rating: number | null;
  supervisor_comments: string | null;
  supervisor_rating: number | null;
  supervisor_reviewed_at: string | null;
  approval_comments: string | null;
  approved_at: string | null;
  submitted_at: string | null;
  rejected_reason: string | null;
  stage_approval_comments: string | null;
  stage_approved_at: string | null;
  staff?: {
    full_name: string;
    job_title: string;
    departments?: { name: string } | null;
  } | null;
  supervisor?: { full_name: string } | null;
  workplan?: {
    fiscal_year: string;
    perspectives_objectives: PerspectiveRow[];
    general_competencies: GeneralCompetency[];
  } | null;
}

interface PerspectiveRow {
  id: string;
  perspective: string;
  objective: string;
  kpis: string[];
  weight: number;
  target: string;
  keyActivities?: string;
}

interface GeneralCompetency {
  id: string;
  name: string;
  description: string;
  weight: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const RATING_CONFIG: Record<number, { label: string; color: string; bg: string }> = {
  5: { label: 'Outstanding',          color: 'text-emerald-700', bg: 'bg-emerald-100 border-emerald-300' },
  4: { label: 'Exceeds Expectations', color: 'text-sky-700',     bg: 'bg-sky-100 border-sky-300' },
  3: { label: 'Meets Expectations',   color: 'text-blue-700',    bg: 'bg-blue-100 border-blue-300' },
  2: { label: 'Needs Improvement',    color: 'text-amber-700',   bg: 'bg-amber-100 border-amber-300' },
  1: { label: 'Unsatisfactory',       color: 'text-red-700',     bg: 'bg-red-100 border-red-300' },
};

const STATUS_CONFIG: Record<ReviewStatus, { label: string; color: string; bg: string; icon: string }> = {
  draft:     { label: 'Draft',     color: 'text-slate-600',   bg: 'bg-slate-100 border-slate-200',    icon: 'DocumentTextIcon' },
  submitted: { label: 'Submitted', color: 'text-blue-700',    bg: 'bg-blue-50 border-blue-200',       icon: 'ClipboardDocumentCheckIcon' },
  reviewed:  { label: 'Reviewed',  color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200',     icon: 'EyeIcon' },
  approved:  { label: 'Approved',  color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: 'CheckCircleIcon' },
  rejected:  { label: 'Rejected',  color: 'text-rose-700',    bg: 'bg-rose-50 border-rose-200',       icon: 'XCircleIcon' },
};

const PERSPECTIVE_COLORS: Record<string, { border: string; bg: string; badge: string }> = {
  'Financial/Stewardship':        { border: 'border-emerald-200', bg: 'bg-emerald-50/40', badge: 'bg-emerald-100 text-emerald-700' },
  'Customer/Stakeholder':         { border: 'border-sky-200',     bg: 'bg-sky-50/40',     badge: 'bg-sky-100 text-sky-700' },
  'Internal Business Processes':  { border: 'border-violet-200',  bg: 'bg-violet-50/40',  badge: 'bg-violet-100 text-violet-700' },
  'Innovation Learning & Growth': { border: 'border-amber-200',   bg: 'bg-amber-50/40',   badge: 'bg-amber-100 text-amber-700' },
};

const DEFAULT_COMPETENCIES: GeneralCompetency[] = [
  { id: 'gc-1', name: 'Communication',                description: 'Ability to convey information clearly and effectively', weight: 4 },
  { id: 'gc-2', name: 'Teamwork & Collaboration',     description: 'Works cooperatively with others and supports colleagues', weight: 4 },
  { id: 'gc-3', name: 'Initiative & Problem Solving', description: 'Proactively identifies issues and takes ownership of tasks', weight: 4 },
  { id: 'gc-4', name: 'Professionalism & Work Ethics',description: 'Demonstrates integrity, punctuality, and accountability', weight: 4 },
  { id: 'gc-5', name: 'Adaptability & Learning',      description: 'Embraces change and continuously develops skills', weight: 4 },
];

const inputCls = 'w-full text-sm border border-border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors placeholder:text-muted-foreground/60';
const textareaCls = inputCls + ' resize-none';

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ReviewStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-600 border ${cfg.bg} ${cfg.color}`}>
      <Icon name={cfg.icon as Parameters<typeof Icon>[0]['name']} size={12} />
      {cfg.label}
    </span>
  );
}

function RatingSelector({ value, onChange, disabled }: { value: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((r) => (
          <button
            key={r}
            type="button"
            disabled={disabled}
            onClick={() => onChange(r)}
            className={`w-10 h-10 rounded-lg text-sm font-700 border-2 transition-all ${
              value === r
                ? RATING_CONFIG[r].bg + ' shadow-sm scale-105'
                : 'bg-muted/40 border-border text-muted-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed'
            }`}
            title={RATING_CONFIG[r]?.label}
          >
            {r}
          </button>
        ))}
      </div>
      {value > 0 && (
        <span className={`text-[10px] font-600 px-2 py-0.5 rounded-full border inline-block w-fit ${RATING_CONFIG[value]?.bg} ${RATING_CONFIG[value]?.color}`}>
          {RATING_CONFIG[value]?.label}
        </span>
      )}
    </div>
  );
}

function SelfRatingDisplay({ value }: { value: number | null }) {
  if (!value) return <span className="text-xs text-muted-foreground">Not rated</span>;
  const cfg = RATING_CONFIG[value];
  return (
    <div className="flex items-center gap-2">
      <span className={`w-8 h-8 rounded-lg text-sm font-700 border-2 flex items-center justify-center ${cfg.bg} ${cfg.color}`}>{value}</span>
      <span className={`text-xs font-600 ${cfg.color}`}>{cfg.label}</span>
    </div>
  );
}

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-500
      ${type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
      <Icon name={type === 'success' ? 'CheckCircleIcon' : 'XCircleIcon'} size={18} />
      {message}
      <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100">
        <Icon name="XMarkIcon" size={14} />
      </button>
    </div>
  );
}

// ─── Review Detail Modal ──────────────────────────────────────────────────────

interface ReviewDetailModalProps {
  review: SelfAssessmentRecord;
  onClose: () => void;
  onSave: (id: string, data: Record<string, unknown>, action: 'review' | 'approve' | 'reject') => Promise<void>;
}

function ReviewDetailModal({ review, onClose, onSave }: ReviewDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'self-assessment' | 'manager-review'>('self-assessment');
  const [managerRating, setManagerRating] = useState<number>(review.supervisor_rating || 0);
  const [managerComments, setManagerComments] = useState(review.supervisor_comments || '');
  const [approvalComments, setApprovalComments] = useState(review.approval_comments || '');
  const [rejectionReason, setRejectionReason] = useState(review.rejected_reason || '');
  const [saving, setSaving] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'approve' | 'reject' | null>(null);

  const perspectives = review.workplan?.perspectives_objectives || [];
  const competencies = review.workplan?.general_competencies?.length
    ? review.workplan.general_competencies
    : DEFAULT_COMPETENCIES;

  // Parse self-assessment text sections
  const kpiSection = review.kpi_achievements?.split('\n\nCOMPETENCIES:\n')[0] || '';
  const competencySection = review.kpi_achievements?.split('\n\nCOMPETENCIES:\n')[1]?.split('\n\nOBJECTIVES:\n')[0] || '';
  const objectiveSection = review.kpi_achievements?.split('\n\nOBJECTIVES:\n')[1] || '';

  async function handleAction(action: 'review' | 'approve' | 'reject') {
    if (action === 'approve' && !approvalComments.trim()) return;
    if (action === 'reject' && !rejectionReason.trim()) return;
    setSaving(true);
    try {
      await onSave(review.id, {
        supervisor_rating: managerRating || null,
        supervisor_comments: managerComments || null,
        approval_comments: approvalComments || null,
        rejected_reason: rejectionReason || null,
      }, action);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const canApproveReject = review.review_status === 'submitted' || review.review_status === 'reviewed';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-xl">
              <Icon name="ClipboardDocumentCheckIcon" size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="font-700 text-foreground text-base">Manager Review</h2>
              <p className="text-xs text-muted-foreground">
                {review.staff?.full_name} · {review.staff?.job_title} · {review.review_year} {review.review_period === 'mid-year' ? 'Mid-Year' : 'End-Year'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={review.review_status} />
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
              <Icon name="XMarkIcon" size={18} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border px-6 flex-shrink-0">
          {([
            { key: 'self-assessment', label: 'Staff Self-Assessment', icon: 'ClipboardDocumentListIcon' },
            { key: 'manager-review',  label: 'Manager Rating & Feedback', icon: 'StarIcon' },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-600 border-b-2 transition-colors -mb-px ${
                activeTab === tab.key
                  ? 'border-primary text-primary' :'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon name={tab.icon as Parameters<typeof Icon>[0]['name']} size={15} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* ── Tab: Self-Assessment ─────────────────────────────────────── */}
          {activeTab === 'self-assessment' && (
            <div className="space-y-6">

              {/* Staff info card */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-xl border border-border">
                {[
                  { label: 'Staff Member', value: review.staff?.full_name || '—' },
                  { label: 'Department',   value: review.staff?.departments?.name || '—' },
                  { label: 'Supervisor',   value: review.supervisor?.full_name || '—' },
                  { label: 'Self-Rating',  value: null, rating: review.self_rating },
                ].map(({ label, value, rating }) => (
                  <div key={label}>
                    <p className="text-[10px] font-700 uppercase tracking-wide text-muted-foreground mb-1">{label}</p>
                    {rating !== undefined ? (
                      <SelfRatingDisplay value={rating ?? null} />
                    ) : (
                      <p className="text-sm font-600 text-foreground">{value}</p>
                    )}
                  </div>
                ))}
              </div>

              {/* Submission meta */}
              {review.submitted_at && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Icon name="ClockIcon" size={13} />
                  Submitted on {new Date(review.submitted_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
              )}

              {/* KPI Achievements */}
              {kpiSection && (
                <div>
                  <h3 className="text-sm font-700 text-foreground mb-3 flex items-center gap-2">
                    <Icon name="ChartBarIcon" size={15} className="text-primary" />
                    KPI Self-Assessment
                  </h3>
                  {perspectives.length > 0 ? (
                    <div className="space-y-3">
                      {perspectives.map((row) => {
                        const pc = PERSPECTIVE_COLORS[row.perspective] || PERSPECTIVE_COLORS['Financial/Stewardship'];
                        const lines = kpiSection.split('\n').filter((l) => l.includes(row.objective));
                        const ratingMatch = lines[0]?.match(/Rating: (\d)\/5/);
                        const achievementMatch = lines[0]?.match(/Achievement: ([^|]+)/);
                        const commentMatch = lines[0]?.match(/Comment: (.+)$/);
                        return (
                          <div key={row.id} className={`rounded-xl border-2 p-4 ${pc.border} ${pc.bg}`}>
                            <div className="flex flex-wrap items-start gap-2 mb-2">
                              <span className={`text-[10px] font-700 px-2 py-0.5 rounded-full ${pc.badge}`}>{row.perspective}</span>
                              <span className="text-[10px] font-500 px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Weight: {row.weight}%</span>
                            </div>
                            <p className="text-sm font-600 text-foreground mb-1">{row.objective}</p>
                            <p className="text-xs text-muted-foreground mb-3"><span className="font-500">Target:</span> {row.target || '—'}</p>
                            {row.kpis?.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mb-3">
                                {row.kpis.map((kpi) => (
                                  <span key={kpi} className="text-[10px] px-2 py-0.5 rounded-full bg-white border border-border text-foreground">{kpi}</span>
                                ))}
                              </div>
                            )}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
                              {achievementMatch?.[1] && (
                                <div className="sm:col-span-2">
                                  <p className="text-[10px] font-700 uppercase tracking-wide text-muted-foreground mb-1">Achievement</p>
                                  <p className="text-xs text-foreground">{achievementMatch[1].trim()}</p>
                                </div>
                              )}
                              {ratingMatch?.[1] && (
                                <div>
                                  <p className="text-[10px] font-700 uppercase tracking-wide text-muted-foreground mb-1">Self-Rating</p>
                                  <SelfRatingDisplay value={parseInt(ratingMatch[1])} />
                                </div>
                              )}
                              {commentMatch?.[1] && (
                                <div className="sm:col-span-3">
                                  <p className="text-[10px] font-700 uppercase tracking-wide text-muted-foreground mb-1">Narrative Comment</p>
                                  <p className="text-xs text-foreground italic">{commentMatch[1].trim()}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="bg-muted/30 rounded-xl p-4 border border-border">
                      <pre className="text-xs text-foreground whitespace-pre-wrap font-sans leading-relaxed">{kpiSection}</pre>
                    </div>
                  )}
                </div>
              )}

              {/* Competencies */}
              {competencySection && (
                <div>
                  <h3 className="text-sm font-700 text-foreground mb-3 flex items-center gap-2">
                    <Icon name="AcademicCapIcon" size={15} className="text-primary" />
                    General Competencies
                  </h3>
                  <div className="space-y-3">
                    {competencies.map((comp) => {
                      const lines = competencySection.split('\n').filter((l) => l.includes(comp.name));
                      const ratingMatch = lines[0]?.match(/Rating: (\d)\/5/);
                      const evidenceMatch = lines[0]?.match(/Evidence: ([^|]+)/);
                      const commentMatch = lines[0]?.match(/Comment: (.+)$/);
                      return (
                        <div key={comp.id} className="rounded-xl border border-border p-4 bg-white">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div>
                              <p className="text-sm font-600 text-foreground">{comp.name}</p>
                              <p className="text-xs text-muted-foreground">{comp.description}</p>
                            </div>
                            {ratingMatch?.[1] && <SelfRatingDisplay value={parseInt(ratingMatch[1])} />}
                          </div>
                          {evidenceMatch?.[1] && (
                            <div className="mt-2">
                              <p className="text-[10px] font-700 uppercase tracking-wide text-muted-foreground mb-1">Evidence</p>
                              <p className="text-xs text-foreground">{evidenceMatch[1].trim()}</p>
                            </div>
                          )}
                          {commentMatch?.[1] && (
                            <div className="mt-2">
                              <p className="text-[10px] font-700 uppercase tracking-wide text-muted-foreground mb-1">Comment</p>
                              <p className="text-xs text-foreground italic">{commentMatch[1].trim()}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Objectives */}
              {objectiveSection && (
                <div>
                  <h3 className="text-sm font-700 text-foreground mb-3 flex items-center gap-2">
                    <Icon name="FlagIcon" size={15} className="text-primary" />
                    Objectives & Goals
                  </h3>
                  <div className="bg-muted/30 rounded-xl p-4 border border-border">
                    <pre className="text-xs text-foreground whitespace-pre-wrap font-sans leading-relaxed">{objectiveSection}</pre>
                  </div>
                </div>
              )}

              {/* Challenges & Support */}
              {(review.challenges_faced || review.support_needed) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {review.challenges_faced && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
                      <p className="text-xs font-700 text-amber-700 mb-2 flex items-center gap-1.5">
                        <Icon name="ExclamationTriangleIcon" size={13} />
                        Challenges Faced
                      </p>
                      <p className="text-xs text-foreground leading-relaxed">{review.challenges_faced}</p>
                    </div>
                  )}
                  {review.support_needed && (
                    <div className="rounded-xl border border-sky-200 bg-sky-50/40 p-4">
                      <p className="text-xs font-700 text-sky-700 mb-2 flex items-center gap-1.5">
                        <Icon name="HandRaisedIcon" size={13} />
                        Support Needed
                      </p>
                      <p className="text-xs text-foreground leading-relaxed">{review.support_needed}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Tab: Manager Review ──────────────────────────────────────── */}
          {activeTab === 'manager-review' && (
            <div className="space-y-6">

              {/* Previous manager review (if any) */}
              {review.supervisor_reviewed_at && (
                <div className="rounded-xl border border-border bg-muted/20 p-4">
                  <p className="text-xs font-700 text-muted-foreground uppercase tracking-wide mb-3">Previous Manager Review</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-1">Manager Rating</p>
                      <SelfRatingDisplay value={review.supervisor_rating ?? null} />
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-1">Reviewed On</p>
                      <p className="text-xs font-600 text-foreground">
                        {new Date(review.supervisor_reviewed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    {review.supervisor_comments && (
                      <div className="col-span-2">
                        <p className="text-[10px] text-muted-foreground mb-1">Manager Comments</p>
                        <p className="text-xs text-foreground leading-relaxed">{review.supervisor_comments}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Manager Rating */}
              <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-5">
                <h3 className="text-sm font-700 text-foreground mb-1 flex items-center gap-2">
                  <Icon name="StarIcon" size={15} className="text-primary" />
                  Overall Manager Rating
                </h3>
                <p className="text-xs text-muted-foreground mb-4">
                  Provide your overall performance rating for this staff member based on the self-assessment submitted.
                </p>
                <RatingSelector
                  value={managerRating}
                  onChange={setManagerRating}
                  disabled={!canApproveReject}
                />
              </div>

              {/* Narrative Feedback */}
              <div>
                <label className="block text-sm font-600 text-foreground mb-1.5">
                  Narrative Feedback <span className="text-muted-foreground font-400">(required for approval)</span>
                </label>
                <p className="text-xs text-muted-foreground mb-2">
                  Provide detailed feedback on the staff member's performance, strengths, areas for improvement, and development recommendations.
                </p>
                <textarea
                  rows={5}
                  value={managerComments}
                  onChange={(e) => setManagerComments(e.target.value)}
                  disabled={!canApproveReject}
                  placeholder="Describe the staff member's overall performance, key achievements, areas for growth, and any specific feedback on their self-assessment…"
                  className={textareaCls}
                />
              </div>

              {/* Approval Comments */}
              <div>
                <label className="block text-sm font-600 text-foreground mb-1.5">
                  Approval Comments <span className="text-rose-500">*</span>
                </label>
                <p className="text-xs text-muted-foreground mb-2">
                  Required when approving. Summarise your decision and any conditions or next steps.
                </p>
                <textarea
                  rows={3}
                  value={approvalComments}
                  onChange={(e) => setApprovalComments(e.target.value)}
                  disabled={!canApproveReject}
                  placeholder="Summarise your approval decision and any follow-up actions…"
                  className={textareaCls}
                />
              </div>

              {/* Rejection Reason */}
              <div>
                <label className="block text-sm font-600 text-foreground mb-1.5">
                  Rejection Reason <span className="text-muted-foreground font-400">(required if rejecting)</span>
                </label>
                <p className="text-xs text-muted-foreground mb-2">
                  If rejecting, clearly state the reason and what the staff member needs to address before resubmitting.
                </p>
                <textarea
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  disabled={!canApproveReject}
                  placeholder="Explain why this submission is being rejected and what corrections are needed…"
                  className={textareaCls}
                />
              </div>

              {/* Existing approval/rejection info */}
              {review.review_status === 'approved' && review.approval_comments && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-xs font-700 text-emerald-700 mb-1 flex items-center gap-1.5">
                    <Icon name="CheckCircleIcon" size={13} />
                    Approved — {review.approved_at ? new Date(review.approved_at).toLocaleDateString('en-GB') : ''}
                  </p>
                  <p className="text-xs text-emerald-800">{review.approval_comments}</p>
                </div>
              )}
              {review.review_status === 'rejected' && review.rejected_reason && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                  <p className="text-xs font-700 text-rose-700 mb-1 flex items-center gap-1.5">
                    <Icon name="XCircleIcon" size={13} />
                    Rejected
                  </p>
                  <p className="text-xs text-rose-800">{review.rejected_reason}</p>
                </div>
              )}

              {!canApproveReject && (
                <div className="rounded-xl border border-border bg-muted/30 p-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    This review has already been <strong>{review.review_status}</strong> and cannot be modified.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-border flex-shrink-0 bg-muted/20">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-600 text-muted-foreground border border-border rounded-xl hover:bg-muted transition-colors"
          >
            Close
          </button>

          {canApproveReject && (
            <div className="flex items-center gap-2">
              {/* Save Review (without final decision) */}
              <button
                onClick={() => handleAction('review')}
                disabled={saving || managerRating === 0}
                className="flex items-center gap-2 px-4 py-2 text-sm font-600 text-foreground border border-border rounded-xl hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? <div className="w-4 h-4 border-2 border-foreground/30 border-t-foreground rounded-full animate-spin" /> : <Icon name="DocumentCheckIcon" size={15} />}
                Save Review
              </button>

              {/* Reject */}
              {confirmAction === 'reject' ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-rose-600 font-600">Confirm rejection?</span>
                  <button
                    onClick={() => handleAction('reject')}
                    disabled={saving || !rejectionReason.trim()}
                    className="px-3 py-2 text-sm font-600 bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-colors disabled:opacity-50"
                  >
                    Yes, Reject
                  </button>
                  <button onClick={() => setConfirmAction(null)} className="px-3 py-2 text-sm font-600 border border-border rounded-xl hover:bg-muted transition-colors">
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmAction('reject')}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-600 text-rose-600 border border-rose-200 bg-rose-50 rounded-xl hover:bg-rose-100 transition-colors disabled:opacity-50"
                >
                  <Icon name="XCircleIcon" size={15} />
                  Reject
                </button>
              )}

              {/* Approve */}
              {confirmAction === 'approve' ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-emerald-600 font-600">Confirm approval?</span>
                  <button
                    onClick={() => handleAction('approve')}
                    disabled={saving || !approvalComments.trim() || managerRating === 0}
                    className="px-3 py-2 text-sm font-600 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50"
                  >
                    Yes, Approve
                  </button>
                  <button onClick={() => setConfirmAction(null)} className="px-3 py-2 text-sm font-600 border border-border rounded-xl hover:bg-muted transition-colors">
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmAction('approve')}
                  disabled={saving || managerRating === 0 || !approvalComments.trim()}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-600 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title={managerRating === 0 ? 'Set a rating first' : !approvalComments.trim() ? 'Add approval comments first' : ''}
                >
                  <Icon name="CheckCircleIcon" size={15} />
                  Approve
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ManagerReviewPage() {
  const supabase = createClient();

  const [reviews, setReviews] = useState<SelfAssessmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReview, setSelectedReview] = useState<SelfAssessmentRecord | null>(null);
  const [filterStatus, setFilterStatus] = useState<ReviewStatus | 'all'>('all');
  const [filterPeriod, setFilterPeriod] = useState<'all' | 'mid-year' | 'annual'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('mid_year_reviews')
        .select(`
          id, staff_id, supervisor_id, workplan_id,
          review_status, review_year, review_period,
          kpi_achievements, challenges_faced, support_needed,
          self_rating, supervisor_comments, supervisor_rating,
          supervisor_reviewed_at, approval_comments, approved_at,
          submitted_at, rejected_reason, stage_approval_comments, stage_approved_at,
          staff:staff_id (
            full_name, job_title,
            departments:department_id ( name )
          ),
          supervisor:supervisor_id ( full_name ),
          workplan:workplan_id (
            fiscal_year, perspectives_objectives, general_competencies
          )
        `)
        .in('review_status', ['submitted', 'reviewed', 'approved', 'rejected'])
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      setReviews((data ?? []) as unknown as SelfAssessmentRecord[]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load reviews';
      setToast({ message: msg, type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  async function handleSave(
    id: string,
    data: Record<string, unknown>,
    action: 'review' | 'approve' | 'reject'
  ) {
    const now = new Date().toISOString();
    let updatePayload: Record<string, unknown> = { ...data, updated_at: now };

    if (action === 'review') {
      updatePayload.review_status = 'reviewed';
      updatePayload.supervisor_reviewed_at = now;
    } else if (action === 'approve') {
      updatePayload.review_status = 'approved';
      updatePayload.approved_at = now;
      updatePayload.stage_approved_at = now;
      updatePayload.stage_approval_comments = data.approval_comments;
    } else if (action === 'reject') {
      updatePayload.review_status = 'rejected';
    }

    const { error } = await supabase
      .from('mid_year_reviews')
      .update(updatePayload)
      .eq('id', id);

    if (error) throw error;

    // Advance workflow stage on approval
    if (action === 'approve') {
      const review = reviews.find((r) => r.id === id);
      if (review?.workplan_id) {
        const nextStage = review.review_period === 'mid-year' ? 'mid_year_approved' : 'end_year_approved';
        await supabase
          .from('workplan_settings')
          .update({ workflow_stage: nextStage, updated_at: now })
          .eq('id', review.workplan_id);
      }
    }

    // Log activity
    const review = reviews.find((r) => r.id === id);
    const actionLabel = action === 'review' ? 'reviewed' : action === 'approve' ? 'approved' : 'rejected';
    await supabase.from('activity_logs').insert({
      activity_type: `mid_year_review_${actionLabel}`,
      actor_name: review?.supervisor?.full_name || 'Manager',
      action_description: `${actionLabel} mid-year self-assessment for ${review?.staff?.full_name || 'staff member'}`,
      subject_name: review?.staff?.full_name || '',
      subject_detail: review?.review_year?.toString() || '',
      icon_name: action === 'approve' ? 'CheckCircleIcon' : action === 'reject' ? 'XCircleIcon' : 'EyeIcon',
      icon_bg: action === 'approve' ? 'bg-emerald-50' : action === 'reject' ? 'bg-rose-50' : 'bg-amber-50',
      icon_color: action === 'approve' ? 'text-emerald-600' : action === 'reject' ? 'text-rose-600' : 'text-amber-600',
    });

    const labels = { review: 'Review saved', approve: 'Evaluation approved and workflow advanced', reject: 'Evaluation rejected' };
    setToast({ message: labels[action], type: 'success' });
    await fetchReviews();
  }

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filtered = reviews.filter((r) => {
    if (filterStatus !== 'all' && r.review_status !== filterStatus) return false;
    if (filterPeriod !== 'all' && r.review_period !== filterPeriod) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const name = r.staff?.full_name?.toLowerCase() || '';
      const dept = r.staff?.departments?.name?.toLowerCase() || '';
      if (!name.includes(q) && !dept.includes(q)) return false;
    }
    return true;
  });

  // ── Summary counts ────────────────────────────────────────────────────────
  const counts = {
    submitted: reviews.filter((r) => r.review_status === 'submitted').length,
    reviewed:  reviews.filter((r) => r.review_status === 'reviewed').length,
    approved:  reviews.filter((r) => r.review_status === 'approved').length,
    rejected:  reviews.filter((r) => r.review_status === 'rejected').length,
  };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-700 text-foreground">Manager Review</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Review submitted staff self-assessments, provide ratings and feedback, and approve or reject mid-year evaluations
            </p>
          </div>
          <button
            onClick={fetchReviews}
            className="flex items-center gap-2 px-4 py-2 text-sm font-600 border border-border rounded-xl hover:bg-muted transition-colors text-muted-foreground"
          >
            <Icon name="ArrowPathIcon" size={15} />
            Refresh
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Awaiting Review', count: counts.submitted, color: 'border-blue-200 bg-blue-50',    text: 'text-blue-700',    icon: 'ClipboardDocumentCheckIcon' },
            { label: 'Under Review',    count: counts.reviewed,  color: 'border-amber-200 bg-amber-50',  text: 'text-amber-700',   icon: 'EyeIcon' },
            { label: 'Approved',        count: counts.approved,  color: 'border-emerald-200 bg-emerald-50', text: 'text-emerald-700', icon: 'CheckCircleIcon' },
            { label: 'Rejected',        count: counts.rejected,  color: 'border-rose-200 bg-rose-50',    text: 'text-rose-700',    icon: 'XCircleIcon' },
          ].map(({ label, count, color, text, icon }) => (
            <div key={label} className={`rounded-xl border p-4 ${color}`}>
              <div className="flex items-center justify-between mb-2">
                <Icon name={icon as Parameters<typeof Icon>[0]['name']} size={18} className={text} />
                <span className={`text-2xl font-700 ${text}`}>{count}</span>
              </div>
              <p className={`text-xs font-600 ${text}`}>{label}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Icon name="MagnifyingGlassIcon" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by staff name or department…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as ReviewStatus | 'all')}
            className="px-3 py-2 text-sm border border-border rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          >
            <option value="all">All Statuses</option>
            <option value="submitted">Submitted</option>
            <option value="reviewed">Reviewed</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <select
            value={filterPeriod}
            onChange={(e) => setFilterPeriod(e.target.value as 'all' | 'mid-year' | 'annual')}
            className="px-3 py-2 text-sm border border-border rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          >
            <option value="all">All Periods</option>
            <option value="mid-year">Mid-Year</option>
            <option value="annual">End-Year</option>
          </select>
        </div>

        {/* Reviews Table */}
        <div className="bg-white border border-border rounded-2xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mr-3" />
              <span className="text-sm text-muted-foreground">Loading self-assessments…</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
                <Icon name="ClipboardDocumentListIcon" size={24} className="text-muted-foreground" />
              </div>
              <p className="text-sm font-600 text-foreground mb-1">No self-assessments found</p>
              <p className="text-xs text-muted-foreground max-w-sm">
                {reviews.length === 0
                  ? 'No staff have submitted self-assessments yet. They will appear here once submitted.' :'No assessments match your current filters. Try adjusting the search or status filter.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {['Staff Member', 'Department', 'Period', 'Submitted', 'Self-Rating', 'Manager Rating', 'Status', 'Action'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-700 text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((review) => (
                    <tr key={review.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-600 text-foreground">{review.staff?.full_name || '—'}</p>
                          <p className="text-xs text-muted-foreground">{review.staff?.job_title || '—'}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {review.staff?.departments?.name || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-500 px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {review.review_year} {review.review_period === 'mid-year' ? 'Mid-Year' : 'End-Year'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {review.submitted_at
                          ? new Date(review.submitted_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <SelfRatingDisplay value={review.self_rating ?? null} />
                      </td>
                      <td className="px-4 py-3">
                        {review.supervisor_rating ? (
                          <SelfRatingDisplay value={review.supervisor_rating} />
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Not yet rated</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={review.review_status} />
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setSelectedReview(review)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-600 rounded-lg transition-colors ${
                            review.review_status === 'submitted' ?'bg-primary text-white hover:bg-primary/90' :'border border-border text-muted-foreground hover:bg-muted'
                          }`}
                        >
                          <Icon name={review.review_status === 'submitted' ? 'ClipboardDocumentCheckIcon' : 'EyeIcon'} size={13} />
                          {review.review_status === 'submitted' ? 'Review' : 'View'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Result count */}
        {!loading && filtered.length > 0 && (
          <p className="text-xs text-muted-foreground text-center">
            Showing {filtered.length} of {reviews.length} self-assessment{reviews.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Review Modal */}
      {selectedReview && (
        <ReviewDetailModal
          review={selectedReview}
          onClose={() => setSelectedReview(null)}
          onSave={handleSave}
        />
      )}

      {/* Toast */}
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </AppLayout>
  );
}
