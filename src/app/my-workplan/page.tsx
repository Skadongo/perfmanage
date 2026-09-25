'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Toaster } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

interface KPIEntry {
  id: string;
  label: string;
  target: string;
}

interface PerspectiveRow {
  id: string;
  perspective: string;
  objective: string;
  keyActivities: string;
  kpis: KPIEntry[];
  weight: number;
}

interface Competency {
  id: string;
  name: string;
  description: string;
  weight: number;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
type SubmitStatus = 'idle' | 'submitting' | 'submitted';

// ─── Constants ────────────────────────────────────────────────────────────────

const PERSPECTIVES = [
  'Financial/Stewardship',
  'Customer/Stakeholder',
  'Internal Business Processes',
  'Innovation Learning & Growth',
];

const PERSPECTIVE_COLORS: Record<string, { bg: string; border: string; badge: string; dot: string }> = {
  'Financial/Stewardship':        { bg: 'bg-emerald-50', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-800', dot: 'bg-emerald-500' },
  'Customer/Stakeholder':         { bg: 'bg-sky-50',     border: 'border-sky-200',     badge: 'bg-sky-100 text-sky-800',         dot: 'bg-sky-500' },
  'Internal Business Processes':  { bg: 'bg-violet-50',  border: 'border-violet-200',  badge: 'bg-violet-100 text-violet-800',   dot: 'bg-violet-500' },
  'Innovation Learning & Growth': { bg: 'bg-amber-50',   border: 'border-amber-200',   badge: 'bg-amber-100 text-amber-800',     dot: 'bg-amber-500' },
};

const KPI_SUGGESTIONS: Record<string, string[]> = {
  'Financial/Stewardship': [
    'Budget Variance (≤5% of approved budget)',
    'Cost Recovery Rate (10% from all new grants)',
    'Payroll Accuracy (zero-error rate)',
    'Grant Disbursement Efficiency (within 5 days)',
    'Reporting Timeliness (100% donor reports by deadline)',
    'Unqualified Audited Financial Statements by Sept 30',
  ],
  'Customer/Stakeholder': [
    'Internal Service Level (SLA) — 48h resolution rate',
    'Employee Engagement Index (annual survey score)',
    'Recruitment Efficiency (avg. time-to-hire ≤90 days)',
    'System Availability (99.9% uptime)',
    'Visitor / Stakeholder Satisfaction Index',
  ],
  'Internal Business Processes': [
    'PMS System Adoption Rate (100% of staff)',
    'Data Integrity (0% error rate in HR digital repository)',
    'Audit Readiness (zero high-risk findings)',
    'ERP Adoption Rate (100% of financial transactions)',
    'Internal Control Compliance (zero high-risk audit findings)',
  ],
  'Innovation Learning & Growth': [
    'CPD Completion Rate (% staff meeting annual PD targets)',
    'Staff Turnover Rate (target ≤5% voluntary turnover)',
    'Leadership Development (% mid-level managers trained)',
    'Cybersecurity Maturity (0 successful breaches)',
    'Employee Retention Rate (target: 95%)',
  ],
};

const OBJECTIVE_SUGGESTIONS: Record<string, string[]> = {
  'Financial/Stewardship': [
    'Strengthen financial sustainability',
    'Improve budget utilization',
    'Strengthen financial accountability',
    'Improve cost efficiency',
    'Support resource mobilization',
  ],
  'Customer/Stakeholder': [
    'Strengthen value proposition to Member States',
    'Enhance strategic partnerships',
    'Improve stakeholder engagement',
    'Strengthen advocacy and policy influence',
    'Enhance support to Member States',
  ],
  'Internal Business Processes': [
    'Lead implementation of Strategic Plan 2024–2034',
    'Improve annual workplan execution',
    'Strengthen governance effectiveness',
    'Improve institutional performance management',
    'Enhance digital transformation',
  ],
  'Innovation Learning & Growth': [
    'Strengthen organizational capability',
    'Develop leadership pipeline',
    'Improve staff engagement',
    'Promote innovation and knowledge management',
    'Strengthen organizational culture',
  ],
};

const DEFAULT_COMPETENCIES: Competency[] = [
  { id: 'c1', name: 'Teamwork', description: 'Creates a culture of teamwork and responds rationally to feedback.', weight: 3 },
  { id: 'c2', name: 'Respect for Diversity', description: 'Values individual differences and promotes a peaceful work environment.', weight: 3 },
  { id: 'c3', name: 'Integrity', description: 'Reliable, meets all deadlines, and takes credit only for own work.', weight: 3 },
  { id: 'c4', name: 'Communication', description: 'Explains complex issues clearly and uses visual aids effectively.', weight: 3 },
  { id: 'c5', name: 'Results Oriented', description: 'Prioritizes activities and matches tasks with team capabilities.', weight: 3 },
  { id: 'c6', name: 'Innovation', description: 'Thinks "outside the box" to foster team creativity.', weight: 3 },
  { id: 'c7', name: 'Leadership (GS3+)', description: 'Acts as a role model and provides timely specific feedback to staff.', weight: 2 },
];

const FISCAL_YEARS = [
  'FY 2026-2027 (Jul–Jun)',
  'FY 2025-2026 (Jul–Jun)',
  'FY 2024-2025 (Jul–Jun)',
];

// ─── Helper ───────────────────────────────────────────────────────────────────

function makeRow(perspective = ''): PerspectiveRow {
  return {
    id: `row-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    perspective,
    objective: '',
    keyActivities: '',
    kpis: [],
    weight: 0,
  };
}

function uid() {
  return `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface InlineSelectProps {
  value: string;
  options: string[];
  placeholder: string;
  onChange: (v: string) => void;
  error?: string;
  className?: string;
}

function InlineSelect({ value, options, placeholder, onChange, error, className = '' }: InlineSelectProps) {
  return (
    <div className={className}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full text-sm border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 transition-colors cursor-pointer ${
          error ? 'border-red-400 focus:ring-red-300' : 'border-border focus:ring-primary/30 focus:border-primary'
        }`}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
      {error && <p className="mt-1 text-[11px] text-red-600 flex items-center gap-1"><Icon name="ExclamationCircleIcon" size={11} />{error}</p>}
    </div>
  );
}

interface InlineTextareaProps {
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
  error?: string;
  rows?: number;
  suggestions?: string[];
}

function InlineTextarea({ value, placeholder, onChange, error, rows = 2, suggestions = [] }: InlineTextareaProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = suggestions.filter((s) =>
    !value || s.toLowerCase().includes(value.toLowerCase())
  );

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <textarea
          rows={rows}
          value={value}
          onChange={(e) => { onChange(e.target.value); if (suggestions.length) setOpen(true); }}
          onFocus={() => { if (suggestions.length) setOpen(true); }}
          placeholder={placeholder}
          className={`w-full text-sm border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 transition-colors resize-none placeholder:text-muted-foreground/60 ${
            error ? 'border-red-400 focus:ring-red-300' : 'border-border focus:ring-primary/30 focus:border-primary'
          }`}
        />
        {suggestions.length > 0 && (
          <button
            type="button"
            tabIndex={-1}
            onMouseDown={(e) => { e.preventDefault(); setOpen((v) => !v); }}
            className="absolute right-2 top-2 p-1 rounded hover:bg-muted/60 text-muted-foreground"
          >
            <Icon name="ChevronDownIcon" size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-border rounded-xl shadow-lg max-h-48 overflow-y-auto">
          <div className="px-3 py-1.5 border-b border-border bg-muted/30">
            <p className="text-[10px] font-600 uppercase tracking-wide text-muted-foreground">Suggestions</p>
          </div>
          {filtered.map((s, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); onChange(s); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-xs hover:bg-primary/5 hover:text-primary transition-colors border-b border-border/50 last:border-0 ${value === s ? 'bg-primary/10 text-primary font-600' : 'text-foreground'}`}
            >
              {s}
            </button>
          ))}
        </div>
      )}
      {error && <p className="mt-1 text-[11px] text-red-600 flex items-center gap-1"><Icon name="ExclamationCircleIcon" size={11} />{error}</p>}
    </div>
  );
}

interface KPIEditorProps {
  perspective: string;
  kpis: KPIEntry[];
  onChange: (kpis: KPIEntry[]) => void;
  error?: string;
}

function KPIEditor({ perspective, kpis, onChange, error }: KPIEditorProps) {
  const [inputVal, setInputVal] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = perspective ? (KPI_SUGGESTIONS[perspective] || []) : [];
  const addedSet = new Set(kpis.map((k) => k.label.toLowerCase()));
  const filtered = suggestions.filter(
    (s) => !addedSet.has(s.toLowerCase()) && (!inputVal.trim() || s.toLowerCase().includes(inputVal.toLowerCase()))
  );

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function addKPI(label: string) {
    const trimmed = label.trim();
    if (!trimmed || addedSet.has(trimmed.toLowerCase())) return;
    onChange([...kpis, { id: uid(), label: trimmed, target: '' }]);
    setInputVal('');
    setOpen(false);
    inputRef.current?.focus();
  }

  function removeKPI(id: string) {
    onChange(kpis.filter((k) => k.id !== id));
  }

  function updateTarget(id: string, target: string) {
    onChange(kpis.map((k) => k.id === id ? { ...k, target } : k));
  }

  return (
    <div className="space-y-2">
      {kpis.length > 0 && (
        <div className="space-y-2">
          {kpis.map((kpi) => (
            <div key={kpi.id} className="rounded-lg border border-border bg-white p-2.5 space-y-1.5">
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                <p className="flex-1 text-xs font-500 text-foreground leading-snug">{kpi.label}</p>
                <button
                  type="button"
                  onClick={() => removeKPI(kpi.id)}
                  className="p-0.5 rounded hover:bg-red-100 text-muted-foreground hover:text-red-500 transition-colors flex-shrink-0"
                >
                  <Icon name="XMarkIcon" size={13} />
                </button>
              </div>
              <div className="flex items-center gap-1.5 pl-3.5">
                <span className="text-[10px] font-600 text-muted-foreground uppercase tracking-wide flex-shrink-0">Target:</span>
                <input
                  type="text"
                  value={kpi.target}
                  onChange={(e) => updateTarget(kpi.id, e.target.value)}
                  placeholder="e.g. ≥95% by June 2027"
                  className="flex-1 text-xs border border-border rounded-md px-2 py-1 bg-muted/30 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary focus:bg-white transition-colors placeholder:text-muted-foreground/50"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <div ref={ref} className="relative">
        <div className={`flex items-center gap-1.5 border rounded-lg px-3 py-2 bg-white focus-within:ring-2 transition-colors ${error ? 'border-red-400 focus-within:ring-red-300' : 'border-border focus-within:ring-primary/30 focus-within:border-primary'}`}>
          <Icon name="PlusCircleIcon" size={14} className="text-muted-foreground flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={inputVal}
            disabled={!perspective}
            onChange={(e) => { setInputVal(e.target.value); setOpen(true); }}
            onFocus={() => { if (perspective) setOpen(true); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); filtered.length === 1 ? addKPI(filtered[0]) : inputVal.trim() && addKPI(inputVal); }
              if (e.key === 'Escape') setOpen(false);
            }}
            placeholder={perspective ? 'Type a KPI or pick from suggestions…' : 'Select a perspective first…'}
            className="flex-1 text-xs bg-transparent focus:outline-none placeholder:text-muted-foreground/60"
          />
          {inputVal.trim() && (
            <button type="button" onMouseDown={(e) => { e.preventDefault(); addKPI(inputVal); }} className="text-[10px] font-700 text-primary bg-primary/10 hover:bg-primary/20 px-2 py-0.5 rounded transition-colors flex-shrink-0">
              Add
            </button>
          )}
          {suggestions.length > 0 && (
            <button type="button" tabIndex={-1} onMouseDown={(e) => { e.preventDefault(); setOpen((v) => !v); inputRef.current?.focus(); }} className="p-0.5 rounded hover:bg-muted/60 text-muted-foreground flex-shrink-0">
              <Icon name="ChevronDownIcon" size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>

        {open && (
          <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-border rounded-xl shadow-lg max-h-52 overflow-y-auto">
            {filtered.length > 0 ? (
              <>
                <div className="px-3 py-1.5 border-b border-border bg-muted/30 sticky top-0">
                  <p className="text-[10px] font-600 uppercase tracking-wide text-muted-foreground">Suggested KPIs — {perspective}</p>
                </div>
                {filtered.map((s, i) => (
                  <button key={i} type="button" onMouseDown={(e) => { e.preventDefault(); addKPI(s); }} className="w-full text-left px-3 py-2 text-xs hover:bg-primary/5 hover:text-primary transition-colors border-b border-border/50 last:border-0 text-foreground">
                    {s}
                  </button>
                ))}
              </>
            ) : (
              <div className="px-3 py-2.5 text-xs text-muted-foreground italic">
                {inputVal.trim() ? `Press Enter or click Add to use "${inputVal}" as a custom KPI.` : 'All suggestions added. Type a custom KPI above.'}
              </div>
            )}
          </div>
        )}
      </div>
      {error && <p className="mt-1 text-[11px] text-red-600 flex items-center gap-1"><Icon name="ExclamationCircleIcon" size={11} />{error}</p>}
      <p className="text-[10px] text-muted-foreground">Pick from suggestions or type your own KPI and press <kbd className="px-1 py-0.5 bg-muted border border-border rounded text-[9px] font-600">Enter</kbd>. Set a measurable target for each KPI.</p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MyWorkplanPage() {
  const { profile } = useAuth();
  const supabaseRef = useRef(createClient());

  // Staff info
  const [staffId, setStaffId] = useState<string | null>(null);
  const [staffName, setStaffName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [supervisorName, setSupervisorName] = useState('');
  const [supervisorId, setSupervisorId] = useState<string | null>(null);
  const [staffLoading, setStaffLoading] = useState(true);

  // Form state
  const [fiscalYear, setFiscalYear] = useState('FY 2026-2027 (Jul–Jun)');
  const [rows, setRows] = useState<PerspectiveRow[]>([makeRow()]);
  const [competencies, setCompetencies] = useState<Competency[]>(DEFAULT_COMPETENCIES.map((c) => ({ ...c })));
  const [staffSignature, setStaffSignature] = useState('');
  const [supportRequired, setSupportRequired] = useState('');

  // Workplan state
  const [workplanId, setWorkplanId] = useState<string | null>(null);
  const [workplanStatus, setWorkplanStatus] = useState<string>('draft');
  const [workplanStage, setWorkplanStage] = useState<string>('workplan_pending');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle');
  const [loadingExisting, setLoadingExisting] = useState(false);

  // UI state
  const [activeSection, setActiveSection] = useState<'scorecard' | 'competencies' | 'signoff'>('scorecard');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Autosave timer
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // Load staff record
  useEffect(() => {
    if (!profile) return;
    async function loadStaff() {
      setStaffLoading(true);
      const supabase = supabaseRef.current;
      let record: any = null;

      if (profile!.staffId) {
        const { data } = await supabase
          .from('staff')
          .select('id, full_name, job_title, supervisor_id, supervisor_name')
          .eq('id', profile!.staffId)
          .maybeSingle();
        record = data;
      }

      if (!record && profile!.email) {
        const { data } = await supabase
          .from('staff')
          .select('id, full_name, job_title, supervisor_id, supervisor_name')
          .eq('email', profile!.email)
          .maybeSingle();
        record = data;
      }

      if (record) {
        setStaffId(record.id);
        setStaffName(record.full_name);
        setJobTitle(record.job_title || '');
        setSupervisorName(record.supervisor_name || '');
        setSupervisorId(record.supervisor_id || null);
      }
      setStaffLoading(false);
    }
    loadStaff();
  }, [profile]);

  // Load existing workplan when staffId + fiscalYear are known
  useEffect(() => {
    if (!staffId || !fiscalYear) return;
    setLoadingExisting(true);
    supabaseRef.current
      .from('workplan_settings')
      .select('id, perspectives_objectives, general_competencies, staff_signature, supervisor_id, supervisor_name, status, workflow_stage')
      .eq('staff_id', staffId)
      .eq('fiscal_year', fiscalYear)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!isMounted.current) return;
        if (data) {
          setWorkplanId(data.id);
          setWorkplanStatus(data.status || 'draft');
          setWorkplanStage(data.workflow_stage || 'workplan_pending');
          if (data.perspectives_objectives?.length) setRows(data.perspectives_objectives);
          if (data.general_competencies?.length) setCompetencies(data.general_competencies);
          if (data.staff_signature) setStaffSignature(data.staff_signature);
          if (data.supervisor_id) setSupervisorId(data.supervisor_id);
          if (data.supervisor_name) setSupervisorName(data.supervisor_name);
        } else {
          setWorkplanId(null);
          setWorkplanStatus('draft');
          setWorkplanStage('workplan_pending');
          setRows([makeRow()]);
          setCompetencies(DEFAULT_COMPETENCIES.map((c) => ({ ...c })));
          setStaffSignature('');
        }
      })
      .finally(() => { if (isMounted.current) setLoadingExisting(false); });
  }, [staffId, fiscalYear]);

  // Autosave on form changes
  const triggerAutosave = useCallback(() => {
    if (!staffId) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      handleSaveDraft(false);
    }, 3000);
  }, [staffId, rows, competencies, staffSignature, supportRequired, fiscalYear]);

  useEffect(() => {
    triggerAutosave();
    return () => { if (autosaveTimer.current) clearTimeout(autosaveTimer.current); };
  }, [rows, competencies, staffSignature, supportRequired]);

  // ─── Save Draft ────────────────────────────────────────────────────────────

  async function handleSaveDraft(showToast = true) {
    if (!staffId) return;
    setSaveStatus('saving');
    const supabase = supabaseRef.current;

    const payload = {
      staff_id: staffId,
      supervisor_id: supervisorId,
      fiscal_year: fiscalYear,
      review_year: parseInt(fiscalYear.match(/\d{4}/)?.[0] || '2026'),
      perspectives_objectives: rows,
      general_competencies: competencies,
      staff_signature: staffSignature,
      status: 'draft',
      workflow_stage: 'workplan_pending',
      updated_at: new Date().toISOString(),
    };

    try {
      if (workplanId) {
        const { error } = await supabase
          .from('workplan_settings')
          .update(payload)
          .eq('id', workplanId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('workplan_settings')
          .insert({ ...payload, created_at: new Date().toISOString() })
          .select('id')
          .single();
        if (error) throw error;
        if (data?.id && isMounted.current) setWorkplanId(data.id);
      }
      if (isMounted.current) {
        setSaveStatus('saved');
        if (showToast) toast.success('Draft saved successfully');
        setTimeout(() => { if (isMounted.current) setSaveStatus('idle'); }, 2500);
      }
    } catch (err: any) {
      if (isMounted.current) {
        setSaveStatus('error');
        if (showToast) toast.error(`Save failed: ${err.message}`);
      }
    }
  }

  // ─── Validate ─────────────────────────────────────────────────────────────

  function validate(): boolean {
    const errs: Record<string, string> = {};

    if (!fiscalYear) errs.fiscalYear = 'Select a fiscal year.';
    if (!staffSignature.trim()) errs.staffSignature = 'Your signature (typed name) is required.';

    const bscTotal = rows.reduce((s, r) => s + (Number(r.weight) || 0), 0);
    if (rows.length === 0) errs.rows = 'Add at least one BSC objective.';
    if (bscTotal === 0) errs.bscTotal = 'Total BSC weight must be greater than 0.';
    if (bscTotal > 80) errs.bscTotal = `Total BSC weight is ${bscTotal}. Must not exceed 80.`;

    rows.forEach((row, i) => {
      if (!row.perspective) errs[`row_${i}_perspective`] = 'Select a perspective.';
      if (!row.objective.trim()) errs[`row_${i}_objective`] = 'Objective is required.';
      if (!row.weight || row.weight < 1) errs[`row_${i}_weight`] = 'Weight must be ≥ 1.';
      if (row.kpis.length === 0) errs[`row_${i}_kpis`] = 'Add at least one KPI.';
    });

    const compTotal = competencies.reduce((s, c) => s + (Number(c.weight) || 0), 0);
    if (Math.abs(compTotal - 20) >= 1) errs.compTotal = `Competency weights total ${compTotal}. Must equal 20.`;

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // ─── Submit ───────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!validate()) {
      toast.error('Please fix the errors before submitting.');
      // Navigate to first section with errors
      const hasScorecard = Object.keys(errors).some((k) => k.startsWith('row_') || k === 'bscTotal' || k === 'rows');
      const hasComp = !!errors.compTotal;
      if (hasScorecard) setActiveSection('scorecard');
      else if (hasComp) setActiveSection('competencies');
      else setActiveSection('signoff');
      return;
    }

    setSubmitStatus('submitting');
    const supabase = supabaseRef.current;

    const payload = {
      staff_id: staffId,
      supervisor_id: supervisorId,
      fiscal_year: fiscalYear,
      review_year: parseInt(fiscalYear.match(/\d{4}/)?.[0] || '2026'),
      perspectives_objectives: rows,
      general_competencies: competencies,
      staff_signature: staffSignature,
      status: 'submitted',
      workflow_stage: 'workplan_pending',
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      if (workplanId) {
        const { error } = await supabase.from('workplan_settings').update(payload).eq('id', workplanId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('workplan_settings')
          .insert({ ...payload, created_at: new Date().toISOString() })
          .select('id')
          .single();
        if (error) throw error;
        if (data?.id && isMounted.current) setWorkplanId(data.id);
      }

      if (isMounted.current) {
        setWorkplanStatus('submitted');
        setSubmitStatus('submitted');
        toast.success('Workplan submitted successfully! Your supervisor will review it.');
      }
    } catch (err: any) {
      if (isMounted.current) {
        setSubmitStatus('idle');
        toast.error(`Submission failed: ${err.message}`);
      }
    }
  }

  // ─── Row helpers ──────────────────────────────────────────────────────────

  function updateRow(id: string, patch: Partial<PerspectiveRow>) {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, ...patch } : r));
  }

  function addRow() {
    const newRow = makeRow();
    setRows((prev) => [...prev, newRow]);
    setExpandedRows((prev) => new Set([...prev, newRow.id]));
  }

  function removeRow(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  function toggleRow(id: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function updateCompetency(id: string, patch: Partial<Competency>) {
    setCompetencies((prev) => prev.map((c) => c.id === id ? { ...c, ...patch } : c));
  }

  // ─── Derived ──────────────────────────────────────────────────────────────

  const bscTotal = rows.reduce((s, r) => s + (Number(r.weight) || 0), 0);
  const compTotal = competencies.reduce((s, c) => s + (Number(c.weight) || 0), 0);
  const isSubmitted = workplanStatus === 'submitted' || workplanStatus === 'signed' || workplanStatus === 'approved';
  const isReadOnly = isSubmitted && workplanStage !== 'workplan_pending';

  const completionPct = (() => {
    let score = 0;
    if (fiscalYear) score += 10;
    if (rows.length > 0 && rows.every((r) => r.perspective && r.objective && r.kpis.length > 0 && r.weight > 0)) score += 40;
    else if (rows.length > 0) score += 20;
    if (bscTotal > 0 && bscTotal <= 80) score += 10;
    if (Math.abs(compTotal - 20) < 1) score += 20;
    if (staffSignature.trim()) score += 20;
    return score;
  })();

  // ─── Render ───────────────────────────────────────────────────────────────

  if (staffLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-3">
            <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-muted-foreground">Loading your profile…</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!staffId) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4 max-w-sm">
            <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto">
              <Icon name="ExclamationTriangleIcon" size={28} className="text-amber-600" />
            </div>
            <h2 className="text-lg font-700 text-foreground">Staff Record Not Found</h2>
            <p className="text-sm text-muted-foreground">Your account is not linked to a staff record. Please contact HR or your system administrator.</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Toaster position="top-right" richColors />
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Icon name="ClipboardDocumentListIcon" size={18} className="text-primary" />
              </div>
              <h1 className="text-xl font-700 text-foreground">My Performance Workplan</h1>
            </div>
            <p className="text-sm text-muted-foreground">ECSA-HC Individual Performance Contract — create and submit your workplan for supervisor review.</p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {saveStatus === 'saving' && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="w-3 h-3 border border-muted-foreground border-t-transparent rounded-full animate-spin" />
                Saving…
              </span>
            )}
            {saveStatus === 'saved' && (
              <span className="flex items-center gap-1.5 text-xs text-emerald-600">
                <Icon name="CheckCircleIcon" size={14} />
                Saved
              </span>
            )}
            {!isReadOnly && (
              <button
                onClick={() => handleSaveDraft(true)}
                disabled={saveStatus === 'saving'}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-600 border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
              >
                <Icon name="CloudArrowUpIcon" size={14} />
                Save Draft
              </button>
            )}
          </div>
        </div>

        {/* ── Status Banner ── */}
        {isSubmitted && (
          <div className={`rounded-xl border px-4 py-3 flex items-start gap-3 ${
            workplanStatus === 'approved' ? 'bg-emerald-50 border-emerald-200' :
            workplanStatus === 'submitted'? 'bg-sky-50 border-sky-200' : 'bg-amber-50 border-amber-200'
          }`}>
            <Icon
              name={workplanStatus === 'approved' ? 'CheckBadgeIcon' : 'ClockIcon'}
              size={18}
              className={workplanStatus === 'approved' ? 'text-emerald-600 mt-0.5' : 'text-sky-600 mt-0.5'}
            />
            <div>
              <p className={`text-sm font-600 ${workplanStatus === 'approved' ? 'text-emerald-800' : 'text-sky-800'}`}>
                {workplanStatus === 'approved' ? 'Workplan Approved' :
                 workplanStatus === 'submitted'? 'Workplan Submitted — Awaiting Supervisor Review' : 'Workplan Signed'}
              </p>
              <p className={`text-xs mt-0.5 ${workplanStatus === 'approved' ? 'text-emerald-700' : 'text-sky-700'}`}>
                {workplanStatus === 'submitted' ?'Your workplan has been submitted. You can still edit and resubmit if needed.' :'Your workplan has been approved. Contact HR if changes are required.'}
              </p>
            </div>
          </div>
        )}

        {/* ── Contract Header Card ── */}
        <div className="bg-white rounded-xl border border-border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-700 text-foreground flex items-center gap-2">
              <Icon name="UserCircleIcon" size={16} className="text-primary" />
              Contract Details
            </h2>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-24 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${completionPct}%` }} />
              </div>
              <span className="text-xs font-600 text-primary">{completionPct}%</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-600 text-muted-foreground mb-1">Employee Name</label>
              <div className="px-3 py-2 bg-muted/40 rounded-lg text-sm font-500 text-foreground">{staffName}</div>
            </div>
            <div>
              <label className="block text-xs font-600 text-muted-foreground mb-1">Job Title</label>
              <div className="px-3 py-2 bg-muted/40 rounded-lg text-sm text-foreground">{jobTitle || '—'}</div>
            </div>
            <div>
              <label className="block text-xs font-600 text-muted-foreground mb-1">Supervisor</label>
              <div className="px-3 py-2 bg-muted/40 rounded-lg text-sm text-foreground">{supervisorName || '—'}</div>
            </div>
            <div>
              <label className="block text-xs font-600 text-muted-foreground mb-1">
                Fiscal Year <span className="text-red-500">*</span>
              </label>
              <InlineSelect
                value={fiscalYear}
                options={FISCAL_YEARS}
                placeholder="Select fiscal year"
                onChange={(v) => { setFiscalYear(v); setWorkplanId(null); }}
                error={errors.fiscalYear}
              />
            </div>
            <div>
              <label className="block text-xs font-600 text-muted-foreground mb-1">Appraisal Type</label>
              <div className="px-3 py-2 bg-muted/40 rounded-lg text-sm text-foreground">Biannual Appraisal</div>
            </div>
            <div>
              <label className="block text-xs font-600 text-muted-foreground mb-1">Status</label>
              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-600 ${
                workplanStatus === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                workplanStatus === 'submitted'? 'bg-sky-100 text-sky-700' : 'bg-amber-100 text-amber-700'
              }`}>
                <div className={`w-1.5 h-1.5 rounded-full ${
                  workplanStatus === 'approved' ? 'bg-emerald-500' :
                  workplanStatus === 'submitted'? 'bg-sky-500' : 'bg-amber-500'
                }`} />
                {workplanStatus === 'approved' ? 'Approved' :
                 workplanStatus === 'submitted'? 'Submitted' : 'Draft'}
              </div>
            </div>
          </div>
        </div>

        {/* ── Section Tabs ── */}
        <div className="flex gap-1 bg-muted/50 p-1 rounded-xl">
          {([
            { key: 'scorecard', label: 'Part 1 — Scorecard (80%)', icon: 'ChartBarIcon' },
            { key: 'competencies', label: 'Part 2 — Competencies (20%)', icon: 'StarIcon' },
            { key: 'signoff', label: 'Part 3 — Sign-Off', icon: 'PencilSquareIcon' },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveSection(tab.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-600 transition-all ${
                activeSection === tab.key
                  ? 'bg-white text-primary shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon name={tab.icon} size={14} />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.label.split('—')[0].trim()}</span>
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* PART 1 — SCORECARD                                                */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {activeSection === 'scorecard' && (
          <div className="space-y-4">
            {/* Weight summary */}
            <div className="flex items-center justify-between bg-white rounded-xl border border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <Icon name="ScaleIcon" size={16} className="text-muted-foreground" />
                <span className="text-sm font-600 text-foreground">BSC Total Weight</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-2 w-32 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${bscTotal > 80 ? 'bg-red-500' : bscTotal === 80 ? 'bg-emerald-500' : 'bg-primary'}`}
                    style={{ width: `${Math.min((bscTotal / 80) * 100, 100)}%` }}
                  />
                </div>
                <span className={`text-sm font-700 tabular-nums ${bscTotal > 80 ? 'text-red-600' : bscTotal === 80 ? 'text-emerald-600' : 'text-foreground'}`}>
                  {bscTotal} / 80
                </span>
              </div>
            </div>
            {errors.bscTotal && <p className="text-xs text-red-600 flex items-center gap-1"><Icon name="ExclamationCircleIcon" size={12} />{errors.bscTotal}</p>}

            {/* Perspective rows */}
            {rows.map((row, idx) => {
              const colors = PERSPECTIVE_COLORS[row.perspective] || { bg: 'bg-muted/30', border: 'border-border', badge: 'bg-muted text-muted-foreground', dot: 'bg-muted-foreground' };
              const isExpanded = expandedRows.has(row.id) || !row.perspective;

              return (
                <div key={row.id} className={`rounded-xl border ${colors.border} ${colors.bg} overflow-hidden`}>
                  {/* Row header */}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${colors.dot}`} />
                    <div className="flex-1 min-w-0">
                      {row.perspective ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs font-700 px-2 py-0.5 rounded-full ${colors.badge}`}>{row.perspective}</span>
                          {row.objective && <span className="text-xs text-muted-foreground truncate max-w-xs">{row.objective}</span>}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">New objective — select a perspective below</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {row.weight > 0 && (
                        <span className="text-xs font-700 text-foreground tabular-nums">W: {row.weight}</span>
                      )}
                      <button
                        type="button"
                        onClick={() => toggleRow(row.id)}
                        className="p-1 rounded hover:bg-white/60 text-muted-foreground transition-colors"
                      >
                        <Icon name={isExpanded ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={15} />
                      </button>
                      {rows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeRow(row.id)}
                          className="p-1 rounded hover:bg-red-100 text-muted-foreground hover:text-red-500 transition-colors"
                        >
                          <Icon name="TrashIcon" size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Row body */}
                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-3 border-t border-white/60 pt-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-600 text-foreground mb-1">BSC Perspective <span className="text-red-500">*</span></label>
                          <InlineSelect
                            value={row.perspective}
                            options={PERSPECTIVES}
                            placeholder="Select perspective…"
                            onChange={(v) => updateRow(row.id, { perspective: v, kpis: [] })}
                            error={errors[`row_${idx}_perspective`]}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-600 text-foreground mb-1">Weight (1–5) <span className="text-red-500">*</span></label>
                          <input
                            type="number"
                            min={1}
                            max={5}
                            value={row.weight || ''}
                            onChange={(e) => updateRow(row.id, { weight: Number(e.target.value) })}
                            placeholder="1–5"
                            className={`w-full text-sm border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 transition-colors ${errors[`row_${idx}_weight`] ? 'border-red-400 focus:ring-red-300' : 'border-border focus:ring-primary/30 focus:border-primary'}`}
                          />
                          {errors[`row_${idx}_weight`] && <p className="mt-1 text-[11px] text-red-600 flex items-center gap-1"><Icon name="ExclamationCircleIcon" size={11} />{errors[`row_${idx}_weight`]}</p>}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-600 text-foreground mb-1">Key Work Objective / Goal Statement <span className="text-red-500">*</span></label>
                        <InlineTextarea
                          value={row.objective}
                          placeholder="Describe your key work objective…"
                          onChange={(v) => updateRow(row.id, { objective: v })}
                          error={errors[`row_${idx}_objective`]}
                          suggestions={row.perspective ? (OBJECTIVE_SUGGESTIONS[row.perspective] || []) : []}
                          rows={2}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-600 text-foreground mb-1">Key Activities</label>
                        <InlineTextarea
                          value={row.keyActivities}
                          placeholder="List the key activities to achieve this objective…"
                          onChange={(v) => updateRow(row.id, { keyActivities: v })}
                          rows={2}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-600 text-foreground mb-1">SMART Measures / KPIs <span className="text-red-500">*</span></label>
                        <KPIEditor
                          perspective={row.perspective}
                          kpis={row.kpis}
                          onChange={(kpis) => updateRow(row.id, { kpis })}
                          error={errors[`row_${idx}_kpis`]}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Add row */}
            {!isReadOnly && (
              <button
                type="button"
                onClick={addRow}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-border rounded-xl text-sm font-600 text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/5 transition-all"
              >
                <Icon name="PlusCircleIcon" size={16} />
                Add BSC Objective
              </button>
            )}

            {/* Perspective coverage */}
            <div className="bg-white rounded-xl border border-border p-4">
              <p className="text-xs font-700 text-foreground mb-3">Perspective Coverage</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PERSPECTIVES.map((p) => {
                  const covered = rows.some((r) => r.perspective === p);
                  const colors = PERSPECTIVE_COLORS[p];
                  return (
                    <div key={p} className={`rounded-lg border px-3 py-2 flex items-center gap-2 ${covered ? `${colors.bg} ${colors.border}` : 'bg-muted/30 border-border'}`}>
                      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${covered ? colors.dot : 'bg-muted-foreground/30'}`} />
                      <span className={`text-[10px] font-600 leading-tight ${covered ? 'text-foreground' : 'text-muted-foreground'}`}>{p}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end">
              <button onClick={() => setActiveSection('competencies')} className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-sm font-600 rounded-lg hover:bg-primary/90 transition-colors">
                Next: Competencies
                <Icon name="ArrowRightIcon" size={15} />
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* PART 2 — COMPETENCIES                                             */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {activeSection === 'competencies' && (
          <div className="space-y-4">
            {/* Weight summary */}
            <div className="flex items-center justify-between bg-white rounded-xl border border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <Icon name="ScaleIcon" size={16} className="text-muted-foreground" />
                <span className="text-sm font-600 text-foreground">Competency Total Weight</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-2 w-32 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${Math.abs(compTotal - 20) < 1 ? 'bg-emerald-500' : compTotal > 20 ? 'bg-red-500' : 'bg-primary'}`}
                    style={{ width: `${Math.min((compTotal / 20) * 100, 100)}%` }}
                  />
                </div>
                <span className={`text-sm font-700 tabular-nums ${Math.abs(compTotal - 20) < 1 ? 'text-emerald-600' : compTotal > 20 ? 'text-red-600' : 'text-foreground'}`}>
                  {compTotal} / 20
                </span>
              </div>
            </div>
            {errors.compTotal && <p className="text-xs text-red-600 flex items-center gap-1"><Icon name="ExclamationCircleIcon" size={12} />{errors.compTotal}</p>}

            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2">
              <Icon name="InformationCircleIcon" size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-800">Rate each competency on a scale of 1–5 based on behavioral evidence. Total weight must equal exactly 20. Adjust weights to reflect relative importance.</p>
            </div>

            <div className="space-y-3">
              {competencies.map((comp) => (
                <div key={comp.id} className="bg-white rounded-xl border border-border p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-700 text-foreground">{comp.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{comp.description}</p>
                    </div>
                    <div className="flex-shrink-0 w-20">
                      <label className="block text-[10px] font-600 text-muted-foreground mb-1 text-center">Weight</label>
                      <input
                        type="number"
                        min={0}
                        max={20}
                        value={comp.weight}
                        onChange={(e) => updateCompetency(comp.id, { weight: Number(e.target.value) })}
                        disabled={isReadOnly}
                        className="w-full text-sm font-700 text-center border border-border rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors disabled:bg-muted/40"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between">
              <button onClick={() => setActiveSection('scorecard')} className="flex items-center gap-1.5 px-4 py-2 border border-border text-sm font-600 rounded-lg hover:bg-muted transition-colors">
                <Icon name="ArrowLeftIcon" size={15} />
                Back
              </button>
              <button onClick={() => setActiveSection('signoff')} className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-sm font-600 rounded-lg hover:bg-primary/90 transition-colors">
                Next: Sign-Off
                <Icon name="ArrowRightIcon" size={15} />
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* PART 3 — SIGN-OFF                                                 */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {activeSection === 'signoff' && (
          <div className="space-y-4">
            {/* Rating policy */}
            <div className="bg-white rounded-xl border border-border p-5">
              <h3 className="text-sm font-700 text-foreground mb-3 flex items-center gap-2">
                <Icon name="InformationCircleIcon" size={16} className="text-primary" />
                2026 Ratings & Salary Increment Policy
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { range: '≥ 120%', label: 'Outstanding', detail: '2-Notch Salary Increment + Letter', color: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
                  { range: '100–120%', label: 'Above Average / Meets', detail: '1-Notch Salary Increment', color: 'bg-sky-50 border-sky-200 text-sky-800' },
                  { range: '75–99%', label: 'Needs Improvement', detail: 'No Annual Increment', color: 'bg-amber-50 border-amber-200 text-amber-800' },
                  { range: '< 50%', label: 'Unsatisfactory', detail: 'Mandatory Performance Improvement Plan (PIP)', color: 'bg-red-50 border-red-200 text-red-800' },
                ].map((r) => (
                  <div key={r.range} className={`rounded-lg border px-3 py-2.5 ${r.color}`}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs font-700">{r.range}</span>
                      <span className="text-xs font-600">{r.label}</span>
                    </div>
                    <p className="text-[11px] opacity-80">{r.detail}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Support required */}
            <div className="bg-white rounded-xl border border-border p-5 space-y-3">
              <h3 className="text-sm font-700 text-foreground flex items-center gap-2">
                <Icon name="HandRaisedIcon" size={16} className="text-primary" />
                Support Required from Management
              </h3>
              <textarea
                rows={3}
                value={supportRequired}
                onChange={(e) => setSupportRequired(e.target.value)}
                disabled={isReadOnly}
                placeholder="Describe any support, resources, or training you need from management to achieve your objectives…"
                className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors resize-none placeholder:text-muted-foreground/60 disabled:bg-muted/40"
              />
            </div>

            {/* Completion checklist */}
            <div className="bg-white rounded-xl border border-border p-5">
              <h3 className="text-sm font-700 text-foreground mb-3 flex items-center gap-2">
                <Icon name="ClipboardDocumentCheckIcon" size={16} className="text-primary" />
                Submission Checklist
              </h3>
              <div className="space-y-2">
                {[
                  { label: 'Fiscal year selected', done: !!fiscalYear },
                  { label: 'At least one BSC objective added', done: rows.length > 0 },
                  { label: 'All objectives have perspective, goal, and KPI', done: rows.every((r) => r.perspective && r.objective && r.kpis.length > 0) },
                  { label: `BSC total weight ≤ 80 (current: ${bscTotal})`, done: bscTotal > 0 && bscTotal <= 80 },
                  { label: `Competency total weight = 20 (current: ${compTotal})`, done: Math.abs(compTotal - 20) < 1 },
                  { label: 'Staff signature provided', done: !!staffSignature.trim() },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${item.done ? 'bg-emerald-500' : 'bg-muted border border-border'}`}>
                      {item.done && <Icon name="CheckIcon" size={10} className="text-white" />}
                    </div>
                    <span className={`text-xs ${item.done ? 'text-foreground' : 'text-muted-foreground'}`}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Signature */}
            <div className="bg-white rounded-xl border border-border p-5 space-y-4">
              <h3 className="text-sm font-700 text-foreground flex items-center gap-2">
                <Icon name="PencilSquareIcon" size={16} className="text-primary" />
                Commitment & Sign-Off
              </h3>
              <p className="text-xs text-muted-foreground">By signing below, you confirm that the objectives and KPIs in this workplan are agreed upon and you commit to working towards achieving them during the review period.</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-600 text-foreground mb-1">
                    Employee Signature (Type Full Name) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={staffSignature}
                    onChange={(e) => setStaffSignature(e.target.value)}
                    disabled={isReadOnly}
                    placeholder={staffName}
                    className={`w-full text-sm border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 transition-colors font-serif italic disabled:bg-muted/40 ${errors.staffSignature ? 'border-red-400 focus:ring-red-300' : 'border-border focus:ring-primary/30 focus:border-primary'}`}
                  />
                  {errors.staffSignature && <p className="mt-1 text-[11px] text-red-600 flex items-center gap-1"><Icon name="ExclamationCircleIcon" size={11} />{errors.staffSignature}</p>}
                </div>
                <div>
                  <label className="block text-xs font-600 text-foreground mb-1">Supervisor Signature</label>
                  <div className="px-3 py-2 bg-muted/40 rounded-lg text-sm text-muted-foreground italic">
                    {supervisorName ? `Pending — ${supervisorName}` : 'Pending supervisor review'}
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground">Supervisor will sign after reviewing your workplan.</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between gap-3">
              <button onClick={() => setActiveSection('competencies')} className="flex items-center gap-1.5 px-4 py-2 border border-border text-sm font-600 rounded-lg hover:bg-muted transition-colors">
                <Icon name="ArrowLeftIcon" size={15} />
                Back
              </button>

              <div className="flex items-center gap-3">
                {!isReadOnly && (
                  <button
                    onClick={() => handleSaveDraft(true)}
                    disabled={saveStatus === 'saving'}
                    className="flex items-center gap-1.5 px-4 py-2 border border-border text-sm font-600 rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
                  >
                    <Icon name="CloudArrowUpIcon" size={15} />
                    Save Draft
                  </button>
                )}

                {submitStatus === 'submitted' ? (
                  <div className="flex items-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-700 text-sm font-600 rounded-lg">
                    <Icon name="CheckCircleIcon" size={16} />
                    Submitted!
                  </div>
                ) : (
                  <button
                    onClick={handleSubmit}
                    disabled={submitStatus === 'submitting' || isReadOnly}
                    className="flex items-center gap-1.5 px-5 py-2 bg-primary text-white text-sm font-700 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-sm"
                  >
                    {submitStatus === 'submitting' ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Submitting…
                      </>
                    ) : (
                      <>
                        <Icon name="PaperAirplaneIcon" size={15} />
                        Submit Workplan
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
