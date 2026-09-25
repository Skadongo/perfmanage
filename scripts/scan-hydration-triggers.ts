#!/usr/bin/env ts-node
/**
 * Hydration Trigger Scanner
 * ─────────────────────────
 * Scans all screen/component files for patterns that commonly cause
 * Next.js SSR hydration mismatches and reports exact file + line numbers.
 *
 * Run:  npx ts-node scripts/scan-hydration-triggers.ts
 *       node --loader ts-node/esm scripts/scan-hydration-triggers.ts
 */

import * as fs from 'fs';
import * as path from 'path';

// ─── Configuration ────────────────────────────────────────────────────────────

const SCAN_ROOTS = [
  'src/app',
  'src/components',
  'src/hooks',
  'src/contexts',
  'src/lib',
];

const INCLUDE_EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js'];

/** Lines that contain only these patterns inside useEffect / event handlers
 *  are safe — we track them separately so we can de-risk false positives. */
const SAFE_CONTEXTS = [
  /useEffect\s*\(/,
  /addEventListener/,
  /removeEventListener/,
];

// ─── Trigger Patterns ─────────────────────────────────────────────────────────

interface TriggerRule {
  id: string;
  category: string;
  pattern: RegExp;
  description: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  /** If true, only flag when the match is NOT inside a useEffect/handler */
  renderOnly?: boolean;
}

const TRIGGER_RULES: TriggerRule[] = [
  // ── Dynamic Dates ──────────────────────────────────────────────────────────
  {
    id: 'DATE_NEW',
    category: 'Dynamic Dates',
    pattern: /new\s+Date\s*\(\s*\)/,
    description: '`new Date()` — produces different timestamps on server vs client',
    severity: 'HIGH',
    renderOnly: false,
  },
  {
    id: 'DATE_NOW',
    category: 'Dynamic Dates',
    pattern: /Date\.now\s*\(\s*\)/,
    description: '`Date.now()` — millisecond timestamp differs between SSR and hydration',
    severity: 'HIGH',
    renderOnly: false,
  },
  {
    id: 'DATE_GETFULLYEAR',
    category: 'Dynamic Dates',
    pattern: /new\s+Date\s*\(\s*\)\s*\.getFullYear\s*\(\s*\)/,
    description: '`new Date().getFullYear()` in JSX render — use static year or useEffect',
    severity: 'HIGH',
    renderOnly: true,
  },

  // ── Locale-Dependent Formatting ────────────────────────────────────────────
  {
    id: 'LOCALE_STRING',
    category: 'Locale Formatting',
    pattern: /\.toLocaleString\s*\(/,
    description: '`.toLocaleString()` — locale differs between Node.js (server) and browser',
    severity: 'HIGH',
    renderOnly: false,
  },
  {
    id: 'LOCALE_DATE',
    category: 'Locale Formatting',
    pattern: /\.toLocaleDateString\s*\(/,
    description: '`.toLocaleDateString()` — locale-dependent, causes server/client mismatch',
    severity: 'HIGH',
    renderOnly: false,
  },
  {
    id: 'LOCALE_TIME',
    category: 'Locale Formatting',
    pattern: /\.toLocaleTimeString\s*\(/,
    description: '`.toLocaleTimeString()` — locale-dependent, causes server/client mismatch',
    severity: 'HIGH',
    renderOnly: false,
  },
  {
    id: 'INTL_FORMAT',
    category: 'Locale Formatting',
    pattern: /new\s+Intl\.(DateTimeFormat|NumberFormat|RelativeTimeFormat)\s*\(/,
    description: '`Intl.*` constructor — locale-sensitive, wrap in useEffect',
    severity: 'HIGH',
    renderOnly: false,
  },

  // ── Random Values ──────────────────────────────────────────────────────────
  {
    id: 'MATH_RANDOM',
    category: 'Random Values',
    pattern: /Math\.random\s*\(\s*\)/,
    description: '`Math.random()` — non-deterministic, always differs between SSR and client',
    severity: 'HIGH',
    renderOnly: false,
  },
  {
    id: 'CRYPTO_RANDOM',
    category: 'Random Values',
    pattern: /crypto\.randomUUID\s*\(\s*\)|crypto\.getRandomValues\s*\(/,
    description: '`crypto.randomUUID/getRandomValues` — browser-only, not available in Node.js SSR',
    severity: 'HIGH',
    renderOnly: false,
  },

  // ── Browser APIs ───────────────────────────────────────────────────────────
  {
    id: 'WINDOW_ACCESS',
    category: 'Browser APIs',
    pattern: /(?<!['"a-zA-Z0-9_$])window\s*\./,
    description: '`window.*` — browser-only global, throws ReferenceError during SSR',
    severity: 'HIGH',
    renderOnly: false,
  },
  {
    id: 'DOCUMENT_ACCESS',
    category: 'Browser APIs',
    pattern: /(?<!['"a-zA-Z0-9_$])document\s*\./,
    description: '`document.*` — browser-only global, throws ReferenceError during SSR',
    severity: 'HIGH',
    renderOnly: false,
  },
  {
    id: 'NAVIGATOR_ACCESS',
    category: 'Browser APIs',
    pattern: /(?<!['"a-zA-Z0-9_$])navigator\s*\./,
    description: '`navigator.*` — browser-only global, throws ReferenceError during SSR',
    severity: 'HIGH',
    renderOnly: false,
  },
  {
    id: 'LOCALSTORAGE',
    category: 'Browser APIs',
    pattern: /localStorage\s*[.[]/,
    description: '`localStorage` — browser-only, not available in Node.js SSR',
    severity: 'HIGH',
    renderOnly: false,
  },
  {
    id: 'SESSIONSTORAGE',
    category: 'Browser APIs',
    pattern: /sessionStorage\s*[.[]/,
    description: '`sessionStorage` — browser-only, not available in Node.js SSR',
    severity: 'HIGH',
    renderOnly: false,
  },
  {
    id: 'PERFORMANCE_NOW',
    category: 'Browser APIs',
    pattern: /performance\.now\s*\(\s*\)/,
    description: '`performance.now()` — high-resolution timer, differs between SSR and client',
    severity: 'MEDIUM',
    renderOnly: false,
  },
  {
    id: 'INTERSECTION_OBSERVER',
    category: 'Browser APIs',
    pattern: /new\s+IntersectionObserver\s*\(/,
    description: '`IntersectionObserver` — browser-only API, guard with typeof check',
    severity: 'MEDIUM',
    renderOnly: false,
  },
  {
    id: 'RESIZE_OBSERVER',
    category: 'Browser APIs',
    pattern: /new\s+ResizeObserver\s*\(/,
    description: '`ResizeObserver` — browser-only API, guard with typeof check',
    severity: 'MEDIUM',
    renderOnly: false,
  },
  {
    id: 'MATCH_MEDIA',
    category: 'Browser APIs',
    pattern: /window\.matchMedia\s*\(/,
    description: '`window.matchMedia` — browser-only, causes SSR mismatch for responsive logic',
    severity: 'HIGH',
    renderOnly: false,
  },

  // ── Unsafe ID Generation ───────────────────────────────────────────────────
  {
    id: 'DATENOW_ID',
    category: 'Unsafe IDs',
    pattern: /[`'"].*\$\{Date\.now\(\)\}|[`'"].*\$\{Math\.random\(\)\}/,
    description: 'Template literal ID using `Date.now()` or `Math.random()` — use `useId()` instead',
    severity: 'HIGH',
    renderOnly: false,
  },
];

// ─── Scanner ──────────────────────────────────────────────────────────────────

interface Finding {
  file: string;
  line: number;
  column: number;
  rule: TriggerRule;
  snippet: string;
  inSafeContext: boolean;
}

function collectFiles(root: string, exts: string[]): string[] {
  const results: string[] = [];
  if (!fs.existsSync(root)) return results;

  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // Skip node_modules, .next, dist, scripts themselves
        if (!['node_modules', '.next', 'dist', 'build', 'scripts'].includes(entry.name)) {
          walk(full);
        }
      } else if (entry.isFile() && exts.includes(path.extname(entry.name))) {
        results.push(full);
      }
    }
  }

  walk(root);
  return results;
}

function isInSafeContext(lines: string[], lineIndex: number): boolean {
  // Look back up to 5 lines for a safe context opener
  const start = Math.max(0, lineIndex - 5);
  for (let i = lineIndex; i >= start; i--) {
    if (SAFE_CONTEXTS.some((p) => p.test(lines[i]))) return true;
  }
  return false;
}

function scanFile(filePath: string): Finding[] {
  const findings: Finding[] = [];
  let source: string;
  try {
    source = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return findings;
  }

  const lines = source.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip comment-only lines
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;

    for (const rule of TRIGGER_RULES) {
      const match = rule.pattern.exec(line);
      if (!match) continue;

      const inSafe = isInSafeContext(lines, i);

      findings.push({
        file: filePath,
        line: i + 1,
        column: match.index + 1,
        rule,
        snippet: line.trim().slice(0, 120),
        inSafeContext: inSafe,
      });
    }
  }

  return findings;
}

// ─── Report ───────────────────────────────────────────────────────────────────

function severityColor(s: 'HIGH' | 'MEDIUM' | 'LOW'): string {
  if (s === 'HIGH') return '\x1b[31m';   // red
  if (s === 'MEDIUM') return '\x1b[33m'; // yellow
  return '\x1b[36m';                      // cyan
}
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';

function printReport(allFindings: Finding[]) {
  const byFile = new Map<string, Finding[]>();
  for (const f of allFindings) {
    const key = f.file;
    if (!byFile.has(key)) byFile.set(key, []);
    byFile.get(key)!.push(f);
  }

  const high = allFindings.filter((f) => f.rule.severity === 'HIGH' && !f.inSafeContext);
  const medium = allFindings.filter((f) => f.rule.severity === 'MEDIUM' && !f.inSafeContext);
  const safeCtx = allFindings.filter((f) => f.inSafeContext);

  console.log(`\n${BOLD}╔══════════════════════════════════════════════════════════════╗${RESET}`);
  console.log(`${BOLD}║         HYDRATION TRIGGER STATIC ANALYSIS REPORT             ║${RESET}`);
  console.log(`${BOLD}╚══════════════════════════════════════════════════════════════╝${RESET}\n`);

  console.log(`${BOLD}Summary${RESET}`);
  console.log(`  Files scanned : ${byFile.size}`);
  console.log(`  Total findings: ${allFindings.length}`);
  console.log(`  ${severityColor('HIGH')}HIGH (risky)  : ${high.length}${RESET}`);
  console.log(`  ${severityColor('MEDIUM')}MEDIUM        : ${medium.length}${RESET}`);
  console.log(`  ${DIM}In safe ctx   : ${safeCtx.length} (inside useEffect/handlers — lower risk)${RESET}`);
  console.log('');

  if (allFindings.length === 0) {
    console.log(`${GREEN}✓ No hydration triggers found.${RESET}\n`);
    return;
  }

  // Group by category
  const byCategory = new Map<string, Finding[]>();
  for (const f of allFindings) {
    if (!byCategory.has(f.rule.category)) byCategory.set(f.rule.category, []);
    byCategory.get(f.rule.category)!.push(f);
  }

  for (const [category, findings] of byCategory) {
    const risky = findings.filter((f) => !f.inSafeContext);
    console.log(`${BOLD}── ${category} (${risky.length} risky / ${findings.length} total) ──${RESET}`);

    for (const f of findings) {
      const sev = severityColor(f.rule.severity);
      const ctx = f.inSafeContext ? `${DIM} [safe-ctx]${RESET}` : '';
      console.log(`  ${sev}[${f.rule.severity}]${RESET} ${f.file}:${BOLD}${f.line}${RESET}:${f.column}${ctx}`);
      console.log(`         Rule   : ${f.rule.id} — ${f.rule.description}`);
      console.log(`         Snippet: ${DIM}${f.snippet}${RESET}`);
      console.log('');
    }
  }

  // ── Actionable Fix Summary ──────────────────────────────────────────────────
  console.log(`${BOLD}╔══════════════════════════════════════════════════════════════╗${RESET}`);
  console.log(`${BOLD}║                  ACTIONABLE FIX SUMMARY                      ║${RESET}`);
  console.log(`${BOLD}╚══════════════════════════════════════════════════════════════╝${RESET}\n`);

  const fixes: Record<string, string> = {
    DATE_NEW: 'Move `new Date()` into useEffect + useState. For timestamps sent to DB, call inside async handlers (not render).',
    DATE_NOW: 'Move `Date.now()` into useEffect + useState or inside event/async handlers.',
    DATE_GETFULLYEAR: 'Replace with static year constant or useState initialized in useEffect.',
    LOCALE_STRING: 'Pass explicit locale: `.toLocaleString("en-US")` or compute in useEffect.',
    LOCALE_DATE: 'Pass explicit locale: `.toLocaleDateString("en-US")` or compute in useEffect.',
    LOCALE_TIME: 'Use `.toISOString().slice(11,19)` for HH:MM:SS or compute in useEffect.',
    INTL_FORMAT: 'Instantiate Intl formatters inside useEffect or pass explicit locale.',
    MATH_RANDOM: 'Use `useId()` for stable IDs. For mock data, pre-compute values outside render.',
    CRYPTO_RANDOM: 'Guard with `typeof crypto !== "undefined"` or move into useEffect.',
    WINDOW_ACCESS: 'Wrap in `useEffect` or guard with `typeof window !== "undefined"`.',
    DOCUMENT_ACCESS: 'Wrap in `useEffect` or guard with `typeof document !== "undefined"`.',
    NAVIGATOR_ACCESS: 'Wrap in `useEffect` or guard with `typeof navigator !== "undefined"`.',
    LOCALSTORAGE: 'Access only inside useEffect or guard with `typeof localStorage !== "undefined"`.',
    SESSIONSTORAGE: 'Access only inside useEffect or guard with `typeof sessionStorage !== "undefined"`.',
    PERFORMANCE_NOW: 'Move into useEffect; not needed during render.',
    INTERSECTION_OBSERVER: 'Instantiate inside useEffect with cleanup.',
    RESIZE_OBSERVER: 'Instantiate inside useEffect with cleanup.',
    MATCH_MEDIA: 'Read inside useEffect; store result in state.',
    DATENOW_ID: 'Use React `useId()` hook for stable, SSR-safe IDs.',
  };

  const seenRules = new Set<string>();
  for (const f of allFindings.filter((x) => !x.inSafeContext)) {
    if (!seenRules.has(f.rule.id)) {
      seenRules.add(f.rule.id);
      console.log(`  ${severityColor(f.rule.severity)}${f.rule.id}${RESET}: ${fixes[f.rule.id] ?? 'See rule description.'}`);
    }
  }

  console.log('');
}

// ─── JSON Output ──────────────────────────────────────────────────────────────

function writeJsonReport(findings: Finding[], outPath: string) {
  const data = findings.map((f) => ({
    file: f.file,
    line: f.line,
    column: f.column,
    severity: f.rule.severity,
    ruleId: f.rule.id,
    category: f.rule.category,
    description: f.rule.description,
    snippet: f.snippet,
    inSafeContext: f.inSafeContext,
  }));
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`\nJSON report saved → ${outPath}\n`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  const allFiles: string[] = [];
  for (const root of SCAN_ROOTS) {
    allFiles.push(...collectFiles(root, INCLUDE_EXTENSIONS));
  }

  // Deduplicate
  const uniqueFiles = [...new Set(allFiles)];

  console.log(`\nScanning ${uniqueFiles.length} files across ${SCAN_ROOTS.join(', ')} …`);

  const allFindings: Finding[] = [];
  for (const file of uniqueFiles) {
    allFindings.push(...scanFile(file));
  }

  printReport(allFindings);

  // Write machine-readable report
  const jsonOut = path.join(process.cwd(), 'hydration-report.json');
  writeJsonReport(allFindings, jsonOut);

  // Exit with non-zero code if HIGH-severity risky findings exist
  const riskyHigh = allFindings.filter((f) => f.rule.severity === 'HIGH' && !f.inSafeContext);
  process.exit(riskyHigh.length > 0 ? 1 : 0);
}

main();
