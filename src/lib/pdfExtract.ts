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

// ─── Positional text item ─────────────────────────────────────────────────────

interface TextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  page: number;
}

/**
 * Extracts text with positional data (x, y coordinates) from each page.
 */
export async function extractTextItemsFromPDF(file: File): Promise<TextItem[]> {
  const pdfjsLib = await loadPdfjsFromCDN();
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdf = await loadingTask.promise;

  const items: TextItem[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    for (const item of content.items as Array<{ str?: string; transform?: number[]; width?: number }>) {
      const str = (item.str ?? '').trim();
      if (!str) continue;
      const x = item.transform ? item.transform[4] : 0;
      const y = item.transform ? item.transform[5] : 0;
      const width = item.width ?? 0;
      items.push({ str, x, y, width, page: i });
    }
  }

  return items;
}

/**
 * Extracts plain text (line-by-line) from PDF — used for staff info parsing.
 */
export async function extractTextFromPDF(file: File): Promise<string> {
  const pdfjsLib = await loadPdfjsFromCDN();

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdf = await loadingTask.promise;

  const textParts: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();

    // Group items by Y position to reconstruct lines
    const byY: Map<number, Array<{ str: string; x: number }>> = new Map();
    for (const item of content.items as Array<{ str?: string; transform?: number[] }>) {
      const str = (item.str ?? '').trim();
      if (!str) continue;
      const y = item.transform ? Math.round(item.transform[5]) : 0;
      const x = item.transform ? item.transform[4] : 0;
      if (!byY.has(y)) byY.set(y, []);
      byY.get(y)!.push({ str, x });
    }

    // Sort by Y descending (top of page first) and join each line left-to-right
    const sortedYs = Array.from(byY.keys()).sort((a, b) => b - a);
    for (const y of sortedYs) {
      const lineItems = byY.get(y)!.sort((a, b) => a.x - b.x);
      textParts.push(lineItems.map((i) => i.str).join(' '));
    }
    textParts.push(''); // page break
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

// Default competency weights from the ECSA-HC standard template
const DEFAULT_COMPETENCY_WEIGHTS = [5, 5, 5, 5, 5, 4, 2];

// Standard BSC perspective labels (from blank template)
const BSC_PERSPECTIVES = [
  'Financial/Stewardship',
  'Customer/Stakeholder',
  'Internal Business Processes',
  'Innovation Learning & Growth Perspective',
];

// ─── Perspective Header Detection ────────────────────────────────────────────

export function detectPerspectiveHeader(line: string): string | null {
  const trimmed = line.trim();

  // Check standard BSC perspectives
  for (const p of BSC_PERSPECTIVES) {
    if (trimmed.toLowerCase().includes(p.toLowerCase().substring(0, 12))) {
      return p;
    }
  }

  // Detect non-standard component/subcomponent headers (HEPRR, Programme, etc.)
  if (
    /\b(component|subcomponent|programme|program|cluster|pillar|strategic\s+objective)\b/i.test(trimmed)
  ) {
    return trimmed.length > 80 ? trimmed.substring(0, 80) + '…' : trimmed;
  }

  return null;
}

// ─── ECSA-HC BSC Table Column Layout ─────────────────────────────────────────
//
// The ECSA-HC BSC template has 6 columns in this order (left to right):
//   Col 0: Perspective          (narrowest, ~60-80pt wide)
//   Col 1: Key Work Objective   (~100-120pt wide)
//   Col 2: Key Activities       (~120-150pt wide)  ← often the widest text column
//   Col 3: Measure / KPI        (~120-150pt wide)
//   Col 4: Target               (~40-60pt wide, numeric)
//   Col 5: Weight (1-5)         (~30-50pt wide, single digit)
//
// pdfjs extracts items in reading order within each visual row band.
// We detect column boundaries from the header row, then assign each item
// to a column bucket based on its X coordinate.

interface ColumnBounds {
  minX: number;
  maxX: number;
  label: string;
}

/**
 * Detects the X-coordinate boundaries of each column by finding the
 * table header row ("Perspective | Key Work Objective | Key activities | ...").
 *
 * Returns null if the header row cannot be found (fallback to heuristic).
 */
function detectColumnBounds(items: TextItem[]): ColumnBounds[] | null {
  // Find items that match the known column header labels
  const headerKeywords = ['perspective', 'key work', 'key activ', 'measure', 'kpi', 'target', 'weight'];

  // Collect all items whose text matches a header keyword
  const headerItems = items.filter((item) => {
    const lower = item.str.toLowerCase();
    return headerKeywords.some((kw) => lower.includes(kw));
  });

  if (headerItems.length < 3) return null;

  // Group header items by Y coordinate (within 6pt tolerance) to find the header row
  const yGroups: Map<number, TextItem[]> = new Map();
  for (const item of headerItems) {
    const roundedY = Math.round(item.y / 6) * 6;
    if (!yGroups.has(roundedY)) yGroups.set(roundedY, []);
    yGroups.get(roundedY)!.push(item);
  }

  // Find the Y group with the most header keyword matches
  let bestGroup: TextItem[] = [];
  for (const [, group] of yGroups) {
    if (group.length > bestGroup.length) bestGroup = group;
  }

  if (bestGroup.length < 3) return null;

  // Sort by X to get column order
  bestGroup.sort((a, b) => a.x - b.x);

  // Build column bounds: each column starts at its header item's X
  // and ends just before the next column's X
  const bounds: ColumnBounds[] = bestGroup.map((item, idx) => ({
    minX: item.x - 5, // small left margin
    maxX: idx < bestGroup.length - 1 ? bestGroup[idx + 1].x - 5 : 9999,
    label: item.str,
  }));

  return bounds;
}

/**
 * Assigns a text item to a column index based on its X coordinate.
 * Returns -1 if no column matches.
 */
function assignToColumn(x: number, bounds: ColumnBounds[]): number {
  for (let i = 0; i < bounds.length; i++) {
    if (x >= bounds[i].minX && x < bounds[i].maxX) return i;
  }
  // Fallback: assign to closest column
  let closest = 0;
  let minDist = Infinity;
  for (let i = 0; i < bounds.length; i++) {
    const mid = (bounds[i].minX + bounds[i].maxX) / 2;
    const dist = Math.abs(x - mid);
    if (dist < minDist) { minDist = dist; closest = i; }
  }
  return closest;
}

// ─── Template-aware scorecard extraction ─────────────────────────────────────

/**
 * Main extraction algorithm — teaches the system the ECSA-HC BSC table structure.
 *
 * Algorithm:
 *  1. Find the scorecard table section (after "Part 1" or "Scorecard Performance")
 *  2. Detect column X-boundaries from the header row
 *  3. Group all table items into visual row bands (Y-tolerance = 3pt)
 *  4. For each row band, assign items to columns by X coordinate
 *  5. Accumulate multi-line cell content within a logical row
 *     (a new logical row starts when the Weight column gets a value 1-5)
 *  6. Build PerspectiveRow objects from accumulated column content
 *
 * Fallback: if column detection fails, use heuristic positional grouping.
 */
function extractScorecardRowsFromItems(items: TextItem[]): PerspectiveRow[] {
  if (items.length === 0) return [];

  const rows: PerspectiveRow[] = [];

  // ── Step 1: Find the scorecard section boundaries ─────────────────────────
  // We look for "Part 1" or "Scorecard Performance" to find where the table starts
  // and "Part 2" or "General Competencies" to find where it ends.

  let scorecardStartY = -1;
  let scorecardEndY = -1;
  let scorecardPage = -1;
  let endPage = -1;

  // Sort items top-to-bottom, left-to-right across all pages
  const allSorted = [...items].sort((a, b) =>
    a.page !== b.page ? a.page - b.page : b.y - a.y || a.x - b.x
  );

  for (const item of allSorted) {
    const lower = item.str.toLowerCase();
    if (scorecardStartY < 0 && (
      lower.includes('part 1') ||
      lower.includes('scorecard performance') ||
      lower.includes('scorecard')
    )) {
      scorecardStartY = item.y;
      scorecardPage = item.page;
    }
    if (scorecardStartY >= 0 && scorecardEndY < 0 && (
      lower.includes('part 2') ||
      lower.includes('general competenc') ||
      lower.includes('competencies')
    ) && item.page >= scorecardPage) {
      scorecardEndY = item.y;
      endPage = item.page;
    }
  }

  // Filter items to the scorecard section only
  let tableItems = allSorted.filter((item) => {
    if (scorecardPage < 0) return true; // no boundary found, use all
    if (item.page < scorecardPage) return false;
    if (item.page === scorecardPage && item.y > scorecardStartY) return false; // above start
    if (endPage > 0 && item.page === endPage && item.y > scorecardEndY) return false; // at/after end
    if (endPage > 0 && item.page > endPage) return false;
    return true;
  });

  if (tableItems.length === 0) tableItems = allSorted; // fallback: use all items

  // ── Step 2: Detect column boundaries ─────────────────────────────────────
  const columnBounds = detectColumnBounds(tableItems);

  // ── Step 3: Group items into visual row bands (3pt Y tolerance) ───────────
  // Process page by page
  const pageMap = new Map<number, TextItem[]>();
  for (const item of tableItems) {
    if (!pageMap.has(item.page)) pageMap.set(item.page, []);
    pageMap.get(item.page)!.push(item);
  }

  // Collect all visual row bands across pages
  interface VisualRowBand {
    y: number;
    page: number;
    items: TextItem[];
  }
  const allBands: VisualRowBand[] = [];

  for (const [pageNum, pageItems] of Array.from(pageMap.entries()).sort((a, b) => a[0] - b[0])) {
    // Sort top-to-bottom
    const sorted = [...pageItems].sort((a, b) => b.y - a.y || a.x - b.x);

    let currentBand: TextItem[] = [];
    let bandY = -9999;

    for (const item of sorted) {
      if (Math.abs(item.y - bandY) > 3 && currentBand.length > 0) {
        allBands.push({ y: bandY, page: pageNum, items: currentBand });
        currentBand = [];
      }
      currentBand.push(item);
      bandY = item.y;
    }
    if (currentBand.length > 0) allBands.push({ y: bandY, page: pageNum, items: currentBand });
  }

  // ── Step 4: Assign items to columns and accumulate logical rows ───────────
  //
  // ECSA-HC BSC table structure (from template analysis):
  //   - Each data row has: Perspective | Objective | Activity | KPI | Target | Weight
  //   - Cells can span multiple visual lines (tall rows)
  //   - A new logical row is identified when the Weight column (col 5) has a digit 1-5
  //   - OR when the Perspective column changes
  //
  // Column index mapping (0-based, left to right):
  //   0 = Perspective
  //   1 = Key Work Objective
  //   2 = Key Activities
  //   3 = Measure / KPI
  //   4 = Target
  //   5 = Weight

  // Heuristic column bounds if detection failed
  // Based on typical ECSA-HC PDF layout (A4, ~595pt wide, margins ~40pt each side)
  const fallbackBounds: ColumnBounds[] = [
    { minX: 35,  maxX: 110, label: 'Perspective' },
    { minX: 110, maxX: 195, label: 'Key Work Objective' },
    { minX: 195, maxX: 310, label: 'Key Activities' },
    { minX: 310, maxX: 430, label: 'KPI' },
    { minX: 430, maxX: 510, label: 'Target' },
    { minX: 510, maxX: 600, label: 'Weight' },
  ];

  const bounds = columnBounds && columnBounds.length >= 4 ? columnBounds : fallbackBounds;

  // Accumulate column content per logical row
  interface LogicalRowAccum {
    col0: string[]; // Perspective
    col1: string[]; // Objective
    col2: string[]; // Activities
    col3: string[]; // KPI
    col4: string[]; // Target
    col5: string[]; // Weight
  }

  const logicalRows: LogicalRowAccum[] = [];
  let current: LogicalRowAccum = { col0: [], col1: [], col2: [], col3: [], col4: [], col5: [] };
  let currentPerspective = '';
  let rowIndex = 0;

  // Helper: flush current accumulator to rows array
  const flushRow = () => {
    const perspective = current.col0.join(' ').trim() || currentPerspective;
    let objective = current.col1.join(' ').trim();
    const activities = current.col2.join(' ').trim();
    const kpi = current.col3.join(' ').trim();
    const targetStr = current.col4.join(' ').trim();
    const weightStr = current.col5.join(' ').trim();

    // Need at least some content to be a valid row
    const hasContent = (objective + activities + kpi).length > 10;
    if (!hasContent) return;

    // Parse weight
    const weightMatch = weightStr.match(/([1-5])/);
    let weight = weightMatch ? parseInt(weightMatch[1]) : 0;
    if (weight === 0) return; // no weight = not a data row

    // Parse target
    let target = targetStr || 'As per workplan';

    // Update current perspective if this row has one
    if (perspective && perspective.length > 2) {
      currentPerspective = perspective;
    }

    rowIndex++;
    const rowPerspective = currentPerspective || 'Performance Objectives';
    const rowObjective = objective || activities || kpi;
    const rowActivity = activities || objective;
    const rowKPI = kpi || activities || objective;

    logicalRows.push({ col0: [], col1: [], col2: [], col3: [], col4: [], col5: [] });
    rows.push({
      id: `row-pdf-${rowIndex}`,
      perspective: rowPerspective,
      objective: rowObjective.length > 200 ? rowObjective.substring(0, 200) + '…' : rowObjective,
      keyActivities: rowActivity.length > 300 ? rowActivity.substring(0, 300) + '…' : rowActivity,
      kpis: [{
        id: `kpi-pdf-${rowIndex}`,
        label: rowKPI.length > 150 ? rowKPI.substring(0, 150) + '…' : rowKPI,
        target,
      }],
      weight,
    });
  };

  // Skip header/label rows
  const isHeaderBand = (band: VisualRowBand): boolean => {
    const text = band.items.map((i) => i.str).join(' ').toLowerCase();
    return (
      /\b(perspective|key work objective|key activities|measure\s*\/\s*kpi|smart|target|weight\s*\(1-5\))\b/.test(text) ||
      /\b(part\s+[12]|scorecard performance|general competenc|ratings|salary|increment|commitment|sign.?off)\b/.test(text) ||
      /\b(achievement for each|will be multiplied|weighted score|total weight)\b/.test(text)
    );
  };

  for (const band of allBands) {
    if (isHeaderBand(band)) continue;

    // Sort band items left-to-right
    band.items.sort((a, b) => a.x - b.x);

    // Check if this band contains a weight value (col 5 = rightmost)
    // A weight value is a standalone digit 1-5 in the rightmost column
    let bandHasWeight = false;
    let bandWeightValue = '';

    for (const item of band.items) {
      if (/^[1-5]$/.test(item.str)) {
        const colIdx = assignToColumn(item.x, bounds);
        // Weight column is the last one (index 5 or the rightmost)
        if (colIdx >= bounds.length - 1 || colIdx === 5) {
          bandHasWeight = true;
          bandWeightValue = item.str;
        }
      }
    }

    // Assign each item in this band to its column
    for (const item of band.items) {
      const colIdx = assignToColumn(item.x, bounds);
      const key = `col${colIdx}` as keyof LogicalRowAccum;
      if (key in current) {
        current[key].push(item.str);
      }
    }

    // If this band has a weight, it marks the end of a logical row
    if (bandHasWeight) {
      // Ensure weight is in col5
      if (!current.col5.includes(bandWeightValue)) {
        current.col5.push(bandWeightValue);
      }
      flushRow();
      current = { col0: [], col1: [], col2: [], col3: [], col4: [], col5: [] };
    }
  }

  // Flush any remaining content
  if ((current.col1.join('') + current.col2.join('') + current.col3.join('')).length > 5) {
    flushRow();
  }

  return rows;
}

// ─── Competency weight extraction from positional items ───────────────────────

/**
 * Extracts competency weights from the competency section of the PDF.
 *
 * The ECSA-HC competency table structure (from template):
 *   Competency Name | Behavioral Expectation | Weight (1-5)
 *
 * Strategy:
 *  1. Find "Part 2" or "General Competencies" section in items
 *  2. Within that section, find each competency name
 *  3. The weight is the rightmost digit 1-5 on the same visual row as the competency name
 *  4. Fallback: scan full text for "CompetencyName ... digit" patterns
 */
function extractCompetencyWeightsFromItems(items: TextItem[]): number[] {
  const weights: number[] = new Array(STANDARD_COMPETENCIES.length).fill(0);

  // Find the competency section
  const allSorted = [...items].sort((a, b) =>
    a.page !== b.page ? a.page - b.page : b.y - a.y || a.x - b.x
  );

  let compSectionStart = -1;
  let compSectionPage = -1;
  let compSectionEnd = -1;
  let compEndPage = -1;

  for (const item of allSorted) {
    const lower = item.str.toLowerCase();
    if (compSectionStart < 0 && (
      lower.includes('part 2') ||
      lower.includes('general competenc')
    )) {
      compSectionStart = item.y;
      compSectionPage = item.page;
    }
    if (compSectionStart >= 0 && compSectionEnd < 0 && (
      lower.includes('part 3') ||
      lower.includes('ratings') ||
      lower.includes('salary increment') ||
      lower.includes('commitment') ||
      lower.includes('sign-off') ||
      lower.includes('sign off')
    ) && item.page >= compSectionPage) {
      compSectionEnd = item.y;
      compEndPage = item.page;
    }
  }

  // Filter to competency section
  const compItems = allSorted.filter((item) => {
    if (compSectionPage < 0) return true;
    if (item.page < compSectionPage) return false;
    if (item.page === compSectionPage && item.y > compSectionStart) return false;
    if (compEndPage > 0 && item.page === compEndPage && item.y > compSectionEnd) return false;
    if (compEndPage > 0 && item.page > compEndPage) return false;
    return true;
  });

  if (compItems.length === 0) return weights;

  // Group competency section items into visual row bands (3pt tolerance)
  const compBands: TextItem[][] = [];
  let currentBand: TextItem[] = [];
  let lastY = -9999;

  for (const item of compItems) {
    if (Math.abs(item.y - lastY) > 3 && currentBand.length > 0) {
      compBands.push(currentBand);
      currentBand = [];
    }
    currentBand.push(item);
    lastY = item.y;
  }
  if (currentBand.length > 0) compBands.push(currentBand);

  // For each competency, find the band containing its name and extract the weight
  for (let ci = 0; ci < STANDARD_COMPETENCIES.length; ci++) {
    const comp = STANDARD_COMPETENCIES[ci];
    const compNameLower = comp.name.toLowerCase();
    const firstWord = compNameLower.split(' ')[0];

    // Find bands that contain this competency name
    for (const band of compBands) {
      const bandText = band.map((i) => i.str).join(' ').toLowerCase();
      if (!bandText.includes(firstWord)) continue;

      // Check if the full name (or enough of it) is present
      const nameWords = compNameLower.split(' ');
      const matchCount = nameWords.filter((w) => bandText.includes(w)).length;
      if (matchCount < Math.ceil(nameWords.length * 0.6)) continue;

      // Sort band left-to-right and find the rightmost digit 1-5
      const sorted = [...band].sort((a, b) => b.x - a.x); // rightmost first
      for (const item of sorted) {
        if (/^[1-5]$/.test(item.str)) {
          weights[ci] = parseInt(item.str);
          break;
        }
      }

      // Also check the next 2 bands (weight might be on the next line)
      if (weights[ci] === 0) {
        const bandIdx = compBands.indexOf(band);
        for (let nb = bandIdx + 1; nb < Math.min(bandIdx + 3, compBands.length); nb++) {
          const nextBand = compBands[nb];
          const nextText = nextBand.map((i) => i.str).join(' ');
          // Only look at bands that don't contain another competency name
          const isAnotherComp = STANDARD_COMPETENCIES.some((c, idx) =>
            idx !== ci && nextText.toLowerCase().includes(c.name.toLowerCase().split(' ')[0])
          );
          if (isAnotherComp) break;

          const nextSorted = [...nextBand].sort((a, b) => b.x - a.x);
          for (const item of nextSorted) {
            if (/^[1-5]$/.test(item.str)) {
              weights[ci] = parseInt(item.str);
              break;
            }
          }
          if (weights[ci] > 0) break;
        }
      }

      if (weights[ci] > 0) break;
    }
  }

  return weights;
}

/**
 * Extracts competency weights from plain text (fallback).
 */
function extractCompetencyWeightsFromText(fullText: string, tokens: string[]): number[] {
  const weights: number[] = new Array(STANDARD_COMPETENCIES.length).fill(0);

  for (let ci = 0; ci < STANDARD_COMPETENCIES.length; ci++) {
    const comp = STANDARD_COMPETENCIES[ci];
    const escapedName = comp.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Strategy 1: Find name in text, look for digit within next 200 chars
    const nameIdx = fullText.toLowerCase().indexOf(comp.name.toLowerCase());
    if (nameIdx >= 0) {
      const window = fullText.substring(nameIdx, nameIdx + 200);
      const digitMatch = window.match(/\b([1-5])\b(?!\d)/);
      if (digitMatch) {
        weights[ci] = parseInt(digitMatch[1]);
        continue;
      }
    }

    // Strategy 2: Token stream proximity
    const compTokenIdx = tokens.findIndex((t) =>
      t.toLowerCase().includes(comp.name.toLowerCase().split(' ')[0])
    );
    if (compTokenIdx >= 0) {
      for (let t = compTokenIdx + 1; t < Math.min(compTokenIdx + 6, tokens.length); t++) {
        if (/^[1-5]$/.test(tokens[t])) {
          weights[ci] = parseInt(tokens[t]);
          break;
        }
      }
      if (weights[ci] > 0) continue;
    }

    // Strategy 3: Regex with wider window
    const compRegex = new RegExp(escapedName + '[^\\d]{0,80}([1-5])\\b', 'i');
    const match = fullText.match(compRegex);
    if (match) {
      weights[ci] = parseInt(match[1]);
    }
  }

  return weights;
}

// ─── Line-based scorecard extraction (fallback) ───────────────────────────────

/**
 * Extracts scorecard rows from plain text lines.
 * Used as fallback when positional extraction yields nothing.
 *
 * The ECSA-HC BSC table in plain text typically looks like:
 *   [Perspective header line]
 *   [Objective text - possibly multi-line]
 *   [Activity text - possibly multi-line]
 *   [KPI text]
 *   [Target value]
 *   [Weight digit]
 *
 * We use a state machine to track which section we're in.
 */
export function extractScorecardRows(lines: string[]): PerspectiveRow[] {
  const rows: PerspectiveRow[] = [];
  let currentPerspective = '';
  let rowIndex = 0;

  // ── Pass 1: Structured extraction with perspective detection ──────────────
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) { i++; continue; }

    // Detect perspective/section header
    const perspHeader = detectPerspectiveHeader(line);
    if (perspHeader) {
      currentPerspective = perspHeader;
      i++;
      continue;
    }

    if (!currentPerspective) { i++; continue; }

    // Skip table header rows
    if (/^(Part|Section|Total|Weight|Score|Rating|Signature|Date|Name|Job|Supervisor|Directorate|Employee|Staff|Perspective|Key Work|Key activities|Measure|KPI|Target|Achievement|Multiply|Weighted)\b/i.test(line)) {
      i++;
      continue;
    }

    // Skip competency names (handled separately)
    if (/^(Teamwork|Respect for Diversity|Integrity|Communication|Results Oriented|Innovation|Leadership)\b/i.test(line)) {
      i++;
      continue;
    }

    // Stop at Part 2
    if (/^Part\s+2\b/i.test(line) || /^General Competenc/i.test(line)) break;

    const wordCount = line.split(/\s+/).length;
    if (wordCount < 3 || wordCount > 150) { i++; continue; }
    if (/^\d+(\.\d+)?$/.test(line)) { i++; continue; }

    // This looks like an objective/activity line — collect it and look ahead
    let objective = line;
    let kpiLabel = '';
    let target = '';
    let weight = 0;
    let lookaheadConsumed = 0;

    for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
      const next = lines[j].trim();
      if (!next) continue;

      // Stop at next perspective header or Part 2
      if (detectPerspectiveHeader(next)) break;
      if (/^Part\s+2\b/i.test(next) || /^General Competenc/i.test(next)) break;

      // KPI line
      if (/^(KPI|Key Performance Indicator|Indicator|Measure)\s*[:\-]/i.test(next)) {
        kpiLabel = next.replace(/^(KPI|Key Performance Indicator|Indicator|Measure)\s*[:\-]\s*/i, '').trim();
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

      // Weight line — explicit or standalone digit
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

      // Inline weight at end of short line
      const inlineWeight = next.match(/\b([1-5])\s*$/);
      if (inlineWeight && next.split(/\s+/).length <= 4) {
        weight = parseInt(inlineWeight[1]);
        lookaheadConsumed = j - i;
        break;
      }

      // If the next line is long, it might be a continuation of the objective
      if (next.split(/\s+/).length >= 6 && !kpiLabel) {
        objective += ' ' + next;
        lookaheadConsumed = j - i;
      }
    }

    if (wordCount >= 3 && weight > 0) {
      rowIndex++;
      const label = kpiLabel || objective;
      rows.push({
        id: `row-pdf-${rowIndex}`,
        perspective: currentPerspective,
        objective: objective.length > 200 ? objective.substring(0, 200) + '…' : objective,
        keyActivities: objective,
        kpis: [{
          id: `kpi-pdf-${rowIndex}`,
          label: label.length > 150 ? label.substring(0, 150) + '…' : label,
          target: target || 'As per workplan',
        }],
        weight,
      });

      i += lookaheadConsumed + 1;
      if (rows.length >= 20) break;
    } else {
      i++;
    }
  }

  if (rows.length > 0) return rows;

  // ── Pass 2: Fallback — scan for objective-like lines with weights ─────────
  const fallbackPerspective = 'Performance Objectives';
  for (let fi = 0; fi < lines.length; fi++) {
    const line = lines[fi].trim();
    const wordCount = line.split(/\s+/).length;

    if (/^(Part|Section|Total|Weight|Score|Rating|Signature|Date|Name|Job|Supervisor|Directorate|Employee|Staff|Page|Perspective|Key Work|Measure|KPI|Target|Teamwork|Respect|Integrity|Communication|Results|Innovation|Leadership|Achievement|Multiply)\b/i.test(line)) continue;
    if (wordCount < 6 || wordCount > 80) continue;
    if (/^\d+(\.\d+)?$/.test(line)) continue;

    let weight = 0;
    let target = '';
    for (let j = fi + 1; j < Math.min(fi + 8, lines.length); j++) {
      const next = lines[j].trim();
      const wMatch = next.match(/^(?:Weight|W)\s*[:\-]?\s*([1-5])\b/i);
      if (wMatch) { weight = parseInt(wMatch[1]); break; }
      if (/^\s*[1-5]\s*$/.test(next)) { weight = parseInt(next.trim()); break; }
      const tMatch = next.match(/^(?:Target|Goal)\s*[:\-]\s*(.+)/i);
      if (tMatch) target = tMatch[1].trim();
    }

    if (weight > 0) {
      rowIndex++;
      rows.push({
        id: `row-pdf-${rowIndex}`,
        perspective: fallbackPerspective,
        objective: line.length > 200 ? line.substring(0, 200) + '…' : line,
        keyActivities: line,
        kpis: [{
          id: `kpi-pdf-${rowIndex}`,
          label: line.length > 150 ? line.substring(0, 150) + '…' : line,
          target: target || 'As per workplan',
        }],
        weight,
      });
    }

    if (rows.length >= 12) break;
  }

  return rows;
}

// ─── Shared PDF Workplan Parser ───────────────────────────────────────────────

/**
 * Parses extracted PDF text into a structured workplan data object.
 */
export function parseWorkplanFromText(text: string, fileName: string): ParsedWorkplanData {
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const fullText = lines.join(' ');
  const tokens = fullText.split(/\s+/).filter(Boolean);

  // ── Staff info extraction ──────────────────────────────────────────────────
  let staffName = '';
  let jobTitle = '';
  let directorate = '';
  let supervisorName = '';

  // Strategy 1: "Name: FirstName LastName" or "Employee: ..."
  const namePatterns = [
    /(?:Name|Employee)\s*[:\-]\s*([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){1,3})/,
    /(?:Name|Employee)\s*[:\-]\s*([A-Z]{2,}(?:\s+[A-Z]{2,}){1,3})/,
  ];
  for (const pat of namePatterns) {
    const m = fullText.match(pat);
    if (m) {
      staffName = m[1].trim();
      if (staffName === staffName.toUpperCase()) {
        staffName = staffName.replace(/\b\w+/g, (w) => w.charAt(0) + w.slice(1).toLowerCase());
      }
      break;
    }
  }

  // Strategy 2: ALL-CAPS two-word name in first 20 lines
  if (!staffName) {
    for (const line of lines.slice(0, 20)) {
      const capsMatch = line.match(/^([A-Z]{2,}\s+[A-Z]{2,}(?:\s+[A-Z]{2,})?)$/);
      if (capsMatch && !/(ECSA|INDIVIDUAL|PERFORMANCE|CONTRACT|BIANNUAL|APPRAISAL|REVIEW|PERIOD|JULY|JUNE|PART|SECTION|SCORECARD|COMPETENCIES|FINANCIAL|CUSTOMER|INTERNAL|INNOVATION|HEPRR|COMPONENT|SUBCOMPONENT)/.test(capsMatch[1])) {
        staffName = capsMatch[1].replace(/\b\w+/g, (w) => w.charAt(0) + w.slice(1).toLowerCase());
        break;
      }
    }
  }

  // Strategy 3: Derive from filename
  if (!staffName && fileName) {
    const fnClean = fileName.replace(/[-_]/g, ' ').replace(/\.(pdf|PDF)$/, '');
    const fnMatch = fnClean.match(/([A-Z][a-z]+\s+[A-Z][a-z]+)/);
    if (fnMatch) staffName = fnMatch[1];
    else {
      const words = fnClean.split(/\s+/).filter((w) => w.length > 2 && !/^(ecsa|hc|individual|performance|contract|workplan|appraisal)$/i.test(w));
      if (words.length >= 2) {
        staffName = words.slice(0, 2).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      }
    }
  }

  // Job title
  const jobPatterns = [
    /(?:Job Title|Position|Title)\s*[:\-]\s*([^\n,]{5,80}?)(?:\s{2,}|Directorate|Cluster|Supervisor|Health|$)/i,
    /(?:Job Title|Position)\s*[:\-]\s*(.{5,80})/i,
  ];
  for (const pat of jobPatterns) {
    const m = fullText.match(pat);
    if (m) { jobTitle = m[1].trim(); break; }
  }

  // Directorate / Cluster
  const dirPatterns = [
    /(?:Directorate|Cluster)\s*[:\-]\s*([^\n,]{3,80}?)(?:\s{2,}|Supervisor|Name|Job|$)/i,
    /(?:Directorate|Cluster)\s*[:\-]\s*(.{3,80})/i,
  ];
  for (const pat of dirPatterns) {
    const m = fullText.match(pat);
    if (m) { directorate = m[1].trim(); break; }
  }

  // Supervisor name
  const supPatterns = [
    /(?:Supervisor|Reporting to)\s*[:\-]\s*((?:Dr\.?\s+)?[A-Z][a-zA-Z\s\.]{3,60}?)(?:\s{2,}|Job Title|Date|$)/i,
    /(?:Supervisor|Reporting to)\s*[:\-]\s*(.{3,80})/i,
  ];
  for (const pat of supPatterns) {
    const m = fullText.match(pat);
    if (m) { supervisorName = m[1].trim(); break; }
  }

  // ── Fiscal year ────────────────────────────────────────────────────────────
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
    } else {
      const anyYearMatch = fullText.match(/(20\d{2})[–\-\/](20\d{2})/);
      if (anyYearMatch) {
        fiscalYear = `FY ${anyYearMatch[1]}-${anyYearMatch[2]} (Jul–Jun)`;
        reviewYear = parseInt(anyYearMatch[1]);
      }
    }
  }

  // ── Scorecard rows (line-based, used as fallback) ──────────────────────────
  const perspectivesObjectives = extractScorecardRows(lines);

  // ── Competencies (text-based, used as fallback) ────────────────────────────
  const textWeights = extractCompetencyWeightsFromText(fullText, tokens);
  const generalCompetencies: CompetencyEntry[] = STANDARD_COMPETENCIES.map((c, idx) => ({
    ...c,
    weight: textWeights[idx] > 0 ? textWeights[idx] : DEFAULT_COMPETENCY_WEIGHTS[idx],
  }));

  // ── Support required ───────────────────────────────────────────────────────
  let supportRequired = '';
  const supportMatch = fullText.match(/(?:Support Required|Management Support)[^\n]{0,30}[:\-]\s*([^]{10,400}?)(?:Employee Signature|Supervisor Signature|Commitment|$)/i);
  if (supportMatch) supportRequired = supportMatch[1].replace(/\s+/g, ' ').trim().substring(0, 400);

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

// ─── Full PDF parse with positional data ─────────────────────────────────────

/**
 * Full parse pipeline:
 *  1. Extract text items with positional data (x, y, page)
 *  2. Run template-aware scorecard extraction (column-based)
 *  3. Run template-aware competency extraction (section-based)
 *  4. If positional extraction yields nothing, fall back to line-based
 *  5. Parse staff info from plain text
 */
export async function parseWorkplanFromPDF(file: File): Promise<ParsedWorkplanData> {
  // Extract plain text for staff info parsing
  const plainText = await extractTextFromPDF(file);
  const baseData = parseWorkplanFromText(plainText, file.name);

  // Extract positional items for template-aware extraction
  try {
    const items = await extractTextItemsFromPDF(file);

    // Run template-aware scorecard extraction
    const positionalRows = extractScorecardRowsFromItems(items);

    // Run template-aware competency extraction
    const positionalWeights = extractCompetencyWeightsFromItems(items);
    const hasPositionalWeights = positionalWeights.some((w) => w > 0);

    const generalCompetencies: CompetencyEntry[] = STANDARD_COMPETENCIES.map((c, idx) => ({
      ...c,
      weight: positionalWeights[idx] > 0
        ? positionalWeights[idx]
        : (baseData.generalCompetencies[idx]?.weight > 0
            ? baseData.generalCompetencies[idx].weight
            : DEFAULT_COMPETENCY_WEIGHTS[idx]),
    }));

    if (positionalRows.length > 0 || hasPositionalWeights) {
      return {
        ...baseData,
        perspectivesObjectives: positionalRows.length > 0
          ? positionalRows
          : baseData.perspectivesObjectives,
        generalCompetencies,
      };
    }
  } catch (_e) {
    // Positional extraction failed — fall back to text-based
  }

  return baseData;
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
