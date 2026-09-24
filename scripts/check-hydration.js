#!/usr/bin/env node
/**
 * Hydration Trigger Scanner
 * ─────────────────────────
 * Scans all .ts / .tsx files under src/ for patterns that commonly cause
 * React hydration mismatches and reports exact file paths + line numbers.
 *
 * Usage:
 *   node scripts/check-hydration.js
 *   node scripts/check-hydration.js --dir src/app   # limit to a sub-directory
 *   node scripts/check-hydration.js --json          # output raw JSON
 */

const fs = require('fs');
const path = require('path');

// ─── CLI args ────────────────────────────────────────────────────────────────
const args = process.argv?.slice(2);
const jsonMode = args?.includes('--json');
const dirIndex = args?.indexOf('--dir');
const rootDir = dirIndex !== -1 ? args?.[dirIndex + 1] : 'src';

// ─── Rule definitions ────────────────────────────────────────────────────────
const RULES = [
  // ── Dynamic dates ──────────────────────────────────────────────────────────
  {
    id: 'new-date-in-render',
    category: 'Dynamic Dates',
    pattern: /new\s+Date\s*\(/,
    message: '`new Date()` called — will differ between server and client render',
    severity: 'error',
  },
  {
    id: 'date-now-in-render',
    category: 'Dynamic Dates',
    pattern: /Date\.now\s*\(/,
    message: '`Date.now()` called — produces different timestamps on server vs client',
    severity: 'error',
  },
  {
    id: 'date-getfullyear',
    category: 'Dynamic Dates',
    pattern: /\.getFullYear\s*\(/,
    message: '`.getFullYear()` — dynamic year value; use a static literal or `useEffect`',
    severity: 'warning',
  },
  {
    id: 'date-getmonth',
    category: 'Dynamic Dates',
    pattern: /\.getMonth\s*\(|\.getDate\s*\(|\.getDay\s*\(/,
    message: 'Date getter method — may produce server/client mismatch',
    severity: 'warning',
  },

  // ── Locale / number formatting ─────────────────────────────────────────────
  {
    id: 'tolocalestring',
    category: 'Locale Formatting',
    pattern: /\.toLocaleString\s*\(/,
    message: '`.toLocaleString()` — locale-dependent; output differs between server and browser',
    severity: 'error',
  },
  {
    id: 'tolocaledatestring',
    category: 'Locale Formatting',
    pattern: /\.toLocaleDateString\s*\(/,
    message: '`.toLocaleDateString()` — locale-dependent; use a fixed format or `useEffect`',
    severity: 'error',
  },
  {
    id: 'tolocaletimestring',
    category: 'Locale Formatting',
    pattern: /\.toLocaleTimeString\s*\(/,
    message: '`.toLocaleTimeString()` — locale-dependent; use `toISOString().slice()` or `useEffect`',
    severity: 'error',
  },
  {
    id: 'intl-datetimeformat',
    category: 'Locale Formatting',
    pattern: /new\s+Intl\.DateTimeFormat\s*\(/,
    message: '`Intl.DateTimeFormat` — locale-dependent; wrap in `useEffect`',
    severity: 'error',
  },
  {
    id: 'intl-numberformat',
    category: 'Locale Formatting',
    pattern: /new\s+Intl\.NumberFormat\s*\(/,
    message: '`Intl.NumberFormat` — locale-dependent; wrap in `useEffect`',
    severity: 'warning',
  },
  {
    id: 'intl-relativetimeformat',
    category: 'Locale Formatting',
    pattern: /new\s+Intl\.RelativeTimeFormat\s*\(/,
    message: '`Intl.RelativeTimeFormat` — locale-dependent; wrap in `useEffect`',
    severity: 'warning',
  },

  // ── Random values ──────────────────────────────────────────────────────────
  {
    id: 'math-random',
    category: 'Random Values',
    pattern: /Math\.random\s*\(/,
    message: '`Math.random()` — non-deterministic; use `useId()` or seed in `useEffect`',
    severity: 'error',
  },
  {
    id: 'crypto-random-uuid',
    category: 'Random Values',
    pattern: /crypto\.randomUUID\s*\(/,
    message: '`crypto.randomUUID()` — non-deterministic; use `useId()` or generate in `useEffect`',
    severity: 'error',
  },
  {
    id: 'performance-now',
    category: 'Random Values',
    pattern: /performance\.now\s*\(/,
    message: '`performance.now()` — non-deterministic timing value; move to `useEffect`',
    severity: 'warning',
  },

  // ── Browser-only APIs ──────────────────────────────────────────────────────
  {
    id: 'window-access',
    category: 'Browser APIs',
    pattern: /\bwindow\s*\./,
    message: '`window.*` — browser-only; guard with `useEffect` or `typeof window !== "undefined"`',
    severity: 'error',
  },
  {
    id: 'document-access',
    category: 'Browser APIs',
    pattern: /\bdocument\s*\./,
    message: '`document.*` — browser-only; guard with `useEffect`',
    severity: 'error',
  },
  {
    id: 'navigator-access',
    category: 'Browser APIs',
    pattern: /\bnavigator\s*\./,
    message: '`navigator.*` — browser-only; guard with `useEffect`',
    severity: 'error',
  },
  {
    id: 'localstorage-access',
    category: 'Browser APIs',
    pattern: /\blocalStorage\s*[.[]/,
    message: '`localStorage` — browser-only; guard with `useEffect`',
    severity: 'error',
  },
  {
    id: 'sessionstorage-access',
    category: 'Browser APIs',
    pattern: /\bsessionStorage\s*[.[]/,
    message: '`sessionStorage` — browser-only; guard with `useEffect`',
    severity: 'error',
  },
  {
    id: 'matchmedia',
    category: 'Browser APIs',
    pattern: /\bwindow\.matchMedia\s*\(|matchMedia\s*\(/,
    message: '`matchMedia()` — browser-only; guard with `useEffect`',
    severity: 'error',
  },
  {
    id: 'intersection-observer',
    category: 'Browser APIs',
    pattern: /new\s+IntersectionObserver\s*\(/,
    message: '`IntersectionObserver` — browser-only; instantiate inside `useEffect`',
    severity: 'warning',
  },
  {
    id: 'resize-observer',
    category: 'Browser APIs',
    pattern: /new\s+ResizeObserver\s*\(/,
    message: '`ResizeObserver` — browser-only; instantiate inside `useEffect`',
    severity: 'warning',
  },
  {
    id: 'mutation-observer',
    category: 'Browser APIs',
    pattern: /new\s+MutationObserver\s*\(/,
    message: '`MutationObserver` — browser-only; instantiate inside `useEffect`',
    severity: 'warning',
  },
  {
    id: 'websocket',
    category: 'Browser APIs',
    pattern: /new\s+WebSocket\s*\(/,
    message: '`WebSocket` — browser-only; instantiate inside `useEffect`',
    severity: 'warning',
  },
  {
    id: 'audio-api',
    category: 'Browser APIs',
    pattern: /new\s+Audio\s*\(|new\s+AudioContext\s*\(/,
    message: '`Audio` / `AudioContext` — browser-only; instantiate inside `useEffect`',
    severity: 'warning',
  },
  {
    id: 'typeof-window-branch',
    category: 'Browser APIs',
    pattern: /typeof\s+window\s*[!=]==?\s*['"]undefined['"]/,
    message: '`typeof window` branch in render — may still cause mismatch; prefer `useEffect` + state',
    severity: 'warning',
  },
];

// ─── File walker ─────────────────────────────────────────────────────────────
function walkDir(dir, fileList = []) {
  if (!fs?.existsSync(dir)) return fileList;
  const entries = fs?.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path?.join(dir, entry?.name);
    if (entry?.isDirectory()) {
      if (['node_modules', '.next', 'out', 'dist', '.git']?.includes(entry?.name)) continue;
      walkDir(fullPath, fileList);
    } else if (/\.(tsx?|jsx?)$/?.test(entry?.name)) {
      fileList?.push(fullPath);
    }
  }
  return fileList;
}

// ─── Scan a single file ───────────────────────────────────────────────────────
function scanFile(filePath) {
  const source = fs?.readFileSync(filePath, 'utf8');
  const lines = source?.split('\n');
  const findings = [];

  for (let i = 0; i < lines?.length; i++) {
    const line = lines?.[i];
    const trimmed = line?.trim();

    if (trimmed?.startsWith('//') || trimmed?.startsWith('*') || trimmed?.startsWith('/*')) continue;
    if (/^\s*(import|export)\s/?.test(line) && !line?.includes('(')) continue;

    for (const rule of RULES) {
      if (rule?.pattern?.test(line)) {
        findings?.push({
          rule: rule?.id,
          category: rule?.category,
          severity: rule?.severity,
          line: i + 1,
          col: line?.search(rule?.pattern) + 1,
          snippet: trimmed?.slice(0, 120),
          message: rule?.message,
        });
      }
    }
  }

  return findings;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
function main() {
  const targetDir = path?.resolve(process.cwd(), rootDir);
  const files = walkDir(targetDir);

  const results = {};
  let totalErrors = 0;
  let totalWarnings = 0;

  for (const file of files) {
    const findings = scanFile(file);
    if (findings?.length > 0) {
      const rel = path?.relative(process.cwd(), file);
      results[rel] = findings;
      totalErrors += findings?.filter(f => f?.severity === 'error')?.length;
      totalWarnings += findings?.filter(f => f?.severity === 'warning')?.length;
    }
  }

  if (jsonMode) {
    console.log(JSON.stringify({ summary: { totalErrors, totalWarnings, filesAffected: Object.keys(results)?.length }, results }, null, 2));
    return;
  }

  const RESET  = '\x1b[0m';
  const BOLD   = '\x1b[1m';
  const RED    = '\x1b[31m';
  const YELLOW = '\x1b[33m';
  const CYAN   = '\x1b[36m';
  const GREEN  = '\x1b[32m';
  const DIM    = '\x1b[2m';

  console.log(`\n${BOLD}${CYAN}╔══════════════════════════════════════════════════════╗${RESET}`);
  console.log(`${BOLD}${CYAN}║        Hydration Trigger Scanner — Report            ║${RESET}`);
  console.log(`${BOLD}${CYAN}╚══════════════════════════════════════════════════════╝${RESET}\n`);
  console.log(`${DIM}Scanned directory : ${targetDir}${RESET}`);
  console.log(`${DIM}Files scanned     : ${files?.length}${RESET}`);
  console.log(`${DIM}Files with issues : ${Object.keys(results)?.length}${RESET}\n`);

  if (Object.keys(results)?.length === 0) {
    console.log(`${GREEN}${BOLD}✓ No hydration triggers found!${RESET}\n`);
    return;
  }

  const categoryMap = {};

  for (const [file, findings] of Object.entries(results)) {
    console.log(`${BOLD}${file}${RESET}`);
    for (const f of findings) {
      const icon = f?.severity === 'error' ? `${RED}✖${RESET}` : `${YELLOW}⚠${RESET}`;
      const sev  = f?.severity === 'error' ? `${RED}error${RESET}` : `${YELLOW}warn ${RESET}`;
      const loc  = `${DIM}${String(f?.line)?.padStart(4)}:${String(f?.col)?.padEnd(4)}${RESET}`;
      console.log(`  ${icon} ${loc} ${sev}  [${CYAN}${f?.rule}${RESET}]  ${f?.message}`);
      console.log(`         ${DIM}${f?.snippet}${RESET}`);
      categoryMap[f.category] = (categoryMap?.[f?.category] || 0) + 1;
    }
    console.log('');
  }

  console.log(`${BOLD}─── Summary by Category ───────────────────────────────${RESET}`);
  for (const [cat, count] of Object.entries(categoryMap)) {
    console.log(`  ${cat?.padEnd(25)} ${count} issue${count !== 1 ? 's' : ''}`);
  }
  console.log('');
  console.log(`${BOLD}Total: ${RED}${totalErrors} error${totalErrors !== 1 ? 's' : ''}${RESET}${BOLD}, ${YELLOW}${totalWarnings} warning${totalWarnings !== 1 ? 's' : ''}${RESET}${BOLD} across ${Object.keys(results)?.length} file${Object.keys(results)?.length !== 1 ? 's' : ''}${RESET}\n`);

  if (totalErrors > 0) {
    process.exitCode = 1;
  }
}

main();
