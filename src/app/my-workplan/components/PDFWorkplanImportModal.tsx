'use client';

import React, { useState, useRef, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import { extractTextFromPDF } from '@/lib/pdfExtract';

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

export interface ImportedWorkplanData {
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

interface PDFWorkplanImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (data: ImportedWorkplanData) => void;
}

// ─── ECSA-HC Standard Competencies ───────────────────────────────────────────

const STANDARD_COMPETENCIES: Omit<Competency, 'weight'>[] = [
  { id: 'c1', name: 'Teamwork', description: 'Creates a culture of teamwork and responds rationally to feedback.' },
  { id: 'c2', name: 'Respect for Diversity', description: 'Values individual differences and promotes a peaceful work environment.' },
  { id: 'c3', name: 'Integrity', description: 'Reliable, meets all deadlines, and takes credit only for own work.' },
  { id: 'c4', name: 'Communication', description: 'Explains complex issues clearly and uses visual aids effectively.' },
  { id: 'c5', name: 'Results Oriented', description: 'Prioritizes activities and matches tasks with team capabilities.' },
  { id: 'c6', name: 'Innovation', description: 'Thinks "outside the box" to foster team creativity.' },
  { id: 'c7', name: 'Leadership (GS3+)', description: 'Acts as a role model and provides timely specific feedback to staff.' },
];

const BSC_PERSPECTIVES = [
  'Financial/Stewardship',
  'Customer/Stakeholder',
  'Internal Business Processes',
  'Innovation Learning & Growth Perspective',
];

// ─── PDF Parsing Logic ────────────────────────────────────────────────────────

function parseWorkplanFromText(text: string, fileName: string): ImportedWorkplanData {
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const fullText = lines.join(' ');

  // ── Staff info extraction ──
  let staffName = '';
  let jobTitle = '';
  let directorate = '';
  let supervisorName = '';

  const nameMatch = fullText.match(/(?:Name|Employee)\s*[:\-]\s*([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){1,3})/);
  if (nameMatch) staffName = nameMatch[1].trim();

  const jobMatch = fullText.match(/(?:Job Title|Position|Title)\s*[:\-]\s*([^\n,]{5,60}?)(?:\s{2,}|Directorate|Cluster|Supervisor)/i);
  if (jobMatch) jobTitle = jobMatch[1].trim();

  const dirMatch = fullText.match(/(?:Directorate|Cluster)\s*[:\-]\s*([^\n,]{3,50}?)(?:\s{2,}|Supervisor|Name|$)/i);
  if (dirMatch) directorate = dirMatch[1].trim();

  const supMatch = fullText.match(/(?:Supervisor|Reporting to)\s*[:\-]\s*([A-Z][a-zA-Z\s\.]{3,50}?)(?:\s{2,}|Job Title|Date|$)/i);
  if (supMatch) supervisorName = supMatch[1].trim();

  // Fiscal year
  let fiscalYear = 'FY 2026-2027 (Jul–Jun)';
  let reviewYear = 2026;
  const fyMatch = fullText.match(/(?:FY|Fiscal Year|Review Period)\s*[:\-]?\s*(20\d{2}[-–\/]20?\d{2})/i);
  if (fyMatch) {
    const yearStr = fyMatch[1];
    const startYear = parseInt(yearStr.match(/20\d{2}/)?.[0] ?? '2026');
    fiscalYear = `FY ${yearStr} (Jul–Jun)`;
    reviewYear = startYear;
  } else {
    const yearRangeMatch = fullText.match(/July\s+(20\d{2})\s*[–\-to]+\s*June\s+(20\d{2})/i);
    if (yearRangeMatch) {
      fiscalYear = `FY ${yearRangeMatch[1]}-${yearRangeMatch[2]} (Jul–Jun)`;
      reviewYear = parseInt(yearRangeMatch[1]);
    }
  }

  // ── Scorecard rows extraction ──
  const perspectivesObjectives: PerspectiveRow[] = [];
  let currentPerspective = '';
  let rowIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const perspMatch = BSC_PERSPECTIVES.find((p) =>
      line.toLowerCase().includes(p.toLowerCase().substring(0, 15))
    );
    if (perspMatch) {
      currentPerspective = perspMatch;
      continue;
    }

    const wordCount = line.split(/\s+/).length;
    if (
      currentPerspective &&
      wordCount >= 8 &&
      wordCount <= 80 &&
      !line.match(/^(Part|Section|Total|Weight|Score|Rating|Signature|Date|Name|Job|Supervisor|Directorate)/i)
    ) {
      const kpiLabel = line;
      let target = '';
      let weight = 3;

      for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
        const nextLine = lines[j];
        const targetMatch = nextLine.match(/(?:Target|Goal)\s*[:\-]\s*(.+)/i);
        if (targetMatch) target = targetMatch[1].trim();

        const wMatch = nextLine.match(/(?:Weight|W)\s*[:\-]?\s*([1-5])\b/i);
        if (wMatch) weight = parseInt(wMatch[1]);
        else if (/^\s*[1-5]\s*$/.test(nextLine)) weight = parseInt(nextLine.trim());
      }

      rowIndex++;
      perspectivesObjectives.push({
        id: `row-pdf-${rowIndex}`,
        perspective: currentPerspective,
        objective: kpiLabel.length > 100 ? kpiLabel.substring(0, 100) + '...' : kpiLabel,
        keyActivities: kpiLabel,
        kpis: [
          {
            id: `kpi-pdf-${rowIndex}`,
            label: kpiLabel,
            target: target || 'As per workplan',
          },
        ],
        weight,
      });

      if (perspectivesObjectives.length >= 12) break;
    }
  }

  // ── Competencies extraction ──
  const generalCompetencies: Competency[] = STANDARD_COMPETENCIES.map((c, idx) => {
    const escapedName = c.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const compRegex = new RegExp(escapedName + '[^\\d]{0,30}([1-5])\\b', 'i');
    const match = fullText.match(compRegex);
    let weight = match ? parseInt(match[1]) : (idx < 5 ? 5 : idx === 5 ? 4 : 2);
    return { ...c, weight };
  });

  // ── Support required ──
  let supportRequired = '';
  const supportMatch = fullText.match(/(?:Support Required|Management Support)[^\n]{0,30}[:\-]\s*([^]{10,300}?)(?:Employee Signature|Supervisor Signature|$)/i);
  if (supportMatch) supportRequired = supportMatch[1].replace(/\s+/g, ' ').trim();

  if (!staffName && fileName) {
    const fnMatch = fileName.replace(/[-_]/g, ' ').match(/^([A-Z][a-z]+\s+[A-Z][a-z]+)/);
    if (fnMatch) staffName = fnMatch[1];
  }

  return {
    staffName: staffName || 'Unknown Staff',
    jobTitle: jobTitle || 'Staff Member',
    directorate: directorate || 'ECSA-HC',
    supervisorName: supervisorName || 'Supervisor',
    fiscalYear,
    reviewYear,
    perspectivesObjectives,
    generalCompetencies,
    supportRequired,
  };
}

type Step = 'upload' | 'parsing' | 'preview';

// ─── Component ────────────────────────────────────────────────────────────────

export default function PDFWorkplanImportModal({ isOpen, onClose, onImport }: PDFWorkplanImportModalProps) {
  const [step, setStep] = useState<Step>('upload');
  const [dragOver, setDragOver] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ImportedWorkplanData | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(async (file: File) => {
    if (file.type !== 'application/pdf') {
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
      const msg = err instanceof Error ? err.message : 'Failed to read PDF.';
      setParseError(msg);
      setStep('upload');
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

  function handleImport() {
    if (!parsedData) return;
    onImport(parsedData);
    onClose();
    resetState();
  }

  function resetState() {
    setStep('upload');
    setUploadedFile(null);
    setParsedData(null);
    setParseError(null);
  }

  function handleClose() {
    resetState();
    onClose();
  }

  if (!isOpen) return null;

  const bscTotal = parsedData?.perspectivesObjectives.reduce((s, r) => s + r.weight, 0) ?? 0;
  const compTotal = parsedData?.generalCompetencies.reduce((s, c) => s + c.weight, 0) ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-gradient-to-r from-primary/5 to-sky-50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Icon name="DocumentArrowUpIcon" size={22} className="text-primary" />
            </div>
            <div>
              <h2 className="text-base font-700 text-foreground">Import Workplan from PDF</h2>
              <p className="text-xs text-muted-foreground">ECSA-HC Individual Performance Contract</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-muted/60 text-muted-foreground transition-colors"
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
                Upload your ECSA-HC Individual Performance Contract PDF to pre-fill your workplan form automatically.
              </p>

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

              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-sky-50 border border-sky-200">
                <Icon name="InformationCircleIcon" size={16} className="text-sky-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-sky-800">
                  Upload your <strong>ECSA-HC Individual Performance Contract</strong> PDF. The system will extract your scorecard objectives, KPIs, weights, and competencies to pre-fill the form.
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
          {step === 'preview' && parsedData && (
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

              {parsedData.perspectivesObjectives.length === 0 && (
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200">
                  <Icon name="ExclamationTriangleIcon" size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800">
                    No scorecard rows were detected. Staff info will be pre-filled — you can add objectives manually in the form.
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

              {/* Competencies summary */}
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

              {/* Warning note */}
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-sky-50 border border-sky-200">
                <Icon name="InformationCircleIcon" size={16} className="text-sky-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-sky-800">
                  This will <strong>pre-fill your workplan form</strong> with the data above. You can review and edit all fields before saving or submitting. Your existing draft (if any) will be replaced.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 'preview' && parsedData && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/20 flex-shrink-0">
            <button
              onClick={() => { setStep('upload'); setUploadedFile(null); setParsedData(null); }}
              className="px-4 py-2 text-sm font-500 text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-lg transition-colors"
            >
              ← Back
            </button>
            <button
              onClick={handleImport}
              className="flex items-center gap-2 px-5 py-2 bg-primary text-white text-sm font-600 rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
            >
              <Icon name="ArrowDownTrayIcon" size={16} />
              Import Workplan Data
            </button>
          </div>
        )}

        {step === 'upload' && (
          <div className="flex items-center justify-end px-6 py-4 border-t border-border bg-muted/20 flex-shrink-0">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm font-500 text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
