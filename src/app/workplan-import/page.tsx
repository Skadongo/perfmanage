'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { ParsedWorkplan, ParsedPerspective, ParsedCompetency } from '@/app/api/parse-workplan/route';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StaffOption {
  id: string;
  full_name: string;
  job_title: string;
  supervisor_id: string | null;
  supervisor_name: string | null;
}

type FileStatus = 'queued' | 'parsing' | 'parsed' | 'matching' | 'matched' | 'saving' | 'saved' | 'failed' | 'skipped';

interface FileEntry {
  id: string;
  file: File;
  status: FileStatus;
  parsed?: ParsedWorkplan;
  matchedStaffId?: string;
  matchedStaffName?: string;
  workplanId?: string;
  error?: string;
  parseWarnings?: string[];
}

type ImportPhase = 'upload' | 'review' | 'saving' | 'done';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();
}

function matchStaffByName(parsedName: string, staffList: StaffOption[]): StaffOption | null {
  if (!parsedName) return null;
  const norm = normalizeName(parsedName);
  // Exact match first
  let match = staffList.find((s) => normalizeName(s.full_name) === norm);
  if (match) return match;
  // Partial match: all words in parsed name appear in staff name
  const words = norm.split(' ').filter((w) => w.length > 2);
  match = staffList.find((s) => {
    const sn = normalizeName(s.full_name);
    return words.every((w) => sn.includes(w));
  });
  if (match) return match;
  // Reverse: all words in staff name appear in parsed name
  match = staffList.find((s) => {
    const sn = normalizeName(s.full_name);
    const sWords = sn.split(' ').filter((w) => w.length > 2);
    return sWords.length >= 2 && sWords.every((w) => norm.includes(w));
  });
  return match || null;
}

function statusColor(status: FileStatus): string {
  switch (status) {
    case 'saved': return 'text-green-600 bg-green-50';
    case 'failed': return 'text-red-600 bg-red-50';
    case 'skipped': return 'text-yellow-600 bg-yellow-50';
    case 'matched': return 'text-blue-600 bg-blue-50';
    case 'parsed': return 'text-indigo-600 bg-indigo-50';
    case 'parsing': case 'matching': case 'saving': return 'text-primary bg-primary/10';
    default: return 'text-muted-foreground bg-muted';
  }
}

function statusLabel(status: FileStatus): string {
  switch (status) {
    case 'queued': return 'Queued';
    case 'parsing': return 'Parsing…';
    case 'parsed': return 'Parsed';
    case 'matching': return 'Matching…';
    case 'matched': return 'Staff Matched';
    case 'saving': return 'Saving…';
    case 'saved': return 'Saved ✓';
    case 'failed': return 'Failed';
    case 'skipped': return 'Skipped';
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WorkplanBulkImportPage() {
  const { profile } = useAuth();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const [phase, setPhase] = useState<ImportPhase>('upload');
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [staffList, setStaffList] = useState<StaffOption[]>([]);
  const [fiscalYear, setFiscalYear] = useState('FY 2026-2027');
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [batchId, setBatchId] = useState<string | null>(null);
  const [expandedFile, setExpandedFile] = useState<string | null>(null);

  // Load staff list
  useEffect(() => {
    async function loadStaff() {
      const { data } = await supabase
        .from('staff')
        .select('id, full_name, job_title, supervisor_id')
        .order('full_name');
      if (data) setStaffList(data as StaffOption[]);
    }
    loadStaff();
  }, []);

  // ── File Selection ──
  const addFiles = useCallback((newFiles: File[]) => {
    const valid = newFiles.filter((f) => {
      const ext = f.name.split('.').pop()?.toLowerCase();
      return ['docx', 'doc', 'pdf'].includes(ext || '');
    });
    if (valid.length === 0) {
      setGlobalError('Only .docx, .doc, and .pdf files are supported.');
      return;
    }
    setGlobalError('');
    const entries: FileEntry[] = valid.map((f) => ({
      id: generateId(),
      file: f,
      status: 'queued',
    }));
    setFiles((prev) => {
      const combined = [...prev, ...entries];
      if (combined.length > 28) {
        setGlobalError('Maximum 28 files allowed per batch.');
        return combined.slice(0, 28);
      }
      return combined;
    });
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(Array.from(e.target.files));
    e.target.value = '';
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) addFiles(Array.from(e.dataTransfer.files));
  }, [addFiles]);

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);

  const removeFile = (id: string) => setFiles((prev) => prev.filter((f) => f.id !== id));
  const clearAll = () => { setFiles([]); setPhase('upload'); setBatchId(null); };

  // ── Parse Files ──
  const parseFiles = async () => {
    if (files.length === 0) return;
    setPhase('review');
    setGlobalError('');

    // Mark all as parsing
    setFiles((prev) => prev.map((f) => ({ ...f, status: 'parsing' as FileStatus })));

    // Send to API in batches of 5
    const BATCH_SIZE = 5;
    const allEntries = [...files];

    for (let i = 0; i < allEntries.length; i += BATCH_SIZE) {
      const batch = allEntries.slice(i, i + BATCH_SIZE);
      const formData = new FormData();
      batch.forEach((entry) => formData.append('files', entry.file));

      try {
        const res = await fetch('/api/parse-workplan', { method: 'POST', body: formData });
        const json = await res.json();

        if (!res.ok) {
          setFiles((prev) =>
            prev.map((f) =>
              batch.find((b) => b.id === f.id)
                ? { ...f, status: 'failed' as FileStatus, error: json.error || 'Parse failed' }
                : f
            )
          );
          continue;
        }

        const results: Array<{ filename: string; success: boolean; data?: ParsedWorkplan; error?: string }> = json.results;

        setFiles((prev) =>
          prev.map((f) => {
            const batchEntry = batch.find((b) => b.id === f.id);
            if (!batchEntry) return f;
            const result = results.find((r) => r.filename === batchEntry.file.name);
            if (!result) return { ...f, status: 'failed' as FileStatus, error: 'No parse result' };
            if (!result.success) return { ...f, status: 'failed' as FileStatus, error: result.error };

            // Auto-match staff
            const matched = matchStaffByName(result.data!.staffName, staffList);
            return {
              ...f,
              status: matched ? 'matched' : 'parsed',
              parsed: result.data,
              matchedStaffId: matched?.id,
              matchedStaffName: matched?.full_name,
              parseWarnings: result.data?.parseWarnings,
            };
          })
        );
      } catch (err: any) {
        setFiles((prev) =>
          prev.map((f) =>
            batch.find((b) => b.id === f.id)
              ? { ...f, status: 'failed' as FileStatus, error: err?.message || 'Network error' }
              : f
          )
        );
      }
    }
  };

  // ── Staff Override ──
  const updateStaffMatch = (fileId: string, staffId: string) => {
    const staff = staffList.find((s) => s.id === staffId);
    setFiles((prev) =>
      prev.map((f) =>
        f.id === fileId
          ? { ...f, matchedStaffId: staffId, matchedStaffName: staff?.full_name, status: 'matched' as FileStatus }
          : f
      )
    );
  };

  const skipFile = (fileId: string) => {
    setFiles((prev) => prev.map((f) => f.id === fileId ? { ...f, status: 'skipped' as FileStatus } : f));
  };

  // ── Save to Supabase ──
  const saveWorkplans = async () => {
    setPhase('saving');
    setGlobalError('');

    const toSave = files.filter((f) => f.status === 'matched' && f.matchedStaffId && f.parsed);
    if (toSave.length === 0) {
      setGlobalError('No matched files to save. Please match staff members first.');
      setPhase('review');
      return;
    }

    // Create batch record
    let currentBatchId = batchId;
    if (!currentBatchId) {
      const { data: batchData, error: batchErr } = await supabase
        .from('workplan_import_batches')
        .insert({
          total_files: files.length,
          successful: 0,
          failed: files.filter((f) => f.status === 'failed').length,
          skipped: files.filter((f) => f.status === 'skipped').length,
          fiscal_year: fiscalYear,
          status: 'processing',
        })
        .select('id')
        .single();

      if (batchErr || !batchData) {
        setGlobalError('Failed to create import batch: ' + (batchErr?.message || 'Unknown error'));
        setPhase('review');
        return;
      }
      currentBatchId = batchData.id;
      setBatchId(currentBatchId);
    }

    let savedCount = 0;

    for (const entry of toSave) {
      setFiles((prev) => prev.map((f) => f.id === entry.id ? { ...f, status: 'saving' as FileStatus } : f));

      try {
        const parsed = entry.parsed!;
        const staffId = entry.matchedStaffId!;

        // Find supervisor for this staff member
        const staffRecord = staffList.find((s) => s.id === staffId);

        // Build perspectives_objectives JSONB
        const perspectivesObjectives = parsed.perspectivesObjectives.map((p: ParsedPerspective) => ({
          id: generateId(),
          perspective: p.perspective,
          objective: p.objective,
          kpis: p.kpis.map((k) => ({ id: generateId(), label: k.label, target: k.target })),
          weight: p.weight,
          keyActivities: p.keyActivities || '',
        }));

        // Build general competencies
        const generalCompetencies = parsed.generalCompetencies.map((c: ParsedCompetency) => ({
          id: generateId(),
          name: c.name,
          description: c.description,
          weight: c.weight,
        }));

        // Check if workplan already exists for this staff + fiscal year
        const { data: existing } = await supabase
          .from('workplan_settings')
          .select('id')
          .eq('staff_id', staffId)
          .eq('fiscal_year', fiscalYear)
          .maybeSingle();

        let workplanId: string | null = null;

        if (existing && !overwriteExisting) {
          // Skip — already exists
          setFiles((prev) =>
            prev.map((f) =>
              f.id === entry.id
                ? { ...f, status: 'skipped' as FileStatus, error: 'Workplan already exists for this fiscal year' }
                : f
            )
          );

          await supabase.from('workplan_import_results').insert({
            batch_id: currentBatchId,
            filename: entry.file.name,
            staff_id: staffId,
            staff_name_parsed: parsed.staffName,
            job_title_parsed: parsed.jobTitle,
            fiscal_year: fiscalYear,
            status: 'skipped',
            error_message: 'Workplan already exists for this fiscal year',
            parse_warnings: parsed.parseWarnings,
            parsed_data: { perspectivesObjectives, generalCompetencies },
          });
          continue;
        }

        if (existing && overwriteExisting) {
          // Update existing
          const { data: updated, error: updateErr } = await supabase
            .from('workplan_settings')
            .update({
              supervisor_id: staffRecord?.supervisor_id || null,
              perspectives_objectives: perspectivesObjectives,
              status: 'draft',
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id)
            .select('id')
            .single();

          if (updateErr) throw new Error(updateErr.message);
          workplanId = updated?.id || existing.id;
        } else {
          // Insert new
          const { data: inserted, error: insertErr } = await supabase
            .from('workplan_settings')
            .insert({
              staff_id: staffId,
              supervisor_id: staffRecord?.supervisor_id || null,
              fiscal_year: fiscalYear,
              review_year: parseInt(fiscalYear.replace(/[^0-9]/g, '').slice(0, 4)) || 2026,
              perspectives_objectives: perspectivesObjectives,
              status: 'draft',
            })
            .select('id')
            .single();

          if (insertErr) throw new Error(insertErr.message);
          workplanId = inserted?.id || null;
        }

        // Log result
        await supabase.from('workplan_import_results').insert({
          batch_id: currentBatchId,
          filename: entry.file.name,
          staff_id: staffId,
          workplan_id: workplanId,
          staff_name_parsed: parsed.staffName,
          job_title_parsed: parsed.jobTitle,
          fiscal_year: fiscalYear,
          status: 'saved',
          parse_warnings: parsed.parseWarnings,
          parsed_data: { perspectivesObjectives, generalCompetencies },
        });

        savedCount++;
        setFiles((prev) =>
          prev.map((f) =>
            f.id === entry.id ? { ...f, status: 'saved' as FileStatus, workplanId: workplanId || undefined } : f
          )
        );
      } catch (err: any) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === entry.id ? { ...f, status: 'failed' as FileStatus, error: err?.message || 'Save error' } : f
          )
        );

        await supabase.from('workplan_import_results').insert({
          batch_id: currentBatchId,
          filename: entry.file.name,
          staff_id: entry.matchedStaffId,
          staff_name_parsed: entry.parsed?.staffName,
          fiscal_year: fiscalYear,
          status: 'failed',
          error_message: err?.message || 'Save error',
          parse_warnings: entry.parsed?.parseWarnings,
        });
      }
    }

    // Update batch totals
    const finalFiles = files;
    await supabase
      .from('workplan_import_batches')
      .update({
        successful: savedCount,
        failed: finalFiles.filter((f) => f.status === 'failed').length,
        skipped: finalFiles.filter((f) => f.status === 'skipped').length,
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', currentBatchId);

    setPhase('done');
  };

  // ── Counts ──
  const counts = {
    total: files.length,
    queued: files.filter((f) => f.status === 'queued').length,
    parsed: files.filter((f) => ['parsed', 'matched'].includes(f.status)).length,
    matched: files.filter((f) => f.status === 'matched').length,
    saved: files.filter((f) => f.status === 'saved').length,
    failed: files.filter((f) => f.status === 'failed').length,
    skipped: files.filter((f) => f.status === 'skipped').length,
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-700 text-foreground">Bulk Workplan Importer</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Upload up to 28 ECSA-HC Individual Performance Contract documents (.docx or .pdf) to import staff workplans in bulk.
            </p>
          </div>
          {phase !== 'upload' && (
            <button
              onClick={clearAll}
              className="flex items-center gap-2 px-3 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors text-muted-foreground"
            >
              <Icon name="ArrowPathIcon" size={15} />
              Start Over
            </button>
          )}
        </div>

        {/* Progress Steps */}
        <div className="flex items-center gap-2 text-sm">
          {(['upload', 'review', 'saving', 'done'] as ImportPhase[]).map((p, idx) => {
            const labels = { upload: '1. Upload Files', review: '2. Review & Match', saving: '3. Saving', done: '4. Complete' };
            const isActive = phase === p;
            const isDone = ['upload', 'review', 'saving', 'done'].indexOf(phase) > idx;
            return (
              <React.Fragment key={p}>
                <span className={`px-3 py-1 rounded-full text-xs font-600 ${isActive ? 'bg-primary text-white' : isDone ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                  {labels[p]}
                </span>
                {idx < 3 && <Icon name="ChevronRightIcon" size={14} className="text-muted-foreground" />}
              </React.Fragment>
            );
          })}
        </div>

        {/* Global Error */}
        {globalError && (
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            <Icon name="ExclamationCircleIcon" size={18} className="flex-shrink-0 mt-0.5" />
            <span>{globalError}</span>
          </div>
        )}

        {/* ── Phase: Upload ── */}
        {phase === 'upload' && (
          <div className="space-y-4">
            {/* Settings Row */}
            <div className="flex flex-wrap items-center gap-4 p-4 bg-muted/40 rounded-lg border border-border">
              <div className="flex items-center gap-2">
                <label className="text-sm font-600 text-foreground whitespace-nowrap">Fiscal Year:</label>
                <select
                  value={fiscalYear}
                  onChange={(e) => setFiscalYear(e.target.value)}
                  className="text-sm border border-border rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option>FY 2024-2025</option>
                  <option>FY 2025-2026</option>
                  <option>FY 2026-2027</option>
                  <option>FY 2027-2028</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={overwriteExisting}
                  onChange={(e) => setOverwriteExisting(e.target.checked)}
                  className="rounded border-border"
                />
                <span>Overwrite existing workplans</span>
              </label>
            </div>

            {/* Drop Zone */}
            <div
              ref={dropZoneRef}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
                isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".docx,.doc,.pdf"
                onChange={handleFileInput}
                className="hidden"
              />
              <div className="flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <Icon name="DocumentArrowUpIcon" size={28} className="text-primary" />
                </div>
                <div>
                  <p className="text-base font-600 text-foreground">
                    {isDragging ? 'Drop files here' : 'Drag & drop performance contracts here'}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    or <span className="text-primary font-600">click to browse</span> — supports .docx and .pdf (max 28 files)
                  </p>
                </div>
              </div>
            </div>

            {/* File List Preview */}
            {files.length > 0 && (
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-muted/40 border-b border-border">
                  <span className="text-sm font-600 text-foreground">{files.length} file{files.length !== 1 ? 's' : ''} selected</span>
                  <button onClick={() => setFiles([])} className="text-xs text-muted-foreground hover:text-red-600 transition-colors">
                    Clear all
                  </button>
                </div>
                <div className="divide-y divide-border max-h-64 overflow-y-auto">
                  {files.map((entry) => (
                    <div key={entry.id} className="flex items-center gap-3 px-4 py-2.5">
                      <Icon name={entry.file.name.endsWith('.pdf') ? 'DocumentTextIcon' : 'DocumentIcon'} size={18} className="text-muted-foreground flex-shrink-0" />
                      <span className="flex-1 text-sm text-foreground truncate">{entry.file.name}</span>
                      <span className="text-xs text-muted-foreground">{(entry.file.size / 1024).toFixed(0)} KB</span>
                      <button onClick={() => removeFile(entry.id)} className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors">
                        <Icon name="XMarkIcon" size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Parse Button */}
            <div className="flex justify-end">
              <button
                onClick={parseFiles}
                disabled={files.length === 0}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-lg font-600 text-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Icon name="DocumentMagnifyingGlassIcon" size={18} />
                Parse {files.length > 0 ? `${files.length} File${files.length !== 1 ? 's' : ''}` : 'Files'}
              </button>
            </div>
          </div>
        )}

        {/* ── Phase: Review ── */}
        {(phase === 'review' || phase === 'saving') && (
          <div className="space-y-4">
            {/* Summary Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Total', value: counts.total, color: 'text-foreground bg-muted' },
                { label: 'Matched', value: counts.matched, color: 'text-blue-700 bg-blue-50' },
                { label: 'Unmatched', value: counts.parsed - counts.matched, color: 'text-yellow-700 bg-yellow-50' },
                { label: 'Failed', value: counts.failed, color: 'text-red-700 bg-red-50' },
              ].map((s) => (
                <div key={s.label} className={`rounded-lg px-4 py-3 ${s.color}`}>
                  <p className="text-2xl font-700">{s.value}</p>
                  <p className="text-xs font-500 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            {/* File Review Table */}
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="px-4 py-3 bg-muted/40 border-b border-border">
                <p className="text-sm font-600 text-foreground">Review & Match Staff Members</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Verify each file is matched to the correct staff member. Use the dropdown to correct mismatches.
                </p>
              </div>
              <div className="divide-y divide-border">
                {files.map((entry) => (
                  <div key={entry.id} className="p-4 space-y-3">
                    {/* File Header Row */}
                    <div className="flex items-start gap-3">
                      <Icon
                        name={entry.file.name.endsWith('.pdf') ? 'DocumentTextIcon' : 'DocumentIcon'}
                        size={18}
                        className="text-muted-foreground flex-shrink-0 mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-600 text-foreground truncate">{entry.file.name}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-600 ${statusColor(entry.status)}`}>
                            {statusLabel(entry.status)}
                          </span>
                        </div>
                        {entry.parsed && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Parsed: <span className="font-500 text-foreground">{entry.parsed.staffName}</span>
                            {entry.parsed.jobTitle && <> · {entry.parsed.jobTitle}</>}
                            {entry.parsed.fiscalYear && <> · {entry.parsed.fiscalYear}</>}
                          </p>
                        )}
                        {entry.error && (
                          <p className="text-xs text-red-600 mt-0.5">{entry.error}</p>
                        )}
                        {entry.parseWarnings && entry.parseWarnings.length > 0 && (
                          <p className="text-xs text-yellow-600 mt-0.5">
                            ⚠ {entry.parseWarnings.join(' · ')}
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {entry.parsed && (
                          <button
                            onClick={() => setExpandedFile(expandedFile === entry.id ? null : entry.id)}
                            className="p-1.5 rounded hover:bg-muted text-muted-foreground transition-colors"
                            title="Preview parsed data"
                          >
                            <Icon name={expandedFile === entry.id ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={14} />
                          </button>
                        )}
                        {entry.status !== 'skipped' && entry.status !== 'saved' && (
                          <button
                            onClick={() => skipFile(entry.id)}
                            className="text-xs px-2 py-1 rounded border border-border hover:bg-muted text-muted-foreground transition-colors"
                          >
                            Skip
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Staff Matcher */}
                    {entry.status !== 'failed' && entry.status !== 'skipped' && entry.status !== 'saved' && entry.parsed && (
                      <div className="flex items-center gap-3 pl-7">
                        <label className="text-xs font-600 text-muted-foreground whitespace-nowrap">Match to staff:</label>
                        <select
                          value={entry.matchedStaffId || ''}
                          onChange={(e) => updateStaffMatch(entry.id, e.target.value)}
                          className="flex-1 text-sm border border-border rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                          disabled={phase === 'saving'}
                        >
                          <option value="">— Select staff member —</option>
                          {staffList.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.full_name} {s.job_title ? `(${s.job_title})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Expanded Preview */}
                    {expandedFile === entry.id && entry.parsed && (
                      <div className="pl-7 space-y-3">
                        <div className="bg-muted/30 rounded-lg p-3 text-xs space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div><span className="font-600 text-muted-foreground">Supervisor:</span> <span className="text-foreground">{entry.parsed.supervisorName || '—'}</span></div>
                            <div><span className="font-600 text-muted-foreground">Cluster:</span> <span className="text-foreground">{entry.parsed.cluster || '—'}</span></div>
                            <div><span className="font-600 text-muted-foreground">Appraisal Type:</span> <span className="text-foreground">{entry.parsed.appraisalType}</span></div>
                            <div><span className="font-600 text-muted-foreground">Fiscal Year:</span> <span className="text-foreground">{entry.parsed.fiscalYear}</span></div>
                          </div>
                          {entry.parsed.perspectivesObjectives.length > 0 && (
                            <div>
                              <p className="font-600 text-muted-foreground mb-1">Scorecard Objectives ({entry.parsed.perspectivesObjectives.length}):</p>
                              <ul className="space-y-1">
                                {entry.parsed.perspectivesObjectives.map((p, i) => (
                                  <li key={i} className="flex items-start gap-2">
                                    <span className="text-primary font-600">{p.perspective}:</span>
                                    <span className="text-foreground">{p.objective}</span>
                                    <span className="text-muted-foreground ml-auto">({p.kpis.length} KPIs, wt: {p.weight})</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {entry.parsed.perspectivesObjectives.length === 0 && (
                            <p className="text-yellow-600">⚠ No scorecard objectives extracted — workplan will be saved as empty draft for manual entry.</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between gap-4">
              <button
                onClick={() => setPhase('upload')}
                disabled={phase === 'saving'}
                className="flex items-center gap-2 px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors text-muted-foreground disabled:opacity-50"
              >
                <Icon name="ArrowLeftIcon" size={15} />
                Back
              </button>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">
                  {counts.matched} of {counts.total} files ready to save
                </span>
                <button
                  onClick={saveWorkplans}
                  disabled={counts.matched === 0 || phase === 'saving'}
                  className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-lg font-600 text-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {phase === 'saving' ? (
                    <>
                      <Icon name="ArrowPathIcon" size={16} className="animate-spin" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <Icon name="CloudArrowUpIcon" size={18} />
                      Save {counts.matched} Workplan{counts.matched !== 1 ? 's' : ''}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Phase: Done ── */}
        {phase === 'done' && (
          <div className="space-y-6">
            {/* Success Banner */}
            <div className="flex items-start gap-4 p-6 bg-green-50 border border-green-200 rounded-xl">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                <Icon name="CheckCircleIcon" size={28} className="text-green-600" />
              </div>
              <div>
                <h2 className="text-lg font-700 text-green-800">Import Complete</h2>
                <p className="text-sm text-green-700 mt-1">
                  Successfully saved <strong>{counts.saved}</strong> workplan{counts.saved !== 1 ? 's' : ''} to the database.
                  {counts.skipped > 0 && <> {counts.skipped} file{counts.skipped !== 1 ? 's were' : ' was'} skipped.</>}
                  {counts.failed > 0 && <> {counts.failed} file{counts.failed !== 1 ? 's' : ''} failed.</>}
                </p>
              </div>
            </div>

            {/* Result Summary */}
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="px-4 py-3 bg-muted/40 border-b border-border">
                <p className="text-sm font-600 text-foreground">Import Results</p>
              </div>
              <div className="divide-y divide-border">
                {files.map((entry) => (
                  <div key={entry.id} className="flex items-center gap-3 px-4 py-3">
                    <Icon
                      name={entry.status === 'saved' ? 'CheckCircleIcon' : entry.status === 'skipped' ? 'MinusCircleIcon' : 'XCircleIcon'}
                      size={18}
                      className={entry.status === 'saved' ? 'text-green-500' : entry.status === 'skipped' ? 'text-yellow-500' : 'text-red-500'}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-500 text-foreground truncate">{entry.file.name}</p>
                      {entry.matchedStaffName && (
                        <p className="text-xs text-muted-foreground">{entry.matchedStaffName}</p>
                      )}
                      {entry.error && <p className="text-xs text-red-600">{entry.error}</p>}
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-600 ${statusColor(entry.status)}`}>
                      {statusLabel(entry.status)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={clearAll}
                className="flex items-center gap-2 px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors text-muted-foreground"
              >
                <Icon name="ArrowPathIcon" size={15} />
                Import More Files
              </button>
              <a
                href="/evaluation-reviews"
                className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-white rounded-lg font-600 hover:bg-primary/90 transition-colors"
              >
                <Icon name="ClipboardDocumentListIcon" size={16} />
                View Workplans
              </a>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
