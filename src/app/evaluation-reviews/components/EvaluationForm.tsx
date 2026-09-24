'use client';

import React, { useState, useEffect, useRef } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useAutosave, AutosaveStatus, autosaveStatusLabel } from '@/hooks/useAutosave';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

// ─── Types ───────────────────────────────────────────────────────────────────

interface StaffOption {
  id: string;
  full_name: string;
  job_title: string;
  supervisor_id: string | null;
  supervisor_name: string | null;
}

interface GoalRow {
  id: string;
  goal: string;
  target: string;
  actual: string;
  selfRating: number;
  supervisorRating: number;
  weight: number;
  comments: string;
}

interface KPIRow {
  id: string;
  kpiId: string;
  target: string;
  actual: string;
  status: string;
  selfRating: number;
  supervisorRating: number;
}

interface FormData {
  staffId: string;
  staffName: string;
  jobTitle: string;
  department: string;
  reviewPeriod: string;
  reviewType: string;
  supervisorId: string;
  supervisor: string;
  reviewDate: string;
  goals: GoalRow[];
  kpis: KPIRow[];
  bscRatings: { perspective: string; selfRating: number; supervisorRating: number; weight: number; comments: string }[];
  competencyRatings: { id: string; label: string; description: string; selfRating: number; supervisorRating: number; behavioralEvidence: string; weight: number }[];
  selfStrengths: string;
  selfChallenges: string;
  selfDevelopmentNeeds: string;
  selfOverallRating: number;
  selfOverallComments: string;
  supervisorStrengths: string;
  supervisorAreasForImprovement: string;
  supervisorDevelopmentPlan: string;
  supervisorOverallRating: number;
  supervisorOverallComments: string;
  supervisorRecommendation: string;
  staffSignature: string;
  supervisorSignature: string;
  hrSignature: string;
}

// ─── Validation ───────────────────────────────────────────────────────────────

interface EvalFormErrors {
  staffId?: string;
  jobTitle?: string;
  department?: string;
  supervisorId?: string;
  reviewDate?: string;
  staffSignature?: string;
  goals?: string;
}

function validateEvaluationForm(form: FormData): EvalFormErrors {
  const errors: EvalFormErrors = {};
  if (!form.staffId) errors.staffId = 'Please select a staff member.';
  if (!form.jobTitle?.trim()) errors.jobTitle = 'Job title is required.';
  if (!form.department?.trim()) errors.department = 'Department is required.';
  if (!form.supervisorId) errors.supervisorId = 'Please select a supervisor.';
  if (!form.reviewDate) errors.reviewDate = 'Review date is required.';
  if (!form.staffSignature?.trim()) errors.staffSignature = 'Staff signature is required to submit.';
  const validGoals = form.goals.filter((g) => g.goal.trim());
  if (validGoals.length === 0) errors.goals = 'At least one goal with a description is required.';
  return errors;
}

// ─── Data ────────────────────────────────────────────────────────────────────

const KPI_OPTIONS = [
  { id: 'k1', label: 'Budget Variance (≤5% of approved budget)', perspective: 'Financial / Stewardship' },
  { id: 'k2', label: 'Cost Recovery Rate (10% from all new grants)', perspective: 'Financial / Stewardship' },
  { id: 'k3', label: 'Payroll Accuracy (zero-error rate)', perspective: 'Financial / Stewardship' },
  { id: 'k4', label: 'Grant Disbursement Efficiency (within 5 days)', perspective: 'Financial / Stewardship' },
  { id: 'k5', label: 'Reporting Timeliness (100% donor reports by deadline)', perspective: 'Financial / Stewardship' },
  { id: 'k6', label: 'Unqualified Audited Financial Statements by Sept 30', perspective: 'Financial / Stewardship' },
  { id: 'k7', label: 'Revenue Growth (% increase in membership contributions)', perspective: 'Financial / Stewardship' },
  { id: 'k8', label: 'Procurement Savings (% reduction in admin costs)', perspective: 'Financial / Stewardship' },
  { id: 'k9', label: 'Internal Service Level (SLA) — 48h resolution rate', perspective: 'Customer / Stakeholder' },
  { id: 'k10', label: 'Employee Engagement Index (annual survey score)', perspective: 'Customer / Stakeholder' },
  { id: 'k11', label: 'Recruitment Efficiency (avg. time-to-hire ≤90 days)', perspective: 'Customer / Stakeholder' },
  { id: 'k12', label: 'System Availability (99.9% uptime)', perspective: 'Customer / Stakeholder' },
  { id: 'k13', label: 'Service Desk Resolution Rate (critical tickets ≤4h)', perspective: 'Customer / Stakeholder' },
  { id: 'k14', label: 'Visitor / Stakeholder Satisfaction Index', perspective: 'Customer / Stakeholder' },
  { id: 'k15', label: 'On-Time Performance (pickups/arrivals ≥98%)', perspective: 'Customer / Stakeholder' },
  { id: 'k16', label: 'No. of countries achieving WHO Maturity Level 3/4', perspective: 'Customer / Stakeholder' },
  { id: 'k17', label: 'PMS System Adoption Rate (100% of staff)', perspective: 'Internal Business Processes' },
  { id: 'k18', label: 'Data Integrity (0% error rate in HR digital repository)', perspective: 'Internal Business Processes' },
  { id: 'k19', label: 'Audit Readiness (zero high-risk findings)', perspective: 'Internal Business Processes' },
  { id: 'k20', label: 'ERP Adoption Rate (100% of financial transactions)', perspective: 'Internal Business Processes' },
  { id: 'k21', label: 'Internal Control Compliance (zero high-risk audit findings)', perspective: 'Internal Business Processes' },
  { id: 'k22', label: 'Data Warehouse Readiness (% completion)', perspective: 'Internal Business Processes' },
  { id: 'k23', label: 'Automation Rate (% HR/Finance processes migrated)', perspective: 'Internal Business Processes' },
  { id: 'k24', label: 'Logbook Accuracy (100% error-free daily logs)', perspective: 'Internal Business Processes' },
  { id: 'k25', label: 'CPD Completion Rate (% staff meeting annual PD targets)', perspective: 'Innovation, Learning & Growth' },
  { id: 'k26', label: 'Staff Turnover Rate (target ≤5% voluntary turnover)', perspective: 'Innovation, Learning & Growth' },
  { id: 'k27', label: 'Leadership Development (% mid-level managers trained)', perspective: 'Innovation, Learning & Growth' },
  { id: 'k28', label: 'Cybersecurity Maturity (0 successful breaches)', perspective: 'Innovation, Learning & Growth' },
  { id: 'k29', label: 'ISO Certification Progress (ISO 27001 / ISO 9001)', perspective: 'Innovation, Learning & Growth' },
  { id: 'k30', label: 'Corporate Governance Index Score (target: 60%)', perspective: 'Innovation, Learning & Growth' },
  { id: 'k31', label: 'Employee Retention Rate (target: 95%)', perspective: 'Innovation, Learning & Growth' },
  { id: 'k32', label: 'Implementation Rate of AI/ERP Systems', perspective: 'Innovation, Learning & Growth' },
];

// 4 BSC Perspectives as per ECSA-HC Performance Contract (Part 1 = 80% total)
const PERSPECTIVES = [
  'Financial / Stewardship',
  'Customer / Stakeholder',
  'Internal Business Processes',
  'Innovation, Learning & Growth',
];

// Perspective weights as per DG BSC framework
const PERSPECTIVE_WEIGHTS: Record<string, number> = {
  'Financial / Stewardship': 30,
  'Customer / Stakeholder': 30,
  'Internal Business Processes': 25,
  'Innovation, Learning & Growth': 15,
};

// Part 2: General Competencies (20% total weight) — 7 competencies as per performance contract
const COMPETENCIES = [
  { id: 'c1', label: 'Teamwork', description: 'Collaborates effectively with colleagues, shares knowledge, and contributes to team goals.', defaultWeight: 5 },
  { id: 'c2', label: 'Respect for Diversity', description: 'Demonstrates respect for all individuals regardless of background, culture, or perspective.', defaultWeight: 5 },
  { id: 'c3', label: 'Integrity', description: 'Acts with honesty, transparency, and ethical conduct in all professional interactions.', defaultWeight: 5 },
  { id: 'c4', label: 'Communication', description: 'Communicates clearly and effectively in written and verbal form with all stakeholders.', defaultWeight: 5 },
  { id: 'c5', label: 'Results Oriented', description: 'Focuses on achieving outcomes, meets deadlines, and delivers quality work consistently.', defaultWeight: 5 },
  { id: 'c6', label: 'Innovation', description: 'Generates new ideas, embraces change, and finds creative solutions to challenges.', defaultWeight: 5 },
  { id: 'c7', label: 'Leadership (GS3+)', description: 'Demonstrates leadership qualities, mentors others, and drives organisational goals. (Applicable to GS3+ grades)', defaultWeight: 5 },
];

const RATING_LABELS: Record<number, { label: string; color: string }> = {
  5: { label: 'Outstanding', color: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  4: { label: 'Exceeds Expectations', color: 'bg-sky-100 text-sky-700 border-sky-300' },
  3: { label: 'Meets Expectations', color: 'bg-blue-100 text-blue-700 border-blue-300' },
  2: { label: 'Needs Improvement', color: 'bg-amber-100 text-amber-700 border-amber-300' },
  1: { label: 'Unsatisfactory', color: 'bg-red-100 text-red-700 border-red-300' },
};

const KPI_STATUS_OPTIONS = ['Achieved', 'On Track', 'At Risk', 'Not Started', 'Exceeded'];

// Performance bands for the 0–120% scoring model
// BSC (0–100%) + Competencies (0–20%) = Total (0–120%)
// Bands as per ECSA-HC policy:
//   120%        → Outstanding           — 2-Notch Salary Increment
//   100%–<120%  → Above Average         — 1-Notch Salary Increment
//   75%–<100%   → Meets Expectations    — No Annual Increment
//   50%–<75%    → Needs Improvement     — No Annual Increment
//   <50%        → Unsatisfactory        — Mandatory PIP
function getPerformanceBand(score: number): { label: string; increment: string; color: string } {
  if (score >= 120) return { label: 'Outstanding', increment: '2-Notch Salary Increment', color: 'text-emerald-700' };
  if (score >= 100) return { label: 'Above Average', increment: '1-Notch Salary Increment', color: 'text-sky-700' };
  if (score >= 75)  return { label: 'Meets Expectations', increment: 'No Annual Increment', color: 'text-blue-700' };
  if (score >= 50)  return { label: 'Needs Improvement', increment: 'No Annual Increment', color: 'text-amber-700' };
  return { label: 'Unsatisfactory', increment: 'Mandatory Performance Improvement Plan (PIP)', color: 'text-red-700' };
}

let _idCounter = 0;
function nextId(): string { return `${++_idCounter}`; }

function makeGoal(): GoalRow {
  return { id: `g-${nextId()}`, goal: '', target: '', actual: '', selfRating: 3, supervisorRating: 3, weight: 25, comments: '' };
}

function makeKPI(): KPIRow {
  return { id: `k-${nextId()}`, kpiId: '', target: '', actual: '', status: 'On Track', selfRating: 3, supervisorRating: 3 };
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionHeader({ number, title, subtitle, icon }: { number: string; title: string; subtitle?: string; icon: string }) {
  return (
    <div className="flex items-start gap-3 mb-5">
      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
        <span className="text-xs font-800 text-primary">{number}</span>
      </div>
      <div>
        <h3 className="text-sm font-700 text-foreground">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      <Icon name={icon as any} size={16} className="text-muted-foreground ml-auto mt-1 flex-shrink-0" />
    </div>
  );
}

function RatingSelector({ value, onChange, label, disabled }: { value: number; onChange: (v: number) => void; label: string; disabled?: boolean }) {
  return (
    <div>
      {label && <label className="block text-[11px] font-600 text-muted-foreground mb-1.5 uppercase tracking-wide">{label}</label>}
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((r) => (
          <button
            key={r}
            type="button"
            disabled={disabled}
            onClick={() => onChange(r)}
            className={`w-8 h-8 rounded-md text-xs font-700 border transition-all ${
              value === r
                ? RATING_LABELS[r].color + ' shadow-sm scale-105'
                : 'bg-muted/40 border-border text-muted-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed'
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

const inputCls = 'w-full text-sm border border-border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors placeholder:text-muted-foreground/60';
const selectCls = inputCls + ' cursor-pointer';
const textareaCls = inputCls + ' resize-none';

// ─── Main Component ──────────────────────────────────────────────────────────

interface EvaluationFormProps {
  onClose: () => void;
  onSubmit?: () => void;
}

export default function EvaluationForm({ onClose, onSubmit }: EvaluationFormProps) {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [activeSection, setActiveSection] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [staffList, setStaffList] = useState<StaffOption[]>([]);
  const [staffLoading, setStaffLoading] = useState(true);
  const [activeTimeline, setActiveTimeline] = useState<{ id: string; review_year: number } | null>(null);
  const [selectedPerspective, setSelectedPerspective] = useState('');
  const [formErrors, setFormErrors] = useState<EvalFormErrors>({});
  const [retryCount, setRetryCount] = useState(0);

  // Autosave state
  const [autoSaveStatus, setAutoSaveStatus] = useState<AutosaveStatus>('idle');
  const [draftRecovered, setDraftRecovered] = useState(false);

  // ── Security: determine if current user is a supervisor/manager ──────────
  const isSupervisorOrAbove = profile
    ? ['support_admin', 'executive_director', 'deputy_director', 'hr_admin_officer', 'programme_manager', 'finance_manager'].includes(profile.systemRole)
    : false;

  // Stable supabase client ref
  const supabaseRef = useRef(createClient());

  // ── Security: Redirect unauthenticated users to login ────────────────────
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login?next=/evaluation-reviews');
    }
  }, [authLoading, user, router]);

  // Fetch staff list and active timeline from Supabase
  useEffect(() => {
    if (!user) return;
    const supabase = supabaseRef.current;
    async function loadData() {
      setStaffLoading(true);
      try {
        const [staffRes, timelineRes] = await Promise.all([
          supabase
            .from('staff')
            .select('id, full_name, job_title, supervisor_id, supervisor_name')
            .eq('employment_status', 'active')
            .order('full_name', { ascending: true }),
          supabase
            .from('review_timelines')
            .select('id, review_year, review_period')
            .eq('is_active', true)
            .eq('review_period', 'mid-year')
            .maybeSingle(),
        ]);

        if (staffRes.data) {
          setStaffList(staffRes.data as StaffOption[]);
        }
        if (timelineRes.data) {
          setActiveTimeline(timelineRes.data);
        }
      } catch (err) {
        console.log('Error loading form data:', err);
      } finally {
        setStaffLoading(false);
      }
    }
    loadData();
  }, [user]);

  // ── Security: Auto-populate staff field from logged-in user's profile ────
  // For regular staff: lock to their own record
  // For supervisors: allow selecting from direct reports
  const [myStaffRecord, setMyStaffRecord] = useState<StaffOption | null>(null);
  const [directReports, setDirectReports] = useState<StaffOption[]>([]);

  const [form, setForm] = useState<FormData>({
    staffId: '',
    staffName: '',
    jobTitle: '',
    department: '',
    reviewPeriod: 'FY 2026–2027 Mid-Year',
    reviewType: 'Mid-Year Review',
    supervisorId: '',
    supervisor: '',
    reviewDate: '',
    goals: [makeGoal(), makeGoal(), makeGoal()],
    kpis: [makeKPI(), makeKPI()],
    bscRatings: PERSPECTIVES.map((p) => ({
      perspective: p,
      selfRating: 3,
      supervisorRating: 3,
      weight: PERSPECTIVE_WEIGHTS[p],
      comments: '',
    })),
    competencyRatings: COMPETENCIES.map((c) => ({
      id: c.id,
      label: c.label,
      description: c.description,
      selfRating: 3,
      supervisorRating: 3,
      behavioralEvidence: '',
      weight: c.defaultWeight,
    })),
    selfStrengths: '',
    selfChallenges: '',
    selfDevelopmentNeeds: '',
    selfOverallRating: 3,
    selfOverallComments: '',
    supervisorStrengths: '',
    supervisorAreasForImprovement: '',
    supervisorDevelopmentPlan: '',
    supervisorOverallRating: 3,
    supervisorOverallComments: '',
    supervisorRecommendation: 'Meets Expectations (75%–99%) — No Annual Increment',
    staffSignature: '',
    supervisorSignature: '',
    hrSignature: '',
  });

  useEffect(() => {
    if (!profile?.staffId || staffList.length === 0) return;

    const myRecord = staffList.find((s) => s.id === profile.staffId) || null;
    setMyStaffRecord(myRecord);

    if (isSupervisorOrAbove) {
      // Supervisors/managers can fill for their direct reports
      const reports = staffList.filter((s) => s.supervisor_id === profile.staffId);
      setDirectReports(reports);
    }

    // Auto-populate the form with the logged-in user's own record (default)
    if (myRecord && !form.staffId) {
      setForm((prev) => ({
        ...prev,
        staffId: myRecord.id,
        staffName: myRecord.full_name,
        jobTitle: myRecord.job_title || '',
        supervisorId: myRecord.supervisor_id || '',
        supervisor: myRecord.supervisor_name || '',
      }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.staffId, staffList, isSupervisorOrAbove]);

  // ── Security: Determine if form is read-only (already submitted) ─────────
  const [existingReviewStatus, setExistingReviewStatus] = useState<string | null>(null);
  const isFormReadOnly = existingReviewStatus === 'submitted' || existingReviewStatus === 'reviewed' || existingReviewStatus === 'approved';

  // Check if the selected staff already has a submitted evaluation
  useEffect(() => {
    if (!form.staffId) {
      setExistingReviewStatus(null);
      return;
    }
    const supabase = supabaseRef.current;
    supabase
      .from('mid_year_reviews')
      .select('review_status')
      .eq('staff_id', form.staffId)
      .eq('review_period', 'mid-year')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        setExistingReviewStatus(data?.review_status ?? null);
      });
  }, [form.staffId]);

  // ── Autosave hook ────────────────────────────────────────────────────────
  const autosaveEnabled = !!form.staffId && !isFormReadOnly;
  const autosaveDraftWorkplanId = form.staffId ? `eval-draft-${form.staffId}` : null;
  const { saveDraft, recoverDraft, clearDraft } = useAutosave({
    staffId: form.staffId || null,
    workplanId: autosaveDraftWorkplanId,
    draftType: 'evaluation_form',
    reviewPeriod: form.reviewPeriod || 'mid-year',
    formData: {
      staffId: form.staffId,
      staffName: form.staffName,
      jobTitle: form.jobTitle,
      department: form.department,
      reviewPeriod: form.reviewPeriod,
      reviewType: form.reviewType,
      supervisorId: form.supervisorId,
      supervisor: form.supervisor,
      reviewDate: form.reviewDate,
      goals: form.goals,
      kpis: form.kpis,
      bscRatings: form.bscRatings,
      competencyRatings: form.competencyRatings,
      selfStrengths: form.selfStrengths,
      selfChallenges: form.selfChallenges,
      selfDevelopmentNeeds: form.selfDevelopmentNeeds,
      selfOverallRating: form.selfOverallRating,
      selfOverallComments: form.selfOverallComments,
      supervisorStrengths: form.supervisorStrengths,
      supervisorAreasForImprovement: form.supervisorAreasForImprovement,
      supervisorDevelopmentPlan: form.supervisorDevelopmentPlan,
      supervisorOverallRating: form.supervisorOverallRating,
      supervisorOverallComments: form.supervisorOverallComments,
      supervisorRecommendation: form.supervisorRecommendation,
      staffSignature: form.staffSignature,
      supervisorSignature: form.supervisorSignature,
      hrSignature: form.hrSignature,
    },
    activeStep: activeSection,
    enabled: autosaveEnabled,
    onStatusChange: setAutoSaveStatus,
  });

  // Recover draft when staff member is selected
  useEffect(() => {
    if (!form.staffId) return;
    const draftWpId = `eval-draft-${form.staffId}`;
    recoverDraft(draftWpId, form.staffId, form.reviewPeriod || 'mid-year').then((data) => {
      if (data?.form_data) {
        const fd = data.form_data as any;
        setForm((prev) => ({
          ...prev,
          jobTitle: fd.jobTitle || prev.jobTitle,
          department: fd.department || prev.department,
          reviewPeriod: fd.reviewPeriod || prev.reviewPeriod,
          reviewType: fd.reviewType || prev.reviewType,
          supervisorId: fd.supervisorId || prev.supervisorId,
          supervisor: fd.supervisor || prev.supervisor,
          reviewDate: fd.reviewDate || prev.reviewDate,
          goals: fd.goals?.length ? fd.goals : prev.goals,
          kpis: fd.kpis?.length ? fd.kpis : prev.kpis,
          bscRatings: fd.bscRatings?.length ? fd.bscRatings : prev.bscRatings,
          competencyRatings: fd.competencyRatings?.length ? fd.competencyRatings : prev.competencyRatings,
          selfStrengths: fd.selfStrengths || prev.selfStrengths,
          selfChallenges: fd.selfChallenges || prev.selfChallenges,
          selfDevelopmentNeeds: fd.selfDevelopmentNeeds || prev.selfDevelopmentNeeds,
          selfOverallRating: fd.selfOverallRating || prev.selfOverallRating,
          selfOverallComments: fd.selfOverallComments || prev.selfOverallComments,
          supervisorStrengths: fd.supervisorStrengths || prev.supervisorStrengths,
          supervisorAreasForImprovement: fd.supervisorAreasForImprovement || prev.supervisorAreasForImprovement,
          supervisorDevelopmentPlan: fd.supervisorDevelopmentPlan || prev.supervisorDevelopmentPlan,
          supervisorOverallRating: fd.supervisorOverallRating || prev.supervisorOverallRating,
          supervisorOverallComments: fd.supervisorOverallComments || prev.supervisorOverallComments,
          supervisorRecommendation: fd.supervisorRecommendation || prev.supervisorRecommendation,
          staffSignature: fd.staffSignature || prev.staffSignature,
          supervisorSignature: fd.supervisorSignature || prev.supervisorSignature,
          hrSignature: fd.hrSignature || prev.hrSignature,
        }));
        if (data.active_step) setActiveSection(data.active_step);
        setDraftRecovered(true);
        setTimeout(() => setDraftRecovered(false), 5000);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.staffId]);

  const sections = [
    { label: 'Staff Info', icon: 'UserIcon' },
    { label: 'Perspective', icon: 'FlagIcon' },
    { label: 'KPI Status', icon: 'ChartBarIcon' },
    { label: 'BSC Ratings', icon: 'Squares2X2Icon' },
    { label: 'Competencies', icon: 'AcademicCapIcon' },
    { label: 'Self-Assessment', icon: 'ClipboardDocumentListIcon' },
    { label: 'Supervisor Feedback', icon: 'ChatBubbleLeftRightIcon' },
    { label: 'Sign & Submit', icon: 'CheckBadgeIcon' },
  ];

  function setField<K extends keyof FormData>(key: K, value: FormData[K]) {
    if (isFormReadOnly) return; // Block all changes after submission
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateGoal(idx: number, field: keyof GoalRow, value: any) {
    if (isFormReadOnly) return;
    setForm((prev) => {
      const goals = [...prev.goals];
      goals[idx] = { ...goals[idx], [field]: value };
      return { ...prev, goals };
    });
  }

  function updateKPI(idx: number, field: keyof KPIRow, value: any) {
    if (isFormReadOnly) return;
    setForm((prev) => {
      const kpis = [...prev.kpis];
      kpis[idx] = { ...kpis[idx], [field]: value };
      return { ...prev, kpis };
    });
  }

  function updateBSC(idx: number, field: string, value: any) {
    if (isFormReadOnly) return;
    setForm((prev) => {
      const bscRatings = [...prev.bscRatings];
      bscRatings[idx] = { ...bscRatings[idx], [field]: value };
      return { ...prev, bscRatings };
    });
  }

  function updateCompetency(idx: number, field: string, value: any) {
    if (isFormReadOnly) return;
    setForm((prev) => {
      const competencyRatings = [...prev.competencyRatings];
      competencyRatings[idx] = { ...competencyRatings[idx], [field]: value };
      return { ...prev, competencyRatings };
    });
  }

  function addGoal() {
    if (isFormReadOnly) return;
    setForm((prev) => ({ ...prev, goals: [...prev.goals, makeGoal()] }));
  }

  function removeGoal(idx: number) {
    if (isFormReadOnly) return;
    setForm((prev) => ({ ...prev, goals: prev.goals.filter((_, i) => i !== idx) }));
  }

  function addKPI() {
    if (isFormReadOnly) return;
    setForm((prev) => ({ ...prev, kpis: [...prev.kpis, makeKPI()] }));
  }

  function removeKPI(idx: number) {
    if (isFormReadOnly) return;
    setForm((prev) => ({ ...prev, kpis: prev.kpis.filter((_, i) => i !== idx) }));
  }

  const totalWeight = form.goals.reduce((s, g) => s + (Number(g.weight) || 0), 0);
  const bscTotalWeight = form.bscRatings.reduce((s, b) => s + (Number(b.weight) || 0), 0);

  // BSC weighted score (Part 1 — normalised to 100%)
  const bscWeightedSelfScore =
    form.bscRatings.reduce((s, b) => s + b.selfRating * b.weight, 0) / Math.max(bscTotalWeight, 1);
  const bscWeightedSupervisorScore =
    form.bscRatings.reduce((s, b) => s + b.supervisorRating * b.weight, 0) / Math.max(bscTotalWeight, 1);

  // Competency score (Part 2 — normalized to 0–20)
  // Each competency has a weight 1–5, max total = 35 (7 × 5)
  // Weighted score = sum(rating × weight), max possible = 5 × totalCompWeight
  // Normalized score out of 20 = (sum(rating × weight) / (totalCompWeight × 5)) × 20
  const totalCompWeight = form.competencyRatings.reduce((s, c) => s + (Number(c.weight) || 0), 0);
  const competencyWeightedSelfRaw = form.competencyRatings.reduce((s, c) => s + c.selfRating * (Number(c.weight) || 0), 0);
  const competencyWeightedSupervisorRaw = form.competencyRatings.reduce((s, c) => s + c.supervisorRating * (Number(c.weight) || 0), 0);
  // Max possible = totalCompWeight × 5
  const compMaxPossible = Math.max(totalCompWeight * 5, 1);
  // Normalized to 0–20
  const competencySelfScore = (competencyWeightedSelfRaw / compMaxPossible) * 20;
  const competencySupervisorScore = (competencyWeightedSupervisorRaw / compMaxPossible) * 20;

  // Scale BSC from 1–5 to 0–100 (normalised to 100%)
  // bscWeightedScore is on 1–5 scale → multiply by 20 to get 0–100
  const bscSelfScore100 = bscWeightedSelfScore * 20;
  const bscSupervisorScore100 = bscWeightedSupervisorScore * 20;

  // Competency score is already 0–20 (normalised to 20%)
  // competencySelfScore / competencySupervisorScore are on 0–20 scale

  // Overall score (0–120) = BSC Score (0–100) + Competency Score (0–20)
  const overallSelfScore = Math.round((bscSelfScore100 + competencySelfScore) * 10) / 10;
  const overallSupervisorScore = Math.round((bscSupervisorScore100 + competencySupervisorScore) * 10) / 10;

  // Competency scores normalized to 0–100 (for display purposes)
  const competencySelfScore100 = (competencySelfScore / 20) * 100;
  const competencySupervisorScore100 = (competencySupervisorScore / 20) * 100;

  // Legacy aliases for backward compat in summary section
  const weightedSelfScore = overallSelfScore;
  const weightedSupervisorScore = overallSupervisorScore;

  async function handleSubmit() {
    if (!form.staffId) {
      setSaveError('Please select a staff member before submitting.');
      toast.error('Please select a staff member before submitting.');
      return;
    }

    // ── Client-side validation ────────────────────────────────────────────
    const errors = validateEvaluationForm(form);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      const firstError = Object.values(errors)[0];
      setSaveError(firstError || 'Please fix the highlighted errors before submitting.');
      toast.error('Please fix the highlighted errors before submitting.');
      // Navigate to section 0 if staff/supervisor/date errors exist
      if (errors.staffId || errors.jobTitle || errors.department || errors.supervisorId || errors.reviewDate) {
        setActiveSection(0);
      } else if (errors.goals) {
        setActiveSection(1);
      } else if (errors.staffSignature) {
        setActiveSection(sections.length - 1);
      }
      return;
    }

    // ── Security: Server-side ownership verification ──────────────────────
    // Verify the current user is allowed to submit for this staff member
    if (!isSupervisorOrAbove && profile?.staffId !== form.staffId) {
      const msg = 'You are not authorised to submit an evaluation for this staff member.';
      setSaveError(msg);
      toast.error(msg);
      return;
    }

    // ── Security: Block re-submission if already submitted ────────────────
    if (isFormReadOnly) {
      const msg = 'This evaluation has already been submitted and cannot be modified.';
      setSaveError(msg);
      toast.error(msg);
      return;
    }

    setSaving(true);
    setSaveError(null);

    // ── Retry wrapper (up to 2 attempts on network errors) ───────────────
    const MAX_RETRIES = 2;
    let attempt = 0;

    while (attempt <= MAX_RETRIES) {
      try {
        const reviewYear = activeTimeline?.review_year || new Date().getFullYear(); // hydration-ok

        // ── Structured BSC ratings (stored as JSONB for reports) ──
        const bscPerspectiveRatings = form.bscRatings.map((b) => ({
          perspective: b.perspective,
          selfRating: b.selfRating,
          supervisorRating: b.supervisorRating,
          weight: b.weight,
          comments: b.comments,
        }));

        // ── Structured competency ratings (stored as JSONB) ──
        const competencyRatingsDetail = form.competencyRatings.map((c) => ({
          id: c.id,
          label: c.label,
          description: c.description,
          selfRating: c.selfRating,
          supervisorRating: c.supervisorRating,
          behavioralEvidence: c.behavioralEvidence,
          weight: c.weight,
        }));

        // ── Goals detail (stored as JSONB) ──
        const goalsDetail = form.goals
          .filter((g) => g.goal.trim())
          .map((g) => ({
            id: g.id,
            goal: g.goal,
            target: g.target,
            actual: g.actual,
            selfRating: g.selfRating,
            supervisorRating: g.supervisorRating,
            weight: g.weight,
            comments: g.comments,
          }));

        // ── KPIs detail (stored as JSONB) ──
        const kpisDetail = form.kpis
          .filter((k) => k.kpiId)
          .map((k) => ({
            id: k.id,
            kpiId: k.kpiId,
            target: k.target,
            actual: k.actual,
            status: k.status,
            selfRating: k.selfRating,
            supervisorRating: k.supervisorRating,
          }));

        // ── Legacy text fields (kept for backward compat) ──
        const kpiAchievementsText = kpisDetail
          .map((k) => {
            const kpiOption = KPI_OPTIONS.find((o) => o.id === k.kpiId);
            return `${kpiOption?.label || k.kpiId}: Target=${k.target}, Actual=${k.actual}, Status=${k.status}`;
          })
          .join('\n');

        const competencyText = competencyRatingsDetail
          .map((c) => `${c.label}: Self=${c.selfRating}/5, Supervisor=${c.supervisorRating}/5${c.behavioralEvidence ? ` | Evidence: ${c.behavioralEvidence}` : ''}`)
          .join('\n');

        const selfAssessmentText = [
          form.selfStrengths ? `Strengths: ${form.selfStrengths}` : '',
          form.selfChallenges ? `Challenges: ${form.selfChallenges}` : '',
          form.selfDevelopmentNeeds ? `Development Needs: ${form.selfDevelopmentNeeds}` : '',
          form.selfOverallComments ? `Overall Comments: ${form.selfOverallComments}` : '',
          competencyText ? `\nGeneral Competencies (Part 2):\n${competencyText}` : '',
        ]
          .filter(Boolean)
          .join('\n');

        const supervisorCommentsText = [
          form.supervisorStrengths ? `Strengths: ${form.supervisorStrengths}` : '',
          form.supervisorAreasForImprovement ? `Areas for Improvement: ${form.supervisorAreasForImprovement}` : '',
          form.supervisorDevelopmentPlan ? `Development Plan: ${form.supervisorDevelopmentPlan}` : '',
          form.supervisorOverallComments ? `Overall Comments: ${form.supervisorOverallComments}` : '',
          `Recommendation: ${form.supervisorRecommendation}`,
        ]
          .filter(Boolean)
          .join('\n');

        const payload: Record<string, any> = {
          staff_id: form.staffId,
          review_year: reviewYear,
          review_period: 'mid-year',
          review_type: form.reviewType,
          review_period_label: form.reviewPeriod,
          review_status: 'submitted',

          // ── Structured JSONB data (new — for reports & audit) ──
          bsc_perspective_ratings: bscPerspectiveRatings,
          competency_ratings_detail: competencyRatingsDetail,
          goals_detail: goalsDetail,
          kpis_detail: kpisDetail,

          // ── Computed scores (stored for reporting, BSC on 0–100, competency on 0–20, overall on 0–120)
          bsc_self_score: parseFloat(bscSelfScore100.toFixed(4)),
          bsc_supervisor_score: parseFloat(bscSupervisorScore100.toFixed(4)),
          competency_self_score: parseFloat(competencySelfScore.toFixed(4)),
          competency_supervisor_score: parseFloat(competencySupervisorScore.toFixed(4)),
          overall_self_score: parseFloat(overallSelfScore.toFixed(4)),
          overall_supervisor_score: parseFloat(overallSupervisorScore.toFixed(4)),

          // ── Narrative fields ──
          self_strengths: form.selfStrengths || null,
          challenges_faced: form.selfChallenges || null,
          support_needed: form.selfDevelopmentNeeds || null,
          self_development_needs: form.selfDevelopmentNeeds || null,
          supervisor_areas_for_improvement: form.supervisorAreasForImprovement || null,
          supervisor_development_plan: form.supervisorDevelopmentPlan || null,
          supervisor_recommendation: form.supervisorRecommendation || null,

          // ── Ratings ──
          self_rating: form.selfOverallRating,
          supervisor_rating: form.supervisorOverallRating,

          // ── Legacy text fields (backward compat) ──
          kpi_achievements: kpiAchievementsText || selfAssessmentText || null,
          supervisor_comments: supervisorCommentsText || null,

          // ── Signatures ──
          staff_signature: form.staffSignature || null,
          supervisor_signature_eval: form.supervisorSignature || null,
          hr_signature: form.hrSignature || null,
          staff_signed_at: form.staffSignature ? new Date().toISOString() : null, // hydration-ok
          supervisor_signed_eval_at: form.supervisorSignature ? new Date().toISOString() : null, // hydration-ok
          hr_signed_at: form.hrSignature ? new Date().toISOString() : null, // hydration-ok

          // ── Dates ──
          review_date: form.reviewDate || null,
          submitted_at: new Date().toISOString(), // hydration-ok
        };

        if (form.supervisorId) {
          payload.supervisor_id = form.supervisorId;
        }

        if (activeTimeline?.id) {
          payload.timeline_id = activeTimeline.id;
        }

        const { error } = await supabaseRef.current.from('mid_year_reviews').insert(payload);

        if (error) {
          // Detect network/transient errors for retry
          const isNetworkError =
            error.message?.toLowerCase().includes('network') ||
            error.message?.toLowerCase().includes('fetch') ||
            error.message?.toLowerCase().includes('timeout') ||
            error.code === 'PGRST301';

          if (isNetworkError && attempt < MAX_RETRIES) {
            attempt++;
            setRetryCount(attempt);
            toast.loading(`Connection issue — retrying (${attempt}/${MAX_RETRIES})…`, { id: 'eval-retry' });
            await new Promise((r) => setTimeout(r, 1500 * attempt));
            continue;
          }

          toast.dismiss('eval-retry');

          // Handle RLS violation gracefully
          let errorMsg: string;
          if (error.code === '42501' || error.message?.includes('policy')) {
            errorMsg = 'You are not authorised to submit an evaluation for this staff member. Please contact your HR administrator.';
          } else if (error.code === '23505') {
            errorMsg = 'An evaluation for this staff member already exists for this review period.';
          } else {
            errorMsg = error.message || 'Failed to save evaluation. Please try again.';
          }
          setSaveError(errorMsg);
          toast.error(errorMsg);
          return;
        }

        toast.dismiss('eval-retry');

        // Clear draft after successful submission
        if (form.staffId) {
          const draftWpId = `eval-draft-${form.staffId}`;
          await clearDraft(draftWpId, form.staffId, form.reviewPeriod || 'mid-year');
        }

        // ── Audit log: record who submitted and for whom ──────────────────────
        const actorName = profile?.fullName || user?.email || 'Unknown';
        const isOnBehalf = isSupervisorOrAbove && profile?.staffId !== form.staffId;
        await supabaseRef.current.from('activity_logs').insert({
          activity_type: 'evaluation_submitted',
          actor_name: actorName,
          action_description: isOnBehalf
            ? `${actorName} (${profile?.systemRole || 'supervisor'}) submitted ${form.reviewType} evaluation on behalf of ${form.staffName}`
            : `submitted ${form.reviewType} evaluation`,
          subject_name: form.staffName,
          subject_detail: form.reviewPeriod,
          icon_name: 'ClipboardDocumentCheckIcon',
          icon_bg: 'bg-sky-50',
          icon_color: 'text-sky-600',
        }).then(() => {});

        toast.success(`Evaluation for ${form.staffName} submitted successfully!`);
        setRetryCount(0);
        setSubmitted(true);
        onSubmit?.();
        return;
      } catch (err: any) {
        const isNetworkError =
          err?.message?.toLowerCase().includes('network') ||
          err?.message?.toLowerCase().includes('fetch') ||
          err?.name === 'TypeError';

        if (isNetworkError && attempt < MAX_RETRIES) {
          attempt++;
          setRetryCount(attempt);
          toast.loading(`Connection issue — retrying (${attempt}/${MAX_RETRIES})…`, { id: 'eval-retry' });
          await new Promise((r) => setTimeout(r, 1500 * attempt));
          continue;
        }

        toast.dismiss('eval-retry');
        const msg = 'An unexpected error occurred. Please try again.';
        setSaveError(msg);
        toast.error(msg);
        return;
      } finally {
        if (attempt === 0 || attempt > MAX_RETRIES) {
          setSaving(false);
        }
      }
    }

    setSaving(false);
  }

  // ── Show loading while auth resolves ─────────────────────────────────────
  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Redirect if not authenticated ─────────────────────────────────────────
  if (!user) {
    return null;
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
          <Icon name="CheckCircleIcon" size={36} className="text-emerald-600" />
        </div>
        <h3 className="text-lg font-700 text-foreground mb-2">Evaluation Submitted</h3>
        <p className="text-sm text-muted-foreground mb-1">
          The evaluation form for <span className="font-600 text-foreground">{form.staffName || 'staff member'}</span> has been submitted successfully.
        </p>
        <p className="text-xs text-muted-foreground mb-6">Review Period: {form.reviewPeriod} · Type: {form.reviewType}</p>
        <button
          onClick={onClose}
          className="px-5 py-2 bg-primary text-white text-sm font-600 rounded-lg hover:bg-primary/90 transition-colors"
        >
          Close
        </button>
      </div>
    );
  }

  // ── Read-only banner when form is already submitted ───────────────────────
  const ReadOnlyBanner = isFormReadOnly ? (
    <div className="mx-5 mt-4 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
      <Icon name="LockClosedIcon" size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
      <span>
        <span className="font-700">Read-only: </span>
        This evaluation has already been submitted and cannot be edited. Status: <span className="font-700 capitalize">{existingReviewStatus}</span>.
      </span>
    </div>
  ) : null;

  // ── Compute which staff options the current user can select ──────────────
  // Regular staff: only their own record
  // Supervisors/managers: their own + direct reports
  const allowedStaffOptions: StaffOption[] = isSupervisorOrAbove
    ? staffList // Admins/managers see all staff
    : myStaffRecord
    ? [myStaffRecord] // Regular staff see only themselves
    : [];

  return (
    <div className="flex flex-col h-full">
      {/* Progress stepper */}
      <div className="px-5 pt-4 pb-3 border-b border-border bg-muted/20">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
            {sections.map((s, i) => (
              <button
                key={s.label}
                type="button"
                onClick={() => setActiveSection(i)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-600 whitespace-nowrap transition-all flex-shrink-0 ${
                  i === activeSection
                    ? 'bg-primary text-white shadow-sm'
                    : i < activeSection
                    ? 'bg-emerald-100 text-emerald-700' :'bg-white border border-border text-muted-foreground hover:bg-muted/50'
                }`}
              >
                {i < activeSection ? (
                  <Icon name="CheckIcon" size={11} />
                ) : (
                  <Icon name={s.icon as any} size={11} />
                )}
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
          {isFormReadOnly && (
            <span className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg border bg-amber-50 border-amber-200 text-amber-700 flex-shrink-0">
              <Icon name="LockClosedIcon" size={12} className="text-amber-600" />
              Read-only
            </span>
          )}
        </div>
        <div className="mt-2 h-1 bg-border rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${((activeSection + 1) / sections.length) * 100}%` }}
          />
        </div>
      </div>

      {ReadOnlyBanner}

      {/* Form body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">

        {/* ── Section 0: Staff Information ── */}
        {activeSection === 0 && (
          <div className="space-y-5">
            <SectionHeader number="1" title="Staff Information" subtitle="Basic details about the staff member being evaluated" icon="UserIcon" />
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-800">
              <div className="flex items-start gap-2">
                <Icon name="InformationCircleIcon" size={14} className="text-blue-600 flex-shrink-0 mt-0.5" />
                <span>Complete all fields accurately. This information will appear on the official evaluation record.</span>
              </div>
            </div>

            {/* Security notice for regular staff */}
            {!isSupervisorOrAbove && myStaffRecord && (
              <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-800">
                <Icon name="ShieldCheckIcon" size={14} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                <span>
                  <span className="font-700">Locked to your account: </span>
                  This evaluation is linked to your staff record (<span className="font-700">{myStaffRecord.full_name}</span>). You can only submit evaluations for yourself.
                </span>
              </div>
            )}

            {/* Security notice for supervisors filling on behalf */}
            {isSupervisorOrAbove && (
              <div className="flex items-start gap-2 bg-violet-50 border border-violet-200 rounded-xl p-3 text-xs text-violet-800">
                <Icon name="UserGroupIcon" size={14} className="text-violet-600 flex-shrink-0 mt-0.5" />
                <span>
                  <span className="font-700">Supervisor access: </span>
                  You can fill evaluations for yourself or your direct reports. All submissions are audit-logged with your identity.
                </span>
              </div>
            )}

            {staffLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                Loading staff list…
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Staff Name" required>
                  {/* Regular staff: read-only display of their own name */}
                  {!isSupervisorOrAbove ? (
                    <div className={`${inputCls} bg-muted/40 cursor-not-allowed flex items-center gap-2`}>
                      <Icon name="LockClosedIcon" size={13} className="text-muted-foreground flex-shrink-0" />
                      <span className="text-foreground font-600">{form.staffName || 'Loading…'}</span>
                    </div>
                  ) : (
                    <select
                      className={`${selectCls} ${formErrors.staffId ? 'border-red-400 focus:ring-red-300' : ''} ${isFormReadOnly ? 'bg-muted/40 cursor-not-allowed' : ''}`}
                      value={form.staffId}
                      disabled={isFormReadOnly}
                      onChange={(e) => {
                        const staff = staffList.find((s) => s.id === e.target.value);
                        setField('staffId', e.target.value);
                        setField('staffName', staff?.full_name || '');
                        setField('jobTitle', staff?.job_title || '');
                        if (staff?.supervisor_id) {
                          const supervisor = staffList.find((s) => s.id === staff.supervisor_id);
                          setField('supervisorId', staff.supervisor_id);
                          setField('supervisor', supervisor?.full_name || staff.supervisor_name || '');
                        } else {
                          setField('supervisorId', '');
                          setField('supervisor', '');
                        }
                      }}
                    >
                      <option value="">Select staff member…</option>
                      {allowedStaffOptions.map((s) => (
                        <option key={s.id} value={s.id}>{s.full_name}</option>
                      ))}
                    </select>
                  )}
                  {formErrors.staffId && (
                    <p className="flex items-center gap-1 mt-1 text-[11px] text-red-600">
                      <Icon name="ExclamationCircleIcon" size={11} className="flex-shrink-0" />
                      {formErrors.staffId}
                    </p>
                  )}
                </FormField>
                <FormField label="Job Title / Designation" required>
                  <input
                    className={`${inputCls} ${formErrors.jobTitle ? 'border-red-400 focus:ring-red-300' : ''} ${isFormReadOnly ? 'bg-muted/40 cursor-not-allowed' : ''}`}
                    value={form.jobTitle}
                    onChange={(e) => { setField('jobTitle', e.target.value); setFormErrors((p) => { const n = { ...p }; delete n.jobTitle; return n; }); }}
                    placeholder="Auto-filled from staff selection"
                    readOnly={isFormReadOnly}
                  />
                  {formErrors.jobTitle && (
                    <p className="flex items-center gap-1 mt-1 text-[11px] text-red-600">
                      <Icon name="ExclamationCircleIcon" size={11} className="flex-shrink-0" />
                      {formErrors.jobTitle}
                    </p>
                  )}
                </FormField>
                <FormField label="Department / Unit" required>
                  <input
                    className={`${inputCls} ${formErrors.department ? 'border-red-400 focus:ring-red-300' : ''} ${isFormReadOnly ? 'bg-muted/40 cursor-not-allowed' : ''}`}
                    value={form.department}
                    onChange={(e) => { setField('department', e.target.value); setFormErrors((p) => { const n = { ...p }; delete n.department; return n; }); }}
                    placeholder="e.g. Finance & Admin, Programmes…"
                    readOnly={isFormReadOnly}
                  />
                  {formErrors.department && (
                    <p className="flex items-center gap-1 mt-1 text-[11px] text-red-600">
                      <Icon name="ExclamationCircleIcon" size={11} className="flex-shrink-0" />
                      {formErrors.department}
                    </p>
                  )}
                </FormField>
                <FormField label="Supervisor / Line Manager" required>
                  <select
                    className={`${selectCls} ${formErrors.supervisorId ? 'border-red-400 focus:ring-red-300' : ''} ${isFormReadOnly ? 'bg-muted/40 cursor-not-allowed' : ''}`}
                    value={form.supervisorId}
                    disabled={isFormReadOnly}
                    onChange={(e) => {
                      const supervisor = staffList.find((s) => s.id === e.target.value);
                      setField('supervisorId', e.target.value);
                      setField('supervisor', supervisor?.full_name || '');
                      setFormErrors((p) => { const n = { ...p }; delete n.supervisorId; return n; });
                    }}
                  >
                    <option value="">Select supervisor…</option>
                    {staffList.map((s) => (
                      <option key={s.id} value={s.id}>{s.full_name} — {s.job_title}</option>
                    ))}
                  </select>
                  {formErrors.supervisorId && (
                    <p className="flex items-center gap-1 mt-1 text-[11px] text-red-600">
                      <Icon name="ExclamationCircleIcon" size={11} className="flex-shrink-0" />
                      {formErrors.supervisorId}
                    </p>
                  )}
                </FormField>
                <FormField label="Review Type" required>
                  <select className={`${selectCls} ${isFormReadOnly ? 'bg-muted/40 cursor-not-allowed' : ''}`} value={form.reviewType} disabled={isFormReadOnly} onChange={(e) => setField('reviewType', e.target.value)}>
                    <option>Mid-Year Review</option>
                    <option>Annual Review</option>
                    <option>Probationary Review</option>
                    <option>Performance Improvement Review</option>
                  </select>
                </FormField>
                <FormField label="Review Period" required>
                  <input className={`${inputCls} ${isFormReadOnly ? 'bg-muted/40 cursor-not-allowed' : ''}`} value={form.reviewPeriod} onChange={(e) => setField('reviewPeriod', e.target.value)} placeholder="e.g. FY 2026–2027 Mid-Year" readOnly={isFormReadOnly} />
                </FormField>
                <FormField label="Review Date" required>
                  <input
                    type="date"
                    className={`${inputCls} ${formErrors.reviewDate ? 'border-red-400 focus:ring-red-300' : ''} ${isFormReadOnly ? 'bg-muted/40 cursor-not-allowed' : ''}`}
                    value={form.reviewDate}
                    onChange={(e) => { setField('reviewDate', e.target.value); setFormErrors((p) => { const n = { ...p }; delete n.reviewDate; return n; }); }}
                    readOnly={isFormReadOnly}
                  />
                  {formErrors.reviewDate && (
                    <p className="flex items-center gap-1 mt-1 text-[11px] text-red-600">
                      <Icon name="ExclamationCircleIcon" size={11} className="flex-shrink-0" />
                      {formErrors.reviewDate}
                    </p>
                  )}
                </FormField>
                {activeTimeline && (
                  <div className="sm:col-span-2">
                    <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                      <Icon name="CalendarDaysIcon" size={13} className="text-emerald-600" />
                      Linked to active timeline: {activeTimeline.review_year} Mid-Year Review
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Section 1: Goals & Progress ── */}
        {activeSection === 1 && (
          <div className="space-y-5">
            <SectionHeader number="2" title="Perspective & Goals" subtitle="Select a BSC perspective and list agreed performance goals, targets, and rate achievement" icon="FlagIcon" />

            <FormField label="BSC Perspective" required>
              <select
                className={`${selectCls} ${isFormReadOnly ? 'bg-muted/40 cursor-not-allowed' : ''}`}
                value={selectedPerspective}
                disabled={isFormReadOnly}
                onChange={(e) => setSelectedPerspective(e.target.value)}
              >
                <option value="">Select a perspective…</option>
                {PERSPECTIVES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </FormField>

            <div className="flex items-center justify-between">
              <div className={`text-xs font-600 px-2.5 py-1 rounded-lg border ${Math.abs(totalWeight - 100) < 1 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                Total Weight: {totalWeight}% {Math.abs(totalWeight - 100) < 1 ? '✓' : '(should equal 100%)'}
              </div>
              {!isFormReadOnly && (
                <button type="button" onClick={addGoal} className="flex items-center gap-1.5 text-xs font-600 text-primary hover:text-primary/80 transition-colors">
                  <Icon name="PlusCircleIcon" size={14} />
                  Add Goal
                </button>
              )}
            </div>

            <div className="space-y-4">
              {form.goals.map((goal, idx) => (
                <div key={goal.id} className="border border-border rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30 border-b border-border">
                    <span className="text-xs font-700 text-foreground">Goal {idx + 1}</span>
                    {form.goals.length > 1 && !isFormReadOnly && (
                      <button type="button" onClick={() => removeGoal(idx)} className="text-muted-foreground hover:text-red-500 transition-colors">
                        <Icon name="TrashIcon" size={13} />
                      </button>
                    )}
                  </div>
                  <div className="p-4 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2">
                        <FormField label="Goal / Objective Description" required>
                          <textarea
                            className={`${textareaCls} ${isFormReadOnly ? 'bg-muted/40 cursor-not-allowed' : ''}`}
                            rows={2}
                            value={goal.goal}
                            onChange={(e) => updateGoal(idx, 'goal', e.target.value)}
                            placeholder="Describe the agreed goal or objective…"
                            readOnly={isFormReadOnly}
                          />
                        </FormField>
                      </div>
                      <FormField label="Weight (%)">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          className={`${inputCls} ${isFormReadOnly ? 'bg-muted/40 cursor-not-allowed' : ''}`}
                          value={goal.weight}
                          onChange={(e) => updateGoal(idx, 'weight', Number(e.target.value))}
                          readOnly={isFormReadOnly}
                        />
                      </FormField>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <FormField label="Target / Expected Outcome">
                        <input className={`${inputCls} ${isFormReadOnly ? 'bg-muted/40 cursor-not-allowed' : ''}`} value={goal.target} onChange={(e) => updateGoal(idx, 'target', e.target.value)} placeholder="e.g. 100%, ≤5%, 3 reports…" readOnly={isFormReadOnly} />
                      </FormField>
                      <FormField label="Actual Achievement">
                        <input className={`${inputCls} ${isFormReadOnly ? 'bg-muted/40 cursor-not-allowed' : ''}`} value={goal.actual} onChange={(e) => updateGoal(idx, 'actual', e.target.value)} placeholder="e.g. 94%, 3.2%, 2 reports…" readOnly={isFormReadOnly} />
                      </FormField>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <RatingSelector value={goal.selfRating} onChange={(v) => updateGoal(idx, 'selfRating', v)} label="Self Rating" disabled={isFormReadOnly} />
                      <RatingSelector value={goal.supervisorRating} onChange={(v) => updateGoal(idx, 'supervisorRating', v)} label="Supervisor Rating" disabled={isFormReadOnly} />
                    </div>
                    <FormField label="Comments / Evidence">
                      <textarea
                        className={`${textareaCls} ${isFormReadOnly ? 'bg-muted/40 cursor-not-allowed' : ''}`}
                        rows={2}
                        value={goal.comments}
                        onChange={(e) => updateGoal(idx, 'comments', e.target.value)}
                        placeholder="Supporting evidence, context, or notes…"
                        readOnly={isFormReadOnly}
                      />
                    </FormField>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Section 2: KPI Status ── */}
        {activeSection === 2 && (
          <div className="space-y-5">
            <SectionHeader number="3" title="KPI Status" subtitle="Select applicable KPIs, record actuals, and rate performance" icon="ChartBarIcon" />
            {!isFormReadOnly && (
              <div className="flex justify-end">
                <button type="button" onClick={addKPI} className="flex items-center gap-1.5 text-xs font-600 text-primary hover:text-primary/80 transition-colors">
                  <Icon name="PlusCircleIcon" size={14} />
                  Add KPI
                </button>
              </div>
            )}

            <div className="space-y-4">
              {form.kpis.map((kpi, idx) => {
                const selectedKPI = KPI_OPTIONS.find((k) => k.id === kpi.kpiId);
                return (
                  <div key={kpi.id} className="border border-border rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30 border-b border-border">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-700 text-foreground">KPI {idx + 1}</span>
                        {selectedKPI && (
                          <span className="text-[10px] font-600 px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                            {selectedKPI.perspective}
                          </span>
                        )}
                      </div>
                      {form.kpis.length > 1 && !isFormReadOnly && (
                        <button type="button" onClick={() => removeKPI(idx)} className="text-muted-foreground hover:text-red-500 transition-colors">
                          <Icon name="TrashIcon" size={13} />
                        </button>
                      )}
                    </div>
                    <div className="p-4 space-y-4">
                      <FormField label="Select KPI" required>
                        <select
                          className={`${selectCls} ${isFormReadOnly ? 'bg-muted/40 cursor-not-allowed' : ''}`}
                          value={kpi.kpiId}
                          disabled={isFormReadOnly}
                          onChange={(e) => updateKPI(idx, 'kpiId', e.target.value)}
                        >
                          <option value="">Choose a KPI…</option>
                          {PERSPECTIVES.map((p) => (
                            <optgroup key={p} label={p}>
                              {KPI_OPTIONS.filter((k) => k.perspective === p).map((k) => (
                                <option key={k.id} value={k.id}>{k.label}</option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </FormField>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <FormField label="Target">
                          <input className={`${inputCls} ${isFormReadOnly ? 'bg-muted/40 cursor-not-allowed' : ''}`} value={kpi.target} onChange={(e) => updateKPI(idx, 'target', e.target.value)} placeholder="e.g. 100%, ≤5%…" readOnly={isFormReadOnly} />
                        </FormField>
                        <FormField label="Actual">
                          <input className={`${inputCls} ${isFormReadOnly ? 'bg-muted/40 cursor-not-allowed' : ''}`} value={kpi.actual} onChange={(e) => updateKPI(idx, 'actual', e.target.value)} placeholder="e.g. 94%, 3.2%…" readOnly={isFormReadOnly} />
                        </FormField>
                        <FormField label="Status">
                          <select className={`${selectCls} ${isFormReadOnly ? 'bg-muted/40 cursor-not-allowed' : ''}`} value={kpi.status} disabled={isFormReadOnly} onChange={(e) => updateKPI(idx, 'status', e.target.value)}>
                            {KPI_STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
                          </select>
                        </FormField>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <RatingSelector value={kpi.selfRating} onChange={(v) => updateKPI(idx, 'selfRating', v)} label="Self Rating (1–5)" disabled={isFormReadOnly} />
                        <RatingSelector value={kpi.supervisorRating} onChange={(v) => updateKPI(idx, 'supervisorRating', v)} label="Supervisor Rating (1–5)" disabled={isFormReadOnly} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="bg-muted/30 rounded-xl border border-border p-4">
              <p className="text-xs font-700 text-foreground mb-2">KPI Status Guide</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { s: 'Achieved', c: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
                  { s: 'Exceeded', c: 'bg-violet-100 text-violet-700 border-violet-200' },
                  { s: 'On Track', c: 'bg-sky-100 text-sky-700 border-sky-200' },
                  { s: 'At Risk', c: 'bg-amber-100 text-amber-700 border-amber-200' },
                  { s: 'Not Started', c: 'bg-red-100 text-red-700 border-red-200' },
                ].map((item) => (
                  <span key={item.s} className={`text-[11px] font-600 px-2 py-0.5 rounded-full border ${item.c}`}>{item.s}</span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Section 3: BSC Perspective Ratings ── */}
        {activeSection === 3 && (
          <div className="space-y-5">
            <SectionHeader number="4" title="Part 1: BSC Perspective Ratings" subtitle="Rate performance across the 4 Balanced Scorecard perspectives (normalised to 100%)" icon="Squares2X2Icon" />

            {/* BSC framework info */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-800">
              <div className="flex items-start gap-2">
                <Icon name="InformationCircleIcon" size={14} className="text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-700 mb-1">ECSA-HC Balanced Scorecard — Part 1 (Normalised to 100%)</p>
                  <p>Rate each perspective 1–5. The weighted BSC score is normalised to 100%. Part 2 (General Competencies) adds up to 20%, giving a total maximum of 120%.</p>
                </div>
              </div>
            </div>

            {/* ── Live Score Preview Panel ── */}
            <div className="bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Icon name="ChartBarIcon" size={14} className="text-primary" />
                <p className="text-xs font-700 text-primary uppercase tracking-wide">Live Score Preview</p>
                <span className="ml-auto text-[10px] font-600 text-primary/70 bg-primary/10 px-2 py-0.5 rounded-full">Updates as you rate</span>
              </div>

              {/* Per-perspective progress bars */}
              <div className="space-y-2 mb-4">
                {form.bscRatings.map((bsc, idx) => {
                  const perspColors = ['bg-emerald-500', 'bg-sky-500', 'bg-violet-500', 'bg-amber-500'];
                  const perspBgColors = ['bg-emerald-100', 'bg-sky-100', 'bg-violet-100', 'bg-amber-100'];
                  const perspTextColors = ['text-emerald-700', 'text-sky-700', 'text-violet-700', 'text-amber-700'];
                  // Contribution of this perspective to the 100% BSC score
                  const perspContribution = (bsc.selfRating / 5) * bsc.weight;
                  const perspPct = (perspContribution / 100) * 100; // already in % of 100
                  return (
                    <div key={bsc.perspective}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[10px] font-600 text-foreground truncate max-w-[60%]">{bsc.perspective}</span>
                        <span className={`text-[10px] font-700 ${perspTextColors[idx]}`}>
                          {perspContribution.toFixed(1)}% <span className="font-400 text-muted-foreground">/ {bsc.weight}%</span>
                        </span>
                      </div>
                      <div className={`h-1.5 rounded-full ${perspBgColors[idx]} overflow-hidden`}>
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${perspColors[idx]}`}
                          style={{ width: `${Math.min((bsc.selfRating / 5) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Score totals */}
              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-primary/20">
                <div className="text-center">
                  <p className="text-[10px] font-600 text-muted-foreground uppercase tracking-wide mb-0.5">BSC Score</p>
                  <p className="text-xl font-800 text-foreground tabular-nums">{bscSelfScore100.toFixed(1)}</p>
                  <p className="text-[10px] text-muted-foreground">/ 100%</p>
                </div>
                <div className="text-center border-x border-primary/20">
                  <p className="text-[10px] font-600 text-muted-foreground uppercase tracking-wide mb-0.5">Competency</p>
                  <p className="text-xl font-800 text-foreground tabular-nums">{competencySelfScore.toFixed(1)}</p>
                  <p className="text-[10px] text-muted-foreground">/ 20%</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-600 text-primary uppercase tracking-wide mb-0.5">Total</p>
                  <p className="text-xl font-800 text-primary tabular-nums">{overallSelfScore.toFixed(1)}%</p>
                  <p className={`text-[10px] font-700 ${getPerformanceBand(overallSelfScore).color}`}>{getPerformanceBand(overallSelfScore).label}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {form.bscRatings.map((bsc, idx) => {
                const perspColors = [
                  'border-l-emerald-400 bg-emerald-50/30',
                  'border-l-sky-400 bg-sky-50/30',
                  'border-l-violet-400 bg-violet-50/30',
                  'border-l-amber-400 bg-amber-50/30',
                ];
                const perspIcons = ['BanknotesIcon', 'UsersIcon', 'CogIcon', 'LightBulbIcon'];
                return (
                  <div key={bsc.perspective} className={`border border-border border-l-4 ${perspColors[idx]} rounded-xl p-4 space-y-4`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon name={perspIcons[idx] as any} size={16} className="text-muted-foreground" />
                        <div>
                          <p className="text-sm font-700 text-foreground">{bsc.perspective}</p>
                          <p className="text-xs text-muted-foreground">Perspective {idx + 1} of 4 · Weight: <span className="font-700">{bsc.weight}%</span></p>
                        </div>
                      </div>
                      {/* Per-perspective score chip */}
                      <div className="text-right">
                        <p className="text-[10px] text-muted-foreground">Contribution</p>
                        <p className="text-sm font-800 text-foreground tabular-nums">
                          {((bsc.selfRating / 5) * bsc.weight).toFixed(1)}%
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <RatingSelector value={bsc.selfRating} onChange={(v) => updateBSC(idx, 'selfRating', v)} label="Self Rating (1–5)" disabled={isFormReadOnly} />
                      <RatingSelector value={bsc.supervisorRating} onChange={(v) => updateBSC(idx, 'supervisorRating', v)} label="Supervisor Rating (1–5)" disabled={isFormReadOnly} />
                    </div>
                    <FormField label="Comments">
                      <textarea
                        className={`${textareaCls} ${isFormReadOnly ? 'bg-muted/40 cursor-not-allowed' : ''}`}
                        rows={2}
                        value={bsc.comments}
                        onChange={(e) => updateBSC(idx, 'comments', e.target.value)}
                        placeholder={`Notes on ${bsc.perspective} performance…`}
                        readOnly={isFormReadOnly}
                      />
                    </FormField>
                  </div>
                );
              })}
            </div>

            {/* BSC Score Summary */}
            <div className="bg-muted/30 rounded-xl border border-border p-4">
              <p className="text-xs font-700 text-foreground mb-3">Part 1 — BSC Weighted Score (normalised to 100%)</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-white rounded-lg border border-border">
                  <p className="text-[11px] font-600 text-muted-foreground uppercase tracking-wide mb-1">Self BSC Score</p>
                  <p className="text-2xl font-800 text-foreground tabular-nums">{bscSelfScore100.toFixed(1)}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">out of 100%</p>
                </div>
                <div className="text-center p-3 bg-white rounded-lg border border-border">
                  <p className="text-[11px] font-600 text-muted-foreground uppercase tracking-wide mb-1">Supervisor BSC Score</p>
                  <p className="text-2xl font-800 text-foreground tabular-nums">{bscSupervisorScore100.toFixed(1)}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">out of 100%</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Section 4: General Competencies (Part 2) ── */}
        {activeSection === 4 && (
          <div className="space-y-5">
            <SectionHeader number="5" title="Part 2: General Competencies" subtitle="Rate the 7 general competencies — score normalised to 20% (max 20 points added to overall for a total of 120%)" icon="AcademicCapIcon" />

            <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 text-xs text-violet-800">
              <div className="flex items-start gap-2">
                <Icon name="InformationCircleIcon" size={14} className="text-violet-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-700 mb-1">ECSA-HC General Competencies — Part 2 (Normalised to 20%)</p>
                  <p>Assign a weight (1–5) and a rating (1–5) for each competency. The maximum total weight is 35. The weighted score is normalised to 20 points, giving a total maximum score of 120% (BSC 100% + Competencies 20%). Leadership (GS3+) is applicable to GS3+ grades.</p>
                </div>
              </div>
            </div>

            {/* Weight total indicator */}
            {(() => {
              const totalW = form.competencyRatings.reduce((s, c) => s + (Number(c.weight) || 0), 0);
              const isOver = totalW > 35;
              return (
                <div className={`flex items-center justify-between rounded-xl border px-4 py-2 text-xs font-600 ${isOver ? 'bg-red-50 border-red-300 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
                  <span>Total Weight: <span className="font-800">{totalW}</span> / 35</span>
                  {isOver && (
                    <span className="flex items-center gap-1">
                      <Icon name="ExclamationTriangleIcon" size={13} className="text-red-500" />
                      Exceeds maximum of 35
                    </span>
                  )}
                  {!isOver && <span className="text-emerald-600">✓ Within limit</span>}
                </div>
              );
            })()}

            <div className="space-y-4">
              {form.competencyRatings.map((comp, idx) => {
                const compColors = [
                  'border-l-blue-400',
                  'border-l-teal-400',
                  'border-l-emerald-400',
                  'border-l-sky-400',
                  'border-l-orange-400',
                  'border-l-purple-400',
                  'border-l-rose-400',
                ];
                return (
                  <div key={comp.id} className={`border border-border border-l-4 ${compColors[idx]} rounded-xl p-4 space-y-4 bg-white`}>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-700 px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                          Competency {idx + 1} of 7
                        </span>
                        {comp.id === 'c7' && (
                          <span className="text-[10px] font-600 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                            GS3+ Only
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-700 text-foreground">{comp.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{comp.description}</p>
                    </div>

                    {/* Weight input */}
                    <div className="flex items-center gap-3">
                      <label className="text-xs font-600 text-foreground whitespace-nowrap">Weight (1–5):</label>
                      <input
                        type="number"
                        min={1}
                        max={5}
                        value={comp.weight}
                        readOnly={isFormReadOnly}
                        onChange={(e) => {
                          if (isFormReadOnly) return;
                          const val = Math.min(5, Math.max(1, Number(e.target.value) || 1));
                          // Enforce total ≤ 35
                          const otherTotal = form.competencyRatings.reduce((s, c, i) => i === idx ? s : s + (Number(c.weight) || 0), 0);
                          const allowed = Math.min(val, 35 - otherTotal);
                          updateCompetency(idx, 'weight', Math.max(1, allowed));
                        }}
                        className="w-16 border border-border rounded-lg px-2 py-1 text-sm font-700 text-center focus:outline-none focus:ring-2 focus:ring-primary/30 ${isFormReadOnly ? 'bg-muted/40 cursor-not-allowed' : ''}"
                      />
                      <span className="text-[11px] text-muted-foreground">
                        Weighted contribution: <span className="font-700 text-foreground">{comp.weight} × rating</span>
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <RatingSelector value={comp.selfRating} onChange={(v) => updateCompetency(idx, 'selfRating', v)} label="Self Rating (1–5)" disabled={isFormReadOnly} />
                      <RatingSelector value={comp.supervisorRating} onChange={(v) => updateCompetency(idx, 'supervisorRating', v)} label="Supervisor Rating (1–5)" disabled={isFormReadOnly} />
                    </div>
                    <FormField label="Behavioural Evidence / Comments">
                      <textarea
                        className={`${textareaCls} ${isFormReadOnly ? 'bg-muted/40 cursor-not-allowed' : ''}`}
                        rows={2}
                        value={comp.behavioralEvidence}
                        onChange={(e) => updateCompetency(idx, 'behavioralEvidence', e.target.value)}
                        placeholder={`Provide specific examples demonstrating ${comp.label.toLowerCase()}…`}
                        readOnly={isFormReadOnly}
                      />
                    </FormField>
                  </div>
                );
              })}
            </div>

            {/* Competency Score Summary */}
            <div className="bg-muted/30 rounded-xl border border-border p-4">
              <p className="text-xs font-700 text-foreground mb-1">Part 2 — Competency Score (Normalized to 0–20)</p>
              <p className="text-[11px] text-muted-foreground mb-3">
                Formula: (Sum of [Weight × Rating]) ÷ (Total Weight × 5) × 20 &nbsp;|&nbsp; Max total weight: 35 &nbsp;|&nbsp; Max score: 20
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-white rounded-lg border border-border">
                  <p className="text-[11px] font-600 text-muted-foreground uppercase tracking-wide mb-1">Self Competency Score</p>
                  <p className="text-2xl font-800 text-foreground tabular-nums">{competencySelfScore.toFixed(1)}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">out of 20</p>
                </div>
                <div className="text-center p-3 bg-white rounded-lg border border-border">
                  <p className="text-[11px] font-600 text-muted-foreground uppercase tracking-wide mb-1">Supervisor Competency Score</p>
                  <p className="text-2xl font-800 text-foreground tabular-nums">{competencySupervisorScore.toFixed(1)}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">out of 20</p>
                </div>
              </div>
              {/* Overall score preview */}
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-[11px] font-600 text-muted-foreground mb-2 text-center">Overall Score (max 120%) = BSC Score (max 100%) + Competency Score (max 20%)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center p-2 bg-primary/5 rounded-lg border border-primary/20">
                    <p className="text-[10px] font-600 text-primary uppercase tracking-wide mb-0.5">Overall Self</p>
                    <p className="text-lg font-800 text-primary tabular-nums">{overallSelfScore.toFixed(1)}%</p>
                    <p className={`text-[10px] font-600 mt-0.5 ${getPerformanceBand(overallSelfScore).color}`}>{getPerformanceBand(overallSelfScore).label}</p>
                  </div>
                  <div className="text-center p-2 bg-primary/5 rounded-lg border border-primary/20">
                    <p className="text-[10px] font-600 text-primary uppercase tracking-wide mb-0.5">Overall Supervisor</p>
                    <p className="text-lg font-800 text-primary tabular-nums">{overallSupervisorScore.toFixed(1)}%</p>
                    <p className={`text-[10px] font-600 mt-0.5 ${getPerformanceBand(overallSupervisorScore).color}`}>{getPerformanceBand(overallSupervisorScore).label}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Section 5: Self-Assessment ── */}
        {activeSection === 5 && (
          <div className="space-y-5">
            <SectionHeader number="6" title="Self-Assessment" subtitle="Staff member's own reflection on performance during the review period" icon="ClipboardDocumentListIcon" />
            <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 text-xs text-sky-800">
              <div className="flex items-start gap-2">
                <Icon name="LightBulbIcon" size={14} className="text-sky-600 flex-shrink-0 mt-0.5" />
                <span>Be honest and specific. Use concrete examples and data where possible. This section is completed by the staff member.</span>
              </div>
            </div>

            <FormField label="Key Strengths & Achievements" required>
              <textarea
                className={`${textareaCls} ${isFormReadOnly ? 'bg-muted/40 cursor-not-allowed' : ''}`}
                rows={4}
                value={form.selfStrengths}
                onChange={(e) => setField('selfStrengths', e.target.value)}
                placeholder="Describe your key achievements, contributions, and strengths during this review period. Include specific examples and measurable outcomes…"
                readOnly={isFormReadOnly}
              />
            </FormField>
            <FormField label="Challenges & Constraints Faced">
              <textarea
                className={`${textareaCls} ${isFormReadOnly ? 'bg-muted/40 cursor-not-allowed' : ''}`}
                rows={3}
                value={form.selfChallenges}
                onChange={(e) => setField('selfChallenges', e.target.value)}
                placeholder="Describe any significant challenges, constraints, or obstacles that affected your performance. What factors were outside your control?…"
                readOnly={isFormReadOnly}
              />
            </FormField>
            <FormField label="Development Needs & Learning Goals">
              <textarea
                className={`${textareaCls} ${isFormReadOnly ? 'bg-muted/40 cursor-not-allowed' : ''}`}
                rows={3}
                value={form.selfDevelopmentNeeds}
                onChange={(e) => setField('selfDevelopmentNeeds', e.target.value)}
                placeholder="Identify skills, knowledge, or competencies you wish to develop. What training or support would help you improve?…"
                readOnly={isFormReadOnly}
              />
            </FormField>

            <div className="border border-border rounded-xl p-4 space-y-3">
              <p className="text-xs font-700 text-foreground">Overall Self-Rating</p>
              <RatingSelector value={form.selfOverallRating} onChange={(v) => setField('selfOverallRating', v)} label="" disabled={isFormReadOnly} />
              <FormField label="Overall Self-Assessment Comments">
                <textarea
                  className={`${textareaCls} ${isFormReadOnly ? 'bg-muted/40 cursor-not-allowed' : ''}`}
                  rows={3}
                  value={form.selfOverallComments}
                  onChange={(e) => setField('selfOverallComments', e.target.value)}
                  placeholder="Provide an overall summary of your performance this period…"
                  readOnly={isFormReadOnly}
                />
              </FormField>
            </div>
          </div>
        )}

        {/* ── Section 6: Supervisor Feedback ── */}
        {activeSection === 6 && (
          <div className="space-y-5">
            <SectionHeader number="7" title="Supervisor Feedback" subtitle="Supervisor's assessment and recommendations for the staff member" icon="ChatBubbleLeftRightIcon" />
            <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 text-xs text-violet-800">
              <div className="flex items-start gap-2">
                <Icon name="UserCircleIcon" size={14} className="text-violet-600 flex-shrink-0 mt-0.5" />
                <span>This section is completed by the supervisor / line manager. Provide constructive, evidence-based feedback.</span>
              </div>
            </div>

            <FormField label="Observed Strengths & Commendations" required>
              <textarea
                className={`${textareaCls} ${isFormReadOnly ? 'bg-muted/40 cursor-not-allowed' : ''}`}
                rows={4}
                value={form.supervisorStrengths}
                onChange={(e) => setField('supervisorStrengths', e.target.value)}
                placeholder="Describe the staff member's key strengths, positive contributions, and commendable behaviours observed during this period…"
                readOnly={isFormReadOnly}
              />
            </FormField>
            <FormField label="Areas for Improvement">
              <textarea
                className={`${textareaCls} ${isFormReadOnly ? 'bg-muted/40 cursor-not-allowed' : ''}`}
                rows={3}
                value={form.supervisorAreasForImprovement}
                onChange={(e) => setField('supervisorAreasForImprovement', e.target.value)}
                placeholder="Identify specific areas where the staff member needs to improve. Be constructive and specific…"
                readOnly={isFormReadOnly}
              />
            </FormField>
            <FormField label="Development Plan & Support Required">
              <textarea
                className={`${textareaCls} ${isFormReadOnly ? 'bg-muted/40 cursor-not-allowed' : ''}`}
                rows={3}
                value={form.supervisorDevelopmentPlan}
                onChange={(e) => setField('supervisorDevelopmentPlan', e.target.value)}
                placeholder="Outline the agreed development plan, training recommendations, mentoring, or other support to be provided…"
                readOnly={isFormReadOnly}
              />
            </FormField>

            <div className="border border-border rounded-xl p-4 space-y-4">
              <p className="text-xs font-700 text-foreground">Supervisor's Overall Assessment</p>
              <RatingSelector value={form.supervisorOverallRating} onChange={(v) => setField('supervisorOverallRating', v)} label="Overall Rating" disabled={isFormReadOnly} />
              <FormField label="Overall Supervisor Comments">
                <textarea
                  className={`${textareaCls} ${isFormReadOnly ? 'bg-muted/40 cursor-not-allowed' : ''}`}
                  rows={3}
                  value={form.supervisorOverallComments}
                  onChange={(e) => setField('supervisorOverallComments', e.target.value)}
                  placeholder="Provide an overall summary of the staff member's performance…"
                  readOnly={isFormReadOnly}
                />
              </FormField>
              <FormField label="Recommendation">
                <select className={`${selectCls} ${isFormReadOnly ? 'bg-muted/40 cursor-not-allowed' : ''}`} value={form.supervisorRecommendation} disabled={isFormReadOnly} onChange={(e) => setField('supervisorRecommendation', e.target.value)}>
                  <option>Outstanding (120%) — 2-Notch Salary Increment</option>
                  <option>Above Average (100%–119%) — 1-Notch Salary Increment</option>
                  <option>Meets Expectations (75%–99%) — No Annual Increment</option>
                  <option>Needs Improvement (50%–74%) — No Annual Increment</option>
                  <option>Unsatisfactory (&lt;50%) — Mandatory Performance Improvement Plan (PIP)</option>
                </select>
              </FormField>
            </div>
          </div>
        )}

        {/* ── Section 7: Sign & Submit ── */}
        {activeSection === 7 && (
          <div className="space-y-5">
            <SectionHeader number="8" title="Review Summary & Signatures" subtitle="Confirm the evaluation details and obtain required signatures" icon="CheckBadgeIcon" />

            <div className="bg-muted/30 rounded-xl border border-border p-4 space-y-3">
              <p className="text-xs font-700 text-foreground uppercase tracking-wide">Evaluation Summary</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <p className="text-muted-foreground font-600">Staff Member</p>
                  <p className="font-700 text-foreground">{form.staffName || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground font-600">Job Title</p>
                  <p className="font-700 text-foreground">{form.jobTitle || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground font-600">Review Type</p>
                  <p className="font-700 text-foreground">{form.reviewType}</p>
                </div>
                <div>
                  <p className="text-muted-foreground font-600">Review Period</p>
                  <p className="font-700 text-foreground">{form.reviewPeriod}</p>
                </div>
                <div>
                  <p className="text-muted-foreground font-600">Supervisor</p>
                  <p className="font-700 text-foreground">{form.supervisor || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground font-600">Review Date</p>
                  <p className="font-700 text-foreground">{form.reviewDate || '—'}</p>
                </div>
              </div>

              {/* Score breakdown */}
              <div className="border-t border-border pt-3">
                <p className="text-xs font-700 text-foreground mb-2">Score Breakdown</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="text-center p-2 bg-white rounded-lg border border-border">
                    <p className="text-muted-foreground font-600 text-[10px]">BSC Score (max 100%)</p>
                    <p className="font-800 text-foreground text-base">{bscSelfScore100.toFixed(1)}</p>
                    <p className="text-[10px] text-muted-foreground">Self / 100</p>
                  </div>
                  <div className="text-center p-2 bg-white rounded-lg border border-border">
                    <p className="text-muted-foreground font-600 text-[10px]">Competency (max 20%)</p>
                    <p className="font-800 text-foreground text-base">{competencySelfScore.toFixed(1)}</p>
                    <p className="text-[10px] text-muted-foreground">Self / 20</p>
                  </div>
                  <div className="text-center p-2 bg-primary/5 rounded-lg border border-primary/20">
                    <p className="text-primary font-600 text-[10px]">Overall Self</p>
                    <p className="font-800 text-primary text-base">{overallSelfScore.toFixed(1)}%</p>
                    <p className={`text-[10px] font-600 ${getPerformanceBand(overallSelfScore).color}`}>{getPerformanceBand(overallSelfScore).label}</p>
                    <p className="text-[9px] text-muted-foreground mt-0.5">{getPerformanceBand(overallSelfScore).increment}</p>
                  </div>
                  <div className="text-center p-2 bg-primary/5 rounded-lg border border-primary/20">
                    <p className="text-primary font-600 text-[10px]">Overall Supervisor</p>
                    <p className="font-800 text-primary text-base">{overallSupervisorScore.toFixed(1)}%</p>
                    <p className={`text-[10px] font-600 ${getPerformanceBand(overallSupervisorScore).color}`}>{getPerformanceBand(overallSupervisorScore).label}</p>
                    <p className="text-[9px] text-muted-foreground mt-0.5">{getPerformanceBand(overallSupervisorScore).increment}</p>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground mt-2 text-center">Formula: Overall (max 120%) = BSC Score (max 100%) + Competency Score (max 20%)</p>

                {/* Performance band reference */}
                <div className="mt-3 bg-muted/40 rounded-lg border border-border p-3">
                  <p className="text-[10px] font-700 text-foreground uppercase tracking-wide mb-2">Performance Band Reference</p>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[10px]">
                    <div className="flex items-start gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0 mt-0.5" />
                      <div><p className="font-700 text-emerald-700">120% — Outstanding</p><p className="text-muted-foreground">2-Notch Salary Increment</p></div>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-sky-500 flex-shrink-0 mt-0.5" />
                      <div><p className="font-700 text-sky-700">100%–119% — Above Average</p><p className="text-muted-foreground">1-Notch Salary Increment</p></div>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-0.5" />
                      <div><p className="font-700 text-blue-700">75%–99% — Meets Expectations</p><p className="text-muted-foreground">No Annual Increment</p></div>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0 mt-0.5" />
                      <div><p className="font-700 text-amber-700">50%–74% — Needs Improvement</p><p className="text-muted-foreground">No Annual Increment</p></div>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 mt-0.5" />
                      <div><p className="font-700 text-red-700">&lt;50% — Unsatisfactory</p><p className="text-muted-foreground">Mandatory PIP</p></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
              <p className="text-xs font-700 text-primary mb-1">Supervisor Recommendation</p>
              <p className="text-sm font-600 text-foreground">{form.supervisorRecommendation}</p>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-700 text-foreground uppercase tracking-wide">Acknowledgement & Signatures</p>
              <p className="text-xs text-muted-foreground">By entering your name below, you confirm that you have reviewed and acknowledge the contents of this evaluation form.</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="border border-border rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-sky-100 flex items-center justify-center">
                      <Icon name="UserIcon" size={12} className="text-sky-600" />
                    </div>
                    <p className="text-xs font-700 text-foreground">Staff Member</p>
                  </div>
                  <input
                    className={`${inputCls} ${isFormReadOnly ? 'bg-muted/40 cursor-not-allowed' : ''}`}
                    value={form.staffSignature}
                    onChange={(e) => setField('staffSignature', e.target.value)}
                    placeholder="Type full name to sign…"
                    readOnly={isFormReadOnly}
                  />
                  <p className="text-[10px] text-muted-foreground">Date: {form.reviewDate || '—'}</p>
                </div>
                <div className="border border-border rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center">
                      <Icon name="UserCircleIcon" size={12} className="text-violet-600" />
                    </div>
                    <p className="text-xs font-700 text-foreground">Supervisor</p>
                  </div>
                  <input
                    className={`${inputCls} ${isFormReadOnly ? 'bg-muted/40 cursor-not-allowed' : ''}`}
                    value={form.supervisorSignature}
                    onChange={(e) => setField('supervisorSignature', e.target.value)}
                    placeholder="Type full name to sign…"
                    readOnly={isFormReadOnly}
                  />
                  <p className="text-[10px] text-muted-foreground">Date: {form.reviewDate || '—'}</p>
                </div>
                <div className="border border-border rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
                      <Icon name="BuildingOfficeIcon" size={12} className="text-emerald-600" />
                    </div>
                    <p className="text-xs font-700 text-foreground">HR Officer</p>
                  </div>
                  <input
                    className={`${inputCls} ${isFormReadOnly ? 'bg-muted/40 cursor-not-allowed' : ''}`}
                    value={form.hrSignature}
                    onChange={(e) => setField('hrSignature', e.target.value)}
                    placeholder="Type full name to sign…"
                    readOnly={isFormReadOnly}
                  />
                  <p className="text-[10px] text-muted-foreground">Date: {form.reviewDate || '—'}</p>
                </div>
              </div>
            </div>

            {saveError && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-4 text-xs text-red-800">
                <Icon name="ExclamationCircleIcon" size={14} className="text-red-600 flex-shrink-0 mt-0.5" />
                {saveError}
              </div>
            )}

            {!isFormReadOnly && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800">
                <div className="flex items-start gap-2">
                  <Icon name="ExclamationTriangleIcon" size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
                  <span>Once submitted, this evaluation will be saved to the system and routed to HR for processing. Ensure all sections are complete and all parties have acknowledged the form before submitting.</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer navigation */}
      <div className="flex items-center justify-between px-5 py-4 border-t border-border bg-white">
        <button
          type="button"
          onClick={() => setActiveSection((s) => Math.max(0, s - 1))}
          disabled={activeSection === 0}
          className="flex items-center gap-1.5 text-sm font-600 text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Icon name="ChevronLeftIcon" size={16} />
          Previous
        </button>
        <span className="text-xs text-muted-foreground font-600">
          Step {activeSection + 1} of {sections.length}
        </span>
        {activeSection < sections.length - 1 ? (
          <button
            type="button"
            onClick={() => setActiveSection((s) => Math.min(sections.length - 1, s + 1))}
            className="flex items-center gap-1.5 text-sm font-600 text-primary hover:text-primary/80 transition-colors"
          >
            Next
            <Icon name="ChevronRightIcon" size={16} />
          </button>
        ) : isFormReadOnly ? (
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 text-sm font-600 text-white bg-muted-foreground hover:bg-muted-foreground/90 px-4 py-2 rounded-lg transition-all"
          >
            <Icon name="XMarkIcon" size={15} />
            Close (Read-only)
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-1.5 text-sm font-600 text-white bg-primary hover:bg-primary/90 px-4 py-2 rounded-lg transition-all active:scale-95 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Icon name="PaperAirplaneIcon" size={15} />
                Submit Evaluation
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
