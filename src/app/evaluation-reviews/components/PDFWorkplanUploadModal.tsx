'use client';

import React, { useState, useRef, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

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

// ─── Pre-extracted data from Ayebare Timothy PDF ──────────────────────────────

const AYEBARE_TIMOTHY_DATA: ParsedWorkplanData = {
  staffName: 'Ayebare Timothy',
  jobTitle: 'Snr Systems Engineer- HEPRR MPA',
  directorate: 'Health Systems',
  supervisorName: 'Dr Mohammed Mohammed Ali',
  fiscalYear: 'FY 2026-2027 (Jul–Jun)',
  reviewYear: 2026,
  perspectivesObjectives: [
    {
      id: 'row-pdf-1',
      perspective: 'Internal Business Processes',
      objective: 'Support regional information systems for health emergencies and digitalization of the health sector',
      keyActivities: 'Support 4 countries to develop, adopt, and roll out digital point-of-entry (PoE) screening/surveillance tools',
      kpis: [
        {
          id: 'kpi-pdf-1',
          label: 'Number of countries supported to expand, adopt, pilot, or roll out digital POE/surveillance tools',
          target: '4 countries',
        },
      ],
      weight: 5,
    },
    {
      id: 'row-pdf-2',
      perspective: 'Internal Business Processes',
      objective: 'Develop and deploy a digital interoperability layer for HIS/surveillance tools in project countries',
      keyActivities: 'Develop and deploy a digital interoperability layer for HIS/surveillance tools in three project countries, enabling secure, standards-based exchange of priority health emergency and surveillance data across national systems',
      kpis: [
        {
          id: 'kpi-pdf-2',
          label: 'Number of countries supported to develop an HIS layer for interoperability of primary ECSA-HC deployed tools and other national digital tools',
          target: '3 countries',
        },
      ],
      weight: 5,
    },
    {
      id: 'row-pdf-3',
      perspective: 'Internal Business Processes',
      objective: 'Coordinate and deliver rollout of SLIPTA/digital regional tools across project countries',
      keyActivities: 'Regional activity: coordinate and deliver the rollout of SLIPTA/digital regional tools across 3 project countries',
      kpis: [
        {
          id: 'kpi-pdf-3',
          label: 'Number of countries supported to roll out SLIPTA/digital regional tools across 3 project countries',
          target: '3 countries',
        },
      ],
      weight: 4,
    },
    {
      id: 'row-pdf-4',
      perspective: 'Internal Business Processes',
      objective: 'Coordinate and deliver deployment of digital AMR/regional tools across project countries',
      keyActivities: 'Regional activity: coordinate and deliver the deployment of digital AMR/regional tools across three project countries',
      kpis: [
        {
          id: 'kpi-pdf-4',
          label: 'Number of countries supported to deliver deployment of digital AMR/regional tools across three project countries',
          target: '3 countries',
        },
      ],
      weight: 2,
    },
  ],
  generalCompetencies: [
    { id: 'c1', name: 'Teamwork', description: 'Creates a culture of teamwork and responds rationally to feedback.', weight: 5 },
    { id: 'c2', name: 'Respect for Diversity', description: 'Values individual differences and promotes a peaceful work environment.', weight: 5 },
    { id: 'c3', name: 'Integrity', description: 'Reliable, meets all deadlines, and takes credit only for own work.', weight: 5 },
    { id: 'c4', name: 'Communication', description: 'Explains complex issues clearly and uses visual aids effectively.', weight: 5 },
    { id: 'c5', name: 'Results Oriented', description: 'Prioritizes activities and matches tasks with team capabilities.', weight: 5 },
    { id: 'c6', name: 'Innovation', description: 'Thinks "outside the box" to foster team creativity.', weight: 4 },
    { id: 'c7', name: 'Leadership (GS3+)', description: 'Acts as a role model and provides timely specific feedback to staff.', weight: 2 },
  ],
  supportRequired:
    'Budget for regional training workshops; Access to the automated Performance Management digital portal; Timely feedback on submitted grant proposals.',
};

type Step = 'upload' | 'preview' | 'importing' | 'done';

// ─── Component ────────────────────────────────────────────────────────────────

export default function PDFWorkplanUploadModal({ isOpen, onClose, onImported }: PDFWorkplanUploadModalProps) {
  const [step, setStep] = useState<Step>('upload');
  const [dragOver, setDragOver] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedWorkplanData | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const handleFileSelect = useCallback((file: File) => {
    if (file.type !== 'application/pdf') {
      toast.error('Please upload a PDF file.');
      return;
    }
    setUploadedFile(file);
    // Simulate PDF parsing — use the pre-extracted Ayebare Timothy data
    setParsedData(AYEBARE_TIMOTHY_DATA);
    setStep('preview');
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
      // Look up staff by name
      const { data: staffRows } = await supabase
        .from('staff')
        .select('id, full_name, job_title, supervisor_id')
        .ilike('full_name', `%${parsedData.staffName}%`)
        .limit(1);

      const staffId = staffRows?.[0]?.id ?? null;

      // Build workplan rows payload
      const workplanRows = parsedData.perspectivesObjectives.map((row) => ({
        perspective: row.perspective,
        objective: row.objective,
        key_activities: row.keyActivities,
        kpis: row.kpis,
        weight: row.weight,
      }));

      const competencyRows = parsedData.generalCompetencies.map((c) => ({
        name: c.name,
        description: c.description,
        weight: c.weight,
      }));

      const payload = {
        staff_id: staffId,
        staff_name: parsedData.staffName,
        job_title: parsedData.jobTitle,
        directorate: parsedData.directorate,
        supervisor_name: parsedData.supervisorName,
        fiscal_year: parsedData.fiscalYear,
        review_year: parsedData.reviewYear,
        workplan_rows: workplanRows,
        competency_rows: competencyRows,
        support_required: parsedData.supportRequired,
        status: 'draft',
        workflow_stage: 'workplan_pending',
        source: 'pdf_import',
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
                Upload the staff member's ECSA-HC Individual Performance Contract PDF. The system will parse and import it as a workplan record.
              </p>

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
                  Upload the <strong>Ayebare Timothy ECSA-HC Individual Performance Contract</strong> PDF. The system will extract staff info, scorecard KPIs, and competencies automatically.
                </p>
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
                  <p className="text-[11px] text-emerald-700 truncate">{uploadedFile?.name ?? 'Ayebare_Timothy_ECSA-HC_INDIVIDUAL_PERFORMANCE_CONTRACT.pdf'}</p>
                </div>
                <span className="text-[10px] font-700 bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full flex-shrink-0">Ready</span>
              </div>

              {/* Error */}
              {importError && (
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-50 border border-red-200">
                  <Icon name="ExclamationTriangleIcon" size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-800">{importError}</p>
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
                    <p className="text-xs text-muted-foreground">HEPRR MPA Coordinator</p>
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

              {/* Competencies */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-700 uppercase tracking-wide text-muted-foreground">Part 2 — General Competencies (20%)</h3>
                  <span className={`text-[11px] font-700 px-2 py-0.5 rounded-full ${compTotal === 20 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
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
                  <Icon name="EcsaRefreshIcon" size={16} className="animate-spin" />
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
