'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Section {
  id: string;
  number: string;
  title: string;
  subsections?: { id: string; number: string; title: string }[];
}

// ─── Table of Contents ────────────────────────────────────────────────────────
const TOC: Section[] = [
  {
    id: 'introduction',
    number: '1',
    title: 'Introduction',
    subsections: [
      { id: 'about-system', number: '1.1', title: 'About the ECSA-HC PMS' },
      { id: 'purpose', number: '1.2', title: 'Purpose of This Manual' },
      { id: 'audience', number: '1.3', title: 'Intended Audience' },
      { id: 'conventions', number: '1.4', title: 'Document Conventions' },
    ],
  },
  {
    id: 'getting-started',
    number: '2',
    title: 'Getting Started',
    subsections: [
      { id: 'system-requirements', number: '2.1', title: 'System Requirements' },
      { id: 'accessing-system', number: '2.2', title: 'Accessing the System' },
      { id: 'login', number: '2.3', title: 'Logging In' },
      { id: 'change-password', number: '2.4', title: 'Changing Your Password' },
      { id: 'navigation', number: '2.5', title: 'Navigating the Interface' },
      { id: 'user-roles', number: '2.6', title: 'User Roles & Access Levels' },
    ],
  },
  {
    id: 'performance-dashboard',
    number: '3',
    title: 'Performance Dashboard',
    subsections: [
      { id: 'dashboard-overview', number: '3.1', title: 'Dashboard Overview' },
      { id: 'kpi-cards', number: '3.2', title: 'KPI Metric Cards' },
      { id: 'bsc-chart', number: '3.3', title: 'BSC Perspective Chart' },
      { id: 'kpi-trend', number: '3.4', title: 'KPI Trend Chart' },
      { id: 'at-risk', number: '3.5', title: 'At-Risk Staff Table' },
      { id: 'strategic-plan', number: '3.6', title: 'Strategic Plan Section' },
    ],
  },
  {
    id: 'evaluation-reviews',
    number: '4',
    title: 'Evaluation & Reviews',
    subsections: [
      { id: 'eval-overview', number: '4.1', title: 'Module Overview' },
      { id: 'workplan-setup', number: '4.2', title: 'Workplan Setup' },
      { id: 'review-table', number: '4.3', title: 'Review Table' },
      { id: 'evaluation-form', number: '4.4', title: 'Evaluation Form' },
      { id: 'comparison-modal', number: '4.5', title: 'Evaluation Comparison Modal' },
      { id: 'print-appraisal', number: '4.6', title: 'Print Appraisal Layout' },
      { id: 'workplan-list', number: '4.7', title: 'Workplan List View' },
    ],
  },
  {
    id: 'self-assessment',
    number: '5',
    title: 'Self-Assessment',
    subsections: [
      { id: 'sa-overview', number: '5.1', title: 'Self-Assessment Wizard Overview' },
      { id: 'sa-step1', number: '5.2', title: 'Step 1 – Select Workplan' },
      { id: 'sa-step2', number: '5.3', title: 'Step 2 – KPI Assessment' },
      { id: 'sa-step3', number: '5.4', title: 'Step 3 – General Competencies' },
      { id: 'sa-step4', number: '5.5', title: 'Step 4 – Objectives & Goals' },
      { id: 'sa-step5', number: '5.6', title: 'Step 5 – Overall Reflection' },
      { id: 'sa-step6', number: '5.7', title: 'Step 6 – Sign & Submit' },
    ],
  },
  {
    id: 'manager-review',
    number: '6',
    title: 'Manager Review',
    subsections: [
      { id: 'mr-overview', number: '6.1', title: 'Review Table' },
      { id: 'mr-staff-tab', number: '6.2', title: 'Staff Self-Assessment Tab' },
      { id: 'mr-rating-tab', number: '6.3', title: 'Manager Rating & Feedback Tab' },
      { id: 'mr-approve', number: '6.4', title: 'Approving or Rejecting a Review' },
    ],
  },
  {
    id: 'mid-year-reviews',
    number: '7',
    title: 'Mid-Year Reviews',
    subsections: [
      { id: 'myr-overview', number: '7.1', title: 'Module Overview' },
      { id: 'myr-statuses', number: '7.2', title: 'Review Statuses Explained' },
    ],
  },
  {
    id: 'feedback-mentorship',
    number: '8',
    title: 'Feedback & Mentorship',
    subsections: [
      { id: 'fm-feed', number: '8.1', title: 'Feedback Feed' },
      { id: 'fm-give', number: '8.2', title: 'Giving Feedback' },
      { id: 'fm-mentor', number: '8.3', title: 'Mentor Directory' },
      { id: 'fm-sessions', number: '8.4', title: 'Upcoming Sessions Panel' },
      { id: 'fm-peer', number: '8.5', title: 'Peer Exchange Panel' },
    ],
  },
  {
    id: 'training-resources',
    number: '9',
    title: 'Training & Resources',
    subsections: [
      { id: 'tr-catalog', number: '9.1', title: 'Training Catalog' },
      { id: 'tr-cpd', number: '9.2', title: 'CPD Progress Table' },
      { id: 'tr-cert', number: '9.3', title: 'Certification Tracker' },
      { id: 'tr-docs', number: '9.4', title: 'Guidance Documents' },
    ],
  },
  {
    id: 'staff-management',
    number: '10',
    title: 'Staff Management',
    subsections: [
      { id: 'sm-directory', number: '10.1', title: 'Staff Directory' },
      { id: 'sm-add-edit', number: '10.2', title: 'Adding & Editing Staff' },
      { id: 'sm-directorates', number: '10.3', title: 'Directorates & Clusters' },
      { id: 'sm-import', number: '10.4', title: 'Staff Import' },
    ],
  },
  {
    id: 'analytics-reports',
    number: '11',
    title: 'Analytics & Reports',
    subsections: [
      { id: 'ar-kpi', number: '11.1', title: 'KPI Year-on-Year Chart' },
      { id: 'ar-bsc', number: '11.2', title: 'BSC Scorecard Matrix' },
      { id: 'ar-jeesp', number: '11.3', title: 'JEESP-AR Chart' },
      { id: 'ar-heprr', number: '11.4', title: 'HEPRR Progress Chart' },
      { id: 'ar-wbn', number: '11.5', title: 'WBN-o-Pipeline Table' },
      { id: 'ar-export', number: '11.6', title: 'Reports Export Panel' },
    ],
  },
  {
    id: 'permissions',
    number: '12',
    title: 'Permissions',
    subsections: [
      { id: 'perm-roles', number: '12.1', title: 'Roles Overview' },
      { id: 'perm-assign', number: '12.2', title: 'Assigning Roles' },
      { id: 'perm-matrix', number: '12.3', title: 'Module Permission Matrix' },
    ],
  },
  {
    id: 'admin-dashboard',
    number: '13',
    title: 'Admin Dashboard',
    subsections: [
      { id: 'admin-overview', number: '13.1', title: 'Admin Overview' },
      { id: 'admin-audit', number: '13.2', title: 'Appraisal Audit Trail' },
      { id: 'admin-system', number: '13.3', title: 'System Health' },
    ],
  },
  {
    id: 'troubleshooting',
    number: '14',
    title: 'Troubleshooting & Support',
    subsections: [
      { id: 'ts-common', number: '14.1', title: 'Common Issues' },
      { id: 'ts-contact', number: '14.2', title: 'Contacting Support' },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function SectionHeading({ id, number, title }: { id: string; number: string; title: string }) {
  return (
    <h2
      id={id}
      className="text-2xl font-bold text-[#1a3a5c] border-b-2 border-[#1a3a5c] pb-2 mt-12 mb-6 flex items-center gap-3 print:mt-8"
    >
      <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[#1a3a5c] text-white text-sm font-bold flex-shrink-0">
        {number}
      </span>
      {title}
    </h2>
  );
}

function SubHeading({ id, number, title }: { id: string; number: string; title: string }) {
  return (
    <h3
      id={id}
      className="text-lg font-semibold text-[#1a3a5c] mt-8 mb-3 flex items-center gap-2"
    >
      <span className="text-[#2e7d32] font-bold text-base">{number}</span>
      {title}
    </h3>
  );
}

function InfoBox({ children, type = 'info' }: { children: React.ReactNode; type?: 'info' | 'tip' | 'warning' | 'note' }) {
  const styles = {
    info:    { bg: 'bg-blue-50 border-blue-300',   icon: 'ℹ️', label: 'Information', text: 'text-blue-800' },
    tip:     { bg: 'bg-green-50 border-green-300',  icon: '💡', label: 'Tip',         text: 'text-green-800' },
    warning: { bg: 'bg-amber-50 border-amber-300',  icon: '⚠️', label: 'Warning',     text: 'text-amber-800' },
    note:    { bg: 'bg-slate-50 border-slate-300',  icon: '📝', label: 'Note',        text: 'text-slate-700' },
  };
  const s = styles[type];
  return (
    <div className={`border-l-4 ${s.bg} rounded-r-lg p-4 my-4`}>
      <p className={`text-sm font-semibold ${s.text} mb-1`}>{s.icon} {s.label}</p>
      <div className={`text-sm ${s.text}`}>{children}</div>
    </div>
  );
}

function StepBox({ step, title, children }: { step: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 my-4">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#1a3a5c] text-white flex items-center justify-center text-sm font-bold">
        {step}
      </div>
      <div className="flex-1">
        <p className="font-semibold text-[#1a3a5c] mb-1">{title}</p>
        <div className="text-sm text-gray-700">{children}</div>
      </div>
    </div>
  );
}

function RoleTable() {
  const roles = [
    { role: 'Director General', key: 'executive_director', access: 'Full system access and final approval authority', badge: 'bg-violet-100 text-violet-800' },
    { role: 'Director (Operations & Institutional Dev.)', key: 'deputy_director', access: 'Broad access with approval rights for reviews', badge: 'bg-indigo-100 text-indigo-800' },
    { role: 'Director (Programme)', key: 'programme_manager', access: 'Manages programme staff and approves their reviews', badge: 'bg-sky-100 text-sky-800' },
    { role: 'Finance Manager', key: 'finance_manager', access: 'Manages finance team and approves their reviews', badge: 'bg-emerald-100 text-emerald-800' },
    { role: 'HR & Admin Officer', key: 'hr_admin_officer', access: 'Manages staff records and system permissions', badge: 'bg-amber-100 text-amber-800' },
    { role: 'Programme Officer', key: 'programme_officer', access: 'Submits own reviews, views programme content', badge: 'bg-blue-100 text-blue-800' },
    { role: 'Finance Officer', key: 'finance_officer', access: 'Submits own reviews, limited screen access', badge: 'bg-teal-100 text-teal-800' },
    { role: 'Admin Officer', key: 'admin_officer', access: 'Submits own reviews, limited screen access', badge: 'bg-orange-100 text-orange-800' },
    { role: 'Project Coordinator', key: 'project_coordinator', access: 'Submits own reviews, views project content', badge: 'bg-rose-100 text-rose-800' },
  ];
  return (
    <div className="overflow-x-auto my-4">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-[#1a3a5c] text-white">
            <th className="text-left px-4 py-3 font-semibold rounded-tl-lg">Role</th>
            <th className="text-left px-4 py-3 font-semibold">System Key</th>
            <th className="text-left px-4 py-3 font-semibold rounded-tr-lg">Access Description</th>
          </tr>
        </thead>
        <tbody>
          {roles.map((r, i) => (
            <tr key={r.key} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className="px-4 py-3 font-medium">
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${r.badge}`}>{r.role}</span>
              </td>
              <td className="px-4 py-3 font-mono text-xs text-gray-600">{r.key}</td>
              <td className="px-4 py-3 text-gray-700">{r.access}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WorkflowDiagram() {
  const stages = [
    { label: 'Workplan Setup', color: 'bg-blue-100 border-blue-400 text-blue-800' },
    { label: 'Self-Assessment', color: 'bg-teal-100 border-teal-400 text-teal-800' },
    { label: 'Manager Review', color: 'bg-amber-100 border-amber-400 text-amber-800' },
    { label: 'Evaluation Comparison', color: 'bg-violet-100 border-violet-400 text-violet-800' },
    { label: 'Final Approval', color: 'bg-green-100 border-green-400 text-green-800' },
  ];
  return (
    <div className="flex flex-wrap items-center gap-1 my-6">
      {stages.map((s, i) => (
        <React.Fragment key={s.label}>
          <div className={`border-2 rounded-lg px-3 py-2 text-xs font-semibold text-center ${s.color}`}>
            {s.label}
          </div>
          {i < stages.length - 1 && (
            <span className="text-gray-400 font-bold text-lg">→</span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function UserManualPage() {
  const [activeSection, setActiveSection] = useState('introduction');
  const [tocOpen, setTocOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: '-20% 0px -70% 0px' }
    );
    const headings = contentRef.current?.querySelectorAll('h2[id], h3[id]');
    headings?.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTocOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 print:bg-white">
      {/* ── Print-only header ── */}
      <div className="hidden print:flex print:items-center print:justify-between print:border-b-2 print:border-[#1a3a5c] print:pb-4 print:mb-8">
        <div className="flex items-center gap-3">
          <img src="/assets/images/ecsahc_web_logo1-1-1774467575072.png" alt="ECSA-HC Logo" className="h-16 object-contain" />
          <div>
            <p className="text-xl font-bold text-[#1a3a5c]">ECSA-HC</p>
            <p className="text-sm text-gray-600">East, Central &amp; Southern Africa Health Community</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-gray-700">Performance Management System</p>
          <p className="text-xs text-gray-500">User Manual — Version 1.0 (2026)</p>
        </div>
      </div>

      {/* ── Top Nav Bar (screen only) ── */}
      <header className="sticky top-0 z-50 bg-[#1a3a5c] text-white shadow-lg print:hidden">
        <div className="max-w-screen-xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/assets/images/ecsahc_web_logo1-1-1774467575072.png"
              alt="ECSA-HC Logo"
              width={40}
              height={40}
              className="object-contain bg-white rounded-full p-0.5"
            />
            <div>
              <p className="font-bold text-sm leading-tight">ECSA-HC PMS</p>
              <p className="text-[10px] text-blue-200 leading-tight">User Manual</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.print()}
              className="hidden sm:flex items-center gap-1.5 text-xs bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print / Save PDF
            </button>
            <Link
              href="/user-manual/print"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs bg-emerald-500 hover:bg-emerald-400 text-white px-3 py-1.5 rounded-lg transition-colors font-semibold"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download PDF
            </Link>
            <Link
              href="/performance-dashboard"
              className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors"
            >
              ← Back to App
            </Link>
            <button
              onClick={() => setTocOpen(!tocOpen)}
              className="sm:hidden p-1.5 bg-white/10 rounded-lg"
              aria-label="Toggle table of contents"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-screen-xl mx-auto flex print:block">
        {/* ── Sidebar TOC (screen only) ── */}
        <aside
          className={`
            print:hidden
            fixed sm:sticky top-[57px] sm:top-[57px] left-0 h-[calc(100vh-57px)] sm:h-[calc(100vh-57px)]
            w-72 bg-white border-r border-gray-200 overflow-y-auto z-40
            transition-transform duration-300
            ${tocOpen ? 'translate-x-0' : '-translate-x-full sm:translate-x-0'}
          `}
        >
          <div className="p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Table of Contents</p>
            {TOC.map((section) => (
              <div key={section.id} className="mb-1">
                <button
                  onClick={() => scrollTo(section.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    activeSection === section.id
                      ? 'bg-[#1a3a5c] text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <span className="text-xs mr-2 opacity-60">{section.number}.</span>
                  {section.title}
                </button>
                {section.subsections && (
                  <div className="ml-4 mt-0.5 space-y-0.5">
                    {section.subsections.map((sub) => (
                      <button
                        key={sub.id}
                        onClick={() => scrollTo(sub.id)}
                        className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors ${
                          activeSection === sub.id
                            ? 'bg-blue-50 text-[#1a3a5c] font-semibold'
                            : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                        }`}
                      >
                        <span className="mr-1.5 opacity-60">{sub.number}</span>
                        {sub.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </aside>

        {/* Mobile TOC overlay */}
        {tocOpen && (
          <div
            className="fixed inset-0 bg-black/40 z-30 sm:hidden"
            onClick={() => setTocOpen(false)}
          />
        )}

        {/* ── Main Content ── */}
        <main ref={contentRef} className="flex-1 min-w-0 px-6 sm:px-10 py-8 print:px-0 print:py-0">

          {/* ══════════════════════════════════════════════════════════════
              COVER PAGE
          ══════════════════════════════════════════════════════════════ */}
          <div className="bg-gradient-to-br from-[#1a3a5c] to-[#0d2540] text-white rounded-2xl p-10 mb-12 print:rounded-none print:mb-8 relative overflow-hidden">
            <div className="absolute inset-0 opacity-5">
              <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-white transform translate-x-32 -translate-y-32" />
              <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-white transform -translate-x-16 translate-y-16" />
            </div>
            <div className="relative z-10">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 mb-8">
                <div className="bg-white rounded-2xl p-3 flex-shrink-0">
                  <Image
                    src="/assets/images/ecsahc_web_logo1-1-1774467575072.png"
                    alt="ECSA-HC Logo"
                    width={80}
                    height={80}
                    className="object-contain"
                  />
                </div>
                <div>
                  <p className="text-blue-200 text-sm font-semibold uppercase tracking-widest mb-1">
                    East, Central &amp; Southern Africa Health Community
                  </p>
                  <h1 className="text-3xl sm:text-4xl font-extrabold leading-tight">
                    Performance Management System
                  </h1>
                  <p className="text-blue-200 text-lg mt-1">User Manual</p>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                {[
                  { label: 'Document Version', value: '1.0' },
                  { label: 'Release Date', value: 'September 2026' },
                  { label: 'Prepared By', value: 'ECSA-HC ICT Unit' },
                  { label: 'Classification', value: 'Internal Use' },
                ].map((item) => (
                  <div key={item.label} className="bg-white/10 rounded-xl p-3">
                    <p className="text-blue-300 text-xs mb-0.5">{item.label}</p>
                    <p className="font-semibold">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════
              SECTION 1 — INTRODUCTION
          ══════════════════════════════════════════════════════════════ */}
          <SectionHeading id="introduction" number="1" title="Introduction" />

          <SubHeading id="about-system" number="1.1" title="About the ECSA-HC PMS" />
          <p className="text-gray-700 mb-4">
            The <strong>ECSA-HC Performance Management System (PMS)</strong> is a comprehensive, web-based platform
            developed for the East, Central &amp; Southern Africa Health Community to manage staff performance,
            evaluations, and professional development across all directorates and clusters.
          </p>
          <p className="text-gray-700 mb-4">
            The system is aligned with the <strong>ECSA-HC Strategic Plan 2024–2034</strong> and supports the
            organisation's five strategic pillars and nine strategic objectives. It provides real-time performance
            data, structured appraisal workflows, and organisation-wide analytics to support evidence-based
            decision-making.
          </p>
          <div className="bg-[#f0f4f8] border border-[#c8d8e8] rounded-xl p-5 my-6">
            <p className="text-sm font-bold text-[#1a3a5c] mb-3">Key System Capabilities</p>
            <div className="grid sm:grid-cols-2 gap-2 text-sm text-gray-700">
              {[
                '📊 Real-time performance dashboards with BSC perspectives',
                '📋 Structured appraisal lifecycle management',
                '🎯 Workplan setup and KPI tracking',
                '✅ Self-assessment and manager review workflows',
                '📈 Analytics, reports, and data export tools',
                '👥 Staff management and directorate organisation',
                '🔒 Role-based access control and permissions',
                '💬 Feedback, mentorship, and peer exchange',
                '📚 Training catalogue and CPD tracking',
                '🔍 Appraisal audit trail and system health monitoring',
              ].map((item) => (
                <div key={item} className="flex items-start gap-2">
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <SubHeading id="purpose" number="1.2" title="Purpose of This Manual" />
          <p className="text-gray-700 mb-4">
            This manual provides step-by-step guidance for all users of the ECSA-HC PMS. It covers every module
            and feature of the system, from initial login to advanced analytics. Whether you are a staff member
            completing your first self-assessment or an HR administrator managing system permissions, this manual
            will guide you through each task.
          </p>

          <SubHeading id="audience" number="1.3" title="Intended Audience" />
          <p className="text-gray-700 mb-3">This manual is intended for all ECSA-HC staff who use the PMS, including:</p>
          <ul className="list-disc list-inside text-gray-700 space-y-1 mb-4 ml-4">
            <li><strong>Staff Members</strong> — completing self-assessments and accessing development resources</li>
            <li><strong>Supervisors &amp; Managers</strong> — reviewing staff evaluations and providing feedback</li>
            <li><strong>HR &amp; Admin Officers</strong> — managing staff records and system configuration</li>
            <li><strong>Directors &amp; Senior Management</strong> — monitoring organisational performance</li>
            <li><strong>System Administrators</strong> — managing roles, permissions, and system health</li>
          </ul>

          <SubHeading id="conventions" number="1.4" title="Document Conventions" />
          <div className="grid sm:grid-cols-2 gap-3 my-4">
            {[
              { icon: '💡', label: 'Tip', desc: 'Helpful hints to improve your experience' },
              { icon: 'ℹ️', label: 'Information', desc: 'Important context or background detail' },
              { icon: '⚠️', label: 'Warning', desc: 'Actions that may have significant consequences' },
              { icon: '📝', label: 'Note', desc: 'Additional notes or clarifications' },
            ].map((c) => (
              <div key={c.label} className="flex items-start gap-3 bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm">
                <span className="text-xl">{c.icon}</span>
                <div>
                  <p className="font-semibold text-gray-800">{c.label}</p>
                  <p className="text-gray-600">{c.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-sm text-gray-600 mt-2">
            <strong>Bold text</strong> indicates UI elements such as button labels, field names, and menu items.
            <code className="bg-gray-100 px-1 rounded text-xs mx-1">Monospace text</code> indicates system values, role keys, or code references.
          </p>

          {/* ══════════════════════════════════════════════════════════════
              SECTION 2 — GETTING STARTED
          ══════════════════════════════════════════════════════════════ */}
          <SectionHeading id="getting-started" number="2" title="Getting Started" />

          <SubHeading id="system-requirements" number="2.1" title="System Requirements" />
          <div className="overflow-x-auto my-4">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[#1a3a5c] text-white">
                  <th className="text-left px-4 py-3 font-semibold rounded-tl-lg">Requirement</th>
                  <th className="text-left px-4 py-3 font-semibold rounded-tr-lg">Specification</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Web Browser', 'Google Chrome 110+, Mozilla Firefox 110+, Microsoft Edge 110+, or Safari 16+'],
                  ['Internet Connection', 'Stable broadband connection (minimum 2 Mbps recommended)'],
                  ['Screen Resolution', 'Minimum 1280 × 720 pixels; 1920 × 1080 recommended'],
                  ['JavaScript', 'Must be enabled in the browser'],
                  ['Cookies', 'Must be enabled for session management'],
                  ['Mobile Devices', 'Supported on tablets and smartphones (responsive design)'],
                ].map(([req, spec], i) => (
                  <tr key={req} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-3 font-medium text-gray-800">{req}</td>
                    <td className="px-4 py-3 text-gray-700">{spec}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <SubHeading id="accessing-system" number="2.2" title="Accessing the System" />
          <p className="text-gray-700 mb-3">
            The ECSA-HC PMS is accessible via any modern web browser. Open your browser and navigate to:
          </p>
          <div className="bg-[#1a3a5c] text-white rounded-xl px-6 py-4 my-4 font-mono text-center text-lg font-bold tracking-wide">
            https://pms.ecsahc.int
          </div>
          <InfoBox type="note">
            If you cannot access the URL above, contact the ECSA-HC ICT Support team. Do not attempt to access
            the system through unofficial links or bookmarks that may be outdated.
          </InfoBox>

          <SubHeading id="login" number="2.3" title="Logging In" />
          <p className="text-gray-700 mb-4">
            All users must authenticate with their ECSA-HC email address and password before accessing the system.
          </p>
          <StepBox step={1} title="Open the Login Page">
            Navigate to <strong>https://pms.ecsahc.int</strong> in your browser. The login page will display
            the ECSA-HC logo and a sign-in form.
          </StepBox>
          <StepBox step={2} title="Enter Your Credentials">
            Type your <strong>ECSA-HC email address</strong> (e.g., <code className="bg-gray-100 px-1 rounded text-xs">yourname@ecsahc.org</code>) in
            the Email Address field, then enter your <strong>Password</strong>.
          </StepBox>
          <StepBox step={3} title="Click Sign In">
            Click the <strong>Sign In</strong> button. If your credentials are correct, you will be redirected
            to the Performance Dashboard.
          </StepBox>
          <StepBox step={4} title="First-Time Login">
            If this is your first login, the system may prompt you to <strong>change your password</strong>.
            Follow the on-screen instructions to set a new secure password.
          </StepBox>
          <InfoBox type="warning">
            If you enter incorrect credentials three or more times, your account may be temporarily locked.
            Contact the HR &amp; Admin Officer or ICT Support to unlock your account.
          </InfoBox>

          <SubHeading id="change-password" number="2.4" title="Changing Your Password" />
          <p className="text-gray-700 mb-3">
            To change your password, navigate to <strong>Change Password</strong> from your profile settings
            or follow the prompt on first login.
          </p>
          <ul className="list-disc list-inside text-gray-700 space-y-1 ml-4 mb-4">
            <li>Enter your <strong>current password</strong></li>
            <li>Enter a <strong>new password</strong> (minimum 8 characters, must include uppercase, lowercase, and a number)</li>
            <li>Confirm the new password and click <strong>Update Password</strong></li>
          </ul>
          <InfoBox type="tip">
            Choose a strong, unique password. Do not share your password with colleagues. The system uses
            secure, encrypted authentication managed by ECSA-HC's identity provider.
          </InfoBox>

          <SubHeading id="navigation" number="2.5" title="Navigating the Interface" />
          <p className="text-gray-700 mb-4">
            The ECSA-HC PMS uses a consistent layout across all screens. The main interface consists of:
          </p>
          <div className="grid sm:grid-cols-2 gap-4 my-4">
            {[
              {
                title: 'Left Sidebar',
                desc: 'The primary navigation panel. Contains all module links grouped by category: Performance, Development, Organisation, and Intelligence. Can be collapsed to icon-only view by clicking the collapse button.',
                icon: '◀',
              },
              {
                title: 'Top Header',
                desc: 'Displays the current module name, notification bell, and user profile. The notification bell shows pending actions requiring your attention.',
                icon: '▲',
              },
              {
                title: 'Main Content Area',
                desc: 'The central area where module content is displayed. Most modules use tabs to organise content into logical sections.',
                icon: '□',
              },
              {
                title: 'Breadcrumb Trail',
                desc: 'Shows your current location within the system hierarchy, allowing quick navigation back to parent sections.',
                icon: '›',
              },
            ].map((item) => (
              <div key={item.title} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                <p className="font-semibold text-[#1a3a5c] mb-2">{item.title}</p>
                <p className="text-sm text-gray-600">{item.desc}</p>
              </div>
            ))}
          </div>
          <InfoBox type="tip">
            On mobile devices, the sidebar is hidden by default. Tap the hamburger menu icon (☰) in the top-left
            corner to open the navigation drawer.
          </InfoBox>

          <SubHeading id="user-roles" number="2.6" title="User Roles & Access Levels" />
          <p className="text-gray-700 mb-4">
            The ECSA-HC PMS uses role-based access control. Each user is assigned a system role that determines
            which modules they can access and what actions they can perform. The following roles are defined:
          </p>
          <RoleTable />
          <InfoBox type="note">
            Role assignments are managed by the HR &amp; Admin Officer through the <strong>Permissions</strong> module.
            Contact HR if you believe your role assignment is incorrect or if you require additional access.
          </InfoBox>

          {/* ══════════════════════════════════════════════════════════════
              SECTION 3 — PERFORMANCE DASHBOARD
          ══════════════════════════════════════════════════════════════ */}
          <SectionHeading id="performance-dashboard" number="3" title="Performance Dashboard" />
          <p className="text-gray-700 mb-4">
            The Performance Dashboard is the home screen of the ECSA-HC PMS. It provides a live, real-time
            snapshot of organisational performance for the current quarter, aligned with the ECSA-HC Strategic
            Plan 2024–2034.
          </p>

          <SubHeading id="dashboard-overview" number="3.1" title="Dashboard Overview" />
          <p className="text-gray-700 mb-3">
            Upon logging in, users are directed to the Performance Dashboard. The dashboard is role-sensitive —
            the data and widgets displayed depend on your assigned role:
          </p>
          <ul className="list-disc list-inside text-gray-700 space-y-1 ml-4 mb-4">
            <li><strong>Director General / Deputy Director</strong> — Organisation-wide view across all directorates</li>
            <li><strong>Programme / Finance Manager</strong> — Directorate-scoped view for their team</li>
            <li><strong>HR &amp; Admin Officer</strong> — Full staff performance overview with management tools</li>
            <li><strong>Staff Members</strong> — Personal performance summary and pending actions</li>
          </ul>
          <InfoBox type="info">
            The <strong>"Live"</strong> indicator in the top-right corner of the dashboard confirms that data
            is being refreshed in real time via Supabase Realtime subscriptions.
          </InfoBox>

          <SubHeading id="kpi-cards" number="3.2" title="KPI Metric Cards" />
          <p className="text-gray-700 mb-3">
            The metric strip at the top of the dashboard displays aggregate performance indicators:
          </p>
          <div className="overflow-x-auto my-4">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[#1a3a5c] text-white">
                  <th className="text-left px-4 py-3 font-semibold rounded-tl-lg">Metric</th>
                  <th className="text-left px-4 py-3 font-semibold">Description</th>
                  <th className="text-left px-4 py-3 font-semibold rounded-tr-lg">Colour Coding</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Total Reviews', 'Total number of appraisal records across all periods', 'Neutral (grey)'],
                  ['Submitted', 'Reviews submitted by staff members', 'Sky blue — submission rate shown as %'],
                  ['Approved', 'Reviews fully approved by managers', 'Emerald green'],
                  ['Avg Supervisor Rating', 'Average rating given by supervisors (out of 5)', 'Violet'],
                  ['Active Staff', 'Total staff members currently in the system', 'Teal'],
                  ['Pending', 'Reviews awaiting action', 'Amber — requires attention'],
                ].map(([metric, desc, color], i) => (
                  <tr key={metric} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-3 font-medium text-gray-800">{metric}</td>
                    <td className="px-4 py-3 text-gray-700">{desc}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{color}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <InfoBox type="tip">
            Click any KPI metric card to open the <strong>Staff Drill-Down Modal</strong>, which filters staff
            by that metric and shows individual scores. This is useful for identifying specific staff who need support.
          </InfoBox>

          <SubHeading id="bsc-chart" number="3.3" title="BSC Perspective Chart" />
          <p className="text-gray-700 mb-3">
            The Balanced Scorecard (BSC) chart visualises performance across the four BSC perspectives for the
            current fiscal year:
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
            {[
              { label: 'Financial', color: 'bg-emerald-50 border-emerald-300 text-emerald-800' },
              { label: 'Customer', color: 'bg-blue-50 border-blue-300 text-blue-800' },
              { label: 'Internal Processes', color: 'bg-violet-50 border-violet-300 text-violet-800' },
              { label: 'Learning & Growth', color: 'bg-amber-50 border-amber-300 text-amber-800' },
            ].map((p) => (
              <div key={p.label} className={`border-2 rounded-xl p-3 text-center text-sm font-semibold ${p.color}`}>
                {p.label}
              </div>
            ))}
          </div>
          <p className="text-gray-700 mb-3">
            Hover over chart segments to see exact scores and targets. The chart updates in real time as new
            evaluation data is submitted and approved.
          </p>

          <SubHeading id="kpi-trend" number="3.4" title="KPI Trend Chart" />
          <p className="text-gray-700 mb-3">
            The KPI Trend Chart shows month-by-month performance trends over the selected period. Use this chart
            to identify seasonal patterns, the impact of training interventions, or performance dips that require
            management attention.
          </p>

          <SubHeading id="at-risk" number="3.5" title="At-Risk Staff Table" />
          <p className="text-gray-700 mb-3">
            The At-Risk Staff Table lists staff members whose performance scores fall below the defined threshold,
            requiring immediate managerial attention. Columns include:
          </p>
          <ul className="list-disc list-inside text-gray-700 space-y-1 ml-4 mb-4">
            <li>Staff name and directorate</li>
            <li>Current performance score</li>
            <li>Last review date</li>
            <li>Recommended action</li>
          </ul>
          <InfoBox type="warning">
            Staff appearing in the At-Risk table should be contacted by their supervisor within 5 working days
            to discuss a performance improvement plan.
          </InfoBox>

          <SubHeading id="strategic-plan" number="3.6" title="Strategic Plan Section" />
          <p className="text-gray-700 mb-3">
            The Strategic Plan Section displays the full <strong>ECSA-HC Strategic Plan 2024–2034</strong>,
            including Vision, Mission, Core Values, Five Strategic Pillars, and Nine Strategic Objectives.
          </p>
          <ul className="list-disc list-inside text-gray-700 space-y-1 ml-4 mb-4">
            <li>Click any <strong>Strategic Objective card</strong> to expand it and view its KPIs, cluster ownership, and timeline</li>
            <li>Colour-coded cluster badges identify which directorate owns each objective (CHS, HSCD, FHID, MNFSN, KMME, DOF/BDU, DG/DOID)</li>
            <li>The <strong>Implementation &amp; M&amp;E Framework</strong> panel shows the five-level planning cascade from monthly meetings (L1) to the 10-year strategic plan (L5)</li>
          </ul>

          {/* ══════════════════════════════════════════════════════════════
              SECTION 4 — EVALUATION & REVIEWS
          ══════════════════════════════════════════════════════════════ */}
          <SectionHeading id="evaluation-reviews" number="4" title="Evaluation & Reviews" />
          <p className="text-gray-700 mb-4">
            The Evaluation &amp; Reviews module manages the full appraisal lifecycle for all staff members.
            It covers workplan setup, self-evaluations, supervisor reviews, side-by-side comparisons, and
            final approvals.
          </p>

          <SubHeading id="eval-overview" number="4.1" title="Module Overview" />
          <p className="text-gray-700 mb-3">The appraisal lifecycle follows this structured workflow:</p>
          <WorkflowDiagram />
          <p className="text-gray-700 mb-3">
            The module has two main tabs: <strong>Overview</strong> (for HR and managers) and
            <strong> Supervisor Review</strong> (for reviewing submitted evaluations).
          </p>

          <SubHeading id="workplan-setup" number="4.2" title="Workplan Setup" />
          <p className="text-gray-700 mb-3">
            Before evaluations begin, HR sets up the workplan for each review period using the
            <strong> Workplan Settings</strong> form. This is accessible from the <strong>Overview</strong> tab.
          </p>
          <StepBox step={1} title="Open Workplan Settings">
            Navigate to <strong>Evaluation &amp; Reviews</strong> → <strong>Overview</strong> tab →
            click <strong>Workplan Settings</strong>.
          </StepBox>
          <StepBox step={2} title="Select Staff Member and Fiscal Year">
            Choose the staff member and the fiscal year for which the workplan is being set up.
            If a workplan already exists, it will load automatically.
          </StepBox>
          <StepBox step={3} title="Configure KPIs and Weights">
            Add KPIs relevant to the staff member's role. Assign weights to each KPI (total must equal 100%).
            Set competency weights and the review period dates.
          </StepBox>
          <StepBox step={4} title="Save the Workplan">
            Click <strong>Save Workplan</strong>. The workplan status will be set to <em>Draft</em>.
            The staff member can now begin their self-assessment.
          </StepBox>
          <InfoBox type="note">
            Workplan stages progress in order: <strong>Draft → Submitted → Mid-Year Approved → Annual Review → Completed</strong>.
            Each stage must be completed before advancing to the next.
          </InfoBox>

          <SubHeading id="review-table" number="4.3" title="Review Table" />
          <p className="text-gray-700 mb-3">
            The Review Table lists all staff evaluations with the following columns:
          </p>
          <ul className="list-disc list-inside text-gray-700 space-y-1 ml-4 mb-4">
            <li>Staff name, directorate, and review period</li>
            <li>Status (Submitted / Reviewed / Approved / Rejected)</li>
            <li>Self-rating and supervisor rating</li>
            <li>Action icons: 👁 View details, ⚖ Open comparison modal, 🖨 Print appraisal</li>
          </ul>
          <p className="text-gray-700 mb-3">
            Use the filter bar to narrow results by status, review period, or staff name.
          </p>

          <SubHeading id="evaluation-form" number="4.4" title="Evaluation Form" />
          <p className="text-gray-700 mb-3">
            The Evaluation Form captures KPI scores, competency ratings, and overall comments for a staff member.
          </p>
          <ul className="list-disc list-inside text-gray-700 space-y-1 ml-4 mb-4">
            <li>KPIs are weighted; the system auto-calculates the weighted average score</li>
            <li>Supervisors can add narrative comments for each KPI</li>
            <li>An overall performance summary field is provided at the bottom</li>
          </ul>

          <SubHeading id="comparison-modal" number="4.5" title="Evaluation Comparison Modal" />
          <p className="text-gray-700 mb-3">
            Open via the <strong>⚖</strong> icon on any Submitted, Reviewed, or Approved evaluation row.
            The modal has three tabs:
          </p>
          <div className="overflow-x-auto my-4">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[#1a3a5c] text-white">
                  <th className="text-left px-4 py-3 font-semibold rounded-tl-lg">Tab</th>
                  <th className="text-left px-4 py-3 font-semibold rounded-tr-lg">Content</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['KPI Comparison', 'Staff self-rating vs supervisor rating per KPI, with a variance badge showing the difference'],
                  ['Competency Comparison', 'All 5 general competencies shown side-by-side (self vs supervisor)'],
                  ['Overall Feedback', 'Narrative comments from both staff and supervisor, plus approval/rejection controls'],
                ].map(([tab, content], i) => (
                  <tr key={tab} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-3 font-medium text-gray-800">{tab}</td>
                    <td className="px-4 py-3 text-gray-700">{content}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <InfoBox type="tip">
            Use the variance badge to identify KPIs where self-perception differs significantly from supervisor
            assessment — these are ideal coaching conversation starters.
          </InfoBox>
          <InfoBox type="warning">
            Both <strong>Approve</strong> and <strong>Reject</strong> actions have a two-step confirmation guard
            to prevent accidental decisions. A rejection requires a written reason.
          </InfoBox>

          <SubHeading id="print-appraisal" number="4.6" title="Print Appraisal Layout" />
          <p className="text-gray-700 mb-3">
            The Print Appraisal Layout generates a formatted, print-ready view of the full appraisal record,
            including staff details, all KPI scores, competency ratings, narrative comments, and approval signatures.
          </p>
          <StepBox step={1} title="Open Print Layout">
            Click the <strong>🖨</strong> icon on any evaluation row in the Review Table.
          </StepBox>
          <StepBox step={2} title="Print or Save as PDF">
            Use your browser's Print function (<strong>Ctrl+P</strong> on Windows / <strong>Cmd+P</strong> on Mac)
            to print or save as PDF.
          </StepBox>

          <SubHeading id="workplan-list" number="4.7" title="Workplan List View" />
          <p className="text-gray-700 mb-3">
            The Workplan List View is displayed on the Overview tab and shows all workplans grouped by fiscal year
            in collapsible accordion panels.
          </p>
          <ul className="list-disc list-inside text-gray-700 space-y-1 ml-4 mb-4">
            <li>Click a <strong>fiscal year panel</strong> to expand it — data loads on demand</li>
            <li>Filter by Status or Stage using the dropdowns at the top of each panel</li>
            <li>Click <strong>Open</strong> on any row to view the full workplan form</li>
            <li>Staff members only see their own workplan; managers see their direct reports</li>
          </ul>

          {/* ══════════════════════════════════════════════════════════════
              SECTION 5 — SELF-ASSESSMENT
          ══════════════════════════════════════════════════════════════ */}
          <SectionHeading id="self-assessment" number="5" title="Self-Assessment" />
          <p className="text-gray-700 mb-4">
            The Self-Assessment module allows staff members to complete their own performance evaluation through
            a guided 6-step wizard. This is the first step in the appraisal lifecycle.
          </p>

          <SubHeading id="sa-overview" number="5.1" title="Self-Assessment Wizard Overview" />
          <p className="text-gray-700 mb-3">
            The wizard guides you through six sequential steps. Progress is shown in the step indicator at the
            top of the page. You can navigate back to previous steps to review or edit before submitting.
          </p>
          <div className="flex flex-wrap gap-2 my-4">
            {[
              'Select Workplan',
              'KPI Assessment',
              'General Competencies',
              'Objectives & Goals',
              'Overall Reflection',
              'Sign & Submit',
            ].map((step, i) => (
              <div key={step} className="flex items-center gap-1.5">
                <div className="w-7 h-7 rounded-full bg-[#1a3a5c] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {i + 1}
                </div>
                <span className="text-sm font-medium text-gray-700">{step}</span>
                {i < 5 && <span className="text-gray-400 mx-1">→</span>}
              </div>
            ))}
          </div>

          <SubHeading id="sa-step1" number="5.2" title="Step 1 – Select Workplan" />
          <p className="text-gray-700 mb-3">
            Choose the active workplan for the review period you are assessing. Only workplans in the correct
            workflow stage will be available for selection. If no workplan appears, contact HR to ensure your
            workplan has been set up.
          </p>

          <SubHeading id="sa-step2" number="5.3" title="Step 2 – KPI Assessment" />
          <p className="text-gray-700 mb-3">
            Rate your performance on each assigned KPI using the <strong>1–5 scale</strong>:
          </p>
          <div className="overflow-x-auto my-4">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[#1a3a5c] text-white">
                  <th className="text-center px-4 py-3 font-semibold rounded-tl-lg w-16">Rating</th>
                  <th className="text-left px-4 py-3 font-semibold rounded-tr-lg">Performance Level</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['1', 'Far Below Expectations — Performance significantly below required standard'],
                  ['2', 'Below Expectations — Performance partially meets required standard'],
                  ['3', 'Meets Expectations — Performance fully meets required standard'],
                  ['4', 'Exceeds Expectations — Performance consistently above required standard'],
                  ['5', 'Exceptional — Outstanding performance, significantly exceeds all expectations'],
                ].map(([rating, desc], i) => (
                  <tr key={rating} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-3 text-center font-bold text-[#1a3a5c]">{rating}</td>
                    <td className="px-4 py-3 text-gray-700">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-gray-700 mb-3">
            For each KPI, provide an <strong>achievement description</strong> explaining what you accomplished,
            and add <strong>narrative comments</strong> to give context or highlight challenges.
          </p>

          <SubHeading id="sa-step3" number="5.4" title="Step 3 – General Competencies" />
          <p className="text-gray-700 mb-3">
            Rate yourself on the five general competencies using the same 1–5 scale:
          </p>
          <ul className="list-disc list-inside text-gray-700 space-y-1 ml-4 mb-4">
            <li><strong>Communication</strong> — Clarity, effectiveness, and appropriateness of communication</li>
            <li><strong>Teamwork</strong> — Collaboration, cooperation, and contribution to team goals</li>
            <li><strong>Initiative</strong> — Proactiveness, problem-solving, and self-direction</li>
            <li><strong>Leadership</strong> — Guidance, motivation, and influence on others</li>
            <li><strong>Professionalism</strong> — Conduct, ethics, and adherence to organisational values</li>
          </ul>

          <SubHeading id="sa-step4" number="5.5" title="Step 4 – Objectives & Goals" />
          <p className="text-gray-700 mb-3">
            For each objective, select the achievement status and enter a completion percentage:
          </p>
          <ul className="list-disc list-inside text-gray-700 space-y-1 ml-4 mb-4">
            <li><strong>Fully Achieved</strong> — Objective completed as planned</li>
            <li><strong>Partially Achieved</strong> — Objective partially completed; explain progress</li>
            <li><strong>Not Achieved</strong> — Objective not completed; explain reasons and support needed</li>
          </ul>
          <p className="text-gray-700 mb-3">
            Enter a completion percentage (0–100%) and use the visual progress bar to confirm. Add narrative
            comments explaining progress, obstacles, and support needed.
          </p>

          <SubHeading id="sa-step5" number="5.6" title="Step 5 – Overall Reflection" />
          <p className="text-gray-700 mb-3">
            Write a free-text overall reflection summarising your performance for the period. Include:
          </p>
          <ul className="list-disc list-inside text-gray-700 space-y-1 ml-4 mb-4">
            <li>Key achievements and successes</li>
            <li>Challenges faced and how they were addressed</li>
            <li>Lessons learned</li>
            <li>Development needs and training requests for the next period</li>
          </ul>

          <SubHeading id="sa-step6" number="5.7" title="Step 6 – Sign & Submit" />
          <p className="text-gray-700 mb-3">
            The final step presents a summary of all your ratings for review before submission.
          </p>
          <StepBox step={1} title="Review Your Summary">
            Check all ratings and comments. Use the Back button to return to any step if corrections are needed.
          </StepBox>
          <StepBox step={2} title="Tick the Declaration">
            Tick the declaration checkbox to confirm that the information provided is accurate and complete.
          </StepBox>
          <StepBox step={3} title="Click Submit">
            Click <strong>Submit</strong> to send your self-assessment to your manager for review. The workplan
            workflow stage will advance automatically.
          </StepBox>
          <InfoBox type="warning">
            Once submitted, you cannot edit your self-assessment. Contact HR if corrections are needed after submission.
          </InfoBox>

          {/* ══════════════════════════════════════════════════════════════
              SECTION 6 — MANAGER REVIEW
          ══════════════════════════════════════════════════════════════ */}
          <SectionHeading id="manager-review" number="6" title="Manager Review" />
          <p className="text-gray-700 mb-4">
            The Manager Review module allows supervisors and managers to review submitted staff self-assessments,
            provide ratings and feedback, and make approval decisions.
          </p>

          <SubHeading id="mr-overview" number="6.1" title="Review Table" />
          <p className="text-gray-700 mb-3">
            The Manager Review screen lists all staff self-assessments submitted to you for review. Filter by
            status, review period, or search by staff name. Click the <strong>View</strong> icon on any row to
            open the Review Detail Modal.
          </p>

          <SubHeading id="mr-staff-tab" number="6.2" title="Staff Self-Assessment Tab" />
          <p className="text-gray-700 mb-3">
            The first tab of the Review Detail Modal shows a read-only view of the staff member's self-assessment:
            KPI ratings, competency scores, objectives, challenges, and overall reflection. Use this tab to
            understand the staff member's perspective before entering your own ratings.
          </p>

          <SubHeading id="mr-rating-tab" number="6.3" title="Manager Rating & Feedback Tab" />
          <p className="text-gray-700 mb-3">
            The second tab is where you enter your assessment:
          </p>
          <ul className="list-disc list-inside text-gray-700 space-y-1 ml-4 mb-4">
            <li>Enter your rating (1–5) for each KPI and competency</li>
            <li>Add narrative feedback in the text areas provided</li>
            <li>Write approval comments (required for Approve) or a rejection reason (required for Reject)</li>
          </ul>

          <SubHeading id="mr-approve" number="6.4" title="Approving or Rejecting a Review" />
          <div className="grid sm:grid-cols-2 gap-4 my-4">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <p className="font-semibold text-green-800 mb-2">✅ Approve</p>
              <ul className="text-sm text-green-700 space-y-1 list-disc list-inside">
                <li>Advances the workplan stage to <em>mid_year_approved</em></li>
                <li>Requires approval comments</li>
                <li>Two-step confirmation guard</li>
                <li>Staff member is notified</li>
              </ul>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="font-semibold text-red-800 mb-2">❌ Reject</p>
              <ul className="text-sm text-red-700 space-y-1 list-disc list-inside">
                <li>Sets status to <em>Rejected</em></li>
                <li>Requires a written rejection reason</li>
                <li>Two-step confirmation guard</li>
                <li>Staff member is notified with the reason</li>
              </ul>
            </div>
          </div>
          <InfoBox type="tip">
            Use <strong>Save Review</strong> to save your feedback without making a final decision. This marks
            the record as <em>Reviewed</em> and allows you to return later to complete the approval.
          </InfoBox>

          {/* ══════════════════════════════════════════════════════════════
              SECTION 7 — MID-YEAR REVIEWS
          ══════════════════════════════════════════════════════════════ */}
          <SectionHeading id="mid-year-reviews" number="7" title="Mid-Year Reviews" />

          <SubHeading id="myr-overview" number="7.1" title="Module Overview" />
          <p className="text-gray-700 mb-3">
            The Mid-Year Reviews module provides a consolidated view of all mid-year appraisal records across
            all staff and directorates. Records are linked to workplan settings and track the full workflow
            from submission to final approval. Use this module to monitor review completion rates and identify
            outstanding submissions.
          </p>

          <SubHeading id="myr-statuses" number="7.2" title="Review Statuses Explained" />
          <div className="overflow-x-auto my-4">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[#1a3a5c] text-white">
                  <th className="text-left px-4 py-3 font-semibold rounded-tl-lg">Status</th>
                  <th className="text-left px-4 py-3 font-semibold rounded-tr-lg">Meaning</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Draft', 'The workplan is set up but the staff member has not yet submitted their self-assessment'],
                  ['Submitted', 'The staff member has completed and submitted their self-assessment'],
                  ['Reviewed', 'The manager has saved feedback but not yet made a final decision'],
                  ['Approved', 'The manager has approved the evaluation; the workflow advances to the next stage'],
                  ['Rejected', 'The manager has rejected the evaluation with a written reason; staff must resubmit'],
                ].map(([status, meaning], i) => (
                  <tr key={status} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                        status === 'Approved' ? 'bg-green-100 text-green-800' :
                        status === 'Rejected' ? 'bg-red-100 text-red-800' :
                        status === 'Submitted' ? 'bg-blue-100 text-blue-800' :
                        status === 'Reviewed'? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700'
                      }`}>{status}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ══════════════════════════════════════════════════════════════
              SECTION 8 — FEEDBACK & MENTORSHIP
          ══════════════════════════════════════════════════════════════ */}
          <SectionHeading id="feedback-mentorship" number="8" title="Feedback & Mentorship" />
          <p className="text-gray-700 mb-4">
            The Feedback &amp; Mentorship module facilitates structured feedback exchange, mentorship relationships,
            and peer knowledge-sharing among ECSA-HC staff.
          </p>

          <SubHeading id="fm-feed" number="8.1" title="Feedback Feed" />
          <p className="text-gray-700 mb-3">
            The Feedback Feed shows all feedback you have received and given, in chronological order. Each entry
            includes the sender, date, category, and message. Categories include:
          </p>
          <ul className="list-disc list-inside text-gray-700 space-y-1 ml-4 mb-4">
            <li><strong>Commendation</strong> — Positive recognition for good work</li>
            <li><strong>Developmental</strong> — Constructive feedback for improvement</li>
            <li><strong>Peer</strong> — Feedback from colleagues at the same level</li>
          </ul>

          <SubHeading id="fm-give" number="8.2" title="Giving Feedback" />
          <StepBox step={1} title="Open the Give Feedback Modal">
            Click the <strong>Give Feedback</strong> button on the Feedback &amp; Mentorship page.
          </StepBox>
          <StepBox step={2} title="Select Recipient and Category">
            Choose the staff member you are giving feedback to, and select the appropriate feedback category.
          </StepBox>
          <StepBox step={3} title="Write Your Message">
            Write your feedback message. Be specific, constructive, and professional.
          </StepBox>
          <StepBox step={4} title="Submit">
            Click <strong>Submit Feedback</strong>. The recipient will be notified.
          </StepBox>
          <InfoBox type="note">
            Feedback can be sent anonymously if this option has been enabled by your administrator.
          </InfoBox>

          <SubHeading id="fm-mentor" number="8.3" title="Mentor Directory" />
          <p className="text-gray-700 mb-3">
            Browse available mentors by expertise area, directorate, or availability. Click
            <strong> Request Mentorship</strong> on a mentor profile to initiate a mentorship relationship.
            The mentor will receive a notification and can accept or decline the request.
          </p>

          <SubHeading id="fm-sessions" number="8.4" title="Upcoming Sessions Panel" />
          <p className="text-gray-700 mb-3">
            View all scheduled mentorship and peer exchange sessions. Sessions show the date, time, participants,
            and topic. Click a session to view details or join a virtual meeting link if provided.
          </p>

          <SubHeading id="fm-peer" number="8.5" title="Peer Exchange Panel" />
          <p className="text-gray-700 mb-3">
            The Peer Exchange Panel facilitates structured knowledge-sharing between colleagues. Post a topic
            for discussion or respond to existing peer exchange threads. This is a collaborative space for
            sharing best practices, lessons learned, and professional insights.
          </p>

          {/* ══════════════════════════════════════════════════════════════
              SECTION 9 — TRAINING & RESOURCES
          ══════════════════════════════════════════════════════════════ */}
          <SectionHeading id="training-resources" number="9" title="Training & Resources" />
          <p className="text-gray-700 mb-4">
            The Training &amp; Resources module provides access to training programmes, CPD tracking,
            professional certifications, and HR guidance documents.
          </p>

          <SubHeading id="tr-catalog" number="9.1" title="Training Catalog" />
          <p className="text-gray-700 mb-3">
            Browse available training programmes by category, delivery mode, and duration.
          </p>
          <ul className="list-disc list-inside text-gray-700 space-y-1 ml-4 mb-4">
            <li><strong>Online</strong> — Self-paced e-learning modules</li>
            <li><strong>In-Person</strong> — Classroom or workshop-based training</li>
            <li><strong>Blended</strong> — Combination of online and in-person components</li>
          </ul>
          <p className="text-gray-700 mb-3">
            Click <strong>Enrol</strong> to register for a training programme. Your enrolment will appear in
            your CPD Progress table.
          </p>

          <SubHeading id="tr-cpd" number="9.2" title="CPD Progress Table" />
          <p className="text-gray-700 mb-3">
            The CPD (Continuing Professional Development) Progress Table tracks your CPD hours and activities
            for the current year. Columns include activity name, category, hours, completion date, and CPD
            points earned. The progress bar at the top shows your total CPD hours against the annual target.
          </p>

          <SubHeading id="tr-cert" number="9.3" title="Certification Tracker" />
          <p className="text-gray-700 mb-3">
            Lists all professional certifications held by the staff member, including issue date, expiry date,
            and renewal status.
          </p>
          <ul className="list-disc list-inside text-gray-700 space-y-1 ml-4 mb-4">
            <li><strong>Amber highlight</strong> — Certificate approaching expiry (within 90 days)</li>
            <li><strong>Red highlight</strong> — Certificate expired; renewal required</li>
          </ul>

          <SubHeading id="tr-docs" number="9.4" title="Guidance Documents" />
          <p className="text-gray-700 mb-3">
            A library of HR policies, performance management guidelines, and reference documents. Documents
            can be downloaded as PDF or viewed in-browser. Use the search bar to find documents by title or keyword.
          </p>

          {/* ══════════════════════════════════════════════════════════════
              SECTION 10 — STAFF MANAGEMENT
          ══════════════════════════════════════════════════════════════ */}
          <SectionHeading id="staff-management" number="10" title="Staff Management" />
          <p className="text-gray-700 mb-4">
            The Staff Management module is used by HR &amp; Admin Officers to manage staff profiles, directorate
            assignments, and employment records. Access is restricted to HR Administrators and above.
          </p>

          <SubHeading id="sm-directory" number="10.1" title="Staff Directory" />
          <p className="text-gray-700 mb-3">
            The Staff Directory displays all staff members with their name, job title, directorate, cluster,
            and employment status. Search by name or filter by directorate, cluster, or status to find specific
            staff. Click a staff record to view or edit their full profile.
          </p>

          <SubHeading id="sm-add-edit" number="10.2" title="Adding & Editing Staff" />
          <StepBox step={1} title="Click Add Staff">
            Click the <strong>Add Staff</strong> button in the top-right corner of the Staff Directory.
          </StepBox>
          <StepBox step={2} title="Fill in Required Fields">
            Complete all required fields: Full Name, Job Title, Directorate, Cluster, Employment Type, and Start Date.
          </StepBox>
          <StepBox step={3} title="Fill in Optional Fields">
            Optionally add: Email address, Phone number, Supervisor assignment, and Profile Photo.
          </StepBox>
          <StepBox step={4} title="Save the Record">
            Click <strong>Save</strong>. The new staff member will appear in the directory immediately.
          </StepBox>
          <p className="text-gray-700 mt-3 mb-3">
            To edit an existing staff record, click the <strong>Edit</strong> icon on the staff row, make your
            changes, and click <strong>Save</strong>.
          </p>

          <SubHeading id="sm-directorates" number="10.3" title="Directorates & Clusters" />
          <p className="text-gray-700 mb-3">
            Staff are organised by Directorate and Cluster, reflecting the ECSA-HC organisational structure:
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 my-4">
            {['CHS', 'HSCD', 'FHID', 'MNFSN', 'KMME', 'DOF/BDU', 'DG/DOID', 'Secretariat'].map((d) => (
              <div key={d} className="bg-[#1a3a5c]/10 border border-[#1a3a5c]/20 rounded-lg px-3 py-2 text-center text-sm font-semibold text-[#1a3a5c]">
                {d}
              </div>
            ))}
          </div>
          <p className="text-gray-700 mb-3">
            Cluster assignments determine which KPIs and strategic objectives are relevant to each staff member.
          </p>

          <SubHeading id="sm-import" number="10.4" title="Staff Import" />
          <p className="text-gray-700 mb-3">
            The Staff Import feature allows bulk upload of staff records from a CSV or Excel file. Navigate to
            <strong> Staff Import</strong> from the sidebar (visible to HR Administrators only).
          </p>
          <ul className="list-disc list-inside text-gray-700 space-y-1 ml-4 mb-4">
            <li>Download the import template to ensure correct column formatting</li>
            <li>Fill in staff data in the template</li>
            <li>Upload the completed file and review the preview</li>
            <li>Click <strong>Import</strong> to process the records</li>
          </ul>
          <InfoBox type="warning">
            Duplicate email addresses will be flagged during import. Resolve duplicates before proceeding.
          </InfoBox>

          {/* ══════════════════════════════════════════════════════════════
              SECTION 11 — ANALYTICS & REPORTS
          ══════════════════════════════════════════════════════════════ */}
          <SectionHeading id="analytics-reports" number="11" title="Analytics & Reports" />
          <p className="text-gray-700 mb-4">
            The Analytics &amp; Reports module provides organisation-wide performance analytics, external
            framework tracking, and data export tools. Access is restricted to managers and above.
          </p>
          <p className="text-gray-700 mb-4">The module is organised into five tabs:</p>
          <div className="flex flex-wrap gap-2 mb-6">
            {['Overview', 'External Frameworks', 'BSC Scorecard', 'Export Reports', 'Data Quality'].map((tab) => (
              <span key={tab} className="bg-[#1a3a5c]/10 text-[#1a3a5c] border border-[#1a3a5c]/20 rounded-lg px-3 py-1.5 text-sm font-semibold">
                {tab}
              </span>
            ))}
          </div>

          <SubHeading id="ar-kpi" number="11.1" title="KPI Year-on-Year Chart" />
          <p className="text-gray-700 mb-3">
            Compares KPI performance across multiple fiscal years to identify long-term trends. Use the year
            selector to choose which years to compare. Hover over data points for exact values.
          </p>

          <SubHeading id="ar-bsc" number="11.2" title="BSC Scorecard Matrix" />
          <p className="text-gray-700 mb-3">
            A matrix view of Balanced Scorecard performance across all directorates and perspectives. Cells
            are colour-coded:
          </p>
          <div className="flex flex-wrap gap-3 my-3">
            {[
              { label: '≥80% — On Track', color: 'bg-green-100 border-green-400 text-green-800' },
              { label: '60–79% — Needs Attention', color: 'bg-amber-100 border-amber-400 text-amber-800' },
              { label: '<60% — At Risk', color: 'bg-red-100 border-red-400 text-red-800' },
            ].map((item) => (
              <div key={item.label} className={`border-2 rounded-lg px-3 py-1.5 text-sm font-semibold ${item.color}`}>
                {item.label}
              </div>
            ))}
          </div>
          <p className="text-gray-700 mb-3">Click a cell to drill down into the underlying KPI data.</p>

          <SubHeading id="ar-jeesp" number="11.3" title="JEESP-AR Chart" />
          <p className="text-gray-700 mb-3">
            Tracks performance against the <strong>Joint External Evaluation of State Party Abilities for
            Reporting (JEESP-AR)</strong> framework indicators. Shows progress scores for each technical area
            assessed, enabling ECSA-HC to monitor compliance with international health security standards.
          </p>

          <SubHeading id="ar-heprr" number="11.4" title="HEPRR Progress Chart" />
          <p className="text-gray-700 mb-3">
            Monitors progress on <strong>Health Emergency Preparedness, Response, and Resilience (HEPRR)</strong>
            indicators. Displays current scores against targets for each HEPRR domain.
          </p>

          <SubHeading id="ar-wbn" number="11.5" title="WBN-o-Pipeline Table" />
          <p className="text-gray-700 mb-3">
            Lists World Bank No-Pipeline projects and their performance status. Columns include project name,
            directorate, budget, disbursement rate, and current status.
          </p>

          <SubHeading id="ar-export" number="11.6" title="Reports Export Panel" />
          <p className="text-gray-700 mb-3">
            Generate and download reports in Excel (.xlsx) or PDF format.
          </p>
          <div className="overflow-x-auto my-4">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[#1a3a5c] text-white">
                  <th className="text-left px-4 py-3 font-semibold rounded-tl-lg">Report Type</th>
                  <th className="text-left px-4 py-3 font-semibold rounded-tr-lg">Description</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Staff Performance Summary', 'Individual staff performance scores across all KPIs and competencies'],
                  ['Directorate Scorecard', 'Aggregated BSC scores by directorate for the selected period'],
                  ['KPI Trend Report', 'Month-by-month KPI performance trends for the selected fiscal year'],
                  ['Evaluation Completion Report', 'Submission and approval rates by directorate and review period'],
                ].map(([type, desc], i) => (
                  <tr key={type} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-3 font-medium text-gray-800">{type}</td>
                    <td className="px-4 py-3 text-gray-700">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <StepBox step={1} title="Select Report Parameters">
            Choose the report type, date range, and directorate filter from the Export Reports tab.
          </StepBox>
          <StepBox step={2} title="Generate Report">
            Click <strong>Generate Report</strong>. The system will process the data.
          </StepBox>
          <StepBox step={3} title="Download">
            Once generated, click <strong>Download</strong> to save the file to your computer.
          </StepBox>
          <InfoBox type="tip">
            Large reports may take a few seconds to generate. Do not close the browser tab while the download
            is in progress.
          </InfoBox>

          {/* ══════════════════════════════════════════════════════════════
              SECTION 12 — PERMISSIONS
          ══════════════════════════════════════════════════════════════ */}
          <SectionHeading id="permissions" number="12" title="Permissions" />
          <p className="text-gray-700 mb-4">
            The Permissions module allows HR Administrators and System Administrators to manage user roles
            and module access levels across the system.
          </p>

          <SubHeading id="perm-roles" number="12.1" title="Roles Overview" />
          <p className="text-gray-700 mb-3">
            The system has nine built-in roles (see Section 2.6 for the full role table). Each role has a
            predefined set of module access permissions that can be customised through the Permission Matrix.
          </p>

          <SubHeading id="perm-assign" number="12.2" title="Assigning Roles" />
          <StepBox step={1} title="Find the User">
            Navigate to <strong>Permissions</strong> in the sidebar. Search for the user by name or email.
          </StepBox>
          <StepBox step={2} title="Select the Role">
            Click on the user's current role badge to open the role selector dropdown.
          </StepBox>
          <StepBox step={3} title="Assign the New Role">
            Select the desired role and click <strong>Assign Role</strong>. The change takes effect immediately
            on the user's next page load.
          </StepBox>
          <InfoBox type="warning">
            Role changes are logged in the Appraisal Audit Trail. Always document the reason for role changes
            in the comments field.
          </InfoBox>

          <SubHeading id="perm-matrix" number="12.3" title="Module Permission Matrix" />
          <p className="text-gray-700 mb-3">
            The Permission Matrix table shows access levels for each role across all system modules. Each
            module can be configured with the following permissions per role:
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 my-4">
            {[
              { label: 'View', color: 'bg-blue-100 text-blue-800' },
              { label: 'Create', color: 'bg-emerald-100 text-emerald-800' },
              { label: 'Edit', color: 'bg-amber-100 text-amber-800' },
              { label: 'Delete', color: 'bg-red-100 text-red-800' },
              { label: 'Approve', color: 'bg-violet-100 text-violet-800' },
            ].map((p) => (
              <div key={p.label} className={`rounded-lg px-3 py-2 text-center text-sm font-semibold ${p.color}`}>
                {p.label}
              </div>
            ))}
          </div>
          <p className="text-gray-700 mb-3">
            Changes to module permissions apply to all users with that role. Use the toggle switches in the
            matrix to enable or disable specific permissions.
          </p>
          <InfoBox type="tip">
            Always test permission changes with a non-admin account before rolling out to all users.
          </InfoBox>

          {/* ══════════════════════════════════════════════════════════════
              SECTION 13 — ADMIN DASHBOARD
          ══════════════════════════════════════════════════════════════ */}
          <SectionHeading id="admin-dashboard" number="13" title="Admin Dashboard" />

          <SubHeading id="admin-overview" number="13.1" title="Admin Overview" />
          <p className="text-gray-700 mb-3">
            The Admin Dashboard provides system administrators and HR Officers with a high-level operational
            view of the PMS, including user activity, system performance metrics, and pending administrative
            actions. Access is restricted to HR Administrators and System Administrators.
          </p>

          <SubHeading id="admin-audit" number="13.2" title="Appraisal Audit Trail" />
          <p className="text-gray-700 mb-3">
            The Appraisal Audit Trail records all significant actions taken within the system, providing a
            complete, tamper-evident log for compliance and governance purposes. The audit trail captures:
          </p>
          <ul className="list-disc list-inside text-gray-700 space-y-1 ml-4 mb-4">
            <li>User login and logout events</li>
            <li>Workplan creation, modification, and deletion</li>
            <li>Self-assessment submissions</li>
            <li>Manager review actions (Save, Approve, Reject)</li>
            <li>Role and permission changes</li>
            <li>Staff record additions and edits</li>
          </ul>
          <p className="text-gray-700 mb-3">
            Audit records can be exported to Excel or PDF using the <strong>Export Audit Trail</strong> button.
            Filter by date range, user, action type, or module to narrow results.
          </p>

          <SubHeading id="admin-system" number="13.3" title="System Health" />
          <p className="text-gray-700 mb-3">
            The System Health module provides real-time monitoring of the PMS infrastructure, including:
          </p>
          <ul className="list-disc list-inside text-gray-700 space-y-1 ml-4 mb-4">
            <li>Database connection status and query performance</li>
            <li>API response times and error rates</li>
            <li>Active user sessions</li>
            <li>Background job status (email notifications, report generation)</li>
            <li>Storage usage and capacity</li>
          </ul>
          <InfoBox type="note">
            System Health is visible to System Administrators only. If you observe any red indicators,
            contact the ECSA-HC ICT Support team immediately.
          </InfoBox>

          {/* ══════════════════════════════════════════════════════════════
              SECTION 14 — TROUBLESHOOTING & SUPPORT
          ══════════════════════════════════════════════════════════════ */}
          <SectionHeading id="troubleshooting" number="14" title="Troubleshooting & Support" />

          <SubHeading id="ts-common" number="14.1" title="Common Issues" />
          <div className="space-y-4 my-4">
            {[
              {
                issue: 'Cannot log in — "Invalid email or password" error',
                solution: 'Verify your email address is correct. Ensure Caps Lock is not on. If you have forgotten your password, contact HR to reset it. After 3 failed attempts, your account may be locked — contact ICT Support.',
              },
              {
                issue: 'Workplan not visible in Self-Assessment',
                solution: 'Your workplan may not have been set up yet, or it may be in the wrong workflow stage. Contact your HR Officer to confirm your workplan has been created and is in the correct stage.',
              },
              {
                issue: 'Cannot submit self-assessment — Submit button is greyed out',
                solution: 'All steps must be completed before submission. Check that you have rated all KPIs, all competencies, and ticked the declaration checkbox on Step 6.',
              },
              {
                issue: 'Dashboard shows no data',
                solution: 'Ensure you are connected to the internet. Refresh the page (Ctrl+R / Cmd+R). If the issue persists, clear your browser cache and try again.',
              },
              {
                issue: 'Cannot access a module — "Access Denied" message',
                solution: 'Your role may not have permission to access that module. Contact your HR Officer to review your role assignment.',
              },
              {
                issue: 'Report download not starting',
                solution: 'Check that your browser is not blocking pop-ups or downloads. Allow downloads from the PMS domain in your browser settings.',
              },
              {
                issue: 'Page loads slowly or times out',
                solution: 'Check your internet connection. Large reports and analytics pages may take longer to load. If the issue persists, contact ICT Support.',
              },
            ].map((item) => (
              <div key={item.issue} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                <p className="font-semibold text-red-700 text-sm mb-2">❗ {item.issue}</p>
                <p className="text-sm text-gray-700">✅ {item.solution}</p>
              </div>
            ))}
          </div>

          <SubHeading id="ts-contact" number="14.2" title="Contacting Support" />
          <p className="text-gray-700 mb-4">
            If you encounter an issue not covered in this manual, contact the ECSA-HC ICT Support team:
          </p>
          <div className="bg-[#f0f4f8] border border-[#c8d8e8] rounded-xl p-6 my-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-white rounded-xl p-2">
                <Image
                  src="/assets/images/ecsahc_web_logo1-1-1774467575072.png"
                  alt="ECSA-HC Logo"
                  width={48}
                  height={48}
                  className="object-contain"
                />
              </div>
              <div>
                <p className="font-bold text-[#1a3a5c]">ECSA-HC ICT Support</p>
                <p className="text-sm text-gray-600">East, Central &amp; Southern Africa Health Community</p>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              {[
                { label: 'Email', value: 'ict@ecsahc.int' },
                { label: 'System URL', value: 'https://pms.ecsahc.int' },
                { label: 'Office Hours', value: 'Monday – Friday, 08:00 – 17:00 EAT' },
                { label: 'Location', value: 'ECSA-HC Secretariat, Arusha, Tanzania' },
              ].map((item) => (
                <div key={item.label} className="bg-white rounded-lg p-3 border border-[#c8d8e8]">
                  <p className="text-xs text-gray-500 mb-0.5">{item.label}</p>
                  <p className="font-semibold text-[#1a3a5c]">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
          <InfoBox type="tip">
            When contacting support, please include: your full name, email address, the module you were using,
            a description of the issue, and a screenshot if possible. This helps the ICT team resolve your
            issue faster.
          </InfoBox>

          {/* ══════════════════════════════════════════════════════════════
              DOCUMENT FOOTER
          ══════════════════════════════════════════════════════════════ */}
          <div className="mt-16 pt-8 border-t-2 border-[#1a3a5c] print:mt-8">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Image
                  src="/assets/images/ecsahc_web_logo1-1-1774467575072.png"
                  alt="ECSA-HC Logo"
                  width={48}
                  height={48}
                  className="object-contain"
                />
                <div>
                  <p className="font-bold text-[#1a3a5c] text-sm">ECSA-HC Performance Management System</p>
                  <p className="text-xs text-gray-500">User Manual — Version 1.0 — September 2026</p>
                </div>
              </div>
              <div className="text-center sm:text-right">
                <p className="text-xs text-gray-500">
                  © 2026 East, Central &amp; Southern Africa Health Community
                </p>
                <p className="text-xs text-gray-400">All rights reserved. Internal use only.</p>
              </div>
            </div>
          </div>

          <div className="h-16 print:hidden" />
        </main>
      </div>

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          .print\\:hidden { display: none !important; }
          .print\\:block { display: block !important; }
          .print\\:flex { display: flex !important; }
          body { font-size: 11pt; }
          h2 { page-break-before: always; }
          h2:first-of-type { page-break-before: avoid; }
          table { page-break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}
