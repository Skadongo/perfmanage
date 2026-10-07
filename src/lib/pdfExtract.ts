'use client';

// ─── PDF Text Extraction via CDN-loaded pdfjs-dist ────────────────────────────
// Trained on ECSA-HC Individual Performance Contract template (blank + Ayebare Timothy filled)
// Template structure:
//   Part 1 — Scorecard Performance (80% total weight)
//     Table columns: Perspective | Key Work Objective | Key Activities | Measure/KPI (SMART) | Target | Weight (1-5)
//     BSC Perspectives: Financial/Stewardship | Customer/Stakeholder | Internal Business Processes | Innovation Learning & Growth
//   Part 2 — General Competencies (20% total weight)
//     7 fixed competencies: Teamwork, Respect for Diversity, Integrity, Communication, Results Oriented, Innovation, Leadership (GS3+)
//     Each rated 1-5 based on behavioral evidence
//   Part 3 — Ratings & Salary Increment Policy
//   Part 4 — Commitment & Sign-Off

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

// ─── ECSA-HC Template Constants ───────────────────────────────────────────────
// Derived from the blank template and Ayebare Timothy filled contract

/**
 * The 7 standard ECSA-HC competencies (Part 2, 20% total weight).
 * Weights are rated 1-5 based on behavioral evidence.
 * From Ayebare Timothy contract: Teamwork=5, Respect=5, Integrity=5, Communication=5, Results=5, Innovation=4, Leadership=2
 */
const STANDARD_COMPETENCIES: Omit<CompetencyEntry, 'weight'>[] = [
  { id: 'c1', name: 'Teamwork', description: 'Creates a culture of teamwork and responds rationally to feedback.' },
  { id: 'c2', name: 'Respect for Diversity', description: 'Values individual differences and promotes a peaceful work environment.' },
  { id: 'c3', name: 'Integrity', description: 'Reliable, meets all deadlines, and takes credit only for own work.' },
  { id: 'c4', name: 'Communication', description: 'Explains complex issues clearly and uses visual aids effectively.' },
  { id: 'c5', name: 'Results Oriented', description: 'Prioritizes activities and matches tasks with team capabilities.' },
  { id: 'c6', name: 'Innovation', description: 'Thinks "outside the box" to foster team creativity.' },
  { id: 'c7', name: 'Leadership (GS3+)', description: 'Acts as a role model and provides timely specific feedback to staff.' },
];

/**
 * Default competency weights from the Ayebare Timothy filled contract.
 * Used when weights cannot be extracted from the PDF.
 */
const DEFAULT_COMPETENCY_WEIGHTS = [5, 5, 5, 5, 5, 4, 2];

/**
 * The 4 standard BSC perspectives from the ECSA-HC blank template.
 * Staff may also use non-standard component/subcomponent headers (e.g., HEPRR-MPA).
 */
const BSC_PERSPECTIVES = [
  'Financial/Stewardship',
  'Customer/Stakeholder',
  'Internal Business Processes',
  'Innovation Learning & Growth Perspective',
];

/**
 * Keywords that identify the 4 standard BSC perspectives.
 * Used for fuzzy matching when the exact label is not found.
 */
const BSC_PERSPECTIVE_KEYWORDS: { keywords: string[]; canonical: string }[] = [
  { keywords: ['financial', 'stewardship'], canonical: 'Financial/Stewardship' },
  { keywords: ['customer', 'stakeholder'], canonical: 'Customer/Stakeholder' },
  { keywords: ['internal', 'business', 'process'], canonical: 'Internal Business Processes' },
  { keywords: ['innovation', 'learning', 'growth'], canonical: 'Innovation Learning & Growth Perspective' },
];

// ─── Perspective Header Detection ────────────────────────────────────────────

/**
 * Detects if a line is a BSC perspective header or a non-standard component header.
 * Returns the canonical perspective name if matched, or the raw header for non-standard ones.
 */
export function detectPerspectiveHeader(line: string): string | null {
  const trimmed = line.trim();
  const lower = trimmed.toLowerCase();

  // Check standard BSC perspectives (fuzzy match)
  for (const { keywords, canonical } of BSC_PERSPECTIVE_KEYWORDS) {
    const matchCount = keywords.filter((kw) => lower.includes(kw)).length;
    if (matchCount >= Math.ceil(keywords.length * 0.6)) {
      return canonical;
    }
  }

  // Detect non-standard component/subcomponent headers (HEPRR, Programme, etc.)
  // These are used when staff work on specific programmes/components
  if (
    /\b(component|subcomponent|programme|program|cluster|pillar|strategic\s+objective|heprr|mpa)\b/i.test(trimmed)
  ) {
    return trimmed.length > 100 ? trimmed.substring(0, 100) + '…' : trimmed;
  }

  return null;
}

// ─── ECSA-HC BSC Table Column Layout ─────────────────────────────────────────
//
// The ECSA-HC BSC template has 6 columns (from blank template):
//   Col 0: Perspective          — narrowest, ~60-80pt wide
//   Col 1: Key Work Objective   — ~100-120pt wide
//   Col 2: Key Activities       — ~120-150pt wide (often widest text column)
//   Col 3: Measure / KPI (SMART)— ~120-150pt wide
//   Col 4: Target               — ~40-60pt wide (numeric)
//   Col 5: Weight (1-5)         — ~30-50pt wide (single digit 1-5)
//
// From Ayebare Timothy contract (filled example):
//   Row 1: [HEPRR-MPA Component] | [support regional info systems...] | [support 4 countries...] | [# countries supported...] | 4 | 5
//   Row 2: [same perspective]    | [same objective]                   | [develop HIS layer...]   | [# countries HIS layer...]  | 3 | 5
//   Row 3: [same perspective]    | [same objective]                   | [rollout SLIPTA...]      | [# countries SLIPTA...]     | 3 | 4
//   Row 4: [same perspective]    | [same objective]                   | [deploy AMR tools...]    | [# countries AMR...]        | 3 | 2

interface ColumnBounds {
  minX: number;
  maxX: number;
  label: string;
}

/**
 * Detects the X-coordinate boundaries of each column by finding the
 * table header row ("Perspective | Key Work Objective | Key activities | ...").
 * Trained on the ECSA-HC blank template header row.
 */
function detectColumnBounds(items: TextItem[]): ColumnBounds[] | null {
  // Column header keywords from the ECSA-HC template
  const headerKeywords = ['perspective', 'key work', 'key activ', 'measure', 'kpi', 'target', 'weight'];

  const headerItems = items.filter((item) => {
    const lower = item.str.toLowerCase();
    return headerKeywords.some((kw) => lower.includes(kw));
  });

  if (headerItems.length < 3) return null;

  // Group header items by Y coordinate (within 8pt tolerance)
  const yGroups: Map<number, TextItem[]> = new Map();
  for (const item of headerItems) {
    const roundedY = Math.round(item.y / 8) * 8;
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

  // Build column bounds
  const bounds: ColumnBounds[] = bestGroup.map((item, idx) => ({
    minX: item.x - 5,
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
 * Main extraction algorithm — trained on the ECSA-HC BSC template structure.
 *
 * Algorithm:
 *  1. Find Part 1 (Scorecard Performance) section boundaries
 *  2. Detect column X-boundaries from the header row
 *  3. Group all table items into visual row bands (Y-tolerance = 4pt)
 *  4. For each row band, assign items to columns by X coordinate
 *  5. Accumulate multi-line cell content within a logical row
 *     (a new logical row starts when the Weight column gets a digit 1-5)
 *  6. Build PerspectiveRow objects from accumulated column content
 *
 * Fallback: if column detection fails, use heuristic positional grouping.
 */
function extractScorecardRowsFromItems(items: TextItem[]): PerspectiveRow[] {
  if (items.length === 0) return [];

  const rows: PerspectiveRow[] = [];

  // ── Step 1: Find the scorecard section boundaries ─────────────────────────
  const allSorted = [...items].sort((a, b) =>
    a.page !== b.page ? a.page - b.page : b.y - a.y || a.x - b.x
  );

  let scorecardStartY = -1;
  let scorecardEndY = -1;
  let scorecardPage = -1;
  let endPage = -1;

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
      lower.includes('general competenc')
    ) && item.page >= scorecardPage) {
      scorecardEndY = item.y;
      endPage = item.page;
    }
  }

  // Filter items to the scorecard section only
  let tableItems = allSorted.filter((item) => {
    if (scorecardPage < 0) return true;
    if (item.page < scorecardPage) return false;
    if (item.page === scorecardPage && item.y > scorecardStartY) return false;
    if (endPage > 0 && item.page === endPage && item.y > scorecardEndY) return false;
    if (endPage > 0 && item.page > endPage) return false;
    return true;
  });

  if (tableItems.length === 0) tableItems = allSorted;

  // ── Step 2: Detect column boundaries ─────────────────────────────────────
  const columnBounds = detectColumnBounds(tableItems);

  // Fallback column bounds based on ECSA-HC A4 template layout (~595pt wide, ~40pt margins)
  // Calibrated from the blank template and Ayebare Timothy contract
  const fallbackBounds: ColumnBounds[] = [
    { minX: 35,  maxX: 115, label: 'Perspective' },
    { minX: 115, maxX: 200, label: 'Key Work Objective' },
    { minX: 200, maxX: 320, label: 'Key Activities' },
    { minX: 320, maxX: 440, label: 'Measure/KPI' },
    { minX: 440, maxX: 515, label: 'Target' },
    { minX: 515, maxX: 600, label: 'Weight' },
  ];

  const bounds = columnBounds && columnBounds.length >= 4 ? columnBounds : fallbackBounds;

  // ── Step 3: Group items into visual row bands (4pt Y tolerance) ───────────
  const pageMap = new Map<number, TextItem[]>();
  for (const item of tableItems) {
    if (!pageMap.has(item.page)) pageMap.set(item.page, []);
    pageMap.get(item.page)!.push(item);
  }

  interface VisualRowBand {
    y: number;
    page: number;
    items: TextItem[];
  }
  const allBands: VisualRowBand[] = [];

  for (const [pageNum, pageItems] of Array.from(pageMap.entries()).sort((a, b) => a[0] - b[0])) {
    const sorted = [...pageItems].sort((a, b) => b.y - a.y || a.x - b.x);

    let currentBand: TextItem[] = [];
    let bandY = -9999;

    for (const item of sorted) {
      if (Math.abs(item.y - bandY) > 4 && currentBand.length > 0) {
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
  // ECSA-HC template row structure (from Ayebare Timothy contract):
  //   Col 0 = Perspective (e.g., "HEPRR-MPA Component Subcomponent 1.4")
  //   Col 1 = Key Work Objective (e.g., "support regional information systems...")
  //   Col 2 = Key Activities (e.g., "support 4 countries to develop...")
  //   Col 3 = Measure/KPI (e.g., "# countries supported to expand...")
  //   Col 4 = Target (e.g., "4")
  //   Col 5 = Weight (e.g., "5") — triggers end of logical row

  interface LogicalRowAccum {
    col0: string[]; // Perspective
    col1: string[]; // Key Work Objective
    col2: string[]; // Key Activities
    col3: string[]; // Measure/KPI
    col4: string[]; // Target
    col5: string[]; // Weight (1-5)
  }

  let current: LogicalRowAccum = { col0: [], col1: [], col2: [], col3: [], col4: [], col5: [] };
  let currentPerspective = '';
  let rowIndex = 0;

  // Skip header/label rows
  const isHeaderBand = (band: VisualRowBand): boolean => {
    const text = band.items.map((i) => i.str).join(' ').toLowerCase();
    return (
      /\b(perspective|key work objective|key activities|measure\s*\/\s*kpi|smart|target|weight\s*\(1-5\))\b/.test(text) ||
      /\b(part\s+[1234]|scorecard performance|general competenc|ratings|salary|increment|commitment|sign.?off)\b/.test(text) ||
      /\b(achievement for each|will be multiplied|weighted score|total weight|80%|20%)\b/.test(text)
    );
  };

  const flushRow = () => {
    const perspRaw = current.col0.join(' ').trim();
    const perspective = perspRaw || currentPerspective;
    let objective = current.col1.join(' ').trim();
    const activities = current.col2.join(' ').trim();
    const kpi = current.col3.join(' ').trim();
    const targetStr = current.col4.join(' ').trim();
    const weightStr = current.col5.join(' ').trim();

    // Need meaningful content
    const hasContent = (objective + activities + kpi).length > 8;
    if (!hasContent) return;

    // Parse weight — must be a digit 1-5
    const weightMatch = weightStr.match(/([1-5])/);
    let weight = weightMatch ? parseInt(weightMatch[1]) : 0;
    if (weight === 0) return;

    // Update current perspective
    if (perspective && perspective.length > 2) {
      currentPerspective = perspective;
    }

    // Parse target — numeric or descriptive
    let target = targetStr || 'As per workplan';

    // Build the row — objective takes priority, then activities, then KPI
    const rowObjective = objective || activities || kpi;
    const rowActivity = activities || objective;
    const rowKPI = kpi || activities || objective;

    rowIndex++;
    rows.push({
      id: `row-pdf-${rowIndex}`,
      perspective: currentPerspective || 'Performance Objectives',
      objective: rowObjective.length > 250 ? rowObjective.substring(0, 250) + '…' : rowObjective,
      keyActivities: rowActivity.length > 350 ? rowActivity.substring(0, 350) + '…' : rowActivity,
      kpis: [{
        id: `kpi-pdf-${rowIndex}`,
        label: rowKPI.length > 200 ? rowKPI.substring(0, 200) + '…' : rowKPI,
        target,
      }],
      weight,
    });
  };

  for (const band of allBands) {
    if (isHeaderBand(band)) continue;

    band.items.sort((a, b) => a.x - b.x);

    // Check if this band has a weight value in the rightmost column
    let bandHasWeight = false;
    let bandWeightValue = '';

    for (const item of band.items) {
      if (/^[1-5]$/.test(item.str)) {
        const colIdx = assignToColumn(item.x, bounds);
        if (colIdx >= bounds.length - 1 || colIdx === 5) {
          bandHasWeight = true;
          bandWeightValue = item.str;
        }
      }
    }

    // Assign each item to its column
    for (const item of band.items) {
      const colIdx = assignToColumn(item.x, bounds);
      const key = `col${colIdx}` as keyof LogicalRowAccum;
      if (key in current) {
        current[key].push(item.str);
      }
    }

    // Weight in rightmost column = end of logical row
    if (bandHasWeight) {
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
 * Extracts competency weights from Part 2 (General Competencies) section.
 *
 * ECSA-HC competency table structure (from template):
 *   Competency Name | Behavioral Expectation | Weight (1-5)
 *
 * From Ayebare Timothy contract:
 *   Teamwork=5, Respect for Diversity=5, Integrity=5, Communication=5,
 *   Results Oriented=5, Innovation=4, Leadership (GS3+)=2
 *
 * Strategy:
 *  1. Find "Part 2" or "General Competencies" section
 *  2. Within that section, find each competency name
 *  3. The weight is the rightmost digit 1-5 on the same visual row
 *  4. Also check next 2 bands (weight may be on next line)
 */
function extractCompetencyWeightsFromItems(items: TextItem[]): number[] {
  const weights: number[] = new Array(STANDARD_COMPETENCIES.length).fill(0);

  const allSorted = [...items].sort((a, b) =>
    a.page !== b.page ? a.page - b.page : b.y - a.y || a.x - b.x
  );

  // Find Part 2 section boundaries
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

  // Group into visual row bands (4pt tolerance)
  const compBands: TextItem[][] = [];
  let currentBand: TextItem[] = [];
  let lastY = -9999;

  for (const item of compItems) {
    if (Math.abs(item.y - lastY) > 4 && currentBand.length > 0) {
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

    for (const band of compBands) {
      const bandText = band.map((i) => i.str).join(' ').toLowerCase();
      if (!bandText.includes(firstWord)) continue;

      // Check if enough of the name is present
      const nameWords = compNameLower.split(' ');
      const matchCount = nameWords.filter((w) => bandText.includes(w)).length;
      if (matchCount < Math.ceil(nameWords.length * 0.6)) continue;

      // Sort band right-to-left and find the rightmost digit 1-5
      const sorted = [...band].sort((a, b) => b.x - a.x);
      for (const item of sorted) {
        if (/^[1-5]$/.test(item.str)) {
          weights[ci] = parseInt(item.str);
          break;
        }
      }

      // Check next 2 bands if weight not found on same line
      if (weights[ci] === 0) {
        const bandIdx = compBands.indexOf(band);
        for (let nb = bandIdx + 1; nb < Math.min(bandIdx + 3, compBands.length); nb++) {
          const nextBand = compBands[nb];
          const nextText = nextBand.map((i) => i.str).join(' ');
          // Stop if next band contains another competency name
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

    let objective = line;
    let kpiLabel = '';
    let target = '';
    let weight = 0;
    let lookaheadConsumed = 0;

    for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
      const next = lines[j].trim();
      if (!next) continue;

      if (detectPerspectiveHeader(next)) break;
      if (/^Part\s+2\b/i.test(next) || /^General Competenc/i.test(next)) break;

      if (/^(KPI|Key Performance Indicator|Indicator|Measure)\s*[:\-]/i.test(next)) {
        kpiLabel = next.replace(/^(KPI|Key Performance Indicator|Indicator|Measure)\s*[:\-]\s*/i, '').trim();
        lookaheadConsumed = j - i;
        continue;
      }

      const targetMatch = next.match(/^(?:Target|Goal|Expected Result)\s*[:\-]\s*(.+)/i);
      if (targetMatch) {
        target = targetMatch[1].trim();
        lookaheadConsumed = j - i;
        continue;
      }

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

      const inlineWeight = next.match(/\b([1-5])\s*$/);
      if (inlineWeight && next.split(/\s+/).length <= 4) {
        weight = parseInt(inlineWeight[1]);
        lookaheadConsumed = j - i;
        break;
      }

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
        objective: objective.length > 250 ? objective.substring(0, 250) + '…' : objective,
        keyActivities: objective,
        kpis: [{
          id: `kpi-pdf-${rowIndex}`,
          label: label.length > 200 ? label.substring(0, 200) + '…' : label,
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
        objective: line.length > 250 ? line.substring(0, 250) + '…' : line,
        keyActivities: line,
        kpis: [{
          id: `kpi-pdf-${rowIndex}`,
          label: line.length > 200 ? line.substring(0, 200) + '…' : line,
          target: target || 'As per workplan',
        }],
        weight,
      });
    }

    if (rows.length >= 12) break;
  }

  return rows;
}

// ─── Staff Info Extraction ────────────────────────────────────────────────────

/**
 * Parses staff information from the ECSA-HC contract header.
 *
 * ECSA-HC template header fields (from blank template):
 *   Name: [Employee Name]
 *   Job Title: [Title]
 *   Directorate/Cluster: [Cluster]
 *   Supervisor: [Supervisor Name]
 *   Review Period: July YYYY – June YYYY
 *
 * From Ayebare Timothy contract:
 *   Name: Ayebare Timothy
 *   Job Title: Snr Systems Engineer-HEPRR MPA
 *   Cluster: Health Systems
 *   Supervisor: Dr Mohammed Mohammed Ali
 *   Review Period: July 2026 – June 2027
 */
function extractStaffInfo(fullText: string, lines: string[], fileName: string): {
  staffName: string;
  jobTitle: string;
  directorate: string;
  supervisorName: string;
  fiscalYear: string;
  reviewYear: number;
} {
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

  // Strategy 3: Derive from filename (e.g., "Ayebare_Timothy_ECSA-HC_...")
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

  // Fiscal year — from "July YYYY – June YYYY" or "FY YYYY-YYYY"
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

  return {
    staffName: staffName || 'Unknown Staff',
    jobTitle: jobTitle || 'Staff Member',
    directorate: directorate || 'ECSA-HC',
    supervisorName: supervisorName || 'Supervisor',
    fiscalYear,
    reviewYear,
  };
}

// ─── Shared PDF Workplan Parser ───────────────────────────────────────────────

/**
 * Parses extracted PDF text into a structured workplan data object.
 * Used as fallback when positional extraction fails.
 */
export function parseWorkplanFromText(text: string, fileName: string): ParsedWorkplanData {
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const fullText = lines.join(' ');
  const tokens = fullText.split(/\s+/).filter(Boolean);

  const staffInfo = extractStaffInfo(fullText, lines, fileName);

  // Scorecard rows (line-based fallback)
  const perspectivesObjectives = extractScorecardRows(lines);

  // Competencies (text-based fallback)
  const textWeights = extractCompetencyWeightsFromText(fullText, tokens);
  const generalCompetencies: CompetencyEntry[] = STANDARD_COMPETENCIES.map((c, idx) => ({
    ...c,
    weight: textWeights[idx] > 0 ? textWeights[idx] : DEFAULT_COMPETENCY_WEIGHTS[idx],
  }));

  // Support required (Part 4)
  let supportRequired = '';
  const supportMatch = fullText.match(/(?:Support Required|Management Support)[^\n]{0,30}[:\-]\s*([^]{10,400}?)(?:Employee Signature|Supervisor Signature|Commitment|$)/i);
  if (supportMatch) supportRequired = supportMatch[1].replace(/\s+/g, ' ').trim().substring(0, 400);

  return {
    ...staffInfo,
    perspectivesObjectives,
    generalCompetencies,
    supportRequired,
  };
}

// ─── Full PDF parse with positional data ─────────────────────────────────────

/**
 * Full parse pipeline — enforces the ECSA-HC Individual Performance Contract template:
 *
 *  1. Extract plain text for staff info parsing (header fields)
 *  2. Extract positional text items (x, y, page) for table parsing
 *  3. Run template-aware scorecard extraction (6-column BSC table, Part 1)
 *  4. Run template-aware competency extraction (Part 2, 7 standard competencies)
 *  5. If positional extraction yields nothing, fall back to line-based parsing
 *  6. Apply default weights from the ECSA-HC standard (Ayebare Timothy contract)
 *
 * Template validation enforced:
 *  - BSC perspectives must be one of the 4 standard ECSA-HC perspectives
 *    (or a non-standard component/subcomponent header)
 *  - Competencies are always the 7 standard ECSA-HC competencies
 *  - Weights are always 1-5 per row/competency
 *  - Part 1 total weight should be ≤ 80
 *  - Part 2 total weight should be 20-40
 */
export async function parseWorkplanFromPDF(file: File): Promise<ParsedWorkplanData> {
  // Extract plain text for staff info parsing
  const plainText = await extractTextFromPDF(file);
  const baseData = parseWorkplanFromText(plainText, file.name);

  // Extract positional items for template-aware extraction
  try {
    const items = await extractTextItemsFromPDF(file);

    // Run template-aware scorecard extraction (Part 1)
    const positionalRows = extractScorecardRowsFromItems(items);

    // Run template-aware competency extraction (Part 2)
    const positionalWeights = extractCompetencyWeightsFromItems(items);
    const hasPositionalWeights = positionalWeights.some((w) => w > 0);

    // Build competencies — always the 7 standard ECSA-HC competencies
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

/**
 * Client-side validation of extracted workplan data against the ECSA-HC template.
 *
 * Rules enforced (from template):
 *  - Part 1 (Scorecard): total weight ≤ 80, each row weight 1-5
 *  - Part 2 (Competencies): total weight 20-40, each competency weight 1-5
 *  - All 7 standard competencies must be present
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

  // ── Scorecard rows (Part 1 — 80% total weight) ────────────────────────────
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
        message: `Total scorecard weight is ${totalBscWeight}, which exceeds the maximum of 80 (Part 1 = 80% of total). Please review the extracted weights before importing.`,
      });
    }
  }

  // ── Competency weights (Part 2 — 20% total weight) ────────────────────────
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
        message: 'No competencies were extracted. The ECSA-HC template requires all 7 standard competencies.',
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
        message: `Total competency weight is ${totalCompWeight} (Part 2 = 20% of total; expected 20–40 for ECSA-HC standard). Weights may not have been extracted correctly from the PDF.`,
      });
    }

    // Check all 7 standard competencies are present
    const compNames = validComps.map((c: any) => (c.name as string).toLowerCase());
    const missingComps = STANDARD_COMPETENCIES.filter(
      (sc) => !compNames.some((n) => n.includes(sc.name.toLowerCase().split(' ')[0]))
    );
    if (missingComps.length > 0) {
      warnings.push({
        field: 'competencies.missing',
        severity: 'warning',
        message: `Missing competencies: ${missingComps.map((c) => c.name).join(', ')}. The ECSA-HC template requires all 7 standard competencies.`,
      });
    }
  }

  const valid = errors.length === 0;
  return { valid, errors, warnings };
}
