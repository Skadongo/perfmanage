// Export utilities for Evaluation & Reviews
import { formatDate } from '@/lib/dateUtils';

export interface ReviewExportRecord {
  id: string;
  staffName: string;
  role: string;
  reviewType: string;
  status: string;
  dueDate: string;
  submittedDate: string;
  supervisor: string;
  selfScore: number;
  supervisorScore: number;
  overallProgress: number;
  comments: string;
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

function escapeCSV(value: string | number): string {
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportToCSV(reviews: ReviewExportRecord[], filename = 'evaluation-reviews.csv'): void {
  const headers = [
    'Staff Name', 'Role', 'Review Type', 'Status', 'Due Date',
    'Submitted Date', 'Supervisor', 'Self Score', 'Supervisor Score',
    'Overall Progress (%)', 'Comments',
  ];

  const rows = reviews.map(r => [
    r.staffName,
    r.role,
    r.reviewType,
    r.status.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase()),
    r.dueDate,
    r.submittedDate || 'Not submitted',
    r.supervisor,
    r.selfScore > 0 ? r.selfScore.toFixed(1) : 'N/A',
    r.supervisorScore > 0 ? r.supervisorScore.toFixed(1) : 'N/A',
    r.overallProgress,
    r.comments || '',
  ].map(escapeCSV).join(','));

  const csvContent = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// ─── PDF Export ───────────────────────────────────────────────────────────────

export async function exportToPDF(reviews: ReviewExportRecord[], filename = 'evaluation-reviews.pdf'): Promise<void> {
  // Dynamically import jsPDF to avoid SSR issues
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // Header
  doc.setFontSize(16);
  doc.setTextColor(30, 41, 59);
  doc.text('Evaluation & Reviews Report', 14, 16);

  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`ECSA-HC Performance Management System · FY 2025–2026`, 14, 23);
  doc.text(`Generated: ${formatDate(new Date())}`, 14, 28);

  // Summary stats
  const total = reviews.length;
  const approved = reviews.filter(r => r.status === 'approved').length;
  const submitted = reviews.filter(r => r.status === 'submitted').length;
  const overdue = reviews.filter(r => r.status === 'overdue').length;
  const inProgress = reviews.filter(r => r.status === 'in-progress').length;
  const pending = reviews.filter(r => r.status === 'pending').length;

  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  const summaryY = 34;
  const stats = [
    `Total: ${total}`,
    `Approved: ${approved}`,
    `Submitted: ${submitted}`,
    `In Progress: ${inProgress}`,
    `Pending: ${pending}`,
    `Overdue: ${overdue}`,
    `Completion Rate: ${total > 0 ? Math.round(((approved + submitted) / total) * 100) : 0}%`,
  ];
  doc.text(stats.join('   ·   '), 14, summaryY);

  // Table
  autoTable(doc, {
    startY: summaryY + 6,
    head: [[
      'Staff Member', 'Role', 'Review Type', 'Status',
      'Self Score', 'Sup. Score', 'Progress', 'Due Date', 'Supervisor',
    ]],
    body: reviews.map(r => [
      r.staffName,
      r.role,
      r.reviewType,
      r.status.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase()),
      r.selfScore > 0 ? r.selfScore.toFixed(1) : '—',
      r.supervisorScore > 0 ? r.supervisorScore.toFixed(1) : '—',
      `${r.overallProgress}%`,
      r.dueDate,
      r.supervisor,
    ]),
    styles: {
      fontSize: 7.5,
      cellPadding: 2.5,
      textColor: [30, 41, 59],
    },
    headStyles: {
      fillColor: [79, 70, 229],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 36 },
      1: { cellWidth: 34 },
      2: { cellWidth: 26 },
      3: { cellWidth: 22 },
      4: { cellWidth: 16, halign: 'center' },
      5: { cellWidth: 16, halign: 'center' },
      6: { cellWidth: 16, halign: 'center' },
      7: { cellWidth: 22 },
      8: { cellWidth: 36 },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 3) {
        const val = String(data.cell.raw).toLowerCase();
        if (val === 'overdue') data.cell.styles.textColor = [220, 38, 38];
        else if (val === 'approved') data.cell.styles.textColor = [16, 185, 129];
        else if (val === 'submitted') data.cell.styles.textColor = [59, 130, 246];
        else if (val === 'in progress') data.cell.styles.textColor = [245, 158, 11];
      }
    },
  });

  // Footer
  const pageCount = (doc as jsPDF & { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `ECSA-HC PMS · Evaluation & Reviews · Page ${i} of ${pageCount}`,
      doc.internal.pageSize.getWidth() / 2,
      doc.internal.pageSize.getHeight() - 6,
      { align: 'center' }
    );
  }

  doc.save(filename);
}

// ─── Single Appraisal PDF Export ──────────────────────────────────────────────

export interface AppraisalExportData {
  staffName: string;
  role: string;
  department: string;
  supervisor: string;
  reviewType: string;
  fiscalYear?: string;
  status: string;
  dueDate: string;
  submittedDate?: string;
  selfScore: number;
  supervisorScore: number;
  overallProgress: number;
  bscScores: {
    perspective: string;
    selfScore: number;
    supervisorScore: number;
    weight: number;
  }[];
  kpiDetails: {
    kpi: string;
    perspective: string;
    target: string;
    actual: string;
    selfRating: number;
    supervisorRating: number;
    status: string;
  }[];
  comments?: string;
  staffSignature?: string;
  supervisorSignature?: string;
}

const RATING_LABELS: Record<number, string> = {
  1: 'Unsatisfactory',
  2: 'Needs Improvement',
  3: 'Meets Expectations',
  4: 'Exceeds Expectations',
  5: 'Outstanding',
};

function getRatingLabel(score: number): string {
  return RATING_LABELS[Math.round(score)] ?? 'Meets Expectations';
}

export async function exportAppraisalPDF(data: AppraisalExportData, filename?: string): Promise<void> {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentW = pageW - margin * 2;

  // ── Brand colours ──────────────────────────────────────────────────────────
  const brandBlue: [number, number, number] = [30, 64, 175];   // ECSA-HC deep blue
  const brandGold: [number, number, number] = [180, 130, 40];  // ECSA-HC gold accent
  const darkText: [number, number, number] = [15, 23, 42];
  const mutedText: [number, number, number] = [100, 116, 139];
  const lightBg: [number, number, number] = [241, 245, 249];
  const white: [number, number, number] = [255, 255, 255];
  const emerald: [number, number, number] = [16, 185, 129];
  const sky: [number, number, number] = [14, 165, 233];
  const amber: [number, number, number] = [245, 158, 11];
  const red: [number, number, number] = [220, 38, 38];

  // ── Helper: draw horizontal rule ──────────────────────────────────────────
  function hRule(y: number, color: [number, number, number] = [226, 232, 240]) {
    doc.setDrawColor(...color);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageW - margin, y);
  }

  // ── Helper: section heading ────────────────────────────────────────────────
  function sectionHeading(label: string, y: number): number {
    doc.setFillColor(...lightBg);
    doc.roundedRect(margin, y, contentW, 7, 1, 1, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...brandBlue);
    doc.text(label.toUpperCase(), margin + 3, y + 4.8);
    return y + 10;
  }

  // ── Helper: label + value pair ────────────────────────────────────────────
  function labelValue(label: string, value: string, x: number, y: number, colW: number) {
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...mutedText);
    doc.text(label, x, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...darkText);
    doc.text(value || '—', x, y + 4.5);
  }

  // ── Helper: check page overflow ───────────────────────────────────────────
  function checkPage(y: number, needed = 20): number {
    if (y + needed > pageH - 20) {
      doc.addPage();
      addPageFooter();
      return 18;
    }
    return y;
  }

  // ── Footer helper ─────────────────────────────────────────────────────────
  function addPageFooter() {
    const pg = (doc as jsPDF & { internal: { getCurrentPageInfo: () => { pageNumber: number }; getNumberOfPages: () => number } }).internal;
    const pageNum = pg.getCurrentPageInfo().pageNumber;
    doc.setFontSize(7);
    doc.setTextColor(...mutedText);
    doc.text(
      `ECSA-HC Performance Management System  ·  Confidential  ·  Page ${pageNum}`,
      pageW / 2,
      pageH - 8,
      { align: 'center' }
    );
    hRule(pageH - 11, [226, 232, 240]);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE 1 — HEADER BANNER
  // ══════════════════════════════════════════════════════════════════════════

  // Blue banner
  doc.setFillColor(...brandBlue);
  doc.rect(0, 0, pageW, 38, 'F');

  // Gold accent bar
  doc.setFillColor(...brandGold);
  doc.rect(0, 38, pageW, 2, 'F');

  // Organisation name
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...white);
  doc.text('ECSA-HC', margin, 13);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(186, 210, 255);
  doc.text('East, Central and Southern Africa Health Community', margin, 19);

  // Document title (right-aligned)
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...white);
  const titleLabel = data.reviewType === 'Annual Review' ?'ANNUAL PERFORMANCE APPRAISAL' :'MID-YEAR PERFORMANCE APPRAISAL';
  doc.text(titleLabel, pageW - margin, 13, { align: 'right' });

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(186, 210, 255);
  doc.text(`${data.fiscalYear ?? 'FY 2025–2026'}  ·  Generated: ${formatDate(new Date())}`, pageW - margin, 19, { align: 'right' });

  // Status pill
  const statusColor = data.status === 'approved' ? emerald : data.status === 'submitted' ? sky : data.status === 'overdue' ? red : amber;
  doc.setFillColor(...statusColor);
  doc.roundedRect(pageW - margin - 28, 24, 28, 8, 2, 2, 'F');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...white);
  const statusLabel = data.status.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase());
  doc.text(statusLabel, pageW - margin - 14, 29.2, { align: 'center' });

  let curY = 48;

  // ── Section 1: Staff Information ──────────────────────────────────────────
  curY = sectionHeading('1. Staff Information', curY);

  const colW = contentW / 4;
  labelValue('Full Name', data.staffName, margin, curY, colW);
  labelValue('Job Title / Role', data.role, margin + colW, curY, colW);
  labelValue('Department', data.department, margin + colW * 2, curY, colW);
  labelValue('Supervisor', data.supervisor, margin + colW * 3, curY, colW);
  curY += 12;

  const colW2 = contentW / 3;
  labelValue('Review Type', data.reviewType, margin, curY, colW2);
  labelValue('Due Date', data.dueDate, margin + colW2, curY, colW2);
  labelValue('Submitted Date', data.submittedDate || 'Not submitted', margin + colW2 * 2, curY, colW2);
  curY += 14;

  hRule(curY);
  curY += 6;

  // ── Section 2: Overall Score Summary ─────────────────────────────────────
  curY = sectionHeading('2. Overall Score Summary', curY);

  // Self score box
  doc.setFillColor(240, 249, 255);
  doc.setDrawColor(...sky);
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, curY, contentW / 2 - 3, 22, 2, 2, 'FD');

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...sky);
  doc.text('SELF ASSESSMENT', margin + 4, curY + 6);

  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(14, 116, 144);
  doc.text(data.selfScore > 0 ? data.selfScore.toFixed(1) : '—', margin + 4, curY + 17);

  if (data.selfScore > 0) {
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...mutedText);
    doc.text(`/ 5.0  ·  ${getRatingLabel(data.selfScore)}`, margin + 18, curY + 17);
  }

  // Supervisor score box
  const supX = margin + contentW / 2 + 3;
  doc.setFillColor(239, 246, 255);
  doc.setDrawColor(...brandBlue);
  doc.roundedRect(supX, curY, contentW / 2 - 3, 22, 2, 2, 'FD');

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...brandBlue);
  doc.text('SUPERVISOR RATING', supX + 4, curY + 6);

  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...brandBlue);
  doc.text(data.supervisorScore > 0 ? data.supervisorScore.toFixed(1) : '—', supX + 4, curY + 17);

  if (data.supervisorScore > 0) {
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...mutedText);
    doc.text(`/ 5.0  ·  ${getRatingLabel(data.supervisorScore)}`, supX + 18, curY + 17);
  }

  curY += 28;
  hRule(curY);
  curY += 6;

  // ── Section 3: BSC Perspective Breakdown ──────────────────────────────────
  if (data.bscScores && data.bscScores.length > 0) {
    curY = checkPage(curY, 40);
    curY = sectionHeading('3. BSC Perspective Breakdown', curY);

    autoTable(doc, {
      startY: curY,
      head: [['Perspective', 'Weight', 'Self Score', 'Supervisor Score', 'Variance']],
      body: data.bscScores.map(b => [
        b.perspective,
        b.weight > 0 ? `${b.weight}` : '—',
        b.selfScore > 0 ? b.selfScore.toFixed(1) : '—',
        b.supervisorScore > 0 ? b.supervisorScore.toFixed(1) : '—',
        (b.selfScore > 0 && b.supervisorScore > 0)
          ? (b.supervisorScore - b.selfScore > 0 ? '+' : '') + (b.supervisorScore - b.selfScore).toFixed(1)
          : '—',
      ]),
      styles: { fontSize: 8, cellPadding: 3, textColor: darkText },
      headStyles: { fillColor: brandBlue, textColor: white, fontStyle: 'bold', fontSize: 7.5 },
      alternateRowStyles: { fillColor: lightBg },
      columnStyles: {
        0: { cellWidth: 70 },
        1: { cellWidth: 20, halign: 'center' },
        2: { cellWidth: 28, halign: 'center' },
        3: { cellWidth: 35, halign: 'center' },
        4: { cellWidth: 25, halign: 'center' },
      },
      margin: { left: margin, right: margin },
      didParseCell: (hookData) => {
        if (hookData.section === 'body' && hookData.column.index === 4) {
          const val = String(hookData.cell.raw);
          if (val.startsWith('+')) hookData.cell.styles.textColor = emerald;
          else if (val.startsWith('-')) hookData.cell.styles.textColor = red;
        }
      },
    });

    curY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
    hRule(curY);
    curY += 6;
  }

  // ── Section 4: KPI Performance Details ───────────────────────────────────
  if (data.kpiDetails && data.kpiDetails.length > 0) {
    curY = checkPage(curY, 40);
    curY = sectionHeading('4. KPI Performance Details', curY);

    autoTable(doc, {
      startY: curY,
      head: [['KPI', 'Perspective', 'Target', 'Actual', 'Self', 'Sup.', 'Status']],
      body: data.kpiDetails.map(k => [
        k.kpi,
        k.perspective,
        k.target || '—',
        k.actual || '—',
        k.selfRating > 0 ? k.selfRating.toString() : '—',
        k.supervisorRating > 0 ? k.supervisorRating.toString() : '—',
        k.status.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase()),
      ]),
      styles: { fontSize: 7, cellPadding: 2.5, textColor: darkText, overflow: 'linebreak' },
      headStyles: { fillColor: brandBlue, textColor: white, fontStyle: 'bold', fontSize: 7 },
      alternateRowStyles: { fillColor: lightBg },
      columnStyles: {
        0: { cellWidth: 55 },
        1: { cellWidth: 35 },
        2: { cellWidth: 20 },
        3: { cellWidth: 20 },
        4: { cellWidth: 10, halign: 'center' },
        5: { cellWidth: 10, halign: 'center' },
        6: { cellWidth: 22 },
      },
      margin: { left: margin, right: margin },
      didParseCell: (hookData) => {
        if (hookData.section === 'body') {
          if (hookData.column.index === 6) {
            const val = String(hookData.cell.raw).toLowerCase();
            if (val === 'achieved' || val === 'on track') hookData.cell.styles.textColor = emerald;
            else if (val === 'at risk') hookData.cell.styles.textColor = amber;
            else if (val === 'overdue') hookData.cell.styles.textColor = red;
          }
          if (hookData.column.index === 4 || hookData.column.index === 5) {
            const val = Number(hookData.cell.raw);
            if (val >= 4) hookData.cell.styles.textColor = emerald;
            else if (val === 3) hookData.cell.styles.textColor = amber;
            else if (val > 0 && val < 3) hookData.cell.styles.textColor = red;
          }
        }
      },
    });

    curY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
    hRule(curY);
    curY += 6;
  }

  // ── Section 5: Supervisor Comments ────────────────────────────────────────
  if (data.comments) {
    curY = checkPage(curY, 30);
    curY = sectionHeading('5. Supervisor Comments', curY);

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    const commentLines = doc.splitTextToSize(data.comments, contentW - 8);
    const commentH = commentLines.length * 4.5 + 6;
    doc.roundedRect(margin, curY, contentW, commentH, 1.5, 1.5, 'FD');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...darkText);
    doc.text(commentLines, margin + 4, curY + 5);
    curY += commentH + 8;
    hRule(curY);
    curY += 6;
  }

  // ── Section 6: Signatures ─────────────────────────────────────────────────
  curY = checkPage(curY, 50);
  curY = sectionHeading('6. Signatures & Authorisation', curY);

  const sigColW = (contentW - 8) / 2;

  // Staff signature box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, curY, sigColW, 36, 1.5, 1.5, 'FD');

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...mutedText);
  doc.text('STAFF MEMBER', margin + 4, curY + 6);

  if (data.staffSignature) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bolditalic');
    doc.setTextColor(...darkText);
    doc.text(data.staffSignature, margin + 4, curY + 18);
  } else {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...mutedText);
    doc.text('Signature pending', margin + 4, curY + 18);
  }

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...mutedText);
  doc.text(`Name: ${data.staffName}`, margin + 4, curY + 25);
  doc.text(`Role: ${data.role}`, margin + 4, curY + 30);

  // Supervisor signature box
  const supSigX = margin + sigColW + 8;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(supSigX, curY, sigColW, 36, 1.5, 1.5, 'FD');

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...mutedText);
  doc.text('SUPERVISOR / LINE MANAGER', supSigX + 4, curY + 6);

  if (data.supervisorSignature) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bolditalic');
    doc.setTextColor(...darkText);
    doc.text(data.supervisorSignature, supSigX + 4, curY + 18);
  } else {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...mutedText);
    doc.text('Signature pending', supSigX + 4, curY + 18);
  }

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...mutedText);
  doc.text(`Name: ${data.supervisor}`, supSigX + 4, curY + 25);
  doc.text(`Date: ${data.submittedDate || formatDate(new Date())}`, supSigX + 4, curY + 30);

  curY += 42;

  // ── Approval stamp (if approved) ──────────────────────────────────────────
  if (data.status === 'approved') {
    curY = checkPage(curY, 20);
    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(...emerald);
    doc.setLineWidth(0.5);
    doc.roundedRect(margin, curY, contentW, 14, 2, 2, 'FD');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...emerald);
    doc.text('✓  APPROVED — This appraisal has been reviewed and approved by the supervisor.', margin + 4, curY + 9);
    curY += 18;
  }

  // ── Add footer to all pages ────────────────────────────────────────────────
  const totalPages = (doc as jsPDF & { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(...mutedText);
    doc.text(
      `ECSA-HC Performance Management System  ·  Confidential  ·  Page ${i} of ${totalPages}`,
      pageW / 2,
      pageH - 8,
      { align: 'center' }
    );
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, pageH - 11, pageW - margin, pageH - 11);
  }

  const safeName = data.staffName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
  const safeType = data.reviewType.replace(/\s+/g, '_');
  doc.save(filename ?? `ECSA-HC_Appraisal_${safeName}_${safeType}.pdf`);
}
