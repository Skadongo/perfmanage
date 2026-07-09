'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useStaffCache } from '@/hooks/useStaffCache';

// ─── Types ────────────────────────────────────────────────────────────────────

type ReviewStatus = 'draft' | 'submitted' | 'reviewed' | 'approved' | 'rejected';

interface ReviewTimeline {
  id: string;
  review_year: number;
  review_period: string;
  submission_open_date: string;
  submission_deadline: string;
  supervisor_review_deadline: string;
  approval_deadline: string;
  is_active: boolean;
}

interface MidYearReview {
  id: string;
  staff_id: string;
  supervisor_id: string | null;
  timeline_id: string | null;
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
  approved_by: string | null;
  approval_comments: string | null;
  approved_at: string | null;
  submitted_at: string | null;
  rejected_reason: string | null;
  created_at: string;
  updated_at: string;
  staff?: { full_name: string; job_title: string; departments?: { name: string } | null } | null;
  supervisor?: { full_name: string; job_title: string } | null;
}

interface StaffMember {
  id: string;
  full_name: string;
  job_title: string;
  supervisor_id: string | null;
  departments?: { name: string } | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ReviewStatus, { label: string; color: string; icon: string; bg: string }> = {
  draft:     { label: 'Draft',     color: 'text-slate-600',   icon: 'EcsaDraftIcon',       bg: 'bg-slate-100 border-slate-200' },
  submitted: { label: 'Submitted', color: 'text-blue-700',    icon: 'EcsaSubmittedIcon',   bg: 'bg-blue-50 border-blue-200' },
  reviewed:  { label: 'Reviewed',  color: 'text-amber-700',   icon: 'EcsaReviewedIcon',    bg: 'bg-amber-50 border-amber-200' },
  approved:  { label: 'Approved',  color: 'text-emerald-700', icon: 'EcsaApprovedIcon',    bg: 'bg-emerald-50 border-emerald-200' },
  rejected:  { label: 'Rejected',  color: 'text-rose-700',    icon: 'EcsaRejectedIcon',    bg: 'bg-rose-50 border-rose-200' },
};

const RATING_LABELS: Record<number, string> = {
  1: 'Needs Improvement',
  2: 'Below Expectations',
  3: 'Meets Expectations',
  4: 'Exceeds Expectations',
  5: 'Outstanding',
};

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-500 animate-fade-in
      ${type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
      <Icon name={type === 'success' ? 'EcsaSuccessIcon' : 'EcsaErrorIcon'} size={18} />
      {message}
      <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100"><Icon name="EcsaCloseIcon" size={14} /></button>
    </div>
  );
}

// ─── Timeline Banner ──────────────────────────────────────────────────────────

function TimelineBanner({ timeline }: { timeline: ReviewTimeline | null }) {
  if (!timeline) return null;
  const now = new Date();
  const deadline = new Date(timeline.submission_deadline);
  const daysLeft = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const isOverdue = daysLeft < 0;
  const isUrgent = daysLeft >= 0 && daysLeft <= 7;

  return (
    <div className={`rounded-xl border px-5 py-4 flex flex-wrap items-center gap-4 mb-6
      ${isOverdue ? 'bg-rose-50 border-rose-200' : isUrgent ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'}`}>
      <div className={`p-2 rounded-lg ${isOverdue ? 'bg-rose-100' : isUrgent ? 'bg-amber-100' : 'bg-blue-100'}`}>
        <Icon name="EcsaCalendarIcon" size={20} className={isOverdue ? 'text-rose-600' : isUrgent ? 'text-amber-600' : 'text-blue-600'} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`font-600 text-sm ${isOverdue ? 'text-rose-800' : isUrgent ? 'text-amber-800' : 'text-blue-800'}`}>
          {timeline.review_year} Mid-Year Review Period
        </p>
        <p className={`text-xs mt-0.5 ${isOverdue ? 'text-rose-600' : isUrgent ? 'text-amber-600' : 'text-blue-600'}`}>
          Submission deadline: {new Date(timeline.submission_deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
          {isOverdue ? ' — Deadline passed' : ` — ${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining`}
        </p>
      </div>
      <div className="flex gap-6 text-xs">
        {[
          { label: 'Submissions Open', date: timeline.submission_open_date },
          { label: 'Supervisor Review By', date: timeline.supervisor_review_deadline },
          { label: 'Final Approval By', date: timeline.approval_deadline },
        ].map(({ label, date }) => (
          <div key={label} className="text-center">
            <p className="text-muted-foreground">{label}</p>
            <p className="font-600 text-foreground">{new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ReviewStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-600 border ${cfg.bg} ${cfg.color}`}>
      <Icon name={cfg.icon as Parameters<typeof Icon>[0]['name']} size={12} />
      {cfg.label}
    </span>
  );
}

// ─── Star Rating ──────────────────────────────────────────────────────────────

function StarRating({ value, onChange, readonly = false }: { value: number; onChange?: (v: number) => void; readonly?: boolean }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.(star)}
          className={`transition-colors ${readonly ? 'cursor-default' : 'hover:scale-110'}`}
        >
          <Icon
            name={star <= value ? 'StarIcon' : 'StarIcon'}
            size={18}
            className={star <= value ? 'text-amber-400' : 'text-slate-200'}
          />
        </button>
      ))}
      {value > 0 && <span className="ml-1 text-xs text-muted-foreground">{RATING_LABELS[value]}</span>}
    </div>
  );
}

// ─── Review Form Modal ────────────────────────────────────────────────────────

interface ReviewFormModalProps {
  review: MidYearReview | null;
  mode: 'submit' | 'supervisor' | 'approve' | 'view';
  onClose: () => void;
  onSave: (data: Partial<MidYearReview>, action: string) => Promise<void>;
}

function ReviewFormModal({ review, mode, onClose, onSave }: ReviewFormModalProps) {
  const [form, setForm] = useState({
    kpi_achievements: review?.kpi_achievements || '',
    challenges_faced: review?.challenges_faced || '',
    support_needed: review?.support_needed || '',
    self_rating: review?.self_rating || 0,
    supervisor_comments: review?.supervisor_comments || '',
    supervisor_rating: review?.supervisor_rating || 0,
    approval_comments: review?.approval_comments || '',
    rejected_reason: review?.rejected_reason || '',
  });
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: string | number) => setForm((f) => ({ ...f, [k]: v }));

  const handleAction = async (action: string) => {
    setSaving(true);
    try {
      await onSave(form, action);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const isReadonly = mode === 'view';
  const title = {
    submit: 'Submit Mid-Year Review',
    supervisor: 'Supervisor Review',
    approve: 'Approve / Reject Review',
    view: 'View Review',
  }[mode];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Icon name="EcsaMidYearIcon" size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="font-700 text-foreground">{title}</h2>
              {review?.staff && (
                <p className="text-xs text-muted-foreground">{review.staff.full_name} · {review.staff.job_title}</p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted text-muted-foreground">
            <Icon name="EcsaCloseIcon" size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Status */}
          {review && (
            <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-xl">
              <StatusBadge status={review.review_status} />
              {review.submitted_at && (
                <span className="text-xs text-muted-foreground">
                  Submitted {new Date(review.submitted_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              )}
              {review.supervisor && (
                <span className="text-xs text-muted-foreground ml-auto">
                  Supervisor: {review.supervisor.full_name}
                </span>
              )}
            </div>
          )}

          {/* Self-Assessment Section */}
          {(mode === 'submit' || mode === 'view' || mode === 'supervisor' || mode === 'approve') && (
            <div className="space-y-4">
              <h3 className="font-600 text-sm text-foreground flex items-center gap-2">
                <Icon name="EcsaUserIcon" size={16} className="text-primary" />
                Staff Self-Assessment
              </h3>
              <div>
                <label className="block text-xs font-600 text-muted-foreground mb-1.5">KPI Achievements</label>
                <textarea
                  rows={3}
                  disabled={isReadonly || mode === 'supervisor' || mode === 'approve'}
                  value={form.kpi_achievements}
                  onChange={(e) => set('kpi_achievements', e.target.value)}
                  placeholder="Describe your key achievements against set KPIs..."
                  className="w-full px-3 py-2.5 rounded-lg border border-border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:bg-muted/40 disabled:text-muted-foreground"
                />
              </div>
              <div>
                <label className="block text-xs font-600 text-muted-foreground mb-1.5">Challenges Faced</label>
                <textarea
                  rows={2}
                  disabled={isReadonly || mode === 'supervisor' || mode === 'approve'}
                  value={form.challenges_faced}
                  onChange={(e) => set('challenges_faced', e.target.value)}
                  placeholder="Describe key challenges encountered..."
                  className="w-full px-3 py-2.5 rounded-lg border border-border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:bg-muted/40 disabled:text-muted-foreground"
                />
              </div>
              <div>
                <label className="block text-xs font-600 text-muted-foreground mb-1.5">Support Needed</label>
                <textarea
                  rows={2}
                  disabled={isReadonly || mode === 'supervisor' || mode === 'approve'}
                  value={form.support_needed}
                  onChange={(e) => set('support_needed', e.target.value)}
                  placeholder="What support or resources do you need?"
                  className="w-full px-3 py-2.5 rounded-lg border border-border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:bg-muted/40 disabled:text-muted-foreground"
                />
              </div>
              <div>
                <label className="block text-xs font-600 text-muted-foreground mb-1.5">Self Rating</label>
                <StarRating
                  value={form.self_rating}
                  onChange={mode === 'submit' ? (v) => set('self_rating', v) : undefined}
                  readOnly={isReadonly || mode === 'supervisor' || mode === 'approve'}
                />
              </div>
            </div>
          )}

          {/* Supervisor Review Section */}
          {(mode === 'supervisor' || mode === 'approve' || (mode === 'view' && review?.supervisor_comments)) && (
            <div className="space-y-4 pt-4 border-t border-border">
              <h3 className="font-600 text-sm text-foreground flex items-center gap-2">
                <Icon name="EcsaStaffIcon" size={16} className="text-amber-600" />
                Supervisor Assessment
              </h3>
              <div>
                <label className="block text-xs font-600 text-muted-foreground mb-1.5">Supervisor Comments</label>
                <textarea
                  rows={3}
                  disabled={isReadonly || mode === 'approve'}
                  value={form.supervisor_comments}
                  onChange={(e) => set('supervisor_comments', e.target.value)}
                  placeholder="Provide your assessment of the staff member's performance..."
                  className="w-full px-3 py-2.5 rounded-lg border border-border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:bg-muted/40 disabled:text-muted-foreground"
                />
              </div>
              <div>
                <label className="block text-xs font-600 text-muted-foreground mb-1.5">Supervisor Rating</label>
                <StarRating
                  value={form.supervisor_rating}
                  onChange={mode === 'supervisor' ? (v) => set('supervisor_rating', v) : undefined}
                  readOnly={isReadonly || mode === 'approve'}
                />
              </div>
            </div>
          )}

          {/* Approval Section */}
          {mode === 'approve' && (
            <div className="space-y-4 pt-4 border-t border-border">
              <h3 className="font-600 text-sm text-foreground flex items-center gap-2">
                <Icon name="EcsaApprovedIcon" size={16} className="text-emerald-600" />
                Approval Decision
              </h3>
              <div>
                <label className="block text-xs font-600 text-muted-foreground mb-1.5">Approval Comments</label>
                <textarea
                  rows={2}
                  value={form.approval_comments}
                  onChange={(e) => set('approval_comments', e.target.value)}
                  placeholder="Add any final comments for the approval..."
                  className="w-full px-3 py-2.5 rounded-lg border border-border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="block text-xs font-600 text-muted-foreground mb-1.5">Rejection Reason (if rejecting)</label>
                <textarea
                  rows={2}
                  value={form.rejected_reason}
                  onChange={(e) => set('rejected_reason', e.target.value)}
                  placeholder="Provide reason if rejecting this review..."
                  className="w-full px-3 py-2.5 rounded-lg border border-border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!isReadonly && (
          <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-sm font-500 hover:bg-muted transition-colors">
              Cancel
            </button>
            {mode === 'submit' && (
              <>
                <button
                  onClick={() => handleAction('save_draft')}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg border border-border text-sm font-500 hover:bg-muted transition-colors disabled:opacity-50"
                >
                  Save Draft
                </button>
                <button
                  onClick={() => handleAction('submit')}
                  disabled={saving || !form.kpi_achievements || form.self_rating === 0}
                  className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-600 hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {saving ? <Icon name="EcsaRefreshIcon" size={14} className="animate-spin" /> : <Icon name="EcsaSubmittedIcon" size={14} />}
                  Submit Review
                </button>
              </>
            )}
            {mode === 'supervisor' && (
              <button
                onClick={() => handleAction('mark_reviewed')}
                disabled={saving || !form.supervisor_comments || form.supervisor_rating === 0}
                className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-600 hover:bg-amber-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? <Icon name="EcsaRefreshIcon" size={14} className="animate-spin" /> : <Icon name="EcsaReviewedIcon" size={14} />}
                Mark as Reviewed
              </button>
            )}
            {mode === 'approve' && (
              <>
                <button
                  onClick={() => handleAction('reject')}
                  disabled={saving || !form.rejected_reason}
                  className="px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-600 hover:bg-rose-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {saving ? <Icon name="EcsaRefreshIcon" size={14} className="animate-spin" /> : <Icon name="EcsaRejectedIcon" size={14} />}
                  Reject
                </button>
                <button
                  onClick={() => handleAction('approve')}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-600 hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {saving ? <Icon name="EcsaRefreshIcon" size={14} className="animate-spin" /> : <Icon name="EcsaApprovedIcon" size={14} />}
                  Approve
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Review Card ──────────────────────────────────────────────────────────────

function ReviewCard({ review, onAction }: { review: MidYearReview; onAction: (r: MidYearReview, mode: 'submit' | 'supervisor' | 'approve' | 'view') => void }) {
  const cfg = STATUS_CONFIG[review.review_status];
  const canSubmit = review.review_status === 'draft';
  const canReview = review.review_status === 'submitted';
  const canApprove = review.review_status === 'reviewed';

  return (
    <div className="bg-white rounded-xl border border-border p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-700 text-white
            ${['bg-violet-500','bg-sky-500','bg-emerald-500','bg-amber-500','bg-rose-500'][
              (review.staff?.full_name?.charCodeAt(0) || 0) % 5
            ]}`}>
            {review.staff?.full_name?.split(' ').slice(0,2).map(n=>n[0]).join('').toUpperCase() || '??'}
          </div>
          <div className="min-w-0">
            <p className="font-600 text-sm text-foreground truncate">{review.staff?.full_name || 'Unknown Staff'}</p>
            <p className="text-xs text-muted-foreground truncate">{review.staff?.job_title}</p>
          </div>
        </div>
        <StatusBadge status={review.review_status} />
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
        <div>
          <p className="text-muted-foreground">Department</p>
          <p className="font-500 text-foreground">{review.staff?.departments?.name || '—'}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Supervisor</p>
          <p className="font-500 text-foreground">{review.supervisor?.full_name || '—'}</p>
        </div>
        {review.self_rating && (
          <div>
            <p className="text-muted-foreground">Self Rating</p>
            <div className="flex items-center gap-1 mt-0.5">
              {[1,2,3,4,5].map(s => (
                <div key={s} className={`w-2.5 h-2.5 rounded-full ${s <= review.self_rating! ? 'bg-amber-400' : 'bg-slate-200'}`} />
              ))}
            </div>
          </div>
        )}
        {review.supervisor_rating && (
          <div>
            <p className="text-muted-foreground">Supervisor Rating</p>
            <div className="flex items-center gap-1 mt-0.5">
              {[1,2,3,4,5].map(s => (
                <div key={s} className={`w-2.5 h-2.5 rounded-full ${s <= review.supervisor_rating! ? 'bg-emerald-400' : 'bg-slate-200'}`} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
          <span>Draft</span><span>Submitted</span><span>Reviewed</span><span>Approved</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${
            review.review_status === 'draft' ? 'w-[10%] bg-slate-400' :
            review.review_status === 'submitted' ? 'w-[40%] bg-blue-500' :
            review.review_status === 'reviewed' ? 'w-[70%] bg-amber-500' :
            review.review_status === 'approved'? 'w-full bg-emerald-500' : 'w-[40%] bg-rose-500'
          }`} />
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onAction(review, 'view')}
          className="flex-1 px-3 py-1.5 rounded-lg border border-border text-xs font-500 hover:bg-muted transition-colors flex items-center justify-center gap-1.5"
        >
          <Icon name="EcsaViewIcon" size={13} /> View
        </button>
        {canSubmit && (
          <button
            onClick={() => onAction(review, 'submit')}
            className="flex-1 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-600 hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5"
          >
            <Icon name="EcsaSubmittedIcon" size={13} /> Submit
          </button>
        )}
        {canReview && (
          <button
            onClick={() => onAction(review, 'supervisor')}
            className="flex-1 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-600 hover:bg-amber-700 transition-colors flex items-center justify-center gap-1.5"
          >
            <Icon name="EcsaReviewedIcon" size={13} /> Review
          </button>
        )}
        {canApprove && (
          <button
            onClick={() => onAction(review, 'approve')}
            className="flex-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-600 hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1.5"
          >
            <Icon name="EcsaApprovedIcon" size={13} /> Approve
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MidYearReviewsPage() {
  const supabase = createClient();
  const { getStaff } = useStaffCache();
  const [reviews, setReviews] = useState<MidYearReview[]>([]);
  const [timeline, setTimeline] = useState<ReviewTimeline | null>(null);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success\' | \'error' } | null>(null);
  const [selectedReview, setSelectedReview] = useState<MidYearReview | null>(null);
  const [modalMode, setModalMode] = useState<'submit' | 'supervisor' | 'approve' | 'view'>('view');
  const [filterStatus, setFilterStatus] = useState<ReviewStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewReviewModal, setShowNewReviewModal] = useState(false);
  const [newReviewStaffId, setNewReviewStaffId] = useState('');
  const [creatingReview, setCreatingReview] = useState(false);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [timelineRes, reviewsRes, staffData] = await Promise.all([
        supabase
          .from('review_timelines')
          .select('id, review_year, review_period, submission_open_date, submission_deadline, supervisor_review_deadline, approval_deadline, is_active')
          .eq('is_active', true)
          .order('review_year', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('mid_year_reviews')
          .select(`
            id, staff_id, supervisor_id, timeline_id, review_status,
            review_year, review_period, kpi_achievements, challenges_faced,
            support_needed, self_rating, supervisor_comments, supervisor_rating,
            supervisor_reviewed_at, approved_by, approval_comments, approved_at,
            submitted_at, rejected_reason, created_at, updated_at,
            staff:staff_id(full_name, job_title, departments(name)),
            supervisor:supervisor_id(full_name, job_title)
          `)
          .order('updated_at', { ascending: false }),
        // Use cache for staff list — avoids a separate DB round-trip
        getStaff(),
      ]);

      if (timelineRes.error) throw timelineRes.error;
      if (reviewsRes.error) throw reviewsRes.error;

      setTimeline(timelineRes.data);
      setReviews((reviewsRes.data as MidYearReview[]) || []);
      // Map cached staff to the StaffMember shape used by this page
      setStaff(
        staffData
          .filter((s) => s.employment_status === 'active')
          .map((s) => ({
            id: s.id,
            full_name: s.full_name,
            job_title: s.job_title,
            supervisor_id: s.supervisor_id,
            departments: s.department_name ? { name: s.department_name } : null,
          })) as StaffMember[]
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load reviews');
    } finally {
      setLoading(false);
    }
  }, [supabase, getStaff]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAction = useCallback((review: MidYearReview, mode: 'submit' | 'supervisor' | 'approve' | 'view') => {
    setSelectedReview(review);
    setModalMode(mode);
  }, []);

  const handleSave = useCallback(async (data: Partial<MidYearReview>, action: string) => {
    if (!selectedReview) return;
    try {
      const now = new Date().toISOString();
      let updates: Partial<MidYearReview> = { ...data, updated_at: now };

      if (action === 'submit') {
        updates.review_status = 'submitted';
        updates.submitted_at = now;
      } else if (action === 'save_draft') {
        updates.review_status = 'draft';
      } else if (action === 'mark_reviewed') {
        updates.review_status = 'reviewed';
        updates.supervisor_reviewed_at = now;
      } else if (action === 'approve') {
        updates.review_status = 'approved';
        updates.approved_at = now;
      } else if (action === 'reject') {
        updates.review_status = 'rejected';
      }

      const { error } = await supabase
        .from('mid_year_reviews')
        .update(updates)
        .eq('id', selectedReview.id);

      if (error) throw error;

      showToast(
        action === 'submit' ? 'Review submitted successfully' :
        action === 'save_draft' ? 'Draft saved' :
        action === 'mark_reviewed' ? 'Review marked as reviewed' :
        action === 'approve'? 'Review approved' : 'Review rejected',
        'success'
      );
      await fetchData();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Action failed', 'error');
      throw err;
    }
  }, [selectedReview, supabase, showToast, fetchData]);

  const handleCreateReview = useCallback(async () => {
    if (!newReviewStaffId || !timeline) return;
    setCreatingReview(true);
    try {
      const staffMember = staff.find(s => s.id === newReviewStaffId);
      const { error } = await supabase.from('mid_year_reviews').insert({
        staff_id: newReviewStaffId,
        supervisor_id: staffMember?.supervisor_id || null,
        timeline_id: timeline.id,
        review_status: 'draft',
        review_year: timeline.review_year,
        review_period: timeline.review_period,
      });
      if (error) throw error;
      showToast('Review record created', 'success');
      setShowNewReviewModal(false);
      setNewReviewStaffId('');
      await fetchData();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to create review', 'error');
    } finally {
      setCreatingReview(false);
    }
  }, [newReviewStaffId, timeline, staff, supabase, showToast, fetchData]);

  // Stats
  const stats = useMemo(() => {
    const total = reviews.length;
    const byStatus = reviews.reduce((acc, r) => {
      acc[r.review_status] = (acc[r.review_status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return { total, ...byStatus };
  }, [reviews]);

  // Filtered reviews
  const filteredReviews = useMemo(() => {
    return reviews.filter(r => {
      const matchStatus = filterStatus === 'all' || r.review_status === filterStatus;
      const q = searchQuery.toLowerCase();
      const matchSearch = !q ||
        r.staff?.full_name?.toLowerCase().includes(q) ||
        r.staff?.job_title?.toLowerCase().includes(q) ||
        r.supervisor?.full_name?.toLowerCase().includes(q);
      return matchStatus && matchSearch;
    });
  }, [reviews, filterStatus, searchQuery]);

  // Staff without reviews
  const staffWithoutReviews = useMemo(() => {
    const reviewedIds = new Set(reviews.map(r => r.staff_id));
    return staff.filter(s => !reviewedIds.has(s.id));
  }, [staff, reviews]);

  return (
    <AppLayout>
      <div className="p-6 max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-700 text-foreground">Mid-Year Reviews</h1>
            <p className="text-sm text-muted-foreground mt-0.5">2026 performance review submission and approval workflow</p>
          </div>
          <button
            onClick={() => setShowNewReviewModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-600 hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Icon name="EcsaNewIcon" size={16} />
            New Review
          </button>
        </div>

        {/* Timeline Banner */}
        <TimelineBanner timeline={timeline} />

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
          {[
            { label: 'Total', value: stats.total, color: 'text-foreground', bg: 'bg-white' },
            { label: 'Draft', value: stats.draft || 0, color: 'text-slate-600', bg: 'bg-slate-50' },
            { label: 'Submitted', value: stats.submitted || 0, color: 'text-blue-700', bg: 'bg-blue-50' },
            { label: 'Reviewed', value: stats.reviewed || 0, color: 'text-amber-700', bg: 'bg-amber-50' },
            { label: 'Approved', value: stats.approved || 0, color: 'text-emerald-700', bg: 'bg-emerald-50' },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className={`${bg} rounded-xl border border-border p-4 text-center`}>
              <p className={`text-2xl font-700 ${color}`}>{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-5">
          <div className="relative flex-1 min-w-[200px]">
            <Icon name="EcsaSearchIcon" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by staff name or supervisor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {(['all', 'draft', 'submitted', 'reviewed', 'approved', 'rejected'] as const).map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-3 py-2 rounded-xl text-xs font-600 border transition-colors capitalize
                  ${filterStatus === s ? 'bg-primary text-white border-primary' : 'bg-white border-border text-muted-foreground hover:bg-muted'}`}
              >
                {s === 'all' ? `All (${stats.total})` : `${s} (${(stats as Record<string, number>)[s] || 0})`}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Icon name="EcsaRefreshIcon" size={24} className="animate-spin text-primary" />
            <span className="ml-3 text-muted-foreground">Loading reviews...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Icon name="EcsaWarningIcon" size={32} className="text-rose-400 mb-3" />
            <p className="text-foreground font-600">Failed to load reviews</p>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
            <button onClick={fetchData} className="mt-4 px-4 py-2 bg-primary text-white rounded-lg text-sm font-600">Retry</button>
          </div>
        ) : filteredReviews.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Icon name="EcsaMidYearIcon" size={40} className="text-muted-foreground/40 mb-3" />
            <p className="text-foreground font-600">No reviews found</p>
            <p className="text-sm text-muted-foreground mt-1">
              {searchQuery || filterStatus !== 'all' ? 'Try adjusting your filters' : 'Create a new review to get started'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredReviews.map(review => (
              <ReviewCard key={review.id} review={review} onAction={handleAction} />
            ))}
          </div>
        )}
      </div>

      {/* Review Form Modal */}
      {selectedReview && (
        <ReviewFormModal
          review={selectedReview}
          mode={modalMode}
          onClose={() => setSelectedReview(null)}
          onSave={handleSave}
        />
      )}

      {/* New Review Modal */}
      {showNewReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="font-700 text-foreground">Create Review Record</h2>
              <button onClick={() => setShowNewReviewModal(false)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground">
                <Icon name="EcsaCloseIcon" size={18} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-600 text-muted-foreground mb-1.5">Select Staff Member</label>
                <select
                  value={newReviewStaffId}
                  onChange={(e) => setNewReviewStaffId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">Choose staff member...</option>
                  {staffWithoutReviews.map(s => (
                    <option key={s.id} value={s.id}>{s.full_name} — {s.job_title}</option>
                  ))}
                </select>
                {staffWithoutReviews.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-1">All active staff already have review records</p>
                )}
              </div>
              {timeline && (
                <div className="p-3 bg-blue-50 rounded-lg text-xs text-blue-700">
                  <p className="font-600">Review Period: {timeline.review_year} {timeline.review_period}</p>
                  <p className="mt-0.5">Deadline: {new Date(timeline.submission_deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-3">
              <button onClick={() => setShowNewReviewModal(false)} className="px-4 py-2 rounded-lg border border-border text-sm font-500 hover:bg-muted">Cancel</button>
              <button
                onClick={handleCreateReview}
                disabled={!newReviewStaffId || creatingReview}
                className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-600 hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
              >
                {creatingReview ? <Icon name="EcsaRefreshIcon" size={14} className="animate-spin" /> : <Icon name="EcsaNewIcon" size={14} />}
                Create Review
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </AppLayout>
  );
}
