'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Icon from '@/components/ui/AppIcon';
import StatusBadge from '@/components/ui/StatusBadge';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

interface SubmittedReview {
  id: string;
  staffName: string;
  jobTitle: string;
  reviewPeriod: string;
  reviewYear: number;
  selfRating: number | null;
  supervisorRating: number | null;
  supervisorComments: string | null;
  kpiAchievements: string | null;
  challengesFaced: string | null;
  supportNeeded: string | null;
  reviewStatus: 'draft' | 'submitted' | 'reviewed' | 'approved' | 'rejected';
  submittedAt: string | null;
  approvalComments: string | null;
  rejectedReason: string | null;
}

interface ReviewFormState {
  supervisorRating: number;
  supervisorComments: string;
  approvalComments: string;
  rejectedReason: string;
}

const RATING_LABELS: Record<number, { label: string; color: string; bg: string }> = {
  1: { label: 'Unsatisfactory', color: 'text-red-700', bg: 'bg-red-50 border-red-300' },
  2: { label: 'Needs Improvement', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-300' },
  3: { label: 'Meets Expectations', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-300' },
  4: { label: 'Exceeds Expectations', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-300' },
  5: { label: 'Outstanding', color: 'text-emerald-800', bg: 'bg-emerald-100 border-emerald-400' },
};

const STATUS_MAP: Record<string, 'pending' | 'in-progress' | 'submitted' | 'approved' | 'overdue'> = {
  draft: 'in-progress',
  submitted: 'submitted',
  reviewed: 'in-progress',
  approved: 'approved',
  rejected: 'overdue',
};

export default function SupervisorReviewForm() {
  // Stable supabase client ref
  const supabaseRef = useRef(createClient());

  const [reviews, setReviews] = useState<SubmittedReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [formStates, setFormStates] = useState<Record<string, ReviewFormState>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [actionType, setActionType] = useState<Record<string, 'approve' | 'reject' | null>>({});

  const supabase = supabaseRef.current;

  const fetchSubmittedReviews = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('mid_year_reviews')
        .select(`
          id,
          review_period,
          review_year,
          review_status,
          self_rating,
          supervisor_rating,
          supervisor_comments,
          kpi_achievements,
          challenges_faced,
          support_needed,
          submitted_at,
          approval_comments,
          rejected_reason,
          staff:staff_id (
            full_name,
            job_title
          )
        `)
        .in('review_status', ['submitted', 'reviewed', 'approved', 'rejected'])
        .order('submitted_at', { ascending: false });

      if (error) throw error;

      const mapped: SubmittedReview[] = (data || []).map((r: any) => ({
        id: r.id,
        staffName: r.staff?.full_name ?? 'Unknown Staff',
        jobTitle: r.staff?.job_title ?? '',
        reviewPeriod: r.review_period,
        reviewYear: r.review_year,
        selfRating: r.self_rating,
        supervisorRating: r.supervisor_rating,
        supervisorComments: r.supervisor_comments,
        kpiAchievements: r.kpi_achievements,
        challengesFaced: r.challenges_faced,
        supportNeeded: r.support_needed,
        reviewStatus: r.review_status,
        submittedAt: r.submitted_at,
        approvalComments: r.approval_comments,
        rejectedReason: r.rejected_reason,
      }));

      setReviews(mapped);

      // Pre-fill form states with existing supervisor data
      const initialStates: Record<string, ReviewFormState> = {};
      mapped.forEach((r) => {
        initialStates[r.id] = {
          supervisorRating: r.supervisorRating ?? 0,
          supervisorComments: r.supervisorComments ?? '',
          approvalComments: r.approvalComments ?? '',
          rejectedReason: r.rejectedReason ?? '',
        };
      });
      setFormStates(initialStates);
    } catch (err: any) {
      toast.error('Failed to load submitted reviews', { description: err?.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubmittedReviews();
  }, [fetchSubmittedReviews]);

  const updateFormState = (id: string, field: keyof ReviewFormState, value: string | number) => {
    setFormStates((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  };

  const handleSaveFeedback = async (reviewId: string) => {
    const form = formStates[reviewId];
    if (!form) return;
    if (!form.supervisorRating || form.supervisorRating < 1) {
      toast.warning('Please select a supervisor rating before saving.');
      return;
    }
    if (!form.supervisorComments.trim()) {
      toast.warning('Please provide supervisor feedback comments.');
      return;
    }

    setSaving(reviewId);
    try {
      const { error } = await supabase
        .from('mid_year_reviews')
        .update({
          supervisor_rating: form.supervisorRating,
          supervisor_comments: form.supervisorComments,
          supervisor_reviewed_at: new Date().toISOString(),
          review_status: 'reviewed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', reviewId);

      if (error) throw error;

      toast.success('Supervisor feedback saved successfully.');
      setReviews((prev) =>
        prev.map((r) =>
          r.id === reviewId
            ? { ...r, supervisorRating: form.supervisorRating, supervisorComments: form.supervisorComments, reviewStatus: 'reviewed' }
            : r
        )
      );
    } catch (err: any) {
      toast.error('Failed to save feedback', { description: err?.message });
    } finally {
      setSaving(null);
    }
  };

  const handleApprove = async (reviewId: string) => {
    const form = formStates[reviewId];
    if (!form) return;
    if (!form.supervisorRating || form.supervisorRating < 1) {
      toast.warning('Please provide a supervisor rating before approving.');
      return;
    }
    if (!form.supervisorComments.trim()) {
      toast.warning('Please provide supervisor feedback before approving.');
      return;
    }

    setSaving(reviewId);
    try {
      const { error } = await supabase
        .from('mid_year_reviews')
        .update({
          supervisor_rating: form.supervisorRating,
          supervisor_comments: form.supervisorComments,
          approval_comments: form.approvalComments,
          supervisor_reviewed_at: new Date().toISOString(),
          approved_at: new Date().toISOString(),
          review_status: 'approved',
          updated_at: new Date().toISOString(),
        })
        .eq('id', reviewId);

      if (error) throw error;

      toast.success('Review approved successfully.', { description: 'Staff member will be notified.' });
      setReviews((prev) =>
        prev.map((r) =>
          r.id === reviewId
            ? {
                ...r,
                supervisorRating: form.supervisorRating,
                supervisorComments: form.supervisorComments,
                approvalComments: form.approvalComments,
                reviewStatus: 'approved',
              }
            : r
        )
      );
      setExpandedId(null);
      setActionType((prev) => ({ ...prev, [reviewId]: null }));
    } catch (err: any) {
      toast.error('Failed to approve review', { description: err?.message });
    } finally {
      setSaving(null);
    }
  };

  const handleReject = async (reviewId: string) => {
    const form = formStates[reviewId];
    if (!form) return;
    if (!form.rejectedReason.trim()) {
      toast.warning('Please provide a reason for rejection.');
      return;
    }

    setSaving(reviewId);
    try {
      const { error } = await supabase
        .from('mid_year_reviews')
        .update({
          rejected_reason: form.rejectedReason,
          supervisor_comments: form.supervisorComments,
          review_status: 'rejected',
          updated_at: new Date().toISOString(),
        })
        .eq('id', reviewId);

      if (error) throw error;

      toast.success('Review rejected.', { description: 'Staff member will be asked to revise and resubmit.' });
      setReviews((prev) =>
        prev.map((r) =>
          r.id === reviewId
            ? { ...r, rejectedReason: form.rejectedReason, reviewStatus: 'rejected' }
            : r
        )
      );
      setExpandedId(null);
      setActionType((prev) => ({ ...prev, [reviewId]: null }));
    } catch (err: any) {
      toast.error('Failed to reject review', { description: err?.message });
    } finally {
      setSaving(null);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
    setActionType((prev) => ({ ...prev, [id]: null }));
  };

  const submittedCount = reviews.filter((r) => r.reviewStatus === 'submitted' || r.reviewStatus === 'reviewed').length;
  const approvedCount = reviews.filter((r) => r.reviewStatus === 'approved').length;
  const rejectedCount = reviews.filter((r) => r.reviewStatus === 'rejected').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-3">
          <Icon name="ArrowPathIcon" size={28} className="text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Loading submitted reviews…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-700 text-foreground">Supervisor Review Queue</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Review, rate, and approve or reject submitted evaluations</p>
        </div>
        <button
          onClick={fetchSubmittedReviews}
          className="flex items-center gap-1.5 text-xs font-600 text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 hover:bg-muted transition-colors"
        >
          <Icon name="ArrowPathIcon" size={13} />
          Refresh
        </button>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Awaiting Review', value: submittedCount, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
          { label: 'Approved', value: approvedCount, color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
          { label: 'Rejected', value: rejectedCount, color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
        ].map((s) => (
          <div key={s.label} className={`${s.bg} border rounded-xl p-3 text-center`}>
            <p className={`text-2xl font-700 tabular-nums font-mono ${s.color}`}>{s.value}</p>
            <p className="text-[11px] font-600 text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Review list */}
      {reviews.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 bg-muted/20 rounded-xl border border-border">
          <Icon name="ClipboardDocumentCheckIcon" size={36} className="text-muted-foreground" />
          <p className="text-sm font-600 text-foreground">No submitted reviews yet</p>
          <p className="text-xs text-muted-foreground">Reviews submitted by staff will appear here for your assessment</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => {
            const form = formStates[review.id] ?? { supervisorRating: 0, supervisorComments: '', approvalComments: '', rejectedReason: '' };
            const isExpanded = expandedId === review.id;
            const isSaving = saving === review.id;
            const currentAction = actionType[review.id] ?? null;
            const isReadOnly = review.reviewStatus === 'approved' || review.reviewStatus === 'rejected';
            const ratingInfo = RATING_LABELS[form.supervisorRating];
            const statusKey = STATUS_MAP[review.reviewStatus] ?? 'submitted';

            return (
              <div
                key={review.id}
                className={`bg-white rounded-xl border transition-all ${
                  isExpanded ? 'border-primary/40 shadow-md' : 'border-border shadow-card hover:border-primary/20'
                }`}
              >
                {/* Row header */}
                <div
                  className="flex items-center gap-4 px-4 py-3.5 cursor-pointer"
                  onClick={() => toggleExpand(review.id)}
                >
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-primary text-[11px] font-700">
                      {review.staffName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                    </span>
                  </div>

                  {/* Staff info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-700 text-foreground truncate">{review.staffName}</p>
                    <p className="text-xs text-muted-foreground truncate">{review.jobTitle}</p>
                  </div>

                  {/* Period */}
                  <div className="hidden sm:block text-right">
                    <p className="text-[11px] font-600 text-muted-foreground uppercase tracking-wider">Period</p>
                    <p className="text-xs font-600 text-foreground capitalize">{review.reviewPeriod} {review.reviewYear}</p>
                  </div>

                  {/* Self rating */}
                  <div className="hidden md:block text-right">
                    <p className="text-[11px] font-600 text-muted-foreground uppercase tracking-wider">Self</p>
                    <p className="text-sm font-700 tabular-nums font-mono text-sky-700">
                      {review.selfRating ? `${review.selfRating}/5` : '—'}
                    </p>
                  </div>

                  {/* Supervisor rating */}
                  <div className="hidden md:block text-right">
                    <p className="text-[11px] font-600 text-muted-foreground uppercase tracking-wider">Sup. Rating</p>
                    <p className="text-sm font-700 tabular-nums font-mono text-primary">
                      {review.supervisorRating ? `${review.supervisorRating}/5` : '—'}
                    </p>
                  </div>

                  {/* Status */}
                  <StatusBadge status={statusKey} />

                  {/* Submitted date */}
                  {review.submittedAt && (
                    <p className="hidden lg:block text-[11px] text-muted-foreground whitespace-nowrap">
                      {new Date(review.submittedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  )}

                  {/* Expand icon */}
                  <Icon
                    name={isExpanded ? 'ChevronUpIcon' : 'ChevronDownIcon'}
                    size={16}
                    className="text-muted-foreground flex-shrink-0"
                  />
                </div>

                {/* Expanded form */}
                {isExpanded && (
                  <div className="border-t border-border px-4 pb-5 pt-4 space-y-5">
                    {/* Staff self-assessment summary */}
                    {(review.kpiAchievements || review.challengesFaced || review.supportNeeded) && (
                      <div className="bg-sky-50 border border-sky-200 rounded-lg p-4 space-y-3">
                        <p className="text-xs font-700 uppercase tracking-wider text-sky-800 flex items-center gap-1.5">
                          <Icon name="UserIcon" size={13} />
                          Staff Self-Assessment Summary
                        </p>
                        <div className="grid sm:grid-cols-3 gap-3">
                          {review.kpiAchievements && (
                            <div>
                              <p className="text-[10px] font-600 uppercase tracking-wider text-sky-700 mb-1">KPI Achievements</p>
                              <p className="text-xs text-sky-900 leading-relaxed">{review.kpiAchievements}</p>
                            </div>
                          )}
                          {review.challengesFaced && (
                            <div>
                              <p className="text-[10px] font-600 uppercase tracking-wider text-sky-700 mb-1">Challenges Faced</p>
                              <p className="text-xs text-sky-900 leading-relaxed">{review.challengesFaced}</p>
                            </div>
                          )}
                          {review.supportNeeded && (
                            <div>
                              <p className="text-[10px] font-600 uppercase tracking-wider text-sky-700 mb-1">Support Needed</p>
                              <p className="text-xs text-sky-900 leading-relaxed">{review.supportNeeded}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Rejected / Approved read-only notice */}
                    {review.reviewStatus === 'approved' && (
                      <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                        <Icon name="CheckCircleIcon" size={16} className="text-emerald-600 flex-shrink-0" />
                        <p className="text-xs font-600 text-emerald-800">This review has been approved. {review.approvalComments && `Note: "${review.approvalComments}"`}</p>
                      </div>
                    )}
                    {review.reviewStatus === 'rejected' && (
                      <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <Icon name="XCircleIcon" size={16} className="text-red-600 flex-shrink-0" />
                        <p className="text-xs font-600 text-red-800">This review was rejected. Reason: "{review.rejectedReason}"</p>
                      </div>
                    )}

                    {/* Supervisor Rating */}
                    <div>
                      <label className="block text-xs font-700 text-foreground mb-2">
                        Supervisor Rating <span className="text-red-500">*</span>
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {[1, 2, 3, 4, 5].map((score) => {
                          const info = RATING_LABELS[score];
                          const isSelected = form.supervisorRating === score;
                          return (
                            <button
                              key={`rating-${review.id}-${score}`}
                              type="button"
                              disabled={isReadOnly}
                              onClick={() => updateFormState(review.id, 'supervisorRating', score)}
                              className={`flex flex-col items-center px-3 py-2 rounded-lg border-2 transition-all text-center min-w-[80px] ${
                                isSelected
                                  ? `${info.bg} ${info.color} border-current font-700`
                                  : 'bg-white border-border text-muted-foreground hover:border-primary/40 hover:bg-muted/30'
                              } ${isReadOnly ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                            >
                              <span className="text-lg font-800 font-mono">{score}</span>
                              <span className="text-[10px] font-600 leading-tight mt-0.5">{info.label}</span>
                            </button>
                          );
                        })}
                      </div>
                      {ratingInfo && form.supervisorRating > 0 && (
                        <p className={`text-xs font-600 mt-2 ${ratingInfo.color}`}>
                          Selected: {form.supervisorRating} — {ratingInfo.label}
                        </p>
                      )}
                    </div>

                    {/* Supervisor Feedback */}
                    <div>
                      <label className="block text-xs font-700 text-foreground mb-1.5">
                        Supervisor Feedback <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        rows={4}
                        disabled={isReadOnly}
                        value={form.supervisorComments}
                        onChange={(e) => updateFormState(review.id, 'supervisorComments', e.target.value)}
                        placeholder="Provide detailed feedback on the staff member's performance, achievements, and areas for improvement…"
                        className="w-full px-3 py-2.5 text-sm bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none disabled:bg-muted/30 disabled:cursor-not-allowed"
                      />
                    </div>

                    {/* Action selection (only for non-final states) */}
                    {!isReadOnly && (
                      <div>
                        <p className="text-xs font-700 text-foreground mb-2">Action</p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setActionType((prev) => ({ ...prev, [review.id]: prev[review.id] === 'approve' ? null : 'approve' }))}
                            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-600 rounded-lg border-2 transition-all ${
                              currentAction === 'approve' ?'bg-emerald-50 border-emerald-400 text-emerald-700' :'bg-white border-border text-muted-foreground hover:border-emerald-300 hover:text-emerald-700'
                            }`}
                          >
                            <Icon name="CheckCircleIcon" size={14} />
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => setActionType((prev) => ({ ...prev, [review.id]: prev[review.id] === 'reject' ? null : 'reject' }))}
                            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-600 rounded-lg border-2 transition-all ${
                              currentAction === 'reject' ?'bg-red-50 border-red-400 text-red-700' :'bg-white border-border text-muted-foreground hover:border-red-300 hover:text-red-700'
                            }`}
                          >
                            <Icon name="XCircleIcon" size={14} />
                            Reject
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Approve additional comments */}
                    {currentAction === 'approve' && !isReadOnly && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 space-y-3">
                        <p className="text-xs font-700 text-emerald-800 flex items-center gap-1.5">
                          <Icon name="CheckCircleIcon" size={13} />
                          Approval Notes (Optional)
                        </p>
                        <textarea
                          rows={2}
                          value={form.approvalComments}
                          onChange={(e) => updateFormState(review.id, 'approvalComments', e.target.value)}
                          placeholder="Any additional notes for the approval record…"
                          className="w-full px-3 py-2 text-sm bg-white border border-emerald-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300 resize-none"
                        />
                      </div>
                    )}

                    {/* Reject reason */}
                    {currentAction === 'reject' && !isReadOnly && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
                        <p className="text-xs font-700 text-red-800 flex items-center gap-1.5">
                          <Icon name="XCircleIcon" size={13} />
                          Rejection Reason <span className="text-red-500">*</span>
                        </p>
                        <textarea
                          rows={3}
                          value={form.rejectedReason}
                          onChange={(e) => updateFormState(review.id, 'rejectedReason', e.target.value)}
                          placeholder="Explain why this review is being rejected and what the staff member needs to address before resubmitting…"
                          className="w-full px-3 py-2 text-sm bg-white border border-red-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
                        />
                      </div>
                    )}

                    {/* Action buttons */}
                    {!isReadOnly && (
                      <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
                        <button
                          type="button"
                          onClick={() => toggleExpand(review.id)}
                          className="px-4 py-2 text-xs font-600 text-muted-foreground border border-border rounded-lg hover:bg-muted transition-colors"
                        >
                          Cancel
                        </button>

                        {/* Save feedback only (no approve/reject) */}
                        {!currentAction && (
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => handleSaveFeedback(review.id)}
                            className="flex items-center gap-1.5 px-4 py-2 text-xs font-600 text-white bg-primary rounded-lg hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {isSaving ? (
                              <Icon name="ArrowPathIcon" size={13} className="animate-spin" />
                            ) : (
                              <Icon name="BookmarkIcon" size={13} />
                            )}
                            Save Feedback
                          </button>
                        )}

                        {/* Approve button */}
                        {currentAction === 'approve' && (
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => handleApprove(review.id)}
                            className="flex items-center gap-1.5 px-4 py-2 text-xs font-600 text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {isSaving ? (
                              <Icon name="ArrowPathIcon" size={13} className="animate-spin" />
                            ) : (
                              <Icon name="CheckIcon" size={13} />
                            )}
                            Confirm Approval
                          </button>
                        )}

                        {/* Reject button */}
                        {currentAction === 'reject' && (
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => handleReject(review.id)}
                            className="flex items-center gap-1.5 px-4 py-2 text-xs font-600 text-white bg-red-600 rounded-lg hover:bg-red-700 transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {isSaving ? (
                              <Icon name="ArrowPathIcon" size={13} className="animate-spin" />
                            ) : (
                              <Icon name="XMarkIcon" size={13} />
                            )}
                            Confirm Rejection
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
