'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BulkRow {
  rowNum: number;
  staffName: string;
  fiscalYear: string;
  perspective: string;
  objective: string;
  kpis: string;          // pipe-separated list
  weight: number;
  keyActivities: string;
  errors: string[];
  status: 'valid' | 'error' | 'saved' | 'skipped';
}

interface StaffOption {
  id: string;
  full_name: string;
  supervisor_id: string | null;
  supervisor_name: string | null;
  job_title: string;
}

interface WorkplanBulkUploadProps {
  onClose: () => void;
  onComplete: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const VALID_PERSPECTIVES = [
  'Financial/Stewardship',
  'Customer/Stakeholder',
  'Internal Business Processes',
  'Innovation Learning & Growth',
];

const FISCAL_YEARS = ['FY 2024-2025', 'FY 2025-2026', 'FY 2026-2027'];

const TEMPLATE_HEADERS = [
  'Staff Name',
  'Fiscal Year',
  'BSC Perspective',
  'Objective / Goal Statement',
  'KPIs (pipe-separated)',
  'Weight (1-5)',
  'Key Activities',
];

const TEMPLATE_EXAMPLE_ROWS = [
  [
    'Jane Doe',
    'FY 2025-2026',
    'Financial/Stewardship',
    'Strengthen financial sustainability',
    'Budget Variance (≤5%)|Cost Recovery Rate (10%)',
    '4',
    'Monthly budget reviews; quarterly variance reports',
  ],
  [
    'Jane Doe',
    'FY 2025-2026',
    'Customer/Stakeholder',
    'Improve stakeholder engagement',
    'Stakeholder Satisfaction Index|No. of partnerships formalised',
    '3',
    'Quarterly stakeholder meetings; partnership MoUs',
  ],
];

// ─── Template Download ────────────────────────────────────────────────────────

async function downloadTemplate() {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();

  // Instructions sheet
  const instructions = [
    ['ECSA-HC Workplan Bulk Upload Template'],
    [''],
    ['Instructions:'],
    ['1. Fill in one row per BSC objective per staff member.'],
    ['2. Staff Name must match exactly as in the system.'],
    ['3. BSC Perspective must be one of: ' + VALID_PERSPECTIVES.join(' | ')],
    ['4. KPIs: separate multiple KPIs with a pipe character |'],
    ['5. Weight: integer between 1 and 5 per objective row.'],
    ['6. Total weight per staff per fiscal year should not exceed 80.'],
    ['7. Do not modify column headers in the Data sheet.'],
  ];
  const wsInstr = XLSX.utils.aoa_to_sheet(instructions);
  XLSX.utils.book_append_sheet(wb, wsInstr, 'Instructions');

  // Data sheet
  const wsData = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, ...TEMPLATE_EXAMPLE_ROWS]);
  // Column widths
  wsData['!cols'] = [
    { wch: 25 }, { wch: 16 }, { wch: 32 }, { wch: 45 },
    { wch: 55 }, { wch: 10 }, { wch: 45 },
  ];
  XLSX.utils.book_append_sheet(wb, wsData, 'Workplan Data');

  XLSX.writeFile(wb, 'ECSA-HC_Workplan_Bulk_Upload_Template.xlsx');
}

// ─── Row Validation ───────────────────────────────────────────────────────────

function validateRow(raw: Record<string, string>, rowNum: number, staffList: StaffOption[]): BulkRow {
  const errors: string[] = [];

  const staffName = (raw['Staff Name'] || '').trim();
  const fiscalYear = (raw['Fiscal Year'] || '').trim();
  const perspective = (raw['BSC Perspective'] || '').trim();
  const objective = (raw['Objective / Goal Statement'] || '').trim();
  const kpisRaw = (raw['KPIs (pipe-separated)'] || '').trim();
  const weightRaw = (raw['Weight (1-5)'] || '').trim();
  const keyActivities = (raw['Key Activities'] || '').trim();

  if (!staffName) errors.push('Staff Name is required');
  if (!fiscalYear) errors.push('Fiscal Year is required');
  else if (!FISCAL_YEARS.includes(fiscalYear)) errors.push(`Fiscal Year must be one of: ${FISCAL_YEARS.join(', ')}`);
  if (!perspective) errors.push('BSC Perspective is required');
  else if (!VALID_PERSPECTIVES.includes(perspective)) errors.push(`Perspective must be one of: ${VALID_PERSPECTIVES.join(', ')}`);
  if (!objective) errors.push('Objective is required');
  if (!kpisRaw) errors.push('At least one KPI is required');

  const weight = parseInt(weightRaw, 10);
  if (isNaN(weight) || weight < 1 || weight > 5) errors.push('Weight must be an integer between 1 and 5');

  // Fuzzy staff match
  const matchedStaff = staffList.find(
    (s) => s.full_name.toLowerCase() === staffName.toLowerCase()
  );
  if (staffName && !matchedStaff) {
    errors.push(`Staff "${staffName}" not found in system`);
  }

  return {
    rowNum,
    staffName,
    fiscalYear,
    perspective,
    objective,
    kpis: kpisRaw,
    weight: isNaN(weight) ? 0 : weight,
    keyActivities,
    errors,
    status: errors.length === 0 ? 'valid' : 'error',
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WorkplanBulkUpload({ onClose, onComplete }: WorkplanBulkUploadProps) {
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [staffList, setStaffList] = useState<StaffOption[]>([]);
  const [staffLoaded, setStaffLoaded] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  // Load staff list once
  const loadStaff = useCallback(async () => {
    if (staffLoaded) return;
    const { data } = await supabase
      .from('staff')
      .select('id, full_name, supervisor_id, supervisor_name, job_title')
      .eq('employment_status', 'active');
    setStaffList(data ?? []);
    setStaffLoaded(true);
  }, [staffLoaded, supabase]);

  React.useEffect(() => { loadStaff(); }, [loadStaff]);

  // Parse uploaded file
  async function handleFile(file: File) {
    if (!file) return;
    setFileName(file.name);
    setParsing(true);
    setRows([]);

    try {
      const XLSX = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });

      // Find the data sheet (prefer 'Workplan Data', fallback to first)
      const sheetName = wb.SheetNames.includes('Workplan Data')
        ? 'Workplan Data'
        : wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const rawRows: Record<string, string>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

      if (rawRows.length === 0) {
        toast.error('The file appears to be empty or has no data rows.');
        setParsing(false);
        return;
      }

      const parsed = rawRows.map((r, i) => validateRow(r, i + 2, staffList));
      setRows(parsed);
    } catch (err) {
      console.error(err);
      toast.error('Failed to parse file. Please use the provided template.');
    } finally {
      setParsing(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  // Group valid rows by staff + fiscal year and batch save
  async function handleSave() {
    const validRows = rows.filter((r) => r.status === 'valid');
    if (validRows.length === 0) {
      toast.error('No valid rows to save.');
      return;
    }

    setSaving(true);
    setSaveProgress(0);

    // Group by staffName + fiscalYear
    const groups: Record<string, BulkRow[]> = {};
    for (const row of validRows) {
      const key = `${row.staffName}||${row.fiscalYear}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(row);
    }

    const groupKeys = Object.keys(groups);
    let saved = 0;
    let failed = 0;

    for (let i = 0; i < groupKeys.length; i++) {
      const key = groupKeys[i];
      const groupRows = groups[key];
      const staffName = groupRows[0].staffName;
      const fiscalYear = groupRows[0].fiscalYear;

      const staffRecord = staffList.find(
        (s) => s.full_name.toLowerCase() === staffName.toLowerCase()
      );
      if (!staffRecord) { failed++; continue; }

      // Build perspectives_objectives array
      const perspectivesObjectives = groupRows.map((row) => ({
        id: `p-${Date.now()}-${Math.random()}`,
        perspective: row.perspective,
        objective: row.objective,
        kpis: row.kpis.split('|').map((k, idx) => ({
          id: `kpi-${idx}`,
          label: k.trim(),
          target: '',
        })).filter((k) => k.label),
        weight: row.weight,
        keyActivities: row.keyActivities,
      }));

      const reviewYear = parseInt(fiscalYear.replace(/\D/g, '').slice(-4), 10) || 2026;

      const { error } = await supabase.from('workplan_settings').insert({
        staff_id: staffRecord.id,
        supervisor_id: staffRecord.supervisor_id,
        fiscal_year: fiscalYear,
        review_year: reviewYear,
        perspectives_objectives: perspectivesObjectives,
        general_competencies: [],
        custom_kpis: [],
        status: 'draft',
        workflow_stage: 'workplan_pending',
      });

      if (error) {
        console.error('Save error for', staffName, error);
        failed++;
      } else {
        saved++;
        // Mark rows as saved
        setRows((prev) =>
          prev.map((r) =>
            r.staffName === staffName && r.fiscalYear === fiscalYear
              ? { ...r, status: 'saved' }
              : r
          )
        );
      }

      setSaveProgress(Math.round(((i + 1) / groupKeys.length) * 100));
    }

    setSaving(false);
    if (saved > 0) {
      toast.success(`Saved ${saved} workplan(s) successfully.${failed > 0 ? ` ${failed} failed.` : ''}`);
      if (failed === 0) {
        setTimeout(onComplete, 1200);
      }
    } else {
      toast.error('All saves failed. Check errors and try again.');
    }
  }

  const validCount = rows.filter((r) => r.status === 'valid').length;
  const errorCount = rows.filter((r) => r.status === 'error').length;
  const savedCount = rows.filter((r) => r.status === 'saved').length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-white">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
            <Icon name="EcsaDocIcon" size={16} className="text-emerald-600" />
          </div>
          <div>
            <h2 className="text-sm font-700 text-foreground">Excel / CSV Bulk Upload</h2>
            <p className="text-xs text-muted-foreground">Upload multiple workplans at once using the ECSA-HC template</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground">
          <Icon name="XMarkIcon" size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Step 1: Download template */}
        <div className="bg-sky-50 border border-sky-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Icon name="EcsaInfoIcon" size={16} className="text-sky-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-600 text-sky-800 mb-1">Step 1 — Download the template</p>
              <p className="text-xs text-sky-700 mb-3">
                Use the official ECSA-HC workplan template. One row per BSC objective per staff member.
                Multiple objectives for the same staff member are automatically grouped.
              </p>
              <button
                onClick={downloadTemplate}
                className="inline-flex items-center gap-2 text-xs font-600 text-sky-700 bg-white border border-sky-300 px-3 py-1.5 rounded-lg hover:bg-sky-50 transition-colors"
              >
                <Icon name="EcsaDocIcon" size={13} />
                Download Template (.xlsx)
              </button>
            </div>
          </div>
        </div>

        {/* Step 2: Upload file */}
        <div>
          <p className="text-xs font-600 text-foreground mb-2">Step 2 — Upload your completed file</p>
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleFileInput}
            />
            {parsing ? (
              <div className="flex flex-col items-center gap-2">
                <Icon name="EcsaRefreshIcon" size={24} className="text-primary animate-spin" />
                <p className="text-sm text-muted-foreground">Parsing file…</p>
              </div>
            ) : fileName ? (
              <div className="flex flex-col items-center gap-2">
                <Icon name="EcsaDocIcon" size={24} className="text-emerald-600" />
                <p className="text-sm font-600 text-foreground">{fileName}</p>
                <p className="text-xs text-muted-foreground">Click to replace</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Icon name="EcsaDocIcon" size={28} className="text-muted-foreground/40" />
                <p className="text-sm font-600 text-foreground">Drop your Excel or CSV file here</p>
                <p className="text-xs text-muted-foreground">or click to browse · .xlsx, .xls, .csv supported</p>
              </div>
            )}
          </div>
        </div>

        {/* Validation results */}
        {rows.length > 0 && (
          <div>
            <div className="flex items-center gap-3 mb-3">
              <p className="text-xs font-600 text-foreground">Step 3 — Review validation results</p>
              <div className="flex items-center gap-2 ml-auto">
                {validCount > 0 && (
                  <span className="text-[11px] font-600 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                    {validCount} valid
                  </span>
                )}
                {errorCount > 0 && (
                  <span className="text-[11px] font-600 px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                    {errorCount} errors
                  </span>
                )}
                {savedCount > 0 && (
                  <span className="text-[11px] font-600 px-2 py-0.5 rounded-full bg-sky-100 text-sky-700">
                    {savedCount} saved
                  </span>
                )}
              </div>
            </div>

            <div className="border border-border rounded-xl overflow-hidden">
              <div className="overflow-x-auto max-h-72 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted/30 border-b border-border">
                    <tr>
                      <th className="text-left px-3 py-2 font-600 text-muted-foreground w-10">#</th>
                      <th className="text-left px-3 py-2 font-600 text-muted-foreground">Staff</th>
                      <th className="text-left px-3 py-2 font-600 text-muted-foreground">Fiscal Year</th>
                      <th className="text-left px-3 py-2 font-600 text-muted-foreground">Perspective</th>
                      <th className="text-left px-3 py-2 font-600 text-muted-foreground">Objective</th>
                      <th className="text-left px-3 py-2 font-600 text-muted-foreground w-14">Wt.</th>
                      <th className="text-left px-3 py-2 font-600 text-muted-foreground w-20">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rows.map((row) => (
                      <tr
                        key={row.rowNum}
                        className={
                          row.status === 'error' ?'bg-red-50'
                            : row.status === 'saved' ?'bg-emerald-50' :'bg-white'
                        }
                      >
                        <td className="px-3 py-2 text-muted-foreground tabular-nums">{row.rowNum}</td>
                        <td className="px-3 py-2 font-500 text-foreground max-w-[120px] truncate">{row.staffName || '—'}</td>
                        <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{row.fiscalYear || '—'}</td>
                        <td className="px-3 py-2 text-muted-foreground max-w-[140px] truncate">{row.perspective || '—'}</td>
                        <td className="px-3 py-2 text-foreground max-w-[200px]">
                          <div className="truncate">{row.objective || '—'}</div>
                          {row.errors.length > 0 && (
                            <div className="mt-0.5 space-y-0.5">
                              {row.errors.map((e, i) => (
                                <p key={i} className="text-[10px] text-red-600 flex items-center gap-1">
                                  <Icon name="ExclamationCircleIcon" size={10} />
                                  {e}
                                </p>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center tabular-nums">{row.weight || '—'}</td>
                        <td className="px-3 py-2">
                          {row.status === 'valid' && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-600 text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full">
                              <Icon name="EcsaApprovedIcon" size={10} /> Valid
                            </span>
                          )}
                          {row.status === 'error' && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-600 text-red-700 bg-red-100 px-1.5 py-0.5 rounded-full">
                              <Icon name="EcsaAlertIcon" size={10} /> Error
                            </span>
                          )}
                          {row.status === 'saved' && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-600 text-sky-700 bg-sky-100 px-1.5 py-0.5 rounded-full">
                              <Icon name="EcsaApprovedIcon" size={10} /> Saved
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {errorCount > 0 && (
              <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <strong>{errorCount} row(s) have errors</strong> and will be skipped. Fix them in your file and re-upload, or proceed to save only the valid rows.
              </p>
            )}
          </div>
        )}

        {/* Save progress */}
        {saving && (
          <div className="bg-sky-50 border border-sky-200 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <Icon name="EcsaRefreshIcon" size={16} className="text-sky-600 animate-spin" />
              <p className="text-sm font-600 text-sky-800">Saving workplans… {saveProgress}%</p>
            </div>
            <div className="w-full bg-sky-200 rounded-full h-2">
              <div
                className="bg-sky-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${saveProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-white">
        <button
          onClick={onClose}
          className="text-xs font-600 text-muted-foreground hover:text-foreground px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={validCount === 0 || saving}
          className="flex items-center gap-2 text-xs font-600 text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-muted disabled:text-muted-foreground px-4 py-2 rounded-lg transition-colors"
        >
          {saving ? (
            <><Icon name="EcsaRefreshIcon" size={13} className="animate-spin" /> Saving…</>
          ) : (
            <><Icon name="EcsaApprovedIcon" size={13} /> Save {validCount} Valid Workplan{validCount !== 1 ? 's' : ''}</>
          )}
        </button>
      </div>
    </div>
  );
}
