'use client';

import React, { useState, useRef, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { extractTextFromPDF, validateExtractedWorkplan, parseWorkplanFromText, type ValidationResult } from '@/lib/pdfExtract';

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

interface ParsedWorkplanData {
  staffName: string;
  jobTitle: string;
  directorate: string;
  supervisorName: string;
  fiscalYear: string;
  reviewYear: number;
  perspectivesObjectives: PerspectiveRow[];
  generalCompetencies: Competency[];
  supportRequired: string;
}

interface PDFWorkplanUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImported: () => void;
}

// ─── Staff Name Lookup ────────────────────────────────────────────────────────

/**
 * Attempts to find a staff record by name, handling reversed first/last name order.
 * Strategy:
 *  1. Exact ilike substring match (fast path)
 *  2. Token-based match — splits name into words and checks all tokens appear
 *     in the DB full_name regardless of order (handles "Ayebare Timothy" → "Timothy Ayebare")
 */
async function lookupStaffByName(
  supabase: ReturnType<typeof createClient>,
  extractedName: string
): Promise<{ id: string; full_name: string; job_title: string | null; supervisor_id: string | null } | null> {
  if (!extractedName || extractedName === 'Unknown Staff') return null;

  const normalise = (s: string) => s.toLowerCase().replace(/[^a-z\s]/g, '').trim();

  // ── 1. Direct substring match ──────────────────────────────────────────────
  const { data: directRows } = await supabase
    .from('staff')
    .select('id, full_name, job_title, supervisor_id')
    .ilike('full_name', `%${extractedName}%`)
    .limit(1);

  if (directRows && directRows.length > 0) return directRows[0];

  // ── 2. Token-based match (handles reversed name order) ────────────────────
  const tokens = extractedName.trim().split(/\s+/).filter((t) => t.length > 1);
  if (tokens.length < 2) return null;

  const longestToken = tokens.reduce((a, b) => (a.length >= b.length ? a : b));
  const { data: candidates } = await supabase
    .from('staff')
    .select('id, full_name, job_title, supervisor_id')
    .ilike('full_name', `%${longestToken}%`)
    .limit(30);

  if (!candidates || candidates.length === 0) return null;

  const normTokens = tokens.map(normalise);
  const match = candidates.find((row) => {
    const normFull = normalise(row.full_name);
    return normTokens.every((tok) => normFull.includes(tok));
  });

  return match ?? null;
}

type Step = 'upload' | 'parsing' | 'preview' | 'importing' | 'done';

// ─── Component ────────────────────────────────────────────────────────────────

export default function PDFWorkplanUploadModal({ isOpen, onClose, onImported }: PDFWorkplanUploadModalProps) {
  const [step, setStep] = useState<Step>('upload');
  const [dragOver, setDragOver] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedWorkplanData | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const handleFileSelect = useCallback(async (file: File) => {
    if (file.type !== 'application/pdf') {
      toast.error('Please upload a PDF file.');
      return;
    }
    setUploadedFile(file);
    setParseError(null);
    setStep('parsing');

    try {
      const text = await extractTextFromPDF(file);
      const data = parseWorkplanFromText(text, file.name);
      setParsedData(data);
      setStep('preview');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to read PDF. Please try again.';
      setParseError(msg);
      setStep('upload');
      toast.error('PDF parsing failed: ' + msg);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  async function handleImport() {
    if (!parsedData) return;
    setStep('importing');
    setImportError(null);

    try {
      // Look up staff by name — handles reversed first/last name order (e.g. "Ayabare Timothy" → "Timothy Ayabare")
      const staffRecord = await lookupStaffByName(supabase, parsedData.staffName);
      const staffId = staffRecord?.id ?? null;

      // ── Schema validation before insert ──────────────────────────────────
      const vResult = validateExtractedWorkplan(
        staffId,
        parsedData.perspectivesObjectives,
        parsedData.generalCompetencies
      );
      setValidationResult(vResult);

      if (!vResult.valid) {
        const firstError = vResult.errors[0]?.message ?? 'Validation failed. Please review the extracted data.';
        setImportError(firstError);
        setStep('preview');
        toast.error('Validation failed: ' + firstError);
        return;
      }
      // ─────────────────────────────────────────────────────────────────────

      // Look up supervisor by name if we have one
      let supervisorId: string | null = null;
      if (parsedData.supervisorName && parsedData.supervisorName !== 'Supervisor') {
        const { data: supRows } = await supabase
          .from('staff')
          .select('id')
          .ilike('full_name', `%${parsedData.supervisorName.split(' ').slice(-1)[0]}%`)
          .limit(1);
        supervisorId = supRows?.[0]?.id ?? staffRecord?.supervisor_id ?? null;
      } else if (staffRecord?.supervisor_id) {
        supervisorId = staffRecord.supervisor_id;
      }

      // Map to correct workplan_settings schema
      const perspectivesObjectives = parsedData.perspectivesObjectives.map((row) => ({
        id: row.id,
        perspective: row.perspective,
        objective: row.objective,
        keyActivities: row.keyActivities,
        kpis: row.kpis,
        weight: row.weight,
      }));

      const generalCompetencies = parsedData.generalCompetencies.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        weight: c.weight,
      }));

      const payload = {
        staff_id: staffId,
        supervisor_id: supervisorId,
        fiscal_year: parsedData.fiscalYear,
        review_year: parsedData.reviewYear,
        perspectives_objectives: perspectivesObjectives,
        general_competencies: generalCompetencies,
        status: 'draft',
        workflow_stage: 'workplan_pending',
        review_type: 'annual',
        custom_kpis: [],
      };

      const { error } = await supabase
        .from('workplan_settings')
        .insert(payload);

      if (error) throw error;

      setStep('done');
      toast.success('Workplan imported successfully from PDF!');
      onImported();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Import failed. Please try again.';
      setImportError(msg);
      setStep('preview');
      toast.error(msg);
    }
  }

  function handleClose() {
    setStep('upload');
    setUploadedFile(null);
    setParsedData(null);
    setImportError(null);
    setParseError(null);
    setValidationResult(null);
    onClose();
  }

  if (!isOpen) return null;

  const bscTotal = parsedData?.perspectivesObjectives.reduce((s, r) => s + r.weight, 0) ?? 0;
  const compTotal = parsedData?.generalCompetencies.reduce((s, c) => s + c.weight, 0) ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-gradient-to-r from-primary/5 to-sky-50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Icon name="DocumentArrowUpIcon" size={22} className="text-primary" />
            </div>
            <div>
              <h2 className="text-base font-700 text-foreground">Upload PDF Workplan</h2>
              <p className="text-xs text-muted-foreground">ECSA-HC Individual Performance Contract</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-muted/60 text-muted-foreground transition-colors"
            aria-label="Close"
          >
            <Icon name="XMarkIcon" size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* ── Step: Upload ── */}
          {step === 'upload' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Upload a staff member's ECSA-HC Individual Performance Contract PDF. The system will extract staff info, scorecard KPIs, and competencies automatically.
              </p>

              {/* Parse error */}
              {parseError && (
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-50 border border-red-200">
                  <Icon name="ExclamationTriangleIcon" size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-800">{parseError}</p>
                </div>
              )}

              {/* Drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-2xl p-10 cursor-pointer transition-all ${
                  dragOver
                    ? 'border-primary bg-primary/5 scale-[1.01]'
                    : 'border-border hover:border-primary/50 hover:bg-muted/20'
                }`}
              >
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Icon name="DocumentArrowUpIcon" size={28} className="text-primary" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-600 text-foreground">Drop your PDF here</p>
                  <p className="text-xs text-muted-foreground mt-0.5">or click to browse — PDF files only</p>
                </div>
                <span className="text-[11px] font-600 bg-primary/10 text-primary px-3 py-1 rounded-full">
                  Select PDF
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={handleFileInputChange}
                />
              </div>

              {/* Hint */}
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-sky-50 border border-sky-200">
                <Icon name="InformationCircleIcon" size={16} className="text-sky-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-sky-800">
                  Upload any <strong>ECSA-HC Individual Performance Contract</strong> PDF. The system will parse the scorecard objectives, KPIs, weights, and competencies from the document.
                </p>
              </div>
            </div>
          )}

          {/* ── Step: Parsing ── */}
          {step === 'parsing' && (
            <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Icon name="DocumentMagnifyingGlassIcon" size={32} className="text-primary animate-pulse" />
              </div>
              <div>
                <p className="text-base font-700 text-foreground">Parsing PDF…</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Extracting workplan data from <strong>{uploadedFile?.name}</strong>
                </p>
              </div>
              <div className="flex gap-1.5">
                <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}

          {/* ── Step: Preview ── */}
          {(step === 'preview' || step === 'importing') && parsedData && (
            <div className="space-y-5">
              {/* File badge */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                <Icon name="DocumentCheckIcon" size={20} className="text-emerald-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-600 text-emerald-800">PDF parsed successfully</p>
                  <p className="text-[11px] text-emerald-700 truncate">{uploadedFile?.name}</p>
                </div>
                <span className="text-[10px] font-700 bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full flex-shrink-0">Ready</span>
              </div>

              {/* Validation errors */}
              {validationResult && validationResult.errors.length > 0 && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 space-y-1.5">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon name="ExclamationTriangleIcon" size={16} className="text-red-600 flex-shrink-0" />
                    <p className="text-xs font-700 text-red-800">Validation Errors — import blocked</p>
                  </div>
                  {validationResult.errors.map((e, i) => (
                    <p key={i} className="text-xs text-red-700 pl-6">• {e.message}</p>
                  ))}
                </div>
              )}

              {/* Validation warnings */}
              {validationResult && validationResult.warnings.length > 0 && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 space-y-1.5">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon name="ExclamationTriangleIcon" size={16} className="text-amber-600 flex-shrink-0" />
                    <p className="text-xs font-700 text-amber-800">Warnings — review before importing</p>
                  </div>
                  {validationResult.warnings.map((w, i) => (
                    <p key={i} className="text-xs text-amber-700 pl-6">• {w.message}</p>
                  ))}
                </div>
              )}

              {/* Error */}
              {importError && (
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-50 border border-red-200">
                  <Icon name="ExclamationTriangleIcon" size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-800">{importError}</p>
                </div>
              )}

              {/* Partial parse warning */}
              {parsedData.perspectivesObjectives.length === 0 && !validationResult && (
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200">
                  <Icon name="ExclamationTriangleIcon" size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800">
                    No scorecard rows were detected in this PDF. The workplan will be imported with staff info only — you can add objectives manually after import.
                  </p>
                </div>
              )}

              {/* Staff info */}
              <div>
                <h3 className="text-xs font-700 uppercase tracking-wide text-muted-foreground mb-2">Staff Information</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-muted/30 border border-border">
                    <p className="text-[10px] font-600 text-muted-foreground uppercase tracking-wide mb-0.5">Employee</p>
                    <p className="text-sm font-600 text-foreground">{parsedData.staffName}</p>
                    <p className="text-xs text-muted-foreground">{parsedData.jobTitle}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-muted/30 border border-border">
                    <p className="text-[10px] font-600 text-muted-foreground uppercase tracking-wide mb-0.5">Supervisor</p>
                    <p className="text-sm font-600 text-foreground">{parsedData.supervisorName}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-muted/30 border border-border">
                    <p className="text-[10px] font-600 text-muted-foreground uppercase tracking-wide mb-0.5">Cluster / Directorate</p>
                    <p className="text-sm font-600 text-foreground">{parsedData.directorate}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-muted/30 border border-border">
                    <p className="text-[10px] font-600 text-muted-foreground uppercase tracking-wide mb-0.5">Review Period</p>
                    <p className="text-sm font-600 text-foreground">{parsedData.fiscalYear}</p>
                    <p className="text-xs text-muted-foreground">Biannual Appraisal</p>
                  </div>
                </div>
              </div>

              {/* Scorecard summary */}
              {parsedData.perspectivesObjectives.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-700 uppercase tracking-wide text-muted-foreground">Part 1 — Scorecard (80%)</h3>
                    <span className={`text-[11px] font-700 px-2 py-0.5 rounded-full ${bscTotal <= 80 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      Total weight: {bscTotal}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {parsedData.perspectivesObjectives.map((row, i) => (
                      <div key={row.id} className="p-3 rounded-xl border border-border bg-white">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-700 text-[10px] font-700 flex items-center justify-center flex-shrink-0">{i + 1}</span>
                            <span className="text-[10px] font-600 text-violet-700 bg-violet-50 px-2 py-0.5 rounded-full">{row.perspective}</span>
                          </div>
                          <span className="text-[11px] font-700 text-foreground bg-muted px-2 py-0.5 rounded-full flex-shrink-0">W: {row.weight}</span>
                        </div>
                        <p className="text-xs font-500 text-foreground mb-1 pl-7">{row.objective}</p>
                        <div className="pl-7 space-y-1">
                          {row.kpis.map((kpi) => (
                            <div key={kpi.id} className="flex items-start gap-1.5">
                              <div className="w-1 h-1 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                              <p className="text-[11px] text-muted-foreground leading-snug">
                                <span className="font-500 text-foreground">{kpi.label}</span>
                                {kpi.target && <span className="text-muted-foreground"> — Target: {kpi.target}</span>}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Competencies */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-700 uppercase tracking-wide text-muted-foreground">Part 2 — General Competencies (20%)</h3>
                  <span className={`text-[11px] font-700 px-2 py-0.5 rounded-full ${compTotal === 31 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    Total weight: {compTotal}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {parsedData.generalCompetencies.map((c) => (
                    <div key={c.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-white">
                      <p className="text-xs font-500 text-foreground">{c.name}</p>
                      <span className="text-[11px] font-700 text-primary bg-primary/10 px-2 py-0.5 rounded-full">{c.weight}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Support required */}
              {parsedData.supportRequired && (
                <div>
                  <h3 className="text-xs font-700 uppercase tracking-wide text-muted-foreground mb-2">Management Support Required</h3>
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                    <p className="text-xs text-amber-800">{parsedData.supportRequired}</p>
                  </div>
                </div>
              )}

              {/* Info note */}
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-sky-50 border border-sky-200">
                <Icon name="InformationCircleIcon" size={16} className="text-sky-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-sky-800">
                  Clicking <strong>Import as Workplan</strong> will save this data as a new workplan record with <strong>Draft</strong> status. It will appear in the workplan list for review and approval.
                </p>
              </div>
            </div>
          )}

          {/* ── Step: Done ── */}
          {step === 'done' && (
            <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                <Icon name="CheckCircleIcon" size={36} className="text-emerald-600" />
              </div>
              <div>
                <p className="text-base font-700 text-foreground">Workplan Imported!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  The workplan for <strong>{parsedData?.staffName}</strong> has been saved as a draft record.
                </p>
              </div>
              <button
                onClick={handleClose}
                className="px-6 py-2 bg-primary text-white text-sm font-600 rounded-lg hover:bg-primary/90 transition-colors"
              >
                Close
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {(step === 'preview' || step === 'importing') && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/20 flex-shrink-0">
            <button
              onClick={() => { setStep('upload'); setUploadedFile(null); setParsedData(null); }}
              disabled={step === 'importing'}
              className="px-4 py-2 text-sm font-500 text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-lg transition-colors disabled:opacity-50"
            >
              ← Back
            </button>
            <button
              onClick={handleImport}
              disabled={step === 'importing'}
              className="flex items-center gap-2 px-5 py-2 bg-primary text-white text-sm font-600 rounded-lg hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {step === 'importing' ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Importing…
                </>
              ) : (
                <>
                  <Icon name="ArrowDownTrayIcon" size={16} />
                  Import as Workplan
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
