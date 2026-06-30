'use client';

import React, { useState } from 'react';
import Modal from '@/components/ui/Modal';
import StatusBadge from '@/components/ui/StatusBadge';
import ProgressBar from '@/components/ui/ProgressBar';
import Icon from '@/components/ui/AppIcon';
import { exportAppraisalPDF } from './ExportUtils';
import { toast } from 'sonner';

interface ReviewRecord {
  id: string;
  staffName: string;
  role: string;
  department?: string;
  reviewType: string;
  status: 'pending' | 'in-progress' | 'submitted' | 'approved' | 'overdue';
  dueDate: string;
  submittedDate?: string;
  supervisor: string;
  selfScore: number;
  supervisorScore: number;
  bscScores: { perspective: string; selfScore: number; supervisorScore: number; weight: number }[];
  kpiDetails: { kpi: string; perspective: string; target: string; actual: string; selfRating: number; supervisorRating: number; status: 'on-track' | 'at-risk' | 'overdue' | 'achieved' | 'in-progress' }[];
  comments: string;
}

interface ReviewDetailModalProps {
  review: ReviewRecord | null;
  open: boolean;
  onClose: () => void;
  onApprove: (id: string) => void;
}

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

export default function ReviewDetailModal({ review, open, onClose, onApprove }: ReviewDetailModalProps) {
  const [exporting, setExporting] = useState(false);

  if (!review) return null;

  const canExport = review.status === 'approved' || review.status === 'submitted';

  async function handleExportPDF() {
    setExporting(true);
    try {
      await exportAppraisalPDF({
        staffName: review!.staffName,
        role: review!.role,
        department: review!.department ?? '—',
        supervisor: review!.supervisor,
        reviewType: review!.reviewType,
        status: review!.status,
        dueDate: review!.dueDate,
        submittedDate: review!.submittedDate,
        selfScore: review!.selfScore,
        supervisorScore: review!.supervisorScore,
        overallProgress: review!.selfScore > 0 && review!.supervisorScore > 0 ? 100 : 50,
        bscScores: review!.bscScores,
        kpiDetails: review!.kpiDetails,
        comments: review!.comments,
      });
      toast.success('Appraisal PDF downloaded', { description: `${review!.staffName} — ${review!.reviewType}` });
    } catch (err) {
      console.error('PDF export error:', err);
      toast.error('PDF export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Review — ${review.staffName}`} subtitle={`${review.reviewType} · ${review.role}`} size="xl">
      <div className="space-y-6">
        {/* Header summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg border border-border">
          <div>
            <p className="text-[10px] font-600 uppercase tracking-wider text-muted-foreground mb-1">Review Type</p>
            <p className="text-sm font-700 text-foreground">{review.reviewType}</p>
          </div>
          <div>
            <p className="text-[10px] font-600 uppercase tracking-wider text-muted-foreground mb-1">Status</p>
            <StatusBadge status={review.status} />
          </div>
          <div>
            <p className="text-[10px] font-600 uppercase tracking-wider text-muted-foreground mb-1">Due Date</p>
            <p className="text-sm font-600 text-foreground">{review.dueDate}</p>
          </div>
          <div>
            <p className="text-[10px] font-600 uppercase tracking-wider text-muted-foreground mb-1">Supervisor</p>
            <p className="text-sm font-500 text-foreground">{review.supervisor}</p>
          </div>
        </div>

        {/* Score comparison */}
        <div>
          <h4 className="text-xs font-700 uppercase tracking-wider text-muted-foreground mb-3">Overall Score Comparison</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-sky-50 border border-sky-200 rounded-lg">
              <p className="text-[11px] font-600 text-sky-700 mb-1">Self Assessment</p>
              <p className="text-3xl font-700 text-sky-800 tabular-nums font-mono">{review.selfScore}<span className="text-base font-500 ml-1">/5.0</span></p>
              <p className="text-xs text-sky-600 mt-1">{RATING_LABELS[Math.round(review.selfScore)] ?? 'Meets Expectations'}</p>
            </div>
            <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
              <p className="text-[11px] font-600 text-primary mb-1">Supervisor Rating</p>
              <p className="text-3xl font-700 text-primary tabular-nums font-mono">{review.supervisorScore}<span className="text-base font-500 ml-1">/5.0</span></p>
              <p className="text-xs text-primary/80 mt-1">{RATING_LABELS[Math.round(review.supervisorScore)] ?? 'Meets Expectations'}</p>
            </div>
          </div>
        </div>

        {/* BSC Perspective Breakdown */}
        <div>
          <h4 className="text-xs font-700 uppercase tracking-wider text-muted-foreground mb-3">BSC Perspective Scores</h4>
          <div className="space-y-3">
            {review.bscScores.map((b, i) => (
              <div key={`bsc-modal-${i}`} className="grid grid-cols-3 items-center gap-4 p-3 bg-muted/20 rounded-lg border border-border">
                <div>
                  <p className="text-xs font-600 text-foreground">{b.perspective}</p>
                  <p className="text-[10px] text-muted-foreground">Weight: {b.weight}%</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground w-8">Self</span>
                  <ProgressBar value={b.selfScore * 20} colorClass="bg-sky-400" height="h-1.5" className="flex-1" />
                  <span className="text-xs font-700 tabular-nums text-sky-700 w-6">{b.selfScore}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground w-8">Sup.</span>
                  <ProgressBar value={b.supervisorScore * 20} colorClass="bg-primary" height="h-1.5" className="flex-1" />
                  <span className="text-xs font-700 tabular-nums text-primary w-6">{b.supervisorScore}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* KPI Details */}
        <div>
          <h4 className="text-xs font-700 uppercase tracking-wider text-muted-foreground mb-3">KPI Performance Details</h4>
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left pb-2 font-600 text-muted-foreground">KPI</th>
                  <th className="text-left pb-2 font-600 text-muted-foreground">Perspective</th>
                  <th className="text-left pb-2 font-600 text-muted-foreground">Target</th>
                  <th className="text-left pb-2 font-600 text-muted-foreground">Actual</th>
                  <th className="text-center pb-2 font-600 text-muted-foreground">Self</th>
                  <th className="text-center pb-2 font-600 text-muted-foreground">Sup.</th>
                  <th className="text-left pb-2 font-600 text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {review.kpiDetails.map((k, i) => (
                  <tr key={`kpi-modal-${i}`} className="border-b border-border last:border-0">
                    <td className="py-2.5 pr-3 font-500 text-foreground">{k.kpi}</td>
                    <td className="py-2.5 pr-3 text-muted-foreground">{k.perspective}</td>
                    <td className="py-2.5 pr-3 tabular-nums text-muted-foreground">{k.target}</td>
                    <td className="py-2.5 pr-3 tabular-nums font-700 text-foreground">{k.actual}</td>
                    <td className={`py-2.5 text-center font-700 tabular-nums ${RATING_COLORS[k.selfRating] ?? 'text-foreground'}`}>{k.selfRating}</td>
                    <td className={`py-2.5 text-center font-700 tabular-nums ${RATING_COLORS[k.supervisorRating] ?? 'text-foreground'}`}>{k.supervisorRating}</td>
                    <td className="py-2.5">
                      <StatusBadge status={k.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Comments */}
        {review.comments && (
          <div>
            <h4 className="text-xs font-700 uppercase tracking-wider text-muted-foreground mb-2">Supervisor Comments</h4>
            <p className="text-sm text-foreground bg-muted/30 border border-border rounded-lg p-3 leading-relaxed">{review.comments}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-border">
          {/* Export PDF button — shown for submitted or approved appraisals */}
          {canExport && (
            <button
              onClick={handleExportPDF}
              disabled={exporting}
              className="flex items-center gap-2 px-4 py-2 text-sm font-600 text-white bg-[#1e40af] rounded-lg hover:bg-[#1d3a9e] transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
              title="Download appraisal as PDF with ECSA-HC branding"
            >
              {exporting ? (
                <Icon name="ArrowPathIcon" size={15} className="animate-spin" />
              ) : (
                <Icon name="DocumentArrowDownIcon" size={15} />
              )}
              {exporting ? 'Generating PDF…' : 'Export Appraisal PDF'}
            </button>
          )}

          <div className="flex items-center gap-3 ml-auto">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-600 text-muted-foreground border border-border rounded-lg hover:bg-muted transition-colors"
            >
              Close
            </button>
            {review.status === 'submitted' && (
              <button
                onClick={() => { onApprove(review.id); onClose(); }}
                className="px-4 py-2 text-sm font-600 text-white bg-primary rounded-lg hover:bg-primary/90 transition-all active:scale-95 flex items-center gap-2"
              >
                <Icon name="CheckIcon" size={15} />
                Approve Review
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}