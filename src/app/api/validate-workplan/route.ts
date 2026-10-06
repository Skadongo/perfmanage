import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ─── Types (mirrors pdfExtract.ts shapes) ────────────────────────────────────

interface KPIEntry {
  id: string;
  label: string;
  target: string;
}

interface ScorecardRow {
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

interface ValidateWorkplanBody {
  staffId: string | null;
  staffName?: string;
  scorecardRows: ScorecardRow[];
  competencies: Competency[];
}

interface ValidationIssue {
  field: string;
  severity: 'error' | 'warning';
  message: string;
}

interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  resolvedStaffId?: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isValidKPIEntry(kpi: unknown): boolean {
  if (!kpi || typeof kpi !== 'object') return false;
  const k = kpi as Record<string, unknown>;
  return (
    typeof k.id === 'string' && k.id.trim().length > 0 &&
    typeof k.label === 'string' &&
    typeof k.target === 'string'
  );
}

function isValidScorecardRow(row: unknown): boolean {
  if (!row || typeof row !== 'object') return false;
  const r = row as Record<string, unknown>;
  return (
    typeof r.id === 'string' && r.id.trim().length > 0 &&
    typeof r.perspective === 'string' && r.perspective.trim().length > 0 &&
    typeof r.objective === 'string' && r.objective.trim().length > 0 &&
    typeof r.keyActivities === 'string' &&
    Array.isArray(r.kpis) &&
    (r.kpis as unknown[]).every(isValidKPIEntry) &&
    typeof r.weight === 'number' &&
    Number.isFinite(r.weight) &&
    (r.weight as number) >= 1 &&
    (r.weight as number) <= 5
  );
}

function isValidCompetency(c: unknown): boolean {
  if (!c || typeof c !== 'object') return false;
  const comp = c as Record<string, unknown>;
  return (
    typeof comp.id === 'string' && comp.id.trim().length > 0 &&
    typeof comp.name === 'string' && comp.name.trim().length > 0 &&
    typeof comp.description === 'string' &&
    typeof comp.weight === 'number' &&
    Number.isFinite(comp.weight) &&
    (comp.weight as number) >= 1 &&
    (comp.weight as number) <= 5
  );
}

/**
 * Verifies a staffId exists in the database.
 */
async function verifyStaffIdExists(
  supabase: Awaited<ReturnType<typeof createClient>>,
  staffId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('staff')
      .select('id')
      .eq('id', staffId)
      .single();
    return !error && data !== null;
  } catch (_e) {
    return false;
  }
}

/**
 * Attempts to resolve a staff name to a DB record server-side.
 */
async function resolveStaffByName(
  supabase: Awaited<ReturnType<typeof createClient>>,
  staffName: string
): Promise<{ id: string; full_name: string } | null> {
  if (!staffName || staffName === 'Unknown Staff') return null;

  try {
    const normalise = (s: string) => s.toLowerCase().replace(/[^a-z\s]/g, '').trim();

    // Stage 1: direct substring match
    const { data: direct } = await supabase
      .from('staff')
      .select('id, full_name')
      .ilike('full_name', `%${staffName}%`)
      .limit(1);

    if (direct && direct.length > 0) return direct[0];

    // Stage 2: token-based match (handles reversed names)
    const tokens = staffName.trim().split(/\s+/).filter((t) => t.length > 1);
    if (tokens.length < 2) return null;

    const longestToken = tokens.reduce((a, b) => (a.length >= b.length ? a : b));

    const { data: candidates } = await supabase
      .from('staff')
      .select('id, full_name')
      .ilike('full_name', `%${longestToken}%`)
      .limit(30);

    if (!candidates || candidates.length === 0) return null;

    const normTokens = tokens.map(normalise);
    const match = candidates.find((row: { id: string; full_name: string }) => {
      const normFull = normalise(row.full_name);
      return normTokens.every((tok) => normFull.includes(tok));
    });

    return match ?? null;
  } catch (_e) {
    return null;
  }
}

// ─── GET /api/validate-workplan — health check ────────────────────────────────

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ status: 'ok', endpoint: 'validate-workplan' }, { status: 200 });
}

// ─── POST /api/validate-workplan ──────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    let body: ValidateWorkplanBody;
    try {
      body = await req.json();
    } catch (_parseErr) {
      return NextResponse.json(
        {
          valid: false,
          errors: [{ field: 'request', severity: 'error', message: 'Invalid JSON body.' }],
          warnings: [],
          resolvedStaffId: null,
        },
        { status: 400 }
      );
    }

    const { staffId, staffName, scorecardRows, competencies } = body;

    const supabase = await createClient();
    const errors: ValidationIssue[] = [];
    const warnings: ValidationIssue[] = [];
    let resolvedStaffId: string | null = staffId ?? null;

    // ── 1. Staff ID verification ───────────────────────────────────────────
    if (resolvedStaffId && typeof resolvedStaffId === 'string' && resolvedStaffId.trim().length > 0) {
      const exists = await verifyStaffIdExists(supabase, resolvedStaffId);
      if (!exists) {
        resolvedStaffId = null;
        if (staffName) {
          const found = await resolveStaffByName(supabase, staffName);
          resolvedStaffId = found?.id ?? null;
        }
        if (!resolvedStaffId) {
          warnings.push({
            field: 'staffId',
            severity: 'warning',
            message:
              'The provided staff ID could not be verified in the database. The workplan will be saved without a linked staff record — please assign the correct staff after import.',
          });
        }
      }
    } else if (staffName) {
      const found = await resolveStaffByName(supabase, staffName);
      resolvedStaffId = found?.id ?? null;
      if (!resolvedStaffId) {
        warnings.push({
          field: 'staffId',
          severity: 'warning',
          message:
            'Staff member could not be matched in the database. The workplan will be saved without a linked staff record — please assign the correct staff after import.',
        });
      }
    } else {
      warnings.push({
        field: 'staffId',
        severity: 'warning',
        message: 'No staff ID or name provided. The workplan will be saved without a linked staff record.',
      });
    }

    // ── 2. Scorecard rows validation ───────────────────────────────────────
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
      const totalBscWeight = validRows.reduce((sum, r) => sum + r.weight, 0);
      if (validRows.length > 0 && totalBscWeight > 80) {
        errors.push({
          field: 'scorecardRows.totalWeight',
          severity: 'error',
          message: `Total scorecard weight is ${totalBscWeight}, which exceeds the maximum of 80. Please review the extracted weights before importing.`,
        });
      }
    }

    // ── 3. Competency weights validation ───────────────────────────────────
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
            message: `Competency ${idx + 1} ("${(c as Record<string, unknown>)?.name ?? 'unknown'}") has an invalid structure or weight out of range 1–5.`,
          });
        }
      });

      const validComps = competencies.filter(isValidCompetency);
      const totalCompWeight = validComps.reduce((sum, c) => sum + c.weight, 0);
      if (validComps.length > 0 && (totalCompWeight < 20 || totalCompWeight > 40)) {
        warnings.push({
          field: 'competencies.totalWeight',
          severity: 'warning',
          message: `Total competency weight is ${totalCompWeight} (expected ~31 for ECSA-HC standard). Weights may not have been extracted correctly from the PDF.`,
        });
      }
    }

    const result: ValidationResult = {
      valid: errors.length === 0,
      errors,
      warnings,
      resolvedStaffId,
    };

    return NextResponse.json(result, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected server error during validation.';
    return NextResponse.json(
      {
        valid: false,
        errors: [{ field: 'server', severity: 'error', message }],
        warnings: [],
        resolvedStaffId: null,
      },
      { status: 500 }
    );
  }
}
