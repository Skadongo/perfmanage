'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Toaster } from 'sonner';
import dynamic from 'next/dynamic';
import type { ImportedWorkplanData } from './components/PDFWorkplanImportModal';

// ── PDF import modal — loaded only when the user triggers it ─────────────
const PDFWorkplanImportModal = dynamic(() => import('./components/PDFWorkplanImportModal'), { ssr: false });

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

interface SaveFailureReason {
  title: string;
  detail: string;
  fix: string;
  section?: 'scorecard' | 'competencies' | 'signoff';
}

interface SaveFailure {
  action: 'submit' | 'draft';
  headline: string;
  summary: string;
  reasons: SaveFailureReason[];
  technical?: string;
  occurredAt: string;
}

function describeDatabaseError(err: any, ctx: { staffId: string | null; supervisorId: string | null; fiscalYear: string; workplanId: string | null }): { reasons: SaveFailureReason[]; technical: string } {
  const code: string = err?.code || '';
  const message: string = err?.message || '';
  const lower = message.toLowerCase();
  const reasons: SaveFailureReason[] = [];

  if (code === '42501' || lower.includes('row-level security') || lower.includes('permission denied')) {
    reasons.push({
      title: 'The database refused permission to write this workplan',
      detail: 'The system only lets you save a workplan that belongs to your own staff record. The database check (row-level security) could not confirm that your login account is linked to the staff record this workplan is being saved for.',
      fix: 'Sign out and sign in again. If it still fails, ask HR or the system administrator to link your user profile to your staff record (the staff list email must match your login email exactly).',
    });
  }
  if (code === '23503' || lower.includes('foreign key')) {
    const which = lower.includes('supervisor')
      ? 'the supervisor assigned to you' : lower.includes('staff_id')
        ? 'your staff record' :'your staff record or your supervisor';
    reasons.push({
      title: 'A linked record could not be found',
      detail: `The workplan points to ${which}, but that person does not exist in the staff list in the database${ctx.supervisorId ? '' : ' (no supervisor is currently assigned to you)'}.`,
      fix: 'Ask HR to confirm that your staff entry and your supervisor’s staff entry both exist and that your supervisor is correctly assigned to you.',
    });
  }
  if (code === '23505' || lower.includes('duplicate key') || lower.includes('unique constraint')) {
    reasons.push({
      title: `A workplan already exists for ${ctx.fiscalYear}`,
      detail: 'The database allows only one workplan per staff member for each fiscal year. A workplan for this year was already created (possibly in another tab, on another device, or by your supervisor) and this page did not know about it.',
      fix: 'Refresh the page so the existing workplan is loaded, then edit and save that one instead of creating a new one.',
    });
  }
  if (code === '23502' || lower.includes('null value') || lower.includes('not-null')) {
    const col = message.match(/column "([^"]+)"/)?.[1];
    reasons.push({
      title: 'A required value is missing',
      detail: `The database requires a value${col ? ` for “${col}”` : ''} but none was provided.${col === 'supervisor_id' ? ' You do not have a supervisor assigned in the staff list.' : ''}`,
      fix: 'Complete every required field. If the missing item is your supervisor or job details, ask HR to update your staff record.',
    });
  }
  if (code === '23514' || lower.includes('check constraint') || lower.includes('violates check')) {
    reasons.push({
      title: 'A value is not allowed by the database rules',
      detail: 'One of the values (for example the status, fiscal year or a weight) falls outside what the database accepts.',
      fix: 'Re-check the fiscal year selected and the weights you entered, then try again.',
    });
  }
  if (code === '22P02' || code === '22007' || code === '22008' || lower.includes('invalid input syntax')) {
    reasons.push({
      title: 'A value is in the wrong format',
      detail: 'A field contains text or a number in a format the database cannot read (for example letters where a number is expected).',
      fix: 'Check every weight and target field for stray characters, then try again.',
      section: 'scorecard',
    });
  }
  if (code === 'PGRST116' || lower.includes('not saved') || lower.includes('record not found')) {
    reasons.push({
      title: 'Nothing was written to the database',
      detail: 'The save request ran but no workplan row was changed or returned. This normally means the workplan you are editing is not visible to your account (it belongs to a different staff record) or it was removed.',
      fix: 'Refresh the page. If the problem continues, contact HR to confirm your account is linked to the correct staff record.',
    });
  }
  if (lower.includes('jwt') || lower.includes('not authenticated') || lower.includes('session') || code === 'PGRST301' || code === '401') {
    reasons.push({
      title: 'Your login session has expired',
      detail: 'Your secure session timed out, so the database no longer recognises who you are and rejects the save.',
      fix: 'Copy nothing yet — sign in again in a new tab, return here and save again. Your on-screen entries are still in this page.',
    });
  }
  if (lower.includes('failed to fetch') || lower.includes('network') || lower.includes('timeout') || lower.includes('timed out') || lower.includes('load failed')) {
    reasons.push({
      title: 'The server could not be reached',
      detail: 'Your device lost its connection to the server (or the connection timed out) before the workplan could be sent.',
      fix: 'Check your internet connection and try again. Your entries are still in this page, so do not close or refresh it until the save succeeds.',
    });
  }
  if (lower.includes('payload too large') || lower.includes('request entity too large') || code === '413') {
    reasons.push({
      title: 'The workplan is too large to save',
      detail: 'The amount of text in the objectives and KPIs exceeds the size the server accepts in one request.',
      fix: 'Shorten very long descriptions or split them into fewer, more concise KPIs.',
      section: 'scorecard',
    });
  }

  if (reasons.length === 0) {
    reasons.push({
      title: 'The database returned an unexpected error',
      detail: message || 'No error message was returned by the server.',
      fix: 'Try again in a moment. If it keeps failing, send the technical details below to the system administrator.',
    });
  }

  const technical = [code && `Code: ${code}`, message && `Message: ${message}`, err?.details && `Details: ${err.details}`, err?.hint && `Hint: ${err.hint}`]
    .filter(Boolean)
    .join('\n') || 'No technical details were returned.';

  return { reasons, technical };
}

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
  const [saveFailure, setSaveFailure] = useState<SaveFailure | null>(null);

  // PDF import state
  const [showImportModal, setShowImportModal] = useState(false);

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
          .ilike('email', profile!.email.trim())
          .limit(1)
          .maybeSingle();
        record = data;

        // Self-heal: persist the link so RLS (auth_user_staff_id) allows saving the workplan
        if (record?.id) {
          await supabase
            .from('user_profiles')
            .update({ staff_id: record.id })
            .eq('id', profile!.id)
            .is('staff_id', null);
        }
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
    // Never overwrite a submitted/signed/approved workplan with draft status
    if (workplanStatus === 'submitted' || workplanStatus === 'signed' || workplanStatus === 'approved') return;
    if (submitStatus === 'submitting' || submitStatus === 'submitted') return;
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
        const { data: updated, error } = await supabase
          .from('workplan_settings')
          .update(payload)
          .eq('id', workplanId)
          .select('id')
          .maybeSingle();
        if (error) throw error;
        if (!updated?.id) throw new Error('Draft not saved: no workplan row was changed (record not found or not visible to your account).');
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
        setSaveFailure(null);
        if (showToast) toast.success('Draft saved successfully');
        setTimeout(() => { if (isMounted.current) setSaveStatus('idle'); }, 2500);
      }
    } catch (err: any) {
      if (isMounted.current) {
        setSaveStatus('error');
        const { reasons, technical } = describeDatabaseError(err, { staffId, supervisorId, fiscalYear, workplanId });
        const failure: SaveFailure = {
          action: 'draft',
          headline: 'Your draft could not be saved',
          summary: 'The system tried to store your draft in the database but the save was rejected. Nothing you typed has been lost — it is still on this page — but it has NOT been stored yet.',
          reasons,
          technical,
          occurredAt: new Date().toLocaleString('en-GB'),
        };
        // Autosave failures stay quiet unless the user pressed Save Draft
        if (showToast) setSaveFailure(failure);
        toast.error(`Draft not saved: ${reasons[0].title}`, { id: 'workplan-draft-error', description: reasons[0].fix, duration: 8000 });
      }
    }
  }

  // ─── Validate ─────────────────────────────────────────────────────────────

  function validate(): boolean {
    const errs: Record<string, string> = {};
    const reasons: SaveFailureReason[] = [];

    if (!fiscalYear) {
      errs.fiscalYear = 'Select a fiscal year.';
      reasons.push({ title: 'No fiscal year is selected', detail: 'A workplan must belong to a fiscal year so it can be matched with your mid-year and final reviews.', fix: 'Select a fiscal year at the top of the Scorecard section.', section: 'scorecard' });
    }
    if (!staffSignature.trim()) {
      errs.staffSignature = 'Your signature (typed name) is required.';
      reasons.push({ title: 'You have not signed the workplan', detail: 'Submitting is treated as your formal agreement to the performance contract, so your typed-name signature is mandatory.', fix: 'Open the Sign-off section and type your full name in the Staff Signature box.', section: 'signoff' });
    }

    const bscTotal = rows.reduce((s, r) => s + (Number(r.weight) || 0), 0);
    if (rows.length === 0) {
      errs.rows = 'Add at least one BSC objective.';
      reasons.push({ title: 'There are no objectives', detail: 'A workplan with no Balanced Scorecard objectives has nothing to be assessed against.', fix: 'Click “Add Objective” in the Scorecard section and complete at least one objective.', section: 'scorecard' });
    }
    if (bscTotal === 0) {
      errs.bscTotal = 'Total BSC weight must be greater than 0.';
      if (rows.length > 0) reasons.push({ title: 'Objective weights add up to 0', detail: 'None of your objectives has a weight, so the scorecard cannot contribute to your final score.', fix: 'Give each objective a weight of at least 1. All objective weights together must not exceed 80.', section: 'scorecard' });
    }
    if (bscTotal > 80) {
      errs.bscTotal = `Total BSC weight is ${bscTotal}. Must not exceed 80.`;
      reasons.push({ title: `Objective weights total ${bscTotal}, which is over the limit of 80`, detail: `Balanced Scorecard objectives carry 80 of the 100 points (the other 20 are for competencies). Your objectives are ${bscTotal - 80} point(s) over.`, fix: `Reduce one or more objective weights by a combined ${bscTotal - 80} point(s).`, section: 'scorecard' });
    }

    rows.forEach((row, i) => {
      const label = row.objective?.trim() ? `Objective ${i + 1} (“${row.objective.trim().slice(0, 40)}${row.objective.trim().length > 40 ? '…' : ''}”)` : `Objective ${i + 1}`;
      if (!row.perspective) {
        errs[`row_${i}_perspective`] = 'Select a perspective.';
        reasons.push({ title: `${label}: no perspective chosen`, detail: 'Every objective must sit under one of the four Balanced Scorecard perspectives.', fix: 'Choose a perspective for this objective.', section: 'scorecard' });
      }
      if (!row.objective.trim()) {
        errs[`row_${i}_objective`] = 'Objective is required.';
        reasons.push({ title: `${label}: the objective text is empty`, detail: 'An objective needs a written statement so your supervisor knows what you are committing to.', fix: 'Type the objective in the Objective box.', section: 'scorecard' });
      }
      if (!row.weight || row.weight < 1) {
        errs[`row_${i}_weight`] = 'Weight must be ≥ 1.';
        reasons.push({ title: `${label}: weight is missing or below 1`, detail: 'Each objective must carry a weight of at least 1 point.', fix: 'Enter a weight of 1 or more for this objective.', section: 'scorecard' });
      }
      if (row.kpis.length === 0) {
        errs[`row_${i}_kpis`] = 'Add at least one KPI.';
        reasons.push({ title: `${label}: no KPIs added`, detail: 'Without a KPI there is nothing measurable to rate this objective against.', fix: 'Add at least one KPI (with a target) under this objective.', section: 'scorecard' });
      }
    });

    const compTotal = competencies.reduce((s, c) => s + (Number(c.weight) || 0), 0);
    if (Math.abs(compTotal - 20) >= 1) {
      errs.compTotal = `Competency weights total ${compTotal}. Must equal 20.`;
      reasons.push({ title: `Competency weights total ${compTotal} instead of 20`, detail: `General competencies carry exactly 20 of the 100 points. Your competencies are currently ${compTotal > 20 ? `${compTotal - 20} point(s) over` : `${20 - compTotal} point(s) short`}.`, fix: `Adjust the competency weights in the Competencies section so they add up to exactly 20.`, section: 'competencies' });
    }

    setErrors(errs);
    if (reasons.length > 0) {
      setSaveFailure({
        action: 'submit',
        headline: 'Your workplan was NOT saved or submitted',
        summary: `${reasons.length} problem${reasons.length === 1 ? '' : 's'} must be fixed before the system will accept your workplan. Nothing was sent to the database. Your entries are still on this page.`,
        reasons,
        occurredAt: new Date().toLocaleString('en-GB'),
      });
    }
    return Object.keys(errs).length === 0;
  }

  // ─── Submit ───────────────────────────────────────────────────────────────

  async function handleSubmit() {
    setSaveFailure(null);
    if (!validate()) {
      toast.error('Workplan not saved — see the detailed explanation below.');
      // Navigate to first section with errors
      const hasScorecard = Object.keys(errors).some((k) => k.startsWith('row_') || k === 'bscTotal' || k === 'rows');
      const hasComp = !!errors.compTotal;
      if (hasScorecard) setActiveSection('scorecard');
      else if (hasComp) setActiveSection('competencies');
      else setActiveSection('signoff');
      return;
    }

    const supabase = supabaseRef.current;

    if (!staffId) {
      toast.error('Your staff record could not be found. Please contact HR.');
      setSaveFailure({
        action: 'submit',
        headline: 'Your workplan was NOT saved',
        summary: 'The system cannot tell which staff member this workplan belongs to.',
        reasons: [{ title: 'Your login is not linked to a staff record', detail: 'Workplans are stored against a staff record. Your user profile has no staff record attached, so the database would reject the save.', fix: 'Contact HR to confirm your email in the staff list matches your login email, then sign in again.' }],
        occurredAt: new Date().toLocaleString('en-GB'),
      });
      return;
    }

    const nowIso = new Date().toISOString();
    const payload = {
      staff_id: staffId,
      supervisor_id: supervisorId,
      fiscal_year: fiscalYear,
      review_year: parseInt(fiscalYear.match(/\d{4}/)?.[0] || '2026'),
      perspectives_objectives: rows,
      general_competencies: competencies,
      staff_signature: staffSignature,
      staff_signed_at: nowIso,
      status: 'signed',
      workflow_stage: 'workplan_pending',
      review_type: 'annual',
      submitted_at: nowIso,
      updated_at: nowIso,
    };

    // Cancel any pending autosave so it cannot overwrite the submitted status
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);

    setSubmitStatus('submitting');
    const toastId = toast.loading('Saving workplan…');

    try {
      let savedId: string | null = workplanId;

      if (workplanId) {
        const { data, error } = await supabase
          .from('workplan_settings')
          .update(payload)
          .eq('id', workplanId)
          .select('id')
          .maybeSingle();
        if (error) throw error;
        if (!data?.id) {
          throw new Error('The workplan was not saved (permission denied or record not found). Please refresh and try again.');
        }
        savedId = data.id;
      } else {
        const { data, error } = await supabase
          .from('workplan_settings')
          .insert({ ...payload, created_at: nowIso })
          .select('id')
          .single();
        if (error) throw error;
        if (!data?.id) throw new Error('The workplan was not saved. Please try again.');
        savedId = data.id;
      }

      if (isMounted.current) {
        setWorkplanId(savedId);
        setWorkplanStatus('signed');
        setWorkplanStage('workplan_pending');
        setSubmitStatus('submitted');
      }
      toast.success('Workplan saved successfully!', {
        id: toastId,
        description: 'Your supervisor will review it.',
        duration: 4000,
      });
    } catch (err: any) {
      if (isMounted.current) {
        setSubmitStatus('idle');
      }
      const code = err?.code;
      const message =
        code === '42501' || err?.message?.includes('row-level security')
          ? 'You do not have permission to save this workplan. Your account may not be linked to a staff record — contact HR.'
          : code === '23503' ?'Your staff or supervisor record could not be found in the staff list. Contact HR.' : err?.message ||'Failed to save workplan.';
      toast.error('Workplan was NOT saved', { id: toastId, description: message, duration: 8000 });
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

  // ─── PDF Import Handler ────────────────────────────────────────────────────

  function handlePDFImport(data: ImportedWorkplanData) {
    setFiscalYear(data.fiscalYear);
    setRows(data.perspectivesObjectives);
    setCompetencies(data.generalCompetencies);
    if (data.supportRequired) setSupportRequired(data.supportRequired);
    // Expand all imported rows
    setExpandedRows(new Set(data.perspectivesObjectives.map((r) => r.id)));
    setActiveSection('scorecard');
    toast.success(`Workplan data imported for ${data.staffName}. Review and save when ready.`);
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
          <div className="text-center space-y-4 max-w-lg">
            <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto">
              <Icon name="ExclamationTriangleIcon" size={28} className="text-amber-600" />
            </div>
            <h2 className="text-lg font-700 text-foreground">You cannot save a workplan yet — Staff Record Not Found</h2>
            <p className="text-sm text-muted-foreground">Your account is not linked to a staff record. Please contact HR or your system administrator.</p>
            <div className="text-left text-xs bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2">
              <p className="font-700 text-amber-900">Why this happens</p>
              <ul className="list-disc pl-4 space-y-1 text-amber-900/90">
                <li>Workplans are stored against a staff record, and your login ({profile?.email || 'your email'}) is not attached to one, so the database will reject any save.</li>
                <li>The email in the official staff list may differ from the email you log in with (different spelling, a typo, or another domain).</li>
                <li>You may not yet have been added to the staff list, or your entry was removed.</li>
              </ul>
              <p className="font-700 text-amber-900 pt-1">How to fix it</p>
              <ul className="list-disc pl-4 space-y-1 text-amber-900/90">
                <li>Ask HR to confirm your staff entry exists and uses exactly the email shown above.</li>
                <li>Once corrected, sign out, sign in again and reopen My Workplan.</li>
              </ul>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Toaster position="top-right" richColors />
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

        {/* ── Why the workplan could not be saved ── */}
        {saveFailure && (
          <div role="alert" className="rounded-xl border-2 border-red-300 bg-red-50 p-4 sm:p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <Icon name="ExclamationTriangleIcon" size={20} className="text-red-600" />
                </div>
                <div>
                  <h2 className="text-base font-700 text-red-800">{saveFailure.headline}</h2>
                  <p className="text-sm text-red-700 mt-0.5">{saveFailure.summary}</p>
                  <p className="text-[11px] text-red-600/80 mt-1">Attempted {saveFailure.occurredAt}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSaveFailure(null)}
                className="text-red-500 hover:text-red-700 flex-shrink-0"
                aria-label="Dismiss explanation"
              >
                <Icon name="XMarkIcon" size={18} />
              </button>
            </div>

            <div>
              <p className="text-xs font-700 uppercase tracking-wide text-red-800 mb-2">
                Reason{saveFailure.reasons.length === 1 ? '' : 's'} it failed ({saveFailure.reasons.length})
              </p>
              <ol className="space-y-2.5">
                {saveFailure.reasons.map((r, i) => (
                  <li key={i} className="bg-white border border-red-200 rounded-lg p-3">
                    <div className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-red-600 text-white text-[11px] font-700 flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                      <div className="space-y-1 min-w-0">
                        <p className="text-sm font-700 text-foreground">{r.title}</p>
                        <p className="text-xs text-muted-foreground"><span className="font-600 text-foreground">Why: </span>{r.detail}</p>
                        <p className="text-xs text-emerald-700"><span className="font-600">How to fix: </span>{r.fix}</p>
                        {r.section && (
                          <button
                            type="button"
                            onClick={() => setActiveSection(r.section!)}
                            className="text-[11px] font-600 text-primary hover:underline"
                          >
                            Go to the {r.section === 'scorecard' ? 'Scorecard' : r.section === 'competencies' ? 'Competencies' : 'Sign-off'} section →
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="text-xs text-red-800 bg-red-100/60 rounded-lg px-3 py-2">
              <p className="font-700 mb-0.5">What happens next</p>
              <p>Your work is still on this page but is not stored. Do not close or refresh until you have fixed the items above and see a “saved successfully” message. If the problem persists, send the technical details below to the system administrator.</p>
            </div>

            {saveFailure.technical && (
              <details className="text-xs">
                <summary className="cursor-pointer font-600 text-red-800">Technical details (for the administrator)</summary>
                <pre className="mt-2 whitespace-pre-wrap break-words bg-white border border-red-200 rounded-lg p-3 text-[11px] text-foreground">{saveFailure.technical}</pre>
              </details>
            )}
          </div>
        )}

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
              <>
                <button
                  onClick={() => setShowImportModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-600 border border-primary/30 text-primary bg-primary/5 rounded-lg hover:bg-primary/10 transition-colors"
                  title="Import workplan data from PDF"
                >
                  <Icon name="DocumentArrowUpIcon" size={14} />
                  Import from PDF
                </button>
                <button
                  onClick={() => handleSaveDraft(true)}
                  disabled={saveStatus === 'saving'}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-600 border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
                >
                  <Icon name="CloudArrowUpIcon" size={14} />
                  Save Draft
                </button>
              </>
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

        {/* ── PDF Import Modal ── */}
        <PDFWorkplanImportModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          onImport={handlePDFImport}
        />
      </div>
    </AppLayout>
  );
}
