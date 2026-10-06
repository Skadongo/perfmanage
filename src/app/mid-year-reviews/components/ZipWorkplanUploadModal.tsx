'use client';

import React, { useState, useRef, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';

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

interface ParsedWorkplanRecord {
  fileName: string;
  staffName: string;
  jobTitle: string;
  directorate: string;
  supervisorName: string;
  fiscalYear: string;
  reviewYear: number;
  perspectivesObjectives: PerspectiveRow[];
  generalCompetencies: Competency[];
  supportRequired: string;
  // resolution state
  _staffId?: string | null;
  _supervisorId?: string | null;
  _existingWorkplanId?: string | null;
  _errors: string[];
  _warnings: string[];
  _parseConfidence: 'high' | 'medium' | 'low';
}

type ConflictResolution = 'overwrite' | 'merge' | 'skip';

interface ConflictState {
  record: ParsedWorkplanRecord;
  existingId: string;
  resolution: ConflictResolution;
}

type UploadStep = 'idle' | 'extracting' | 'parsing' | 'validating' | 'preview' | 'conflict' | 'importing' | 'done' | 'error';

interface ZipWorkplanUploadModalProps {
  onClose: () => void;
  onImportComplete: (count: number) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_COMPETENCIES: Competency[] = [
  { id: 'c1', name: 'Teamwork', description: 'Creates a culture of teamwork and responds rationally to feedback.', weight: 3 },
  { id: 'c2', name: 'Respect for Diversity', description: 'Values individual differences and promotes a peaceful work environment.', weight: 3 },
  { id: 'c3', name: 'Integrity', description: 'Reliable, meets all deadlines, and takes credit only for own work.', weight: 3 },
  { id: 'c4', name: 'Communication', description: 'Explains complex issues clearly and uses visual aids effectively.', weight: 3 },
  { id: 'c5', name: 'Results Oriented', description: 'Prioritizes activities and matches tasks with team capabilities.', weight: 3 },
  { id: 'c6', name: 'Innovation', description: 'Thinks "outside the box" to foster team creativity.', weight: 3 },
  { id: 'c7', name: 'Leadership (GS3+)', description: 'Acts as a role model and provides timely specific feedback to staff.', weight: 2 },
];

const PERSPECTIVES = [
  'Financial/Stewardship',
  'Customer/Stakeholder',
  'Internal Business Processes',
  'Innovation Learning & Growth',
];

const FISCAL_YEAR_OPTIONS = [
  'FY 2026-2027 (Jul–Jun)',
  'FY 2025-2026 (Jul–Jun)',
  'FY 2024-2025 (Jul–Jun)',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function extractFiscalYear(text: string, defaultFY: string): string {
  const fyMatch = text.match(/FY\s*(\d{4})[–\-](\d{4})/i);
  if (fyMatch) return `FY ${fyMatch[1]}-${fyMatch[2]} (Jul–Jun)`;
  const yearMatch = text.match(/20(2[4-9]|3[0-9])[–\-]20(2[5-9]|3[0-9])/);
  if (yearMatch) return `FY ${yearMatch[0].replace(/[–\-]/, '-')} (Jul–Jun)`;
  return defaultFY;
}

function extractStaffName(text: string, fileName: string): string {
  // Try "Name: JOHN DOE" or "Employee: JOHN DOE" patterns
  const namePatterns = [
    /(?:name|employee|staff)[:\s]+([A-Z][A-Z\s]{3,40})/i,
    /(?:prepared by|submitted by)[:\s]+([A-Z][A-Z\s]{3,40})/i,
  ];
  for (const pattern of namePatterns) {
    const m = text.match(pattern);
    if (m) return m[1].trim().toUpperCase();
  }
  // Fall back to filename: "John_Doe_workplan.pdf" → "JOHN DOE"
  const base = fileName.replace(/\.pdf$/i, '').replace(/[_\-]/g, ' ').replace(/workplan|performance|contract|ecsa|hc|individual/gi, '').trim();
  if (base.length > 3) return base.toUpperCase();
  return 'UNKNOWN STAFF';
}

function extractJobTitle(text: string): string {
  const m = text.match(/(?:job title|position|designation|title)[:\s]+([^\n]{5,60})/i);
  return m ? m[1].trim() : '';
}

function extractDirectorate(text: string): string {
  const m = text.match(/(?:directorate|department|cluster|division)[:\s]+([^\n]{3,60})/i);
  return m ? m[1].trim() : '';
}

function extractSupervisor(text: string): string {
  const m = text.match(/(?:supervisor|reporting to|line manager|appraiser)[:\s]+([A-Z][A-Za-z\s\.]{3,60})/i);
  return m ? m[1].trim().toUpperCase() : '';
}

function extractSupportRequired(text: string): string {
  const m = text.match(/(?:support required|resources needed|support needed)[:\s]+([^\n]{5,300})/i);
  return m ? m[1].trim() : '';
}

/**
 * Parse PDF text into structured perspective rows.
 * Looks for BSC perspective headers and extracts objectives/KPIs below them.
 */
function parsePerspectiveRows(text: string): PerspectiveRow[] {
  const rows: PerspectiveRow[] = [];
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  let currentPerspective = '';
  let currentObjective = '';
  let currentActivities = '';
  let currentKPIs: KPIEntry[] = [];
  let currentWeight = 3;

  const flushRow = () => {
    if (currentPerspective && currentObjective) {
      rows.push({
        id: uid(),
        perspective: currentPerspective,
        objective: currentObjective,
        keyActivities: currentActivities,
        kpis: currentKPIs.length > 0 ? currentKPIs : [{ id: uid(), label: currentObjective, target: '' }],
        weight: currentWeight,
      });
    }
    currentObjective = '';
    currentActivities = '';
    currentKPIs = [];
    currentWeight = 3;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect perspective headers
    const perspNorm = normalisePerspective(line);
    if (PERSPECTIVES.includes(perspNorm) && line.length < 80) {
      flushRow();
      currentPerspective = perspNorm;
      continue;
    }

    if (!currentPerspective) continue;

    // Detect objective lines (numbered or after "Objective:" keyword)
    const objMatch = line.match(/^(?:\d+[\.\)]\s+|objective[:\s]+)(.{10,})/i);
    if (objMatch) {
      flushRow();
      currentObjective = objMatch[1].trim();
      continue;
    }

    // Detect KPI / measure lines
    const kpiMatch = line.match(/(?:kpi|measure|indicator|target)[:\s]+(.{5,})/i);
    if (kpiMatch && currentObjective) {
      currentKPIs.push({ id: uid(), label: kpiMatch[1].trim(), target: '' });
      continue;
    }

    // Detect target lines
    const targetMatch = line.match(/^target[:\s]+(.{2,})/i);
    if (targetMatch && currentKPIs.length > 0) {
      currentKPIs[currentKPIs.length - 1].target = targetMatch[1].trim();
      continue;
    }

    // Detect weight
    const weightMatch = line.match(/weight[:\s]+(\d)/i);
    if (weightMatch) {
      currentWeight = Math.min(5, Math.max(1, parseInt(weightMatch[1], 10)));
      continue;
    }

    // Detect key activities
    const actMatch = line.match(/(?:key activities|activities)[:\s]+(.{5,})/i);
    if (actMatch && currentObjective) {
      currentActivities = actMatch[1].trim();
      continue;
    }
  }

  flushRow();
  return rows;
}

/**
 * Parse raw PDF text into a structured workplan record.
 */
function parsePDFText(text: string, fileName: string, defaultFY: string): Omit<ParsedWorkplanRecord, '_staffId' | '_supervisorId' | '_existingWorkplanId'> {
  const staffName = extractStaffName(text, fileName);
  const jobTitle = extractJobTitle(text);
  const directorate = extractDirectorate(text);
  const supervisorName = extractSupervisor(text);
  const fiscalYear = extractFiscalYear(text, defaultFY);
  const reviewYear = fiscalYear.includes('2026') ? 2026 : fiscalYear.includes('2025') ? 2025 : 2026;
  const supportRequired = extractSupportRequired(text);
  const perspectivesObjectives = parsePerspectiveRows(text);

  const errors: string[] = [];
  const warnings: string[] = [];

  if (staffName === 'UNKNOWN STAFF') errors.push('Could not extract staff name from PDF');
  if (perspectivesObjectives.length === 0) warnings.push('No scorecard rows detected — workplan will be saved with empty objectives');
  if (!jobTitle) warnings.push('Job title not found in PDF');
  if (!supervisorName) warnings.push('Supervisor name not found in PDF');

  const confidence: 'high' | 'medium' | 'low' =
    errors.length === 0 && perspectivesObjectives.length > 0 && jobTitle ? 'high'
    : errors.length === 0 ? 'medium' :'low';

  return {
    fileName,
    staffName,
    jobTitle,
    directorate,
    supervisorName,
    fiscalYear,
    reviewYear,
    perspectivesObjectives,
    generalCompetencies: DEFAULT_COMPETENCIES.map((c) => ({ ...c })),
    supportRequired,
    _errors: errors,
    _warnings: warnings,
    _parseConfidence: confidence,
  };
}

// ─── Merge helper ─────────────────────────────────────────────────────────────

function mergePerspectiveRows(existing: PerspectiveRow[], incoming: PerspectiveRow[]): PerspectiveRow[] {
  const merged = existing.map((r) => ({ ...r, kpis: [...r.kpis] }));
  for (const inc of incoming) {
    const match = merged.find((r) => r.perspective === inc.perspective && r.objective === inc.objective);
    if (match) {
      for (const kpi of inc.kpis) {
        if (!match.kpis.some((k) => k.label === kpi.label)) match.kpis.push({ ...kpi });
      }
    } else {
      merged.push({ ...inc, kpis: [...inc.kpis] });
    }
  }
  return merged;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface ProgressBarProps { value: number; label: string }
function ProgressBar({ value, label }: ProgressBarProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-300"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

interface RecordCardProps {
  record: ParsedWorkplanRecord;
  index: number;
  expanded: boolean;
  onToggle: () => void;
}
function RecordCard({ record, index, expanded, onToggle }: RecordCardProps) {
  const confidenceColor =
    record._parseConfidence === 'high' ? 'text-emerald-700 bg-emerald-100'
    : record._parseConfidence === 'medium'? 'text-amber-700 bg-amber-100' :'text-rose-700 bg-rose-100';

  const hasIssues = record._errors.length > 0 || record._warnings.length > 0;

  return (
    <div className={`rounded-xl border ${record._errors.length > 0 ? 'border-rose-200 bg-rose-50/30' : 'border-border bg-white'} overflow-hidden`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/30 transition-colors"
      >
        <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-[11px] font-700 flex items-center justify-center flex-shrink-0">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-600 text-foreground truncate">{record.staffName}</p>
          <p className="text-xs text-muted-foreground truncate">{record.jobTitle || 'No job title'} · {record.fiscalYear}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {hasIssues && (
            <span className={`text-[10px] font-700 px-2 py-0.5 rounded-full ${record._errors.length > 0 ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
              {record._errors.length > 0 ? `${record._errors.length} error${record._errors.length > 1 ? 's' : ''}` : `${record._warnings.length} warning${record._warnings.length > 1 ? 's' : ''}`}
            </span>
          )}
          <span className={`text-[10px] font-700 px-2 py-0.5 rounded-full ${confidenceColor}`}>
            {record._parseConfidence} confidence
          </span>
          <Icon name={expanded ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={14} className="text-muted-foreground" />
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border/50">
          {/* Staff info grid */}
          <div className="grid grid-cols-2 gap-2 pt-3">
            {[
              { label: 'File', value: record.fileName },
              { label: 'Supervisor', value: record.supervisorName || '—' },
              { label: 'Directorate', value: record.directorate || '—' },
              { label: 'Fiscal Year', value: record.fiscalYear },
            ].map(({ label, value }) => (
              <div key={label} className="p-2.5 rounded-lg bg-muted/40 border border-border/50">
                <p className="text-[10px] font-600 text-muted-foreground uppercase tracking-wide mb-0.5">{label}</p>
                <p className="text-xs font-500 text-foreground truncate">{value}</p>
              </div>
            ))}
          </div>

          {/* Errors / warnings */}
          {record._errors.map((e, i) => (
            <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-rose-50 border border-rose-200">
              <Icon name="ExclamationCircleIcon" size={14} className="text-rose-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-rose-700">{e}</p>
            </div>
          ))}
          {record._warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200">
              <Icon name="EcsaWarningIcon" size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">{w}</p>
            </div>
          ))}

          {/* Scorecard rows */}
          {record.perspectivesObjectives.length > 0 && (
            <div>
              <p className="text-[10px] font-700 uppercase tracking-wide text-muted-foreground mb-1.5">
                Scorecard ({record.perspectivesObjectives.length} row{record.perspectivesObjectives.length !== 1 ? 's' : ''})
              </p>
              <div className="space-y-1.5">
                {record.perspectivesObjectives.slice(0, 4).map((row) => (
                  <div key={row.id} className="flex items-start gap-2 p-2.5 rounded-lg border border-border bg-white">
                    <span className="text-[10px] font-600 text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5">
                      {row.perspective.split('/')[0]}
                    </span>
                    <p className="text-xs text-foreground leading-snug">{row.objective}</p>
                    <span className="text-[10px] font-700 text-muted-foreground bg-muted px-1.5 py-0.5 rounded flex-shrink-0">W:{row.weight}</span>
                  </div>
                ))}
                {record.perspectivesObjectives.length > 4 && (
                  <p className="text-[11px] text-muted-foreground pl-1">+{record.perspectivesObjectives.length - 4} more rows…</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Conflict Dialog ──────────────────────────────────────────────────────────

interface ConflictDialogProps {
  conflicts: ConflictState[];
  onResolutionChange: (staffName: string, resolution: ConflictResolution) => void;
  onApplyAll: (resolution: ConflictResolution) => void;
  onConfirm: () => void;
  onBack: () => void;
}

function ConflictDialog({ conflicts, onResolutionChange, onApplyAll, onConfirm, onBack }: ConflictDialogProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
        <div className="p-1.5 bg-amber-100 rounded-lg flex-shrink-0 mt-0.5">
          <Icon name="EcsaWarningIcon" size={18} className="text-amber-600" />
        </div>
        <div>
          <p className="text-sm font-700 text-amber-800">
            {conflicts.length} Conflict{conflicts.length !== 1 ? 's' : ''} Detected
          </p>
          <p className="text-xs text-amber-700 mt-0.5">
            These staff members already have a workplan for the selected fiscal year. Choose how to handle each.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground font-600 mr-1">Apply to all:</span>
        {(['overwrite', 'merge', 'skip'] as ConflictResolution[]).map((res) => (
          <button
            key={res}
            onClick={() => onApplyAll(res)}
            className={`px-3 py-1 rounded-lg text-xs font-600 border transition-colors ${
              res === 'overwrite' ? 'border-rose-300 text-rose-700 hover:bg-rose-50'
              : res === 'merge'? 'border-blue-300 text-blue-700 hover:bg-blue-50' :'border-slate-300 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {res.charAt(0).toUpperCase() + res.slice(1)} All
          </button>
        ))}
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
        {conflicts.map((conflict) => (
          <div key={conflict.record.staffName} className="rounded-xl border border-border bg-white p-4 space-y-3">
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
            <div className="grid grid-cols-3 gap-2">
              {(['overwrite', 'merge', 'skip'] as ConflictResolution[]).map((res) => (
                <button
                  key={res}
                  onClick={() => onResolutionChange(conflict.record.staffName, res)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-center transition-all ${
                    conflict.resolution === res
                      ? res === 'overwrite' ? 'border-rose-500 bg-rose-50'
                        : res === 'merge'? 'border-blue-500 bg-blue-50' :'border-slate-500 bg-slate-50' :'border-border hover:border-muted-foreground/30'
                  }`}
                >
                  <Icon
                    name={res === 'overwrite' ? 'ArrowPathIcon' : res === 'merge' ? 'DocumentDuplicateIcon' : 'MinusCircleIcon'}
                    size={15}
                    className={
                      conflict.resolution === res
                        ? res === 'overwrite' ? 'text-rose-600' : res === 'merge' ? 'text-blue-600' : 'text-slate-600' :'text-muted-foreground'
                    }
                  />
                  <span className={`text-xs font-700 ${
                    conflict.resolution === res
                      ? res === 'overwrite' ? 'text-rose-700' : res === 'merge' ? 'text-blue-700' : 'text-slate-700' :'text-foreground'
                  }`}>
                    {res.charAt(0).toUpperCase() + res.slice(1)}
                  </span>
                  <span className="text-[10px] text-muted-foreground leading-tight">
                    {res === 'overwrite' ? 'Replace existing' : res === 'merge' ? 'Add new rows' : 'Keep existing'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-3 pt-1">
        <button onClick={onBack} className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm font-500 hover:bg-muted">
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

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ZipWorkplanUploadModal({ onClose, onImportComplete }: ZipWorkplanUploadModalProps) {
  const [step, setStep] = useState<UploadStep>('idle');
  const [dragOver, setDragOver] = useState(false);
  const [zipFileName, setZipFileName] = useState('');
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [records, setRecords] = useState<ParsedWorkplanRecord[]>([]);
  const [conflicts, setConflicts] = useState<ConflictState[]>([]);
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null);
  const [defaultFiscalYear, setDefaultFiscalYear] = useState('FY 2026-2027 (Jul–Jun)');
  const [results, setResults] = useState<{ inserted: number; skipped: number; errors: string[] }>({ inserted: 0, skipped: 0, errors: [] });
  const [errorMessage, setErrorMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const validRecords = records.filter((r) => r._errors.length === 0);
  const errorRecords = records.filter((r) => r._errors.length > 0);

  // ── Extract + parse ZIP ──────────────────────────────────────────────────────

  const processZip = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.zip')) {
      setErrorMessage('Please upload a ZIP file containing PDF workplans.');
      setStep('error');
      return;
    }

    setZipFileName(file.name);
    setStep('extracting');
    setProgress(5);
    setProgressLabel('Loading ZIP file…');

    try {
      // Dynamic import to avoid SSR issues
      const JSZip = (await import('jszip')).default;
      const zip = await JSZip.loadAsync(await file.arrayBuffer());

      const pdfEntries = Object.entries(zip.files).filter(
        ([name, entry]) => !entry.dir && name.toLowerCase().endsWith('.pdf') && !name.startsWith('__MACOSX')
      );

      if (pdfEntries.length === 0) {
        setErrorMessage('No PDF files found inside the ZIP archive.');
        setStep('error');
        return;
      }

      setProgress(15);
      setProgressLabel(`Found ${pdfEntries.length} PDF file${pdfEntries.length !== 1 ? 's' : ''}. Parsing…`);
      setStep('parsing');

      // Dynamically import pdfjs-dist
      const pdfjsLib = await import('pdfjs-dist');
      // Use a CDN worker to avoid bundling issues
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

      const parsed: ParsedWorkplanRecord[] = [];
      const total = pdfEntries.length;

      for (let i = 0; i < total; i++) {
        const [entryName, entry] = pdfEntries[i];
        const fileName = entryName.split('/').pop() || entryName;
        setProgressLabel(`Parsing ${i + 1}/${total}: ${fileName}`);
        setProgress(15 + Math.round(((i + 1) / total) * 50));

        try {
          const pdfBuffer = await entry.async('arraybuffer');
          const pdfDoc = await pdfjsLib.getDocument({ data: pdfBuffer }).promise;
          let fullText = '';

          for (let p = 1; p <= pdfDoc.numPages; p++) {
            const page = await pdfDoc.getPage(p);
            const textContent = await page.getTextContent();
            fullText += textContent.items.map((item: { str?: string }) => item.str ?? '').join(' ') + '\n';
          }

          const record = parsePDFText(fullText, fileName, defaultFiscalYear);
          parsed.push({ ...record, _staffId: null, _supervisorId: null, _existingWorkplanId: null });
        } catch {
          parsed.push({
            fileName,
            staffName: fileName.replace(/\.pdf$/i, '').replace(/[_\-]/g, ' ').toUpperCase(),
            jobTitle: '',
            directorate: '',
            supervisorName: '',
            fiscalYear: defaultFiscalYear,
            reviewYear: 2026,
            perspectivesObjectives: [],
            generalCompetencies: DEFAULT_COMPETENCIES.map((c) => ({ ...c })),
            supportRequired: '',
            _staffId: null,
            _supervisorId: null,
            _existingWorkplanId: null,
            _errors: [`Failed to parse PDF: ${fileName}`],
            _warnings: [],
            _parseConfidence: 'low',
          });
        }
      }

      // ── Validate against staff table ─────────────────────────────────────────
      setStep('validating');
      setProgress(70);
      setProgressLabel('Matching staff records…');

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
          record._warnings.push(`Staff "${record.staffName}" not found in system — will be saved without staff_id link`);
        }

        if (record.supervisorName) {
          const supEntry = staffMap.get(record.supervisorName);
          record._supervisorId = supEntry?.id || null;
        }
      }

      // ── Conflict detection ───────────────────────────────────────────────────
      setProgress(85);
      setProgressLabel('Checking for existing workplans…');

      const conflictList: ConflictState[] = [];
      for (const record of parsed) {
        if (!record._staffId) continue;
        const { data: existing } = await supabase
          .from('workplan_settings')
          .select('id')
          .eq('staff_id', record._staffId)
          .eq('fiscal_year', record.fiscalYear)
          .maybeSingle();

        if (existing) {
          record._existingWorkplanId = existing.id;
          conflictList.push({ record, existingId: existing.id, resolution: 'overwrite' });
        }
      }

      setProgress(100);
      setRecords(parsed);
      setConflicts(conflictList);

      if (conflictList.length > 0) {
        setStep('conflict');
      } else {
        setStep('preview');
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to process ZIP file.');
      setStep('error');
    }
  }, [defaultFiscalYear, supabase]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processZip(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processZip(file);
  };

  // ── Conflict resolution ──────────────────────────────────────────────────────

  const handleResolutionChange = (staffName: string, resolution: ConflictResolution) => {
    setConflicts((prev) => prev.map((c) => c.record.staffName === staffName ? { ...c, resolution } : c));
  };

  const handleApplyAll = (resolution: ConflictResolution) => {
    setConflicts((prev) => prev.map((c) => ({ ...c, resolution })));
  };

  // ── Import ───────────────────────────────────────────────────────────────────

  const handleImport = async () => {
    setStep('importing');
    setProgress(0);

    const conflictMap = new Map<string, ConflictResolution>(
      conflicts.map((c) => [c.record.staffName, c.resolution])
    );

    let inserted = 0;
    let skipped = 0;
    const errors: string[] = [];
    const toProcess = validRecords;

    for (let i = 0; i < toProcess.length; i++) {
      const record = toProcess[i];
      setProgress(Math.round(((i + 1) / toProcess.length) * 100));
      setProgressLabel(`Saving ${i + 1}/${toProcess.length}: ${record.staffName}`);

      const resolution = conflictMap.get(record.staffName) ?? null;

      try {
        if (record._existingWorkplanId && resolution === 'skip') {
          skipped++;
          continue;
        }

        const payload = {
          staff_id: record._staffId || null,
          supervisor_id: record._supervisorId || null,
          fiscal_year: record.fiscalYear,
          review_year: record.reviewYear,
          perspectives_objectives: record.perspectivesObjectives,
          general_competencies: record.generalCompetencies,
          status: 'draft',
          workflow_stage: 'workplan_pending',
          source: 'zip_pdf_import',
        };

        if (record._existingWorkplanId && resolution === 'overwrite') {
          const { error } = await supabase
            .from('workplan_settings')
            .update({ ...payload, updated_at: new Date().toISOString() })
            .eq('id', record._existingWorkplanId);
          if (error) throw error;
          inserted++;
        } else if (record._existingWorkplanId && resolution === 'merge') {
          // Fetch existing rows and merge
          const { data: existing } = await supabase
            .from('workplan_settings')
            .select('perspectives_objectives')
            .eq('id', record._existingWorkplanId)
            .single();

          const existingRows: PerspectiveRow[] = existing?.perspectives_objectives || [];
          const mergedRows = mergePerspectiveRows(existingRows, record.perspectivesObjectives);

          const { error } = await supabase
            .from('workplan_settings')
            .update({ perspectives_objectives: mergedRows, updated_at: new Date().toISOString() })
            .eq('id', record._existingWorkplanId);
          if (error) throw error;
          inserted++;
        } else {
          // New insert
          const { error } = await supabase
            .from('workplan_settings')
            .insert(payload);
          if (error) throw error;
          inserted++;
        }
      } catch (err) {
        errors.push(`${record.staffName}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    setResults({ inserted, skipped, errors });
    setStep('done');
    if (inserted > 0) onImportComplete(inserted);
  };

  // ── Reset ────────────────────────────────────────────────────────────────────

  const handleReset = () => {
    setStep('idle');
    setRecords([]);
    setConflicts([]);
    setProgress(0);
    setProgressLabel('');
    setZipFileName('');
    setErrorMessage('');
    setExpandedRecord(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-gradient-to-r from-violet-50 to-sky-50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
              <Icon name="ArchiveBoxArrowDownIcon" size={22} className="text-violet-600" />
            </div>
            <div>
              <h2 className="text-base font-700 text-foreground">Bulk ZIP Workplan Import</h2>
              <p className="text-xs text-muted-foreground">Upload a ZIP containing staff PDF workplans</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted/60 text-muted-foreground transition-colors">
            <Icon name="XMarkIcon" size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* ── IDLE: Upload zone ── */}
          {step === 'idle' && (
            <div className="space-y-5">
              {/* Fiscal year selector */}
              <div>
                <label className="block text-xs font-600 text-foreground mb-1.5">Default Fiscal Year</label>
                <select
                  value={defaultFiscalYear}
                  onChange={(e) => setDefaultFiscalYear(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {FISCAL_YEAR_OPTIONS.map((fy) => (
                    <option key={fy} value={fy}>{fy}</option>
                  ))}
                </select>
                <p className="text-[11px] text-muted-foreground mt-1">Used when fiscal year cannot be extracted from a PDF</p>
              </div>

              {/* Drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative flex flex-col items-center justify-center gap-4 p-10 rounded-2xl border-2 border-dashed cursor-pointer transition-all ${
                  dragOver ? 'border-violet-400 bg-violet-50' : 'border-border hover:border-violet-300 hover:bg-violet-50/40'
                }`}
              >
                <div className="w-16 h-16 rounded-2xl bg-violet-100 flex items-center justify-center">
                  <Icon name="ArchiveBoxArrowDownIcon" size={32} className="text-violet-500" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-600 text-foreground">Drop your ZIP file here</p>
                  <p className="text-xs text-muted-foreground mt-1">or click to browse · ZIP containing PDF workplans</p>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1"><Icon name="DocumentIcon" size={12} className="text-rose-500" /> PDF files inside ZIP</span>
                  <span>·</span>
                  <span className="flex items-center gap-1"><Icon name="ArchiveBoxIcon" size={12} className="text-violet-500" /> .zip format</span>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".zip"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              {/* How it works */}
              <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2">
                <p className="text-xs font-700 text-foreground">How it works</p>
                {[
                  { icon: 'ArchiveBoxArrowDownIcon', text: 'ZIP is extracted in your browser — files never leave your device until saved' },
                  { icon: 'DocumentMagnifyingGlassIcon', text: 'Each PDF is parsed for staff name, objectives, KPIs, and fiscal year' },
                  { icon: 'UserGroupIcon', text: 'Staff records are matched against the system database' },
                  { icon: 'ClipboardDocumentCheckIcon', text: 'Preview all records, resolve conflicts, then save to database' },
                ].map(({ icon, text }, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <div className="w-5 h-5 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-[10px] font-700 text-violet-700">{i + 1}</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-snug">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── EXTRACTING / PARSING / VALIDATING: Progress ── */}
          {(step === 'extracting' || step === 'parsing' || step === 'validating') && (
            <div className="flex flex-col items-center justify-center py-12 space-y-6">
              <div className="w-16 h-16 rounded-2xl bg-violet-100 flex items-center justify-center">
                <Icon name="ArrowPathIcon" size={28} className="text-violet-500 animate-spin" />
              </div>
              <div className="w-full max-w-sm space-y-3">
                <ProgressBar value={progress} label={progressLabel || 'Processing…'} />
                <p className="text-xs text-center text-muted-foreground">{zipFileName}</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {step === 'extracting' && <><Icon name="ArchiveBoxArrowDownIcon" size={14} className="text-violet-500" /> Extracting ZIP…</>}
                {step === 'parsing' && <><Icon name="DocumentMagnifyingGlassIcon" size={14} className="text-violet-500" /> Parsing PDF content…</>}
                {step === 'validating' && <><Icon name="UserGroupIcon" size={14} className="text-violet-500" /> Matching staff records…</>}
              </div>
            </div>
          )}

          {/* ── CONFLICT ── */}
          {step === 'conflict' && (
            <ConflictDialog
              conflicts={conflicts}
              onResolutionChange={handleResolutionChange}
              onApplyAll={handleApplyAll}
              onConfirm={() => setStep('preview')}
              onBack={handleReset}
            />
          )}

          {/* ── PREVIEW ── */}
          {step === 'preview' && (
            <div className="space-y-4">
              {/* Summary banner */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
                  <p className="text-xl font-800 text-emerald-700">{validRecords.length}</p>
                  <p className="text-[11px] text-emerald-600 font-600">Ready to import</p>
                </div>
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-center">
                  <p className="text-xl font-800 text-amber-700">{conflicts.length}</p>
                  <p className="text-[11px] text-amber-600 font-600">Conflicts</p>
                </div>
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-center">
                  <p className="text-xl font-800 text-rose-700">{errorRecords.length}</p>
                  <p className="text-[11px] text-rose-600 font-600">Parse errors</p>
                </div>
              </div>

              {/* Record list */}
              <div className="space-y-2">
                {records.map((record, i) => (
                  <RecordCard
                    key={record.fileName + i}
                    record={record}
                    index={i}
                    expanded={expandedRecord === record.fileName + i}
                    onToggle={() => setExpandedRecord(expandedRecord === record.fileName + i ? null : record.fileName + i)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── IMPORTING ── */}
          {step === 'importing' && (
            <div className="flex flex-col items-center justify-center py-12 space-y-6">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Icon name="ArrowUpTrayIcon" size={28} className="text-primary animate-pulse" />
              </div>
              <div className="w-full max-w-sm space-y-3">
                <ProgressBar value={progress} label={progressLabel || 'Saving to database…'} />
              </div>
            </div>
          )}

          {/* ── DONE ── */}
          {step === 'done' && (
            <div className="flex flex-col items-center justify-center py-10 space-y-5">
              <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center">
                <Icon name="CheckCircleIcon" size={32} className="text-emerald-600" />
              </div>
              <div className="text-center">
                <p className="text-base font-700 text-foreground">Import Complete</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {results.inserted} workplan{results.inserted !== 1 ? 's' : ''} saved successfully
                  {results.skipped > 0 && `, ${results.skipped} skipped`}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
                  <p className="text-xl font-800 text-emerald-700">{results.inserted}</p>
                  <p className="text-[11px] text-emerald-600 font-600">Saved</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                  <p className="text-xl font-800 text-slate-700">{results.skipped}</p>
                  <p className="text-[11px] text-slate-600 font-600">Skipped</p>
                </div>
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-center">
                  <p className="text-xl font-800 text-rose-700">{results.errors.length}</p>
                  <p className="text-[11px] text-rose-600 font-600">Errors</p>
                </div>
              </div>
              {results.errors.length > 0 && (
                <div className="w-full space-y-1.5 max-h-32 overflow-y-auto">
                  {results.errors.map((e, i) => (
                    <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-rose-50 border border-rose-200">
                      <Icon name="ExclamationCircleIcon" size={13} className="text-rose-600 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-rose-700">{e}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── ERROR ── */}
          {step === 'error' && (
            <div className="flex flex-col items-center justify-center py-10 space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-rose-100 flex items-center justify-center">
                <Icon name="ExclamationCircleIcon" size={32} className="text-rose-600" />
              </div>
              <div className="text-center">
                <p className="text-base font-700 text-foreground">Upload Failed</p>
                <p className="text-sm text-muted-foreground mt-1">{errorMessage}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-border bg-muted/20 flex-shrink-0">
          {step === 'idle' && (
            <button onClick={onClose} className="px-5 py-2.5 rounded-xl border border-border text-sm font-500 hover:bg-muted">
              Cancel
            </button>
          )}

          {(step === 'extracting' || step === 'parsing' || step === 'validating' || step === 'importing') && (
            <p className="text-xs text-muted-foreground">Please wait…</p>
          )}

          {step === 'preview' && (
            <>
              <button onClick={handleReset} className="px-5 py-2.5 rounded-xl border border-border text-sm font-500 hover:bg-muted">
                Upload Different File
              </button>
              <button
                onClick={handleImport}
                disabled={validRecords.length === 0}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-600 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Icon name="ArrowUpTrayIcon" size={15} />
                Import {validRecords.length} Workplan{validRecords.length !== 1 ? 's' : ''}
              </button>
            </>
          )}

          {(step === 'done' || step === 'error') && (
            <>
              {step === 'error' && (
                <button onClick={handleReset} className="px-5 py-2.5 rounded-xl border border-border text-sm font-500 hover:bg-muted">
                  Try Again
                </button>
              )}
              <button onClick={onClose} className="ml-auto px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-600 hover:bg-primary/90">
                Close
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
