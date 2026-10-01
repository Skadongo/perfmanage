'use client';

import { jsPDF } from 'jspdf';
import { MANUAL_SECTIONS } from './helpData';

const BRAND_DARK = [26, 58, 92] as [number, number, number];
const BRAND_MID = [42, 82, 152] as [number, number, number];
const WHITE = [255, 255, 255] as [number, number, number];
const LIGHT_GRAY = [245, 247, 250] as [number, number, number];
const TEXT_DARK = [26, 26, 26] as [number, number, number];
const TEXT_MID = [80, 80, 80] as [number, number, number];
const TEXT_LIGHT = [130, 130, 130] as [number, number, number];
const GREEN = [22, 101, 52] as [number, number, number];
const GREEN_BG = [240, 253, 244] as [number, number, number];

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 20;
const CONTENT_W = PAGE_W - MARGIN * 2;

function addPageHeader(doc: jsPDF, sectionTitle: string, pageNum: number) {
  // Top bar
  doc.setFillColor(...BRAND_DARK);
  doc.rect(0, 0, PAGE_W, 12, 'F');

  doc.setTextColor(...WHITE);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('ECSA-HC Performance Management System — User Manual', MARGIN, 8);
  doc.setFont('helvetica', 'normal');
  doc.text(sectionTitle, PAGE_W - MARGIN, 8, { align: 'right' });

  // Bottom footer
  doc.setFillColor(...LIGHT_GRAY);
  doc.rect(0, PAGE_H - 10, PAGE_W, 10, 'F');
  doc.setDrawColor(...BRAND_DARK);
  doc.setLineWidth(0.3);
  doc.line(0, PAGE_H - 10, PAGE_W, PAGE_H - 10);

  doc.setTextColor(...TEXT_LIGHT);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('East, Central & Southern Africa Health Community — Internal Use Only', MARGIN, PAGE_H - 4);
  doc.text(`Page ${pageNum}`, PAGE_W - MARGIN, PAGE_H - 4, { align: 'right' });
}

function addCoverPage(doc: jsPDF) {
  // Background gradient simulation
  doc.setFillColor(...BRAND_DARK);
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F');

  // Decorative circles
  doc.setFillColor(255, 255, 255);
  doc.setGState(doc.GState({ opacity: 0.04 }));
  doc.circle(PAGE_W + 40, -40, 80, 'F');
  doc.circle(-30, PAGE_H + 30, 60, 'F');
  doc.setGState(doc.GState({ opacity: 1 }));

  // Top bar
  doc.setFillColor(255, 255, 255);
  doc.setGState(doc.GState({ opacity: 0.08 }));
  doc.rect(0, 0, PAGE_W, 28, 'F');
  doc.setGState(doc.GState({ opacity: 1 }));

  // Logo box
  doc.setFillColor(...WHITE);
  doc.roundedRect(MARGIN, 6, 18, 18, 2, 2, 'F');

  // Org name
  doc.setTextColor(...WHITE);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('ECSA-HC', MARGIN + 22, 14);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(255, 255, 255);
  doc.setGState(doc.GState({ opacity: 0.7 }));
  doc.text('East, Central & Southern Africa Health Community', MARGIN + 22, 20);
  doc.setGState(doc.GState({ opacity: 1 }));

  // Version badge (top right)
  doc.setFillColor(255, 255, 255);
  doc.setGState(doc.GState({ opacity: 0.12 }));
  doc.roundedRect(PAGE_W - MARGIN - 28, 6, 28, 18, 2, 2, 'F');
  doc.setGState(doc.GState({ opacity: 1 }));
  doc.setTextColor(255, 255, 255);
  doc.setGState(doc.GState({ opacity: 0.6 }));
  doc.setFontSize(6.5);
  doc.text('Document Version', PAGE_W - MARGIN - 14, 12, { align: 'center' });
  doc.setGState(doc.GState({ opacity: 1 }));
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('v1.0 · 2026', PAGE_W - MARGIN - 14, 19, { align: 'center' });

  // Divider
  doc.setDrawColor(255, 255, 255);
  doc.setGState(doc.GState({ opacity: 0.15 }));
  doc.setLineWidth(0.3);
  doc.line(0, 28, PAGE_W, 28);
  doc.setGState(doc.GState({ opacity: 1 }));

  // Main content area
  const bodyY = 70;
  doc.setTextColor(255, 255, 255);
  doc.setGState(doc.GState({ opacity: 0.55 }));
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('OFFICIAL DOCUMENTATION', MARGIN, bodyY);
  doc.setGState(doc.GState({ opacity: 1 }));

  doc.setFontSize(26);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...WHITE);
  doc.text('Performance Management', MARGIN, bodyY + 14);
  doc.text('System', MARGIN, bodyY + 26);

  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.setGState(doc.GState({ opacity: 0.75 }));
  doc.text('User Manual', MARGIN, bodyY + 38);
  doc.setGState(doc.GState({ opacity: 1 }));

  // Divider line
  doc.setDrawColor(255, 255, 255);
  doc.setGState(doc.GState({ opacity: 0.2 }));
  doc.setLineWidth(1);
  doc.line(MARGIN, bodyY + 46, MARGIN + 50, bodyY + 46);
  doc.setGState(doc.GState({ opacity: 1 }));

  // Description
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setGState(doc.GState({ opacity: 0.75 }));
  const descLines = doc.splitTextToSize(
    'A comprehensive guide to all modules, features, and workflows of the ECSA-HC Performance Management System — covering login, evaluations, analytics, staff management, and administration.',
    120
  );
  doc.text(descLines, MARGIN, bodyY + 56);
  doc.setGState(doc.GState({ opacity: 1 }));

  // Meta cards
  const metaY = bodyY + 90;
  const metaItems = [
    { label: 'Document Version', value: '1.0' },
    { label: 'Release Date', value: 'September 2026' },
    { label: 'Prepared By', value: 'ECSA-HC ICT Unit' },
    { label: 'Classification', value: 'Internal Use Only' },
  ];
  const cardW = (CONTENT_W - 9) / 4;
  metaItems.forEach((item, i) => {
    const x = MARGIN + i * (cardW + 3);
    doc.setFillColor(255, 255, 255);
    doc.setGState(doc.GState({ opacity: 0.1 }));
    doc.roundedRect(x, metaY, cardW, 20, 2, 2, 'F');
    doc.setGState(doc.GState({ opacity: 1 }));

    doc.setTextColor(255, 255, 255);
    doc.setGState(doc.GState({ opacity: 0.55 }));
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.text(item.label, x + cardW / 2, metaY + 6, { align: 'center' });
    doc.setGState(doc.GState({ opacity: 1 }));
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.text(item.value, x + cardW / 2, metaY + 14, { align: 'center' });
  });

  // Footer
  doc.setDrawColor(255, 255, 255);
  doc.setGState(doc.GState({ opacity: 0.12 }));
  doc.setLineWidth(0.3);
  doc.line(0, PAGE_H - 16, PAGE_W, PAGE_H - 16);
  doc.setGState(doc.GState({ opacity: 1 }));

  doc.setTextColor(255, 255, 255);
  doc.setGState(doc.GState({ opacity: 0.5 }));
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('© 2026 East, Central & Southern Africa Health Community. All rights reserved.', MARGIN, PAGE_H - 9);
  doc.text('Confidential — For Internal Use Only', PAGE_W - MARGIN, PAGE_H - 9, { align: 'right' });
  doc.setGState(doc.GState({ opacity: 1 }));
}

function addTOCPage(doc: jsPDF, pageNum: number) {
  addPageHeader(doc, 'Table of Contents', pageNum);

  let y = 22;

  // TOC header
  doc.setDrawColor(...BRAND_DARK);
  doc.setLineWidth(0.8);
  doc.line(MARGIN, y + 8, PAGE_W - MARGIN, y + 8);

  doc.setTextColor(...BRAND_DARK);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Table of Contents', MARGIN, y + 6);

  y += 18;

  // TOC entries
  const tocEntries = [
    { num: '1', title: 'Introduction & System Overview', page: 3 },
    { num: '2', title: 'Getting Started & Navigation', page: 4 },
    { num: '3', title: 'Performance Dashboard', page: 5 },
    { num: '4', title: 'Evaluation & Reviews', page: 6 },
    { num: '5', title: 'Self-Assessment', page: 7 },
    { num: '6', title: 'Manager Review', page: 8 },
    { num: '7', title: 'Mid-Year Reviews', page: 9 },
    { num: '8', title: 'Feedback & Mentorship', page: 10 },
    { num: '9', title: 'Training & Resources', page: 11 },
    { num: '10', title: 'Staff Management', page: 12 },
    { num: '11', title: 'Analytics & Reports', page: 13 },
    { num: '12', title: 'Permissions & Roles', page: 14 },
    { num: '13', title: 'Admin Dashboard', page: 15 },
    { num: '14', title: 'Troubleshooting & Support', page: 16 },
    { num: 'A', title: 'Appendix A — Glossary of Terms', page: 17 },
    { num: 'B', title: 'Appendix B — Support Contacts', page: 17 },
  ];

  tocEntries.forEach((entry, idx) => {
    if (idx % 2 === 0) {
      doc.setFillColor(...LIGHT_GRAY);
      doc.rect(MARGIN, y - 3, CONTENT_W, 8, 'F');
    }

    doc.setTextColor(...BRAND_DARK);
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.text(`${entry.num}.`, MARGIN + 2, y + 3);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...TEXT_DARK);
    doc.text(entry.title, MARGIN + 12, y + 3);

    // Dots
    doc.setTextColor(...TEXT_LIGHT);
    doc.setFontSize(8);
    const dotsX = MARGIN + 12 + doc.getTextWidth(entry.title) + 3;
    const pageNumX = PAGE_W - MARGIN - 8;
    if (dotsX < pageNumX - 10) {
      let dotX = dotsX;
      while (dotX < pageNumX - 6) {
        doc.text('.', dotX, y + 3);
        dotX += 2.5;
      }
    }

    doc.setTextColor(...TEXT_MID);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.text(String(entry.page), PAGE_W - MARGIN, y + 3, { align: 'right' });

    y += 8;
  });
}

function wrapAndWrite(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  fontSize: number,
  fontStyle: 'normal' | 'bold',
  color: [number, number, number]
): number {
  doc.setFontSize(fontSize);
  doc.setFont('helvetica', fontStyle);
  doc.setTextColor(...color);
  const lines = doc.splitTextToSize(text, maxWidth);
  doc.text(lines, x, y);
  return y + lines.length * (fontSize * 0.4 + 1.2);
}

function addSectionContent(
  doc: jsPDF,
  sectionIndex: number,
  section: (typeof MANUAL_SECTIONS)[0],
  startPage: number
): number {
  let pageNum = startPage;
  doc.addPage();
  addPageHeader(doc, section.title, pageNum);

  let y = 22;

  // Section title bar
  doc.setFillColor(...BRAND_DARK);
  doc.rect(MARGIN, y, CONTENT_W, 14, 'F');
  doc.setFillColor(...BRAND_MID);
  doc.rect(MARGIN, y, 4, 14, 'F');

  doc.setTextColor(...WHITE);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(`${sectionIndex + 1}. ${section.title}`, MARGIN + 8, y + 9.5);

  y += 20;

  // Description
  doc.setFillColor(...LIGHT_GRAY);
  doc.roundedRect(MARGIN, y, CONTENT_W, 10, 2, 2, 'F');
  doc.setTextColor(...TEXT_MID);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'italic');
  const descLines = doc.splitTextToSize(section.description, CONTENT_W - 8);
  doc.text(descLines, MARGIN + 4, y + 6.5);
  y += 14;

  // Topics
  section.topics.forEach((topic, topicIdx) => {
    // Check if we need a new page (leave 40pt buffer)
    if (y > PAGE_H - 50) {
      doc.addPage();
      pageNum++;
      addPageHeader(doc, section.title, pageNum);
      y = 22;
    }

    // Topic header
    doc.setFillColor(240, 244, 250);
    doc.roundedRect(MARGIN, y, CONTENT_W, 9, 1.5, 1.5, 'F');
    doc.setDrawColor(...BRAND_DARK);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, y, MARGIN, y + 9);

    doc.setTextColor(...BRAND_DARK);
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.text(`${sectionIndex + 1}.${topicIdx + 1}  ${topic.title}`, MARGIN + 5, y + 6.2);
    y += 13;

    // Content items
    topic.content.forEach((line) => {
      if (y > PAGE_H - 30) {
        doc.addPage();
        pageNum++;
        addPageHeader(doc, section.title, pageNum);
        y = 22;
      }

      // Bullet
      doc.setFillColor(...BRAND_MID);
      doc.circle(MARGIN + 2.5, y + 1.5, 1, 'F');

      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...TEXT_DARK);
      const contentLines = doc.splitTextToSize(line, CONTENT_W - 8);
      doc.text(contentLines, MARGIN + 6, y + 3);
      y += contentLines.length * 4.5 + 2;
    });

    // Tips
    if (topic.tips && topic.tips.length > 0) {
      if (y > PAGE_H - 30) {
        doc.addPage();
        pageNum++;
        addPageHeader(doc, section.title, pageNum);
        y = 22;
      }

      const tipHeight = topic.tips.reduce((acc, tip) => {
        const lines = doc.splitTextToSize(tip, CONTENT_W - 16);
        return acc + lines.length * 4.5 + 2;
      }, 12);

      doc.setFillColor(...GREEN_BG);
      doc.setDrawColor(...GREEN);
      doc.setLineWidth(0.3);
      doc.roundedRect(MARGIN, y, CONTENT_W, tipHeight, 2, 2, 'FD');
      doc.setFillColor(...GREEN);
      doc.roundedRect(MARGIN, y, 3, tipHeight, 1, 1, 'F');

      doc.setTextColor(...GREEN);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.text('💡 TIP', MARGIN + 6, y + 5.5);
      let tipY = y + 10;

      topic.tips.forEach((tip) => {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...GREEN);
        const tipLines = doc.splitTextToSize(tip, CONTENT_W - 16);
        doc.text(tipLines, MARGIN + 6, tipY);
        tipY += tipLines.length * 4.5 + 2;
      });

      y += tipHeight + 4;
    }

    y += 4;
  });

  return pageNum;
}

function addAppendixPage(doc: jsPDF, pageNum: number) {
  doc.addPage();
  addPageHeader(doc, 'Appendices', pageNum);

  let y = 22;

  // Glossary
  doc.setFillColor(...BRAND_DARK);
  doc.rect(MARGIN, y, CONTENT_W, 12, 'F');
  doc.setTextColor(...WHITE);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Appendix A — Glossary of Terms', MARGIN + 6, y + 8.5);
  y += 16;

  const glossaryTerms = [
    { term: 'PMS', def: 'Performance Management System — the ECSA-HC digital platform for staff appraisals.' },
    { term: 'BSC', def: 'Balanced Scorecard — a strategic planning framework with four perspectives: Financial, Customer, Internal Processes, and Learning & Growth.' },
    { term: 'KPI', def: 'Key Performance Indicator — a measurable value that demonstrates how effectively objectives are being achieved.' },
    { term: 'Workplan', def: 'A structured document outlining a staff member\'s objectives, KPIs, and targets for a review period.' },
    { term: 'Self-Assessment', def: 'The process by which a staff member rates their own performance against their workplan KPIs and competencies.' },
    { term: 'Mid-Year Review', def: 'An interim performance review conducted halfway through the fiscal year.' },
    { term: 'Annual Review', def: 'The end-of-year comprehensive performance evaluation.' },
    { term: 'Workflow Stage', def: 'The current phase of the appraisal cycle (e.g., Workplan Pending, Mid-Year Approved, End-Year Approved).' },
    { term: 'ECSA-HC', def: 'East, Central & Southern Africa Health Community — the regional intergovernmental organisation.' },
    { term: 'HR', def: 'Human Resources — the department responsible for staff management and appraisal administration.' },
  ];

  glossaryTerms.forEach((item, idx) => {
    if (idx % 2 === 0) {
      doc.setFillColor(...LIGHT_GRAY);
      doc.rect(MARGIN, y - 2, CONTENT_W, 7, 'F');
    }
    doc.setTextColor(...BRAND_DARK);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.text(item.term, MARGIN + 2, y + 3);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...TEXT_DARK);
    const defLines = doc.splitTextToSize(item.def, CONTENT_W - 28);
    doc.text(defLines, MARGIN + 26, y + 3);
    y += defLines.length * 4 + 3;
  });

  y += 8;

  // Support Contacts
  if (y > PAGE_H - 60) {
    doc.addPage();
    pageNum++;
    addPageHeader(doc, 'Appendices', pageNum);
    y = 22;
  }

  doc.setFillColor(...BRAND_DARK);
  doc.rect(MARGIN, y, CONTENT_W, 12, 'F');
  doc.setTextColor(...WHITE);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Appendix B — Support Contacts', MARGIN + 6, y + 8.5);
  y += 16;

  const contacts = [
    { role: 'IT Helpdesk', contact: 'ict@ecsahc.org', note: 'Technical issues, login problems, system errors' },
    { role: 'HR Department', contact: 'hr@ecsahc.org', note: 'Appraisal queries, workplan corrections, role changes' },
    { role: 'System Administrator', contact: 'sysadmin@ecsahc.org', note: 'Permissions, user management, data integrity' },
    { role: 'PMS Support', contact: 'pms.support@ecsahc.org', note: 'General PMS usage questions and training' },
  ];

  contacts.forEach((c, idx) => {
    if (idx % 2 === 0) {
      doc.setFillColor(...LIGHT_GRAY);
      doc.rect(MARGIN, y - 2, CONTENT_W, 9, 'F');
    }
    doc.setTextColor(...BRAND_DARK);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.text(c.role, MARGIN + 2, y + 4);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...BRAND_MID);
    doc.text(c.contact, MARGIN + 44, y + 4);
    doc.setTextColor(...TEXT_MID);
    doc.text(c.note, MARGIN + 90, y + 4);
    y += 9;
  });
}

export async function generateAndDownloadManualPDF(): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Page 1: Cover
  addCoverPage(doc);

  // Page 2: TOC
  doc.addPage();
  addTOCPage(doc, 2);

  // Pages 3+: Sections
  let currentPage = 3;
  MANUAL_SECTIONS.forEach((section, idx) => {
    currentPage = addSectionContent(doc, idx, section, currentPage) + 1;
  });

  // Appendix
  addAppendixPage(doc, currentPage);

  // Save
  doc.save('ECSA-HC_PMS_User_Manual_v1.0.pdf');
}
