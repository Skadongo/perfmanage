'use client';

// ─── PDF Text Extraction via CDN-loaded pdfjs-dist ────────────────────────────
// Loads pdfjs from CDN at runtime to avoid build-time module resolution issues

/* eslint-disable @typescript-eslint/no-explicit-any */

const PDFJS_VERSION = '3.11.174';
const PDFJS_CDN = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.js`;
const PDFJS_WORKER_CDN = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;

let pdfjsLoaded = false;

async function loadPdfjsFromCDN(): Promise<any> {
  if (typeof window === 'undefined') throw new Error('PDF extraction requires browser environment');

  // Return cached global if already loaded
  if (pdfjsLoaded && (window as any).pdfjsLib) {
    return (window as any).pdfjsLib;
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = PDFJS_CDN;
    script.onload = () => {
      const lib = (window as any).pdfjsLib;
      if (!lib) { reject(new Error('pdfjs-dist failed to load')); return; }
      lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_CDN;
      pdfjsLoaded = true;
      resolve(lib);
    };
    script.onerror = () => reject(new Error('Failed to load PDF library from CDN'));
    document.head.appendChild(script);
  });
}

export async function extractTextFromPDF(file: File): Promise<string> {
  const pdfjsLib = await loadPdfjsFromCDN();

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdf = await loadingTask.promise;

  const textParts: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = (content.items as Array<{ str?: string }>)
      .map((item) => item.str ?? '')
      .join(' ');
    textParts.push(pageText);
  }

  return textParts.join('\n');
}

// ─── Shared Types ─────────────────────────────────────────────────────────────

export interface KPIEntry {
  id: string;
  label: string;
  target: string;
}

export interface PerspectiveRow {
  id: string;
  perspective: string;
  objective: string;
  keyActivities: string;
  kpis: KPIEntry[];
  weight: number;
}

export interface CompetencyEntry {
  id: string;
  name: string;
  description: string;
  weight: number;
}

export interface ParsedWorkplanData {
  staffName: string;
  jobTitle: string;
  directorate: string;
  supervisorName: string;
  fiscalYear: string;
  reviewYear: number;
  perspectivesObjectives: PerspectiveRow[];
  generalCompetencies: CompetencyEntry[];
  supportRequired: string;
}

// ─── ECSA-HC Standard Competencies ───────────────────────────────────────────

const STANDARD_COMPETENCIES: Omit<CompetencyEntry, 'weight'>[] = [
  { id: 'c1', name: 'Teamwork', description: 'Creates a culture of teamwork and responds rationally to feedback.' },
  { id: 'c2', name: 'Respect for Diversity', description: 'Values individual differences and promotes a peaceful work environment.' },
  { id: 'c3', name: 'Integrity', description: 'Reliable, meets all deadlines, and takes credit only for own work.' },
  { id: 'c4', name: 'Communication', description: 'Explains complex issues clearly and uses visual aids effectively.' },
  { id: 'c5', name: 'Results Oriented', description: 'Prioritizes activities and matches tasks with team capabilities.' },
  { id: 'c6', name: 'Innovation', description: 'Thinks "outside the box" to foster team creativity.' },
  { id: 'c7', name: 'Leadership (GS3+)', description: 'Acts as a role model and provides timely specific feedback to staff.' },
];

// Standard BSC perspective labels — used as fallback when PDF uses non-standard headers
const BSC_PERSPECTIVES = [
  'Financial/Stewardship',
  'Customer/Stakeholder',
  'Internal Business Processes',
  'Innovation Learning & Growth Perspective',
];

// ─── Perspective Header Detection ────────────────────────────────────────────

/**
 * Detects whether a line looks like a perspective/section header.
 * Accepts both standard BSC headers and non-standard ones
 * (e.g. "HEPRR-MPA Component Subcomponent 1.4").
 */
export function detectPerspectiveHeader(line: string): string | null {
  // Check standard BSC perspectives first
  const stdMatch = BSC_PERSPECTIVES.find((p) =>
    line.toLowerCase().includes(p.toLowerCase().substring(0, 15))
  );
  if (stdMatch) return stdMatch;

  // Detect non-standard component/subcomponent headers
  if (
    /\b(component|subcomponent|programme|program|cluster|pillar|strategic\s+objective)\b/i.test(line) &&
    line.split(/\s+/).length <= 12
  ) {
    return line.trim();
  }

  // Detect "Part X" or "Section X" headers that introduce scorecard sections
  if (/^(Part|Section)\s+[1-9IVX]/i.test(line) && line.split(/\s+/).length <= 8) {
    return line.trim();
  }

  return null;
}

// ─── Scorecard Row Extraction ─────────────────────────────────────────────────

/**
 * Extracts scorecard rows from PDF text lines using a flexible multi-pass strategy.
 *
 * Pass 1 — Structured: detect perspective headers, then collect objective/KPI/target/weight blocks.
 * Pass 2 — Fallback: if Pass 1 yields nothing, scan for objective-like lines followed by a weight digit.
 *
 * Handles:
 *  - Standard BSC perspectives (Financial/Stewardship, Customer/Stakeholder, etc.)
 *  - Non-standard headers (HEPRR-MPA Component Subcomponent 1.4, Programme Cluster, etc.)
 *  - Explicit "Weight: N" lines and standalone digit lines
 *  - KPI / Target label lines
 */
export function extractScorecardRows(lines: string[]): PerspectiveRow[] {
  const rows: PerspectiveRow[] = [];
  let currentPerspective = '';
  let rowIndex = 0;

  // ── Pass 1: Structured extraction ─────────────────────────────────────────
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect perspective/section header
    const perspHeader = detectPerspectiveHeader(line);
    if (perspHeader) {
      currentPerspective = perspHeader;
      continue;
    }

    if (!currentPerspective) continue;

    // Skip header-like lines
    if (/^(Part|Section|Total|Weight|Score|Rating|Signature|Date|Name|Job|Supervisor|Directorate|Employee|Staff)\b/i.test(line)) continue;
    const wordCount = line.split(/\s+/).length;
    if (wordCount < 5 || wordCount > 100) continue;
    if (/^\d+(\.\d+)?$/.test(line)) continue;

    // Look ahead for KPI label, target, and weight within the next 10 lines
    let objective = line;
    let kpiLabel = '';
    let target = '';
    let weight = 3;
    let lookaheadConsumed = 0;

    for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
      const next = lines[j];

      // Stop if we hit another perspective header
      if (detectPerspectiveHeader(next)) break;

      // KPI line
      if (/^(KPI|Key Performance Indicator|Indicator)\s*[:\-]/i.test(next)) {
        kpiLabel = next.replace(/^(KPI|Key Performance Indicator|Indicator)\s*[:\-]\s*/i, '').trim();
        lookaheadConsumed = j - i;
        continue;
      }

      // Target line
      const targetMatch = next.match(/^(?:Target|Goal|Expected Result)\s*[:\-]\s*(.+)/i);
      if (targetMatch) {
        target = targetMatch[1].trim();
        lookaheadConsumed = j - i;
        continue;
      }

      // Weight line — explicit "Weight: N" or standalone digit 1-5
      const wMatch = next.match(/^(?:Weight|W)\s*[:\-]?\s*([1-5])\b/i);
      if (wMatch) {
        weight = parseInt(wMatch[1]);
        lookaheadConsumed = j - i;
        break;
      }
      if (/^\s*[1-5]\s*$/.test(next)) {
        weight = parseInt(next.trim());
        lookaheadConsumed = j - i;
        break;
      }

      // If we hit another substantial line (new objective candidate), stop lookahead
      if (next.split(/\s+/).length >= 8 && !targetMatch && !wMatch) break;
    }

    if (wordCount >= 6) {
      rowIndex++;
      const label = kpiLabel || objective;
      rows.push({
        id: `row-pdf-${rowIndex}`,
        perspective: currentPerspective,
        objective: objective.length > 120 ? objective.substring(0, 120) + '…' : objective,
        keyActivities: objective,
        kpis: [{
          id: `kpi-pdf-${rowIndex}`,
          label: label.length > 120 ? label.substring(0, 120) + '…' : label,
          target: target || 'As per workplan',
        }],
        weight,
      });

      i += lookaheadConsumed;
      if (rows.length >= 16) break;
    }
  }

  if (rows.length > 0) return rows;

  // ── Pass 2: Fallback — scan for objective-like lines followed by a weight ──
  const fallbackPerspective = 'Performance Objectives';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const wordCount = line.split(/\s+/).length;

    if (/^(Part|Section|Total|Weight|Score|Rating|Signature|Date|Name|Job|Supervisor|Directorate|Employee|Staff|Page)\b/i.test(line)) continue;
    if (wordCount < 8 || wordCount > 60) continue;
    if (/^\d+(\.\d+)?$/.test(line)) continue;

    let weight = 3;
    let target = '';
    for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
      const next = lines[j];
      const wMatch = next.match(/^(?:Weight|W)\s*[:\-]?\s*([1-5])\b/i);
      if (wMatch) { weight = parseInt(wMatch[1]); break; }
      if (/^\s*[1-5]\s*$/.test(next)) { weight = parseInt(next.trim()); break; }
      const tMatch = next.match(/^(?:Target|Goal)\s*[:\-]\s*(.+)/i);
      if (tMatch) target = tMatch[1].trim();
    }

    rowIndex++;
    rows.push({
      id: `row-pdf-${rowIndex}`,
      perspective: fallbackPerspective,
      objective: line.length > 120 ? line.substring(0, 120) + '…' : line,
      keyActivities: line,
      kpis: [{
        id: `kpi-pdf-${rowIndex}`,
        label: line.length > 120 ? line.substring(0, 120) + '…' : line,
        target: target || 'As per workplan',
      }],
      weight,
    });

    if (rows.length >= 12) break;
  }

  return rows;
}

// ─── Shared PDF Workplan Parser ───────────────────────────────────────────────

/**
 * Parses extracted PDF text into a structured workplan data object.
 * Handles:
 *  - Standard "Name: ..." and "Employee: ..." patterns *  - ALL-CAPS name patterns (e.g."AYEBARE TIMOTHY" → "Ayebare Timothy")
 *  - Non-standard perspective headers (HEPRR-MPA, Programme Cluster, etc.)
 *  - Reversed first/last name order in the PDF
 */
export function parseWorkplanFromText(text: string, fileName: string): ParsedWorkplanData {
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const fullText = lines.join(' ');

  // ── Staff info extraction ──
  let staffName = '';
  let jobTitle = '';
  let directorate = '';
  let supervisorName = '';

  // Name: look for "Name:" or "Employee:" patterns
  const nameMatch = fullText.match(/(?:Name|Employee)\s*[:\-]\s*([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){1,3})/);
  if (nameMatch) staffName = nameMatch[1].trim();

  // Fallback: ALL-CAPS name pattern (common in ECSA-HC PDFs e.g. "AYEBARE TIMOTHY")
  if (!staffName) {
    const capsMatch = fullText.match(/(?:Name|Employee)\s*[:\-]\s*([A-Z]{2,}(?:\s+[A-Z]{2,}){1,3})/);
    if (capsMatch) {
      // Convert "AYEBARE TIMOTHY" → "Ayebare Timothy"
      staffName = capsMatch[1].trim().replace(/\b\w+/g, (w) => w.charAt(0) + w.slice(1).toLowerCase());
    }
  }

  const jobMatch = fullText.match(/(?:Job Title|Position|Title)\s*[:\-]\s*([^\n,]{5,60}?)(?:\s{2,}|Directorate|Cluster|Supervisor)/i);
  if (jobMatch) jobTitle = jobMatch[1].trim();

  const dirMatch = fullText.match(/(?:Directorate|Cluster)\s*[:\-]\s*([^\n,]{3,60}?)(?:\s{2,}|Supervisor|Name|$)/i);
  if (dirMatch) directorate = dirMatch[1].trim();

  const supMatch = fullText.match(/(?:Supervisor|Reporting to)\s*[:\-]\s*([A-Z][a-zA-Z\s\.]{3,60}?)(?:\s{2,}|Job Title|Date|$)/i);
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

  // ── Scorecard rows extraction (improved multi-pass) ──
  const perspectivesObjectives = extractScorecardRows(lines);

  // ── Competencies extraction ──
  const generalCompetencies: CompetencyEntry[] = STANDARD_COMPETENCIES.map((c, idx) => {
    const escapedName = c.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const compRegex = new RegExp(escapedName + '[^\\d]{0,40}([1-5])\\b', 'i');
    const match = fullText.match(compRegex);
    let weight = match ? parseInt(match[1]) : (idx < 5 ? 5 : idx === 5 ? 4 : 2);
    return { ...c, weight };
  });

  // ── Support required ──
  let supportRequired = '';
  const supportMatch = fullText.match(/(?:Support Required|Management Support)[^\n]{0,30}[:\-]\s*([^]{10,300}?)(?:Employee Signature|Supervisor Signature|$)/i);
  if (supportMatch) supportRequired = supportMatch[1].replace(/\s+/g, ' ').trim();

  // ── Fallback: derive name from filename ──
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

// ─── Schema Validation ────────────────────────────────────────────────────────

export interface ValidationIssue {
  field: string;
  severity: 'error' | 'warning';
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

function isValidKPIEntry(kpi: any): boolean {
  return (
    kpi !== null &&
    typeof kpi === 'object' &&
    typeof kpi.id === 'string' && kpi.id.trim().length > 0 &&
    typeof kpi.label === 'string' &&
    typeof kpi.target === 'string'
  );
}

function isValidScorecardRow(row: any): boolean {
  return (
    row !== null &&
    typeof row === 'object' &&
    typeof row.id === 'string' && row.id.trim().length > 0 &&
    typeof row.perspective === 'string' && row.perspective.trim().length > 0 &&
    typeof row.objective === 'string' && row.objective.trim().length > 0 &&
    typeof row.keyActivities === 'string' &&
    Array.isArray(row.kpis) &&
    row.kpis.every(isValidKPIEntry) &&
    typeof row.weight === 'number' &&
    Number.isFinite(row.weight) &&
    row.weight >= 1 &&
    row.weight <= 5
  );
}

function isValidCompetency(c: any): boolean {
  return (
    c !== null &&
    typeof c === 'object' &&
    typeof c.id === 'string' && c.id.trim().length > 0 &&
    typeof c.name === 'string' && c.name.trim().length > 0 &&
    typeof c.description === 'string' &&
    typeof c.weight === 'number' &&
    Number.isFinite(c.weight) &&
    c.weight >= 1 &&
    c.weight <= 5
  );
}

/**
 * Validates the full extracted workplan data structure before preview or DB insertion.
 */
export function validateExtractedWorkplan(
  staffId: string | null,
  scorecardRows: any[],
  competencies: any[]
): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  // ── Staff ID ──────────────────────────────────────────────────────────────
  if (staffId === null || staffId === undefined) {
    warnings.push({
      field: 'staffId',
      severity: 'warning',
      message:
        'Staff member could not be matched in the database. The workplan will be saved without a linked staff record — please assign the correct staff after import.',
    });
  } else if (typeof staffId !== 'string' || staffId.trim().length === 0) {
    errors.push({
      field: 'staffId',
      severity: 'error',
      message: 'Staff ID is invalid (empty string). Cannot insert workplan without a valid staff reference.',
    });
  }

  // ── Scorecard rows ────────────────────────────────────────────────────────
  if (!Array.isArray(scorecardRows)) {
    errors.push({
      field: 'scorecardRows',
      severity: 'error',
      message: 'Scorecard rows must be an array. Extraction may have failed.',
    });
  } else {
    if (scorecardRows.length === 0) {
      warnings.push({
        field: 'scorecardRows',
        severity: 'warning',
        message:
          'No scorecard rows were extracted from the PDF. The workplan will be imported with staff info only — objectives can be added manually.',
      });
    }

    scorecardRows.forEach((row, idx) => {
      if (!isValidScorecardRow(row)) {
        errors.push({
          field: `scorecardRows[${idx}]`,
          severity: 'error',
          message: `Scorecard row ${idx + 1} has an invalid structure (missing required fields or weight out of range 1–5).`,
        });
      }
    });

    const validRows = scorecardRows.filter(isValidScorecardRow);
    const totalBscWeight = validRows.reduce((sum, r) => sum + (r.weight as number), 0);
    if (validRows.length > 0 && totalBscWeight > 80) {
      errors.push({
        field: 'scorecardRows.totalWeight',
        severity: 'error',
        message: `Total scorecard weight is ${totalBscWeight}, which exceeds the maximum of 80. Please review the extracted weights before importing.`,
      });
    }
  }

  // ── Competency weights ────────────────────────────────────────────────────
  if (!Array.isArray(competencies)) {
    errors.push({
      field: 'competencies',
      severity: 'error',
      message: 'Competencies must be an array. Extraction may have failed.',
    });
  } else {
    if (competencies.length === 0) {
      errors.push({
        field: 'competencies',
        severity: 'error',
        message: 'No competencies were extracted. The workplan requires at least one competency entry.',
      });
    }

    competencies.forEach((c, idx) => {
      if (!isValidCompetency(c)) {
        errors.push({
          field: `competencies[${idx}]`,
          severity: 'error',
          message: `Competency ${idx + 1} ("${c?.name ?? 'unknown'}") has an invalid structure or weight out of range 1–5.`,
        });
      }
    });

    const validComps = competencies.filter(isValidCompetency);
    const totalCompWeight = validComps.reduce((sum, c) => sum + (c.weight as number), 0);
    if (validComps.length > 0 && (totalCompWeight < 20 || totalCompWeight > 40)) {
      warnings.push({
        field: 'competencies.totalWeight',
        severity: 'warning',
        message: `Total competency weight is ${totalCompWeight} (expected ~31 for ECSA-HC standard). Weights may not have been extracted correctly from the PDF.`,
      });
    }
  }

  const valid = errors.length === 0;
  return { valid, errors, warnings };
}
