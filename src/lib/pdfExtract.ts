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
  page: number;
}

/**
 * Extracts text with positional data (x, y coordinates) from each page.
 * This allows us to reconstruct table rows by grouping items with similar Y values.
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
    for (const item of content.items as Array<{ str?: string; transform?: number[] }>) {
      const str = (item.str ?? '').trim();
      if (!str) continue;
      const x = item.transform ? item.transform[4] : 0;
      const y = item.transform ? item.transform[5] : 0;
      items.push({ str, x, y, page: i });
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
    const byY: Map<number, string[]> = new Map();
    for (const item of content.items as Array<{ str?: string; transform?: number[] }>) {
      const str = (item.str ?? '').trim();
      if (!str) continue;
      const y = item.transform ? Math.round(item.transform[5]) : 0;
      if (!byY.has(y)) byY.set(y, []);
      byY.get(y)!.push(str);
    }

    // Sort by Y descending (top of page first) and join each line
    const sortedYs = Array.from(byY.keys()).sort((a, b) => b - a);
    for (const y of sortedYs) {
      textParts.push(byY.get(y)!.join(' '));
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

// Standard BSC perspective labels
const BSC_PERSPECTIVES = [
  'Financial/Stewardship',
  'Customer/Stakeholder',
  'Internal Business Processes',
  'Innovation Learning & Growth Perspective',
];

// ─── Perspective Header Detection ────────────────────────────────────────────

export function detectPerspectiveHeader(line: string): string | null {
  const trimmed = line.trim();

  // Check standard BSC perspectives first
  for (const p of BSC_PERSPECTIVES) {
    if (trimmed.toLowerCase().includes(p.toLowerCase().substring(0, 15))) {
      return p;
    }
  }

  // Detect non-standard component/subcomponent headers (no word-count limit — HEPRR headers can be long)
  if (
    /\b(component|subcomponent|programme|program|cluster|pillar|strategic\s+objective)\b/i.test(trimmed)
  ) {
    return trimmed.length > 80 ? trimmed.substring(0, 80) + '…' : trimmed;
  }

  // Detect "Part X" or "Section X" headers
  if (/^(Part|Section)\s+[1-9IVX]/i.test(trimmed) && trimmed.split(/\s+/).length <= 8) {
    return trimmed;
  }

  return null;
}

// ─── Table-aware scorecard extraction ────────────────────────────────────────

/**
 * Reconstructs table rows from positional text items.
 *
 * Strategy:
 *  1. Group items by Y coordinate (same row = within 4pt of each other)
 *  2. Sort each row's items by X (left to right = column order)
 *  3. Map columns to: Perspective | Objective | Activities | KPI | Target | Weight
 *  4. Detect perspective headers and carry them forward
 *
 * This handles the ECSA-HC table format where pdfjs extracts cells in column order.
 */
function extractScorecardRowsFromItems(items: TextItem[]): PerspectiveRow[] {
  if (items.length === 0) return [];

  const rows: PerspectiveRow[] = [];
  let currentPerspective = '';
  let rowIndex = 0;

  // Group items by page then by Y coordinate (within 4pt tolerance)
  const pages = new Map<number, TextItem[]>();
  for (const item of items) {
    if (!pages.has(item.page)) pages.set(item.page, []);
    pages.get(item.page)!.push(item);
  }

  for (const [, pageItems] of Array.from(pages.entries()).sort((a, b) => a[0] - b[0])) {
    // Sort by Y descending (top of page first), then X ascending
    const sorted = [...pageItems].sort((a, b) => b.y - a.y || a.x - b.x);

    // Group into visual rows (items within 4pt Y of each other)
    const visualRows: TextItem[][] = [];
    let currentRow: TextItem[] = [];
    let lastY = -9999;

    for (const item of sorted) {
      if (Math.abs(item.y - lastY) > 4 && currentRow.length > 0) {
        visualRows.push(currentRow);
        currentRow = [];
      }
      currentRow.push(item);
      lastY = item.y;
    }
    if (currentRow.length > 0) visualRows.push(currentRow);

    for (const vRow of visualRows) {
      // Sort items in this row by X (left to right)
      vRow.sort((a, b) => a.x - b.x);
      const rowText = vRow.map((i) => i.str).join(' ').trim();

      // Check if this row is a perspective header
      const perspHeader = detectPerspectiveHeader(rowText);
      if (perspHeader) {
        currentPerspective = perspHeader;
        continue;
      }

      // Skip table header rows
      if (/^(Perspective|Key Work Objective|Key activities|Measure|KPI|Target|Weight|Part|Section|Score|Rating|Signature|Date|Employee|Staff|Supervisor|Directorate|Name|Job Title)\b/i.test(rowText)) continue;

      // Skip very short rows (page numbers, single chars)
      if (rowText.length < 15) continue;

      // Skip rows that are purely numeric
      if (/^\d+(\.\d+)?$/.test(rowText)) continue;

      // Try to extract weight from the rightmost cell (last token that is 1-5)
      const tokens = vRow.map((i) => i.str.trim()).filter(Boolean);
      let weight = 0;
      let weightTokenIdx = -1;

      // Look for weight in rightmost tokens first
      for (let t = tokens.length - 1; t >= 0; t--) {
        if (/^[1-5]$/.test(tokens[t])) {
          weight = parseInt(tokens[t]);
          weightTokenIdx = t;
          break;
        }
      }

      // Build objective text from non-weight tokens
      const contentTokens = weightTokenIdx >= 0
        ? tokens.filter((_, i) => i !== weightTokenIdx)
        : tokens;
      const objectiveText = contentTokens.join(' ').trim();

      // Skip if too short after removing weight
      const wordCount = objectiveText.split(/\s+/).length;
      if (wordCount < 4) continue;

      // Skip lines that look like competency names (handled separately)
      if (/^(Teamwork|Respect for Diversity|Integrity|Communication|Results Oriented|Innovation|Leadership)\b/i.test(objectiveText)) continue;

      // Skip support/signature lines
      if (/^(Support Required|Management Support|Employee Signature|Supervisor Signature|Commitment)\b/i.test(objectiveText)) continue;

      // Use a default perspective if none detected yet
      const perspective = currentPerspective || 'Performance Objectives';

      rowIndex++;
      rows.push({
        id: `row-pdf-${rowIndex}`,
        perspective,
        objective: objectiveText.length > 200 ? objectiveText.substring(0, 200) + '…' : objectiveText,
        keyActivities: objectiveText,
        kpis: [{
          id: `kpi-pdf-${rowIndex}`,
          label: objectiveText.length > 150 ? objectiveText.substring(0, 150) + '…' : objectiveText,
          target: 'As per workplan',
        }],
        weight: weight || 3,
      });

      if (rows.length >= 20) break;
    }
  }

  return rows;
}

// ─── Line-based scorecard extraction (fallback) ───────────────────────────────

/**
 * Extracts scorecard rows from plain text lines.
 * Used as fallback when positional extraction yields nothing.
 *
 * Pass 1 — Structured: detect perspective headers, then collect objective blocks.
 * Pass 2 — Fallback: scan for any substantial text lines.
 */
export function extractScorecardRows(lines: string[]): PerspectiveRow[] {
  const rows: PerspectiveRow[] = [];
  let currentPerspective = '';
  let rowIndex = 0;

  // ── Pass 1: Structured extraction ─────────────────────────────────────────
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Detect perspective/section header
    const perspHeader = detectPerspectiveHeader(line);
    if (perspHeader) {
      currentPerspective = perspHeader;
      continue;
    }

    if (!currentPerspective) continue;

    // Skip header-like lines
    if (/^(Part|Section|Total|Weight|Score|Rating|Signature|Date|Name|Job|Supervisor|Directorate|Employee|Staff|Perspective|Key Work|Key activities|Measure|KPI|Target)\b/i.test(line)) continue;

    // Skip competency names
    if (/^(Teamwork|Respect for Diversity|Integrity|Communication|Results Oriented|Innovation|Leadership)\b/i.test(line)) continue;

    const wordCount = line.split(/\s+/).length;
    if (wordCount < 4 || wordCount > 120) continue;
    if (/^\d+(\.\d+)?$/.test(line)) continue;

    // Look ahead for KPI label, target, and weight within the next 12 lines
    let objective = line;
    let kpiLabel = '';
    let target = '';
    let weight = 0;
    let lookaheadConsumed = 0;

    for (let j = i + 1; j < Math.min(i + 12, lines.length); j++) {
      const next = lines[j].trim();
      if (!next) continue;

      if (detectPerspectiveHeader(next)) break;

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

      // Inline weight at end of line: "...some text 4" or "...some text (4)"
      const inlineWeight = next.match(/\b([1-5])\s*(?:\(.*\))?\s*$/);
      if (inlineWeight && next.split(/\s+/).length <= 3) {
        weight = parseInt(inlineWeight[1]);
        lookaheadConsumed = j - i;
        break;
      }

      if (next.split(/\s+/).length >= 8) break;
    }

    if (wordCount >= 4) {
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
        weight: weight || 3,
      });

      i += lookaheadConsumed;
      if (rows.length >= 20) break;
    }
  }

  if (rows.length > 0) return rows;

  // ── Pass 2: Fallback — scan for objective-like lines ──────────────────────
  const fallbackPerspective = 'Performance Objectives';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const wordCount = line.split(/\s+/).length;

    if (/^(Part|Section|Total|Weight|Score|Rating|Signature|Date|Name|Job|Supervisor|Directorate|Employee|Staff|Page|Perspective|Key Work|Measure|KPI|Target|Teamwork|Respect|Integrity|Communication|Results|Innovation|Leadership)\b/i.test(line)) continue;
    if (wordCount < 8 || wordCount > 80) continue;
    if (/^\d+(\.\d+)?$/.test(line)) continue;

    let weight = 3;
    let target = '';
    for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
      const next = lines[j].trim();
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
      objective: line.length > 200 ? line.substring(0, 200) + '…' : line,
      keyActivities: line,
      kpis: [{
        id: `kpi-pdf-${rowIndex}`,
        label: line.length > 150 ? line.substring(0, 150) + '…' : line,
        target: target || 'As per workplan',
      }],
      weight,
    });

    if (rows.length >= 12) break;
  }

  return rows;
}

// ─── Competency weight extraction ────────────────────────────────────────────

/**
 * Extracts competency weights from the full text.
 *
 * Strategy:
 *  1. Find the position of the competency name in the text
 *  2. Look for a digit 1-5 within the next 200 characters
 *  3. Also scan the token stream for patterns like "Teamwork 5" or "5 Teamwork"
 */
function extractCompetencyWeights(fullText: string, tokens: string[]): number[] {
  const weights: number[] = [];

  for (let ci = 0; ci < STANDARD_COMPETENCIES.length; ci++) {
    const comp = STANDARD_COMPETENCIES[ci];
    const escapedName = comp.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Strategy 1: Find name in text, look for digit within next 200 chars
    const nameIdx = fullText.toLowerCase().indexOf(comp.name.toLowerCase());
    if (nameIdx >= 0) {
      const window = fullText.substring(nameIdx, nameIdx + 200);
      // Look for a standalone digit 1-5 (not part of a larger number)
      const digitMatch = window.match(/\b([1-5])\b(?!\d)/);
      if (digitMatch) {
        weights.push(parseInt(digitMatch[1]));
        continue;
      }
    }

    // Strategy 2: Token stream — find token matching comp name, look at adjacent tokens
    const compTokenIdx = tokens.findIndex((t) =>
      t.toLowerCase().includes(comp.name.toLowerCase().split(' ')[0])
    );
    if (compTokenIdx >= 0) {
      // Check next 5 tokens for a digit
      for (let t = compTokenIdx + 1; t < Math.min(compTokenIdx + 6, tokens.length); t++) {
        if (/^[1-5]$/.test(tokens[t])) {
          weights.push(parseInt(tokens[t]));
          break;
        }
      }
      if (weights.length === ci + 1) continue;
    }

    // Strategy 3: Regex with wider window
    const compRegex = new RegExp(escapedName + '[^\\d]{0,80}([1-5])\\b', 'i');
    const match = fullText.match(compRegex);
    if (match) {
      weights.push(parseInt(match[1]));
    } else {
      // Default weights: first 5 competencies get 5, Innovation gets 4, Leadership gets 2
      const defaults = [5, 5, 5, 5, 5, 4, 2];
      weights.push(defaults[ci] ?? 3);
    }
  }

  return weights;
}

// ─── Shared PDF Workplan Parser ───────────────────────────────────────────────

/**
 * Parses extracted PDF text into a structured workplan data object.
 *
 * Handles:
 *  - Standard "Name: ..." and "Employee: ..." patterns *  - ALL-CAPS name patterns (e.g."AYEBARE TIMOTHY" → "Ayebare Timothy")
 *  - Non-standard perspective headers (HEPRR-MPA, Programme Cluster, etc.)
 *  - Reversed first/last name order in the PDF
 *  - Table-structured PDFs where text is extracted in column order
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
      // Convert ALL-CAPS to Title Case
      if (staffName === staffName.toUpperCase()) {
        staffName = staffName.replace(/\b\w+/g, (w) => w.charAt(0) + w.slice(1).toLowerCase());
      }
      break;
    }
  }

  // Strategy 2: Look for name in the first few lines (often appears without a label in ECSA-HC PDFs)
  if (!staffName) {
    for (const line of lines.slice(0, 20)) {
      // ALL-CAPS two-word name pattern
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
      // Try title-casing the filename words
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
      // Look for any year range like "2026-2027" or "2026/2027"
      const anyYearMatch = fullText.match(/(20\d{2})[–\-\/](20\d{2})/);
      if (anyYearMatch) {
        fiscalYear = `FY ${anyYearMatch[1]}-${anyYearMatch[2]} (Jul–Jun)`;
        reviewYear = parseInt(anyYearMatch[1]);
      }
    }
  }

  // ── Scorecard rows extraction ──────────────────────────────────────────────
  // Line-based extraction (positional extraction is done separately via extractTextItemsFromPDF)
  const perspectivesObjectives = extractScorecardRows(lines);

  // ── Competencies extraction ────────────────────────────────────────────────
  const compWeights = extractCompetencyWeights(fullText, tokens);
  const generalCompetencies: CompetencyEntry[] = STANDARD_COMPETENCIES.map((c, idx) => ({
    ...c,
    weight: compWeights[idx] ?? (idx < 5 ? 5 : idx === 5 ? 4 : 2),
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
 *  1. Extract text items with positional data
 *  2. Run table-aware scorecard extraction on positional items
 *  3. If that yields nothing, fall back to line-based extraction
 *  4. Parse staff info from plain text
 */
export async function parseWorkplanFromPDF(file: File): Promise<ParsedWorkplanData> {
  // Extract plain text for staff info parsing
  const plainText = await extractTextFromPDF(file);
  const baseData = parseWorkplanFromText(plainText, file.name);

  // Extract positional items for table-aware scorecard extraction
  try {
    const items = await extractTextItemsFromPDF(file);
    const positionalRows = extractScorecardRowsFromItems(items);

    if (positionalRows.length > 0) {
      // Positional extraction succeeded — use it for scorecard rows
      // but keep staff info and competencies from text-based parse
      return {
        ...baseData,
        perspectivesObjectives: positionalRows,
      };
    }
  } catch (_e) {
    // Positional extraction failed — fall back to text-based rows
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
