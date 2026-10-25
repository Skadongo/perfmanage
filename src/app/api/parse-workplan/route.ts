import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ParsedKPI {
  label: string;
  target: string;
  weight: number;
}

export interface ParsedPerspective {
  perspective: string;
  objective: string;
  kpis: ParsedKPI[];
  weight: number;
  keyActivities: string;
}

export interface ParsedCompetency {
  name: string;
  description: string;
  weight: number;
}

export interface ParsedWorkplan {
  staffName: string;
  jobTitle: string;
  cluster: string;
  supervisorName: string;
  supervisorTitle: string;
  fiscalYear: string;
  appraisalType: string;
  perspectivesObjectives: ParsedPerspective[];
  generalCompetencies: ParsedCompetency[];
  staffSignatureDate: string;
  supervisorSignatureDate: string;
  rawText: string;
  parseWarnings: string[];
}

// ─── Text Extraction ──────────────────────────────────────────────────────────

async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mammoth = require('mammoth');
  const result = await mammoth.extractRawText({ buffer });
  return result.value as string;
}

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse');
    const fn = typeof pdfParse === 'function' ? pdfParse : pdfParse.default;
    const data = await fn(buffer);
    return data.text as string;
  } catch {
    return '';
  }
}

// ─── ECSA-HC Contract Parser ──────────────────────────────────────────────────

function cleanLine(line: string): string {
  return line.replace(/\s+/g, ' ').trim();
}

function extractField(text: string, patterns: string[]): string {
  for (const pattern of patterns) {
    const re = new RegExp(pattern + '[:\\s]+([^\\n]+)', 'i');
    const m = text.match(re);
    if (m && m[1]) return cleanLine(m[1]);
  }
  return '';
}

function parseWeight(val: string): number {
  const n = parseFloat(val.replace(/[^0-9.]/g, ''));
  return isNaN(n) ? 0 : n;
}

function parsePerspectivesFromText(text: string): ParsedPerspective[] {
  const perspectives: ParsedPerspective[] = [];

  const perspectiveKeywords = [
    'Finance',
    'Customer',
    'Business Process',
    'Internal Process',
    'Learning',
    'Growth',
    'Innovation',
    'Stakeholder',
    'Operations',
  ];

  const lines = text.split('\n').map(cleanLine).filter(Boolean);

  const objectivePattern = /^(?:objective\s*\d+|(?:finance|customer|business|learning|growth|internal|innovation|stakeholder|operations)[^:]*):?\s*(.+)/i;
  const kpiPattern = /(?:kpi|indicator|measure)[:\s]+([^\n]+)/i;
  const targetPattern = /(?:target|goal)[:\s]+([^\n]+)/i;
  const weightPattern = /(?:weight|weighting)[:\s]+(\d+(?:\.\d+)?)/i;

  let currentPerspective = '';
  let currentObjective = '';
  let currentKPIs: ParsedKPI[] = [];
  let currentWeight = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    for (const pk of perspectiveKeywords) {
      if (line.toLowerCase().includes(pk.toLowerCase()) && line.length < 80) {
        if (currentObjective && currentKPIs.length > 0) {
          perspectives.push({
            perspective: currentPerspective || 'General',
            objective: currentObjective,
            kpis: currentKPIs,
            weight: currentWeight,
            keyActivities: '',
          });
          currentKPIs = [];
          currentWeight = 0;
        }
        currentPerspective = pk;
        break;
      }
    }

    const objMatch = line.match(objectivePattern);
    if (objMatch) {
      if (currentObjective && currentKPIs.length > 0) {
        perspectives.push({
          perspective: currentPerspective || 'General',
          objective: currentObjective,
          kpis: currentKPIs,
          weight: currentWeight,
          keyActivities: '',
        });
        currentKPIs = [];
        currentWeight = 0;
      }
      currentObjective = cleanLine(objMatch[1]);
    }

    const kpiMatch = line.match(kpiPattern);
    if (kpiMatch) {
      const kpiLabel = cleanLine(kpiMatch[1]);
      let target = '';
      let weight = 0;
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        const tMatch = lines[j].match(targetPattern);
        if (tMatch) target = cleanLine(tMatch[1]);
        const wMatch = lines[j].match(weightPattern);
        if (wMatch) weight = parseWeight(wMatch[1]);
      }
      currentKPIs.push({ label: kpiLabel, target, weight });
      currentWeight += weight;
    }
  }

  if (currentObjective && currentKPIs.length > 0) {
    perspectives.push({
      perspective: currentPerspective || 'General',
      objective: currentObjective,
      kpis: currentKPIs,
      weight: currentWeight,
      keyActivities: '',
    });
  }

  if (perspectives.length === 0) {
    perspectives.push(...extractFromTablePattern(lines));
  }

  return perspectives;
}

function extractFromTablePattern(lines: string[]): ParsedPerspective[] {
  const perspectives: ParsedPerspective[] = [];
  const tableRowPattern = /^(.{5,60})\s{2,}(.{5,80})\s{2,}(\S+)\s{2,}(\d+(?:\.\d+)?)$/;

  let currentPerspective = 'Performance';
  const kpisBuffer: ParsedKPI[] = [];
  let objectiveBuffer = '';
  let weightBuffer = 0;

  for (const line of lines) {
    const m = line.match(tableRowPattern);
    if (m) {
      const [, col1, col2, col3, col4] = m;
      let weight = parseWeight(col4);
      if (weight > 0) {
        if (!objectiveBuffer) objectiveBuffer = cleanLine(col1);
        kpisBuffer.push({ label: cleanLine(col2), target: cleanLine(col3), weight });
        weightBuffer += weight;
      }
    }
  }

  if (objectiveBuffer && kpisBuffer.length > 0) {
    perspectives.push({
      perspective: currentPerspective,
      objective: objectiveBuffer,
      kpis: kpisBuffer,
      weight: weightBuffer,
      keyActivities: '',
    });
  }

  return perspectives;
}

function parseCompetenciesFromText(text: string): ParsedCompetency[] {
  const standardCompetencies: ParsedCompetency[] = [
    { name: 'Teamwork', description: 'Creates a culture of teamwork and responds rationally to feedback', weight: 5 },
    { name: 'Respect for Diversity', description: 'Values individual differences and promotes a peaceful work environment', weight: 5 },
    { name: 'Integrity', description: 'Is reliable, meets all deadlines, and takes credit only for own work', weight: 5 },
    { name: 'Communication', description: 'Explains complex issues clearly and uses visual aids effectively', weight: 5 },
    { name: 'Results Oriented', description: 'Prioritizes activities and matches tasks with team capabilities', weight: 5 },
    { name: 'Innovation', description: 'Thinks outside the box to foster team creativity', weight: 5 },
    { name: 'Leadership', description: 'Acts as a role model and provides timely specific feedback to staff', weight: 5 },
  ];

  const lowerText = text.toLowerCase();
  const found = standardCompetencies.filter((c) => lowerText.includes(c.name.toLowerCase()));
  return found.length > 0 ? found : standardCompetencies;
}

function parseWorkplanFromText(text: string, filename: string): ParsedWorkplan {
  const warnings: string[] = [];

  let staffName = extractField(text, [
    'employee name',
    'staff name',
    'name of employee',
    'employee',
    'name',
  ]);

  if (!staffName) {
    const namePart = filename
      .replace(/[_-]/g, ' ')
      .replace(/performance.contract.*/i, '')
      .replace(/\.pdf|\.docx|\.doc/i, '')
      .trim();
    if (namePart.length > 3) staffName = namePart;
  }

  if (!staffName) warnings.push('Could not extract staff name');

  const jobTitle = extractField(text, ['job title', 'position', 'designation', 'title', 'post']);
  if (!jobTitle) warnings.push('Could not extract job title');

  const cluster = extractField(text, ['cluster', 'department', 'division', 'unit', 'directorate']);
  const supervisorName = extractField(text, ['supervisor name', 'supervisor', 'line manager', 'reporting to', 'manager', 'appraiser']);
  const supervisorTitle = extractField(text, ['supervisor.*title', 'supervisor.*position', 'manager.*title']);

  let fiscalYear = '';
  const fyMatch = text.match(/(?:july|jan)\s+(\d{4})\s*[–\-–]\s*(?:june|dec)\s+(\d{4})/i)
    || text.match(/(\d{4})\s*[–\-–]\s*(\d{4})/);
  if (fyMatch) {
    fiscalYear = `FY ${fyMatch[1]}-${fyMatch[2]}`;
  } else {
    const yearMatch = text.match(/20\d{2}/);
    fiscalYear = yearMatch ? `FY ${yearMatch[0]}-${parseInt(yearMatch[0]) + 1}` : 'FY 2026-2027';
  }

  const appraisalType = text.match(/biannual/i) ? 'Biannual Appraisal' : text.match(/annual/i) ?'Annual Appraisal' : text.match(/mid.year/i) ?'Mid-Year Review' :'Annual Appraisal';

  const datePattern = /(\d{1,2}[./]\d{1,2}[./]\d{2,4})/g;
  const dates = text.match(datePattern) || [];
  const staffSignatureDate = dates[0] || '';
  const supervisorSignatureDate = dates[1] || '';

  const perspectivesObjectives = parsePerspectivesFromText(text);
  if (perspectivesObjectives.length === 0) {
    warnings.push('Could not extract scorecard objectives — please review manually');
  }

  const generalCompetencies = parseCompetenciesFromText(text);

  return {
    staffName: staffName || 'Unknown Staff',
    jobTitle: jobTitle || '',
    cluster: cluster || '',
    supervisorName: supervisorName || '',
    supervisorTitle: supervisorTitle || '',
    fiscalYear,
    appraisalType,
    perspectivesObjectives,
    generalCompetencies,
    staffSignatureDate,
    supervisorSignatureDate,
    rawText: text.slice(0, 2000),
    parseWarnings: warnings,
  };
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    if (files.length > 28) {
      return NextResponse.json({ error: 'Maximum 28 files allowed per batch' }, { status: 400 });
    }

    const results: Array<{
      filename: string;
      success: boolean;
      data?: ParsedWorkplan;
      error?: string;
    }> = [];

    for (const file of files) {
      const filename = file.name;
      const ext = filename.split('.').pop()?.toLowerCase();

      if (!['docx', 'doc', 'pdf'].includes(ext || '')) {
        results.push({ filename, success: false, error: 'Unsupported file type. Use .docx or .pdf' });
        continue;
      }

      try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        let text = '';
        if (ext === 'pdf') {
          text = await extractTextFromPdf(buffer);
        } else {
          text = await extractTextFromDocx(buffer);
        }

        if (!text || text.trim().length < 50) {
          results.push({ filename, success: false, error: 'Could not extract text from file — file may be scanned/image-based' });
          continue;
        }

        const parsed = parseWorkplanFromText(text, filename);
        results.push({ filename, success: true, data: parsed });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Parse error';
        results.push({ filename, success: false, error: message });
      }
    }

    return NextResponse.json({ results });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
