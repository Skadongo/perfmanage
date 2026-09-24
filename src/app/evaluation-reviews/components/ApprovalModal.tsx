'use client';

import React, { useState } from 'react';
import Modal from '@/components/ui/Modal';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

export type ApprovalAction = 'approve' | 'reject' | 'request_changes';

interface ApprovalTarget {
  id: string;
  staffName: string;
  role: string;
  reviewType: string;
  selfScore: number;
  supervisorScore: number;
}

interface ApprovalModalProps {
  open: boolean;
  onClose: () => void;
  review: ApprovalTarget | null;
  onActionComplete: (id: string, action: ApprovalAction) => void;
}

const ACTION_CONFIG: Record<
  ApprovalAction,
  {
    label: string;
    description: string;
    btnClass: string;
    iconName: string;
    dbStatus: string;
    toastMsg: string;
    toastDesc: string;
  }
> = {
  approve: {
    label: 'Approve',
    description: 'Confirm this evaluation is accurate and complete. The record will be finalised and the staff member notified.',
    btnClass: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    iconName: 'CheckCircleIcon',
    dbStatus: 'approved',
    toastMsg: 'Review approved',
    toastDesc: 'The evaluation has been finalised and the staff member will be notified.',
  },
  reject: {
    label: 'Reject',
    description: 'Decline this evaluation. The staff member will be notified and must resubmit from scratch.',
    btnClass: 'bg-red-600 hover:bg-red-700 text-white',
    iconName: 'XCircleIcon',
    dbStatus: 'rejected',
    toastMsg: 'Review rejected',
    toastDesc: 'The staff member has been notified to resubmit.',
  },
  request_changes: {
    label: 'Request Changes',
    description: 'Send the evaluation back to the staff member with specific feedback. They can revise and resubmit.',
    btnClass: 'bg-amber-500 hover:bg-amber-600 text-white',
    iconName: 'ArrowUturnLeftIcon',
    dbStatus: 'reviewed',
    toastMsg: 'Changes requested',
    toastDesc: 'The staff member has been notified to revise their evaluation.',
  },
};

export default function ApprovalModal({ open, onClose, review, onActionComplete }: ApprovalModalProps) {
  const [selectedAction, setSelectedAction] = useState<ApprovalAction | null>(null);
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function handleClose() {
    if (submitting) return;
    setSelectedAction(null);
    setComments('');
    onClose();
  }

  async function handleSubmit() {
    if (!review || !selectedAction) return;
    if ((selectedAction === 'reject' || selectedAction === 'request_changes') && !comments.trim()) {
      toast.error('Comments required', { description: 'Please provide a reason before submitting.' });
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createClient();
      const cfg = ACTION_CONFIG[selectedAction];

      const updatePayload: Record<string, unknown> = {
        review_status: cfg.dbStatus,
        supervisor_comments: comments.trim() || null,
      };
      if (selectedAction === 'approve') {
        updatePayload.approved_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('mid_year_reviews')
        .update(updatePayload)
        .eq('id', review.id);

      if (error) throw error;

      toast.success(cfg.toastMsg, { description: cfg.toastDesc });
      onActionComplete(review.id, selectedAction);
      handleClose();
    } catch (err) {
      console.error('Approval action failed:', err);
      toast.error('Action failed', { description: 'Please try again. If the problem persists, contact support.' });
    } finally {
      setSubmitting(false);
    }
  }

  if (!review) return null;

  const cfg = selectedAction ? ACTION_CONFIG[selectedAction] : null;
  const requiresComment = selectedAction === 'reject' || selectedAction === 'request_changes';

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Supervisor Approval Decision"
      subtitle={`${review.staffName} · ${review.reviewType}`}
      size="md"
    >
      <div className="space-y-5">
        {/* Staff summary */}
        <div className="flex items-center gap-3 p-3 bg-muted/30 border border-border rounded-lg">
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Icon name="UserCircleIcon" size={20} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-700 text-foreground truncate">{review.staffName}</p>
            <p className="text-xs text-muted-foreground truncate">{review.role} · {review.reviewType}</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-right flex-shrink-0">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Self</p>
              <p className="font-700 text-sky-700 tabular-nums">{review.selfScore}/5</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Supervisor</p>
              <p className="font-700 text-primary tabular-nums">{review.supervisorScore}/5</p>
            </div>
          </div>
        </div>

        {/* Action selection */}
        <div>
          <p className="text-xs font-700 uppercase tracking-wider text-muted-foreground mb-3">Select Decision</p>
          <div className="grid grid-cols-3 gap-2">
            {(Object.entries(ACTION_CONFIG) as [ApprovalAction, typeof ACTION_CONFIG[ApprovalAction]][]).map(
              ([action, config]) => (
                <button
                  key={action}
                  onClick={() => setSelectedAction(action)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 text-center transition-all ${
                    selectedAction === action
                      ? action === 'approve' ?'border-emerald-500 bg-emerald-50'
                        : action === 'reject' ?'border-red-500 bg-red-50' :'border-amber-400 bg-amber-50' :'border-border bg-white hover:border-muted-foreground/30 hover:bg-muted/20'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      selectedAction === action
                        ? action === 'approve' ?'bg-emerald-100'
                          : action === 'reject' ?'bg-red-100' :'bg-amber-100' :'bg-muted/50'
                    }`}
                  >
                    <Icon
                      name={config.iconName as any}
                      size={16}
                      className={
                        selectedAction === action
                          ? action === 'approve' ?'text-emerald-600'
                            : action === 'reject' ?'text-red-600' :'text-amber-600' :'text-muted-foreground'
                      }
                    />
                  </div>
                  <span
                    className={`text-xs font-700 ${
                      selectedAction === action
                        ? action === 'approve' ?'text-emerald-700'
                          : action === 'reject' ?'text-red-700' :'text-amber-700' :'text-foreground'
                    }`}
                  >
                    {config.label}
                  </span>
                </button>
              )
            )}
          </div>
        </div>

        {/* Action description */}
        {cfg && (
          <div
            className={`flex items-start gap-2.5 p-3 rounded-lg border text-xs ${
              selectedAction === 'approve' ?'bg-emerald-50 border-emerald-200 text-emerald-800'
                : selectedAction === 'reject' ?'bg-red-50 border-red-200 text-red-800' :'bg-amber-50 border-amber-200 text-amber-800'
            }`}
          >
            <Icon name="InformationCircleIcon" size={14} className="flex-shrink-0 mt-0.5" />
            <p>{cfg.description}</p>
          </div>
        )}

        {/* Comments field */}
        <div>
          <label className="block text-xs font-700 uppercase tracking-wider text-muted-foreground mb-1.5">
            Supervisor Comments
            {requiresComment && <span className="text-red-500 ml-1">*</span>}
            {!requiresComment && <span className="text-muted-foreground/60 font-400 normal-case tracking-normal ml-1">(optional)</span>}
          </label>
          <textarea
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            rows={4}
            placeholder={
              selectedAction === 'approve' ?'Add any final remarks or commendations (optional)…'
                : selectedAction === 'reject' ?'Explain why this evaluation is being rejected…'
                : selectedAction === 'request_changes' ?'Describe the specific changes needed before resubmission…' :'Select a decision above to add comments…'
            }
            disabled={!selectedAction || submitting}
            className="w-full text-sm text-foreground bg-white border border-border rounded-lg px-3 py-2.5 placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none disabled:bg-muted/30 disabled:cursor-not-allowed transition-colors"
          />
          {requiresComment && !comments.trim() && selectedAction && (
            <p className="text-[11px] text-red-500 mt-1">Comments are required for this action.</p>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-3 pt-1 border-t border-border">
          <button
            onClick={handleClose}
            disabled={submitting}
            className="px-4 py-2 text-sm font-600 text-muted-foreground border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedAction || submitting}
            className={`flex items-center gap-2 px-5 py-2 text-sm font-600 rounded-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
              cfg ? cfg.btnClass : 'bg-muted text-muted-foreground cursor-not-allowed'
            }`}
          >
            {submitting ? (
              <>
                <Icon name="ArrowPathIcon" size={14} className="animate-spin" />
                Submitting…
              </>
            ) : (
              <>
                {cfg && <Icon name={cfg.iconName as any} size={14} />}
                {cfg ? `Confirm ${cfg.label}` : 'Select a Decision'}
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
