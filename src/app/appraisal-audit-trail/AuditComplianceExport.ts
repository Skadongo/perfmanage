// Compliance Report Export Utilities — Appraisal Audit Trail


import { formatDate, formatDateTime } from '@/lib/dateUtils';

export interface AuditRecord {
  form_type: string;
  id: string;
  staff_id: string;
  staff_name: string;
  job_title: string;
  period_label: string;
  review_year: number;
  status: string;
  workflow_stage: string | null;
  version: number;
  form_submitted_at: string | null;
  created_at: string;
  updated_at: string;
  overall_self_score: number | null;
  overall_supervisor_score: number | null;
}

function getStaffSignatureStatus(record: AuditRecord): string {
  return record.form_submitted_at ? 'Signed' : 'Pending';
}

function getSupervisorSignatureStatus(record: AuditRecord): string {
  return (record.status ?? '').toLowerCase() === 'approved' ? 'Signed' : 'Pending';
}

function getHRSignatureStatus(record: AuditRecord): string {
  return record.form_type === 'evaluation' ? 'Pending' : 'N/A';
}

function getComplianceStatus(record: AuditRecord): string {
  const status = (record.status ?? '').toLowerCase();
  if (status === 'approved') return 'Compliant';
  if (status === 'submitted') return 'In Review';
  if (status === 'rejected') return 'Non-Compliant';
  return 'Pending';
}

// ─── Excel Export ─────────────────────────────────────────────────────────────

export async function exportAuditToExcel(
  records: AuditRecord[],
  filters: { type: string; status: string; year: string },
  filename = 'appraisal-compliance-report.xlsx'
): Promise<void> {
  const XLSX = await import('xlsx');

  const wb = XLSX.utils.book_new();

  // ── Sheet 1: Submission History ──────────────────────────────────────────
  const submissionRows = records.map((r) => ({
    'Staff Name': r.staff_name ?? '—',
    'Job Title': r.job_title ?? '—',
    'Form Type': (r.form_type ?? '').replace(/\b\w/g, (c) => c.toUpperCase()),
    'Period': r.period_label ?? String(r.review_year ?? '—'),
    'Review Year': r.review_year ?? '—',
    'Status': (r.status ?? '—').replace(/\b\w/g, (c) => c.toUpperCase()),
    'Workflow Stage': r.workflow_stage ?? '—',
    'Created At': formatDateTime(r.created_at),
    'Submitted At': formatDateTime(r.form_submitted_at),
    'Last Updated': formatDateTime(r.updated_at),
  }));
  const ws1 = XLSX.utils.json_to_sheet(submissionRows);
  ws1['!cols'] = [
    { wch: 28 }, { wch: 30 }, { wch: 14 }, { wch: 22 }, { wch: 12 },
    { wch: 14 }, { wch: 20 }, { wch: 22 }, { wch: 22 }, { wch: 22 },
  ];
  XLSX.utils.book_append_sheet(wb, ws1, 'Submission History');

  // ── Sheet 2: Scores & Version Tracking ───────────────────────────────────
  const scoreRows = records.map((r) => ({
    'Staff Name': r.staff_name ?? '—',
    'Job Title': r.job_title ?? '—',
    'Form Type': (r.form_type ?? '').replace(/\b\w/g, (c) => c.toUpperCase()),
    'Period': r.period_label ?? String(r.review_year ?? '—'),
    'Version': `v${r.version ?? 1}`,
    'Self Score': r.overall_self_score != null ? Number(r.overall_self_score).toFixed(2) : '—',
    'Supervisor Score': r.overall_supervisor_score != null ? Number(r.overall_supervisor_score).toFixed(2) : '—',
    'Score Variance': (r.overall_self_score != null && r.overall_supervisor_score != null)
      ? Math.abs(Number(r.overall_self_score) - Number(r.overall_supervisor_score)).toFixed(2)
      : '—',
    'Status': (r.status ?? '—').replace(/\b\w/g, (c) => c.toUpperCase()),
    'Workflow Stage': r.workflow_stage ?? '—',
    'Last Updated': formatDateTime(r.updated_at),
  }));
  const ws2 = XLSX.utils.json_to_sheet(scoreRows);
  ws2['!cols'] = [
    { wch: 28 }, { wch: 30 }, { wch: 14 }, { wch: 22 }, { wch: 10 },
    { wch: 12 }, { wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 20 }, { wch: 22 },
  ];
  XLSX.utils.book_append_sheet(wb, ws2, 'Scores & Versions');

  // ── Sheet 3: Signatures ───────────────────────────────────────────────────
  const signatureRows = records.map((r) => ({
    'Staff Name': r.staff_name ?? '—',
    'Job Title': r.job_title ?? '—',
    'Form Type': (r.form_type ?? '').replace(/\b\w/g, (c) => c.toUpperCase()),
    'Period': r.period_label ?? String(r.review_year ?? '—'),
    'Status': (r.status ?? '—').replace(/\b\w/g, (c) => c.toUpperCase()),
    'Staff Signature': getStaffSignatureStatus(r),
    'Supervisor Signature': getSupervisorSignatureStatus(r),
    'HR Signature': getHRSignatureStatus(r),
    'Submitted At': formatDateTime(r.form_submitted_at),
    'Approved/Updated': formatDateTime(r.updated_at),
  }));
  const ws3 = XLSX.utils.json_to_sheet(signatureRows);
  ws3['!cols'] = [
    { wch: 28 }, { wch: 30 }, { wch: 14 }, { wch: 22 }, { wch: 14 },
    { wch: 18 }, { wch: 22 }, { wch: 14 }, { wch: 22 }, { wch: 22 },
  ];
  XLSX.utils.book_append_sheet(wb, ws3, 'Signatures');

  // ── Sheet 4: Compliance Summary ───────────────────────────────────────────
  const complianceRows = records.map((r) => ({
    'Staff Name': r.staff_name ?? '—',
    'Job Title': r.job_title ?? '—',
    'Form Type': (r.form_type ?? '').replace(/\b\w/g, (c) => c.toUpperCase()),
    'Period': r.period_label ?? String(r.review_year ?? '—'),
    'Review Year': r.review_year ?? '—',
    'Version': `v${r.version ?? 1}`,
    'Status': (r.status ?? '—').replace(/\b\w/g, (c) => c.toUpperCase()),
    'Compliance Status': getComplianceStatus(r),
    'Form Submitted': r.form_submitted_at ? 'Yes' : 'No',
    'Staff Signed': getStaffSignatureStatus(r),
    'Supervisor Signed': getSupervisorSignatureStatus(r),
    'Self Score': r.overall_self_score != null ? Number(r.overall_self_score).toFixed(2) : '—',
    'Supervisor Score': r.overall_supervisor_score != null ? Number(r.overall_supervisor_score).toFixed(2) : '—',
    'Submitted At': formatDateTime(r.form_submitted_at),
    'Last Updated': formatDateTime(r.updated_at),
  }));
  const ws4 = XLSX.utils.json_to_sheet(complianceRows);
  ws4['!cols'] = [
    { wch: 28 }, { wch: 30 }, { wch: 14 }, { wch: 22 }, { wch: 12 },
    { wch: 10 }, { wch: 14 }, { wch: 18 }, { wch: 16 }, { wch: 14 },
    { wch: 18 }, { wch: 12 }, { wch: 18 }, { wch: 22 }, { wch: 22 },
  ];
  XLSX.utils.book_append_sheet(wb, ws4, 'Compliance Summary');

  // ── Sheet 5: Report Metadata ──────────────────────────────────────────────
  const total = records.length;
  const approved = records.filter((r) => (r.status ?? '').toLowerCase() === 'approved').length;
  const submitted = records.filter((r) => (r.status ?? '').toLowerCase() === 'submitted').length;
  const draft = records.filter((r) => (r.status ?? '').toLowerCase() === 'draft').length;
  const rejected = records.filter((r) => (r.status ?? '').toLowerCase() === 'rejected').length;
  const workplans = records.filter((r) => r.form_type === 'workplan').length;
  const evaluations = records.filter((r) => r.form_type === 'evaluation').length;
  const complianceRate = total > 0 ? Math.round(((approved + submitted) / total) * 100) : 0;

  const metaRows = [
    { 'Field': 'Report Title', 'Value': 'ECSA-HC Appraisal Compliance Report' },
    { 'Field': 'Organisation', 'Value': 'ECSA-HC Performance Management System' },
    { 'Field': 'Generated At', 'Value': formatDateTime(new Date().toISOString()) }, // hydration-ok
    { 'Field': 'Filter — Form Type', 'Value': filters.type === 'all' ? 'All Types' : filters.type.replace(/\b\w/g, (c) => c.toUpperCase()) },
    { 'Field': 'Filter — Status', 'Value': filters.status === 'all' ? 'All Statuses' : filters.status.replace(/\b\w/g, (c) => c.toUpperCase()) },
    { 'Field': 'Filter — Year', 'Value': filters.year === 'all' ? 'All Years' : filters.year },
    { 'Field': '', 'Value': '' },
    { 'Field': 'Total Records', 'Value': total },
    { 'Field': 'Workplans', 'Value': workplans },
    { 'Field': 'Evaluations', 'Value': evaluations },
    { 'Field': 'Approved', 'Value': approved },
    { 'Field': 'Submitted', 'Value': submitted },
    { 'Field': 'Draft', 'Value': draft },
    { 'Field': 'Rejected', 'Value': rejected },
    { 'Field': 'Compliance Rate', 'Value': `${complianceRate}%` },
  ];
  const ws5 = XLSX.utils.json_to_sheet(metaRows);
  ws5['!cols'] = [{ wch: 30 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, ws5, 'Report Info');

  XLSX.writeFile(wb, filename);
}

// ─── PDF Export ───────────────────────────────────────────────────────────────

export async function exportAuditToPDF(
  records: AuditRecord[],
  filters: { type: string; status: string; year: string },
  filename = 'appraisal-compliance-report.pdf'
): Promise<void> {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;

  // ── Brand colours ──────────────────────────────────────────────────────────
  const brandBlue: [number, number, number] = [30, 64, 175];
  const brandGold: [number, number, number] = [180, 130, 40];
  const darkText: [number, number, number] = [15, 23, 42];
  const mutedText: [number, number, number] = [100, 116, 139];
  const lightBg: [number, number, number] = [241, 245, 249];
  const white: [number, number, number] = [255, 255, 255];
  const emerald: [number, number, number] = [16, 185, 129];
  const amber: [number, number, number] = [245, 158, 11];
  const red: [number, number, number] = [220, 38, 38];
  const blue: [number, number, number] = [59, 130, 246];

  // ── Summary stats ──────────────────────────────────────────────────────────
  const total = records.length;
  const approved = records.filter((r) => (r.status ?? '').toLowerCase() === 'approved').length;
  const submitted = records.filter((r) => (r.status ?? '').toLowerCase() === 'submitted').length;
  const draft = records.filter((r) => (r.status ?? '').toLowerCase() === 'draft').length;
  const rejected = records.filter((r) => (r.status ?? '').toLowerCase() === 'rejected').length;
  const workplans = records.filter((r) => r.form_type === 'workplan').length;
  const evaluations = records.filter((r) => r.form_type === 'evaluation').length;
  const complianceRate = total > 0 ? Math.round(((approved + submitted) / total) * 100) : 0;

  // ── Helper: draw page header ───────────────────────────────────────────────
  function drawPageHeader(pageNum: number) {
    // Top bar
    doc.setFillColor(...brandBlue);
    doc.rect(0, 0, pageW, 18, 'F');

    // Gold accent line
    doc.setFillColor(...brandGold);
    doc.rect(0, 18, pageW, 1.5, 'F');

    // Title
    doc.setFontSize(13);
    doc.setTextColor(...white);
    doc.setFont('helvetica', 'bold');
    doc.text('ECSA-HC Appraisal Compliance Report', margin, 12);

    // Right: org + date
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Generated: ${formatDate(new Date().toISOString())}`, // hydration-ok
      pageW - margin,
      8,
      { align: 'right' }
    );
    doc.text('Performance Management System', pageW - margin, 13, { align: 'right' });

    if (pageNum > 1) {
      doc.setFontSize(7);
      doc.setTextColor(...mutedText);
      doc.text(`(continued)`, margin, 24);
    }
  }

  // ── Helper: section heading ────────────────────────────────────────────────
  function sectionHeading(label: string, y: number): number {
    doc.setFillColor(...lightBg);
    doc.roundedRect(margin, y, pageW - margin * 2, 7, 1, 1, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...brandBlue);
    doc.text(label.toUpperCase(), margin + 3, y + 4.8);
    return y + 10;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PAGE 1: Cover + Summary
  // ─────────────────────────────────────────────────────────────────────────
  drawPageHeader(1);

  let y = 26;

  // Applied filters row
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...mutedText);
  const filterStr = [
    `Type: ${filters.type === 'all' ? 'All' : filters.type.replace(/\b\w/g, (c) => c.toUpperCase())}`,
    `Status: ${filters.status === 'all' ? 'All' : filters.status.replace(/\b\w/g, (c) => c.toUpperCase())}`,
    `Year: ${filters.year === 'all' ? 'All' : filters.year}`,
    `Records: ${total}`,
  ].join('   ·   ');
  doc.text(filterStr, margin, y);
  y += 8;

  // Summary stat boxes
  const boxW = (pageW - margin * 2 - 12) / 7;
  const boxH = 18;
  const statItems = [
    { label: 'Total', value: String(total), color: brandBlue },
    { label: 'Workplans', value: String(workplans), color: [13, 148, 136] as [number, number, number] },
    { label: 'Evaluations', value: String(evaluations), color: [124, 58, 237] as [number, number, number] },
    { label: 'Approved', value: String(approved), color: emerald },
    { label: 'Submitted', value: String(submitted), color: blue },
    { label: 'Draft', value: String(draft), color: amber },
    { label: 'Compliance', value: `${complianceRate}%`, color: approved + submitted > 0 ? emerald : amber },
  ];

  statItems.forEach((stat, i) => {
    const x = margin + i * (boxW + 2);
    doc.setFillColor(...lightBg);
    doc.roundedRect(x, y, boxW, boxH, 1.5, 1.5, 'F');
    doc.setDrawColor(...stat.color);
    doc.setLineWidth(0.5);
    doc.roundedRect(x, y, boxW, boxH, 1.5, 1.5, 'S');

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...stat.color);
    doc.text(stat.value, x + boxW / 2, y + 10, { align: 'center' });

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...mutedText);
    doc.text(stat.label, x + boxW / 2, y + 15.5, { align: 'center' });
  });

  y += boxH + 8;

  // ── Section 1: Submission History ─────────────────────────────────────────
  y = sectionHeading('1. Submission History', y);

  autoTable(doc, {
    startY: y,
    head: [['Staff Member', 'Job Title', 'Form Type', 'Period', 'Status', 'Created', 'Submitted', 'Last Updated']],
    body: records.map((r) => [
      r.staff_name ?? '—',
      r.job_title ?? '—',
      (r.form_type ?? '').replace(/\b\w/g, (c) => c.toUpperCase()),
      r.period_label ?? String(r.review_year ?? '—'),
      (r.status ?? '—').replace(/\b\w/g, (c) => c.toUpperCase()),
      formatDate(r.created_at),
      formatDate(r.form_submitted_at),
      formatDate(r.updated_at),
    ]),
    styles: { fontSize: 7, cellPadding: 2, textColor: darkText },
    headStyles: { fillColor: brandBlue, textColor: white, fontStyle: 'bold', fontSize: 7 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 36 },
      1: { cellWidth: 38 },
      2: { cellWidth: 20 },
      3: { cellWidth: 28 },
      4: { cellWidth: 20 },
      5: { cellWidth: 22 },
      6: { cellWidth: 22 },
      7: { cellWidth: 22 },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 4) {
        const val = String(data.cell.raw).toLowerCase();
        if (val === 'approved') data.cell.styles.textColor = emerald;
        else if (val === 'submitted') data.cell.styles.textColor = blue;
        else if (val === 'rejected') data.cell.styles.textColor = red;
        else if (val === 'draft') data.cell.styles.textColor = amber;
      }
    },
    didDrawPage: (data) => {
      drawPageHeader(data.pageNumber);
    },
  });

  // ─────────────────────────────────────────────────────────────────────────
  // PAGE: Scores & Version Tracking
  // ─────────────────────────────────────────────────────────────────────────
  doc.addPage();
  drawPageHeader(doc.internal.getNumberOfPages());
  y = 26;
  y = sectionHeading('2. Scores & Version Tracking', y);

  autoTable(doc, {
    startY: y,
    head: [['Staff Member', 'Job Title', 'Form Type', 'Period', 'Version', 'Self Score', 'Supervisor Score', 'Variance', 'Status', 'Workflow Stage', 'Last Updated']],
    body: records.map((r) => [
      r.staff_name ?? '—',
      r.job_title ?? '—',
      (r.form_type ?? '').replace(/\b\w/g, (c) => c.toUpperCase()),
      r.period_label ?? String(r.review_year ?? '—'),
      `v${r.version ?? 1}`,
      r.overall_self_score != null ? Number(r.overall_self_score).toFixed(2) : '—',
      r.overall_supervisor_score != null ? Number(r.overall_supervisor_score).toFixed(2) : '—',
      (r.overall_self_score != null && r.overall_supervisor_score != null)
        ? Math.abs(Number(r.overall_self_score) - Number(r.overall_supervisor_score)).toFixed(2)
        : '—',
      (r.status ?? '—').replace(/\b\w/g, (c) => c.toUpperCase()),
      r.workflow_stage ?? '—',
      formatDate(r.updated_at),
    ]),
    styles: { fontSize: 7, cellPadding: 2, textColor: darkText },
    headStyles: { fillColor: brandBlue, textColor: white, fontStyle: 'bold', fontSize: 7 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 32 },
      1: { cellWidth: 34 },
      2: { cellWidth: 18 },
      3: { cellWidth: 24 },
      4: { cellWidth: 12, halign: 'center' },
      5: { cellWidth: 16, halign: 'center' },
      6: { cellWidth: 20, halign: 'center' },
      7: { cellWidth: 14, halign: 'center' },
      8: { cellWidth: 18 },
      9: { cellWidth: 22 },
      10: { cellWidth: 20 },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 8) {
        const val = String(data.cell.raw).toLowerCase();
        if (val === 'approved') data.cell.styles.textColor = emerald;
        else if (val === 'submitted') data.cell.styles.textColor = blue;
        else if (val === 'rejected') data.cell.styles.textColor = red;
        else if (val === 'draft') data.cell.styles.textColor = amber;
      }
    },
    didDrawPage: (data) => {
      drawPageHeader(data.pageNumber);
    },
  });

  // ─────────────────────────────────────────────────────────────────────────
  // PAGE: Signatures & Compliance
  // ─────────────────────────────────────────────────────────────────────────
  doc.addPage();
  drawPageHeader(doc.internal.getNumberOfPages());
  y = 26;
  y = sectionHeading('3. Signatures & Compliance Records', y);

  autoTable(doc, {
    startY: y,
    head: [['Staff Member', 'Job Title', 'Form Type', 'Period', 'Status', 'Staff Signature', 'Supervisor Signature', 'HR Signature', 'Compliance Status', 'Submitted At']],
    body: records.map((r) => [
      r.staff_name ?? '—',
      r.job_title ?? '—',
      (r.form_type ?? '').replace(/\b\w/g, (c) => c.toUpperCase()),
      r.period_label ?? String(r.review_year ?? '—'),
      (r.status ?? '—').replace(/\b\w/g, (c) => c.toUpperCase()),
      getStaffSignatureStatus(r),
      getSupervisorSignatureStatus(r),
      getHRSignatureStatus(r),
      getComplianceStatus(r),
      formatDate(r.form_submitted_at),
    ]),
    styles: { fontSize: 7, cellPadding: 2, textColor: darkText },
    headStyles: { fillColor: brandBlue, textColor: white, fontStyle: 'bold', fontSize: 7 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 34 },
      1: { cellWidth: 36 },
      2: { cellWidth: 18 },
      3: { cellWidth: 24 },
      4: { cellWidth: 18 },
      5: { cellWidth: 22, halign: 'center' },
      6: { cellWidth: 26, halign: 'center' },
      7: { cellWidth: 18, halign: 'center' },
      8: { cellWidth: 22 },
      9: { cellWidth: 22 },
    },
    didParseCell: (data) => {
      if (data.section === 'body') {
        const val = String(data.cell.raw);
        if (val === 'Signed') data.cell.styles.textColor = emerald;
        else if (val === 'Pending') data.cell.styles.textColor = amber;
        else if (val === 'Compliant') data.cell.styles.textColor = emerald;
        else if (val === 'Non-Compliant') data.cell.styles.textColor = red;
        else if (val === 'In Review') data.cell.styles.textColor = blue;
      }
    },
    didDrawPage: (data) => {
      drawPageHeader(data.pageNumber);
    },
  });

  // ── Footer on all pages ────────────────────────────────────────────────────
  const pageCount = (doc as jsPDF & { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFillColor(...lightBg);
    doc.rect(0, pageH - 8, pageW, 8, 'F');
    doc.setFontSize(6.5);
    doc.setTextColor(...mutedText);
    doc.text(
      `ECSA-HC Performance Management System  ·  Appraisal Compliance Report  ·  CONFIDENTIAL`,
      pageW / 2,
      pageH - 3.5,
      { align: 'center' }
    );
    doc.text(`Page ${i} of ${pageCount}`, pageW - margin, pageH - 3.5, { align: 'right' });
    doc.text(formatDate(new Date().toISOString()), margin, pageH - 3.5); // hydration-ok
  }

  doc.save(filename);
}
