'use client';

import React from 'react';

// ─── Types (mirrored from WorkplanSettingForm) ────────────────────────────────

interface PerspectiveRow {
  id: string;
  perspective: string;
  objective: string;
  kpis: string[];
  weight: number;
  target: string;
  keyActivities: string;
}

interface GeneralCompetency {
  id: string;
  name: string;
  description: string;
  weight: number;
}

export interface PrintAppraisalData {
  staffName: string;
  jobTitle: string;
  supervisorName: string;
  fiscalYear: string;
  reviewYear: number;
  perspectivesObjectives: PerspectiveRow[];
  generalCompetencies: GeneralCompetency[];
  staffSignature: string;
  supervisorSignature: string;
}

interface PrintAppraisalLayoutProps {
  data: PrintAppraisalData;
  onClose: () => void;
}

const KPI_LABELS: Record<string, string> = {
  k1: 'Budget Variance (≤5% of approved budget)',
  k2: 'Cost Recovery Rate (10% from all new grants)',
  k3: 'Payroll Accuracy (zero-error rate)',
  k4: 'Grant Disbursement Efficiency (within 5 days)',
  k5: 'Reporting Timeliness (100% donor reports by deadline)',
  k6: 'Unqualified Audited Financial Statements by Sept 30',
  k7: 'Revenue Growth (% increase in membership contributions)',
  k8: 'Procurement Savings (% reduction in admin costs)',
  k9: 'Internal Service Level (SLA) — 48h resolution rate',
  k10: 'Employee Engagement Index (annual survey score)',
  k11: 'Recruitment Efficiency (avg. time-to-hire ≤90 days)',
  k12: 'System Availability (99.9% uptime)',
  k13: 'Service Desk Resolution Rate (critical tickets ≤4h)',
  k14: 'Visitor / Stakeholder Satisfaction Index',
  k15: 'On-Time Performance (pickups/arrivals ≥98%)',
  k16: 'No. of countries achieving WHO Maturity Level 3/4',
  k17: 'PMS System Adoption Rate (100% of staff)',
  k18: 'Data Integrity (0% error rate in HR digital repository)',
  k19: 'Audit Readiness (zero high-risk findings)',
  k20: 'ERP Adoption Rate (100% of financial transactions)',
  k21: 'Internal Control Compliance (zero high-risk audit findings)',
  k22: 'Data Warehouse Readiness (% completion)',
  k23: 'Automation Rate (% HR/Finance processes migrated)',
  k24: 'Logbook Accuracy (100% error-free daily logs)',
  k25: 'CPD Completion Rate (% staff meeting annual PD targets)',
  k26: 'Staff Turnover Rate (target ≤5% voluntary turnover)',
  k27: 'Leadership Development (% mid-level managers trained)',
  k28: 'Cybersecurity Maturity (0 successful breaches)',
  k29: 'ISO Certification Progress (ISO 27001 / ISO 9001)',
  k30: 'Corporate Governance Index Score (target: 60%)',
  k31: 'Employee Retention Rate (target: 95%)',
  k32: 'Implementation Rate of AI/ERP Systems',
};

const PERSPECTIVE_COLORS: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  'Financial/Stewardship':       { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534', badge: '#dcfce7' },
  'Customer/Stakeholder':        { bg: '#f0f9ff', border: '#bae6fd', text: '#075985', badge: '#e0f2fe' },
  'Internal Business Processes': { bg: '#faf5ff', border: '#e9d5ff', text: '#6b21a8', badge: '#f3e8ff' },
  'Innovation Learning & Growth':{ bg: '#fffbeb', border: '#fde68a', text: '#92400e', badge: '#fef3c7' },
};

export default function PrintAppraisalLayout({ data, onClose }: PrintAppraisalLayoutProps) {
  const totalBSC = data.perspectivesObjectives.reduce((s, r) => s + (Number(r.weight) || 0), 0);
  const totalComp = data.generalCompetencies.reduce((s, c) => s + (Number(c.weight) || 0), 0);
  const grandTotal = totalBSC + totalComp;

  function handlePrint() {
    window.print();
  }

  return (
    <>
      {/* ── Print-specific global styles ── */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #print-appraisal-root,
          #print-appraisal-root * { visibility: visible !important; }
          #print-appraisal-root { position: fixed; inset: 0; z-index: 9999; background: white; }
          .print-no-break { page-break-inside: avoid; break-inside: avoid; }
          .print-page-break { page-break-before: always; break-before: always; }
          .print-hide { display: none !important; }
          @page { size: A4 portrait; margin: 15mm 12mm; }
        }
        @media screen {
          #print-appraisal-root { background: #f1f5f9; min-height: 100vh; }
        }
      `}</style>

      <div id="print-appraisal-root" className="font-sans text-gray-900">

        {/* ── Screen-only toolbar ── */}
        <div className="print-hide sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Print Preview — Performance Appraisal Workplan</p>
              <p className="text-xs text-gray-500">Form controls are hidden · Branding &amp; signatures are visible · A4 layout</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print / Save PDF
            </button>
            <button
              onClick={onClose}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gray-600 border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Close Preview
            </button>
          </div>
        </div>

        {/* ── A4 Document ── */}
        <div className="max-w-[794px] mx-auto bg-white shadow-lg print:shadow-none print:max-w-none">

          {/* ═══ PAGE 1 ═══ */}
          <div className="px-10 pt-8 pb-6 print-no-break">

            {/* ── ECSA-HC Branded Header ── */}
            <div style={{ borderBottom: '3px solid #1e3a8a' }} className="pb-4 mb-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  {/* Logo placeholder — uses app_logo.png */}
                  <img
                    src="/assets/images/ecsahc_web_logo1-1-1774467575072.png"
                    alt="ECSA-HC Logo"
                    className="h-14 w-auto object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  <div>
                    <p className="text-[10px] font-semibold text-blue-800 uppercase tracking-widest">East, Central &amp; Southern Africa Health Community</p>
                    <h1 className="text-xl font-bold text-blue-900 leading-tight mt-0.5">Performance Appraisal Workplan</h1>
                    <p className="text-xs text-gray-500 mt-0.5">Balanced Scorecard Framework · Human Resources Management</p>
                  </div>
                </div>
                <div className="text-right">
                  <div style={{ background: '#1e3a8a', color: 'white' }} className="rounded-lg px-3 py-2 text-center">
                    <p className="text-[9px] font-semibold uppercase tracking-wider opacity-80">Fiscal Year</p>
                    <p className="text-sm font-bold leading-tight">{data.fiscalYear}</p>
                  </div>
                  <p className="text-[9px] text-gray-400 mt-1.5">Form Ref: PAW-{data.reviewYear}</p>
                </div>
              </div>
            </div>

            {/* ── Staff Information Block ── */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }} className="rounded-xl p-4 mb-5">
              <p style={{ color: '#1e3a8a' }} className="text-[10px] font-bold uppercase tracking-widest mb-3">Staff Information</p>
              <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                <InfoRow label="Staff Member" value={data.staffName || '—'} />
                <InfoRow label="Job Title" value={data.jobTitle || '—'} />
                <InfoRow label="Supervisor / Line Manager" value={data.supervisorName || '—'} />
                <InfoRow label="Review Year" value={String(data.reviewYear)} />
                <InfoRow label="Fiscal Year" value={data.fiscalYear} />
                <InfoRow label="Total Objectives" value={String(data.perspectivesObjectives.length)} />
              </div>
            </div>

            {/* ── Weight Summary ── */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              <WeightBox label="BSC Objectives" value={totalBSC} max={80} color="#1e3a8a" />
              <WeightBox label="General Competencies" value={totalComp} max={20} color="#6d28d9" />
              <WeightBox label="Grand Total" value={grandTotal} max={100} color={grandTotal === 100 ? '#059669' : '#d97706'} highlight />
            </div>

            {/* ── Section Title: BSC Objectives ── */}
            <SectionTitle title="Part A — BSC Perspectives, Objectives & KPIs" subtitle={`${data.perspectivesObjectives.length} objective(s) · Total weight: ${totalBSC} / 80`} color="#1e3a8a" />
          </div>

          {/* ── Objective Cards ── */}
          {data.perspectivesObjectives.map((row, idx) => {
            const colors = PERSPECTIVE_COLORS[row.perspective] || { bg: '#f9fafb', border: '#e5e7eb', text: '#111827', badge: '#f3f4f6' };
            const kpiLabels = row.kpis.map((k) => KPI_LABELS[k] || k);
            const isNewPage = idx > 0 && idx % 3 === 0;
            return (
              <div
                key={row.id}
                className={`px-10 pb-4 print-no-break${isNewPage ? ' print-page-break pt-8' : ''}`}
              >
                <div style={{ background: colors.bg, border: `1px solid ${colors.border}` }} className="rounded-xl p-4">
                  {/* Objective header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span style={{ background: colors.badge, color: colors.text, border: `1px solid ${colors.border}` }} className="text-[10px] font-bold px-2 py-0.5 rounded-full">
                        Objective {idx + 1}
                      </span>
                      <span style={{ color: colors.text }} className="text-xs font-semibold">{row.perspective || '—'}</span>
                    </div>
                    <span style={{ background: '#1e3a8a', color: 'white' }} className="text-[10px] font-bold px-2.5 py-1 rounded-lg">
                      Weight: {row.weight}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5">
                    <PrintField label="Objective / Goal Statement" value={row.objective} />
                    {row.keyActivities && <PrintField label="Key Activities" value={row.keyActivities} multiline />}
                    <PrintField label="Annual Target" value={row.target} />
                    {kpiLabels.length > 0 && (
                      <div>
                        <p className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-1">Key Performance Indicators</p>
                        <ul className="space-y-0.5">
                          {kpiLabels.map((kpi, ki) => (
                            <li key={ki} className="flex items-start gap-1.5 text-xs text-gray-700">
                              <span style={{ color: colors.text }} className="mt-0.5 flex-shrink-0">▸</span>
                              {kpi}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* ═══ PAGE BREAK before Competencies ═══ */}
          <div className="print-page-break" />

          {/* ── General Competencies ── */}
          <div className="px-10 pt-8 pb-4 print-no-break">
            <SectionTitle title="Part B — General Competencies" subtitle={`5 competencies · Total weight: ${totalComp} / 20`} color="#6d28d9" />

            <div style={{ border: '1px solid #e0e7ff', borderRadius: '12px', overflow: 'hidden' }} className="mt-4">
              {/* Table header */}
              <div style={{ background: '#4f46e5', color: 'white' }} className="grid grid-cols-12 gap-2 px-4 py-2.5">
                <div className="col-span-1 text-[9px] font-bold uppercase tracking-wider">#</div>
                <div className="col-span-7 text-[9px] font-bold uppercase tracking-wider">Competency</div>
                <div className="col-span-4 text-[9px] font-bold uppercase tracking-wider text-center">Weight (1–5)</div>
              </div>
              {data.generalCompetencies.map((comp, idx) => (
                <div
                  key={comp.id}
                  style={{ background: idx % 2 === 0 ? '#f5f3ff' : 'white', borderTop: '1px solid #e0e7ff' }}
                  className="grid grid-cols-12 gap-2 px-4 py-3 items-start"
                >
                  <div className="col-span-1 text-xs font-bold text-indigo-600 mt-0.5">{idx + 1}</div>
                  <div className="col-span-7">
                    <p className="text-xs font-semibold text-gray-900">{comp.name}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5 leading-relaxed">{comp.description}</p>
                  </div>
                  <div className="col-span-4 flex items-center justify-center">
                    <span style={{ background: '#4f46e5', color: 'white' }} className="text-sm font-bold px-3 py-1 rounded-lg">
                      {comp.weight}
                    </span>
                  </div>
                </div>
              ))}
              {/* Total row */}
              <div style={{ background: totalComp === 20 ? '#ecfdf5' : '#fffbeb', borderTop: '2px solid ' + (totalComp === 20 ? '#6ee7b7' : '#fde68a') }} className="grid grid-cols-12 gap-2 px-4 py-3 items-center">
                <div className="col-span-1" />
                <div className="col-span-7">
                  <p className={`text-xs font-bold ${totalComp === 20 ? 'text-emerald-700' : 'text-amber-700'}`}>Total Competencies Weight</p>
                </div>
                <div className="col-span-4 flex items-center justify-center">
                  <span className={`text-base font-extrabold ${totalComp === 20 ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {totalComp} <span className="text-xs font-normal">/ 20</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Grand Total Summary ── */}
          <div className="px-10 pb-4 print-no-break">
            <div style={{ background: grandTotal === 100 ? '#f0fdf4' : '#fffbeb', border: `2px solid ${grandTotal === 100 ? '#6ee7b7' : '#fde68a'}`, borderRadius: '12px' }} className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-gray-900">Grand Total Score</p>
                <p className="text-xs text-gray-500 mt-0.5">BSC Objectives ({totalBSC}) + General Competencies ({totalComp})</p>
              </div>
              <div className="text-right">
                <p className={`text-3xl font-extrabold ${grandTotal === 100 ? 'text-emerald-700' : 'text-amber-700'}`}>{grandTotal}</p>
                <p className="text-xs text-gray-500">out of 100</p>
              </div>
            </div>
          </div>

          {/* ═══ PAGE BREAK before Signatures ═══ */}
          <div className="print-page-break" />

          {/* ── Signature Page ── */}
          <div className="px-10 pt-8 pb-10 print-no-break">

            {/* Re-print mini header on signature page */}
            <div style={{ borderBottom: '2px solid #1e3a8a' }} className="pb-3 mb-6 flex items-center justify-between">
              <div>
                <p className="text-[9px] font-semibold text-blue-800 uppercase tracking-widest">ECSA-HC · Performance Appraisal Workplan</p>
                <p className="text-sm font-bold text-blue-900">{data.staffName} · {data.fiscalYear}</p>
              </div>
              <p className="text-[9px] text-gray-400">Form Ref: PAW-{data.reviewYear} · Signature Page</p>
            </div>

            <SectionTitle title="Part C — Declaration & Signatures" subtitle="Both parties confirm agreement on the objectives, KPIs, and competencies set above" color="#1e3a8a" />

            {/* Declaration text */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px' }} className="p-4 mt-4 mb-6">
              <p className="text-xs text-gray-700 leading-relaxed">
                We, the undersigned, confirm that we have jointly reviewed and agreed upon the performance objectives, key performance indicators, key activities, annual targets, and general competencies outlined in this Performance Appraisal Workplan for the fiscal year <strong>{data.fiscalYear}</strong>. This workplan shall serve as the basis for the Mid-Year and End-Year performance evaluations conducted under the ECSA-HC Balanced Scorecard Performance Management System.
              </p>
            </div>

            {/* Signature blocks */}
            <div className="grid grid-cols-2 gap-8">
              <SignatureBlock
                role="Staff Member"
                name={data.staffName}
                signature={data.staffSignature}
              />
              <SignatureBlock
                role="Supervisor / Line Manager"
                name={data.supervisorName}
                signature={data.supervisorSignature}
              />
            </div>

            {/* Official use box */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px' }} className="mt-8 p-4">
              <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-3">For Official Use Only</p>
              <div className="grid grid-cols-3 gap-4">
                {['HR Department Stamp', 'Date Received', 'Workplan Reference No.'].map((label) => (
                  <div key={label}>
                    <p className="text-[9px] text-gray-400 mb-1">{label}</p>
                    <div style={{ borderBottom: '1px solid #cbd5e1', height: '28px' }} />
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div style={{ borderTop: '1px solid #e2e8f0' }} className="mt-8 pt-4 flex items-center justify-between">
              <p className="text-[9px] text-gray-400">ECSA-HC Performance Management System · Confidential</p>
              <p className="text-[9px] text-gray-400">PAW-{data.reviewYear} · Page 1 of 1</p>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-[10px] text-gray-500 w-40 flex-shrink-0">{label}:</span>
      <span className="text-xs font-semibold text-gray-900">{value}</span>
    </div>
  );
}

function WeightBox({ label, value, max, color, highlight }: { label: string; value: number; max: number; color: string; highlight?: boolean }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div style={{ border: `1px solid ${color}20`, borderRadius: '10px', background: `${color}08` }} className="p-3 text-center">
      <p className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color }}>{label}</p>
      <p className="text-2xl font-extrabold" style={{ color }}>{value}</p>
      <p className="text-[9px] text-gray-400">/ {max}</p>
      <div style={{ background: '#e5e7eb', borderRadius: '4px', height: '4px', marginTop: '6px' }}>
        <div style={{ width: `${pct}%`, background: color, borderRadius: '4px', height: '4px', transition: 'width 0.3s' }} />
      </div>
    </div>
  );
}

function SectionTitle({ title, subtitle, color }: { title: string; subtitle: string; color: string }) {
  return (
    <div style={{ borderLeft: `4px solid ${color}`, paddingLeft: '12px' }}>
      <h2 className="text-sm font-bold text-gray-900">{title}</h2>
      <p className="text-[10px] text-gray-500 mt-0.5">{subtitle}</p>
    </div>
  );
}

function PrintField({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div>
      <p className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">{label}</p>
      <p className={`text-xs text-gray-800 ${multiline ? 'whitespace-pre-wrap leading-relaxed' : ''}`}>{value || '—'}</p>
    </div>
  );
}

function SignatureBlock({ role, name, signature }: { role: string; name: string; signature: string }) {
  return (
    <div>
      <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-3">{role}</p>
      <div style={{ borderBottom: '1px solid #1e3a8a', minHeight: '48px', marginBottom: '6px' }} className="flex items-end pb-1">
        {signature ? (
          <span style={{ fontFamily: 'Georgia, serif', fontSize: '18px', color: '#1e3a8a', fontStyle: 'italic' }}>{signature}</span>
        ) : (
          <span className="text-xs text-gray-300 italic">Signature</span>
        )}
      </div>
      <p className="text-[10px] font-semibold text-gray-700">{name || '—'}</p>
      <p className="text-[9px] text-gray-400 mt-0.5">{role}</p>
      <div className="mt-3">
        <p className="text-[9px] text-gray-400 mb-1">Date:</p>
        <div style={{ borderBottom: '1px solid #cbd5e1', height: '20px', width: '140px' }} />
      </div>
    </div>
  );
}
