'use client';

import React, { useState, useEffect } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import PrintAppraisalLayout from './PrintAppraisalLayout';
import { useAutosave, AutosaveStatus, autosaveStatusLabel } from '@/hooks/useAutosave';
import { useAuth } from '@/contexts/AuthContext';

// ─── Types ───────────────────────────────────────────────────────────────────

interface StaffOption {
  id: string;
  full_name: string;
  job_title: string;
  supervisor_id: string | null;
  supervisor_name: string | null;
}

interface PerspectiveRow {
  id: string;
  perspective: string;
  objective: string;
  kpis: string[];
  customKpis: string;
  weight: number;
  target: string;
  keyActivities: string;
}

// ─── NEW: General Competency ──────────────────────────────────────────────────
interface GeneralCompetency {
  id: string;
  name: string;
  description: string;
  weight: number;
}

interface WorkplanFormData {
  staffId: string;
  staffName: string;
  jobTitle: string;
  supervisorId: string;
  supervisorName: string;
  fiscalYear: string;
  reviewYear: number;
  perspectivesObjectives: PerspectiveRow[];
  generalCompetencies: GeneralCompetency[];
  staffSignature: string;
  supervisorSignature: string;
}

// ─── Validation Types ─────────────────────────────────────────────────────────

interface Step0Errors {
  staffId?: string;
  supervisorId?: string;
  fiscalYear?: string;
}

interface RowErrors {
  perspective?: string;
  objective?: string;
  weight?: string;
  target?: string;
  kpis?: string;
}

interface Step1Errors {
  rows: Record<number, RowErrors>;
  totalWeight?: string;
  competencyWeight?: string;
}

// ─── NEW: Default General Competencies ───────────────────────────────────────
const DEFAULT_GENERAL_COMPETENCIES: GeneralCompetency[] = [
  { id: 'gc-1', name: 'Communication', description: 'Ability to convey information clearly and effectively, both verbally and in writing', weight: 4 },
  { id: 'gc-2', name: 'Teamwork & Collaboration', description: 'Works cooperatively with others, contributes to team goals, and supports colleagues', weight: 4 },
  { id: 'gc-3', name: 'Initiative & Problem Solving', description: 'Proactively identifies issues, proposes solutions, and takes ownership of tasks', weight: 4 },
  { id: 'gc-4', name: 'Professionalism & Work Ethics', description: 'Demonstrates integrity, punctuality, accountability, and adherence to organisational values', weight: 4 },
  { id: 'gc-5', name: 'Adaptability & Learning', description: 'Embraces change, continuously develops skills, and applies new knowledge effectively', weight: 4 },
];

interface Step2Errors {
  staffSignature?: string;
  supervisorSignature?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PERSPECTIVES = [
  'Financial/Stewardship',
  'Customer/Stakeholder',
  'Internal Business Processes',
  'Innovation Learning & Growth',
];

const KPI_OPTIONS = [
  { id: 'k1', label: 'Budget Variance (≤5% of approved budget)', perspective: 'Financial/Stewardship' },
  { id: 'k2', label: 'Cost Recovery Rate (10% from all new grants)', perspective: 'Financial/Stewardship' },
  { id: 'k3', label: 'Payroll Accuracy (zero-error rate)', perspective: 'Financial/Stewardship' },
  { id: 'k4', label: 'Grant Disbursement Efficiency (within 5 days)', perspective: 'Financial/Stewardship' },
  { id: 'k5', label: 'Reporting Timeliness (100% donor reports by deadline)', perspective: 'Financial/Stewardship' },
  { id: 'k6', label: 'Unqualified Audited Financial Statements by Sept 30', perspective: 'Financial/Stewardship' },
  { id: 'k7', label: 'Revenue Growth (% increase in membership contributions)', perspective: 'Financial/Stewardship' },
  { id: 'k8', label: 'Procurement Savings (% reduction in admin costs)', perspective: 'Financial/Stewardship' },
  { id: 'k9', label: 'Internal Service Level (SLA) — 48h resolution rate', perspective: 'Customer/Stakeholder' },
  { id: 'k10', label: 'Employee Engagement Index (annual survey score)', perspective: 'Customer/Stakeholder' },
  { id: 'k11', label: 'Recruitment Efficiency (avg. time-to-hire ≤90 days)', perspective: 'Customer/Stakeholder' },
  { id: 'k12', label: 'System Availability (99.9% uptime)', perspective: 'Customer/Stakeholder' },
  { id: 'k13', label: 'Service Desk Resolution Rate (critical tickets ≤4h)', perspective: 'Customer/Stakeholder' },
  { id: 'k14', label: 'Visitor / Stakeholder Satisfaction Index', perspective: 'Customer/Stakeholder' },
  { id: 'k15', label: 'On-Time Performance (pickups/arrivals ≥98%)', perspective: 'Customer/Stakeholder' },
  { id: 'k16', label: 'No. of countries achieving WHO Maturity Level 3/4', perspective: 'Customer/Stakeholder' },
  { id: 'k17', label: 'PMS System Adoption Rate (100% of staff)', perspective: 'Internal Business Processes' },
  { id: 'k18', label: 'Data Integrity (0% error rate in HR digital repository)', perspective: 'Internal Business Processes' },
  { id: 'k19', label: 'Audit Readiness (zero high-risk findings)', perspective: 'Internal Business Processes' },
  { id: 'k20', label: 'ERP Adoption Rate (100% of financial transactions)', perspective: 'Internal Business Processes' },
  { id: 'k21', label: 'Internal Control Compliance (zero high-risk audit findings)', perspective: 'Internal Business Processes' },
  { id: 'k22', label: 'Data Warehouse Readiness (% completion)', perspective: 'Internal Business Processes' },
  { id: 'k23', label: 'Automation Rate (% HR/Finance processes migrated)', perspective: 'Internal Business Processes' },
  { id: 'k24', label: 'Logbook Accuracy (100% error-free daily logs)', perspective: 'Internal Business Processes' },
  { id: 'k25', label: 'CPD Completion Rate (% staff meeting annual PD targets)', perspective: 'Innovation Learning & Growth' },
  { id: 'k26', label: 'Staff Turnover Rate (target ≤5% voluntary turnover)', perspective: 'Innovation Learning & Growth' },
  { id: 'k27', label: 'Leadership Development (% mid-level managers trained)', perspective: 'Innovation Learning & Growth' },
  { id: 'k28', label: 'Cybersecurity Maturity (0 successful breaches)', perspective: 'Innovation Learning & Growth' },
  { id: 'k29', label: 'ISO Certification Progress (ISO 27001 / ISO 9001)', perspective: 'Innovation Learning & Growth' },
  { id: 'k30', label: 'Corporate Governance Index Score (target: 60%)', perspective: 'Innovation Learning & Growth' },
  { id: 'k31', label: 'Employee Retention Rate (target: 95%)', perspective: 'Innovation Learning & Growth' },
  { id: 'k32', label: 'Implementation Rate of AI/ERP Systems', perspective: 'Innovation Learning & Growth' },
];

// ─── Predefined Objectives by Perspective ────────────────────────────────────
const OBJECTIVE_OPTIONS: Record<string, string[]> = {
  'Financial/Stewardship': [
    // From BALANCED_SCORECARD_DIRECTOR_GENERAL
    'Strengthen financial sustainability',
    'Improve member state contributions',
    'Diversify revenue streams',
    'Strengthen donor and partner funding',
    'Improve budget utilization',
    'Strengthen financial accountability',
    'Improve cost efficiency',
    // From DOID_Performance_Contract_Sibusiso_Sibandze
    'Support resource mobilization',
    'Improve operational efficiency',
    'Strengthen budget utilization and financial controls',
    'Improve cost management',
    'Introduce e-procurement systems',
  ],
  'Customer/Stakeholder': [
    // From BALANCED_SCORECARD_DIRECTOR_GENERAL
    'Strengthen value proposition to Member States',
    'Enhance strategic partnerships',
    'Improve ECSA-HC visibility and relevance',
    'Strengthen collaboration with regional and international organizations',
    'Improve stakeholder engagement',
    'Strengthen advocacy and policy influence',
    'Enhance support to Member States',
    // From DOID_Performance_Contract_Sibusiso_Sibandze
    'Partnerships, governance and institutional credibility',
    'Enhance external relations',
    'Improve partner satisfaction and engagement',
  ],
  'Internal Business Processes': [
    // From BALANCED_SCORECARD_DIRECTOR_GENERAL
    'Lead implementation of Strategic Plan 2024–2034',
    'Improve annual workplan execution',
    'Strengthen governance effectiveness',
    'Improve institutional performance management',
    'Strengthen operational efficiency',
    'Improve compliance and risk management',
    'Enhance digital transformation',
    // From DOID_Performance_Contract_Sibusiso_Sibandze
    'Improve governance support',
    'Strengthen institutional reputation',
    'Governance, systems and operational excellence',
    'Strengthen institutional systems',
    'Strengthen corporate services',
    'Formalize partnerships and MoUs',
  ],
  'Innovation Learning & Growth': [
    // From BALANCED_SCORECARD_DIRECTOR_GENERAL
    'Strengthen organizational capability',
    'Develop leadership pipeline',
    'Improve staff engagement',
    'Strengthen workforce competencies',
    'Promote innovation and knowledge management',
    'Strengthen organizational culture',
    'Improve digital and technology capability',
    // From DOID_Performance_Contract_Sibusiso_Sibandze
    'Build institutional capacity',
    'Strengthen leadership pipeline and succession planning',
    'Improve workforce capability',
    'Promote learning culture',
    'Strengthen organizational culture and values',
  ],
};

// ─── Objective Combobox Component ────────────────────────────────────────────
interface ObjectiveComboboxProps {
  value: string;
  perspective: string;
  onChange: (val: string) => void;
  hasError?: boolean;
}

function ObjectiveCombobox({ value, perspective, onChange, hasError }: ObjectiveComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState(value);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const options = perspective ? (OBJECTIVE_OPTIONS[perspective] || []) : [];
  const filtered = query.trim()
    ? options.filter((o) => o.toLowerCase().includes(query.toLowerCase()))
    : options;

  // Sync external value changes
  React.useEffect(() => {
    setQuery(value);
  }, [value]);

  // Close on outside click
  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        // Commit typed value on blur
        if (query !== value) onChange(query);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [query, value, onChange]);

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setQuery(e.target.value);
    onChange(e.target.value);
    setOpen(true);
  }

  function handleSelect(option: string) {
    setQuery(option);
    onChange(option);
    setOpen(false);
  }

  const baseCls = 'w-full text-sm border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 transition-colors placeholder:text-muted-foreground/60 resize-none';
  const normalCls = `${baseCls} border-border focus:ring-primary/30 focus:border-primary`;
  const errorCls = `${baseCls} border-red-400 focus:ring-red-300 focus:border-red-400`;

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <textarea
          ref={inputRef as any}
          rows={2}
          className={hasError ? errorCls : normalCls}
          placeholder={
            perspective
              ? 'Type your objective or pick from the dropdown…'
              : 'Select a BSC Perspective first, then type or pick an objective…'
          }
          value={query}
          onChange={handleInputChange}
          onFocus={() => { if (options.length > 0) setOpen(true); }}
        />
        {options.length > 0 && (
          <button
            type="button"
            tabIndex={-1}
            onMouseDown={(e) => {
              e.preventDefault();
              setOpen((prev) => !prev);
              inputRef.current?.focus();
            }}
            className="absolute right-2 top-2 p-1 rounded hover:bg-muted/60 text-muted-foreground transition-colors"
            title="Show predefined objectives"
          >
            <Icon name="ChevronDownIcon" size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>

      {open && filtered.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-border rounded-xl shadow-lg max-h-52 overflow-y-auto">
          <div className="px-3 py-1.5 border-b border-border bg-muted/30">
            <p className="text-[10px] font-600 text-muted-foreground uppercase tracking-wide">
              Predefined objectives — {perspective}
            </p>
          </div>
          {filtered.map((option, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); handleSelect(option); }}
              className={`w-full text-left px-3 py-2 text-xs hover:bg-primary/5 hover:text-primary transition-colors border-b border-border/50 last:border-0 ${
                value === option ? 'bg-primary/10 text-primary font-600' : 'text-foreground'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      )}

      {open && filtered.length === 0 && query.trim() && options.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-border rounded-xl shadow-lg">
          <div className="px-3 py-2.5 text-xs text-muted-foreground italic">
            No predefined objectives match your input — your custom text will be used.
          </div>
        </div>
      )}
    </div>
  );
}

const PERSPECTIVE_COLORS: Record<string, string> = {
  'Financial/Stewardship': 'bg-emerald-50 border-emerald-200 text-emerald-800',
  'Customer/Stakeholder': 'bg-sky-50 border-sky-200 text-sky-800',
  'Internal Business Processes': 'bg-violet-50 border-violet-200 text-violet-800',
  'Innovation Learning & Growth': 'bg-amber-50 border-amber-200 text-amber-800',
};

const inputCls = 'w-full text-sm border border-border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors placeholder:text-muted-foreground/60';
const inputErrCls = 'w-full text-sm border border-red-400 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-400 transition-colors placeholder:text-muted-foreground/60';
const selectCls = inputCls + ' cursor-pointer';
const selectErrCls = inputErrCls + ' cursor-pointer';
const textareaCls = inputCls + ' resize-none';
const textareaErrCls = inputErrCls + ' resize-none';

function makeRow(): PerspectiveRow {
  return {
    id: `p-${Date.now()}-${Math.random()}`,
    perspective: '',
    objective: '',
    kpis: [],
    customKpis: '',
    weight: 0,
    target: '',
    keyActivities: '',
  };
}

function FormField({ label, required, children, error }: { label: string; required?: boolean; children: React.ReactNode; error?: string }) {
  return (
    <div>
      <label className="block text-xs font-600 text-foreground mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {error && (
        <p className="flex items-center gap-1 mt-1 text-[11px] text-red-600">
          <Icon name="ExclamationCircleIcon" size={11} className="flex-shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

// ─── Validation helpers ───────────────────────────────────────────────────────

function validateStep0(form: WorkplanFormData): Step0Errors {
  const errors: Step0Errors = {};
  if (!form.staffId) errors.staffId = 'Please select a staff member.';
  if (!form.supervisorId) errors.supervisorId = 'Please select a supervisor / line manager.';
  if (!form.fiscalYear) errors.fiscalYear = 'Please select a fiscal year.';
  return errors;
}

function validateStep1(form: WorkplanFormData): Step1Errors {
  const errors: Step1Errors = { rows: {} };
  const totalWeight = form.perspectivesObjectives.reduce((s, r) => s + (Number(r.weight) || 0), 0);

  if (totalWeight === 0) {
    errors.totalWeight = `Total BSC weight is 0. It must be between 1 and 80.`;
  } else if (totalWeight > 80) {
    errors.totalWeight = `Total BSC weight is ${totalWeight}. It must not exceed 80 (currently over by ${totalWeight - 80}).`;
  }

  const totalCompWeight = form.generalCompetencies.reduce((s, c) => s + (Number(c.weight) || 0), 0);
  if (Math.abs(totalCompWeight - 20) >= 1) {
    errors.competencyWeight = `Total General Competencies weight is ${totalCompWeight}. It must equal exactly 20.`;
  }

  form.perspectivesObjectives.forEach((row, idx) => {
    const rowErr: RowErrors = {};
    if (!row.perspective) rowErr.perspective = 'Select a BSC perspective.';
    if (!row.objective.trim()) rowErr.objective = 'Objective / Goal Statement is required.';
    if (!row.weight || row.weight < 1 || row.weight > 5) rowErr.weight = 'Weight must be between 1 and 5.';
    if (!row.target.trim()) rowErr.target = 'Annual Target is required.';
    if (row.kpis.length === 0) rowErr.kpis = 'Select at least one KPI for this objective.';
    if (Object.keys(rowErr).length > 0) errors.rows[idx] = rowErr;
  });

  return errors;
}

function validateStep2(form: WorkplanFormData): Step2Errors {
  const errors: Step2Errors = {};
  if (!form.staffSignature.trim()) errors.staffSignature = 'Staff signature is required.';
  if (!form.supervisorSignature.trim()) errors.supervisorSignature = 'Supervisor signature is required.';
  return errors;
}

function hasStep0Errors(e: Step0Errors) { return Object.keys(e).length > 0; }
function hasStep1Errors(e: Step1Errors) { return Object.keys(e.rows).length > 0 || !!e.totalWeight || !!e.competencyWeight; }
function hasStep2Errors(e: Step2Errors) { return Object.keys(e).length > 0; }

/** Normalise BSC weights from an 80-point scale to a 100-point scale for scoring. */
function normalizeBscWeights(rows: PerspectiveRow[]): PerspectiveRow[] {
  const total = rows.reduce((s, r) => s + (Number(r.weight) || 0), 0);
  if (total === 0) return rows;
  return rows.map((r) => ({
    ...r,
    weight: Math.round((r.weight / total) * 100 * 100) / 100, // normalise to 100, 2 dp
  }));
}

// ─── Completion Checklist ─────────────────────────────────────────────────────

interface ChecklistItem {
  label: string;
  done: boolean;
  detail?: string;
}

function buildChecklist(form: WorkplanFormData): ChecklistItem[] {
  const totalWeight = form.perspectivesObjectives.reduce((s, r) => s + (Number(r.weight) || 0), 0);
  const totalCompWeight = form.generalCompetencies.reduce((s, c) => s + (Number(c.weight) || 0), 0);
  const allRowsComplete = form.perspectivesObjectives.every(
    (r) => r.perspective && r.objective.trim() && r.target.trim() && r.kpis.length > 0 && r.weight >= 1 && r.weight <= 5
  );

  return [
    {
      label: 'Staff member selected',
      done: !!form.staffId,
      detail: form.staffName || undefined,
    },
    {
      label: 'Supervisor / Line Manager selected',
      done: !!form.supervisorId,
      detail: form.supervisorName || undefined,
    },
    {
      label: 'Fiscal year set',
      done: !!form.fiscalYear,
      detail: form.fiscalYear || undefined,
    },
    {
      label: 'At least one objective defined',
      done: form.perspectivesObjectives.length > 0,
      detail: `${form.perspectivesObjectives.length} objective(s)`,
    },
    {
      label: 'All objectives complete (perspective, goal, target, KPI)',
      done: allRowsComplete,
      detail: allRowsComplete ? 'All fields filled' : 'Some objectives have missing fields',
    },
    {
      label: 'BSC total weight ≤ 80 (normalised to 100 for scoring)',
      done: totalWeight > 0 && totalWeight <= 80,
      detail: `Current BSC total: ${totalWeight} / 80`,
    },
    {
      label: 'General Competencies total weight equals 20',
      done: Math.abs(totalCompWeight - 20) < 1,
      detail: `Current competencies total: ${totalCompWeight}`,
    },
    {
      label: 'Staff signature provided',
      done: !!form.staffSignature.trim(),
    },
    {
      label: 'Supervisor signature provided',
      done: !!form.supervisorSignature.trim(),
    },
  ];
}

// ─── Main Component ──────────────────────────────────────────────────────────

interface WorkplanSettingFormProps {
  onClose: () => void;
  onSubmit?: () => void;
}

export default function WorkplanSettingForm({ onClose, onSubmit }: WorkplanSettingFormProps) {
  const { profile, getRoleLevel } = useAuth();
  const isManager = getRoleLevel() >= 70;

  const [activeStep, setActiveStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [staffList, setStaffList] = useState<StaffOption[]>([]);
  const [staffLoading, setStaffLoading] = useState(true);
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  // Autosave state
  const [autoSaveStatus, setAutoSaveStatus] = useState<AutosaveStatus>('idle');
  const [draftRecovered, setDraftRecovered] = useState(false);

  // Validation error state
  const [step0Errors, setStep0Errors] = useState<Step0Errors>({});
  const [step1Errors, setStep1Errors] = useState<Step1Errors>({ rows: {} });
  const [step2Errors, setStep2Errors] = useState<Step2Errors>({});
  const [showChecklist, setShowChecklist] = useState(false);

  // Supervisor approval state (shown after workplan is saved)
  const [savedWorkplanId, setSavedWorkplanId] = useState<string | null>(null);
  const [approvalMode, setApprovalMode] = useState(false);
  const [approvalComments, setApprovalComments] = useState('');
  const [approving, setApproving] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [stageAdvanced, setStageAdvanced] = useState(false);

  const supabase = createClient();

  const [form, setForm] = useState<WorkplanFormData>({
    staffId: '',
    staffName: '',
    jobTitle: '',
    supervisorId: '',
    supervisorName: '',
    fiscalYear: 'FY 2025-2026 (Jul–Jun)',
    reviewYear: 2026,
    perspectivesObjectives: [makeRow()],
    generalCompetencies: DEFAULT_GENERAL_COMPETENCIES.map((c) => ({ ...c })),
    staffSignature: '',
    supervisorSignature: '',
  });

  // ── Autosave hook ────────────────────────────────────────────────────────
  const autosaveEnabled = !!form.staffId;
  const { saveDraft, recoverDraft, clearDraft } = useAutosave({
    staffId: form.staffId || null,
    workplanId: null,
    draftType: 'workplan_setting',
    reviewPeriod: form.fiscalYear || 'annual',
    formData: {
      staffId: form.staffId,
      staffName: form.staffName,
      jobTitle: form.jobTitle,
      supervisorId: form.supervisorId,
      supervisorName: form.supervisorName,
      fiscalYear: form.fiscalYear,
      reviewYear: form.reviewYear,
      perspectivesObjectives: form.perspectivesObjectives,
      generalCompetencies: form.generalCompetencies,
      staffSignature: form.staffSignature,
      supervisorSignature: form.supervisorSignature,
    },
    activeStep,
    enabled: autosaveEnabled,
    onStatusChange: setAutoSaveStatus,
  });

  // Recover draft when staff member is selected
  useEffect(() => {
    if (!form.staffId) return;
    recoverDraft(null, form.staffId, form.fiscalYear || 'annual').then((data) => {
      if (data?.form_data) {
        const fd = data.form_data as any;
        setForm((prev) => ({
          ...prev,
          supervisorId: fd.supervisorId || prev.supervisorId,
          supervisorName: fd.supervisorName || prev.supervisorName,
          jobTitle: fd.jobTitle || prev.jobTitle,
          fiscalYear: fd.fiscalYear || prev.fiscalYear,
          reviewYear: fd.reviewYear || prev.reviewYear,
          perspectivesObjectives: fd.perspectivesObjectives?.length ? fd.perspectivesObjectives : prev.perspectivesObjectives,
          generalCompetencies: fd.generalCompetencies?.length ? fd.generalCompetencies : prev.generalCompetencies,
          staffSignature: fd.staffSignature || prev.staffSignature,
          supervisorSignature: fd.supervisorSignature || prev.supervisorSignature,
        }));
        if (data.active_step) setActiveStep(data.active_step);
        setDraftRecovered(true);
        setTimeout(() => setDraftRecovered(false), 5000);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.staffId]);

  useEffect(() => {
    async function loadStaff() {
      setStaffLoading(true);
      try {
        const { data } = await supabase
          .from('staff')
          .select('id, full_name, job_title, supervisor_id, supervisor_name')
          .eq('employment_status', 'active')
          .order('full_name', { ascending: true });
        if (data) setStaffList(data as StaffOption[]);
      } catch (err) {
        console.log('Error loading staff:', err);
      } finally {
        setStaffLoading(false);
      }
    }
    loadStaff();
  }, []);

  // ── Auto-lock staff field for non-managers ───────────────────────────────
  // Once the staff list is loaded, if the current user is not a manager/director,
  // automatically select their own staff record and lock the field.
  useEffect(() => {
    if (isManager) return;           // managers keep full dropdown access
    if (!profile?.staffId) return;   // no linked staff record — nothing to lock
    if (staffLoading) return;        // wait until list is ready
    if (form.staffId) return;        // already set (e.g. draft recovery)

    const ownRecord = staffList.find((s) => s.id === profile.staffId);
    if (!ownRecord) return;

    setForm((prev) => {
      const sup = ownRecord.supervisor_id
        ? staffList.find((s) => s.id === ownRecord.supervisor_id)
        : null;
      return {
        ...prev,
        staffId: ownRecord.id,
        staffName: ownRecord.full_name,
        jobTitle: ownRecord.job_title,
        supervisorId: ownRecord.supervisor_id || '',
        supervisorName: sup?.full_name || ownRecord.supervisor_name || '',
      };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffLoading, staffList]);

  function setField<K extends keyof WorkplanFormData>(key: K, value: WorkplanFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    // Clear field-level error on change
    if (key === 'staffId') setStep0Errors((e) => { const n = { ...e }; delete n.staffId; return n; });
    if (key === 'supervisorId') setStep0Errors((e) => { const n = { ...e }; delete n.supervisorId; return n; });
    if (key === 'fiscalYear') setStep0Errors((e) => { const n = { ...e }; delete n.fiscalYear; return n; });
    if (key === 'staffSignature') setStep2Errors((e) => { const n = { ...e }; delete n.staffSignature; return n; });
    if (key === 'supervisorSignature') setStep2Errors((e) => { const n = { ...e }; delete n.supervisorSignature; return n; });
  }

  function updateRow(idx: number, field: keyof PerspectiveRow, value: any) {
    setForm((prev) => {
      const rows = [...prev.perspectivesObjectives];
      rows[idx] = { ...rows[idx], [field]: value };
      return { ...prev, perspectivesObjectives: rows };
    });
    // Clear row-level error on change
    setStep1Errors((prev) => {
      const rows = { ...prev.rows };
      if (rows[idx]) {
        const rowErr = { ...rows[idx] };
        delete (rowErr as any)[field];
        if (Object.keys(rowErr).length === 0) delete rows[idx];
        else rows[idx] = rowErr;
      }
      return { ...prev, rows };
    });
  }

  function addRow() {
    setForm((prev) => ({ ...prev, perspectivesObjectives: [...prev.perspectivesObjectives, makeRow()] }));
  }

  function removeRow(idx: number) {
    setForm((prev) => ({ ...prev, perspectivesObjectives: prev.perspectivesObjectives.filter((_, i) => i !== idx) }));
    setStep1Errors((prev) => {
      const rows = { ...prev.rows };
      delete rows[idx];
      // Re-index
      const reindexed: Record<number, RowErrors> = {};
      Object.entries(rows).forEach(([k, v]) => {
        const n = Number(k);
        if (n > idx) reindexed[n - 1] = v;
        else reindexed[n] = v;
      });
      return { ...prev, rows: reindexed };
    });
  }

  function toggleKPI(rowIdx: number, kpiId: string) {
    const row = form.perspectivesObjectives[rowIdx];
    const kpis = row.kpis.includes(kpiId)
      ? row.kpis.filter((k) => k !== kpiId)
      : [...row.kpis, kpiId];
    updateRow(rowIdx, 'kpis', kpis);
  }

  function updateCompetencyWeight(idx: number, weight: number) {
    setForm((prev) => {
      const comps = [...prev.generalCompetencies];
      comps[idx] = { ...comps[idx], weight };
      return { ...prev, generalCompetencies: comps };
    });
    // Clear competency weight error on change
    setStep1Errors((prev) => {
      const n = { ...prev };
      delete n.competencyWeight;
      return n;
    });
  }

  const totalWeight = form.perspectivesObjectives.reduce((s, r) => s + (Number(r.weight) || 0), 0);
  const totalCompWeight = form.generalCompetencies.reduce((s, c) => s + (Number(c.weight) || 0), 0);

  const steps = [
    { label: 'Staff & Supervisor', icon: 'UserIcon' },
    { label: 'Perspectives, Objectives & KPIs', icon: 'FlagIcon' },
    { label: 'Sign & Finalise', icon: 'CheckBadgeIcon' },
  ];

  // ── Step navigation with validation ──────────────────────────────────────
  function handleNext() {
    if (activeStep === 0) {
      const errors = validateStep0(form);
      setStep0Errors(errors);
      if (hasStep0Errors(errors)) return;
    }
    if (activeStep === 1) {
      const errors = validateStep1(form);
      setStep1Errors(errors);
      if (hasStep1Errors(errors)) return;
    }
    setActiveStep((s) => s + 1);
  }

  async function handleSubmit() {
    // Validate all steps before final submit
    const e0 = validateStep0(form);
    const e1 = validateStep1(form);
    const e2 = validateStep2(form);
    setStep0Errors(e0);
    setStep1Errors(e1);
    setStep2Errors(e2);

    if (hasStep0Errors(e0)) {
      setSaveError('Step 1 (Staff & Supervisor) has missing required fields. Please go back and complete them.');
      return;
    }
    if (hasStep1Errors(e1)) {
      setSaveError('Step 2 (Perspectives & KPIs) has incomplete objectives or incorrect total weight. Please go back and fix them.');
      return;
    }
    if (hasStep2Errors(e2)) {
      // Show inline errors on step 2 fields — no generic banner needed
      return;
    }

    setSaving(true);
    setSaveError(null);

    try {
      const normalizedObjectives = normalizeBscWeights(form.perspectivesObjectives);

      const payload = {
        staff_id: form.staffId,
        supervisor_id: form.supervisorId || null,
        fiscal_year: form.fiscalYear,
        review_year: form.reviewYear,
        perspectives_objectives: normalizedObjectives,
        general_competencies: form.generalCompetencies,
        staff_signature: form.staffSignature,
        staff_signed_at: new Date().toISOString(),
        supervisor_signature: form.supervisorSignature,
        supervisor_signed_at: new Date().toISOString(),
        status: 'signed',
        workflow_stage: 'workplan_pending',
        submitted_at: new Date().toISOString(),
        review_type: 'annual',
      };

      const { data, error } = await supabase.from('workplan_settings').insert(payload).select('id').single();
      if (error) {
        setSaveError(error.message || 'Failed to save workplan. Please try again.');
        return;
      }

      // Clear draft after successful submission
      await clearDraft(null, form.staffId, form.fiscalYear || 'annual');

      setSavedWorkplanId(data?.id ?? null);
      setSubmitted(true);
    } catch (err: any) {
      setSaveError('An unexpected error occurred. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSupervisorApprove() {
    if (!savedWorkplanId) return;
    setApproving(true);
    setApprovalError(null);
    try {
      const { error } = await supabase
        .from('workplan_settings')
        .update({
          workflow_stage: 'workplan_approved',
          supervisor_approved_at: new Date().toISOString(),
          supervisor_approval_comments: approvalComments || null,
        })
        .eq('id', savedWorkplanId);

      if (error) {
        setApprovalError(error.message || 'Failed to approve workplan.');
        return;
      }

      // Log activity
      await supabase.from('activity_logs').insert({
        activity_type: 'workplan_approved',
        actor_name: form.supervisorName || 'Supervisor',
        action_description: 'approved workplan — Mid-Year evaluation now unlocked',
        subject_name: form.staffName,
        subject_detail: form.fiscalYear,
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
        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
          <Icon name="CheckBadgeIcon" size={36} className="text-emerald-600" />
        </div>
        <h3 className="text-lg font-700 text-foreground mb-2">Workplan Approved — Mid-Year Unlocked</h3>
        <p className="text-sm text-muted-foreground mb-1">
          The workplan for <span className="font-600 text-foreground">{form.staffName}</span> has been approved by the supervisor.
        </p>
        <p className="text-xs text-muted-foreground mb-6">
          Stage 2 (Mid-Year Self-Evaluation) is now available for this staff member.
        </p>
        <button onClick={onClose} className="px-5 py-2 bg-primary text-white text-sm font-600 rounded-lg hover:bg-primary/90 transition-colors">
          Close
        </button>
      </div>
    );
  }

  // ── Print Preview ────────────────────────────────────────────────────────
  if (showPrintPreview) {
    return (
      <PrintAppraisalLayout
        data={{
          staffName: form.staffName,
          jobTitle: form.jobTitle,
          supervisorName: form.supervisorName,
          fiscalYear: form.fiscalYear,
          reviewYear: form.reviewYear,
          perspectivesObjectives: form.perspectivesObjectives,
          generalCompetencies: form.generalCompetencies,
          staffSignature: form.staffSignature,
          supervisorSignature: form.supervisorSignature,
        }}
        onClose={() => setShowPrintPreview(false)}
      />
    );
  }

  // ── Submitted — awaiting supervisor approval ─────────────────────────────
  if (submitted) {
    return (
      <div className="flex flex-col h-full overflow-y-auto p-6 space-y-5">
        {/* Success banner */}
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <Icon name="CheckCircleIcon" size={22} className="text-emerald-600" />
          </div>
          <div>
            <p className="text-sm font-700 text-emerald-800">Workplan Signed & Saved</p>
            <p className="text-xs text-emerald-700 mt-0.5">
              The workplan for <span className="font-600">{form.staffName}</span> has been signed by both parties.
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
            {[
              { label: 'Workplan Signed', done: true, active: false },
              { label: 'Supervisor Approval', done: false, active: true },
              { label: 'Mid-Year Unlocked', done: false, active: false },
              { label: 'End-Year Unlocked', done: false, active: false },
            ].map((s, i) => (
              <React.Fragment key={s.label}>
                <div className={`flex flex-col items-center gap-1 flex-1 min-w-0`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-700 flex-shrink-0 ${
                    s.done ? 'bg-emerald-500 text-white' : s.active ? 'bg-primary text-white ring-2 ring-primary/30' : 'bg-muted border border-border text-muted-foreground'
                  }`}>
                    {s.done ? <Icon name="CheckIcon" size={10} /> : i + 1}
                  </div>
                  <span className={`text-[9px] font-600 text-center leading-tight ${s.active ? 'text-primary' : s.done ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                    {s.label}
                  </span>
                </div>
                {i < 3 && <div className="h-px w-4 bg-border flex-shrink-0 mb-3" />}
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
                The supervisor (<span className="font-600">{form.supervisorName || 'Supervisor'}</span>) must approve this workplan to unlock the Mid-Year Self-Evaluation for {form.staffName}.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-600 text-amber-800 mb-1.5">Approval Comments (optional)</label>
            <textarea
              className="w-full text-sm border border-amber-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none placeholder:text-muted-foreground/60"
              rows={2}
              placeholder="Add any comments or notes for the staff member…"
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
                <><Icon name="CheckBadgeIcon" size={14} /> Approve & Unlock Mid-Year</>
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

  // ── Checklist data ────────────────────────────────────────────────────────
  const checklist = buildChecklist(form);
  const checklistDoneCount = checklist.filter((c) => c.done).length;
  const checklistAllDone = checklistDoneCount === checklist.length;

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
                    ? 'bg-primary text-white shadow-sm'
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
          <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${((activeStep + 1) / steps.length) * 100}%` }} />
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">

        {/* ── Step 0: Staff & Supervisor ── */}
        {activeStep === 0 && (
          <div className="space-y-5">
            <div className="flex items-start gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-800 text-primary">1</span>
              </div>
              <div>
                <h3 className="text-sm font-700 text-foreground">Staff & Supervisor Details</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Identify the staff member and their direct supervisor for this workplan</p>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-800 flex items-start gap-2">
              <Icon name="InformationCircleIcon" size={14} className="text-blue-600 flex-shrink-0 mt-0.5" />
              <span>This Performance Appraisal Form is completed at the <strong>beginning of the evaluation year (July)</strong>. It sets the perspectives, objectives, and KPIs that will be used for Mid-Year (December–January) and End-Year (May–June) evaluations. <strong>Supervisor approval unlocks the next stage.</strong></span>
            </div>

            {/* Step 0 error summary */}
            {hasStep0Errors(step0Errors) && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-700">
                <Icon name="ExclamationTriangleIcon" size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-700 mb-1">Please fix the following before continuing:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    {Object.values(step0Errors).map((msg, i) => <li key={i}>{msg}</li>)}
                  </ul>
                </div>
              </div>
            )}

            {staffLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                Loading staff list…
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Staff Member" required error={step0Errors.staffId}>
                  {isManager ? (
                    /* Managers / Directors: full dropdown */
                    <select
                      className={step0Errors.staffId ? selectErrCls : selectCls}
                      value={form.staffId}
                      onChange={(e) => {
                        const staff = staffList.find((s) => s.id === e.target.value);
                        setField('staffId', e.target.value);
                        setField('staffName', staff?.full_name || '');
                        setField('jobTitle', staff?.job_title || '');
                        if (staff?.supervisor_id) {
                          const sup = staffList.find((s) => s.id === staff.supervisor_id);
                          setField('supervisorId', staff.supervisor_id);
                          setField('supervisorName', sup?.full_name || staff.supervisor_name || '');
                        } else {
                          setField('supervisorId', '');
                          setField('supervisorName', '');
                        }
                      }}
                    >
                      <option value="">Select staff member…</option>
                      {staffList.map((s) => (
                        <option key={s.id} value={s.id}>{s.full_name} — {s.job_title}</option>
                      ))}
                    </select>
                  ) : (
                    /* Regular staff: locked to own record */
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={form.staffName ? `${form.staffName}${form.jobTitle ? ` — ${form.jobTitle}` : ''}` : 'Loading your record…'}
                        className={`${inputCls} bg-muted/40 cursor-not-allowed text-foreground/70`}
                      />
                      <span title="Locked to your own record" className="flex-shrink-0 text-muted-foreground">
                        <Icon name="LockClosedIcon" size={14} />
                      </span>
                    </div>
                  )}
                </FormField>

                <FormField label="Supervisor / Line Manager" required error={step0Errors.supervisorId}>
                  <select
                    className={step0Errors.supervisorId ? selectErrCls : selectCls}
                    value={form.supervisorId}
                    onChange={(e) => {
                      const sup = staffList.find((s) => s.id === e.target.value);
                      setField('supervisorId', e.target.value);
                      setField('supervisorName', sup?.full_name || '');
                    }}
                  >
                    <option value="">Select supervisor…</option>
                    {staffList.map((s) => (
                      <option key={s.id} value={s.id}>{s.full_name} — {s.job_title}</option>
                    ))}
                  </select>
                </FormField>

                <FormField label="Fiscal Year" required error={step0Errors.fiscalYear}>
                  <select className={step0Errors.fiscalYear ? selectErrCls : selectCls} value={form.fiscalYear} onChange={(e) => setField('fiscalYear', e.target.value)}>
                    <option value="FY 2025-2026 (Jul–Jun)">FY 2025-2026 (Jul 2025 – Jun 2026)</option>
                    <option value="FY 2026-2027 (Jul–Jun)">FY 2026-2027 (Jul 2026 – Jun 2027)</option>
                    <option value="FY 2027-2028 (Jul–Jun)">FY 2027-2028 (Jul 2027 – Jun 2028)</option>
                  </select>
                </FormField>

                <FormField label="Review Year" required>
                  <select className={selectCls} value={form.reviewYear} onChange={(e) => setField('reviewYear', Number(e.target.value))}>
                    <option value={2026}>2026</option>
                    <option value={2027}>2027</option>
                    <option value={2028}>2028</option>
                  </select>
                </FormField>
              </div>
            )}
          </div>
        )}

        {/* ── Step 1: Perspectives, Objectives & KPIs ── */}
        {activeStep === 1 && (
          <div className="space-y-5">
            <div className="flex items-start gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-800 text-primary">2</span>
              </div>
              <div>
                <h3 className="text-sm font-700 text-foreground">Perspectives, Objectives & KPIs</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Define the BSC perspectives, objectives, and KPIs for the evaluation year</p>
              </div>
            </div>

            {/* Weight badges */}
            <div className="flex flex-wrap items-center gap-2">
              <div className={`text-xs font-600 px-2.5 py-1.5 rounded-lg border inline-flex items-center gap-1.5 ${totalWeight > 0 && totalWeight <= 80 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                <Icon name={totalWeight > 0 && totalWeight <= 80 ? 'CheckCircleIcon' : 'ExclamationTriangleIcon'} size={13} />
                BSC Weight: {totalWeight} / 80 {totalWeight > 0 && totalWeight <= 80 ? '✓' : totalWeight > 80 ? `(exceeds 80 by ${totalWeight - 80})` : '(must be > 0)'}
              </div>
              <div className={`text-xs font-600 px-2.5 py-1.5 rounded-lg border inline-flex items-center gap-1.5 ${Math.abs(totalCompWeight - 20) < 1 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                <Icon name={Math.abs(totalCompWeight - 20) < 1 ? 'CheckCircleIcon' : 'ExclamationTriangleIcon'} size={13} />
                Competencies Weight: {totalCompWeight} / 20 {Math.abs(totalCompWeight - 20) < 1 ? '✓' : '(should equal 20)'}
              </div>
              <div className="text-xs font-600 px-2.5 py-1.5 rounded-lg border inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 border-blue-200">
                <Icon name="CalculatorIcon" size={13} />
                Max Possible Score: {totalWeight + totalCompWeight} / 120
                <span className="text-[10px] font-500 ml-0.5">(BSC normalised to 100 + 20 competencies)</span>
              </div>
            </div>

            {/* Step 1 error summary */}
            {hasStep1Errors(step1Errors) && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-700">
                <Icon name="ExclamationTriangleIcon" size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-700 mb-1">Please fix the following before continuing:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    {step1Errors.totalWeight && <li>{step1Errors.totalWeight}</li>}
                    {step1Errors.competencyWeight && <li>{step1Errors.competencyWeight}</li>}
                    {Object.entries(step1Errors.rows).map(([idx, rowErr]) =>
                      Object.values(rowErr).map((msg, i) => (
                        <li key={`${idx}-${i}`}>Objective {Number(idx) + 1}: {msg}</li>
                      ))
                    )}
                  </ul>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {form.perspectivesObjectives.map((row, idx) => {
                const filteredKPIs = KPI_OPTIONS.filter((k) => !row.perspective || k.perspective === row.perspective);
                const colorCls = PERSPECTIVE_COLORS[row.perspective] || 'bg-muted/30 border-border text-foreground';
                const rowErr = step1Errors.rows[idx] || {};
                return (
                  <div key={row.id} className={`rounded-xl border p-4 space-y-3 ${colorCls} ${Object.keys(rowErr).length > 0 ? 'ring-1 ring-red-400' : ''}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-700 uppercase tracking-wide flex items-center gap-1.5">
                        Objective {idx + 1}
                        {Object.keys(rowErr).length > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-600 text-red-600 bg-red-50 border border-red-200 rounded px-1.5 py-0.5">
                            <Icon name="ExclamationCircleIcon" size={10} />
                            {Object.keys(rowErr).length} issue{Object.keys(rowErr).length > 1 ? 's' : ''}
                          </span>
                        )}
                      </span>
                      {form.perspectivesObjectives.length > 1 && (
                        <button type="button" onClick={() => removeRow(idx)} className="p-1 rounded-md hover:bg-red-100 text-red-500 transition-colors">
                          <Icon name="TrashIcon" size={13} />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <FormField label="BSC Perspective" required error={rowErr.perspective}>
                        <select
                          className={rowErr.perspective ? selectErrCls : selectCls}
                          value={row.perspective}
                          onChange={(e) => updateRow(idx, 'perspective', e.target.value)}
                        >
                          <option value="">Select perspective…</option>
                          {PERSPECTIVES.map((p) => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </FormField>

                      <FormField label="Weight 1-5" required error={rowErr.weight}>
                        <input
                          type="number"
                          min={0}
                          max={5}
                          className={rowErr.weight ? inputErrCls : inputCls}
                          value={row.weight}
                          onChange={(e) => updateRow(idx, 'weight', Number(e.target.value))}
                        />
                      </FormField>
                    </div>

                    <FormField label="Objective / Goal Statement" required error={rowErr.objective}>
                      <ObjectiveCombobox
                        value={row.objective}
                        perspective={row.perspective}
                        onChange={(val) => updateRow(idx, 'objective', val)}
                        hasError={!!rowErr.objective}
                      />
                    </FormField>

                    <FormField label="Key Activities">
                      <textarea
                        className={textareaCls}
                        rows={3}
                        placeholder="Describe the key activities that will be undertaken to achieve this objective…"
                        value={row.keyActivities}
                        onChange={(e) => updateRow(idx, 'keyActivities', e.target.value)}
                      />
                    </FormField>

                    <FormField label="Annual Target" required error={rowErr.target}>
                      <input
                        className={rowErr.target ? inputErrCls : inputCls}
                        placeholder="e.g. Achieve 95% budget variance compliance"
                        value={row.target}
                        onChange={(e) => updateRow(idx, 'target', e.target.value)}
                      />
                    </FormField>

                    {row.perspective && (
                      <div>
                        <label className={`block text-xs font-600 mb-2 ${rowErr.kpis ? 'text-red-600' : 'text-foreground'}`}>
                          KPIs (select all that apply) <span className="text-red-500">*</span>
                        </label>
                        <div className="grid grid-cols-1 gap-1.5 pr-1">
                          {filteredKPIs.map((kpi) => (
                            <label key={kpi.id} className="flex items-start gap-2 cursor-pointer group">
                              <input
                                type="checkbox"
                                checked={row.kpis.includes(kpi.id)}
                                onChange={() => toggleKPI(idx, kpi.id)}
                                className="mt-0.5 accent-primary flex-shrink-0"
                              />
                              <span className="text-xs text-foreground group-hover:text-primary transition-colors">{kpi.label}</span>
                            </label>
                          ))}
                        </div>
                        {row.kpis.length > 0 && (
                          <p className="text-[10px] text-muted-foreground mt-1">{row.kpis.length} KPI{row.kpis.length > 1 ? 's' : ''} selected</p>
                        )}
                        {rowErr.kpis && (
                          <p className="flex items-center gap-1 mt-1 text-[11px] text-red-600">
                            <Icon name="ExclamationCircleIcon" size={11} className="flex-shrink-0" />
                            {rowErr.kpis}
                          </p>
                        )}

                        {/* ── Additional / Custom KPIs free-text ── */}
                        <div className="mt-3 pt-3 border-t border-dashed border-border/60">
                          <label className="block text-xs font-600 text-foreground mb-1.5 flex items-center gap-1.5">
                            <Icon name="PencilSquareIcon" size={12} className="text-primary" />
                            Additional / Custom KPIs
                            <span className="text-[10px] font-400 text-muted-foreground">(not in the list above)</span>
                          </label>
                          <textarea
                            className={textareaCls}
                            rows={3}
                            placeholder="Enter any KPIs specific to this objective that are not listed above. Use one KPI per line or separate with semicolons…"
                            value={row.customKpis}
                            onChange={(e) => updateRow(idx, 'customKpis', e.target.value)}
                          />
                          {row.customKpis.trim() && (
                            <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                              <Icon name="CheckCircleIcon" size={10} className="text-emerald-500" />
                              Custom KPIs captured — will be included in the workplan
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {!row.perspective && (
                      <p className="text-[11px] text-muted-foreground italic">Select a BSC Perspective above to see available KPIs.</p>
                    )}
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={addRow}
              className="flex items-center gap-1.5 text-xs font-600 text-primary border border-primary/30 bg-primary/5 hover:bg-primary/10 px-3 py-2 rounded-lg transition-colors"
            >
              <Icon name="PlusIcon" size={13} />
              Add Another Objective
            </button>

            {/* ── General Competencies Section ── */}
            <div className="mt-6">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                  <Icon name="StarIcon" size={15} className="text-indigo-600" />
                </div>
                <div>
                  <h4 className="text-sm font-700 text-foreground">General Competencies</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">Adjust the weight (1–5) for each competency. Total must equal <strong>20</strong>. Combined with BSC (normalised to 100), the system supports up to <strong>120%</strong> for exemplary performers.</p>
                </div>
              </div>

              {step1Errors.competencyWeight && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700 mb-3">
                  <Icon name="ExclamationCircleIcon" size={13} className="text-red-500 flex-shrink-0" />
                  {step1Errors.competencyWeight}
                </div>
              )}

              <div className="rounded-xl border border-indigo-200 bg-indigo-50 overflow-hidden">
                {/* Header row */}
                <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-indigo-100 border-b border-indigo-200">
                  <div className="col-span-1 text-[10px] font-700 text-indigo-700 uppercase tracking-wide">#</div>
                  <div className="col-span-7 text-[10px] font-700 text-indigo-700 uppercase tracking-wide">Competency</div>
                  <div className="col-span-4 text-[10px] font-700 text-indigo-700 uppercase tracking-wide text-center">Weight (1–5)</div>
                </div>

                {form.generalCompetencies.map((comp, idx) => (
                  <div
                    key={comp.id}
                    className={`grid grid-cols-12 gap-2 px-4 py-3 items-start ${idx < form.generalCompetencies.length - 1 ? 'border-b border-indigo-100' : ''}`}
                  >
                    <div className="col-span-1 text-xs font-700 text-indigo-600 mt-1">{idx + 1}</div>
                    <div className="col-span-7">
                      <p className="text-xs font-600 text-foreground">{comp.name}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{comp.description}</p>
                    </div>
                    <div className="col-span-4 flex flex-col items-center gap-1">
                      <input
                        type="number"
                        min={1}
                        max={5}
                        className={`w-16 text-center text-sm font-700 border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-colors ${
                          step1Errors.competencyWeight ? 'border-red-400 bg-red-50' : 'border-indigo-300 bg-white'
                        }`}
                        value={comp.weight}
                        onChange={(e) => updateCompetencyWeight(idx, Number(e.target.value))}
                      />
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => updateCompetencyWeight(idx, v)}
                            className={`w-5 h-5 rounded text-[9px] font-700 transition-colors ${
                              comp.weight === v
                                ? 'bg-indigo-600 text-white' :'bg-white border border-indigo-200 text-indigo-500 hover:bg-indigo-100'
                            }`}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Total row */}
                <div className={`grid grid-cols-12 gap-2 px-4 py-3 border-t-2 ${Math.abs(totalCompWeight - 20) < 1 ? 'border-emerald-300 bg-emerald-50' : 'border-amber-300 bg-amber-50'}`}>
                  <div className="col-span-1" />
                  <div className="col-span-7">
                    <p className={`text-xs font-700 ${Math.abs(totalCompWeight - 20) < 1 ? 'text-emerald-700' : 'text-amber-700'}`}>
                      Total Competencies Weight
                    </p>
                    <p className={`text-[10px] mt-0.5 ${Math.abs(totalCompWeight - 20) < 1 ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {Math.abs(totalCompWeight - 20) < 1 ? '✓ Balanced — equals 20' : `Adjust weights to reach exactly 20 (currently ${totalCompWeight})`}
                    </p>
                  </div>
                  <div className="col-span-4 flex items-center justify-center">
                    <span className={`text-lg font-800 ${Math.abs(totalCompWeight - 20) < 1 ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {totalCompWeight}
                      <span className="text-xs font-500 ml-1">/ 20</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 2: Sign & Finalise ── */}
        {activeStep === 2 && (
          <div className="space-y-5">
            <div className="flex items-start gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-800 text-primary">3</span>
              </div>
              <div>
                <h3 className="text-sm font-700 text-foreground">Sign & Finalise Workplan</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Both the staff member and supervisor must sign to confirm agreement on the workplan</p>
              </div>
            </div>

            {/* ── Completion Checklist ── */}
            <div className="border border-border rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowChecklist((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Icon name={checklistAllDone ? 'CheckBadgeIcon' : 'ClipboardDocumentListIcon'} size={15} className={checklistAllDone ? 'text-emerald-600' : 'text-primary'} />
                  <span className="text-xs font-700 text-foreground">Completion Checklist</span>
                  <span className={`text-[10px] font-700 px-1.5 py-0.5 rounded-full ${checklistAllDone ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {checklistDoneCount}/{checklist.length}
                  </span>
                </div>
                <Icon name={showChecklist ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={13} className="text-muted-foreground" />
              </button>

              {showChecklist && (
                <div className="px-4 py-3 space-y-2 bg-white">
                  {checklist.map((item, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${item.done ? 'bg-emerald-500' : 'bg-red-100 border border-red-300'}`}>
                        {item.done
                          ? <Icon name="CheckIcon" size={9} className="text-white" />
                          : <Icon name="XMarkIcon" size={9} className="text-red-500" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-600 ${item.done ? 'text-foreground' : 'text-red-700'}`}>{item.label}</p>
                        {item.detail && (
                          <p className={`text-[10px] mt-0.5 ${item.done ? 'text-muted-foreground' : 'text-red-500'}`}>{item.detail}</p>
                        )}
                      </div>
                    </div>
                  ))}

                  {!checklistAllDone && (
                    <div className="mt-3 pt-3 border-t border-border flex items-center gap-2 text-[11px] text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                      <Icon name="ExclamationTriangleIcon" size={12} className="text-amber-500 flex-shrink-0" />
                      Complete all checklist items before submitting. Use the Back button to fix any issues.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Summary */}
            <div className="bg-muted/30 rounded-xl border border-border p-4 space-y-2">
              <p className="text-xs font-700 text-foreground mb-2">Workplan Summary</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-muted-foreground">Staff:</span> <span className="font-600">{form.staffName || '—'}</span></div>
                <div><span className="text-muted-foreground">Supervisor:</span> <span className="font-600">{form.supervisorName || '—'}</span></div>
                <div><span className="text-muted-foreground">Fiscal Year:</span> <span className="font-600">{form.fiscalYear}</span></div>
                <div><span className="text-muted-foreground">Objectives:</span> <span className="font-600">{form.perspectivesObjectives.length}</span></div>
                <div><span className="text-muted-foreground">BSC Weight:</span> <span className="font-600">{totalWeight} / 80 <span className="text-[10px] text-muted-foreground">(→ normalised to 100 for scoring)</span></span></div>
                <div><span className="text-muted-foreground">Competencies Weight:</span> <span className="font-600">{totalCompWeight} / 20</span></div>
              </div>
              <div className="mt-2 space-y-1">
                {form.perspectivesObjectives.map((row, i) => (
                  <div key={row.id} className="flex items-start gap-2 text-xs">
                    <span className="text-muted-foreground flex-shrink-0">#{i + 1}</span>
                    <span className="font-500 text-foreground">{row.perspective || '—'}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-muted-foreground truncate">{row.objective || 'No objective set'}</span>
                    <span className="ml-auto text-muted-foreground flex-shrink-0">{row.weight}</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 pt-2 border-t border-border">
                <p className="text-[10px] font-700 text-muted-foreground mb-1 uppercase tracking-wide">General Competencies</p>
                <div className="space-y-0.5">
                  {form.generalCompetencies.map((comp) => (
                    <div key={comp.id} className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground truncate flex-1">{comp.name}</span>
                      <span className="font-600 text-indigo-700 flex-shrink-0">{comp.weight}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-border space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-700 text-foreground">Max Possible Score</span>
                  <span className="font-800 text-blue-700">
                    {totalWeight + totalCompWeight} / 120
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground">BSC ({totalWeight}/80 → normalised to 100) + Competencies ({totalCompWeight}/20) = up to 120% for exemplary performers</p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800 flex items-start gap-2">
              <Icon name="ExclamationTriangleIcon" size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <span>By signing, both parties confirm agreement on the objectives and KPIs set above. The supervisor will then approve this workplan to unlock the Mid-Year Self-Evaluation stage.</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label={`Staff Signature (${form.staffName || 'Staff Member'})`} required error={step2Errors.staffSignature}>
                <input
                  className={step2Errors.staffSignature ? inputErrCls : inputCls}
                  placeholder="Type full name as signature…"
                  value={form.staffSignature}
                  onChange={(e) => setField('staffSignature', e.target.value)}
                />
              </FormField>

              <FormField label={`Supervisor Signature (${form.supervisorName || 'Supervisor'})`} required error={step2Errors.supervisorSignature}>
                <input
                  className={step2Errors.supervisorSignature ? inputErrCls : inputCls}
                  placeholder="Type full name as signature…"
                  value={form.supervisorSignature}
                  onChange={(e) => setField('supervisorSignature', e.target.value)}
                />
              </FormField>
            </div>

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

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPrintPreview(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-600 text-muted-foreground border border-border rounded-lg hover:bg-muted/50 transition-colors"
            title="Open print-optimised preview"
          >
            <Icon name="PrinterIcon" size={13} />
            <span className="hidden sm:inline">Print Preview</span>
          </button>

          {activeStep < steps.length - 1 ? (
            <button
              type="button"
              onClick={handleNext}
              className="px-5 py-2 text-xs font-600 text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors"
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
                <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving…</>
              ) : (
                <><Icon name="CheckBadgeIcon" size={14} /> Sign & Save Workplan</>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
