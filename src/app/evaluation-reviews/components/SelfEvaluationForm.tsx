'use client';

import React, { useState, useEffect, useRef } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useAutosave, AutosaveStatus, autosaveStatusLabel } from '@/hooks/useAutosave';
import { getServerNow } from '@/lib/serverDate';

// ─── Types ───────────────────────────────────────────────────────────────────

interface WorkplanOption {
  id: string;
  fiscal_year: string;
  review_year: number;
  status: string;
  workflow_stage: string;
  staff_name: string;
  supervisor_name: string;
  perspectives_objectives: PerspectiveRow[];
}

interface PerspectiveRow {
  id: string;
  perspective: string;
  objective: string;
  kpis: string[];
  customKpis?: string;
  weight: number;
  target: string;
}

interface SelfEvalRow {
  perspectiveId: string;
  perspective: string;
  objective: string;
  target: string;
  kpis: string[];
  customKpis: string;
  achievement: string;
  selfRating: number;
  comments: string;
}

interface SelfEvalFormData {
  staffId: string;
  staffName: string;
  supervisorId: string;
  supervisorName: string;
  workplanId: string;
  reviewPeriod: 'mid-year' | 'annual';
  reviewYear: number;
  evalRows: SelfEvalRow[];
  overallStrengths: string;
  overallChallenges: string;
  developmentNeeds: string;
  overallSelfRating: number;
  staffSignature: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const KPI_LABELS: Record<string, string> = {
  k1: 'Budget Variance (≤5%)', k2: 'Cost Recovery Rate', k3: 'Payroll Accuracy',
  k4: 'Grant Disbursement Efficiency', k5: 'Reporting Timeliness', k6: 'Unqualified Audit Statements',
  k7: 'Revenue Growth', k8: 'Procurement Savings', k9: 'Internal SLA (48h)',
  k10: 'Employee Engagement Index', k11: 'Recruitment Efficiency', k12: 'System Availability',
  k13: 'Service Desk Resolution Rate', k14: 'Stakeholder Satisfaction', k15: 'On-Time Performance',
  k16: 'Countries at WHO Maturity 3/4', k17: 'PMS Adoption Rate', k18: 'Data Integrity',
  k19: 'Audit Readiness', k20: 'ERP Adoption Rate', k21: 'Internal Control Compliance',
  k22: 'Data Warehouse Readiness', k23: 'Automation Rate', k24: 'Logbook Accuracy',
  k25: 'CPD Completion Rate', k26: 'Staff Turnover Rate', k27: 'Leadership Development',
  k28: 'Cybersecurity Maturity', k29: 'ISO Certification Progress', k30: 'Governance Index Score',
  k31: 'Employee Retention Rate', k32: 'AI/ERP Implementation Rate',
};

const RATING_LABELS: Record<number, { label: string; color: string }> = {
  5: { label: 'Outstanding', color: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  4: { label: 'Exceeds Expectations', color: 'bg-sky-100 text-sky-700 border-sky-300' },
  3: { label: 'Meets Expectations', color: 'bg-blue-100 text-blue-700 border-blue-300' },
  2: { label: 'Needs Improvement', color: 'bg-amber-100 text-amber-700 border-amber-300' },
  1: { label: 'Unsatisfactory', color: 'bg-red-100 text-red-700 border-red-300' },
};

// Stage gates: which workflow_stage allows which review period
const STAGE_GATE: Record<'mid-year' | 'annual', string[]> = {
  'mid-year': ['workplan_approved', 'mid_year_pending', 'mid_year_approved', 'end_year_pending', 'end_year_approved'],
  'annual': ['mid_year_approved', 'end_year_pending', 'end_year_approved'],
};

const inputCls = 'w-full text-sm border border-border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors placeholder:text-muted-foreground/60';
const textareaCls = inputCls + ' resize-none';

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-600 text-foreground mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

function RatingSelector({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => onChange(r)}
            className={`w-8 h-8 rounded-md text-xs font-700 border transition-all ${
              value === r ? RATING_LABELS[r].color + ' shadow-sm scale-105' : 'bg-muted/40 border-border text-muted-foreground hover:bg-muted'
            }`}
            title={RATING_LABELS[r]?.label}
          >
            {r}
          </button>
        ))}
      </div>
      {value > 0 && (
        <p className={`text-[10px] font-600 mt-1 px-1.5 py-0.5 rounded inline-block border ${RATING_LABELS[value]?.color}`}>
          {RATING_LABELS[value]?.label}
        </p>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

interface SelfEvaluationFormProps {
  reviewPeriod: 'mid-year' | 'annual';
  onClose: () => void;
  onSubmit?: () => void;
}

export default function SelfEvaluationForm({ reviewPeriod, onClose, onSubmit }: SelfEvaluationFormProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [workplans, setWorkplans] = useState<WorkplanOption[]>([]);
  const [workplansLoading, setWorkplansLoading] = useState(true);

  // Autosave state
  const [autoSaveStatus, setAutoSaveStatus] = useState<AutosaveStatus>('idle');
  const [draftRecovered, setDraftRecovered] = useState(false);

  // Supervisor approval state (shown after submission)
  const [savedReviewId, setSavedReviewId] = useState<string | null>(null);
  const [approvalComments, setApprovalComments] = useState('');
  const [approving, setApproving] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [stageAdvanced, setStageAdvanced] = useState(false);

  // Stable supabase client ref
  const supabaseRef = useRef(createClient());

  const periodLabel = reviewPeriod === 'mid-year' ? 'Mid-Year' : 'End-Year';
  const periodColor = reviewPeriod === 'mid-year' ? 'bg-sky-600' : 'bg-violet-600';
  const nextStageLabel = reviewPeriod === 'mid-year' ? 'End-Year Evaluation' : 'Evaluation Cycle Complete';
  const nextWorkflowStage = reviewPeriod === 'mid-year' ? 'mid_year_approved' : 'end_year_approved';

  const [form, setForm] = useState<SelfEvalFormData>({
    staffId: '',
    staffName: '',
    supervisorId: '',
    supervisorName: '',
    workplanId: '',
    reviewPeriod,
    reviewYear: 2026,
    evalRows: [],
    overallStrengths: '',
    overallChallenges: '',
    developmentNeeds: '',
    overallSelfRating: 3,
    staffSignature: '',
  });

  // ── Autosave hook ────────────────────────────────────────────────────────
  const autosaveEnabled = !!form.workplanId && !!form.staffId;
  const { saveDraft, recoverDraft, clearDraft } = useAutosave({
    staffId: form.staffId || null,
    workplanId: form.workplanId || null,
    draftType: 'self_evaluation',
    reviewPeriod,
    formData: {
      evalRows: form.evalRows,
      overallStrengths: form.overallStrengths,
      overallChallenges: form.overallChallenges,
      developmentNeeds: form.developmentNeeds,
      overallSelfRating: form.overallSelfRating,
      staffSignature: form.staffSignature,
    },
    activeStep,
    enabled: autosaveEnabled,
    onStatusChange: setAutoSaveStatus,
  });

  useEffect(() => {
    async function loadWorkplans() {
      setWorkplansLoading(true);
      try {
        const allowedStages = STAGE_GATE[reviewPeriod];
        const { data, error } = await supabaseRef.current
          .from('workplan_settings')
          .select(`
            id, fiscal_year, review_year, status, workflow_stage,
            perspectives_objectives,
            staff:staff_id ( id, full_name ),
            supervisor:supervisor_id ( id, full_name )
          `)
          .eq('status', 'signed')
          .in('workflow_stage', allowedStages)
          .order('created_at', { ascending: false });

        if (error) throw error;

        const mapped: WorkplanOption[] = (data ?? []).map((row: any) => ({
          id: row.id,
          fiscal_year: row.fiscal_year,
          review_year: row.review_year,
          status: row.status,
          workflow_stage: row.workflow_stage,
          staff_name: row.staff?.full_name || '—',
          supervisor_name: row.supervisor?.full_name || '—',
          perspectives_objectives: row.perspectives_objectives || [],
          _staff_id: row.staff?.id,
          _supervisor_id: row.supervisor?.id,
        }));

        setWorkplans(mapped);
      } catch (err) {
        console.log('Error loading workplans:', err);
      } finally {
        setWorkplansLoading(false);
      }
    }
    loadWorkplans();
  }, [reviewPeriod]);

  function setField<K extends keyof SelfEvalFormData>(key: K, value: SelfEvalFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function selectWorkplan(workplanId: string) {
    const wp = workplans.find((w) => w.id === workplanId);
    if (!wp) return;

    // Carry forward objectives and KPIs from the workplan
    const evalRows: SelfEvalRow[] = (wp.perspectives_objectives || []).map((row: PerspectiveRow) => ({
      perspectiveId: row.id,
      perspective: row.perspective,
      objective: row.objective,
      target: row.target,
      kpis: row.kpis || [],
      customKpis: row.customKpis || '',
      achievement: '',
      selfRating: 3,
      comments: '',
    }));

    const wpAny = wp as any;
    const staffId = wpAny._staff_id || '';
    setForm((prev) => ({
      ...prev,
      workplanId: workplanId,
      staffName: wp.staff_name,
      supervisorName: wp.supervisor_name,
      staffId,
      supervisorId: wpAny._supervisor_id || '',
      reviewYear: wp.review_year,
      evalRows,
    }));

    // Attempt draft recovery after selecting workplan
    if (staffId) {
      recoverDraft(workplanId, staffId, reviewPeriod).then((data) => {
        if (data?.form_data) {
          const fd = data.form_data as any;
          setForm((prev) => ({
            ...prev,
            evalRows: fd.evalRows?.length ? fd.evalRows : prev.evalRows,
            overallStrengths: fd.overallStrengths || prev.overallStrengths,
            overallChallenges: fd.overallChallenges || prev.overallChallenges,
            developmentNeeds: fd.developmentNeeds || prev.developmentNeeds,
            overallSelfRating: fd.overallSelfRating || prev.overallSelfRating,
            staffSignature: fd.staffSignature || prev.staffSignature,
          }));
          if (data.active_step) setActiveStep(data.active_step);
          setDraftRecovered(true);
          setTimeout(() => setDraftRecovered(false), 5000);
        }
      });
    }
  }

  function updateEvalRow(idx: number, field: keyof SelfEvalRow, value: any) {
    setForm((prev) => {
      const rows = [...prev.evalRows];
      rows[idx] = { ...rows[idx], [field]: value };
      return { ...prev, evalRows: rows };
    });
  }

  const steps = [
    { label: 'Select Workplan', icon: 'DocumentTextIcon' },
    { label: 'Self-Assessment', icon: 'ClipboardDocumentListIcon' },
    { label: 'Overall Reflection', icon: 'ChatBubbleLeftRightIcon' },
    { label: 'Sign & Submit', icon: 'CheckBadgeIcon' },
  ];

  async function handleSubmit() {
    if (!form.workplanId) {
      setSaveError('Please select a workplan.');
      return;
    }
    if (!form.staffSignature) {
      setSaveError('Staff signature is required.');
      return;
    }

    setSaving(true);
    setSaveError(null);

    try {
      const selfAssessmentText = form.evalRows
        .map((r) => {
          const customKpiPart = r.customKpis?.trim() ? ` | Additional KPIs: ${r.customKpis.trim()}` : '';
          return `[${r.perspective}] ${r.objective} | Target: ${r.target} | Achievement: ${r.achievement} | Rating: ${r.selfRating}/5 | Comments: ${r.comments}${customKpiPart}`;
        })
        .join('\n');

      const payload: Record<string, any> = {
        workplan_id: form.workplanId,
        staff_id: form.staffId || null,
        supervisor_id: form.supervisorId || null,
        review_period: reviewPeriod === 'mid-year' ? 'mid-year' : 'annual',
        review_year: form.reviewYear,
        review_status: 'submitted',
        kpi_achievements: selfAssessmentText || null,
        challenges_faced: form.overallChallenges || null,
        support_needed: form.developmentNeeds || null,
        self_rating: form.overallSelfRating,
        submitted_at: await getServerNow(),
      };

      const { data, error } = await supabaseRef.current.from('mid_year_reviews').insert(payload).select('id').single();
      if (error) {
        setSaveError(error.message || 'Failed to save evaluation. Please try again.');
        return;
      }

      // Mark workplan stage as pending supervisor approval for this period
      const pendingStage = reviewPeriod === 'mid-year' ? 'mid_year_pending' : 'end_year_pending';
      await supabaseRef.current
        .from('workplan_settings')
        .update({ workflow_stage: pendingStage })
        .eq('id', form.workplanId);

      // Log activity
      await supabaseRef.current.from('activity_logs').insert({
        activity_type: `${reviewPeriod}_submitted`,
        actor_name: form.staffName || 'Staff',
        action_description: `submitted ${periodLabel} self-evaluation — awaiting supervisor approval`,
        subject_name: form.staffName,
        subject_detail: form.reviewYear.toString(),
        icon_name: reviewPeriod === 'mid-year' ? 'ClipboardDocumentListIcon' : 'CheckBadgeIcon',
        icon_bg: reviewPeriod === 'mid-year' ? 'bg-sky-50' : 'bg-violet-50',
        icon_color: reviewPeriod === 'mid-year' ? 'text-sky-600' : 'text-violet-600',
      }).then(() => {});

      setSavedReviewId(data?.id ?? null);

      // Notify supervisor that appraisal is ready for evaluation
      if (form.supervisorId) {
        await supabaseRef.current.from('notifications').insert({
          recipient_staff_id: form.supervisorId,
          type: 'appraisal_submitted',
          title: 'Appraisal Ready for Evaluation',
          message: `${form.staffName || 'A staff member'} has submitted their ${periodLabel} self-evaluation and it is ready for your review and approval.`,
          related_id: form.workplanId,
          related_type: 'workplan',
        });
      }

      // Clear draft after successful submission
      if (form.staffId) {
        await clearDraft(form.workplanId, form.staffId, reviewPeriod);
      }

      setSubmitted(true);
    } catch (err: any) {
      setSaveError('An unexpected error occurred. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSupervisorApprove() {
    if (!savedReviewId || !form.workplanId) return;
    setApproving(true);
    setApprovalError(null);
    try {
      // Approve the review record
      const { error: reviewError } = await supabaseRef.current
        .from('mid_year_reviews')
        .update({
          review_status: 'approved',
          supervisor_comments: approvalComments || null,
          supervisor_reviewed_at: await getServerNow(),
          approved_at: await getServerNow(),
          stage_approved_at: await getServerNow(),
          stage_approval_comments: approvalComments || null,
        })
        .eq('id', savedReviewId);

      if (reviewError) {
        setApprovalError(reviewError.message || 'Failed to approve evaluation.');
        return;
      }

      // Advance workplan workflow stage
      const { error: stageError } = await supabaseRef.current
        .from('workplan_settings')
        .update({
          workflow_stage: nextWorkflowStage,
          supervisor_approved_at: await getServerNow(),
        })
        .eq('id', form.workplanId);

      if (stageError) {
        setApprovalError(stageError.message || 'Failed to advance workflow stage.');
        return;
      }

      // Log activity
      await supabaseRef.current.from('activity_logs').insert({
        activity_type: `${reviewPeriod}_approved`,
        actor_name: form.supervisorName || 'Supervisor',
        action_description: `approved ${periodLabel} evaluation — ${reviewPeriod === 'mid-year' ? 'End-Year evaluation now unlocked' : 'evaluation cycle complete'}`,
        subject_name: form.staffName,
        subject_detail: form.reviewYear.toString(),
        icon_name: 'CheckBadgeIcon',
        icon_bg: 'bg-emerald-50',
        icon_color: 'text-emerald-600',
      }).then(() => {});

      setStageAdvanced(true);
      onSubmit?.();
    } catch (err: any) {
      setApprovalError('An unexpected error occurred.');
    } finally {
      setApproving(false);
    }
  }

  // ── Stage advanced confirmation ──────────────────────────────────────────
  if (stageAdvanced) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${reviewPeriod === 'mid-year' ? 'bg-sky-100' : 'bg-violet-100'}`}>
          <Icon name="CheckBadgeIcon" size={36} className={reviewPeriod === 'mid-year' ? 'text-sky-600' : 'text-violet-600'} />
        </div>
        <h3 className="text-lg font-700 text-foreground mb-2">
          {periodLabel} Approved — {reviewPeriod === 'mid-year' ? 'End-Year Unlocked' : 'Cycle Complete'}
        </h3>
        <p className="text-sm text-muted-foreground mb-1">
          The {periodLabel.toLowerCase()} evaluation for <span className="font-600 text-foreground">{form.staffName}</span> has been approved.
        </p>
        <p className="text-xs text-muted-foreground mb-6">
          {reviewPeriod === 'mid-year' ?'Stage 3 (End-Year Self-Evaluation) is now available for this staff member.' :'The full evaluation cycle for this staff member is now complete.'}
        </p>
        <button onClick={onClose} className="px-5 py-2 bg-primary text-white text-sm font-600 rounded-lg hover:bg-primary/90 transition-colors">
          Close
        </button>
      </div>
    );
  }

  // ── Submitted — awaiting supervisor approval ─────────────────────────────
  if (submitted) {
    const stageSteps = reviewPeriod === 'mid-year'
      ? [
          { label: 'Workplan Approved', done: true },
          { label: 'Mid-Year Submitted', done: true },
          { label: 'Supervisor Approval', done: false, active: true },
          { label: 'End-Year Unlocked', done: false },
        ]
      : [
          { label: 'Mid-Year Approved', done: true },
          { label: 'End-Year Submitted', done: true },
          { label: 'Supervisor Approval', done: false, active: true },
          { label: 'Cycle Complete', done: false },
        ];

    return (
      <div className="flex flex-col h-full overflow-y-auto p-6 space-y-5">
        {/* Success banner */}
        <div className={`flex items-center gap-3 rounded-xl border p-4 ${reviewPeriod === 'mid-year' ? 'bg-sky-50 border-sky-200' : 'bg-violet-50 border-violet-200'}`}>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${reviewPeriod === 'mid-year' ? 'bg-sky-100' : 'bg-violet-100'}`}>
            <Icon name="CheckCircleIcon" size={22} className={reviewPeriod === 'mid-year' ? 'text-sky-600' : 'text-violet-600'} />
          </div>
          <div>
            <p className={`text-sm font-700 ${reviewPeriod === 'mid-year' ? 'text-sky-800' : 'text-violet-800'}`}>{periodLabel} Self-Evaluation Submitted</p>
            <p className={`text-xs mt-0.5 ${reviewPeriod === 'mid-year' ? 'text-sky-700' : 'text-violet-700'}`}>
              Submitted for <span className="font-600">{form.staffName}</span>. Awaiting supervisor approval to unlock the next stage.
            </p>
          </div>
        </div>

        {/* Workflow stage indicator */}
        <div className="bg-white border border-border rounded-xl p-4">
          <p className="text-xs font-700 text-foreground mb-3 flex items-center gap-1.5">
            <Icon name="ArrowsRightLeftIcon" size={13} className="text-primary" />
            Evaluation Workflow Progress
          </p>
          <div className="flex items-center gap-2">
            {stageSteps.map((s, i) => (
              <React.Fragment key={s.label}>
                <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-700 flex-shrink-0 ${
                    s.done ? 'bg-emerald-500 text-white' : (s as any).active ? 'bg-primary text-white ring-2 ring-primary/30' : 'bg-muted border border-border text-muted-foreground'
                  }`}>
                    {s.done ? <Icon name="CheckIcon" size={10} /> : i + 1}
                  </div>
                  <span className={`text-[9px] font-600 text-center leading-tight ${(s as any).active ? 'text-primary' : s.done ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                    {s.label}
                  </span>
                </div>
                {i < stageSteps.length - 1 && <div className="h-px w-4 bg-border flex-shrink-0 mb-3" />}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Supervisor approval section */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-4">
          <div className="flex items-start gap-2">
            <Icon name="ExclamationTriangleIcon" size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-700 text-amber-800">Supervisor Approval Required</p>
              <p className="text-xs text-amber-700 mt-0.5">
                <span className="font-600">{form.supervisorName || 'The supervisor'}</span> must approve this {periodLabel.toLowerCase()} evaluation to unlock <span className="font-600">{nextStageLabel}</span> for {form.staffName}.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-600 text-amber-800 mb-1.5">Supervisor Comments (optional)</label>
            <textarea
              className="w-full text-sm border border-amber-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none placeholder:text-muted-foreground/60"
              rows={2}
              placeholder="Add feedback or comments for the staff member…"
              value={approvalComments}
              onChange={(e) => setApprovalComments(e.target.value)}
            />
          </div>

          {approvalError && (
            <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <Icon name="ExclamationCircleIcon" size={14} className="text-red-500 flex-shrink-0" />
              {approvalError}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={handleSupervisorApprove}
              disabled={approving}
              className="flex items-center gap-2 px-5 py-2 text-xs font-600 text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-60"
            >
              {approving ? (
                <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Approving…</>
              ) : (
                <><Icon name="CheckBadgeIcon" size={14} /> Approve & Unlock {reviewPeriod === 'mid-year' ? 'End-Year' : 'Complete Cycle'}</>
              )}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-600 text-muted-foreground border border-border rounded-lg hover:bg-muted/50 transition-colors"
            >
              Close (Approve Later)
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Stepper */}
      <div className="px-5 pt-4 pb-3 border-b border-border bg-muted/20">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
            {steps.map((s, i) => (
              <button
                key={s.label}
                type="button"
                onClick={() => setActiveStep(i)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-600 whitespace-nowrap transition-all flex-shrink-0 ${
                  i === activeStep
                    ? `${periodColor} text-white shadow-sm`
                    : i < activeStep
                    ? 'bg-emerald-100 text-emerald-700' :'bg-white border border-border text-muted-foreground hover:bg-muted/50'
                }`}
              >
                {i < activeStep ? <Icon name="CheckIcon" size={11} /> : <Icon name={s.icon as any} size={11} />}
                <span className="hidden sm:inline">{s.label}</span>
                <span className="sm:hidden">{i + 1}</span>
              </button>
            ))}
          </div>
          {/* Autosave status badge */}
          {autosaveEnabled && (
            <div className="flex items-center gap-2 flex-shrink-0">
              {draftRecovered && (
                <span className="text-[10px] font-600 text-sky-700 bg-sky-50 border border-sky-200 px-2 py-1 rounded-lg flex items-center gap-1">
                  <Icon name="ArrowPathIcon" size={11} />
                  Draft restored
                </span>
              )}
              <span className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg border ${
                autoSaveStatus === 'saving' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                autoSaveStatus === 'saved' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                autoSaveStatus === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-muted border-border text-muted-foreground'
              }`}>
                {autoSaveStatus === 'saving' && <span className="w-3 h-3 border border-amber-500 border-t-transparent rounded-full animate-spin" />}
                {autoSaveStatus === 'saved' && <Icon name="CheckCircleIcon" size={12} className="text-emerald-600" />}
                {autoSaveStatus === 'error' && <Icon name="ExclamationTriangleIcon" size={12} className="text-red-600" />}
                {autoSaveStatus === 'idle' && <Icon name="CloudArrowUpIcon" size={12} className="text-muted-foreground" />}
                {autosaveStatusLabel(autoSaveStatus)}
              </span>
              <button
                type="button"
                onClick={() => saveDraft(false)}
                className="flex items-center gap-1 text-[11px] font-600 text-primary border border-primary/30 px-2.5 py-1 rounded-lg hover:bg-primary/5 transition-colors"
              >
                <Icon name="CloudArrowUpIcon" size={12} />
                Save Draft
              </button>
            </div>
          )}
        </div>
        <div className="mt-2 h-1 bg-border rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${reviewPeriod === 'mid-year' ? 'bg-sky-600' : 'bg-violet-600'}`}
            style={{ width: `${((activeStep + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">

        {/* ── Step 0: Select Workplan ── */}
        {activeStep === 0 && (
          <div className="space-y-5">
            <div className="flex items-start gap-3 mb-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${reviewPeriod === 'mid-year' ? 'bg-sky-100' : 'bg-violet-100'}`}>
                <span className={`text-xs font-800 ${reviewPeriod === 'mid-year' ? 'text-sky-700' : 'text-violet-700'}`}>1</span>
              </div>
              <div>
                <h3 className="text-sm font-700 text-foreground">{periodLabel} Self-Evaluation</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Select the approved workplan to evaluate against — objectives and KPIs carry forward automatically</p>
              </div>
            </div>

            <div className={`rounded-xl border p-4 text-xs flex items-start gap-2 ${reviewPeriod === 'mid-year' ? 'bg-sky-50 border-sky-200 text-sky-800' : 'bg-violet-50 border-violet-200 text-violet-800'}`}>
              <Icon name="InformationCircleIcon" size={14} className="flex-shrink-0 mt-0.5" />
              <span>
                {reviewPeriod === 'mid-year' ?'This Mid-Year Self-Evaluation is completed in December–January. Only workplans approved by a supervisor are shown. Your objectives and KPIs are pre-loaded from the approved workplan.' :'This End-Year Self-Evaluation is completed in May–June. Only workplans with an approved Mid-Year evaluation are shown. Your objectives and KPIs carry forward from the workplan.'}
              </span>
            </div>

            {workplansLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                Loading eligible workplans…
              </div>
            ) : workplans.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Icon name="LockClosedIcon" size={32} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm font-600">No eligible workplans found</p>
                <p className="text-xs mt-1 max-w-xs mx-auto">
                  {reviewPeriod === 'mid-year' ?'A Workplan must be signed and approved by a supervisor before the Mid-Year evaluation can begin.' :'The Mid-Year evaluation must be completed and approved by a supervisor before the End-Year evaluation can begin.'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="block text-xs font-600 text-foreground mb-2">Select Workplan <span className="text-red-500">*</span></label>
                {workplans.map((wp) => {
                  const stageLabel =
                    wp.workflow_stage === 'workplan_approved' ? 'Workplan Approved' :
                    wp.workflow_stage === 'mid_year_pending' ? 'Mid-Year Pending Approval' :
                    wp.workflow_stage === 'mid_year_approved' ? 'Mid-Year Approved' :
                    wp.workflow_stage === 'end_year_pending' ? 'End-Year Pending Approval' :
                    wp.workflow_stage === 'end_year_approved' ? 'End-Year Approved' : wp.workflow_stage;
                  const stageBadge =
                    wp.workflow_stage === 'workplan_approved' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                    wp.workflow_stage === 'mid_year_approved'? 'bg-sky-100 text-sky-700 border-sky-200' : 'bg-amber-100 text-amber-700 border-amber-200';

                  return (
                    <button
                      key={wp.id}
                      type="button"
                      onClick={() => selectWorkplan(wp.id)}
                      className={`w-full text-left rounded-xl border p-4 transition-all ${
                        form.workplanId === wp.id
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-border bg-white hover:border-primary/40 hover:bg-muted/20'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-600 text-foreground">{wp.staff_name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{wp.fiscal_year} · Supervisor: {wp.supervisor_name}</p>
                          <p className="text-xs text-muted-foreground">{wp.perspectives_objectives?.length || 0} objectives · KPIs carry forward</p>
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                          <span className={`text-[10px] font-600 px-2 py-0.5 rounded-full border ${stageBadge}`}>{stageLabel}</span>
                          {form.workplanId === wp.id && <Icon name="CheckCircleIcon" size={16} className="text-primary" />}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Step 1: Self-Assessment per Objective ── */}
        {activeStep === 1 && (
          <div className="space-y-5">
            <div className="flex items-start gap-3 mb-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${reviewPeriod === 'mid-year' ? 'bg-sky-100' : 'bg-violet-100'}`}>
                <span className={`text-xs font-800 ${reviewPeriod === 'mid-year' ? 'text-sky-700' : 'text-violet-700'}`}>2</span>
              </div>
              <div>
                <h3 className="text-sm font-700 text-foreground">Self-Assessment by Objective</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Objectives and KPIs are pre-loaded from your approved workplan</p>
              </div>
            </div>

            {form.evalRows.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Please go back and select a workplan first.
              </div>
            ) : (
              <div className="space-y-4">
                {form.evalRows.map((row, idx) => (
                  <div key={row.perspectiveId} className="rounded-xl border border-border bg-white p-4 space-y-3">
                    <div className="flex items-start gap-2">
                      <span className={`text-[10px] font-700 px-2 py-0.5 rounded-full border flex-shrink-0 ${
                        row.perspective === 'Finance / Stewardship' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                        row.perspective === 'Customer / Operations' ? 'bg-sky-50 border-sky-200 text-sky-700' :
                        row.perspective === 'Business Process' ? 'bg-violet-50 border-violet-200 text-violet-700' :
                        'bg-amber-50 border-amber-200 text-amber-700'
                      }`}>{row.perspective}</span>
                    </div>

                    <div>
                      <p className="text-xs font-600 text-foreground">{row.objective || 'No objective set'}</p>
                      {row.target && <p className="text-xs text-muted-foreground mt-0.5">Target: {row.target}</p>}
                    </div>

                    {/* KPIs carried forward from workplan */}
                    {row.kpis && row.kpis.length > 0 && (
                      <div className="bg-muted/30 rounded-lg p-2.5">
                        <p className="text-[10px] font-700 text-muted-foreground uppercase tracking-wide mb-1.5">KPIs from Workplan</p>
                        <div className="flex flex-wrap gap-1">
                          {row.kpis.map((kpiId) => (
                            <span key={kpiId} className="text-[10px] px-2 py-0.5 bg-white border border-border rounded-full text-foreground">
                              {KPI_LABELS[kpiId] || kpiId}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Custom KPIs from workplan */}
                    {row.customKpis && row.customKpis.trim() && (
                      <div className="bg-primary/5 border border-primary/20 rounded-lg p-2.5">
                        <p className="text-[10px] font-700 text-primary uppercase tracking-wide mb-1">Additional KPIs (from Workplan)</p>
                        <p className="text-xs text-foreground whitespace-pre-line">{row.customKpis}</p>
                      </div>
                    )}

                    {/* Additional custom KPIs during self-evaluation */}
                    <div className="border border-dashed border-border/60 rounded-lg p-2.5">
                      <label className="block text-[10px] font-700 text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1">
                        <Icon name="PencilSquareIcon" size={11} className="text-primary" />
                        Additional KPIs not captured above
                      </label>
                      <textarea
                        className="w-full text-xs border border-border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors placeholder:text-muted-foreground/60 resize-none"
                        rows={2}
                        placeholder="Enter any KPIs specific to this objective that were not in the original workplan…"
                        value={row.customKpis}
                        onChange={(e) => updateEvalRow(idx, 'customKpis', e.target.value)}
                      />
                    </div>

                    <FormField label="What did you achieve against this objective?">
                      <textarea
                        className={textareaCls}
                        rows={2}
                        placeholder="Describe your actual achievements, outputs, and results…"
                        value={row.achievement}
                        onChange={(e) => updateEvalRow(idx, 'achievement', e.target.value)}
                      />
                    </FormField>

                    <div>
                      <label className="block text-xs font-600 text-foreground mb-1.5">Self-Rating</label>
                      <RatingSelector value={row.selfRating} onChange={(v) => updateEvalRow(idx, 'selfRating', v)} />
                    </div>

                    <FormField label="Comments / Justification">
                      <textarea
                        className={textareaCls}
                        rows={2}
                        placeholder="Provide context, evidence, or justification for your rating…"
                        value={row.comments}
                        onChange={(e) => updateEvalRow(idx, 'comments', e.target.value)}
                      />
                    </FormField>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Step 2: Overall Reflection ── */}
        {activeStep === 2 && (
          <div className="space-y-5">
            <div className="flex items-start gap-3 mb-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${reviewPeriod === 'mid-year' ? 'bg-sky-100' : 'bg-violet-100'}`}>
                <span className={`text-xs font-800 ${reviewPeriod === 'mid-year' ? 'text-sky-700' : 'text-violet-700'}`}>3</span>
              </div>
              <div>
                <h3 className="text-sm font-700 text-foreground">Overall Reflection</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Provide an overall self-assessment summary for the {periodLabel.toLowerCase()} period</p>
              </div>
            </div>

            <FormField label="Key Strengths & Achievements">
              <textarea
                className={textareaCls}
                rows={3}
                placeholder="What are your key strengths and notable achievements this period?"
                value={form.overallStrengths}
                onChange={(e) => setField('overallStrengths', e.target.value)}
              />
            </FormField>

            <FormField label="Challenges Faced">
              <textarea
                className={textareaCls}
                rows={3}
                placeholder="What challenges or obstacles did you encounter?"
                value={form.overallChallenges}
                onChange={(e) => setField('overallChallenges', e.target.value)}
              />
            </FormField>

            <FormField label="Development Needs & Support Required">
              <textarea
                className={textareaCls}
                rows={3}
                placeholder="What training, resources, or support do you need to improve performance?"
                value={form.developmentNeeds}
                onChange={(e) => setField('developmentNeeds', e.target.value)}
              />
            </FormField>

            <div>
              <label className="block text-xs font-600 text-foreground mb-2">Overall Self-Rating</label>
              <RatingSelector value={form.overallSelfRating} onChange={(v) => setField('overallSelfRating', v)} />
            </div>
          </div>
        )}

        {/* ── Step 3: Sign & Submit ── */}
        {activeStep === 3 && (
          <div className="space-y-5">
            <div className="flex items-start gap-3 mb-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${reviewPeriod === 'mid-year' ? 'bg-sky-100' : 'bg-violet-100'}`}>
                <span className={`text-xs font-800 ${reviewPeriod === 'mid-year' ? 'text-sky-700' : 'text-violet-700'}`}>4</span>
              </div>
              <div>
                <h3 className="text-sm font-700 text-foreground">Sign & Submit</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Review your self-evaluation and submit for supervisor approval</p>
              </div>
            </div>

            {/* Summary */}
            <div className="bg-muted/30 rounded-xl border border-border p-4 space-y-2">
              <p className="text-xs font-700 text-foreground mb-2">Submission Summary</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-muted-foreground">Staff:</span> <span className="font-600">{form.staffName || '—'}</span></div>
                <div><span className="text-muted-foreground">Period:</span> <span className="font-600">{periodLabel}</span></div>
                <div><span className="text-muted-foreground">Year:</span> <span className="font-600">{form.reviewYear}</span></div>
                <div><span className="text-muted-foreground">Overall Rating:</span> <span className="font-600">{form.overallSelfRating}/5 — {RATING_LABELS[form.overallSelfRating]?.label}</span></div>
              </div>
              <div className="mt-2 space-y-1">
                {form.evalRows.map((row, i) => (
                  <div key={row.perspectiveId} className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground flex-shrink-0">#{i + 1}</span>
                    <span className="text-foreground truncate">{row.perspective}</span>
                    <span className="ml-auto font-600 text-foreground flex-shrink-0">{row.selfRating}/5</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800 flex items-start gap-2">
              <Icon name="ExclamationTriangleIcon" size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <span>By signing, you confirm that this self-evaluation accurately reflects your performance. It will be submitted to <span className="font-600">{form.supervisorName || 'your supervisor'}</span> for approval. Approval unlocks the next evaluation stage.</span>
            </div>

            <FormField label={`Staff Signature (${form.staffName || 'Staff Member'})`} required>
              <input
                className={inputCls}
                placeholder="Type your full name as signature…"
                value={form.staffSignature}
                onChange={(e) => setField('staffSignature', e.target.value)}
              />
            </FormField>

            {saveError && (
              <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <Icon name="ExclamationCircleIcon" size={14} className="text-red-500 flex-shrink-0" />
                {saveError}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-border bg-white flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={activeStep === 0 ? onClose : () => setActiveStep((s) => s - 1)}
          className="px-4 py-2 text-xs font-600 text-muted-foreground border border-border rounded-lg hover:bg-muted/50 transition-colors"
        >
          {activeStep === 0 ? 'Cancel' : '← Back'}
        </button>

        {activeStep < steps.length - 1 ? (
          <button
            type="button"
            onClick={() => setActiveStep((s) => s + 1)}
            className={`px-5 py-2 text-xs font-600 text-white rounded-lg transition-colors ${reviewPeriod === 'mid-year' ? 'bg-sky-600 hover:bg-sky-700' : 'bg-violet-600 hover:bg-violet-700'}`}
          >
            Next →
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 text-xs font-600 text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-60"
          >
            {saving ? (
              <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Submitting…</>
            ) : (
              <><Icon name="PaperAirplaneIcon" size={14} /> Submit {periodLabel} Evaluation</>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
