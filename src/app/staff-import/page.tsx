'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import * as XLSX from 'xlsx';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Department {
  id: string;
  name: string;
}

interface StaffRow {
  serial_number: string;
  full_name: string;
  job_title: string;
  department_name: string;
  supervisor_name: string;
  employment_status: string;
  // resolved
  _department_id?: string | null;
  _supervisor_id?: string | null;
  _errors: string[];
  _warnings: string[];
}

type ImportStatus = 'idle' | 'parsing' | 'validating' | 'ready' | 'importing' | 'done' | 'error';

// ─── Template columns ─────────────────────────────────────────────────────────

const TEMPLATE_COLUMNS = [
  'serial_number',
  'full_name',
  'job_title',
  'department_name',
  'supervisor_name',
  'employment_status',
];

const REQUIRED_COLUMNS = ['full_name', 'job_title'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalise(v: unknown): string {
  return String(v ?? '').trim();
}

function downloadTemplate() {
  const wb = XLSX.utils.book_new();
  const sampleData = [
    TEMPLATE_COLUMNS,
    ['1', 'JANE MARY DOE', 'Programme Officer', 'Programmes', 'ANDREW NKHULO SILUMESII', 'active'],
    ['2', 'JOHN SMITH', 'Finance Officer', 'Finance', 'LILLIANE BRENDA NAMUTEBI NJUBA', 'active'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(sampleData);
  ws['!cols'] = TEMPLATE_COLUMNS.map(() => ({ wch: 28 }));
  XLSX.utils.book_append_sheet(wb, ws, 'Staff Import');
  XLSX.writeFile(wb, 'staff_import_template.xlsx');
}

// ─── Toast ────────────────────────────────────────────────────────────────────

interface ToastProps { message: string; type: 'success' | 'error'; onClose: () => void; }

function Toast({ message, type, onClose }: ToastProps) {
  React.useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-600 ${
      type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
    }`}>
      <Icon name={type === 'success' ? 'EcsaSuccessIcon' : 'EcsaErrorIcon'} size={18} />
      <span>{message}</span>
      <button onClick={onClose} className="ml-1 opacity-60 hover:opacity-100">
        <Icon name="EcsaCloseIcon" size={14} />
      </button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function StaffImportPage() {
  const [status, setStatus] = useState<ImportStatus>('idle');
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState<{ inserted: number; skipped: number; errors: string[] }>({ inserted: 0, skipped: 0, errors: [] });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validRows = rows.filter((r) => r._errors.length === 0);
  const errorRows = rows.filter((r) => r._errors.length > 0);

  // ── Parse & validate file ──────────────────────────────────────────────────

  const processFile = useCallback(async (file: File) => {
    setFileName(file.name);
    setStatus('parsing');
    setRows([]);

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

      if (raw.length < 2) {
        setStatus('error');
        setToast({ message: 'File is empty or has no data rows.', type: 'error' });
        return;
      }

      const headers = (raw[0] as unknown[]).map((h) => normalise(h).toLowerCase().replace(/\s+/g, '_'));
      const dataRows = raw.slice(1).filter((r) => (r as unknown[]).some((c) => normalise(c) !== ''));

      // Check required columns
      const missing = REQUIRED_COLUMNS.filter((c) => !headers.includes(c));
      if (missing.length > 0) {
        setStatus('error');
        setToast({ message: `Missing required columns: ${missing.join(', ')}`, type: 'error' });
        return;
      }

      const parsed: StaffRow[] = dataRows.map((row) => {
        const r = row as unknown[];
        const get = (col: string) => normalise(r[headers.indexOf(col)] ?? '');
        return {
          serial_number: get('serial_number'),
          full_name: get('full_name').toUpperCase(),
          job_title: get('job_title'),
          department_name: get('department_name'),
          supervisor_name: get('supervisor_name').toUpperCase(),
          employment_status: get('employment_status') || 'active',
          _errors: [],
          _warnings: [],
        };
      });

      setStatus('validating');

      // Fetch departments and existing staff for validation
      const supabase = createClient();
      const [deptsResult, existingStaffResult] = await Promise.all([
        supabase.from('departments').select('id, name'),
        supabase.from('staff').select('id, full_name'),
      ]);
      const depts = deptsResult.data;
      const existingStaff = existingStaffResult.data;

      const deptMap = new Map<string, string>((depts ?? []).map((d: Department) => [d.name.toLowerCase(), d.id]));
      const staffMap = new Map<string, string>((existingStaff ?? []).map((s: { id: string; full_name: string }) => [s.full_name.toLowerCase(), s.id]));

      const validated = parsed.map((row) => {
        const errors: string[] = [];
        const warnings: string[] = [];

        if (!row.full_name) errors.push('Full name is required');
        if (!row.job_title) errors.push('Job title is required');

        let deptId: string | null = null;
        if (row.department_name) {
          deptId = deptMap.get(row.department_name.toLowerCase()) ?? null;
          if (!deptId) warnings.push(`Department "${row.department_name}" not found — will be left blank`);
        }

        let supervisorId: string | null = null;
        if (row.supervisor_name) {
          supervisorId = staffMap.get(row.supervisor_name.toLowerCase()) ?? null;
          if (!supervisorId) warnings.push(`Supervisor "${row.supervisor_name}" not found in system`);
        }

        const validStatuses = ['active', 'inactive', 'on_leave', 'terminated'];
        if (row.employment_status && !validStatuses.includes(row.employment_status.toLowerCase())) {
          warnings.push(`Unknown status "${row.employment_status}" — defaulting to "active"`);
        }

        return {
          ...row,
          _department_id: deptId,
          _supervisor_id: supervisorId,
          _errors: errors,
          _warnings: warnings,
        };
      });

      setRows(validated);
      setStatus('ready');
    } catch (err) {
      console.error(err);
      setStatus('error');
      setToast({ message: 'Failed to parse file. Ensure it is a valid CSV or Excel file.', type: 'error' });
    }
  }, []);

  // ── File input handlers ────────────────────────────────────────────────────

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }

  function handleReset() {
    setStatus('idle');
    setRows([]);
    setFileName('');
    setImportProgress(0);
    setImportResults({ inserted: 0, skipped: 0, errors: [] });
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  // ── Import to Supabase ─────────────────────────────────────────────────────

  async function handleImport() {
    if (validRows.length === 0) return;
    setStatus('importing');
    setImportProgress(0);

    const supabase = createClient();
    let inserted = 0;
    const importErrors: string[] = [];

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      try {
        const payload = {
          full_name: row.full_name,
          job_title: row.job_title,
          department_id: row._department_id ?? null,
          supervisor_id: row._supervisor_id ?? null,
          supervisor_name: row.supervisor_name || null,
          serial_number: row.serial_number ? parseInt(row.serial_number, 10) : null,
          employment_status: ['active', 'inactive', 'on_leave', 'terminated'].includes(row.employment_status.toLowerCase())
            ? row.employment_status.toLowerCase()
            : 'active',
        };
        const { error } = await supabase.from('staff').insert(payload);
        if (error) {
          importErrors.push(`Row ${i + 1} (${row.full_name}): ${error.message}`);
        } else {
          inserted++;
        }
      } catch (err) {
        importErrors.push(`Row ${i + 1} (${row.full_name}): Unexpected error`);
      }
      setImportProgress(Math.round(((i + 1) / validRows.length) * 100));
    }

    setImportResults({ inserted, skipped: errorRows.length, errors: importErrors });
    setStatus('done');
    setToast({
      message: `Import complete: ${inserted} staff added${importErrors.length > 0 ? `, ${importErrors.length} failed` : ''}`,
      type: importErrors.length === 0 ? 'success' : 'error',
    });
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-700 text-foreground">Staff Bulk Import</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Upload a CSV or Excel file to import staff records with supervisor relationships, roles, and department mappings.
            </p>
          </div>
          <button
            onClick={downloadTemplate}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-white text-sm font-600 text-foreground hover:bg-muted transition-colors"
          >
            <Icon name="ArrowDownTrayIcon" size={16} />
            Download Template
          </button>
        </div>

        {/* Column guide */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Icon name="InformationCircleIcon" size={18} className="text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-600 text-blue-800 mb-1">Expected Columns</p>
              <div className="flex flex-wrap gap-2">
                {TEMPLATE_COLUMNS.map((col) => (
                  <span
                    key={col}
                    className={`px-2 py-0.5 rounded text-xs font-600 ${
                      REQUIRED_COLUMNS.includes(col)
                        ? 'bg-blue-200 text-blue-800' :'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {col}{REQUIRED_COLUMNS.includes(col) ? ' *' : ''}
                  </span>
                ))}
              </div>
              <p className="text-xs text-blue-600 mt-2">
                <span className="font-600">*</span> Required &nbsp;·&nbsp;
                <span className="font-600">department_name</span> must match an existing directorate/cluster &nbsp;·&nbsp;
                <span className="font-600">supervisor_name</span> must match an existing staff member's full name &nbsp;·&nbsp;
                <span className="font-600">employment_status</span>: active, inactive, on_leave, terminated
              </p>
            </div>
          </div>
        </div>

        {/* Upload zone */}
        {(status === 'idle' || status === 'error') && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all ${
              dragOver ? 'border-primary bg-primary/5' : 'border-border bg-muted/30 hover:border-primary/50 hover:bg-primary/5'
            }`}
          >
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Icon name="ArrowUpTrayIcon" size={28} className="text-primary" />
            </div>
            <div className="text-center">
              <p className="text-base font-600 text-foreground">Drop your file here or click to browse</p>
              <p className="text-sm text-muted-foreground mt-1">Supports .xlsx, .xls, and .csv files</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        )}

        {/* Parsing / validating spinner */}
        {(status === 'parsing' || status === 'validating') && (
          <div className="border border-border rounded-2xl p-12 flex flex-col items-center gap-4 bg-white">
            <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
            <p className="text-sm font-600 text-foreground">
              {status === 'parsing' ? 'Parsing file…' : 'Validating records against system data…'}
            </p>
            {fileName && <p className="text-xs text-muted-foreground">{fileName}</p>}
          </div>
        )}

        {/* Importing progress */}
        {status === 'importing' && (
          <div className="border border-border rounded-2xl p-8 bg-white space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full border-4 border-primary/20 border-t-primary animate-spin flex-shrink-0" />
              <div>
                <p className="text-sm font-600 text-foreground">Importing staff records…</p>
                <p className="text-xs text-muted-foreground">{importProgress}% complete</p>
              </div>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${importProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Done summary */}
        {status === 'done' && (
          <div className="border border-border rounded-2xl p-6 bg-white space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                <Icon name="EcsaSuccessIcon" size={22} className="text-emerald-600" />
              </div>
              <div>
                <p className="text-base font-700 text-foreground">Import Complete</p>
                <p className="text-sm text-muted-foreground">Review the results below</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                <p className="text-2xl font-700 text-emerald-700">{importResults.inserted}</p>
                <p className="text-xs text-emerald-600 font-600 mt-1">Records Inserted</p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                <p className="text-2xl font-700 text-amber-700">{importResults.skipped}</p>
                <p className="text-xs text-amber-600 font-600 mt-1">Rows Skipped (Errors)</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                <p className="text-2xl font-700 text-red-700">{importResults.errors.length}</p>
                <p className="text-xs text-red-600 font-600 mt-1">Insert Failures</p>
              </div>
            </div>
            {importResults.errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-1 max-h-40 overflow-y-auto">
                {importResults.errors.map((e, i) => (
                  <p key={i} className="text-xs text-red-700">{e}</p>
                ))}
              </div>
            )}
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-600 hover:bg-primary/90 transition-colors"
            >
              <Icon name="ArrowUpTrayIcon" size={15} />
              Import Another File
            </button>
          </div>
        )}

        {/* Preview table */}
        {status === 'ready' && rows.length > 0 && (
          <div className="space-y-4">
            {/* Summary bar */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-600 text-emerald-700">
                  <Icon name="EcsaSuccessIcon" size={14} />
                  {validRows.length} valid
                </span>
                {errorRows.length > 0 && (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-xs font-600 text-red-700">
                    <Icon name="EcsaErrorIcon" size={14} />
                    {errorRows.length} with errors
                  </span>
                )}
                <span className="text-xs text-muted-foreground">from <span className="font-600">{fileName}</span></span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-white text-sm font-600 text-muted-foreground hover:bg-muted transition-colors"
                >
                  <Icon name="EcsaCloseIcon" size={14} />
                  Clear
                </button>
                <button
                  onClick={handleImport}
                  disabled={validRows.length === 0}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-600 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Icon name="ArrowUpTrayIcon" size={15} />
                  Import {validRows.length} Record{validRows.length !== 1 ? 's' : ''}
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="bg-white border border-border rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="px-4 py-3 text-left text-xs font-600 text-muted-foreground w-8">#</th>
                      <th className="px-4 py-3 text-left text-xs font-600 text-muted-foreground">Full Name</th>
                      <th className="px-4 py-3 text-left text-xs font-600 text-muted-foreground">Job Title</th>
                      <th className="px-4 py-3 text-left text-xs font-600 text-muted-foreground">Department</th>
                      <th className="px-4 py-3 text-left text-xs font-600 text-muted-foreground">Supervisor</th>
                      <th className="px-4 py-3 text-left text-xs font-600 text-muted-foreground">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-600 text-muted-foreground">Validation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rows.map((row, idx) => (
                      <tr
                        key={idx}
                        className={`transition-colors ${
                          row._errors.length > 0 ? 'bg-red-50/50' : 'hover:bg-muted/20'
                        }`}
                      >
                        <td className="px-4 py-3 text-xs text-muted-foreground">{idx + 1}</td>
                        <td className="px-4 py-3">
                          <span className="font-600 text-foreground text-xs">{row.full_name || <span className="text-red-500 italic">missing</span>}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{row.job_title || <span className="text-red-500 italic">missing</span>}</td>
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
                            row.employment_status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                            row.employment_status === 'inactive'? 'bg-gray-100 text-gray-600' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {row.employment_status || 'active'}
                          </span>
                        </td>
                        <td className="px-4 py-3 max-w-xs">
                          {row._errors.length > 0 ? (
                            <div className="space-y-0.5">
                              {row._errors.map((e, i) => (
                                <p key={i} className="text-xs text-red-600 flex items-start gap-1">
                                  <Icon name="EcsaErrorIcon" size={12} className="flex-shrink-0 mt-0.5" />
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
                              <Icon name="EcsaSuccessIcon" size={12} />
                              Ready
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
