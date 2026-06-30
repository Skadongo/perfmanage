'use client';

import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface WorkplanOption {
  id: string;
  fiscal_year: string;
  review_year: number;
  workflow_stage: string;
  staff_name: string;
  staff_id: string;
  supervisor_name: string;
  supervisor_id: string;
  perspectives_objectives: PerspectiveRow[];
  general_competencies: GeneralCompetency[];
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

interface KPIAssessment {
  rowId: string;
  perspective: string;
  objective: string;
  target: string;
  kpis: string[];
  weight: number;
  achievement: string;
  selfRating: number;
  narrativeComment: string;
}

interface CompetencyAssessment {
  id: string;
  name: string;
  description: string;
  weight: number;
  selfRating: number;
  evidence: string;
  narrativeComment: string;
}

interface ObjectiveAssessment {
  rowId: string;
  perspective: string;
  objective: string;
  target: string;
  keyActivities: string;
  progressStatus: 'achieved' | 'partially_achieved' | 'not_achieved' | '';
  progressPercent: number;
  narrativeComment: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const RATING_CONFIG: Record<number, { label: string; color: string; bg: string }> = {
  5: { label: 'Outstanding',          color: 'text-emerald-700', bg: 'bg-emerald-100 border-emerald-300' },
  4: { label: 'Exceeds Expectations', color: 'text-sky-700',     bg: 'bg-sky-100 border-sky-300' },
  3: { label: 'Meets Expectations',   color: 'text-blue-700',    bg: 'bg-blue-100 border-blue-300' },
  2: { label: 'Needs Improvement',    color: 'text-amber-700',   bg: 'bg-amber-100 border-amber-300' },
  1: { label: 'Unsatisfactory',       color: 'text-red-700',     bg: 'bg-red-100 border-red-300' },
};

const PROGRESS_STATUS_CONFIG = {
  achieved:           { label: 'Fully Achieved',      color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-300' },
  partially_achieved: { label: 'Partially Achieved',  color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-300' },
  not_achieved:       { label: 'Not Achieved',        color: 'text-red-700',     bg: 'bg-red-50 border-red-300' },
};

const PERSPECTIVE_COLORS: Record<string, { border: string; bg: string; badge: string; text: string }> = {
  'Financial/Stewardship':         { border: 'border-emerald-200', bg: 'bg-emerald-50/40',  badge: 'bg-emerald-100 text-emerald-700', text: 'text-emerald-700' },
  'Customer/Stakeholder':          { border: 'border-sky-200',     bg: 'bg-sky-50/40',      badge: 'bg-sky-100 text-sky-700',         text: 'text-sky-700' },
  'Internal Business Processes':   { border: 'border-violet-200',  bg: 'bg-violet-50/40',   badge: 'bg-violet-100 text-violet-700',   text: 'text-violet-700' },
  'Innovation Learning & Growth':  { border: 'border-amber-200',   bg: 'bg-amber-50/40',    badge: 'bg-amber-100 text-amber-700',     text: 'text-amber-700' },
};

const DEFAULT_COMPETENCIES: GeneralCompetency[] = [
  { id: 'gc-1', name: 'Communication',              description: 'Ability to convey information clearly and effectively, both verbally and in writing', weight: 4 },
  { id: 'gc-2', name: 'Teamwork & Collaboration',   description: 'Works cooperatively with others, contributes to team goals, and supports colleagues', weight: 4 },
  { id: 'gc-3', name: 'Initiative & Problem Solving', description: 'Proactively identifies issues, proposes solutions, and takes ownership of tasks', weight: 4 },
  { id: 'gc-4', name: 'Professionalism & Work Ethics', description: 'Demonstrates integrity, punctuality, accountability, and adherence to organisational values', weight: 4 },
  { id: 'gc-5', name: 'Adaptability & Learning',    description: 'Embraces change, continuously develops skills, and applies new knowledge effectively', weight: 4 },
];

const inputCls = 'w-full text-sm border border-border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors placeholder:text-muted-foreground/60';
const textareaCls = inputCls + ' resize-none';

// ─── Sub-components ───────────────────────────────────────────────────────────

function RatingSelector({ value, onChange, disabled }: { value: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((r) => (
          <button
            key={r}
            type="button"
            disabled={disabled}
            onClick={() => onChange(r)}
            className={`w-9 h-9 rounded-lg text-sm font-700 border transition-all ${
              value === r
                ? RATING_CONFIG[r].bg + ' shadow-sm scale-105'
                : 'bg-muted/40 border-border text-muted-foreground hover:bg-muted disabled:opacity-50'
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

function SectionHeader({ icon, title, subtitle, count }: { icon: string; title: string; subtitle?: string; count?: number }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="p-2.5 bg-primary/10 rounded-xl">
        <Icon name={icon as Parameters<typeof Icon>[0]['name']} size={20} className="text-primary" />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-700 text-foreground">{title}</h2>
          {count !== undefined && (
            <span className="bg-primary/10 text-primary text-xs font-700 px-2 py-0.5 rounded-full">{count}</span>
          )}
        </div>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

function StepIndicator({ steps, active }: { steps: { label: string; icon: string }[]; active: number }) {
  return (
    <div className="flex items-center gap-1">
      {steps.map((step, i) => (
        <React.Fragment key={step.label}>
          <button
            type="button"
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-600 transition-all ${
              i === active
                ? 'bg-primary text-white shadow-sm'
                : i < active
                ? 'bg-emerald-100 text-emerald-700' :'bg-muted/60 text-muted-foreground'
            }`}
          >
            {i < active ? (
              <Icon name="CheckCircleIcon" size={13} />
            ) : (
              <Icon name={step.icon as Parameters<typeof Icon>[0]['name']} size={13} />
            )}
            <span className="hidden sm:inline">{step.label}</span>
            <span className="sm:hidden">{i + 1}</span>
          </button>
          {i < steps.length - 1 && (
            <div className={`h-px w-4 flex-shrink-0 ${i < active ? 'bg-emerald-300' : 'bg-border'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SelfAssessmentPage() {
  const supabase = createClient();

  const [activeStep, setActiveStep] = useState(0);
  const [workplans, setWorkplans] = useState<WorkplanOption[]>([]);
  const [loadingWorkplans, setLoadingWorkplans] = useState(true);
  const [selectedWorkplanId, setSelectedWorkplanId] = useState('');
  const [selectedWorkplan, setSelectedWorkplan] = useState<WorkplanOption | null>(null);
  const [reviewPeriod, setReviewPeriod] = useState<'mid-year' | 'annual'>('mid-year');

  const [kpiAssessments, setKpiAssessments] = useState<KPIAssessment[]>([]);
  const [competencyAssessments, setCompetencyAssessments] = useState<CompetencyAssessment[]>([]);
  const [objectiveAssessments, setObjectiveAssessments] = useState<ObjectiveAssessment[]>([]);

  const [overallStrengths, setOverallStrengths] = useState('');
  const [overallChallenges, setOverallChallenges] = useState('');
  const [developmentNeeds, setDevelopmentNeeds] = useState('');
  const [overallSelfRating, setOverallSelfRating] = useState(3);
  const [staffSignature, setStaffSignature] = useState('');

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [draftRecovered, setDraftRecovered] = useState(false);
  const autoSaveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const steps = [
    { label: 'Select Workplan', icon: 'DocumentTextIcon' },
    { label: 'KPI Assessment',  icon: 'ChartBarIcon' },
    { label: 'Competencies',    icon: 'AcademicCapIcon' },
    { label: 'Objectives',      icon: 'FlagIcon' },
    { label: 'Reflection',      icon: 'ChatBubbleLeftRightIcon' },
    { label: 'Sign & Submit',   icon: 'CheckBadgeIcon' },
  ];

  // Load workplans
  useEffect(() => {
    async function load() {
      setLoadingWorkplans(true);
      try {
        const { data, error } = await supabase
          .from('workplan_settings')
          .select(`
            id, fiscal_year, review_year, workflow_stage,
            perspectives_objectives, general_competencies,
            staff:staff_id ( id, full_name ),
            supervisor:supervisor_id ( id, full_name )
          `)
          .eq('status', 'signed')
          .order('created_at', { ascending: false });

        if (error) throw error;

        const mapped: WorkplanOption[] = (data ?? []).map((row: any) => ({
          id: row.id,
          fiscal_year: row.fiscal_year,
          review_year: row.review_year,
          workflow_stage: row.workflow_stage,
          staff_name: row.staff?.full_name || '—',
          staff_id: row.staff?.id || '',
          supervisor_name: row.supervisor?.full_name || '—',
          supervisor_id: row.supervisor?.id || '',
          perspectives_objectives: row.perspectives_objectives || [],
          general_competencies: row.general_competencies?.length
            ? row.general_competencies
            : DEFAULT_COMPETENCIES,
        }));
        setWorkplans(mapped);
      } catch {
        // silently handle
      } finally {
        setLoadingWorkplans(false);
      }
    }
    load();
  }, []);

  // ── Auto-save draft ──────────────────────────────────────────────────────
  async function saveDraft(silent = false) {
    if (!selectedWorkplan) return;
    if (!silent) setAutoSaveStatus('saving');
    try {
      const formData = {
        kpiAssessments,
        competencyAssessments,
        objectiveAssessments,
        overallStrengths,
        overallChallenges,
        developmentNeeds,
        overallSelfRating,
        staffSignature,
      };
      const { error } = await supabase.from('appraisal_drafts').upsert(
        {
          staff_id: selectedWorkplan.staff_id || null,
          workplan_id: selectedWorkplan.id,
          draft_type: 'self_assessment',
          review_period: reviewPeriod,
          form_data: formData,
          active_step: activeStep,
          last_saved_at: new Date().toISOString(),
        },
        { onConflict: 'staff_id,workplan_id,draft_type,review_period' }
      );
      if (!error) {
        setAutoSaveStatus('saved');
        setTimeout(() => setAutoSaveStatus('idle'), 3000);
      } else {
        setAutoSaveStatus('error');
      }
    } catch {
      setAutoSaveStatus('error');
    }
  }

  // Trigger auto-save whenever form data changes (debounced 3s)
  useEffect(() => {
    if (!selectedWorkplan) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => saveDraft(true), 3000);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kpiAssessments, competencyAssessments, objectiveAssessments, overallStrengths, overallChallenges, developmentNeeds, overallSelfRating, activeStep]);

  // ── Recover draft when workplan selected ────────────────────────────────
  async function recoverDraft(workplanId: string, staffId: string, period: string) {
    try {
      const { data } = await supabase
        .from('appraisal_drafts')
        .select('*')
        .eq('workplan_id', workplanId)
        .eq('staff_id', staffId)
        .eq('draft_type', 'self_assessment')
        .eq('review_period', period)
        .maybeSingle();

      if (data?.form_data) {
        const fd = data.form_data as any;
        if (fd.kpiAssessments?.length) setKpiAssessments(fd.kpiAssessments);
        if (fd.competencyAssessments?.length) setCompetencyAssessments(fd.competencyAssessments);
        if (fd.objectiveAssessments?.length) setObjectiveAssessments(fd.objectiveAssessments);
        if (fd.overallStrengths) setOverallStrengths(fd.overallStrengths);
        if (fd.overallChallenges) setOverallChallenges(fd.overallChallenges);
        if (fd.developmentNeeds) setDevelopmentNeeds(fd.developmentNeeds);
        if (fd.overallSelfRating) setOverallSelfRating(fd.overallSelfRating);
        if (fd.staffSignature) setStaffSignature(fd.staffSignature);
        if (data.active_step) setActiveStep(data.active_step);
        setDraftRecovered(true);
        setTimeout(() => setDraftRecovered(false), 5000);
        return true;
      }
    } catch {
      // silently fail
    }
    return false;
  }

  function handleSelectWorkplan(id: string) {
    setSelectedWorkplanId(id);
    const wp = workplans.find((w) => w.id === id);
    if (!wp) return;
    setSelectedWorkplan(wp);

    // Build KPI assessments from perspectives_objectives
    const kpis: KPIAssessment[] = (wp.perspectives_objectives || []).map((row) => ({
      rowId: row.id,
      perspective: row.perspective,
      objective: row.objective,
      target: row.target,
      kpis: row.kpis || [],
      weight: row.weight,
      achievement: '',
      selfRating: 3,
      narrativeComment: '',
    }));
    setKpiAssessments(kpis);

    // Build objective assessments
    const objs: ObjectiveAssessment[] = (wp.perspectives_objectives || []).map((row) => ({
      rowId: row.id,
      perspective: row.perspective,
      objective: row.objective,
      target: row.target,
      keyActivities: row.keyActivities || '',
      progressStatus: '',
      progressPercent: 0,
      narrativeComment: '',
    }));
    setObjectiveAssessments(objs);

    // Build competency assessments
    const comps: CompetencyAssessment[] = (wp.general_competencies?.length
      ? wp.general_competencies
      : DEFAULT_COMPETENCIES
    ).map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      weight: c.weight,
      selfRating: 3,
      evidence: '',
      narrativeComment: '',
    }));
    setCompetencyAssessments(comps);

    // Attempt draft recovery after building initial state
    if (wp.staff_id) {
      recoverDraft(wp.id, wp.staff_id, reviewPeriod);
    }
  }

  function updateKpi(idx: number, field: keyof KPIAssessment, value: any) {
    setKpiAssessments((prev) => {
      const arr = [...prev];
      arr[idx] = { ...arr[idx], [field]: value };
      return arr;
    });
  }

  function updateCompetency(idx: number, field: keyof CompetencyAssessment, value: any) {
    setCompetencyAssessments((prev) => {
      const arr = [...prev];
      arr[idx] = { ...arr[idx], [field]: value };
      return arr;
    });
  }

  function updateObjective(idx: number, field: keyof ObjectiveAssessment, value: any) {
    setObjectiveAssessments((prev) => {
      const arr = [...prev];
      arr[idx] = { ...arr[idx], [field]: value };
      return arr;
    });
  }

  async function handleSubmit() {
    if (!selectedWorkplan) { setSaveError('Please select a workplan.'); return; }
    if (!staffSignature.trim()) { setSaveError('Staff signature is required.'); return; }

    setSaving(true);
    setSaveError(null);

    try {
      const kpiText = kpiAssessments
        .map((r) => `[${r.perspective}] ${r.objective} | Target: ${r.target} | Achievement: ${r.achievement} | Rating: ${r.selfRating}/5 | Comment: ${r.narrativeComment}`)
        .join('\n');

      const competencyText = competencyAssessments
        .map((c) => `${c.name} | Rating: ${c.selfRating}/5 | Evidence: ${c.evidence} | Comment: ${c.narrativeComment}`)
        .join('\n');

      const objectiveText = objectiveAssessments
        .map((o) => `[${o.perspective}] ${o.objective} | Status: ${o.progressStatus} | Progress: ${o.progressPercent}% | Comment: ${o.narrativeComment}`)
        .join('\n');

      const payload: Record<string, any> = {
        workplan_id: selectedWorkplan.id,
        staff_id: selectedWorkplan.staff_id || null,
        supervisor_id: selectedWorkplan.supervisor_id || null,
        review_period: reviewPeriod,
        review_year: selectedWorkplan.review_year,
        review_status: 'submitted',
        kpi_achievements: [kpiText, '\n\nCOMPETENCIES:\n' + competencyText, '\n\nOBJECTIVES:\n' + objectiveText].join(''),
        challenges_faced: overallChallenges || null,
        support_needed: developmentNeeds || null,
        self_rating: overallSelfRating,
        submitted_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('mid_year_reviews').insert(payload);
      if (error) { setSaveError(error.message || 'Failed to save. Please try again.'); return; }

      const pendingStage = reviewPeriod === 'mid-year' ? 'mid_year_pending' : 'end_year_pending';
      await supabase.from('workplan_settings').update({ workflow_stage: pendingStage }).eq('id', selectedWorkplan.id);

      await supabase.from('activity_logs').insert({
        activity_type: `${reviewPeriod}_self_assessment_submitted`,
        actor_name: selectedWorkplan.staff_name,
        action_description: `submitted ${reviewPeriod === 'mid-year' ? 'Mid-Year' : 'End-Year'} self-assessment — awaiting supervisor review`,
        subject_name: selectedWorkplan.staff_name,
        subject_detail: selectedWorkplan.review_year.toString(),
        icon_name: 'ClipboardDocumentListIcon',
        icon_bg: 'bg-primary/10',
        icon_color: 'text-primary',
      });

      // Notify supervisor that appraisal is ready for review
      if (selectedWorkplan.supervisor_id) {
        await supabase.from('notifications').insert({
          recipient_staff_id: selectedWorkplan.supervisor_id,
          type: 'appraisal_submitted',
          title: 'Appraisal Ready for Review',
          message: `${selectedWorkplan.staff_name} has submitted their ${reviewPeriod === 'mid-year' ? 'Mid-Year' : 'End-Year'} self-assessment and it is ready for your evaluation.`,
          related_id: selectedWorkplan.id,
          related_type: 'workplan',
        });
      }

      // Clear the draft after successful submission
      if (selectedWorkplan.staff_id) {
        await supabase.from('appraisal_drafts')
          .delete()
          .eq('workplan_id', selectedWorkplan.id)
          .eq('staff_id', selectedWorkplan.staff_id)
          .eq('draft_type', 'self_assessment')
          .eq('review_period', reviewPeriod);
      }

      setSubmitted(true);
    } catch {
      setSaveError('An unexpected error occurred. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  // ── Submitted state ──────────────────────────────────────────────────────
  if (submitted) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mb-5">
            <Icon name="CheckBadgeIcon" size={40} className="text-emerald-600" />
          </div>
          <h2 className="text-xl font-700 text-foreground mb-2">Self-Assessment Submitted</h2>
          <p className="text-sm text-muted-foreground mb-1 max-w-md">
            Your self-assessment for <span className="font-600 text-foreground">{selectedWorkplan?.staff_name}</span> has been submitted successfully.
          </p>
          <p className="text-xs text-muted-foreground mb-8">
            Your supervisor will be notified to review and approve your submission.
          </p>
          <button
            onClick={() => {
              setSubmitted(false);
              setActiveStep(0);
              setSelectedWorkplanId('');
              setSelectedWorkplan(null);
              setKpiAssessments([]);
              setCompetencyAssessments([]);
              setObjectiveAssessments([]);
              setOverallStrengths('');
              setOverallChallenges('');
              setDevelopmentNeeds('');
              setOverallSelfRating(3);
              setStaffSignature('');
            }}
            className="px-6 py-2.5 bg-primary text-white text-sm font-600 rounded-xl hover:bg-primary/90 transition-colors"
          >
            Start New Assessment
          </button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-700 text-foreground">Staff Self-Assessment</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Capture your self-assessment against assigned KPIs, competencies, and objectives
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Auto-save status */}
            {selectedWorkplan && (
              <span className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg border ${
                autoSaveStatus === 'saving' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                autoSaveStatus === 'saved' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                autoSaveStatus === 'error'? 'bg-red-50 border-red-200 text-red-700' : 'bg-muted border-border text-muted-foreground'
              }`}>
                {autoSaveStatus === 'saving' && <span className="w-3 h-3 border border-amber-500 border-t-transparent rounded-full animate-spin" />}
                {autoSaveStatus === 'saved' && <Icon name="CheckCircleIcon" size={12} className="text-emerald-600" />}
                {autoSaveStatus === 'error' && <Icon name="ExclamationTriangleIcon" size={12} className="text-red-600" />}
                {autoSaveStatus === 'idle' && <Icon name="CloudArrowUpIcon" size={12} className="text-muted-foreground" />}
                {autoSaveStatus === 'saving' ? 'Saving draft…' :
                 autoSaveStatus === 'saved' ? 'Draft saved' :
                 autoSaveStatus === 'error' ? 'Save failed' : 'Auto-save on'}
              </span>
            )}
            {selectedWorkplan && (
              <button
                onClick={() => saveDraft(false)}
                className="flex items-center gap-1.5 text-xs font-600 text-primary border border-primary/30 px-3 py-1.5 rounded-lg hover:bg-primary/5 transition-colors"
              >
                <Icon name="CloudArrowUpIcon" size={13} />
                Save Draft
              </button>
            )}
            <span className="text-xs text-muted-foreground font-500">Review Period:</span>
            {(['mid-year', 'annual'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setReviewPeriod(p)}
                className={`px-3 py-1.5 text-xs font-600 rounded-lg border transition-all ${
                  reviewPeriod === p
                    ? 'bg-primary text-white border-primary' :'bg-white text-muted-foreground border-border hover:border-primary/40'
                }`}
              >
                {p === 'mid-year' ? 'Mid-Year' : 'End-Year'}
              </button>
            ))}
          </div>
        </div>

        {/* Draft recovered banner */}
        {draftRecovered && (
          <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
            <Icon name="CheckCircleIcon" size={16} className="text-emerald-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-700 text-emerald-800">Draft Recovered</p>
              <p className="text-xs text-emerald-700">Your previous progress has been restored. You can continue from where you left off.</p>
            </div>
          </div>
        )}

        {/* Step Indicator */}
        <div className="bg-white border border-border rounded-xl px-4 py-3 overflow-x-auto">
          <StepIndicator steps={steps} active={activeStep} />
        </div>

        {/* ── STEP 0: Select Workplan ─────────────────────────────────────── */}
        {activeStep === 0 && (
          <div className="bg-white border border-border rounded-2xl p-6">
            <SectionHeader
              icon="DocumentTextIcon"
              title="Select Your Performance Contract"
              subtitle="Choose the approved workplan you are assessing yourself against"
            />

            {loadingWorkplans ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mr-3" />
                <span className="text-sm text-muted-foreground">Loading workplans…</span>
              </div>
            ) : workplans.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                  <Icon name="DocumentTextIcon" size={22} className="text-muted-foreground" />
                </div>
                <p className="text-sm font-600 text-foreground">No approved workplans found</p>
                <p className="text-xs text-muted-foreground mt-1">
                  A signed workplan is required before you can submit a self-assessment.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {workplans.map((wp) => (
                  <button
                    key={wp.id}
                    type="button"
                    onClick={() => handleSelectWorkplan(wp.id)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                      selectedWorkplanId === wp.id
                        ? 'border-primary bg-primary/5' :'border-border hover:border-primary/40 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                          selectedWorkplanId === wp.id ? 'border-primary bg-primary' : 'border-border'
                        }`}>
                          {selectedWorkplanId === wp.id && <Icon name="CheckIcon" size={10} className="text-white" />}
                        </div>
                        <div>
                          <p className="text-sm font-600 text-foreground">{wp.staff_name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {wp.fiscal_year} · Review Year {wp.review_year}
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs text-muted-foreground">Supervisor</p>
                        <p className="text-xs font-600 text-foreground">{wp.supervisor_name}</p>
                        <span className="inline-block mt-1 text-[10px] font-600 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                          {wp.workflow_stage?.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="text-[10px] font-500 px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        {wp.perspectives_objectives?.length || 0} objectives
                      </span>
                      <span className="text-[10px] font-500 px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        {wp.general_competencies?.length || DEFAULT_COMPETENCIES.length} competencies
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setActiveStep(1)}
                disabled={!selectedWorkplanId}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-600 rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue to KPI Assessment
                <Icon name="ArrowRightIcon" size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 1: KPI Assessment ──────────────────────────────────────── */}
        {activeStep === 1 && (
          <div className="space-y-4">
            <div className="bg-white border border-border rounded-2xl p-6">
              <SectionHeader
                icon="ChartBarIcon"
                title="KPI Self-Assessment"
                subtitle="Rate your performance against each KPI and provide narrative evidence"
                count={kpiAssessments.length}
              />

              {kpiAssessments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No KPIs found in the selected workplan.</p>
              ) : (
                <div className="space-y-5">
                  {kpiAssessments.map((row, idx) => {
                    const pc = PERSPECTIVE_COLORS[row.perspective] || PERSPECTIVE_COLORS['Financial/Stewardship'];
                    return (
                      <div key={row.rowId} className={`rounded-xl border-2 p-5 ${pc.border} ${pc.bg}`}>
                        {/* Header */}
                        <div className="flex flex-wrap items-start gap-2 mb-4">
                          <span className={`text-[10px] font-700 px-2.5 py-1 rounded-full ${pc.badge}`}>
                            {row.perspective}
                          </span>
                          <span className="text-[10px] font-500 px-2 py-1 rounded-full bg-muted text-muted-foreground">
                            Weight: {row.weight}%
                          </span>
                        </div>

                        <p className="text-sm font-600 text-foreground mb-1">{row.objective}</p>
                        <p className="text-xs text-muted-foreground mb-3">
                          <span className="font-500">Target:</span> {row.target || '—'}
                        </p>

                        {/* KPIs list */}
                        {row.kpis.length > 0 && (
                          <div className="mb-4">
                            <p className="text-[10px] font-700 text-muted-foreground uppercase tracking-wide mb-1.5">Assigned KPIs</p>
                            <div className="flex flex-wrap gap-1.5">
                              {row.kpis.map((kpi) => (
                                <span key={kpi} className="text-[10px] font-500 px-2 py-0.5 rounded-full bg-white border border-border text-foreground">
                                  {kpi}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Achievement */}
                          <div>
                            <label className="block text-xs font-600 text-foreground mb-1.5">
                              Achievement / Actual Result <span className="text-red-500">*</span>
                            </label>
                            <textarea
                              className={textareaCls}
                              rows={3}
                              placeholder="Describe what you actually achieved against this KPI…"
                              value={row.achievement}
                              onChange={(e) => updateKpi(idx, 'achievement', e.target.value)}
                            />
                          </div>

                          {/* Narrative Comment */}
                          <div>
                            <label className="block text-xs font-600 text-foreground mb-1.5">
                              Narrative Comment
                            </label>
                            <textarea
                              className={textareaCls}
                              rows={3}
                              placeholder="Add context, supporting evidence, or explanations…"
                              value={row.narrativeComment}
                              onChange={(e) => updateKpi(idx, 'narrativeComment', e.target.value)}
                            />
                          </div>
                        </div>

                        {/* Self Rating */}
                        <div className="mt-4">
                          <label className="block text-xs font-600 text-foreground mb-2">Self-Rating</label>
                          <RatingSelector value={row.selfRating} onChange={(v) => updateKpi(idx, 'selfRating', v)} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-between">
              <button onClick={() => setActiveStep(0)} className="flex items-center gap-2 px-4 py-2.5 text-sm font-600 text-muted-foreground border border-border rounded-xl hover:bg-muted transition-colors">
                <Icon name="ArrowLeftIcon" size={15} /> Back
              </button>
              <button onClick={() => setActiveStep(2)} className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-600 rounded-xl hover:bg-primary/90 transition-colors">
                Continue to Competencies <Icon name="ArrowRightIcon" size={15} />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Competencies ────────────────────────────────────────── */}
        {activeStep === 2 && (
          <div className="space-y-4">
            <div className="bg-white border border-border rounded-2xl p-6">
              <SectionHeader
                icon="AcademicCapIcon"
                title="General Competencies Self-Assessment"
                subtitle="Rate yourself on each general competency and provide supporting evidence"
                count={competencyAssessments.length}
              />

              <div className="space-y-5">
                {competencyAssessments.map((comp, idx) => (
                  <div key={comp.id} className="rounded-xl border border-border bg-muted/20 p-5">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-700 text-foreground">{comp.name}</p>
                          <span className="text-[10px] font-600 px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                            Weight: {comp.weight}%
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">{comp.description}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-xs font-600 text-foreground mb-1.5">
                          Supporting Evidence <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          className={textareaCls}
                          rows={3}
                          placeholder="Describe specific examples that demonstrate this competency…"
                          value={comp.evidence}
                          onChange={(e) => updateCompetency(idx, 'evidence', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-600 text-foreground mb-1.5">
                          Narrative Comment
                        </label>
                        <textarea
                          className={textareaCls}
                          rows={3}
                          placeholder="Any additional context or areas for development…"
                          value={comp.narrativeComment}
                          onChange={(e) => updateCompetency(idx, 'narrativeComment', e.target.value)}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-600 text-foreground mb-2">Self-Rating</label>
                      <RatingSelector value={comp.selfRating} onChange={(v) => updateCompetency(idx, 'selfRating', v)} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between">
              <button onClick={() => setActiveStep(1)} className="flex items-center gap-2 px-4 py-2.5 text-sm font-600 text-muted-foreground border border-border rounded-xl hover:bg-muted transition-colors">
                <Icon name="ArrowLeftIcon" size={15} /> Back
              </button>
              <button onClick={() => setActiveStep(3)} className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-600 rounded-xl hover:bg-primary/90 transition-colors">
                Continue to Objectives <Icon name="ArrowRightIcon" size={15} />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Objectives ──────────────────────────────────────────── */}
        {activeStep === 3 && (
          <div className="space-y-4">
            <div className="bg-white border border-border rounded-2xl p-6">
              <SectionHeader
                icon="FlagIcon"
                title="Objectives & Goals Assessment"
                subtitle="Report progress against each objective from your performance contract"
                count={objectiveAssessments.length}
              />

              {objectiveAssessments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No objectives found in the selected workplan.</p>
              ) : (
                <div className="space-y-5">
                  {objectiveAssessments.map((obj, idx) => {
                    const pc = PERSPECTIVE_COLORS[obj.perspective] || PERSPECTIVE_COLORS['Financial/Stewardship'];
                    return (
                      <div key={obj.rowId} className={`rounded-xl border-2 p-5 ${pc.border} ${pc.bg}`}>
                        <div className="flex flex-wrap items-start gap-2 mb-3">
                          <span className={`text-[10px] font-700 px-2.5 py-1 rounded-full ${pc.badge}`}>
                            {obj.perspective}
                          </span>
                        </div>

                        <p className="text-sm font-600 text-foreground mb-1">{obj.objective}</p>
                        {obj.target && (
                          <p className="text-xs text-muted-foreground mb-1">
                            <span className="font-500">Target:</span> {obj.target}
                          </p>
                        )}
                        {obj.keyActivities && (
                          <p className="text-xs text-muted-foreground mb-3">
                            <span className="font-500">Key Activities:</span> {obj.keyActivities}
                          </p>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                          {/* Progress Status */}
                          <div>
                            <label className="block text-xs font-600 text-foreground mb-1.5">
                              Progress Status <span className="text-red-500">*</span>
                            </label>
                            <select
                              className={inputCls}
                              value={obj.progressStatus}
                              onChange={(e) => updateObjective(idx, 'progressStatus', e.target.value)}
                            >
                              <option value="">Select status…</option>
                              <option value="achieved">Fully Achieved</option>
                              <option value="partially_achieved">Partially Achieved</option>
                              <option value="not_achieved">Not Achieved</option>
                            </select>
                            {obj.progressStatus && (
                              <span className={`inline-block mt-1.5 text-[10px] font-600 px-2 py-0.5 rounded-full border ${PROGRESS_STATUS_CONFIG[obj.progressStatus as keyof typeof PROGRESS_STATUS_CONFIG]?.bg} ${PROGRESS_STATUS_CONFIG[obj.progressStatus as keyof typeof PROGRESS_STATUS_CONFIG]?.color}`}>
                                {PROGRESS_STATUS_CONFIG[obj.progressStatus as keyof typeof PROGRESS_STATUS_CONFIG]?.label}
                              </span>
                            )}
                          </div>

                          {/* Progress % */}
                          <div>
                            <label className="block text-xs font-600 text-foreground mb-1.5">
                              Completion % <span className="text-red-500">*</span>
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min={0}
                                max={100}
                                className={inputCls}
                                placeholder="0–100"
                                value={obj.progressPercent || ''}
                                onChange={(e) => updateObjective(idx, 'progressPercent', Math.min(100, Math.max(0, Number(e.target.value))))}
                              />
                              <span className="text-sm font-600 text-muted-foreground flex-shrink-0">%</span>
                            </div>
                            {obj.progressPercent > 0 && (
                              <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    obj.progressPercent >= 80 ? 'bg-emerald-500' :
                                    obj.progressPercent >= 50 ? 'bg-amber-500' : 'bg-red-400'
                                  }`}
                                  style={{ width: `${obj.progressPercent}%` }}
                                />
                              </div>
                            )}
                          </div>

                          {/* Narrative Comment */}
                          <div className="md:col-span-1">
                            <label className="block text-xs font-600 text-foreground mb-1.5">
                              Narrative Comment
                            </label>
                            <textarea
                              className={textareaCls}
                              rows={3}
                              placeholder="Explain progress, challenges, or context…"
                              value={obj.narrativeComment}
                              onChange={(e) => updateObjective(idx, 'narrativeComment', e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-between">
              <button onClick={() => setActiveStep(2)} className="flex items-center gap-2 px-4 py-2.5 text-sm font-600 text-muted-foreground border border-border rounded-xl hover:bg-muted transition-colors">
                <Icon name="ArrowLeftIcon" size={15} /> Back
              </button>
              <button onClick={() => setActiveStep(4)} className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-600 rounded-xl hover:bg-primary/90 transition-colors">
                Continue to Reflection <Icon name="ArrowRightIcon" size={15} />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 4: Overall Reflection ──────────────────────────────────── */}
        {activeStep === 4 && (
          <div className="space-y-4">
            <div className="bg-white border border-border rounded-2xl p-6">
              <SectionHeader
                icon="ChatBubbleLeftRightIcon"
                title="Overall Reflection"
                subtitle="Provide a holistic narrative of your performance, strengths, challenges, and development needs"
              />

              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-600 text-foreground mb-1.5">
                    Key Strengths & Achievements
                  </label>
                  <textarea
                    className={textareaCls}
                    rows={4}
                    placeholder="Describe your key strengths and notable achievements during this review period…"
                    value={overallStrengths}
                    onChange={(e) => setOverallStrengths(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-600 text-foreground mb-1.5">
                    Challenges Faced
                  </label>
                  <textarea
                    className={textareaCls}
                    rows={4}
                    placeholder="Describe any challenges or obstacles that affected your performance…"
                    value={overallChallenges}
                    onChange={(e) => setOverallChallenges(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-600 text-foreground mb-1.5">
                    Development Needs & Support Required
                  </label>
                  <textarea
                    className={textareaCls}
                    rows={4}
                    placeholder="Identify areas for professional development and any support you need from your supervisor or organisation…"
                    value={developmentNeeds}
                    onChange={(e) => setDevelopmentNeeds(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-600 text-foreground mb-2">
                    Overall Self-Rating
                  </label>
                  <RatingSelector value={overallSelfRating} onChange={setOverallSelfRating} />
                </div>
              </div>
            </div>

            <div className="flex justify-between">
              <button onClick={() => setActiveStep(3)} className="flex items-center gap-2 px-4 py-2.5 text-sm font-600 text-muted-foreground border border-border rounded-xl hover:bg-muted transition-colors">
                <Icon name="ArrowLeftIcon" size={15} /> Back
              </button>
              <button onClick={() => setActiveStep(5)} className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-600 rounded-xl hover:bg-primary/90 transition-colors">
                Continue to Sign & Submit <Icon name="ArrowRightIcon" size={15} />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 5: Sign & Submit ───────────────────────────────────────── */}
        {activeStep === 5 && (
          <div className="space-y-4">
            <div className="bg-white border border-border rounded-2xl p-6">
              <SectionHeader
                icon="CheckBadgeIcon"
                title="Review & Submit"
                subtitle="Review your self-assessment summary, sign, and submit for supervisor review"
              />

              {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                {[
                  { label: 'KPI Rows', value: kpiAssessments.length, icon: 'ChartBarIcon', color: 'text-primary bg-primary/10' },
                  { label: 'Competencies', value: competencyAssessments.length, icon: 'AcademicCapIcon', color: 'text-violet-600 bg-violet-100' },
                  { label: 'Objectives', value: objectiveAssessments.length, icon: 'FlagIcon', color: 'text-amber-600 bg-amber-100' },
                  { label: 'Overall Rating', value: `${overallSelfRating}/5`, icon: 'StarIcon', color: 'text-emerald-600 bg-emerald-100' },
                ].map((card) => (
                  <div key={card.label} className="rounded-xl border border-border p-3 text-center">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center mx-auto mb-1.5 ${card.color}`}>
                      <Icon name={card.icon as Parameters<typeof Icon>[0]['name']} size={16} />
                    </div>
                    <p className="text-lg font-700 text-foreground">{card.value}</p>
                    <p className="text-[10px] text-muted-foreground">{card.label}</p>
                  </div>
                ))}
              </div>

              {/* Staff info */}
              {selectedWorkplan && (
                <div className="bg-muted/30 rounded-xl p-4 mb-5">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <p className="text-muted-foreground font-500">Staff Member</p>
                      <p className="font-600 text-foreground mt-0.5">{selectedWorkplan.staff_name}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground font-500">Supervisor</p>
                      <p className="font-600 text-foreground mt-0.5">{selectedWorkplan.supervisor_name}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground font-500">Review Period</p>
                      <p className="font-600 text-foreground mt-0.5 capitalize">{reviewPeriod.replace('-', ' ')} {selectedWorkplan.review_year}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Signature */}
              <div className="border-t border-border pt-5">
                <label className="block text-xs font-600 text-foreground mb-1.5">
                  Staff Signature (Full Name) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className={inputCls + ' max-w-sm font-serif italic text-base'}
                  placeholder="Type your full name as signature…"
                  value={staffSignature}
                  onChange={(e) => setStaffSignature(e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  By signing, you confirm that the information provided is accurate and reflects your honest self-assessment.
                </p>
              </div>

              {saveError && (
                <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mt-4">
                  <Icon name="ExclamationCircleIcon" size={15} className="text-red-500 flex-shrink-0" />
                  {saveError}
                </div>
              )}
            </div>

            <div className="flex justify-between">
              <button onClick={() => setActiveStep(4)} className="flex items-center gap-2 px-4 py-2.5 text-sm font-600 text-muted-foreground border border-border rounded-xl hover:bg-muted transition-colors">
                <Icon name="ArrowLeftIcon" size={15} /> Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving || !staffSignature.trim()}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white text-sm font-700 rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Submitting…
                  </>
                ) : (
                  <>
                    <Icon name="CheckBadgeIcon" size={16} />
                    Submit Self-Assessment
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
