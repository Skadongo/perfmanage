'use client';

import React, { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PerspectiveRow {
  id: string;
  perspective: string;
  objective: string;
  keyActivities: string;
  kpis: { id: string; label: string; target: string }[];
  weight: number;
}

interface Competency {
  id: string;
  name: string;
  description: string;
  weight: number;
}

interface WorkplanRecord {
  staffName: string;
  jobTitle: string;
  directorate: string;
  supervisorName: string;
  fiscalYear: string;
  reviewYear: number;
  perspectivesObjectives: PerspectiveRow[];
  generalCompetencies: Competency[];
  // resolved
  _staffId?: string | null;
  _supervisorId?: string | null;
  _errors: string[];
  _warnings: string[];
  // conflict
  _existingWorkplanId?: string | null;
}

type ConflictResolution = 'overwrite' | 'merge' | 'skip';

interface ConflictState {
  record: WorkplanRecord;
  existingId: string;
  resolution: ConflictResolution;
}

type UploadStatus = 'idle' | 'parsing' | 'validating' | 'conflict' | 'ready' | 'importing' | 'done' | 'error';

// ─── Constants ────────────────────────────────────────────────────────────────

const PERSPECTIVES = [
  'Financial/Stewardship',
  'Customer/Stakeholder',
  'Internal Business Processes',
  'Innovation Learning & Growth',
];

const DEFAULT_COMPETENCIES: Competency[] = [
  { id: 'c1', name: 'Teamwork', description: 'Creates a culture of teamwork and responds rationally to feedback.', weight: 3 },
  { id: 'c2', name: 'Respect for Diversity', description: 'Values individual differences and promotes a peaceful work environment.', weight: 3 },
  { id: 'c3', name: 'Integrity', description: 'Reliable, meets all deadlines, and takes credit only for own work.', weight: 3 },
  { id: 'c4', name: 'Communication', description: 'Explains complex issues clearly and uses visual aids effectively.', weight: 3 },
  { id: 'c5', name: 'Results Oriented', description: 'Prioritizes activities and matches tasks with team capabilities.', weight: 3 },
  { id: 'c6', name: 'Innovation', description: 'Thinks "outside the box" to foster team creativity.', weight: 3 },
  { id: 'c7', name: 'Leadership (GS3+)', description: 'Acts as a role model and provides timely specific feedback to staff.', weight: 2 },
];

const FISCAL_YEAR_OPTIONS = [
  'FY 2026-2027 (Jul–Jun)',
  'FY 2025-2026 (Jul–Jun)',
  'FY 2024-2025 (Jul–Jun)',
];

const REQUIRED_COLS = ['staff_name', 'perspective', 'key_work_objective', 'kpi_measure', 'target'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function norm(v: unknown): string {
  return String(v ?? '').trim();
}

function uid() {
  return `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalisePerspective(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes('financial') || lower.includes('steward')) return 'Financial/Stewardship';
  if (lower.includes('customer') || lower.includes('stakeholder')) return 'Customer/Stakeholder';
  if (lower.includes('internal') || lower.includes('business') || lower.includes('process')) return 'Internal Business Processes';
  if (lower.includes('innov') || lower.includes('learn') || lower.includes('growth')) return 'Innovation Learning & Growth';
  return raw;
}

function downloadTemplate() {
  const wb = XLSX.utils.book_new();
  const headers = [
    'staff_name', 'job_title', 'directorate', 'supervisor_name', 'fiscal_year',
    'perspective', 'key_work_objective', 'key_activities', 'kpi_measure', 'target', 'weight',
  ];
  const sampleRows = [
    ['JANE MARY DOE', 'Programme Officer', 'Programmes', 'ANDREW NKHULO SILUMESII', 'FY 2026-2027 (Jul–Jun)', 'Financial/Stewardship', 'Strengthen financial sustainability', 'Prepare quarterly financial reports; monitor budget utilisation', 'Budget Variance (≤5% of approved budget)', '≤5% variance by June 2027', '3'],
    ['JANE MARY DOE', 'Programme Officer', 'Programmes', 'ANDREW NKHULO SILUMESII', 'FY 2026-2027 (Jul–Jun)', 'Customer/Stakeholder', 'Strengthen value proposition to Member States', 'Coordinate quarterly stakeholder meetings; produce meeting reports', 'Stakeholder Satisfaction Index', '≥80% satisfaction score', '3'],
    ['JOHN SMITH', 'Finance Officer', 'Finance', 'LILLIANE BRENDA NAMUTEBI NJUBA', 'FY 2026-2027 (Jul–Jun)', 'Internal Business Processes', 'Improve budget utilization', 'Monthly budget tracking; variance analysis reports', 'Budget Utilisation Rate (≥90%)', '≥90% utilisation by Q4', '4'],
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
  ws['!cols'] = headers.map(() => ({ wch: 30 }));
  XLSX.utils.book_append_sheet(wb, ws, 'Workplan Import');
  XLSX.writeFile(wb, 'ecsa_hc_workplan_import_template.xlsx');
}

// ─── Parse flat rows into grouped workplan records ────────────────────────────

function parseRows(rawRows: unknown[][], headers: string[], defaultFiscalYear: string): WorkplanRecord[] {
  const get = (row: unknown[], col: string) => norm(row[headers.indexOf(col)] ?? '');
  const grouped = new Map<string, WorkplanRecord>();

  for (const row of rawRows) {
    const staffName = get(row, 'staff_name').toUpperCase();
    if (!staffName) continue;

    const fiscalYearRaw = get(row, 'fiscal_year');
    const fiscalYear = fiscalYearRaw || defaultFiscalYear;
    const reviewYear = fiscalYear.includes('2026') ? 2026 : fiscalYear.includes('2025') ? 2025 : 2026;
    const key = `${staffName}::${fiscalYear}`;

    if (!grouped.has(key)) {
      grouped.set(key, {
        staffName,
        jobTitle: get(row, 'job_title'),
        directorate: get(row, 'directorate'),
        supervisorName: get(row, 'supervisor_name').toUpperCase(),
        fiscalYear,
        reviewYear,
        perspectivesObjectives: [],
        generalCompetencies: DEFAULT_COMPETENCIES.map((c) => ({ ...c })),
        _errors: [],
        _warnings: [],
        _existingWorkplanId: null,
      });
    }

    const record = grouped.get(key)!;
    if (!record.jobTitle && get(row, 'job_title')) record.jobTitle = get(row, 'job_title');
    if (!record.supervisorName && get(row, 'supervisor_name')) record.supervisorName = get(row, 'supervisor_name').toUpperCase();

    const perspectiveRaw = get(row, 'perspective');
    const perspective = normalisePerspective(perspectiveRaw);
    const objective = get(row, 'key_work_objective');
    const keyActivities = get(row, 'key_activities');
    const kpiLabel = get(row, 'kpi_measure');
    const target = get(row, 'target');
    const weightRaw = get(row, 'weight');
    const weight = weightRaw ? Math.min(5, Math.max(1, parseInt(weightRaw, 10) || 3)) : 3;

    if (!perspectiveRaw) { record._warnings.push(`Row missing perspective — skipped`); continue; }
    if (!PERSPECTIVES.includes(perspective)) record._warnings.push(`Unknown perspective "${perspectiveRaw}" — mapped as-is`);

    let existingRow = record.perspectivesObjectives.find(
      (r) => r.perspective === perspective && r.objective === objective
    );
    if (!existingRow) {
      existingRow = { id: uid(), perspective, objective, keyActivities, kpis: [], weight };
      record.perspectivesObjectives.push(existingRow);
    }
    if (kpiLabel) existingRow.kpis.push({ id: uid(), label: kpiLabel, target });
  }

  for (const record of grouped.values()) {
    if (!record.staffName) record._errors.push('Staff name is required');
    if (record.perspectivesObjectives.length === 0) record._errors.push('No scorecard rows found');
    if (!record.jobTitle) record._warnings.push('Job title not provided');
    if (!record.supervisorName) record._warnings.push('Supervisor name not provided');
  }

  return Array.from(grouped.values());
}

// ─── Merge helper — combines existing + incoming perspective rows ──────────────

function mergeWorkplanRows(
  existingRows: PerspectiveRow[],
  incomingRows: PerspectiveRow[]
): PerspectiveRow[] {
  const merged = existingRows.map((r) => ({ ...r, kpis: [...r.kpis] }));
  for (const incoming of incomingRows) {
    const match = merged.find(
      (r) => r.perspective === incoming.perspective && r.objective === incoming.objective
    );
    if (match) {
      // Add KPIs that don't already exist (by label)
      for (const kpi of incoming.kpis) {
        if (!match.kpis.some((k) => k.label === kpi.label)) {
          match.kpis.push({ ...kpi });
        }
      }
    } else {
      merged.push({ ...incoming, kpis: [...incoming.kpis] });
    }
  }
  return merged;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface BulkWorkplanUploadModalProps {
  onClose: () => void;
  onImportComplete: (count: number) => void;
}

// ─── Conflict Dialog ──────────────────────────────────────────────────────────

interface ConflictDialogProps {
  conflicts: ConflictState[];
  onResolutionChange: (staffName: string, resolution: ConflictResolution) => void;
  onApplyAll: (resolution: ConflictResolution) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConflictDialog({ conflicts, onResolutionChange, onApplyAll, onConfirm, onCancel }: ConflictDialogProps) {
  return (
    <div className="space-y-4">
      {/* Header banner */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
        <div className="p-1.5 bg-amber-100 rounded-lg flex-shrink-0 mt-0.5">
          <Icon name="EcsaWarningIcon" size={18} className="text-amber-600" />
        </div>
        <div>
          <p className="text-sm font-700 text-amber-800">
            {conflicts.length} Conflict{conflicts.length !== 1 ? 's' : ''} Detected
          </p>
          <p className="text-xs text-amber-700 mt-0.5">
            The following staff members already have a workplan for the selected fiscal year.
            Choose how to handle each conflict before proceeding.
          </p>
        </div>
      </div>

      {/* Apply-all shortcuts */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground font-600 mr-1">Apply to all:</span>
        {(['overwrite', 'merge', 'skip'] as ConflictResolution[]).map((res) => (
          <button
            key={res}
            onClick={() => onApplyAll(res)}
            className={`px-3 py-1 rounded-lg text-xs font-600 border transition-colors ${
              res === 'overwrite' ?'border-rose-300 text-rose-700 hover:bg-rose-50'
                : res === 'merge' ?'border-blue-300 text-blue-700 hover:bg-blue-50' :'border-slate-300 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {res.charAt(0).toUpperCase() + res.slice(1)} All
          </button>
        ))}
      </div>

      {/* Per-record conflict list */}
      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
        {conflicts.map((conflict) => (
          <div
            key={conflict.record.staffName}
            className="rounded-xl border border-border bg-white p-4 space-y-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-700 text-foreground truncate">{conflict.record.staffName}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {conflict.record.jobTitle || 'No job title'} · {conflict.record.fiscalYear}
                </p>
              </div>
              <span className="text-[10px] font-700 text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5">
                Existing workplan
              </span>
            </div>

            {/* Resolution options */}
            <div className="grid grid-cols-3 gap-2">
              {/* Overwrite */}
              <button
                onClick={() => onResolutionChange(conflict.record.staffName, 'overwrite')}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-center transition-all ${
                  conflict.resolution === 'overwrite' ?'border-rose-500 bg-rose-50' :'border-border hover:border-rose-300 hover:bg-rose-50/50'
                }`}
              >
                <div className={`p-1.5 rounded-lg ${conflict.resolution === 'overwrite' ? 'bg-rose-100' : 'bg-muted'}`}>
                  <Icon name="ArrowPathIcon" size={16} className={conflict.resolution === 'overwrite' ? 'text-rose-600' : 'text-muted-foreground'} />
                </div>
                <span className={`text-xs font-700 ${conflict.resolution === 'overwrite' ? 'text-rose-700' : 'text-foreground'}`}>
                  Overwrite
                </span>
                <span className="text-[10px] text-muted-foreground leading-tight">
                  Replace existing data entirely
                </span>
              </button>

              {/* Merge */}
              <button
                onClick={() => onResolutionChange(conflict.record.staffName, 'merge')}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-center transition-all ${
                  conflict.resolution === 'merge' ?'border-blue-500 bg-blue-50' :'border-border hover:border-blue-300 hover:bg-blue-50/50'
                }`}
              >
                <div className={`p-1.5 rounded-lg ${conflict.resolution === 'merge' ? 'bg-blue-100' : 'bg-muted'}`}>
                  <Icon name="DocumentDuplicateIcon" size={16} className={conflict.resolution === 'merge' ? 'text-blue-600' : 'text-muted-foreground'} />
                </div>
                <span className={`text-xs font-700 ${conflict.resolution === 'merge' ? 'text-blue-700' : 'text-foreground'}`}>
                  Merge
                </span>
                <span className="text-[10px] text-muted-foreground leading-tight">
                  Add new rows to existing
                </span>
              </button>

              {/* Skip */}
              <button
                onClick={() => onResolutionChange(conflict.record.staffName, 'skip')}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-center transition-all ${
                  conflict.resolution === 'skip' ?'border-slate-500 bg-slate-50' :'border-border hover:border-slate-300 hover:bg-slate-50/50'
                }`}
              >
                <div className={`p-1.5 rounded-lg ${conflict.resolution === 'skip' ? 'bg-slate-100' : 'bg-muted'}`}>
                  <Icon name="MinusCircleIcon" size={16} className={conflict.resolution === 'skip' ? 'text-slate-600' : 'text-muted-foreground'} />
                </div>
                <span className={`text-xs font-700 ${conflict.resolution === 'skip' ? 'text-slate-700' : 'text-foreground'}`}>
                  Skip
                </span>
                <span className="text-[10px] text-muted-foreground leading-tight">
                  Keep existing, ignore import
                </span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Footer actions */}
      <div className="flex gap-3 pt-1">
        <button
          onClick={onCancel}
          className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm font-500 hover:bg-muted"
        >
          Back
        </button>
        <button
          onClick={onConfirm}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-600 hover:bg-primary/90"
        >
          <Icon name="ArrowUpTrayIcon" size={15} />
          Proceed with Import
        </button>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BulkWorkplanUploadModal({ onClose, onImportComplete }: BulkWorkplanUploadModalProps) {
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [records, setRecords] = useState<WorkplanRecord[]>([]);
  const [fileName, setFileName] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{ inserted: number; skipped: number; errors: string[] }>({ inserted: 0, skipped: 0, errors: [] });
  const [defaultFiscalYear, setDefaultFiscalYear] = useState('FY 2026-2027 (Jul–Jun)');
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<ConflictState[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validRecords = records.filter((r) => r._errors.length === 0);
  const errorRecords = records.filter((r) => r._errors.length > 0);

  // ── File processing ──────────────────────────────────────────────────────────

  const processFile = useCallback(async (file: File) => {
    setFileName(file.name);
    setStatus('parsing');
    setRecords([]);
    setConflicts([]);

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

      if (raw.length < 2) { setStatus('error'); return; }

      const headers = (raw[0] as unknown[]).map((h) => norm(h).toLowerCase().replace(/[\s/]+/g, '_'));
      const dataRows = raw.slice(1).filter((r) => (r as unknown[]).some((c) => norm(c) !== ''));

      const missing = REQUIRED_COLS.filter((c) => !headers.includes(c));
      if (missing.length > 0) {
        setStatus('error');
        setResults((r) => ({ ...r, errors: [`Missing required columns: ${missing.join(', ')}`] }));
        return;
      }

      const parsed = parseRows(dataRows, headers, defaultFiscalYear);
      setStatus('validating');

      const supabase = createClient();
      const allNames = [...new Set(parsed.flatMap((p) => [p.staffName, p.supervisorName].filter(Boolean)))];

      const { data: staffData } = await supabase
        .from('staff')
        .select('id, full_name, supervisor_id, supervisor_name')
        .in('full_name', allNames);

      const staffMap = new Map<string, { id: string; supervisor_id: string | null; supervisor_name: string | null }>();
      (staffData || []).forEach((s) => staffMap.set(s.full_name.toUpperCase(), s));

      for (const record of parsed) {
        const staffEntry = staffMap.get(record.staffName);
        if (staffEntry) {
          record._staffId = staffEntry.id;
          if (!record.supervisorName && staffEntry.supervisor_name) {
            record.supervisorName = staffEntry.supervisor_name;
          }
        } else {
          record._errors.push(`Staff member "${record.staffName}" not found in the system`);
        }

        if (record.supervisorName) {
          const supEntry = staffMap.get(record.supervisorName);
          record._supervisorId = supEntry?.id || null;
          if (!supEntry) record._warnings.push(`Supervisor "${record.supervisorName}" not found — will be left blank`);
        }
      }

      // ── Conflict detection: check which valid records already have a workplan ──
      const validParsed = parsed.filter((r) => r._errors.length === 0 && r._staffId);
      const conflictList: ConflictState[] = [];

      for (const record of validParsed) {
        const { data: existing } = await supabase
          .from('workplan_settings')
          .select('id')
          .eq('staff_id', record._staffId!)
          .eq('fiscal_year', record.fiscalYear)
          .maybeSingle();

        if (existing) {
          record._existingWorkplanId = existing.id;
          conflictList.push({ record, existingId: existing.id, resolution: 'overwrite' });
        }
      }

      setRecords(parsed);

      if (conflictList.length > 0) {
        setConflicts(conflictList);
        setStatus('conflict');
      } else {
        setStatus('ready');
      }
    } catch (err) {
      setStatus('error');
      setResults((r) => ({ ...r, errors: [`Failed to parse file: ${err instanceof Error ? err.message : 'Unknown error'}`] }));
    }
  }, [defaultFiscalYear]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  // ── Conflict resolution handlers ─────────────────────────────────────────────

  const handleResolutionChange = (staffName: string, resolution: ConflictResolution) => {
    setConflicts((prev) =>
      prev.map((c) => (c.record.staffName === staffName ? { ...c, resolution } : c))
    );
  };

  const handleApplyAll = (resolution: ConflictResolution) => {
    setConflicts((prev) => prev.map((c) => ({ ...c, resolution })));
  };

  const handleConflictConfirm = () => {
    setStatus('ready');
  };

  const handleConflictCancel = () => {
    setStatus('ready');
    setConflicts([]);
  };

  // ── Import ───────────────────────────────────────────────────────────────────

  const handleImport = async () => {
    if (validRecords.length === 0) return;
    setStatus('importing');
    setProgress(0);

    const supabase = createClient();
    let inserted = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Build a map of conflict resolutions by staff name
    const resolutionMap = new Map<string, ConflictResolution>();
    conflicts.forEach((c) => resolutionMap.set(c.record.staffName, c.resolution));

    for (let i = 0; i < validRecords.length; i++) {
      const record = validRecords[i];
      setProgress(Math.round(((i + 1) / validRecords.length) * 100));

      try {
        const existingId = record._existingWorkplanId;
        const resolution = existingId ? (resolutionMap.get(record.staffName) ?? 'overwrite') : null;

        if (existingId && resolution === 'skip') {
          skipped++;
          continue;
        }

        if (existingId && resolution === 'overwrite') {
          const { error } = await supabase
            .from('workplan_settings')
            .update({
              supervisor_id: record._supervisorId || null,
              perspectives_objectives: record.perspectivesObjectives,
              general_competencies: record.generalCompetencies,
              review_year: record.reviewYear,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingId);

          if (error) errors.push(`${record.staffName}: ${error.message}`);
          else inserted++;
          continue;
        }

        if (existingId && resolution === 'merge') {
          // Fetch existing rows first
          const { data: existingData } = await supabase
            .from('workplan_settings')
            .select('perspectives_objectives, general_competencies')
            .eq('id', existingId)
            .maybeSingle();

          const existingRows: PerspectiveRow[] = existingData?.perspectives_objectives || [];
          const mergedRows = mergeWorkplanRows(existingRows, record.perspectivesObjectives);

          const { error } = await supabase
            .from('workplan_settings')
            .update({
              supervisor_id: record._supervisorId || null,
              perspectives_objectives: mergedRows,
              general_competencies: record.generalCompetencies,
              review_year: record.reviewYear,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingId);

          if (error) errors.push(`${record.staffName}: ${error.message}`);
          else inserted++;
          continue;
        }

        // No existing workplan — insert new
        const { error } = await supabase
          .from('workplan_settings')
          .insert({
            staff_id: record._staffId!,
            supervisor_id: record._supervisorId || null,
            fiscal_year: record.fiscalYear,
            review_year: record.reviewYear,
            perspectives_objectives: record.perspectivesObjectives,
            general_competencies: record.generalCompetencies,
            status: 'draft',
            workflow_stage: 'workplan_pending',
          });

        if (error) errors.push(`${record.staffName}: ${error.message}`);
        else inserted++;
      } catch (err) {
        errors.push(`${record.staffName}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        skipped++;
      }
    }

    setResults({ inserted, skipped, errors });
    setStatus('done');
    if (inserted > 0) onImportComplete(inserted);
  };

  const reset = () => {
    setStatus('idle');
    setRecords([]);
    setFileName('');
    setProgress(0);
    setResults({ inserted: 0, skipped: 0, errors: [] });
    setConflicts([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Icon name="ArrowUpTrayIcon" size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="font-700 text-foreground">Bulk Workplan Upload</h2>
              <p className="text-xs text-muted-foreground">Import multiple ECSA-HC Performance Contracts at once</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted text-muted-foreground">
            <Icon name="EcsaCloseIcon" size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Done state */}
          {status === 'done' && (
            <div className="space-y-4">
              <div className={`rounded-xl border p-5 text-center ${results.errors.length === 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full mb-3 ${results.errors.length === 0 ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                  <Icon name={results.errors.length === 0 ? 'EcsaSuccessIcon' : 'EcsaWarningIcon'} size={24} className={results.errors.length === 0 ? 'text-emerald-600' : 'text-amber-600'} />
                </div>
                <h3 className={`font-700 text-lg ${results.errors.length === 0 ? 'text-emerald-800' : 'text-amber-800'}`}>
                  Import {results.errors.length === 0 ? 'Complete' : 'Completed with Issues'}
                </h3>
                <div className="flex justify-center gap-6 mt-3">
                  <div className="text-center">
                    <p className="text-2xl font-700 text-emerald-700">{results.inserted}</p>
                    <p className="text-xs text-muted-foreground">Imported</p>
                  </div>
                  {results.skipped > 0 && (
                    <div className="text-center">
                      <p className="text-2xl font-700 text-amber-700">{results.skipped}</p>
                      <p className="text-xs text-muted-foreground">Skipped</p>
                    </div>
                  )}
                  {results.errors.length > 0 && (
                    <div className="text-center">
                      <p className="text-2xl font-700 text-rose-700">{results.errors.length}</p>
                      <p className="text-xs text-muted-foreground">Errors</p>
                    </div>
                  )}
                </div>
              </div>
              {results.errors.length > 0 && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 space-y-1">
                  <p className="text-xs font-700 text-rose-800 mb-2">Import Errors</p>
                  {results.errors.map((e, i) => (
                    <p key={i} className="text-xs text-rose-700 flex items-start gap-1.5">
                      <Icon name="ExclamationCircleIcon" size={13} className="flex-shrink-0 mt-0.5" />
                      {e}
                    </p>
                  ))}
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={reset} className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm font-600 hover:bg-muted">
                  Upload Another File
                </button>
                <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-600 hover:bg-primary/90">
                  Close
                </button>
              </div>
            </div>
          )}

          {/* Importing progress */}
          {status === 'importing' && (
            <div className="flex flex-col items-center justify-center py-10 space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Icon name="EcsaRefreshIcon" size={28} className="text-primary animate-spin" />
              </div>
              <div className="text-center">
                <p className="font-600 text-foreground">Importing workplans…</p>
                <p className="text-sm text-muted-foreground mt-1">{progress}% complete</p>
              </div>
              <div className="w-full max-w-xs bg-muted rounded-full h-2">
                <div className="bg-primary h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {/* Idle / Upload state */}
          {(status === 'idle' || status === 'error') && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-600 text-muted-foreground mb-1.5">Default Fiscal Year</label>
                <select
                  value={defaultFiscalYear}
                  onChange={(e) => setDefaultFiscalYear(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {FISCAL_YEAR_OPTIONS.map((fy) => (
                    <option key={fy} value={fy}>{fy}</option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground mt-1">Used when fiscal_year column is blank in the file</p>
              </div>

              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors
                  ${dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30'}`}
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="p-3 bg-muted rounded-xl">
                    <Icon name="ArrowUpTrayIcon" size={28} className="text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-600 text-foreground">Drop your Excel or CSV file here</p>
                    <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
                  </div>
                  <p className="text-xs text-muted-foreground">Supports .xlsx, .xls, .csv</p>
                </div>
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileChange} />
              </div>

              {status === 'error' && results.errors.length > 0 && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                  {results.errors.map((e, i) => (
                    <p key={i} className="text-sm text-rose-700 flex items-center gap-2">
                      <Icon name="ExclamationCircleIcon" size={15} />
                      {e}
                    </p>
                  ))}
                </div>
              )}

              <div className="rounded-xl border border-border bg-muted/30 p-4 flex items-center gap-4">
                <div className="p-2 bg-emerald-100 rounded-lg flex-shrink-0">
                  <Icon name="DocumentArrowDownIcon" size={20} className="text-emerald-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-600 text-foreground">Download Import Template</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    One row per KPI entry. Multiple rows per staff member are merged into a single workplan.
                  </p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); downloadTemplate(); }}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-white text-sm font-600 hover:bg-muted transition-colors flex-shrink-0"
                >
                  <Icon name="ArrowDownTrayIcon" size={14} />
                  Template
                </button>
              </div>

              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-2">
                <p className="text-xs font-700 text-blue-800 flex items-center gap-1.5">
                  <Icon name="InformationCircleIcon" size={14} />
                  Expected Column Format
                </p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {[
                    { col: 'staff_name', req: true },
                    { col: 'job_title', req: false },
                    { col: 'directorate', req: false },
                    { col: 'supervisor_name', req: false },
                    { col: 'fiscal_year', req: false },
                    { col: 'perspective', req: true },
                    { col: 'key_work_objective', req: true },
                    { col: 'key_activities', req: false },
                    { col: 'kpi_measure', req: true },
                    { col: 'target', req: true },
                    { col: 'weight', req: false },
                  ].map(({ col, req }) => (
                    <div key={col} className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${req ? 'bg-rose-500' : 'bg-blue-400'}`} />
                      <code className="text-[11px] text-blue-900 font-mono">{col}</code>
                      {req && <span className="text-[10px] text-rose-600 font-600">required</span>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Parsing state */}
          {status === 'parsing' && (
            <div className="flex flex-col items-center justify-center py-16 space-y-3">
              <Icon name="EcsaRefreshIcon" size={32} className="text-primary animate-spin" />
              <p className="font-600 text-foreground">Parsing file…</p>
              <p className="text-sm text-muted-foreground">{fileName}</p>
            </div>
          )}

          {/* Validating state */}
          {status === 'validating' && (
            <div className="flex flex-col items-center justify-center py-16 space-y-3">
              <Icon name="EcsaRefreshIcon" size={32} className="text-primary animate-spin" />
              <p className="font-600 text-foreground">Validating staff records…</p>
            </div>
          )}

          {/* Conflict resolution state */}
          {status === 'conflict' && (
            <ConflictDialog
              conflicts={conflicts}
              onResolutionChange={handleResolutionChange}
              onApplyAll={handleApplyAll}
              onConfirm={handleConflictConfirm}
              onCancel={handleConflictCancel}
            />
          )}

          {/* Ready state — preview */}
          {status === 'ready' && (
            <div className="space-y-4">
              {/* Conflict summary banner (if any) */}
              {conflicts.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Icon name="EcsaWarningIcon" size={16} className="text-amber-600 flex-shrink-0" />
                    <p className="text-xs text-amber-800">
                      <span className="font-700">{conflicts.length} conflict{conflicts.length !== 1 ? 's' : ''}</span> resolved —{' '}
                      {conflicts.filter((c) => c.resolution === 'overwrite').length} overwrite,{' '}
                      {conflicts.filter((c) => c.resolution === 'merge').length} merge,{' '}
                      {conflicts.filter((c) => c.resolution === 'skip').length} skip
                    </p>
                  </div>
                  <button
                    onClick={() => setStatus('conflict')}
                    className="text-xs font-600 text-amber-700 underline hover:no-underline flex-shrink-0"
                  >
                    Edit
                  </button>
                </div>
              )}

              {/* Summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
                  <p className="text-2xl font-700 text-blue-700">{records.length}</p>
                  <p className="text-xs text-muted-foreground">Total Workplans</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                  <p className="text-2xl font-700 text-emerald-700">{validRecords.length}</p>
                  <p className="text-xs text-muted-foreground">Ready to Import</p>
                </div>
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-center">
                  <p className="text-2xl font-700 text-rose-700">{errorRecords.length}</p>
                  <p className="text-xs text-muted-foreground">With Errors</p>
                </div>
              </div>

              {/* File info */}
              <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-xl">
                <Icon name="DocumentTextIcon" size={18} className="text-muted-foreground" />
                <span className="text-sm text-foreground font-500 flex-1 truncate">{fileName}</span>
                <button onClick={reset} className="text-xs text-muted-foreground hover:text-foreground underline">
                  Change file
                </button>
              </div>

              {/* Records list */}
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {records.map((record, idx) => {
                  const key = `${record.staffName}::${record.fiscalYear}`;
                  const isExpanded = expandedRecord === key;
                  const hasErrors = record._errors.length > 0;
                  const hasWarnings = record._warnings.length > 0;
                  const conflict = conflicts.find((c) => c.record.staffName === record.staffName);

                  return (
                    <div
                      key={idx}
                      className={`rounded-xl border transition-colors ${
                        hasErrors
                          ? 'border-rose-200 bg-rose-50'
                          : hasWarnings
                          ? 'border-amber-200 bg-amber-50' :'border-emerald-200 bg-emerald-50'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedRecord(isExpanded ? null : key)}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left"
                      >
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${hasErrors ? 'bg-rose-500' : hasWarnings ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-600 text-foreground truncate">{record.staffName}</p>
                          <p className="text-xs text-muted-foreground">
                            {record.jobTitle || 'No job title'} · {record.fiscalYear} · {record.perspectivesObjectives.length} scorecard row{record.perspectivesObjectives.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {conflict && (
                            <span className={`text-[10px] font-700 px-2 py-0.5 rounded-full ${
                              conflict.resolution === 'overwrite' ?'text-rose-700 bg-rose-100'
                                : conflict.resolution === 'merge' ?'text-blue-700 bg-blue-100' :'text-slate-600 bg-slate-100'
                            }`}>
                              {conflict.resolution}
                            </span>
                          )}
                          {hasErrors && (
                            <span className="text-xs font-600 text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">
                              {record._errors.length} error{record._errors.length !== 1 ? 's' : ''}
                            </span>
                          )}
                          {hasWarnings && !hasErrors && !conflict && (
                            <span className="text-xs font-600 text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                              {record._warnings.length} warning{record._warnings.length !== 1 ? 's' : ''}
                            </span>
                          )}
                          {!hasErrors && !hasWarnings && !conflict && (
                            <span className="text-xs font-600 text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">Ready</span>
                          )}
                          <Icon name="ChevronDownIcon" size={14} className={`text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="px-4 pb-3 space-y-2 border-t border-border/40">
                          {record._errors.map((e, i) => (
                            <p key={i} className="text-xs text-rose-700 flex items-start gap-1.5 pt-2">
                              <Icon name="ExclamationCircleIcon" size={13} className="flex-shrink-0 mt-0.5" />
                              {e}
                            </p>
                          ))}
                          {record._warnings.map((w, i) => (
                            <p key={i} className="text-xs text-amber-700 flex items-start gap-1.5 pt-2">
                              <Icon name="EcsaWarningIcon" size={13} className="flex-shrink-0 mt-0.5" />
                              {w}
                            </p>
                          ))}
                          {record.perspectivesObjectives.length > 0 && (
                            <div className="pt-2 space-y-1">
                              <p className="text-[11px] font-700 text-muted-foreground uppercase tracking-wide">Scorecard Rows</p>
                              {record.perspectivesObjectives.map((row, ri) => (
                                <div key={ri} className="text-xs text-foreground bg-white/60 rounded-lg px-3 py-2">
                                  <span className="font-600">{row.perspective}</span>
                                  {row.objective && <span className="text-muted-foreground"> · {row.objective}</span>}
                                  {row.kpis.length > 0 && (
                                    <span className="text-muted-foreground"> · {row.kpis.length} KPI{row.kpis.length !== 1 ? 's' : ''}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {status === 'ready' && (
          <div className="px-6 py-4 border-t border-border flex items-center justify-between gap-3 flex-shrink-0">
            <p className="text-xs text-muted-foreground">
              {validRecords.length} of {records.length} workplan{records.length !== 1 ? 's' : ''} will be imported
              {errorRecords.length > 0 && ` · ${errorRecords.length} skipped due to errors`}
            </p>
            <div className="flex gap-3">
              <button onClick={onClose} className="px-4 py-2 rounded-xl border border-border text-sm font-500 hover:bg-muted">
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={validRecords.length === 0}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-primary text-white text-sm font-600 hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                <Icon name="ArrowUpTrayIcon" size={15} />
                Import {validRecords.length} Workplan{validRecords.length !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
