import React from 'react';

type StatusVariant =
  | 'on-track' |'at-risk' |'overdue' |'achieved' |'missed' |'not-started' |'pending' |'approved' |'submitted' |'in-progress' |'draft' |'completed';

const VARIANT_STYLES: Record<StatusVariant, string> = {
  'on-track': 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  'at-risk': 'bg-amber-50 text-amber-700 border border-amber-200',
  'overdue': 'bg-red-50 text-red-700 border border-red-200',
  'achieved': 'bg-emerald-100 text-emerald-800 border border-emerald-300',
  'missed': 'bg-red-100 text-red-800 border border-red-300',
  'not-started': 'bg-slate-50 text-slate-600 border border-slate-200',
  'pending': 'bg-amber-50 text-amber-700 border border-amber-200',
  'approved': 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  'submitted': 'bg-blue-50 text-blue-700 border border-blue-200',
  'in-progress': 'bg-sky-50 text-sky-700 border border-sky-200',
  'draft': 'bg-slate-50 text-slate-600 border border-slate-200',
  'completed': 'bg-emerald-50 text-emerald-700 border border-emerald-200',
};

const VARIANT_LABELS: Record<StatusVariant, string> = {
  'on-track': 'On Track',
  'at-risk': 'At Risk',
  'overdue': 'Overdue',
  'achieved': 'Achieved',
  'missed': 'Missed',
  'not-started': 'Not Started',
  'pending': 'Pending',
  'approved': 'Approved',
  'submitted': 'Submitted',
  'in-progress': 'In Progress',
  'draft': 'Draft',
  'completed': 'Completed',
};

interface StatusBadgeProps {
  status: StatusVariant;
  className?: string;
}

export default function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-600 leading-none ${VARIANT_STYLES[status]} ${className}`}
    >
      {VARIANT_LABELS[status]}
    </span>
  );
}