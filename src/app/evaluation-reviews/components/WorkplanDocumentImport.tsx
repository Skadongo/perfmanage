'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ParsedObjective {
  id: string;
  perspective: string;
  objective: string;
  kpis: { id: string; label: string; target: string }[];
  weight: number;
  keyActivities: string;
}

interface ParsedWorkplan {
  staffName: string;
  jobTitle: string;
  fiscalYear: string;
  supervisorName: string;
  objectives: ParsedObjective[];
  rawText: string;
}

interface StaffOption {
  id: string;
  full_name: string;
  job_title: string;
  supervisor_id: string | null;
  supervisor_name: string | null;
}

interface WorkplanDocumentImportProps {
  onClose: () => void;
  onPrefill: (data: {
    staffId: string;
    staffName: string;
    jobTitle: string;
    supervisorId: string;
    supervisorName: string;
    fiscalYear: string;
    perspectivesObjectives: ParsedObjective[];
  }) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const VALID_PERSPECTIVES = [
  'Financial/Stewardship',
  'Customer/Stakeholder',
  'Internal Business Processes',
  'Innovation Learning & Growth',
];

const PERSPECTIVE_ALIASES: Record<string, string> = {
  'financial': 'Financial/Stewardship',
  'stewardship': 'Financial/Stewardship',
  'financial/stewardship': 'Financial/Stewardship',
  'customer': 'Customer/Stakeholder',
  'stakeholder': 'Customer/Stakeholder',
  'customer/stakeholder': 'Customer/Stakeholder',
  'internal': 'Internal Business Processes',
  'internal business': 'Internal Business Processes',
  'internal business processes': 'Internal Business Processes',
  'innovation': 'Innovation Learning & Growth',
  'learning': 'Innovation Learning & Growth',
  'innovation learning': 'Innovation Learning & Growth',
  'innovation learning & growth': 'Innovation Learning & Growth',
  'innovation learning and growth': 'Innovation Learning & Growth',
};

// ─── Text Parsing Helpers ─────────────────────────────────────────────────────

function normalizePerspective(raw: string): string {
  const lower = raw.toLowerCase().trim();
  return PERSPECTIVE_ALIASES[lower] || raw.trim();
}

function extractField(text: string, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return '';
}

function extractFiscalYear(text: string): string {
  // Match patterns like "FY 2025-2026", "2025/2026", "2025-2026"
  const patterns = [
    /fiscal\s+year[:\s]+([FY\s\d\-\/]+)/i,
    /FY\s*(\d{4}[-\/]\d{4})/i,
    /(\d{4}[-\/]\d{4})/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1]) {
      const raw = m[1].trim().replace('/', '-');
      // Normalise to "FY YYYY-YYYY"
      if (/^\d{4}-\d{4}$/.test(raw)) return `FY ${raw}`;
      if (/^FY\s*\d{4}-\d{4}$/.test(raw)) return raw.replace(/FY\s*/, 'FY ');
      return raw;
    }
  }
  return 'FY 2025-2026';
}

/**
 * Parse plain text extracted from a Word/PDF document.
 * Looks for ECSA-HC contract template section markers.
 */
function parseWorkplanText(text: string): ParsedWorkplan {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const fullText = lines.join('\n');

  // Extract header fields
  const staffName = extractField(fullText, [
    /staff\s+name[:\s]+([^\n]+)/i,
    /name[:\s]+([^\n]+)/i,
    /employee[:\s]+([^\n]+)/i,
  ]);

  const jobTitle = extractField(fullText, [
    /job\s+title[:\s]+([^\n]+)/i,
    /position[:\s]+([^\n]+)/i,
    /designation[:\s]+([^\n]+)/i,
  ]);

  const supervisorName = extractField(fullText, [
    /supervisor[:\s]+([^\n]+)/i,
    /line\s+manager[:\s]+([^\n]+)/i,
    /reporting\s+to[:\s]+([^\n]+)/i,
  ]);

  const fiscalYear = extractFiscalYear(fullText);

  // Parse objectives table — look for perspective + objective + KPI blocks
  const objectives: ParsedObjective[] = [];
  let currentPerspective = '';
  let currentObjective = '';
  let currentKpis: string[] = [];
  let currentActivities = '';
  let currentWeight = 3;
  let inObjectiveBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineLower = line.toLowerCase();

    // Detect perspective header
    const perspMatch = VALID_PERSPECTIVES.find(
      (p) => lineLower.includes(p.toLowerCase())
    ) || normalizePerspective(line);

    if (VALID_PERSPECTIVES.includes(perspMatch)) {
      // Save previous block if any
      if (inObjectiveBlock && currentObjective) {
        objectives.push(buildObjective(currentPerspective, currentObjective, currentKpis, currentWeight, currentActivities));
      }
      currentPerspective = perspMatch;
      currentObjective = '';
      currentKpis = [];
      currentActivities = '';
      currentWeight = 3;
      inObjectiveBlock = false;
      continue;
    }

    // Detect objective line
    if (
      lineLower.startsWith('objective') ||
      lineLower.startsWith('goal') ||
      lineLower.match(/^\d+\.\s+[A-Z]/) // numbered objectives
    ) {
      if (inObjectiveBlock && currentObjective) {
        objectives.push(buildObjective(currentPerspective, currentObjective, currentKpis, currentWeight, currentActivities));
      }
      currentObjective = line.replace(/^(objective|goal)[:\s]*/i, '').replace(/^\d+\.\s*/, '').trim();
      currentKpis = [];
      currentActivities = '';
      currentWeight = 3;
      inObjectiveBlock = true;
      continue;
    }

    // Detect KPI lines
    if (lineLower.startsWith('kpi') || lineLower.startsWith('indicator') || lineLower.startsWith('measure')) {
      const kpiText = line.replace(/^(kpi|indicator|measure)[:\s]*/i, '').trim();
      if (kpiText) currentKpis.push(kpiText);
      continue;
    }

    // Detect weight
    const weightMatch = line.match(/weight[:\s]+(\d+)/i);
    if (weightMatch) {
      currentWeight = Math.min(5, Math.max(1, parseInt(weightMatch[1], 10)));
      continue;
    }

    // Detect key activities
    if (lineLower.startsWith('activit') || lineLower.startsWith('key activit')) {
      currentActivities = line.replace(/^(key\s+)?activit(y|ies)[:\s]*/i, '').trim();
      continue;
    }

    // If in an objective block and line looks like a KPI (bullet or dash)
    if (inObjectiveBlock && (line.startsWith('-') || line.startsWith('•') || line.startsWith('*'))) {
      const kpiText = line.replace(/^[-•*]\s*/, '').trim();
      if (kpiText && !lineLower.startsWith('activit')) {
        currentKpis.push(kpiText);
      }
    }
  }

  // Push last block
  if (inObjectiveBlock && currentObjective) {
    objectives.push(buildObjective(currentPerspective, currentObjective, currentKpis, currentWeight, currentActivities));
  }

  // If no structured objectives found, create a placeholder from the text
  if (objectives.length === 0 && fullText.length > 100) {
    objectives.push({
      id: `p-import-1`,
      perspective: 'Internal Business Processes',
      objective: 'Imported from document — please review and update',
      kpis: [{ id: 'kpi-1', label: 'Review and set KPI', target: '' }],
      weight: 3,
      keyActivities: '',
    });
  }

  return {
    staffName,
    jobTitle,
    fiscalYear,
    supervisorName,
    objectives,
    rawText: fullText.slice(0, 2000),
  };
}

function buildObjective(
  perspective: string,
  objective: string,
  kpis: string[],
  weight: number,
  keyActivities: string
): ParsedObjective {
  return {
    id: `p-import-${Date.now()}-${Math.random()}`,
    perspective: perspective || 'Internal Business Processes',
    objective,
    kpis: kpis.length > 0
      ? kpis.map((k, i) => ({ id: `kpi-${i}`, label: k, target: '' }))
      : [{ id: 'kpi-0', label: 'Review and set KPI', target: '' }],
    weight,
    keyActivities,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WorkplanDocumentImport({ onClose, onPrefill }: WorkplanDocumentImportProps) {
  const [parsed, setParsed] = useState<ParsedWorkplan | null>(null);
  const [staffList, setStaffList] = useState<StaffOption[]>([]);
  const [staffLoaded, setStaffLoaded] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [fileName, setFileName] = useState('');
  const [matchedStaff, setMatchedStaff] = useState<StaffOption | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [editedParsed, setEditedParsed] = useState<ParsedWorkplan | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const loadStaff = useCallback(async () => {
    if (staffLoaded) return;
    const { data } = await supabase
      .from('staff')
      .select('id, full_name, job_title, supervisor_id, supervisor_name')
      .eq('employment_status', 'active');
    setStaffList(data ?? []);
    setStaffLoaded(true);
  }, [staffLoaded, supabase]);

  React.useEffect(() => { loadStaff(); }, [loadStaff]);

  async function handleFile(file: File) {
    if (!file) return;
    setFileName(file.name);
    setParsing(true);
    setParsed(null);
    setEditedParsed(null);
    setMatchedStaff(null);
    setSelectedStaffId('');

    try {
      let text = '';

      if (file.name.endsWith('.docx') || file.name.endsWith('.doc')) {
        const mammoth = await import('mammoth');
        const buffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer: buffer });
        text = result.value;
      } else if (file.name.endsWith('.txt')) {
        text = await file.text();
      } else if (file.name.endsWith('.pdf')) {
        // PDF: read as text (basic extraction via FileReader)
        text = await file.text();
        if (!text || text.length < 50) {
          toast.error('PDF text extraction is limited. For best results, use a Word (.docx) file.');
          text = `Staff Name: \nJob Title: \nFiscal Year: FY 2025-2026\nSupervisor: \n\nObjective 1: Please fill in your objectives\nKPI: Set your KPI\nWeight: 3`;
        }
      } else {
        toast.error('Unsupported file type. Please upload a .docx or .txt file.');
        setParsing(false);
        return;
      }

      const result = parseWorkplanText(text);
      setParsed(result);
      setEditedParsed(result);

      // Auto-match staff
      if (result.staffName) {
        const match = staffList.find(
          (s) => s.full_name.toLowerCase() === result.staffName.toLowerCase()
        );
        if (match) {
          setMatchedStaff(match);
          setSelectedStaffId(match.id);
        }
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to parse document. Please check the file format.');
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

  function handlePrefill() {
    if (!editedParsed) return;

    const staffRecord = staffList.find((s) => s.id === selectedStaffId);
    if (!staffRecord) {
      toast.error('Please select a staff member to continue.');
      return;
    }

    onPrefill({
      staffId: staffRecord.id,
      staffName: staffRecord.full_name,
      jobTitle: staffRecord.job_title,
      supervisorId: staffRecord.supervisor_id ?? '',
      supervisorName: staffRecord.supervisor_name ?? '',
      fiscalYear: editedParsed.fiscalYear,
      perspectivesObjectives: editedParsed.objectives,
    });
  }

  function updateObjective(idx: number, field: keyof ParsedObjective, value: string | number) {
    if (!editedParsed) return;
    const updated = { ...editedParsed };
    updated.objectives = updated.objectives.map((obj, i) =>
      i === idx ? { ...obj, [field]: value } : obj
    );
    setEditedParsed(updated);
  }

  function removeObjective(idx: number) {
    if (!editedParsed) return;
    setEditedParsed({
      ...editedParsed,
      objectives: editedParsed.objectives.filter((_, i) => i !== idx),
    });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-white">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
            <Icon name="EcsaDocIcon" size={16} className="text-violet-600" />
          </div>
          <div>
            <h2 className="text-sm font-700 text-foreground">Word / PDF Document Import</h2>
            <p className="text-xs text-muted-foreground">Parse an ECSA-HC workplan document and pre-fill the form for review</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground">
          <Icon name="XMarkIcon" size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Info banner */}
        <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Icon name="EcsaInfoIcon" size={16} className="text-violet-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-600 text-violet-800 mb-1">How it works</p>
              <p className="text-xs text-violet-700">
                Upload a Word (.docx) or plain text file containing an ECSA-HC performance contract.
                The system will extract staff details, BSC perspectives, objectives, and KPIs,
                then pre-fill the workplan form for your review before saving.
                <strong className="block mt-1">Best results with .docx files. PDF support is basic text extraction only.</strong>
              </p>
            </div>
          </div>
        </div>

        {/* File upload */}
        <div>
          <p className="text-xs font-600 text-foreground mb-2">Upload your workplan document</p>
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-violet-400/50 hover:bg-violet-50/30 transition-all"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx,.doc,.txt,.pdf"
              className="hidden"
              onChange={handleFileInput}
            />
            {parsing ? (
              <div className="flex flex-col items-center gap-2">
                <Icon name="EcsaRefreshIcon" size={24} className="text-violet-600 animate-spin" />
                <p className="text-sm text-muted-foreground">Parsing document…</p>
              </div>
            ) : fileName ? (
              <div className="flex flex-col items-center gap-2">
                <Icon name="EcsaDocIcon" size={24} className="text-violet-600" />
                <p className="text-sm font-600 text-foreground">{fileName}</p>
                <p className="text-xs text-muted-foreground">Click to replace</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Icon name="EcsaDocIcon" size={28} className="text-muted-foreground/40" />
                <p className="text-sm font-600 text-foreground">Drop your Word or PDF document here</p>
                <p className="text-xs text-muted-foreground">or click to browse · .docx, .pdf, .txt supported</p>
              </div>
            )}
          </div>
        </div>

        {/* Parsed preview + editing */}
        {editedParsed && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Icon name="EcsaApprovedIcon" size={14} className="text-emerald-600" />
              <p className="text-xs font-600 text-foreground">Document parsed — review and confirm before pre-filling the form</p>
            </div>

            {/* Staff matching */}
            <div className="bg-white border border-border rounded-xl p-4 space-y-3">
              <p className="text-xs font-700 text-foreground">Staff Member</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-600 text-muted-foreground mb-1">Detected Name</label>
                  <p className="text-sm text-foreground bg-muted/20 rounded-lg px-3 py-2">
                    {editedParsed.staffName || <span className="text-muted-foreground italic">Not detected</span>}
                  </p>
                </div>
                <div>
                  <label className="block text-[11px] font-600 text-muted-foreground mb-1">
                    Match to System Staff <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedStaffId}
                    onChange={(e) => {
                      setSelectedStaffId(e.target.value);
                      const s = staffList.find((x) => x.id === e.target.value);
                      setMatchedStaff(s ?? null);
                    }}
                    className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="">— Select staff member —</option>
                    {staffList.map((s) => (
                      <option key={s.id} value={s.id}>{s.full_name} · {s.job_title}</option>
                    ))}
                  </select>
                  {matchedStaff && (
                    <p className="mt-1 text-[11px] text-emerald-700 flex items-center gap-1">
                      <Icon name="EcsaApprovedIcon" size={10} />
                      Auto-matched: {matchedStaff.full_name}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-600 text-muted-foreground mb-1">Fiscal Year</label>
                  <select
                    value={editedParsed.fiscalYear}
                    onChange={(e) => setEditedParsed({ ...editedParsed, fiscalYear: e.target.value })}
                    className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {['FY 2024-2025', 'FY 2025-2026', 'FY 2026-2027'].map((fy) => (
                      <option key={fy} value={fy}>{fy}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-600 text-muted-foreground mb-1">Supervisor (detected)</label>
                  <p className="text-sm text-foreground bg-muted/20 rounded-lg px-3 py-2">
                    {editedParsed.supervisorName || <span className="text-muted-foreground italic">Not detected</span>}
                  </p>
                </div>
              </div>
            </div>

            {/* Objectives preview */}
            <div className="bg-white border border-border rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20">
                <p className="text-xs font-700 text-foreground">
                  Extracted Objectives ({editedParsed.objectives.length})
                </p>
                <p className="text-[11px] text-muted-foreground">Review and edit before importing</p>
              </div>
              <div className="divide-y divide-border max-h-64 overflow-y-auto">
                {editedParsed.objectives.map((obj, idx) => (
                  <div key={obj.id} className="p-4 space-y-2">
                    <div className="flex items-start gap-2">
                      <span className="text-[10px] font-700 px-2 py-0.5 rounded-full bg-primary/10 text-primary flex-shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <div className="flex-1 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-600 text-muted-foreground mb-1">BSC Perspective</label>
                            <select
                              value={obj.perspective}
                              onChange={(e) => updateObjective(idx, 'perspective', e.target.value)}
                              className="w-full text-xs border border-border rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-primary/30"
                            >
                              {VALID_PERSPECTIVES.map((p) => (
                                <option key={p} value={p}>{p}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-600 text-muted-foreground mb-1">Weight (1–5)</label>
                            <input
                              type="number"
                              min={1}
                              max={5}
                              value={obj.weight}
                              onChange={(e) => updateObjective(idx, 'weight', parseInt(e.target.value, 10) || 1)}
                              className="w-full text-xs border border-border rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-primary/30"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-600 text-muted-foreground mb-1">Objective</label>
                          <input
                            type="text"
                            value={obj.objective}
                            onChange={(e) => updateObjective(idx, 'objective', e.target.value)}
                            className="w-full text-xs border border-border rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-primary/30"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-600 text-muted-foreground mb-1">
                            KPIs ({obj.kpis.length})
                          </label>
                          <div className="flex flex-wrap gap-1">
                            {obj.kpis.map((kpi) => (
                              <span key={kpi.id} className="text-[10px] bg-muted/40 border border-border rounded-full px-2 py-0.5 text-foreground">
                                {kpi.label}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => removeObjective(idx)}
                        className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors flex-shrink-0"
                        title="Remove objective"
                      >
                        <Icon name="XMarkIcon" size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <p className="text-xs text-amber-800">
                <strong>Note:</strong> After clicking "Pre-fill Form", the Workplan Setting Form will open with these values.
                You can review, edit, and add signatures before saving.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-white">
        <button
          onClick={onClose}
          className="text-xs font-600 text-muted-foreground hover:text-foreground px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handlePrefill}
          disabled={!editedParsed || !selectedStaffId}
          className="flex items-center gap-2 text-xs font-600 text-white bg-violet-600 hover:bg-violet-700 disabled:bg-muted disabled:text-muted-foreground px-4 py-2 rounded-lg transition-colors"
        >
          <Icon name="EcsaDocIcon" size={13} />
          Pre-fill Form for Review
        </button>
      </div>
    </div>
  );
}
