'use client';

import React, { useState, useRef } from 'react';
import AppLayout from '@/components/AppLayout';
import Image from 'next/image';

// ── Types ──────────────────────────────────────────────────────────────────
interface TocItem {
  id: string;
  label: string;
  level: 1 | 2;
}

// ── Table of Contents ──────────────────────────────────────────────────────
const TOC: TocItem[] = [
  { id: 'executive-summary', label: 'Executive Summary', level: 1 },
  { id: 'system-overview', label: 'System Overview', level: 1 },
  { id: 'scope-objectives', label: 'Scope & Objectives', level: 2 },
  { id: 'stakeholders', label: 'Stakeholders & Roles', level: 2 },
  { id: 'process-documentation', label: 'Process Documentation', level: 1 },
  { id: 'proc-workplan', label: 'Work Plan Setting', level: 2 },
  { id: 'proc-self-assessment', label: 'Self-Assessment', level: 2 },
  { id: 'proc-midyear', label: 'Mid-Year Review', level: 2 },
  { id: 'proc-supervisor', label: 'Supervisor Appraisal', level: 2 },
  { id: 'proc-approval', label: 'Approval & Finalisation', level: 2 },
  { id: 'proc-analytics', label: 'Analytics & Reporting', level: 2 },
  { id: 'governance', label: 'Governance & Compliance', level: 1 },
  { id: 'technical-documentation', label: 'Technical Documentation', level: 1 },
  { id: 'tech-architecture', label: 'System Architecture', level: 2 },
  { id: 'tech-database', label: 'Database Schema', level: 2 },
  { id: 'tech-security', label: 'Security & Access Control', level: 2 },
  { id: 'tech-integrations', label: 'Integrations & APIs', level: 2 },
  { id: 'tech-deployment', label: 'Deployment & Infrastructure', level: 2 },
  { id: 'tech-data-flows', label: 'Data Flows & State Management', level: 2 },
  { id: 'appendix', label: 'Appendix', level: 1 },
];

// ── Section Heading ────────────────────────────────────────────────────────
function SectionHeading({ id, level, children }: { id: string; level: 1 | 2; children: React.ReactNode }) {
  if (level === 1) {
    return (
      <h2
        id={id}
        className="text-xl font-700 text-foreground mt-10 mb-4 pb-2 border-b-2 border-primary/20 flex items-center gap-3 scroll-mt-20 print:mt-8 print:scroll-mt-0"
      >
        <span className="w-1 h-6 bg-accent rounded-full flex-shrink-0 print:hidden" />
        {children}
      </h2>
    );
  }
  return (
    <h3
      id={id}
      className="text-base font-700 text-foreground mt-7 mb-3 scroll-mt-20 print:mt-6 print:scroll-mt-0"
    >
      {children}
    </h3>
  );
}

// ── Info Box ───────────────────────────────────────────────────────────────
function InfoBox({ variant, children }: { variant: 'note' | 'warning' | 'tip'; children: React.ReactNode }) {
  const styles = {
    note: 'bg-sky-50 border-sky-300 text-sky-900',
    warning: 'bg-amber-50 border-amber-300 text-amber-900',
    tip: 'bg-emerald-50 border-emerald-300 text-emerald-900',
  };
  const labels = { note: 'Note', warning: 'Important', tip: 'Best Practice' };
  return (
    <div className={`border-l-4 rounded-r-lg px-4 py-3 my-4 text-sm ${styles[variant]}`}>
      <span className="font-700 mr-2">{labels[variant]}:</span>
      {children}
    </div>
  );
}

// ── Process Step ───────────────────────────────────────────────────────────
function ProcessStep({ step, title, actor, description, outputs }: {
  step: number; title: string; actor: string; description: string; outputs: string[];
}) {
  return (
    <div className="flex gap-4 mb-5 print:mb-4">
      <div className="flex-shrink-0 flex flex-col items-center">
        <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-700 flex-shrink-0">
          {step}
        </div>
        <div className="w-px flex-1 bg-border mt-2 min-h-[20px]" />
      </div>
      <div className="flex-1 pb-4">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className="font-700 text-foreground text-sm">{title}</span>
          <span className="text-[11px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-600">{actor}</span>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed mb-2">{description}</p>
        {outputs.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {outputs.map((o) => (
              <span key={o} className="text-[11px] bg-accent/10 text-accent-foreground border border-accent/30 px-2 py-0.5 rounded font-500">
                {o}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Data Table ─────────────────────────────────────────────────────────────
function DocTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto my-4 rounded-lg border border-border">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-primary/5 border-b border-border">
            {headers.map((h) => (
              <th key={h} className="text-left px-4 py-2.5 font-700 text-foreground text-xs uppercase tracking-wide whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={`border-b border-border last:border-0 ${i % 2 === 0 ? '' : 'bg-muted/30'}`}>
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-2.5 text-muted-foreground align-top leading-relaxed">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Code Block ─────────────────────────────────────────────────────────────
function CodeBlock({ children, label }: { children: string; label?: string }) {
  return (
    <div className="my-4 rounded-lg border border-border overflow-hidden">
      {label && (
        <div className="bg-muted/60 border-b border-border px-4 py-1.5 text-[11px] font-600 text-muted-foreground uppercase tracking-wide">
          {label}
        </div>
      )}
      <pre className="bg-[#0f1923] text-[#c9d1d9] text-xs font-mono p-4 overflow-x-auto leading-relaxed whitespace-pre-wrap">
        {children}
      </pre>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function SystemDocumentationPage() {
  const [activeToc, setActiveToc] = useState<string>('executive-summary');
  const [isExporting, setIsExporting] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const handleExportPDF = async () => {
    if (!contentRef.current) return;
    setIsExporting(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      const element = contentRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 1200,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const contentWidth = pageWidth - margin * 2;
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = contentWidth / imgWidth;
      const scaledHeight = imgHeight * ratio;

      // Add cover page
      pdf.setFillColor(255, 255, 255);
      pdf.rect(0, 0, pageWidth, pageHeight, 'F');
      pdf.setFontSize(10);
      pdf.setTextColor(100, 100, 100);
      pdf.text('East, Central & Southern Africa Health Community', pageWidth / 2, 60, { align: 'center' });
      pdf.setFontSize(22);
      pdf.setTextColor(30, 30, 30);
      pdf.text('Performance Management System', pageWidth / 2, 80, { align: 'center' });
      pdf.setFontSize(14);
      pdf.setTextColor(80, 80, 80);
      pdf.text('System Documentation', pageWidth / 2, 92, { align: 'center' });
      pdf.setDrawColor(59, 130, 246);
      pdf.setLineWidth(1);
      pdf.line(pageWidth / 2 - 20, 100, pageWidth / 2 + 20, 100);
      pdf.setFontSize(9);
      pdf.setTextColor(120, 120, 120);
      pdf.text('Consultancy Reference Document', pageWidth / 2, 110, { align: 'center' });
      pdf.text(`Version 2.0 · ${new Date().getFullYear()}`, pageWidth / 2, 118, { align: 'center' });
      pdf.setFontSize(8);
      pdf.text('ECSA-HC Secretariat · P.O. Box 1009, Arusha, Tanzania', pageWidth / 2, pageHeight - 20, { align: 'center' });
      pdf.text('+255-27-2973677/8 · regsec@ecsahc.org · www.ecsahc.org', pageWidth / 2, pageHeight - 14, { align: 'center' });

      // Add content pages
      let yOffset = 0;
      const usableHeight = pageHeight - margin * 2;

      while (yOffset < scaledHeight) {
        pdf.addPage();
        const sourceY = yOffset / ratio;
        const sourceHeight = Math.min(usableHeight / ratio, imgHeight - sourceY);
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = imgWidth;
        sliceCanvas.height = sourceHeight;
        const ctx = sliceCanvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(canvas, 0, sourceY, imgWidth, sourceHeight, 0, 0, imgWidth, sourceHeight);
          const sliceData = sliceCanvas.toDataURL('image/png');
          const sliceScaledHeight = sourceHeight * ratio;
          pdf.addImage(sliceData, 'PNG', margin, margin, contentWidth, sliceScaledHeight);
        }
        yOffset += usableHeight;
      }

      pdf.save('ECSA-HC-PMS-System-Documentation.pdf');
    } catch (err) {
      console.error('PDF export failed:', err);
      // Fallback to print dialog
      window.print();
    } finally {
      setIsExporting(false);
    }
  };

  const scrollTo = (id: string) => {
    setActiveToc(id);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <AppLayout
      pageTitle="System Documentation"
      pageSubtitle="ECSA-HC Performance Management System — Consultancy Reference"
      actions={
        <button
          onClick={handleExportPDF}
          disabled={isExporting}
          className="btn-brand gap-1.5 print:hidden disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isExporting ? (
            <>
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Generating PDF…
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download PDF
            </>
          )}
        </button>
      }
    >
      {/* ── Print Cover Page ─────────────────────────────────────────── */}
      <div className="hidden print:flex print:flex-col print:items-center print:justify-center print:min-h-screen print:page-break-after-always print:text-center print:gap-6">
        <Image
          src="/assets/images/ecsahc_web_logo1-1-1774467575072.png"
          alt="ECSA-HC Logo"
          width={120}
          height={120}
          className="object-contain"
        />
        <div>
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-2">East, Central &amp; Southern Africa Health Community</p>
          <h1 className="text-3xl font-700 text-gray-900 mb-2">Performance Management System</h1>
          <h2 className="text-xl font-400 text-gray-600 mb-6">System Documentation</h2>
          <div className="w-16 h-1 bg-primary mx-auto mb-6" />
          <p className="text-sm text-gray-500">Consultancy Reference Document</p>
          <p className="text-sm text-gray-500 mt-1">Version 2.0 · {new Date().getFullYear()}</p>
        </div>
        <div className="mt-auto text-xs text-gray-400">
          <p>ECSA-HC Secretariat · P.O. Box 1009, Arusha, Tanzania</p>
          <p>+255-27-2973677/8 · regsec@ecsahc.org · www.ecsahc.org</p>
        </div>
      </div>

      {/* ── Screen Layout ────────────────────────────────────────────── */}
      <div className="flex gap-6 items-start print:block">

        {/* ── Sidebar TOC ──────────────────────────────────────────── */}
        <aside className="hidden xl:block w-56 flex-shrink-0 sticky top-20 print:hidden">
          <div className="bg-white rounded-xl border border-border shadow-card p-4">
            <p className="text-[10px] font-700 uppercase tracking-widest text-primary/60 mb-3">Contents</p>
            <nav className="space-y-0.5">
              {TOC.map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollTo(item.id)}
                  className={`w-full text-left text-xs py-1.5 px-2 rounded transition-colors leading-snug
                    ${item.level === 2 ? 'pl-4 text-[11px]' : 'font-600'}
                    ${activeToc === item.id
                      ? 'bg-primary/10 text-primary' :'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
        </aside>

        {/* ── Document Body ─────────────────────────────────────────── */}
        <div ref={contentRef} className="flex-1 min-w-0 bg-white rounded-xl border border-border shadow-card print:shadow-none print:border-0 print:rounded-none">

          {/* Document Header */}
          <div className="border-b border-border px-8 py-6 print:px-0 print:py-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="text-[11px] font-600 uppercase tracking-widest text-primary/60 mb-1">
                  East, Central &amp; Southern Africa Health Community
                </p>
                <h1 className="text-2xl font-700 text-foreground leading-tight">
                  Performance Management System
                </h1>
                <p className="text-base text-muted-foreground mt-0.5">System Documentation — Consultancy Reference</p>
              </div>
              <div className="text-right text-xs text-muted-foreground space-y-0.5 flex-shrink-0">
                <p><span className="font-600 text-foreground">Version:</span> 2.0</p>
                <p><span className="font-600 text-foreground">Classification:</span> Internal</p>
                <p><span className="font-600 text-foreground">Issued:</span> {new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                <p><span className="font-600 text-foreground">Owner:</span> ECSA-HC Secretariat</p>
              </div>
            </div>
            {/* Metadata strip */}
            <div className="mt-4 flex flex-wrap gap-3">
              {[
                { label: 'System', value: 'ECSA-HC PMS' },
                { label: 'Framework', value: 'BSC / HEPRR / JEESPAR' },
                { label: 'Platform', value: 'Next.js 15 + Supabase' },
                { label: 'Status', value: 'Production' },
              ].map((m) => (
                <span key={m.label} className="text-[11px] bg-muted px-3 py-1 rounded-full text-muted-foreground">
                  <span className="font-600 text-foreground">{m.label}:</span> {m.value}
                </span>
              ))}
            </div>
          </div>

          {/* Document Content */}
          <div className="px-8 py-6 print:px-0 space-y-2">

            {/* ── 1. Executive Summary ─────────────────────────────── */}
            <SectionHeading id="executive-summary" level={1}>1. Executive Summary</SectionHeading>
            <p className="text-sm text-muted-foreground leading-relaxed">
              The ECSA-HC Performance Management System (PMS) is a web-based enterprise application designed to
              standardise, automate, and report on staff performance across the East, Central and Southern Africa
              Health Community Secretariat. The system replaces manual, paper-based appraisal processes with a
              structured digital workflow that enforces accountability, transparency, and alignment with the
              organisation's strategic plan.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed mt-3">
              The PMS supports the full performance cycle — from work-plan setting at the beginning of the year,
              through mid-year check-ins, to end-of-year self-assessment, supervisor appraisal, and final approval
              by senior management. All data is persisted in a cloud-hosted relational database with row-level
              security, and the system provides real-time analytics dashboards aligned to the Balanced Scorecard
              (BSC), HEPRR, and JEESPAR frameworks.
            </p>
            <InfoBox variant="note">
              This document serves as the authoritative reference for system consultants, technical implementers,
              and organisational leadership. It covers both business processes and technical architecture.
            </InfoBox>

            {/* ── 2. System Overview ───────────────────────────────── */}
            <SectionHeading id="system-overview" level={1}>2. System Overview</SectionHeading>
            <p className="text-sm text-muted-foreground leading-relaxed">
              The ECSA-HC PMS is a role-aware, multi-tenant web application accessible at
              <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded mx-1">https://pms.ecsahc.int</span>.
              It is built on Next.js 15 (React 19) with a Supabase (PostgreSQL) backend and deployed on a
              cloud-native infrastructure. The system enforces strict role-based access control (RBAC) and
              maintains a complete audit trail of all appraisal activities.
            </p>

            <SectionHeading id="scope-objectives" level={2}>2.1 Scope &amp; Objectives</SectionHeading>
            <DocTable
              headers={['Objective', 'Description', 'KPI']}
              rows={[
                ['Standardise Appraisals', 'Enforce a uniform performance review process across all directorates and clusters', '100% staff coverage per cycle'],
                ['Automate Workflows', 'Replace manual routing with system-enforced stage transitions and notifications', 'Zero manual routing errors'],
                ['Real-Time Visibility', 'Provide management with live dashboards on submission rates, scores, and at-risk staff', 'Dashboard latency < 5 s'],
                ['Framework Alignment', 'Map all KPIs to BSC perspectives, HEPRR domains, and JEESPAR indicators', 'Full indicator coverage'],
                ['Audit Compliance', 'Maintain immutable audit logs for all appraisal actions', '100% traceability'],
                ['Data Security', 'Enforce row-level security so staff only access their own data', 'Zero unauthorised access incidents'],
              ]}
            />

            <SectionHeading id="stakeholders" level={2}>2.2 Stakeholders &amp; Roles</SectionHeading>
            <DocTable
              headers={['Role', 'System Role Key', 'Primary Responsibilities', 'Access Level']}
              rows={[
                ['Staff Member', 'staff', 'Complete self-assessment, submit work plan, view own appraisal history', 'Own records only'],
                ['Supervisor', 'supervisor', 'Review and score direct reports, approve mid-year and end-of-year forms', 'Own + direct reports'],
                ['Manager', 'manager', 'Oversee cluster performance, approve supervisor reviews, view cluster analytics', 'Cluster-wide'],
                ['Director', 'director', 'Directorate-level oversight, approve manager reviews, access directorate dashboards', 'Directorate-wide'],
                ['Director General', 'executive_director', 'Organisation-wide visibility, final approval authority, strategic dashboards', 'Full organisation'],
                ['PMS Administrator', 'pms_admin', 'System configuration, user management, data imports, audit trail access', 'Full system'],
                ['PMS Support', 'pms_support', 'Read-only system monitoring, help desk support, report generation', 'Read-only full'],
              ]}
            />

            {/* ── 3. Process Documentation ─────────────────────────── */}
            <SectionHeading id="process-documentation" level={1}>3. Process Documentation</SectionHeading>
            <p className="text-sm text-muted-foreground leading-relaxed">
              The ECSA-HC performance cycle follows a structured annual workflow comprising six sequential stages.
              Each stage has defined actors, inputs, outputs, and system-enforced transition rules. The system
              prevents progression to the next stage until all mandatory fields are completed and the current
              stage is formally submitted.
            </p>

            <SectionHeading id="proc-workplan" level={2}>3.1 Work Plan Setting</SectionHeading>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              At the start of each performance year, every staff member creates a work plan that defines their
              key result areas (KRAs), activities, targets, and BSC perspective alignment. The work plan forms
              the contractual basis for the entire appraisal cycle.
            </p>
            <ProcessStep step={1} title="Initiate Work Plan" actor="Staff" description="Staff member logs in and navigates to Evaluation & Reviews. The system creates a draft work plan record for the current performance year." outputs={['Draft Work Plan Record']} />
            <ProcessStep step={2} title="Define KRAs & Activities" actor="Staff" description="Staff enters Key Result Areas, associated activities, measurable targets, weights, and maps each activity to a BSC perspective (Financial, Customer, Internal Process, Learning & Growth)." outputs={['KRA Entries', 'BSC Mapping']} />
            <ProcessStep step={3} title="Submit for Supervisor Review" actor="Staff" description="Staff submits the completed work plan. The system validates all mandatory fields, calculates total weight (must equal 100%), and transitions the record to 'Pending Supervisor Review' status." outputs={['Submitted Work Plan', 'Email Notification to Supervisor']} />
            <ProcessStep step={4} title="Supervisor Acknowledgement" actor="Supervisor" description="Supervisor reviews the work plan for alignment with directorate objectives and either approves it or returns it with comments for revision." outputs={['Approved Work Plan', 'Revision Request (if applicable)']} />
            <InfoBox variant="tip">
              Work plans should be completed within the first 30 days of the performance year. The system flags
              overdue work plans on the supervisor and manager dashboards.
            </InfoBox>

            <SectionHeading id="proc-self-assessment" level={2}>3.2 Self-Assessment</SectionHeading>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              At the end of the performance year, staff complete a self-assessment against their approved work
              plan. Each activity is scored on a 1–5 scale with supporting evidence and comments.
            </p>
            <ProcessStep step={1} title="Open Self-Assessment Form" actor="Staff" description="Staff navigates to Self-Assessment. The system pre-populates the form with all approved work plan activities." outputs={['Pre-populated Assessment Form']} />
            <ProcessStep step={2} title="Score Each Activity" actor="Staff" description="For each KRA activity, staff selects a performance score (1=Unsatisfactory, 2=Below Expectations, 3=Meets Expectations, 4=Exceeds Expectations, 5=Outstanding) and provides narrative justification." outputs={['Activity Scores', 'Self-Assessment Narrative']} />
            <ProcessStep step={3} title="Overall Self-Rating" actor="Staff" description="Staff provides an overall self-rating and a summary of key achievements, challenges, and development needs for the year." outputs={['Overall Self-Rating', 'Development Needs Statement']} />
            <ProcessStep step={4} title="Submit Self-Assessment" actor="Staff" description="Staff submits the completed self-assessment. The system locks the form and notifies the assigned supervisor to begin their review." outputs={['Locked Self-Assessment', 'Supervisor Notification']} />

            <SectionHeading id="proc-midyear" level={2}>3.3 Mid-Year Review</SectionHeading>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              The mid-year review is a formative check-in conducted at the midpoint of the performance year.
              It allows supervisors and staff to assess progress, adjust targets if circumstances have changed,
              and identify support needs.
            </p>
            <ProcessStep step={1} title="Initiate Mid-Year Review" actor="Supervisor" description="Supervisor opens the Mid-Year Reviews module and selects a direct report. The system displays the staff member's work plan with progress indicators." outputs={['Mid-Year Review Session']} />
            <ProcessStep step={2} title="Progress Assessment" actor="Supervisor + Staff" description="Supervisor and staff jointly assess progress against each KRA. Scores are entered on a 1–5 scale with comments. Target adjustments can be proposed and documented." outputs={['Mid-Year Progress Scores', 'Target Adjustment Proposals']} />
            <ProcessStep step={3} title="Development Planning" actor="Supervisor" description="Supervisor records agreed support actions, training needs, and any performance improvement requirements." outputs={['Development Action Plan']} />
            <ProcessStep step={4} title="Staff Acknowledgement" actor="Staff" description="Staff reviews the mid-year record and provides their acknowledgement signature (digital confirmation). Disagreements are documented in the comments field." outputs={['Acknowledged Mid-Year Record']} />
            <ProcessStep step={5} title="Manager Approval" actor="Manager" description="Manager reviews and approves mid-year reviews for their cluster, ensuring consistency of ratings across supervisors." outputs={['Approved Mid-Year Review']} />

            <SectionHeading id="proc-supervisor" level={2}>3.4 Supervisor Appraisal</SectionHeading>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Following staff self-assessment submission, the supervisor conducts an independent appraisal of
              each direct report. The system presents the supervisor with the staff member's self-assessment
              scores alongside the work plan for comparison.
            </p>
            <ProcessStep step={1} title="Access Supervisor Review Form" actor="Supervisor" description="Supervisor navigates to Evaluation & Reviews and selects a staff member with a submitted self-assessment. The system displays a side-by-side comparison view." outputs={['Supervisor Review Form']} />
            <ProcessStep step={2} title="Score Each Activity" actor="Supervisor" description="Supervisor independently scores each KRA activity on the 1–5 scale. The system highlights significant discrepancies (>1 point) between self and supervisor scores for discussion." outputs={['Supervisor Activity Scores', 'Discrepancy Flags']} />
            <ProcessStep step={3} title="Overall Supervisor Rating" actor="Supervisor" description="Supervisor provides an overall performance rating, a narrative summary, and recommendations for promotion, salary review, or performance improvement." outputs={['Overall Supervisor Rating', 'Recommendation']} />
            <ProcessStep step={4} title="Submit Supervisor Appraisal" actor="Supervisor" description="Supervisor submits the completed appraisal. The system calculates the weighted average score and transitions the record to 'Pending Manager Review'." outputs={['Submitted Supervisor Appraisal', 'Weighted Score', 'Manager Notification']} />

            <SectionHeading id="proc-approval" level={2}>3.5 Approval &amp; Finalisation</SectionHeading>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Completed appraisals pass through a hierarchical approval chain before being finalised. Each
              approver can review, comment, and either approve or return the appraisal for revision.
            </p>
            <DocTable
              headers={['Stage', 'Actor', 'Action', 'Outcome']}
              rows={[
                ['Manager Review', 'Manager', 'Reviews cluster appraisals for consistency; approves or returns', 'Manager-approved record'],
                ['Director Review', 'Director', 'Reviews directorate appraisals; approves or escalates', 'Director-approved record'],
                ['DG Final Approval', 'Director General', 'Final sign-off on all appraisals; can override ratings with documented justification', 'Finalised appraisal'],
                ['Staff Notification', 'System', 'Automated email to staff with final appraisal outcome and score', 'Staff acknowledgement'],
                ['Archive', 'System', 'Appraisal record locked and archived in audit trail', 'Immutable audit record'],
              ]}
            />
            <InfoBox variant="warning">
              Once an appraisal is finalised by the Director General, it cannot be edited. Any corrections
              require a formal amendment request through the PMS Administrator.
            </InfoBox>

            <SectionHeading id="proc-analytics" level={2}>3.6 Analytics &amp; Reporting</SectionHeading>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              The system provides real-time analytics across multiple frameworks. Reports can be exported to
              PDF and Excel formats.
            </p>
            <DocTable
              headers={['Report / Dashboard', 'Audience', 'Framework', 'Key Metrics']}
              rows={[
                ['Performance Dashboard', 'All roles (role-filtered)', 'BSC', 'Submission rates, avg scores, at-risk staff, KPI trends'],
                ['BSC Scorecard Matrix', 'Management+', 'Balanced Scorecard', 'Scores by perspective, target vs actual, trend lines'],
                ['HEPRR Progress Chart', 'Management+', 'HEPRR', 'Domain scores, capacity benchmarks, year-on-year comparison'],
                ['JEESPAR Chart', 'Management+', 'JEESPAR', 'Indicator scores, regional benchmarks'],
                ['KPI Year-on-Year', 'Management+', 'All frameworks', 'Multi-year trend analysis by KPI'],
                ['Appraisal Audit Trail', 'Admin / DG', 'Compliance', 'All actions, timestamps, actors, status changes'],
                ['Staff Drill-Down', 'Supervisors+', 'Individual', 'Individual staff performance history, score breakdown'],
              ]}
            />

            {/* ── 4. Governance & Compliance ───────────────────────── */}
            <SectionHeading id="governance" level={1}>4. Governance &amp; Compliance</SectionHeading>
            <p className="text-sm text-muted-foreground leading-relaxed">
              The PMS operates under ECSA-HC's Human Resources Policy Framework and is subject to the organisation's data protection obligations. The following governance controls are enforced by
              the system.
            </p>
            <DocTable
              headers={['Control', 'Mechanism', 'Responsible Party']}
              rows={[
                ['Role-Based Access Control', 'PostgreSQL Row-Level Security (RLS) policies enforce data isolation by role and reporting line', 'PMS Administrator'],
                ['Audit Trail', 'All create, update, and delete operations on appraisal records are logged with actor, timestamp, and before/after values', 'System (automatic)'],
                ['Data Retention', 'Appraisal records are retained for a minimum of 7 years in accordance with HR policy', 'PMS Administrator'],
                ['Password Policy', 'Minimum 8 characters, enforced via Supabase Auth; mandatory change on first login', 'System (automatic)'],
                ['Session Management', 'JWT tokens expire after 1 hour; refresh tokens valid for 7 days', 'System (automatic)'],
                ['Backup & Recovery', 'Daily automated backups via Supabase; point-in-time recovery available for 30 days', 'Infrastructure Team'],
                ['Change Management', 'All schema migrations are version-controlled and applied through CI/CD pipeline', 'Technical Team'],
              ]}
            />

            {/* ── 5. Technical Documentation ───────────────────────── */}
            <SectionHeading id="technical-documentation" level={1}>5. Technical Documentation</SectionHeading>
            <p className="text-sm text-muted-foreground leading-relaxed">
              This section provides a comprehensive technical reference for developers, system administrators,
              and technical consultants responsible for maintaining, extending, or integrating with the
              ECSA-HC PMS.
            </p>

            <SectionHeading id="tech-architecture" level={2}>5.1 System Architecture</SectionHeading>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">
              The system follows a modern JAMstack architecture with server-side rendering capabilities
              provided by Next.js. The backend is fully managed by Supabase, which provides PostgreSQL,
              authentication, real-time subscriptions, storage, and edge functions.
            </p>
            <DocTable
              headers={['Layer', 'Technology', 'Version', 'Purpose']}
              rows={[
                ['Frontend Framework', 'Next.js', '15.1.11', 'React-based SSR/CSR framework with App Router'],
                ['UI Library', 'React', '19.0.3', 'Component-based UI with concurrent rendering'],
                ['Language', 'TypeScript', '5.x', 'Static typing, interfaces, strict null checks'],
                ['Styling', 'Tailwind CSS', '3.4.6', 'Utility-first CSS with custom design tokens'],
                ['Database', 'PostgreSQL (Supabase)', '15.x', 'Relational database with RLS, triggers, functions'],
                ['Authentication', 'Supabase Auth', 'Latest', 'JWT-based auth with email/password and magic links'],
                ['Real-time', 'Supabase Realtime', 'Latest', 'WebSocket-based live data subscriptions'],
                ['Email', 'Resend', 'Latest', 'Transactional email delivery for notifications'],
                ['Charts', 'Recharts', '2.15.2', 'Composable SVG charts for analytics dashboards'],
                ['PDF Export', 'jsPDF + jspdf-autotable', '4.2.1 / 5.0.7', 'Client-side PDF generation for reports'],
                ['Excel Export', 'XLSX', '0.18.5', 'Spreadsheet generation for data exports'],
                ['Hosting', 'Vercel / Cloud', 'N/A', 'Edge-optimised deployment with CDN'],
              ]}
            />

            <SectionHeading id="tech-database" level={2}>5.2 Database Schema</SectionHeading>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">
              The database is hosted on Supabase (PostgreSQL 15). All tables reside in the
              <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded mx-1">public</span> schema
              unless otherwise noted. Row-Level Security is enabled on all tables containing user data.
            </p>
            <DocTable
              headers={['Table', 'Primary Key', 'Description', 'RLS']}
              rows={[
                ['user_profiles', 'id (uuid)', 'Extended profile for each authenticated user; links to auth.users', 'Yes'],
                ['staff_list', 'id (uuid)', 'Master staff registry with directorate, cluster, and supervisor assignments', 'Yes'],
                ['appraisal_forms', 'id (uuid)', 'Core appraisal record per staff per year; tracks stage and scores', 'Yes'],
                ['appraisal_drafts', 'id (uuid)', 'Auto-saved draft state for in-progress appraisal forms', 'Yes'],
                ['workplan_settings', 'id (uuid)', 'KRA and activity definitions for each staff member per year', 'Yes'],
                ['mid_year_reviews', 'id (uuid)', 'Mid-year review records with progress scores and comments', 'Yes'],
                ['activity_logs', 'id (uuid)', 'Immutable audit log of all system actions', 'Admin only'],
                ['notifications', 'id (uuid)', 'In-app and email notification queue', 'Yes'],
                ['directorates', 'id (uuid)', 'Organisational directorates reference table', 'Read-all'],
                ['clusters', 'id (uuid)', 'Organisational clusters within directorates', 'Read-all'],
              ]}
            />
            <CodeBlock label="Key Relationships (Simplified ERD)">
{`auth.users (1) ──── (1) user_profiles
user_profiles (1) ──── (N) appraisal_forms
user_profiles (1) ──── (N) appraisal_drafts
staff_list (1) ──── (N) appraisal_forms
appraisal_forms (1) ──── (N) workplan_settings
appraisal_forms (1) ──── (1) mid_year_reviews
directorates (1) ──── (N) clusters
clusters (1) ──── (N) staff_list
staff_list (N) ──── (1) staff_list [supervisor_id → id]`}
            </CodeBlock>

            <SectionHeading id="tech-security" level={2}>5.3 Security &amp; Access Control</SectionHeading>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">
              Security is enforced at multiple layers. PostgreSQL RLS policies are the primary data isolation
              mechanism, supplemented by application-level role guards and Next.js middleware.
            </p>
            <DocTable
              headers={['Layer', 'Mechanism', 'Scope']}
              rows={[
                ['Network', 'HTTPS/TLS 1.3 enforced; Supabase API keys scoped to anon/service roles', 'All traffic'],
                ['Authentication', 'Supabase Auth JWT; tokens validated on every API request', 'All authenticated routes'],
                ['Middleware', 'Next.js middleware (src/middleware.ts) redirects unauthenticated users to /login', 'All app routes'],
                ['Database RLS', 'Row-Level Security policies on all user tables; policies reference auth.uid()', 'All DB queries'],
                ['Role Guards', 'RoleGuard component (src/components/RoleGuard.tsx) restricts UI sections by systemRole', 'Frontend UI'],
                ['Admin Functions', 'SECURITY DEFINER functions with explicit search_path to prevent privilege escalation', 'Admin operations'],
                ['Audit Logging', 'PostgreSQL triggers write to activity_logs on all DML operations', 'All data changes'],
              ]}
            />
            <CodeBlock label="RLS Policy Pattern (Example)">
{`-- Staff can only read their own appraisal forms
CREATE POLICY "staff_read_own_appraisals"
  ON public.appraisal_forms
  FOR SELECT
  USING (
    staff_id = auth.uid()
    OR supervisor_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
      AND system_role IN ('manager','director','executive_director','pms_admin','pms_support')
    )
  );`}
            </CodeBlock>

            <SectionHeading id="tech-integrations" level={2}>5.4 Integrations &amp; APIs</SectionHeading>
            <DocTable
              headers={['Integration', 'Provider', 'Purpose', 'Configuration']}
              rows={[
                ['Database & Auth', 'Supabase', 'Primary data store, user authentication, real-time subscriptions', 'NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY'],
                ['Email Notifications', 'Resend', 'Transactional emails for appraisal stage transitions and reminders', 'RESEND_API_KEY (server-side only)'],
                ['Staff Email Function', 'Supabase Edge Function', 'send-staff-email edge function handles bulk staff notification dispatch', 'Deployed to Supabase Functions'],
                ['Analytics (optional)', 'Google Analytics 4', 'Usage analytics and user behaviour tracking', 'NEXT_PUBLIC_GA_MEASUREMENT_ID'],
              ]}
            />
            <CodeBlock label="Supabase Client Initialisation (src/lib/supabase/client.ts)">
{`import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}`}
            </CodeBlock>

            <SectionHeading id="tech-deployment" level={2}>5.5 Deployment &amp; Infrastructure</SectionHeading>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">
              The application is deployed on a cloud-native platform with automatic CI/CD. Database migrations
              are managed through versioned SQL files in the
              <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded mx-1">supabase/migrations/</span>
              directory and applied via the Supabase CLI.
            </p>
            <DocTable
              headers={['Component', 'Environment', 'URL / Endpoint']}
              rows={[
                ['Web Application', 'Production', 'https://pms.ecsahc.int'],
                ['Web Application', 'Staging', 'https://perfmanage6773.builtwithrocket.new'],
                ['Supabase Project', 'Production', 'Configured via NEXT_PUBLIC_SUPABASE_URL'],
                ['Edge Functions', 'Production', 'Supabase Functions (send-staff-email)'],
                ['Auth Callback', 'All', '/auth/callback (src/app/auth/callback/route.ts)'],
              ]}
            />
            <CodeBlock label="Migration File Naming Convention">
{`supabase/migrations/
  YYYYMMDDHHMMSS_description.sql

Examples:
  20260713160000_dashboard_materialized_view.sql
  20260826235900_fix_user_profiles_rls_recursion.sql
  20260827000100_definitive_user_profiles_rls_fix.sql

Rules:
  - Timestamps must be strictly increasing
  - Migrations are immutable once applied to production
  - All migrations must be idempotent (use IF NOT EXISTS, IF EXISTS)
  - RLS policies must use CREATE POLICY ... IF NOT EXISTS or DROP/CREATE pattern`}
            </CodeBlock>

            <SectionHeading id="tech-data-flows" level={2}>5.6 Data Flows &amp; State Management</SectionHeading>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">
              The application uses a combination of React Context for global auth state, SWR for server-state
              caching, and Supabase Realtime for live dashboard updates.
            </p>
            <DocTable
              headers={['Concern', 'Solution', 'Location']}
              rows={[
                ['Authentication State', 'AuthContext (React Context + Supabase Auth listener)', 'src/contexts/AuthContext.tsx'],
                ['Server Data Caching', 'SWR (stale-while-revalidate) via SWRProvider', 'src/components/SWRProvider.tsx'],
                ['Real-time Dashboard', 'Supabase Realtime subscriptions via useRealtimeDashboard hook', 'src/hooks/useRealtimeDashboard.ts'],
                ['Offline Support', 'Service Worker (public/sw.js) + useServiceWorker hook', 'src/hooks/useServiceWorker.ts'],
                ['Offline Approvals', 'IndexedDB queue via offlineApprovals utility', 'src/lib/offlineApprovals.ts'],
                ['Form Auto-save', 'useAutosave hook with debounced Supabase upsert', 'src/hooks/useAutosave.ts'],
                ['In-app Notifications', 'NotificationCenter component with Supabase Realtime', 'src/components/NotificationCenter.tsx'],
              ]}
            />
            <CodeBlock label="Appraisal Stage State Machine">
{`Stages (in order):
  draft → submitted → supervisor_review → manager_review
  → director_review → dg_review → finalised

Transition Rules:
  draft        → submitted        : Staff submits self-assessment
  submitted    → supervisor_review: Supervisor opens review
  supervisor_review → manager_review: Supervisor submits appraisal
  manager_review → director_review: Manager approves
  director_review → dg_review    : Director approves
  dg_review    → finalised        : DG gives final approval

Reverse Transitions (return for revision):
  Any stage → previous stage: Approver returns with comments
  finalised: IMMUTABLE — no reverse transition permitted`}
            </CodeBlock>

            {/* ── 6. Appendix ──────────────────────────────────────── */}
            <SectionHeading id="appendix" level={1}>6. Appendix</SectionHeading>

            <h4 className="text-sm font-700 text-foreground mt-5 mb-2">A. Performance Rating Scale</h4>
            <DocTable
              headers={['Score', 'Rating', 'Description', 'Action Required']}
              rows={[
                ['5', 'Outstanding', 'Consistently exceeds all targets; demonstrates exceptional contribution', 'Recognition; consider for promotion'],
                ['4', 'Exceeds Expectations', 'Regularly exceeds most targets; strong performer', 'Recognition; development opportunities'],
                ['3', 'Meets Expectations', 'Achieves all targets; performs at the expected standard', 'Maintain; standard development plan'],
                ['2', 'Below Expectations', 'Partially meets targets; some areas require improvement', 'Performance Improvement Plan (PIP)'],
                ['1', 'Unsatisfactory', 'Fails to meet most targets; significant performance gaps', 'Formal PIP; HR intervention required'],
              ]}
            />

            <h4 className="text-sm font-700 text-foreground mt-5 mb-2">B. BSC Perspective Definitions</h4>
            <DocTable
              headers={['Perspective', 'Focus Area', 'Typical KRAs']}
              rows={[
                ['Financial', 'Resource stewardship, budget management, cost efficiency', 'Budget utilisation, grant management, cost recovery'],
                ['Customer / Stakeholder', 'Service delivery, member state satisfaction, partnerships', 'Member state support, partner engagement, service quality'],
                ['Internal Process', 'Operational efficiency, process improvement, compliance', 'Report timeliness, meeting targets, compliance rates'],
                ['Learning & Growth', 'Staff development, knowledge management, innovation', 'Training completion, skills development, knowledge sharing'],
              ]}
            />

            <h4 className="text-sm font-700 text-foreground mt-5 mb-2">C. Key Contacts</h4>
            <DocTable
              headers={['Role', 'Contact', 'Responsibility']}
              rows={[
                ['PMS System Administrator', 'regsec@ecsahc.org', 'User management, system configuration, data issues'],
                ['ECSA-HC Secretariat', '+255-27-2973677/8', 'HR policy, appraisal process queries'],
                ['Technical Support', 'regsec@ecsahc.org', 'System errors, access issues, technical problems'],
              ]}
            />

            <h4 className="text-sm font-700 text-foreground mt-5 mb-2">D. Glossary</h4>
            <DocTable
              headers={['Term', 'Definition']}
              rows={[
                ['BSC', 'Balanced Scorecard — strategic performance management framework with four perspectives'],
                ['HEPRR', 'Health Emergency Preparedness, Response and Resilience — WHO/ECSA-HC framework'],
                ['JEESPAR', 'Joint External Evaluation Secretariat Performance Assessment Report'],
                ['KRA', 'Key Result Area — a major area of responsibility in a staff member\'s work plan'],
                ['RLS', 'Row-Level Security — PostgreSQL feature that restricts data access at the row level'],
                ['PMS', 'Performance Management System — this application'],
                ['JWT', 'JSON Web Token — secure token format used for authentication'],
                ['SWR', 'Stale-While-Revalidate — data fetching strategy that shows cached data while refreshing'],
                ['DG', 'Director General — the head of the ECSA-HC Secretariat'],
                ['PIP', 'Performance Improvement Plan — formal plan for staff with below-expectations ratings'],
              ]}
            />

            {/* Document Footer */}
            <div className="mt-10 pt-6 border-t border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-2.5">
                <Image
                  src="/assets/images/ecsahc_web_logo1-1-1774467575072.png"
                  alt="ECSA-HC Logo"
                  width={28}
                  height={28}
                  className="object-contain h-6 w-auto"
                />
                <div>
                  <p className="font-600 text-foreground text-xs">ECSA-HC Performance Management System</p>
                  <p>System Documentation v2.0 · Confidential — Internal Use Only</p>
                </div>
              </div>
              <div className="text-right">
                <p>© {new Date().getFullYear()} East, Central &amp; Southern Africa Health Community</p>
                <p>P.O. Box 1009, Arusha, Tanzania · regsec@ecsahc.org</p>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ── Print Styles ─────────────────────────────────────────────── */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 20mm 18mm 20mm 18mm;
          }
          body {
            font-size: 11pt;
            color: #111827;
            background: white !important;
          }
          .print\\:hidden { display: none !important; }
          .print\\:block { display: block !important; }
          .print\\:flex { display: flex !important; }
          h2 { page-break-before: auto; page-break-after: avoid; }
          h3 { page-break-after: avoid; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; }
          pre { page-break-inside: avoid; white-space: pre-wrap; }
          .print\\:page-break-after-always { page-break-after: always; }
        }
      `}</style>
    </AppLayout>
  );
}
