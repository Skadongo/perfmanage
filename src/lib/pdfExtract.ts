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

/**
 * Validates a KPI entry object shape.
 */
function isValidKPIEntry(kpi: any): boolean {
  return (
    kpi !== null &&
    typeof kpi === 'object' &&
    typeof kpi.id === 'string' && kpi.id.trim().length > 0 &&
    typeof kpi.label === 'string' &&
    typeof kpi.target === 'string'
  );
}

/**
 * Validates a single scorecard (perspective/objective) row.
 */
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

/**
 * Validates a single competency entry.
 */
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
 *
 * Checks:
 *  - staffId is a non-empty string when provided (warns if null — staff not found in DB)
 *  - Each scorecard row has required fields and weight in [1–5]
 *  - Each competency has required fields and weight in [1–5]
 *  - Total scorecard weight does not exceed 80
 *  - Total competency weight is within expected range (warns if not ~31)
 *  - At least one scorecard row is present (warning only — import is still allowed)
 *
 * @param staffId   The resolved staff UUID from the DB (null if not found)
 * @param scorecardRows  Array of perspective/objective rows from the parsed PDF
 * @param competencies   Array of competency entries from the parsed PDF
 * @returns ValidationResult with `valid` flag, errors, and warnings
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

    // Total BSC weight check
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

    // Total competency weight check — ECSA-HC standard total is 31
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
