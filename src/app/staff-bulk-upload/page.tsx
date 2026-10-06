'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import * as XLSX from 'xlsx';

// ─── Types ─────────────────────────────────────────────────────────────────

interface SystemField {
  key: string;
  label: string;
  required: boolean;
  hint: string;
}

interface MappedRow {
  full_name: string;
  job_title: string;
  department_name: string;
  supervisor_name: string;
  employment_status: string;
  serial_number: string;
  email: string;
  _errors: string[];
  _warnings: string[];
  _department_id?: string | null;
  _supervisor_id?: string | null;
}

type WizardStep = 'upload' | 'map' | 'validate' | 'import' | 'done';

interface ImportResults {
  inserted: number;
  skipped: number;
  errors: string[];
}

// ─── Constants ─────────────────────────────────────────────────────────────

const SYSTEM_FIELDS: SystemField[] = [
  { key: 'full_name',          label: 'Full Name',          required: true,  hint: 'Staff member\'s complete name' },
  { key: 'job_title',          label: 'Job Title',          required: true,  hint: 'Position / designation' },
  { key: 'department_name',    label: 'Department',         required: false, hint: 'Must match an existing directorate/cluster' },
  { key: 'supervisor_name',    label: 'Supervisor Name',    required: false, hint: 'Must match an existing staff member\'s full name' },
  { key: 'employment_status',  label: 'Employment Status',  required: false, hint: 'active · inactive · on_leave · terminated' },
  { key: 'serial_number',      label: 'Serial Number',      required: false, hint: 'Numeric staff ID / serial' },
  { key: 'email',              label: 'Email Address',      required: false, hint: 'Work email address' },
];

const VALID_STATUSES = ['active', 'inactive', 'on_leave', 'terminated'];

function normalise(v: unknown): string {
  return String(v ?? '').trim();
}

function downloadTemplate() {
  const wb = XLSX.utils.book_new();
  const headers = SYSTEM_FIELDS.map((f) => f.key);
  const sample = [
    headers,
    ['1', 'JANE MARY DOE', 'Programme Officer', 'Programmes', 'ANDREW NKHULO SILUMESII', 'active', 'jane.doe@ecsahc.int'],
    ['2', 'JOHN SMITH', 'Finance Officer', 'Finance', 'LILLIANE BRENDA NAMUTEBI NJUBA', 'active', 'john.smith@ecsahc.int'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(sample);
  ws['!cols'] = headers.map(() => ({ wch: 28 }));
  XLSX.utils.book_append_sheet(wb, ws, 'Staff Import');
  XLSX.writeFile(wb, 'staff_bulk_upload_template.xlsx');
}

// ─── Step indicator ─────────────────────────────────────────────────────────

const STEPS: { id: WizardStep; label: string; icon: string }[] = [
  { id: 'upload',   label: 'Upload File',      icon: 'ArrowUpTrayIcon' },
  { id: 'map',      label: 'Map Columns',      icon: 'AdjustmentsHorizontalIcon' },
  { id: 'validate', label: 'Review & Validate', icon: 'ClipboardDocumentCheckIcon' },
  { id: 'import',   label: 'Import',           icon: 'ServerStackIcon' },
  { id: 'done',     label: 'Complete',         icon: 'EcsaSuccessIcon' },
];

function StepBar({ current }: { current: WizardStep }) {
  const idx = STEPS.findIndex((s) => s.id === current);
  return (
    <div className="flex items-center gap-0 w-full">
      {STEPS.map((step, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <React.Fragment key={step.id}>
            <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all ${
                done   ? 'bg-primary border-primary text-white' : active ?'bg-white border-primary text-primary': 'bg-white border-border text-muted-foreground'
              }`}>
                {done
                  ? <Icon name="CheckIcon" size={16} />
                  : <Icon name={step.icon as Parameters<typeof Icon>[0]['name']} size={16} />
                }
              </div>
              <span className={`text-[10px] font-600 whitespace-nowrap hidden sm:block ${
                active ? 'text-primary' : done ? 'text-foreground' : 'text-muted-foreground'
              }`}>{step.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 transition-all ${i < idx ? 'bg-primary' : 'bg-border'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Toast ──────────────────────────────────────────────────────────────────

interface ToastProps { message: string; type: 'success' | 'error'; onClose: () => void; }

function Toast({ message, type, onClose }: ToastProps) {
  React.useEffect(() => {
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-600 max-w-sm ${
      type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
    }`}>
      <Icon name={type === 'success' ? 'EcsaSuccessIcon' : 'EcsaErrorIcon'} size={18} className="flex-shrink-0" />
      <span className="flex-1">{message}</span>
      <button onClick={onClose} className="ml-1 opacity-60 hover:opacity-100 flex-shrink-0">
        <Icon name="XMarkIcon" size={14} />
      </button>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function StaffBulkUploadPage() {
  const [step, setStep] = useState<WizardStep>('upload');
  const [fileName, setFileName] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Raw parsed data from file
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<string[][]>([]);

  // Column mapping: systemFieldKey -> fileColumnIndex (or -1 = skip)
  const [mapping, setMapping] = useState<Record<string, number>>({});

  // Validated rows
  const [validatedRows, setValidatedRows] = useState<MappedRow[]>([]);
  const [isValidating, setIsValidating] = useState(false);

  // Import progress
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState<ImportResults>({ inserted: 0, skipped: 0, errors: [] });

  // Filter for validation table
  const [showOnlyErrors, setShowOnlyErrors] = useState(false);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // ── Step 1: Parse file ────────────────────────────────────────────────────

  const parseFile = useCallback(async (file: File) => {
    setFileName(file.name);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

      if (raw.length < 2) {
        setToast({ message: 'File is empty or has no data rows.', type: 'error' });
        return;
      }

      const headers = (raw[0] as unknown[]).map((h) => normalise(h));
      const dataRows = raw.slice(1)
        .filter((r) => (r as unknown[]).some((c) => normalise(c) !== ''))
        .map((r) => (r as unknown[]).map((c) => normalise(c)));

      setFileHeaders(headers);
      setRawRows(dataRows as string[][]);

      // Auto-map: try to match file headers to system fields by similarity
      const autoMap: Record<string, number> = {};
      SYSTEM_FIELDS.forEach((field) => {
        const fieldKey = field.key.toLowerCase().replace(/_/g, ' ');
        const fieldLabel = field.label.toLowerCase();
        const idx = headers.findIndex((h) => {
          const hNorm = h.toLowerCase().replace(/[_\s-]+/g, ' ');
          return hNorm === fieldKey || hNorm === fieldLabel ||
            hNorm.includes(fieldKey) || fieldKey.includes(hNorm) ||
            hNorm.includes(fieldLabel) || fieldLabel.includes(hNorm);
        });
        autoMap[field.key] = idx; // -1 if not found
      });
      setMapping(autoMap);
      setStep('map');
    } catch (err) {
      console.error(err);
      setToast({ message: 'Failed to parse file. Ensure it is a valid CSV or Excel file.', type: 'error' });
    }
  }, []);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) parseFile(file);
  }

  // ── Step 2: Validate mapped rows ─────────────────────────────────────────

  async function handleValidate() {
    setIsValidating(true);
    setStep('validate');

    const mapped: MappedRow[] = rawRows.map((row) => {
      const get = (key: string): string => {
        const colIdx = mapping[key] ?? -1;
        return colIdx >= 0 ? normalise(row[colIdx]) : '';
      };
      return {
        full_name:         get('full_name').toUpperCase(),
        job_title:         get('job_title'),
        department_name:   get('department_name'),
        supervisor_name:   get('supervisor_name').toUpperCase(),
        employment_status: get('employment_status') || 'active',
        serial_number:     get('serial_number'),
        email:             get('email').toLowerCase(),
        _errors:   [],
        _warnings: [],
      };
    });

    try {
      const supabase = createClient();
      const [deptsResult, staffResult] = await Promise.all([
        supabase.from('departments').select('id, name'),
        supabase.from('staff').select('id, full_name, email'),
      ]);

      const deptMap = new Map<string, string>(
        (deptsResult.data ?? []).map((d: { id: string; name: string }) => [d.name.toLowerCase(), d.id])
      );
      const staffNameMap = new Map<string, string>(
        (staffResult.data ?? []).map((s: { id: string; full_name: string }) => [s.full_name.toLowerCase(), s.id])
      );
      const existingEmails = new Set<string>(
        (staffResult.data ?? []).map((s: { email?: string | null }) => (s.email ?? '').toLowerCase()).filter(Boolean)
      );

      const validated = mapped.map((row) => {
        const errors: string[] = [];
        const warnings: string[] = [];

        if (!row.full_name) errors.push('Full name is required');
        if (!row.job_title)  errors.push('Job title is required');

        let deptId: string | null = null;
        if (row.department_name) {
          deptId = deptMap.get(row.department_name.toLowerCase()) ?? null;
          if (!deptId) warnings.push(`Department "${row.department_name}" not found — will be left blank`);
        }

        let supervisorId: string | null = null;
        if (row.supervisor_name) {
          supervisorId = staffNameMap.get(row.supervisor_name.toLowerCase()) ?? null;
          if (!supervisorId) warnings.push(`Supervisor "${row.supervisor_name}" not found in system`);
        }

        if (row.employment_status && !VALID_STATUSES.includes(row.employment_status.toLowerCase())) {
          warnings.push(`Unknown status "${row.employment_status}" — will default to "active"`);
        }

        if (row.email && existingEmails.has(row.email)) {
          warnings.push(`Email "${row.email}" already exists — record may be a duplicate`);
        }

        return {
          ...row,
          _department_id: deptId,
          _supervisor_id: supervisorId,
          _errors: errors,
          _warnings: warnings,
        };
      });

      setValidatedRows(validated);
    } catch (err) {
      console.error(err);
      setToast({ message: 'Validation failed. Check your connection and try again.', type: 'error' });
    } finally {
      setIsValidating(false);
    }
  }

  // ── Step 3: Import ────────────────────────────────────────────────────────

  async function handleImport() {
    const toImport = validatedRows.filter((r) => r._errors.length === 0);
    if (toImport.length === 0) return;

    setStep('import');
    setImportProgress(0);

    const supabase = createClient();
    let inserted = 0;
    const importErrors: string[] = [];

    for (let i = 0; i < toImport.length; i++) {
      const row = toImport[i];
      try {
        const payload: Record<string, unknown> = {
          full_name:         row.full_name,
          job_title:         row.job_title,
          department_id:     row._department_id ?? null,
          supervisor_id:     row._supervisor_id ?? null,
          supervisor_name:   row.supervisor_name || null,
          employment_status: VALID_STATUSES.includes(row.employment_status.toLowerCase())
            ? row.employment_status.toLowerCase() : 'active',
        };
        if (row.serial_number) {
          const sn = parseInt(row.serial_number, 10);
          if (!isNaN(sn)) payload.serial_number = sn;
        }
        if (row.email) payload.email = row.email;

        const { error } = await supabase.from('staff').insert(payload);
        if (error) {
          importErrors.push(`Row ${i + 1} (${row.full_name}): ${error.message}`);
        } else {
          inserted++;
        }
      } catch {
        importErrors.push(`Row ${i + 1} (${row.full_name}): Unexpected error`);
      }
      setImportProgress(Math.round(((i + 1) / toImport.length) * 100));
    }

    setImportResults({ inserted, skipped: validatedRows.filter((r) => r._errors.length > 0).length, errors: importErrors });
    setStep('done');
    setToast({
      message: `Import complete: ${inserted} staff added${importErrors.length > 0 ? `, ${importErrors.length} failed` : ''}`,
      type: importErrors.length === 0 ? 'success' : 'error',
    });
  }

  // ── Reset ─────────────────────────────────────────────────────────────────

  function handleReset() {
    setStep('upload');
    setFileName('');
    setFileHeaders([]);
    setRawRows([]);
    setMapping({});
    setValidatedRows([]);
    setImportProgress(0);
    setImportResults({ inserted: 0, skipped: 0, errors: [] });
    setShowOnlyErrors(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const validRows   = validatedRows.filter((r) => r._errors.length === 0);
  const errorRows   = validatedRows.filter((r) => r._errors.length > 0);
  const warningRows = validatedRows.filter((r) => r._errors.length === 0 && r._warnings.length > 0);
  const displayRows = showOnlyErrors ? errorRows : validatedRows;

  const requiredMapped = SYSTEM_FIELDS.filter((f) => f.required).every((f) => (mapping[f.key] ?? -1) >= 0);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <AppLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">

        {/* Page header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Icon name="ArrowUpTrayIcon" size={16} className="text-primary" />
              </div>
              <h1 className="text-xl font-700 text-foreground">Staff Bulk Upload</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Upload a CSV or Excel file, map your columns to system fields, validate, and import staff records.
            </p>
          </div>
          <button
            onClick={downloadTemplate}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-white text-sm font-600 text-foreground hover:bg-muted transition-colors"
          >
            <Icon name="ArrowDownTrayIcon" size={15} />
            Download Template
          </button>
        </div>

        {/* Step bar */}
        <div className="bg-white border border-border rounded-2xl p-5">
          <StepBar current={step} />
        </div>

        {/* ── STEP 1: Upload ─────────────────────────────────────────────── */}
        {step === 'upload' && (
          <div className="space-y-4">
            {/* Info panel */}
            <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 flex items-start gap-3">
              <Icon name="InformationCircleIcon" size={18} className="text-sky-500 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-600 text-sky-800">How it works</p>
                <ol className="text-xs text-sky-700 space-y-0.5 list-decimal list-inside">
                  <li>Upload any CSV or Excel file with staff data</li>
                  <li>Map your file's columns to the system fields (we'll auto-detect where possible)</li>
                  <li>Review validation results — errors and warnings highlighted per row</li>
                  <li>Confirm and import valid records into the system</li>
                </ol>
              </div>
            </div>

            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-14 flex flex-col items-center justify-center gap-5 cursor-pointer transition-all ${
                dragOver ? 'border-primary bg-primary/5' : 'border-border bg-muted/20 hover:border-primary/50 hover:bg-primary/5'
              }`}
            >
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Icon name="ArrowUpTrayIcon" size={30} className="text-primary" />
              </div>
              <div className="text-center">
                <p className="text-base font-700 text-foreground">Drop your file here or click to browse</p>
                <p className="text-sm text-muted-foreground mt-1">Supports .xlsx, .xls, and .csv — any column order</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-border text-xs font-600 text-muted-foreground">
                  <Icon name="TableCellsIcon" size={13} /> .xlsx / .xls
                </span>
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-border text-xs font-600 text-muted-foreground">
                  <Icon name="DocumentTextIcon" size={13} /> .csv
                </span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {/* System fields reference */}
            <div className="bg-white border border-border rounded-xl p-4">
              <p className="text-xs font-700 text-foreground mb-3 uppercase tracking-wide">System Fields Reference</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SYSTEM_FIELDS.map((field) => (
                  <div key={field.key} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-muted/30">
                    <span className={`mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${field.required ? 'bg-primary' : 'bg-border'}`} />
                    <div>
                      <span className="text-xs font-700 text-foreground">{field.label}</span>
                      {field.required && <span className="ml-1 text-[10px] text-primary font-600">required</span>}
                      <p className="text-[11px] text-muted-foreground mt-0.5">{field.hint}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 2: Column Mapping ─────────────────────────────────────── */}
        {step === 'map' && (
          <div className="space-y-4">
            <div className="bg-white border border-border rounded-2xl overflow-hidden">
              {/* Header */}
              <div className="px-5 py-4 border-b border-border bg-muted/30 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-sm font-700 text-foreground">Map Columns</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    File: <span className="font-600 text-foreground">{fileName}</span> &nbsp;·&nbsp;
                    <span className="font-600 text-foreground">{rawRows.length}</span> data rows detected
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Icon name="InformationCircleIcon" size={14} className="text-sky-500" />
                  We auto-detected matches where possible. Adjust as needed.
                </div>
              </div>

              {/* Mapping table */}
              <div className="divide-y divide-border">
                {SYSTEM_FIELDS.map((field) => {
                  const currentIdx = mapping[field.key] ?? -1;
                  return (
                    <div key={field.key} className="px-5 py-4 flex items-center gap-4 flex-wrap sm:flex-nowrap">
                      {/* System field */}
                      <div className="w-full sm:w-56 flex-shrink-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-600 text-foreground">{field.label}</span>
                          {field.required && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-700 bg-primary/10 text-primary">required</span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{field.hint}</p>
                      </div>

                      {/* Arrow */}
                      <div className="hidden sm:flex items-center text-muted-foreground">
                        <Icon name="ArrowRightIcon" size={16} />
                      </div>

                      {/* File column selector */}
                      <div className="flex-1 min-w-0">
                        <select
                          value={currentIdx}
                          onChange={(e) => setMapping((prev) => ({ ...prev, [field.key]: parseInt(e.target.value, 10) }))}
                          className={`w-full px-3 py-2 rounded-lg border text-sm font-500 bg-white transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                            currentIdx >= 0
                              ? 'border-emerald-300 text-foreground'
                              : field.required
                              ? 'border-red-300 text-red-600' :'border-border text-muted-foreground'
                          }`}
                        >
                          <option value={-1}>— Skip this field —</option>
                          {fileHeaders.map((h, i) => (
                            <option key={i} value={i}>{h || `Column ${i + 1}`}</option>
                          ))}
                        </select>
                      </div>

                      {/* Preview of first value */}
                      <div className="w-full sm:w-48 flex-shrink-0">
                        {currentIdx >= 0 && rawRows[0]?.[currentIdx] ? (
                          <div className="px-3 py-2 rounded-lg bg-muted/40 border border-border">
                            <p className="text-[10px] text-muted-foreground font-600 uppercase tracking-wide mb-0.5">Preview (row 1)</p>
                            <p className="text-xs text-foreground font-500 truncate">{rawRows[0][currentIdx]}</p>
                          </div>
                        ) : (
                          <div className="px-3 py-2 rounded-lg bg-muted/20 border border-dashed border-border">
                            <p className="text-xs text-muted-foreground italic">No preview</p>
                          </div>
                        )}
                      </div>

                      {/* Status icon */}
                      <div className="flex-shrink-0 w-6 flex justify-center">
                        {currentIdx >= 0 ? (
                          <Icon name="CheckCircleIcon" size={18} className="text-emerald-500" />
                        ) : field.required ? (
                          <Icon name="ExclamationCircleIcon" size={18} className="text-red-400" />
                        ) : (
                          <Icon name="MinusCircleIcon" size={18} className="text-border" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer actions */}
              <div className="px-5 py-4 border-t border-border bg-muted/20 flex items-center justify-between gap-4 flex-wrap">
                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-white text-sm font-600 text-muted-foreground hover:bg-muted transition-colors"
                >
                  <Icon name="ArrowLeftIcon" size={14} />
                  Back
                </button>
                <div className="flex items-center gap-3">
                  {!requiredMapped && (
                    <p className="text-xs text-red-600 flex items-center gap-1">
                      <Icon name="ExclamationTriangleIcon" size={13} />
                      Map all required fields to continue
                    </p>
                  )}
                  <button
                    onClick={handleValidate}
                    disabled={!requiredMapped}
                    className="flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-white text-sm font-600 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Icon name="ClipboardDocumentCheckIcon" size={15} />
                    Validate {rawRows.length} Rows
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 3: Validate ──────────────────────────────────────────── */}
        {step === 'validate' && (
          <div className="space-y-4">
            {isValidating ? (
              <div className="bg-white border border-border rounded-2xl p-14 flex flex-col items-center gap-4">
                <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                <p className="text-sm font-600 text-foreground">Validating records against system data…</p>
                <p className="text-xs text-muted-foreground">Checking departments, supervisors, and duplicate emails</p>
              </div>
            ) : (
              <>
                {/* Summary cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-white border border-border rounded-xl p-4 text-center">
                    <p className="text-2xl font-700 text-foreground">{validatedRows.length}</p>
                    <p className="text-xs text-muted-foreground font-600 mt-1">Total Rows</p>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                    <p className="text-2xl font-700 text-emerald-700">{validRows.length}</p>
                    <p className="text-xs text-emerald-600 font-600 mt-1">Ready to Import</p>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                    <p className="text-2xl font-700 text-amber-700">{warningRows.length}</p>
                    <p className="text-xs text-amber-600 font-600 mt-1">With Warnings</p>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                    <p className="text-2xl font-700 text-red-700">{errorRows.length}</p>
                    <p className="text-xs text-red-600 font-600 mt-1">Blocked (Errors)</p>
                  </div>
                </div>

                {/* Filter + table */}
                <div className="bg-white border border-border rounded-2xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center justify-between gap-3 flex-wrap">
                    <p className="text-sm font-700 text-foreground">Row Preview</p>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 text-xs font-600 text-muted-foreground cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showOnlyErrors}
                          onChange={(e) => setShowOnlyErrors(e.target.checked)}
                          className="rounded border-border"
                        />
                        Show errors only
                      </label>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/20">
                          <th className="px-4 py-3 text-left text-xs font-600 text-muted-foreground w-8">#</th>
                          <th className="px-4 py-3 text-left text-xs font-600 text-muted-foreground">Full Name</th>
                          <th className="px-4 py-3 text-left text-xs font-600 text-muted-foreground">Job Title</th>
                          <th className="px-4 py-3 text-left text-xs font-600 text-muted-foreground">Department</th>
                          <th className="px-4 py-3 text-left text-xs font-600 text-muted-foreground">Supervisor</th>
                          <th className="px-4 py-3 text-left text-xs font-600 text-muted-foreground">Status</th>
                          <th className="px-4 py-3 text-left text-xs font-600 text-muted-foreground min-w-[200px]">Validation</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {displayRows.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">
                              {showOnlyErrors ? 'No rows with errors 🎉' : 'No rows to display'}
                            </td>
                          </tr>
                        ) : (
                          displayRows.map((row, idx) => (
                            <tr
                              key={idx}
                              className={`transition-colors ${
                                row._errors.length > 0
                                  ? 'bg-red-50/60'
                                  : row._warnings.length > 0
                                  ? 'bg-amber-50/40' :'hover:bg-muted/20'
                              }`}
                            >
                              <td className="px-4 py-3 text-xs text-muted-foreground">{idx + 1}</td>
                              <td className="px-4 py-3">
                                <span className="text-xs font-600 text-foreground">
                                  {row.full_name || <span className="text-red-500 italic">missing</span>}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-xs text-muted-foreground">
                                {row.job_title || <span className="text-red-500 italic">missing</span>}
                              </td>
                              <td className="px-4 py-3">
                                {row.department_name ? (
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-600 ${
                                    row._department_id ? 'bg-sky-100 text-sky-700' : 'bg-amber-100 text-amber-700'
                                  }`}>
                                    {row.department_name}
                                  </span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                {row.supervisor_name ? (
                                  <span className={`text-xs ${row._supervisor_id ? 'text-foreground' : 'text-amber-600'}`}>
                                    {row.supervisor_name}
                                    {!row._supervisor_id && <span className="ml-1 text-[10px]">(not found)</span>}
                                  </span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`text-xs px-2 py-0.5 rounded-full font-600 capitalize ${
                                  (row.employment_status || 'active') === 'active'
                                    ? 'bg-emerald-100 text-emerald-700' :'bg-gray-100 text-gray-600'
                                }`}>
                                  {row.employment_status || 'active'}
                                </span>
                              </td>
                              <td className="px-4 py-3 max-w-xs">
                                {row._errors.length > 0 ? (
                                  <div className="space-y-0.5">
                                    {row._errors.map((e, i) => (
                                      <p key={i} className="text-xs text-red-600 flex items-start gap-1">
                                        <Icon name="XCircleIcon" size={12} className="flex-shrink-0 mt-0.5" />
                                        {e}
                                      </p>
                                    ))}
                                  </div>
                                ) : row._warnings.length > 0 ? (
                                  <div className="space-y-0.5">
                                    {row._warnings.map((w, i) => (
                                      <p key={i} className="text-xs text-amber-600 flex items-start gap-1">
                                        <Icon name="ExclamationTriangleIcon" size={12} className="flex-shrink-0 mt-0.5" />
                                        {w}
                                      </p>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-xs text-emerald-600 flex items-center gap-1">
                                    <Icon name="CheckCircleIcon" size={12} />
                                    Ready
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Footer */}
                  <div className="px-5 py-4 border-t border-border bg-muted/20 flex items-center justify-between gap-4 flex-wrap">
                    <button
                      onClick={() => setStep('map')}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-white text-sm font-600 text-muted-foreground hover:bg-muted transition-colors"
                    >
                      <Icon name="ArrowLeftIcon" size={14} />
                      Back to Mapping
                    </button>
                    <div className="flex items-center gap-3">
                      {validRows.length === 0 && (
                        <p className="text-xs text-red-600 flex items-center gap-1">
                          <Icon name="ExclamationTriangleIcon" size={13} />
                          No valid rows to import
                        </p>
                      )}
                      {validRows.length > 0 && errorRows.length > 0 && (
                        <p className="text-xs text-amber-600 flex items-center gap-1">
                          <Icon name="ExclamationTriangleIcon" size={13} />
                          {errorRows.length} row{errorRows.length !== 1 ? 's' : ''} will be skipped
                        </p>
                      )}
                      <button
                        onClick={handleImport}
                        disabled={validRows.length === 0}
                        className="flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-white text-sm font-600 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <Icon name="ArrowUpTrayIcon" size={15} />
                        Import {validRows.length} Record{validRows.length !== 1 ? 's' : ''}
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── STEP 4: Importing progress ─────────────────────────────────── */}
        {step === 'import' && (
          <div className="bg-white border border-border rounded-2xl p-10 flex flex-col items-center gap-6">
            <div className="w-14 h-14 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
            <div className="text-center">
              <p className="text-base font-700 text-foreground">Importing staff records…</p>
              <p className="text-sm text-muted-foreground mt-1">{importProgress}% complete</p>
            </div>
            <div className="w-full max-w-md bg-muted rounded-full h-2.5">
              <div
                className="bg-primary h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${importProgress}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">Please do not close this page</p>
          </div>
        )}

        {/* ── STEP 5: Done ──────────────────────────────────────────────── */}
        {step === 'done' && (
          <div className="space-y-4">
            <div className="bg-white border border-border rounded-2xl p-6 space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <Icon name="EcsaSuccessIcon" size={24} className="text-emerald-600" />
                </div>
                <div>
                  <p className="text-base font-700 text-foreground">Import Complete</p>
                  <p className="text-sm text-muted-foreground">Staff records have been processed</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                  <p className="text-3xl font-700 text-emerald-700">{importResults.inserted}</p>
                  <p className="text-xs text-emerald-600 font-600 mt-1">Records Inserted</p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                  <p className="text-3xl font-700 text-amber-700">{importResults.skipped}</p>
                  <p className="text-xs text-amber-600 font-600 mt-1">Rows Skipped</p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                  <p className="text-3xl font-700 text-red-700">{importResults.errors.length}</p>
                  <p className="text-xs text-red-600 font-600 mt-1">Insert Failures</p>
                </div>
              </div>

              {importResults.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-1.5 max-h-48 overflow-y-auto">
                  <p className="text-xs font-700 text-red-700 mb-2">Insert Errors</p>
                  {importResults.errors.map((e, i) => (
                    <p key={i} className="text-xs text-red-700 flex items-start gap-1.5">
                      <Icon name="XCircleIcon" size={12} className="flex-shrink-0 mt-0.5" />
                      {e}
                    </p>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-white text-sm font-600 hover:bg-primary/90 transition-colors"
                >
                  <Icon name="ArrowUpTrayIcon" size={15} />
                  Upload Another File
                </button>
                <a
                  href="/staff-management"
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-border bg-white text-sm font-600 text-foreground hover:bg-muted transition-colors"
                >
                  <Icon name="EcsaStaffIcon" size={15} />
                  View Staff Management
                </a>
              </div>
            </div>
          </div>
        )}

      </div>

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </AppLayout>
  );
}
