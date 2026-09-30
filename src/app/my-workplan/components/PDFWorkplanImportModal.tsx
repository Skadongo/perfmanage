'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';

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

// ─── Pre-extracted data from Ayebare Timothy PDF ──────────────────────────────

const AYEBARE_TIMOTHY_DATA: ImportedWorkplanData = {
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

// ─── Component ────────────────────────────────────────────────────────────────

export default function PDFWorkplanImportModal({ isOpen, onClose, onImport }: PDFWorkplanImportModalProps) {
  const [step, setStep] = useState<'preview' | 'confirm'>('preview');
  const data = AYEBARE_TIMOTHY_DATA;

  if (!isOpen) return null;

  const bscTotal = data.perspectivesObjectives.reduce((s, r) => s + r.weight, 0);
  const compTotal = data.generalCompetencies.reduce((s, c) => s + c.weight, 0);

  function handleImport() {
    onImport(data);
    onClose();
    setStep('preview');
  }

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
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted/60 text-muted-foreground transition-colors"
          >
            <Icon name="XMarkIcon" size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Source file badge */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200">
            <Icon name="DocumentCheckIcon" size={20} className="text-emerald-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-600 text-emerald-800">Attached PDF detected</p>
              <p className="text-[11px] text-emerald-700 truncate">Ayebare_Timothy_ECSA-HC_INDIVIDUAL_PERFORMANCE_CONTRACT.pdf</p>
            </div>
            <span className="text-[10px] font-700 bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full flex-shrink-0">Ready</span>
          </div>

          {/* Staff info */}
          <div>
            <h3 className="text-xs font-700 uppercase tracking-wide text-muted-foreground mb-2">Staff Information</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-muted/30 border border-border">
                <p className="text-[10px] font-600 text-muted-foreground uppercase tracking-wide mb-0.5">Employee</p>
                <p className="text-sm font-600 text-foreground">{data.staffName}</p>
                <p className="text-xs text-muted-foreground">{data.jobTitle}</p>
              </div>
              <div className="p-3 rounded-xl bg-muted/30 border border-border">
                <p className="text-[10px] font-600 text-muted-foreground uppercase tracking-wide mb-0.5">Supervisor</p>
                <p className="text-sm font-600 text-foreground">{data.supervisorName}</p>
                <p className="text-xs text-muted-foreground">HEPRR MPA Coordinator</p>
              </div>
              <div className="p-3 rounded-xl bg-muted/30 border border-border">
                <p className="text-[10px] font-600 text-muted-foreground uppercase tracking-wide mb-0.5">Cluster / Directorate</p>
                <p className="text-sm font-600 text-foreground">{data.directorate}</p>
              </div>
              <div className="p-3 rounded-xl bg-muted/30 border border-border">
                <p className="text-[10px] font-600 text-muted-foreground uppercase tracking-wide mb-0.5">Review Period</p>
                <p className="text-sm font-600 text-foreground">{data.fiscalYear}</p>
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
              {data.perspectivesObjectives.map((row, i) => (
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

          {/* Competencies summary */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-700 uppercase tracking-wide text-muted-foreground">Part 2 — General Competencies (20%)</h3>
              <span className={`text-[11px] font-700 px-2 py-0.5 rounded-full ${compTotal === 20 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                Total weight: {compTotal}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {data.generalCompetencies.map((c) => (
                <div key={c.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-white">
                  <p className="text-xs font-500 text-foreground">{c.name}</p>
                  <span className="text-[11px] font-700 text-primary bg-primary/10 px-2 py-0.5 rounded-full">{c.weight}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Support required */}
          {data.supportRequired && (
            <div>
              <h3 className="text-xs font-700 uppercase tracking-wide text-muted-foreground mb-2">Management Support Required</h3>
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                <p className="text-xs text-amber-800">{data.supportRequired}</p>
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

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/20 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-500 text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            className="flex items-center gap-2 px-5 py-2 bg-primary text-white text-sm font-600 rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Icon name="ArrowDownTrayIcon" size={16} />
            Import Workplan Data
          </button>
        </div>
      </div>
    </div>
  );
}
