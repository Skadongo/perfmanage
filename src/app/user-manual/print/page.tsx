'use client';

import React, { useEffect } from 'react';

export default function UserManualPrintPage() {
  useEffect(() => {
    // Small delay to ensure styles are loaded before print dialog
    const timer = setTimeout(() => {
      window.print();
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #1a1a1a; background: white; }

        /* Screen: show print button */
        .screen-only { display: block; }
        .print-only { display: none; }

        @media print {
          .screen-only { display: none !important; }
          .print-only { display: block !important; }
          body { font-size: 10.5pt; }
          .page-break { page-break-before: always; }
          .no-break { page-break-inside: avoid; }
          h2.section-title { page-break-before: always; }
          h2.section-title:first-of-type { page-break-before: avoid; }
          table { page-break-inside: avoid; }
          .cover-page { page-break-after: always; }
          .toc-page { page-break-after: always; }
        }

        /* Layout */
        .document { max-width: 210mm; margin: 0 auto; padding: 0; }

        /* Cover Page */
        .cover-page {
          min-height: 297mm;
          display: flex;
          flex-direction: column;
          background: linear-gradient(160deg, #0d2540 0%, #1a3a5c 60%, #2a5298 100%);
          color: white;
          padding: 0;
          position: relative;
          overflow: hidden;
        }
        .cover-top-bar {
          background: rgba(255,255,255,0.08);
          padding: 20px 40px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid rgba(255,255,255,0.15);
        }
        .cover-logo-area { display: flex; align-items: center; gap: 16px; }
        .cover-logo-box {
          background: white;
          border-radius: 12px;
          padding: 8px;
          width: 72px;
          height: 72px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .cover-logo-box img { width: 56px; height: 56px; object-fit: contain; }
        .cover-org-name { font-size: 13pt; font-weight: 700; letter-spacing: 0.5px; }
        .cover-org-sub { font-size: 9pt; color: rgba(255,255,255,0.7); margin-top: 2px; }
        .cover-version-badge {
          background: rgba(255,255,255,0.12);
          border: 1px solid rgba(255,255,255,0.25);
          border-radius: 8px;
          padding: 8px 16px;
          text-align: right;
        }
        .cover-version-badge .ver { font-size: 8pt; color: rgba(255,255,255,0.6); }
        .cover-version-badge .ver-num { font-size: 11pt; font-weight: 700; }

        .cover-body {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 60px 40px;
        }
        .cover-tag {
          font-size: 9pt;
          font-weight: 700;
          letter-spacing: 3px;
          text-transform: uppercase;
          color: rgba(255,255,255,0.55);
          margin-bottom: 16px;
        }
        .cover-title {
          font-size: 30pt;
          font-weight: 800;
          line-height: 1.15;
          margin-bottom: 12px;
          letter-spacing: -0.5px;
        }
        .cover-subtitle {
          font-size: 16pt;
          font-weight: 400;
          color: rgba(255,255,255,0.75);
          margin-bottom: 40px;
        }
        .cover-meta-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-top: 20px;
        }
        .cover-meta-card {
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.18);
          border-radius: 10px;
          padding: 12px 14px;
        }
        .cover-meta-label { font-size: 7.5pt; color: rgba(255,255,255,0.55); margin-bottom: 4px; }
        .cover-meta-value { font-size: 10pt; font-weight: 600; }

        .cover-footer {
          padding: 20px 40px;
          border-top: 1px solid rgba(255,255,255,0.12);
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 8pt;
          color: rgba(255,255,255,0.5);
        }

        /* Decorative circles */
        .cover-deco-1 {
          position: absolute;
          top: -80px;
          right: -80px;
          width: 300px;
          height: 300px;
          border-radius: 50%;
          background: rgba(255,255,255,0.04);
          pointer-events: none;
        }
        .cover-deco-2 {
          position: absolute;
          bottom: -60px;
          left: -60px;
          width: 220px;
          height: 220px;
          border-radius: 50%;
          background: rgba(255,255,255,0.04);
          pointer-events: none;
        }

        /* TOC Page */
        .toc-page { padding: 40px; min-height: 297mm; }
        .toc-header {
          border-bottom: 3px solid #1a3a5c;
          padding-bottom: 12px;
          margin-bottom: 24px;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .toc-header img { width: 40px; height: 40px; object-fit: contain; }
        .toc-header-text h1 { font-size: 18pt; font-weight: 800; color: #1a3a5c; }
        .toc-header-text p { font-size: 9pt; color: #666; }
        .toc-title { font-size: 16pt; font-weight: 700; color: #1a3a5c; margin-bottom: 20px; padding-bottom: 8px; border-bottom: 1px solid #e0e0e0; }
        .toc-section { margin-bottom: 4px; }
        .toc-main-row {
          display: flex;
          align-items: baseline;
          gap: 8px;
          padding: 5px 0;
          font-size: 10.5pt;
          font-weight: 700;
          color: #1a3a5c;
        }
        .toc-main-row .toc-dots {
          flex: 1;
          border-bottom: 1px dotted #ccc;
          margin: 0 4px;
          margin-bottom: 3px;
        }
        .toc-main-row .toc-page-num { font-size: 9pt; color: #555; min-width: 20px; text-align: right; }
        .toc-sub-row {
          display: flex;
          align-items: baseline;
          gap: 8px;
          padding: 2px 0 2px 24px;
          font-size: 9.5pt;
          color: #444;
        }
        .toc-sub-row .toc-dots { flex: 1; border-bottom: 1px dotted #ddd; margin: 0 4px; margin-bottom: 3px; }
        .toc-sub-row .toc-page-num { font-size: 8.5pt; color: #777; min-width: 20px; text-align: right; }

        /* Running header for content pages */
        .page-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 2px solid #1a3a5c;
          padding-bottom: 8px;
          margin-bottom: 24px;
        }
        .page-header-left { display: flex; align-items: center; gap: 10px; }
        .page-header-left img { width: 32px; height: 32px; object-fit: contain; }
        .page-header-title { font-size: 9pt; font-weight: 700; color: #1a3a5c; }
        .page-header-sub { font-size: 7.5pt; color: #888; }
        .page-header-right { font-size: 8pt; color: #888; text-align: right; }

        /* Content pages */
        .content-page { padding: 32px 40px; }

        /* Section headings */
        h2.section-title {
          font-size: 16pt;
          font-weight: 800;
          color: #1a3a5c;
          border-bottom: 2.5px solid #1a3a5c;
          padding-bottom: 8px;
          margin-top: 32px;
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .section-num-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #1a3a5c;
          color: white;
          font-size: 11pt;
          font-weight: 700;
          flex-shrink: 0;
        }
        h3.sub-title {
          font-size: 12pt;
          font-weight: 700;
          color: #1a3a5c;
          margin-top: 20px;
          margin-bottom: 8px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .sub-num { color: #2e7d32; font-weight: 700; font-size: 11pt; }

        /* Body text */
        p.body { font-size: 10.5pt; color: #333; line-height: 1.6; margin-bottom: 10px; }
        ul.body-list { font-size: 10.5pt; color: #333; line-height: 1.6; margin-bottom: 10px; padding-left: 24px; }
        ul.body-list li { margin-bottom: 4px; }

        /* Tables */
        .data-table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 9.5pt; }
        .data-table thead tr { background: #1a3a5c; color: white; }
        .data-table thead th { padding: 9px 12px; text-align: left; font-weight: 600; }
        .data-table tbody tr:nth-child(even) { background: #f5f7fa; }
        .data-table tbody tr:nth-child(odd) { background: white; }
        .data-table tbody td { padding: 8px 12px; color: #333; border-bottom: 1px solid #e8ecf0; }

        /* Info boxes */
        .info-box {
          border-left: 4px solid;
          border-radius: 0 8px 8px 0;
          padding: 10px 14px;
          margin: 10px 0;
          font-size: 9.5pt;
        }
        .info-box.info { border-color: #3b82f6; background: #eff6ff; color: #1e40af; }
        .info-box.tip { border-color: #22c55e; background: #f0fdf4; color: #166534; }
        .info-box.warning { border-color: #f59e0b; background: #fffbeb; color: #92400e; }
        .info-box.note { border-color: #94a3b8; background: #f8fafc; color: #475569; }
        .info-box .box-label { font-weight: 700; margin-bottom: 3px; }

        /* Step boxes */
        .step-box { display: flex; gap: 12px; margin: 8px 0; }
        .step-num {
          flex-shrink: 0;
          width: 26px;
          height: 26px;
          border-radius: 50%;
          background: #1a3a5c;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 9pt;
          font-weight: 700;
        }
        .step-content { flex: 1; }
        .step-title { font-weight: 700; font-size: 10pt; color: #1a3a5c; margin-bottom: 2px; }
        .step-body { font-size: 9.5pt; color: #444; line-height: 1.5; }

        /* Workflow diagram */
        .workflow { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin: 12px 0; }
        .workflow-step {
          border: 2px solid;
          border-radius: 8px;
          padding: 6px 12px;
          font-size: 9pt;
          font-weight: 600;
        }
        .workflow-arrow { color: #999; font-size: 14pt; font-weight: 700; }

        /* Role badge */
        .role-badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 8.5pt;
          font-weight: 600;
        }

        /* URL box */
        .url-box {
          background: #1a3a5c;
          color: white;
          border-radius: 8px;
          padding: 12px 20px;
          text-align: center;
          font-family: 'Courier New', monospace;
          font-size: 13pt;
          font-weight: 700;
          letter-spacing: 0.5px;
          margin: 12px 0;
        }

        /* Capability grid */
        .cap-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin: 12px 0; }
        .cap-item { font-size: 9.5pt; color: #333; padding: 4px 0; }

        /* Meta info box */
        .meta-box {
          background: #f0f4f8;
          border: 1px solid #c8d8e8;
          border-radius: 10px;
          padding: 16px 20px;
          margin: 12px 0;
        }
        .meta-box-title { font-size: 10pt; font-weight: 700; color: #1a3a5c; margin-bottom: 10px; }

        /* Directorate badges */
        .dir-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 12px 0; }
        .dir-badge {
          background: rgba(26,58,92,0.08);
          border: 1px solid rgba(26,58,92,0.2);
          border-radius: 8px;
          padding: 8px;
          text-align: center;
          font-size: 9pt;
          font-weight: 700;
          color: #1a3a5c;
        }

        /* Approve/Reject grid */
        .decision-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 12px 0; }
        .approve-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 12px; }
        .reject-box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 12px; }
        .approve-box .box-head { font-weight: 700; color: #166534; font-size: 10pt; margin-bottom: 6px; }
        .reject-box .box-head { font-weight: 700; color: #991b1b; font-size: 10pt; margin-bottom: 6px; }

        /* BSC perspectives */
        .bsc-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 12px 0; }
        .bsc-card {
          border: 2px solid;
          border-radius: 8px;
          padding: 8px;
          text-align: center;
          font-size: 9pt;
          font-weight: 600;
        }

        /* Permission badges */
        .perm-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; margin: 12px 0; }
        .perm-badge { border-radius: 8px; padding: 6px; text-align: center; font-size: 8.5pt; font-weight: 600; }

        /* Appendix tables */
        .appendix-table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 9.5pt; }
        .appendix-table th { background: #1a3a5c; color: white; padding: 8px 12px; text-align: left; font-weight: 600; }
        .appendix-table td { padding: 7px 12px; border-bottom: 1px solid #e0e0e0; }
        .appendix-table tr:nth-child(even) td { background: #f5f7fa; }

        /* Screen-only print button */
        .print-btn-bar {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          background: #1a3a5c;
          color: white;
          padding: 12px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          z-index: 9999;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        }
        .print-btn-bar .info { font-size: 10pt; }
        .print-btn-bar .info strong { font-size: 11pt; }
        .print-btn-bar .info small { display: block; font-size: 8.5pt; color: rgba(255,255,255,0.7); margin-top: 2px; }
        .btn-group { display: flex; gap: 10px; }
        .btn-primary {
          background: white;
          color: #1a3a5c;
          border: none;
          border-radius: 8px;
          padding: 9px 20px;
          font-size: 10pt;
          font-weight: 700;
          cursor: pointer;
        }
        .btn-secondary {
          background: rgba(255,255,255,0.15);
          color: white;
          border: 1px solid rgba(255,255,255,0.3);
          border-radius: 8px;
          padding: 9px 16px;
          font-size: 10pt;
          cursor: pointer;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
        }
        .document-wrapper { margin-top: 60px; }
        @media print { .document-wrapper { margin-top: 0; } }
      `}</style>

      {/* ── Screen-only: Print bar ── */}
      <div className="print-btn-bar screen-only">
        <div className="info">
          <strong>ECSA-HC PMS — User Manual (Version 1.0, September 2026)</strong>
          <small>Click "Save as PDF" to download. In the print dialog, choose "Save as PDF" as the destination.</small>
        </div>
        <div className="btn-group">
          <button className="btn-primary" onClick={() => window.print()}>
            🖨 Save as PDF
          </button>
          <a href="/user-manual" className="btn-secondary">
            ← Back to Manual
          </a>
        </div>
      </div>

      <div className="document-wrapper">
        <div className="document">

          {/* ══════════════════════════════════════════════════════════
              COVER PAGE
          ══════════════════════════════════════════════════════════ */}
          <div className="cover-page">
            <div className="cover-deco-1" />
            <div className="cover-deco-2" />

            <div className="cover-top-bar">
              <div className="cover-logo-area">
                <div className="cover-logo-box">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/assets/images/ecsahc_web_logo1-1-1774467575072.png" alt="ECSA-HC Logo" />
                </div>
                <div>
                  <div className="cover-org-name">ECSA-HC</div>
                  <div className="cover-org-sub">East, Central &amp; Southern Africa Health Community</div>
                </div>
              </div>
              <div className="cover-version-badge">
                <div className="ver">Document Version</div>
                <div className="ver-num">v1.0 · 2026</div>
              </div>
            </div>

            <div className="cover-body">
              <div className="cover-tag">Official Documentation</div>
              <div className="cover-title">Performance Management System</div>
              <div className="cover-subtitle">User Manual</div>
              <div style={{ height: '2px', background: 'rgba(255,255,255,0.2)', marginBottom: '32px', width: '80px' }} />
              <p style={{ fontSize: '10.5pt', color: 'rgba(255,255,255,0.75)', lineHeight: '1.6', maxWidth: '480px' }}>
                A comprehensive guide to all modules, features, and workflows of the ECSA-HC Performance
                Management System — covering login, evaluations, analytics, staff management, and administration.
              </p>
              <div className="cover-meta-grid">
                {[
                  { label: 'Document Version', value: '1.0' },
                  { label: 'Release Date', value: 'September 2026' },
                  { label: 'Prepared By', value: 'ECSA-HC ICT Unit' },
                  { label: 'Classification', value: 'Internal Use Only' },
                ]?.map((item) => (
                  <div key={item?.label} className="cover-meta-card">
                    <div className="cover-meta-label">{item?.label}</div>
                    <div className="cover-meta-value">{item?.value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="cover-footer">
              <span>© 2026 East, Central &amp; Southern Africa Health Community. All rights reserved. Internal use only.</span>
              <span>https://pms.ecsahc.int</span>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════
              TABLE OF CONTENTS
          ══════════════════════════════════════════════════════════ */}
          <div className="toc-page">
            <div className="page-header">
              <div className="page-header-left">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/assets/images/ecsahc_web_logo1-1-1774467575072.png" alt="ECSA-HC" />
                <div>
                  <div className="page-header-title">ECSA-HC Performance Management System</div>
                  <div className="page-header-sub">User Manual — Version 1.0 — September 2026</div>
                </div>
              </div>
              <div className="page-header-right">Table of Contents</div>
            </div>

            <div className="toc-title">Table of Contents</div>

            {[
              { num: '1', title: 'Introduction', subs: [
                { num: '1.1', title: 'About the ECSA-HC PMS' },
                { num: '1.2', title: 'Purpose of This Manual' },
                { num: '1.3', title: 'Intended Audience' },
                { num: '1.4', title: 'Document Conventions' },
              ]},
              { num: '2', title: 'Getting Started', subs: [
                { num: '2.1', title: 'System Requirements' },
                { num: '2.2', title: 'Accessing the System' },
                { num: '2.3', title: 'Logging In' },
                { num: '2.4', title: 'Changing Your Password' },
                { num: '2.5', title: 'Navigating the Interface' },
                { num: '2.6', title: 'User Roles & Access Levels' },
              ]},
              { num: '3', title: 'Performance Dashboard', subs: [
                { num: '3.1', title: 'Dashboard Overview' },
                { num: '3.2', title: 'KPI Metric Cards' },
                { num: '3.3', title: 'BSC Perspective Chart' },
                { num: '3.4', title: 'KPI Trend Chart' },
                { num: '3.5', title: 'At-Risk Staff Table' },
                { num: '3.6', title: 'Strategic Plan Section' },
              ]},
              { num: '4', title: 'Evaluation & Reviews', subs: [
                { num: '4.1', title: 'Module Overview' },
                { num: '4.2', title: 'Workplan Setup' },
                { num: '4.3', title: 'Review Table' },
                { num: '4.4', title: 'Evaluation Form' },
                { num: '4.5', title: 'Evaluation Comparison Modal' },
                { num: '4.6', title: 'Print Appraisal Layout' },
                { num: '4.7', title: 'Workplan List View' },
              ]},
              { num: '5', title: 'Self-Assessment', subs: [
                { num: '5.1', title: 'Self-Assessment Wizard Overview' },
                { num: '5.2', title: 'Step 1 – Select Workplan' },
                { num: '5.3', title: 'Step 2 – KPI Assessment' },
                { num: '5.4', title: 'Step 3 – General Competencies' },
                { num: '5.5', title: 'Step 4 – Objectives & Goals' },
                { num: '5.6', title: 'Step 5 – Overall Reflection' },
                { num: '5.7', title: 'Step 6 – Sign & Submit' },
              ]},
              { num: '6', title: 'Manager Review', subs: [
                { num: '6.1', title: 'Review Table' },
                { num: '6.2', title: 'Staff Self-Assessment Tab' },
                { num: '6.3', title: 'Manager Rating & Feedback Tab' },
                { num: '6.4', title: 'Approving or Rejecting a Review' },
              ]},
              { num: '7', title: 'Mid-Year Reviews', subs: [
                { num: '7.1', title: 'Module Overview' },
                { num: '7.2', title: 'Review Statuses Explained' },
              ]},
              { num: '8', title: 'Feedback & Mentorship', subs: [
                { num: '8.1', title: 'Feedback Feed' },
                { num: '8.2', title: 'Giving Feedback' },
                { num: '8.3', title: 'Mentor Directory' },
                { num: '8.4', title: 'Upcoming Sessions Panel' },
                { num: '8.5', title: 'Peer Exchange Panel' },
              ]},
              { num: '9', title: 'Training & Resources', subs: [
                { num: '9.1', title: 'Training Catalog' },
                { num: '9.2', title: 'CPD Progress Table' },
                { num: '9.3', title: 'Certification Tracker' },
                { num: '9.4', title: 'Guidance Documents' },
              ]},
              { num: '10', title: 'Staff Management', subs: [
                { num: '10.1', title: 'Staff Directory' },
                { num: '10.2', title: 'Adding & Editing Staff' },
                { num: '10.3', title: 'Directorates & Clusters' },
                { num: '10.4', title: 'Staff Import' },
              ]},
              { num: '11', title: 'Analytics & Reports', subs: [
                { num: '11.1', title: 'KPI Year-on-Year Chart' },
                { num: '11.2', title: 'BSC Scorecard Matrix' },
                { num: '11.3', title: 'JEESP-AR Chart' },
                { num: '11.4', title: 'HEPRR Progress Chart' },
                { num: '11.5', title: 'WBN-o-Pipeline Table' },
                { num: '11.6', title: 'Reports Export Panel' },
              ]},
              { num: '12', title: 'Permissions', subs: [
                { num: '12.1', title: 'Roles Overview' },
                { num: '12.2', title: 'Assigning Roles' },
                { num: '12.3', title: 'Module Permission Matrix' },
              ]},
              { num: '13', title: 'Admin Dashboard', subs: [
                { num: '13.1', title: 'Admin Overview' },
                { num: '13.2', title: 'Appraisal Audit Trail' },
                { num: '13.3', title: 'System Health' },
              ]},
              { num: '14', title: 'Troubleshooting & Support', subs: [
                { num: '14.1', title: 'Common Issues' },
                { num: '14.2', title: 'Contacting Support' },
              ]},
              { num: 'A', title: 'Appendix A — Record of Changes', subs: [] },
              { num: 'B', title: 'Appendix B — Glossary', subs: [] },
              { num: 'C', title: 'Appendix C — Support Contacts', subs: [] },
              { num: 'D', title: 'Appendix D — Approvals', subs: [] },
            ]?.map((section) => (
              <div key={section?.num} className="toc-section">
                <div className="toc-main-row">
                  <span>{section?.num}.</span>
                  <span style={{ flex: 'none' }}>{section?.title}</span>
                  <span className="toc-dots" />
                  <span className="toc-page-num">—</span>
                </div>
                {section?.subs?.map((sub) => (
                  <div key={sub?.num} className="toc-sub-row">
                    <span>{sub?.num}</span>
                    <span style={{ flex: 'none' }}>{sub?.title}</span>
                    <span className="toc-dots" />
                    <span className="toc-page-num">—</span>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* ══════════════════════════════════════════════════════════
              CONTENT PAGES
          ══════════════════════════════════════════════════════════ */}
          <div className="content-page">

            {/* Running header */}
            <div className="page-header">
              <div className="page-header-left">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/assets/images/ecsahc_web_logo1-1-1774467575072.png" alt="ECSA-HC" />
                <div>
                  <div className="page-header-title">ECSA-HC Performance Management System</div>
                  <div className="page-header-sub">User Manual — Version 1.0 — September 2026</div>
                </div>
              </div>
              <div className="page-header-right">Internal Use Only</div>
            </div>

            {/* ── SECTION 1: INTRODUCTION ── */}
            <h2 className="section-title">
              <span className="section-num-badge">1</span>
              Introduction
            </h2>

            <h3 className="sub-title"><span className="sub-num">1.1</span> About the ECSA-HC PMS</h3>
            <p className="body">
              The <strong>ECSA-HC Performance Management System (PMS)</strong> is a comprehensive, web-based platform
              developed for the East, Central &amp; Southern Africa Health Community to manage staff performance,
              evaluations, and professional development across all directorates and clusters.
            </p>
            <p className="body">
              The system is aligned with the <strong>ECSA-HC Strategic Plan 2024–2034</strong> and supports the
              organisation's five strategic pillars and nine strategic objectives. It provides real-time performance
              data, structured appraisal workflows, and organisation-wide analytics to support evidence-based
              decision-making.
            </p>
            <div className="meta-box">
              <div className="meta-box-title">Key System Capabilities</div>
              <div className="cap-grid">
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
                ]?.map((item) => (
                  <div key={item} className="cap-item">{item}</div>
                ))}
              </div>
            </div>

            <h3 className="sub-title"><span className="sub-num">1.2</span> Purpose of This Manual</h3>
            <p className="body">
              This manual provides step-by-step guidance for all users of the ECSA-HC PMS. It covers every module
              and feature of the system, from initial login to advanced analytics. Whether you are a staff member
              completing your first self-assessment or an HR administrator managing system permissions, this manual
              will guide you through each task.
            </p>

            <h3 className="sub-title"><span className="sub-num">1.3</span> Intended Audience</h3>
            <p className="body">This manual is intended for all ECSA-HC staff who use the PMS, including:</p>
            <ul className="body-list">
              <li><strong>Staff Members</strong> — completing self-assessments and accessing development resources</li>
              <li><strong>Supervisors &amp; Managers</strong> — reviewing staff evaluations and providing feedback</li>
              <li><strong>HR &amp; Admin Officers</strong> — managing staff records and system configuration</li>
              <li><strong>Directors &amp; Senior Management</strong> — monitoring organisational performance</li>
              <li><strong>System Administrators</strong> — managing roles, permissions, and system health</li>
            </ul>

            <h3 className="sub-title"><span className="sub-num">1.4</span> Document Conventions</h3>
            <p className="body">
              <strong>Bold text</strong> indicates UI elements such as button labels, field names, and menu items.
              <code style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: '3px', fontSize: '9pt' }}>Monospace text</code> indicates
              system values, role keys, or code references. The following callout boxes are used throughout:
            </p>
            <div className="info-box tip"><div className="box-label">💡 Tip</div>Helpful hints to improve your experience.</div>
            <div className="info-box info"><div className="box-label">ℹ️ Information</div>Important context or background detail.</div>
            <div className="info-box warning"><div className="box-label">⚠️ Warning</div>Actions that may have significant consequences.</div>
            <div className="info-box note"><div className="box-label">📝 Note</div>Additional notes or clarifications.</div>

            {/* ── SECTION 2: GETTING STARTED ── */}
            <h2 className="section-title">
              <span className="section-num-badge">2</span>
              Getting Started
            </h2>

            <h3 className="sub-title"><span className="sub-num">2.1</span> System Requirements</h3>
            <table className="data-table no-break">
              <thead><tr><th>Requirement</th><th>Specification</th></tr></thead>
              <tbody>
                {[
                  ['Web Browser', 'Google Chrome 110+, Mozilla Firefox 110+, Microsoft Edge 110+, or Safari 16+'],
                  ['Internet Connection', 'Stable broadband connection (minimum 2 Mbps recommended)'],
                  ['Screen Resolution', 'Minimum 1280 × 720 pixels; 1920 × 1080 recommended'],
                  ['JavaScript', 'Must be enabled in the browser'],
                  ['Cookies', 'Must be enabled for session management'],
                  ['Mobile Devices', 'Supported on tablets and smartphones (responsive design)'],
                ]?.map(([req, spec]) => (
                  <tr key={req}><td><strong>{req}</strong></td><td>{spec}</td></tr>
                ))}
              </tbody>
            </table>

            <h3 className="sub-title"><span className="sub-num">2.2</span> Accessing the System</h3>
            <p className="body">The ECSA-HC PMS is accessible via any modern web browser. Open your browser and navigate to:</p>
            <div className="url-box">https://pms.ecsahc.int</div>
            <div className="info-box note">
              <div className="box-label">📝 Note</div>
              If you cannot access the URL above, contact the ECSA-HC ICT Support team. Do not attempt to access
              the system through unofficial links or bookmarks that may be outdated.
            </div>

            <h3 className="sub-title"><span className="sub-num">2.3</span> Logging In</h3>
            <p className="body">All users must authenticate with their ECSA-HC email address and password before accessing the system.</p>
            <div className="step-box"><div className="step-num">1</div><div className="step-content"><div className="step-title">Open the Login Page</div><div className="step-body">Navigate to <strong>https://pms.ecsahc.int</strong> in your browser. The login page will display the ECSA-HC logo and a sign-in form.</div></div></div>
            <div className="step-box"><div className="step-num">2</div><div className="step-content"><div className="step-title">Enter Your Credentials</div><div className="step-body">Type your <strong>ECSA-HC email address</strong> (e.g., <code style={{ background: '#f1f5f9', padding: '1px 4px', borderRadius: '3px', fontSize: '9pt' }}>yourname@ecsahc.org</code>) and your <strong>Password</strong>.</div></div></div>
            <div className="step-box"><div className="step-num">3</div><div className="step-content"><div className="step-title">Click Sign In</div><div className="step-body">Click the <strong>Sign In</strong> button. If your credentials are correct, you will be redirected to the Performance Dashboard.</div></div></div>
            <div className="step-box"><div className="step-num">4</div><div className="step-content"><div className="step-title">First-Time Login</div><div className="step-body">If this is your first login, the system may prompt you to <strong>change your password</strong>. Follow the on-screen instructions.</div></div></div>
            <div className="info-box warning">
              <div className="box-label">⚠️ Warning</div>
              If you enter incorrect credentials three or more times, your account may be temporarily locked.
              Contact the HR &amp; Admin Officer or ICT Support to unlock your account.
            </div>

            <h3 className="sub-title"><span className="sub-num">2.4</span> Changing Your Password</h3>
            <p className="body">Navigate to <strong>Change Password</strong> from your profile settings or follow the prompt on first login.</p>
            <ul className="body-list">
              <li>Enter your <strong>current password</strong></li>
              <li>Enter a <strong>new password</strong> (minimum 8 characters, must include uppercase, lowercase, and a number)</li>
              <li>Confirm the new password and click <strong>Update Password</strong></li>
            </ul>

            <h3 className="sub-title"><span className="sub-num">2.5</span> Navigating the Interface</h3>
            <p className="body">The ECSA-HC PMS uses a consistent layout across all screens. The main interface consists of:</p>
            <table className="data-table no-break">
              <thead><tr><th>Component</th><th>Description</th></tr></thead>
              <tbody>
                {[
                  ['Left Sidebar', 'Primary navigation panel. Contains all module links grouped by category: Performance, Development, Organisation, and Intelligence. Can be collapsed to icon-only view.'],
                  ['Top Header', 'Displays the current module name, notification bell, and user profile. The notification bell shows pending actions.'],
                  ['Main Content Area', 'Central area where module content is displayed. Most modules use tabs to organise content into logical sections.'],
                  ['Breadcrumb Trail', 'Shows your current location within the system hierarchy, allowing quick navigation back to parent sections.'],
                ]?.map(([comp, desc]) => (
                  <tr key={comp}><td><strong>{comp}</strong></td><td>{desc}</td></tr>
                ))}
              </tbody>
            </table>

            <h3 className="sub-title"><span className="sub-num">2.6</span> User Roles &amp; Access Levels</h3>
            <p className="body">The ECSA-HC PMS uses role-based access control. Each user is assigned a system role that determines which modules they can access and what actions they can perform.</p>
            <table className="data-table no-break">
              <thead><tr><th>Role</th><th>System Key</th><th>Access Description</th></tr></thead>
              <tbody>
                {[
                  ['Director General', 'executive_director', 'Full system access and final approval authority'],
                  ['Director (Operations & Institutional Dev.)', 'deputy_director', 'Broad access with approval rights for reviews'],
                  ['Director (Programme)', 'programme_manager', 'Manages programme staff and approves their reviews'],
                  ['Finance Manager', 'finance_manager', 'Manages finance team and approves their reviews'],
                  ['HR & Admin Officer', 'hr_admin_officer', 'Manages staff records and system permissions'],
                  ['Programme Officer', 'programme_officer', 'Submits own reviews, views programme content'],
                  ['Finance Officer', 'finance_officer', 'Submits own reviews, limited screen access'],
                  ['Admin Officer', 'admin_officer', 'Submits own reviews, limited screen access'],
                  ['Project Coordinator', 'project_coordinator', 'Submits own reviews, views project content'],
                ]?.map(([role, key, access]) => (
                  <tr key={key}><td><strong>{role}</strong></td><td><code style={{ fontSize: '8.5pt', color: '#555' }}>{key}</code></td><td>{access}</td></tr>
                ))}
              </tbody>
            </table>
            <div className="info-box note">
              <div className="box-label">📝 Note</div>
              Role assignments are managed by the HR &amp; Admin Officer through the <strong>Permissions</strong> module.
              Contact HR if you believe your role assignment is incorrect.
            </div>

            {/* ── SECTION 3: PERFORMANCE DASHBOARD ── */}
            <h2 className="section-title">
              <span className="section-num-badge">3</span>
              Performance Dashboard
            </h2>
            <p className="body">
              The Performance Dashboard is the home screen of the ECSA-HC PMS. It provides a live, real-time
              snapshot of organisational performance for the current quarter, aligned with the ECSA-HC Strategic Plan 2024–2034.
            </p>

            <h3 className="sub-title"><span className="sub-num">3.1</span> Dashboard Overview</h3>
            <p className="body">Upon logging in, users are directed to the Performance Dashboard. The dashboard is role-sensitive — the data and widgets displayed depend on your assigned role:</p>
            <ul className="body-list">
              <li><strong>Director General / Deputy Director</strong> — Organisation-wide view across all directorates</li>
              <li><strong>Programme / Finance Manager</strong> — Directorate-scoped view for their team</li>
              <li><strong>HR &amp; Admin Officer</strong> — Full staff performance overview with management tools</li>
              <li><strong>Staff Members</strong> — Personal performance summary and pending actions</li>
            </ul>

            <h3 className="sub-title"><span className="sub-num">3.2</span> KPI Metric Cards</h3>
            <table className="data-table no-break">
              <thead><tr><th>Metric</th><th>Description</th><th>Colour Coding</th></tr></thead>
              <tbody>
                {[
                  ['Total Reviews', 'Total number of appraisal records across all periods', 'Neutral (grey)'],
                  ['Submitted', 'Reviews submitted by staff members', 'Sky blue — submission rate shown as %'],
                  ['Approved', 'Reviews fully approved by managers', 'Emerald green'],
                  ['Avg Supervisor Rating', 'Average rating given by supervisors (out of 5)', 'Violet'],
                  ['Active Staff', 'Total staff members currently in the system', 'Teal'],
                  ['Pending', 'Reviews awaiting action', 'Amber — requires attention'],
                ]?.map(([m, d, c]) => (
                  <tr key={m}><td><strong>{m}</strong></td><td>{d}</td><td style={{ fontSize: '8.5pt', color: '#666' }}>{c}</td></tr>
                ))}
              </tbody>
            </table>

            <h3 className="sub-title"><span className="sub-num">3.3</span> BSC Perspective Chart</h3>
            <p className="body">The Balanced Scorecard (BSC) chart visualises performance across the four BSC perspectives for the current fiscal year:</p>
            <div className="bsc-grid">
              <div className="bsc-card" style={{ borderColor: '#22c55e', background: '#f0fdf4', color: '#166534' }}>Financial</div>
              <div className="bsc-card" style={{ borderColor: '#3b82f6', background: '#eff6ff', color: '#1e40af' }}>Customer</div>
              <div className="bsc-card" style={{ borderColor: '#8b5cf6', background: '#f5f3ff', color: '#5b21b6' }}>Internal Processes</div>
              <div className="bsc-card" style={{ borderColor: '#f59e0b', background: '#fffbeb', color: '#92400e' }}>Learning &amp; Growth</div>
            </div>

            <h3 className="sub-title"><span className="sub-num">3.4</span> KPI Trend Chart</h3>
            <p className="body">The KPI Trend Chart shows month-by-month performance trends over the selected period. Use this chart to identify seasonal patterns, the impact of training interventions, or performance dips that require management attention.</p>

            <h3 className="sub-title"><span className="sub-num">3.5</span> At-Risk Staff Table</h3>
            <p className="body">The At-Risk Staff Table lists staff members whose performance scores fall below the defined threshold, requiring immediate managerial attention. Columns include: staff name and directorate, current performance score, last review date, and recommended action.</p>
            <div className="info-box warning">
              <div className="box-label">⚠️ Warning</div>
              Staff appearing in the At-Risk table should be contacted by their supervisor within 5 working days to discuss a performance improvement plan.
            </div>

            <h3 className="sub-title"><span className="sub-num">3.6</span> Strategic Plan Section</h3>
            <p className="body">The Strategic Plan Section displays the full <strong>ECSA-HC Strategic Plan 2024–2034</strong>, including Vision, Mission, Core Values, Five Strategic Pillars, and Nine Strategic Objectives. Click any Strategic Objective card to expand it and view its KPIs, cluster ownership, and timeline.</p>

            {/* ── SECTION 4: EVALUATION & REVIEWS ── */}
            <h2 className="section-title">
              <span className="section-num-badge">4</span>
              Evaluation &amp; Reviews
            </h2>
            <p className="body">The Evaluation &amp; Reviews module manages the full appraisal lifecycle for all staff members. It covers workplan setup, self-evaluations, supervisor reviews, side-by-side comparisons, and final approvals.</p>

            <h3 className="sub-title"><span className="sub-num">4.1</span> Module Overview</h3>
            <p className="body">The appraisal lifecycle follows this structured workflow:</p>
            <div className="workflow">
              {['Workplan Setup', 'Self-Assessment', 'Manager Review', 'Evaluation Comparison', 'Final Approval']?.map((s, i, arr) => (
                <React.Fragment key={s}>
                  <div className="workflow-step" style={{ borderColor: ['#3b82f6','#14b8a6','#f59e0b','#8b5cf6','#22c55e']?.[i], background: ['#eff6ff','#f0fdfa','#fffbeb','#f5f3ff','#f0fdf4']?.[i], color: ['#1e40af','#0f766e','#92400e','#5b21b6','#166534']?.[i] }}>{s}</div>
                  {i < arr?.length - 1 && <span className="workflow-arrow">→</span>}
                </React.Fragment>
              ))}
            </div>

            <h3 className="sub-title"><span className="sub-num">4.2</span> Workplan Setup</h3>
            <div className="step-box"><div className="step-num">1</div><div className="step-content"><div className="step-title">Open Workplan Settings</div><div className="step-body">Navigate to <strong>Evaluation &amp; Reviews</strong> → <strong>Overview</strong> tab → click <strong>Workplan Settings</strong>.</div></div></div>
            <div className="step-box"><div className="step-num">2</div><div className="step-content"><div className="step-title">Select Staff Member and Fiscal Year</div><div className="step-body">Choose the staff member and the fiscal year for which the workplan is being set up.</div></div></div>
            <div className="step-box"><div className="step-num">3</div><div className="step-content"><div className="step-title">Configure KPIs and Weights</div><div className="step-body">Add KPIs relevant to the staff member's role. Assign weights to each KPI (total must equal 100%). Set competency weights and the review period dates.</div></div></div>
            <div className="step-box"><div className="step-num">4</div><div className="step-content"><div className="step-title">Save the Workplan</div><div className="step-body">Click <strong>Save Workplan</strong>. The workplan status will be set to <em>Draft</em>. The staff member can now begin their self-assessment.</div></div></div>

            <h3 className="sub-title"><span className="sub-num">4.3</span> Review Table</h3>
            <p className="body">The Review Table lists all staff evaluations with the following columns: staff name, directorate, and review period; Status (Submitted / Reviewed / Approved / Rejected); self-rating and supervisor rating; action icons: 👁 View details, ⚖ Open comparison modal, 🖨 Print appraisal.</p>

            <h3 className="sub-title"><span className="sub-num">4.4</span> Evaluation Form</h3>
            <p className="body">The Evaluation Form captures KPI scores, competency ratings, and overall comments for a staff member. KPIs are weighted; the system auto-calculates the weighted average score. Supervisors can add narrative comments for each KPI.</p>

            <h3 className="sub-title"><span className="sub-num">4.5</span> Evaluation Comparison Modal</h3>
            <table className="data-table no-break">
              <thead><tr><th>Tab</th><th>Content</th></tr></thead>
              <tbody>
                {[
                  ['KPI Comparison', 'Staff self-rating vs supervisor rating per KPI, with a variance badge showing the difference'],
                  ['Competency Comparison', 'All 5 general competencies shown side-by-side (self vs supervisor)'],
                  ['Overall Feedback', 'Narrative comments from both staff and supervisor, plus approval/rejection controls'],
                ]?.map(([tab, content]) => (
                  <tr key={tab}><td><strong>{tab}</strong></td><td>{content}</td></tr>
                ))}
              </tbody>
            </table>

            <h3 className="sub-title"><span className="sub-num">4.6</span> Print Appraisal Layout</h3>
            <p className="body">The Print Appraisal Layout generates a formatted, print-ready view of the full appraisal record, including staff details, all KPI scores, competency ratings, narrative comments, and approval signatures.</p>
            <div className="step-box"><div className="step-num">1</div><div className="step-content"><div className="step-title">Open Print Layout</div><div className="step-body">Click the <strong>🖨</strong> icon on any evaluation row in the Review Table.</div></div></div>
            <div className="step-box"><div className="step-num">2</div><div className="step-content"><div className="step-title">Print or Save as PDF</div><div className="step-body">Use your browser's Print function (<strong>Ctrl+P</strong> on Windows / <strong>Cmd+P</strong> on Mac) to print or save as PDF.</div></div></div>

            <h3 className="sub-title"><span className="sub-num">4.7</span> Workplan List View</h3>
            <p className="body">The Workplan List View is displayed on the Overview tab and shows all workplans grouped by fiscal year in collapsible accordion panels.</p>
            <ul className="body-list">
              <li>Click a <strong>fiscal year panel</strong> to expand it — data loads on demand</li>
              <li>Filter by Status or Stage using the dropdowns at the top of each panel</li>
              <li>Click <strong>Open</strong> on any row to view the full workplan form</li>
              <li>Staff members only see their own workplan; managers see their direct reports</li>
            </ul>

            {/* ── SECTION 5: SELF-ASSESSMENT ── */}
            <h2 className="section-title">
              <span className="section-num-badge">5</span>
              Self-Assessment
            </h2>
            <p className="body">The Self-Assessment module allows staff members to complete their own performance evaluation through a guided 6-step wizard. This is the first step in the appraisal lifecycle.</p>

            <h3 className="sub-title"><span className="sub-num">5.1</span> Self-Assessment Wizard Overview</h3>
            <p className="body">The wizard guides you through six sequential steps. Progress is shown in the step indicator at the top of the page. You can navigate back to previous steps to review or edit before submitting.</p>
            <table className="data-table no-break">
              <thead><tr><th>Step</th><th>Title</th><th>Description</th></tr></thead>
              <tbody>
                {[
                  ['1', 'Select Workplan', 'Choose the active workplan for the review period'],
                  ['2', 'KPI Assessment', 'Rate your performance on each assigned KPI (1–5 scale)'],
                  ['3', 'General Competencies', 'Rate yourself on the five general competencies'],
                  ['4', 'Objectives & Goals', 'Report achievement status and completion percentage for each objective'],
                  ['5', 'Overall Reflection', 'Write a free-text summary of your performance for the period'],
                  ['6', 'Sign & Submit', 'Review your summary, tick the declaration, and submit'],
                ]?.map(([step, title, desc]) => (
                  <tr key={step}><td style={{ textAlign: 'center', fontWeight: 700, color: '#1a3a5c' }}>{step}</td><td><strong>{title}</strong></td><td>{desc}</td></tr>
                ))}
              </tbody>
            </table>

            <h3 className="sub-title"><span className="sub-num">5.3</span> Step 2 – KPI Assessment</h3>
            <p className="body">Rate your performance on each assigned KPI using the <strong>1–5 scale</strong>:</p>
            <table className="data-table no-break">
              <thead><tr><th style={{ width: '60px', textAlign: 'center' }}>Rating</th><th>Performance Level</th></tr></thead>
              <tbody>
                {[
                  ['1', 'Far Below Expectations — Performance significantly below required standard'],
                  ['2', 'Below Expectations — Performance partially meets required standard'],
                  ['3', 'Meets Expectations — Performance fully meets required standard'],
                  ['4', 'Exceeds Expectations — Performance consistently above required standard'],
                  ['5', 'Exceptional — Outstanding performance, significantly exceeds all expectations'],
                ]?.map(([r, d]) => (
                  <tr key={r}><td style={{ textAlign: 'center', fontWeight: 700, color: '#1a3a5c' }}>{r}</td><td>{d}</td></tr>
                ))}
              </tbody>
            </table>

            <h3 className="sub-title"><span className="sub-num">5.4</span> Step 3 – General Competencies</h3>
            <p className="body">Rate yourself on the five general competencies using the same 1–5 scale:</p>
            <ul className="body-list">
              <li><strong>Communication</strong> — Clarity, effectiveness, and appropriateness of communication</li>
              <li><strong>Teamwork</strong> — Collaboration, cooperation, and contribution to team goals</li>
              <li><strong>Initiative</strong> — Proactiveness, problem-solving, and self-direction</li>
              <li><strong>Leadership</strong> — Guidance, motivation, and influence on others</li>
              <li><strong>Professionalism</strong> — Conduct, ethics, and adherence to organisational values</li>
            </ul>

            <h3 className="sub-title"><span className="sub-num">5.7</span> Step 6 – Sign &amp; Submit</h3>
            <div className="step-box"><div className="step-num">1</div><div className="step-content"><div className="step-title">Review Your Summary</div><div className="step-body">Check all ratings and comments. Use the Back button to return to any step if corrections are needed.</div></div></div>
            <div className="step-box"><div className="step-num">2</div><div className="step-content"><div className="step-title">Tick the Declaration</div><div className="step-body">Tick the declaration checkbox to confirm that the information provided is accurate and complete.</div></div></div>
            <div className="step-box"><div className="step-num">3</div><div className="step-content"><div className="step-title">Click Submit</div><div className="step-body">Click <strong>Submit</strong> to send your self-assessment to your manager for review. The workplan workflow stage will advance automatically.</div></div></div>
            <div className="info-box warning">
              <div className="box-label">⚠️ Warning</div>
              Once submitted, you cannot edit your self-assessment. Contact HR if corrections are needed after submission.
            </div>

            {/* ── SECTION 6: MANAGER REVIEW ── */}
            <h2 className="section-title">
              <span className="section-num-badge">6</span>
              Manager Review
            </h2>
            <p className="body">The Manager Review module allows supervisors and managers to review submitted staff self-assessments, provide ratings and feedback, and make approval decisions.</p>

            <h3 className="sub-title"><span className="sub-num">6.1</span> Review Table</h3>
            <p className="body">The Manager Review screen lists all staff self-assessments submitted to you for review. Filter by status, review period, or search by staff name. Click the <strong>View</strong> icon on any row to open the Review Detail Modal.</p>

            <h3 className="sub-title"><span className="sub-num">6.2</span> Staff Self-Assessment Tab</h3>
            <p className="body">The first tab of the Review Detail Modal shows a read-only view of the staff member's self-assessment: KPI ratings, competency scores, objectives, challenges, and overall reflection. Use this tab to understand the staff member's perspective before entering your own ratings.</p>

            <h3 className="sub-title"><span className="sub-num">6.3</span> Manager Rating &amp; Feedback Tab</h3>
            <p className="body">The second tab is where you enter your assessment: rate each KPI and competency (1–5), add narrative feedback, and write approval comments or a rejection reason.</p>

            <h3 className="sub-title"><span className="sub-num">6.4</span> Approving or Rejecting a Review</h3>
            <div className="decision-grid">
              <div className="approve-box">
                <div className="box-head">✅ Approve</div>
                <ul className="body-list" style={{ marginBottom: 0 }}>
                  <li>Advances the workplan stage to <em>mid_year_approved</em></li>
                  <li>Requires approval comments</li>
                  <li>Two-step confirmation guard</li>
                  <li>Staff member is notified</li>
                </ul>
              </div>
              <div className="reject-box">
                <div className="box-head">❌ Reject</div>
                <ul className="body-list" style={{ marginBottom: 0 }}>
                  <li>Sets status to <em>Rejected</em></li>
                  <li>Requires a written rejection reason</li>
                  <li>Two-step confirmation guard</li>
                  <li>Staff member is notified with the reason</li>
                </ul>
              </div>
            </div>

            {/* ── SECTION 7: MID-YEAR REVIEWS ── */}
            <h2 className="section-title">
              <span className="section-num-badge">7</span>
              Mid-Year Reviews
            </h2>

            <h3 className="sub-title"><span className="sub-num">7.1</span> Module Overview</h3>
            <p className="body">The Mid-Year Reviews module provides a consolidated view of all mid-year appraisal records across all staff and directorates. Records are linked to workplan settings and track the full workflow from submission to final approval.</p>

            <h3 className="sub-title"><span className="sub-num">7.2</span> Review Statuses Explained</h3>
            <table className="data-table no-break">
              <thead><tr><th>Status</th><th>Meaning</th></tr></thead>
              <tbody>
                {[
                  ['Draft', 'The workplan is set up but the staff member has not yet submitted their self-assessment'],
                  ['Submitted', 'The staff member has completed and submitted their self-assessment'],
                  ['Reviewed', 'The manager has saved feedback but not yet made a final decision'],
                  ['Approved', 'The manager has approved the evaluation; the workflow advances to the next stage'],
                  ['Rejected', 'The manager has rejected the evaluation with a written reason; staff must resubmit'],
                ]?.map(([status, meaning]) => (
                  <tr key={status}><td><strong>{status}</strong></td><td>{meaning}</td></tr>
                ))}
              </tbody>
            </table>

            {/* ── SECTION 8: FEEDBACK & MENTORSHIP ── */}
            <h2 className="section-title">
              <span className="section-num-badge">8</span>
              Feedback &amp; Mentorship
            </h2>
            <p className="body">The Feedback &amp; Mentorship module facilitates structured feedback exchange, mentorship relationships, and peer knowledge-sharing among ECSA-HC staff.</p>

            <h3 className="sub-title"><span className="sub-num">8.1</span> Feedback Feed</h3>
            <p className="body">The Feedback Feed shows all feedback you have received and given, in chronological order. Categories include: <strong>Commendation</strong> (positive recognition), <strong>Developmental</strong> (constructive feedback), and <strong>Peer</strong> (feedback from colleagues).</p>

            <h3 className="sub-title"><span className="sub-num">8.2</span> Giving Feedback</h3>
            <div className="step-box"><div className="step-num">1</div><div className="step-content"><div className="step-title">Open the Give Feedback Modal</div><div className="step-body">Click the <strong>Give Feedback</strong> button on the Feedback &amp; Mentorship page.</div></div></div>
            <div className="step-box"><div className="step-num">2</div><div className="step-content"><div className="step-title">Select Recipient and Category</div><div className="step-body">Choose the staff member and the appropriate feedback category.</div></div></div>
            <div className="step-box"><div className="step-num">3</div><div className="step-content"><div className="step-title">Write and Submit</div><div className="step-body">Write your feedback message and click <strong>Submit Feedback</strong>. The recipient will be notified.</div></div></div>

            <h3 className="sub-title"><span className="sub-num">8.3</span> Mentor Directory</h3>
            <p className="body">Browse available mentors by expertise area, directorate, or availability. Click <strong>Request Mentorship</strong> on a mentor profile to initiate a mentorship relationship. The mentor will receive a notification and can accept or decline the request.</p>

            <h3 className="sub-title"><span className="sub-num">8.4</span> Upcoming Sessions Panel</h3>
            <p className="body">View all scheduled mentorship and peer exchange sessions. Sessions show the date, time, participants, and topic. Click a session to view details or join a virtual meeting link if provided.</p>

            <h3 className="sub-title"><span className="sub-num">8.5</span> Peer Exchange Panel</h3>
            <p className="body">The Peer Exchange Panel facilitates structured knowledge-sharing between colleagues. Post a topic for discussion or respond to existing peer exchange threads.</p>

            {/* ── SECTION 9: TRAINING & RESOURCES ── */}
            <h2 className="section-title">
              <span className="section-num-badge">9</span>
              Training &amp; Resources
            </h2>
            <p className="body">The Training &amp; Resources module provides access to training programmes, CPD tracking, professional certifications, and HR guidance documents.</p>

            <h3 className="sub-title"><span className="sub-num">9.1</span> Training Catalog</h3>
            <p className="body">Browse available training programmes by category, delivery mode, and duration. Modes include: <strong>Online</strong> (self-paced e-learning), <strong>In-Person</strong> (classroom/workshop), and <strong>Blended</strong> (combination). Click <strong>Enrol</strong> to register.</p>

            <h3 className="sub-title"><span className="sub-num">9.2</span> CPD Progress Table</h3>
            <p className="body">The CPD (Continuing Professional Development) Progress Table tracks your CPD hours and activities for the current year. Columns include activity name, category, hours, completion date, and CPD points earned.</p>

            <h3 className="sub-title"><span className="sub-num">9.3</span> Certification Tracker</h3>
            <p className="body">Lists all professional certifications held by the staff member, including issue date, expiry date, and renewal status. <strong>Amber highlight</strong> indicates approaching expiry (within 90 days); <strong>Red highlight</strong> indicates expired.</p>

            <h3 className="sub-title"><span className="sub-num">9.4</span> Guidance Documents</h3>
            <p className="body">A library of HR policies, performance management guidelines, and reference documents. Documents can be downloaded as PDF or viewed in-browser. Use the search bar to find documents by title or keyword.</p>

            {/* ── SECTION 10: STAFF MANAGEMENT ── */}
            <h2 className="section-title">
              <span className="section-num-badge">10</span>
              Staff Management
            </h2>
            <p className="body">The Staff Management module is used by HR &amp; Admin Officers to manage staff profiles, directorate assignments, and employment records. Access is restricted to HR Administrators and above.</p>

            <h3 className="sub-title"><span className="sub-num">10.1</span> Staff Directory</h3>
            <p className="body">The Staff Directory displays all staff members with their name, job title, directorate, cluster, and employment status. Search by name or filter by directorate, cluster, or status. Click a staff record to view or edit their full profile.</p>

            <h3 className="sub-title"><span className="sub-num">10.2</span> Adding &amp; Editing Staff</h3>
            <div className="step-box"><div className="step-num">1</div><div className="step-content"><div className="step-title">Click Add Staff</div><div className="step-body">Click the <strong>Add Staff</strong> button in the top-right corner of the Staff Directory.</div></div></div>
            <div className="step-box"><div className="step-num">2</div><div className="step-content"><div className="step-title">Fill in Required Fields</div><div className="step-body">Complete all required fields: Full Name, Job Title, Directorate, Cluster, Employment Type, and Start Date.</div></div></div>
            <div className="step-box"><div className="step-num">3</div><div className="step-content"><div className="step-title">Save the Record</div><div className="step-body">Click <strong>Save</strong>. The new staff member will appear in the directory immediately.</div></div></div>

            <h3 className="sub-title"><span className="sub-num">10.3</span> Directorates &amp; Clusters</h3>
            <p className="body">Staff are organised by Directorate and Cluster, reflecting the ECSA-HC organisational structure:</p>
            <div className="dir-grid">
              {['CHS', 'HSCD', 'FHID', 'MNFSN', 'KMME', 'DOF/BDU', 'DG/DOID', 'Secretariat']?.map((d) => (
                <div key={d} className="dir-badge">{d}</div>
              ))}
            </div>

            <h3 className="sub-title"><span className="sub-num">10.4</span> Staff Import</h3>
            <p className="body">The Staff Import feature allows bulk upload of staff records from a CSV or Excel file. Navigate to <strong>Staff Import</strong> from the sidebar (visible to HR Administrators only).</p>
            <ul className="body-list">
              <li>Download the import template to ensure correct column formatting</li>
              <li>Fill in staff data in the template and upload the completed file</li>
              <li>Review the preview and click <strong>Import</strong> to process the records</li>
            </ul>

            {/* ── SECTION 11: ANALYTICS & REPORTS ── */}
            <h2 className="section-title">
              <span className="section-num-badge">11</span>
              Analytics &amp; Reports
            </h2>
            <p className="body">The Analytics &amp; Reports module provides organisation-wide performance analytics, external framework tracking, and data export tools. Access is restricted to managers and above. The module is organised into five tabs: <strong>Overview</strong>, <strong>External Frameworks</strong>, <strong>BSC Scorecard</strong>, <strong>Export Reports</strong>, and <strong>Data Quality</strong>.</p>

            <h3 className="sub-title"><span className="sub-num">11.1</span> KPI Year-on-Year Chart</h3>
            <p className="body">Compares KPI performance across multiple fiscal years to identify long-term trends. Use the year selector to choose which years to compare. Hover over data points for exact values.</p>

            <h3 className="sub-title"><span className="sub-num">11.2</span> BSC Scorecard Matrix</h3>
            <p className="body">A matrix view of Balanced Scorecard performance across all directorates and perspectives. Cells are colour-coded: <strong style={{ color: '#166534' }}>≥80% — On Track</strong>, <strong style={{ color: '#92400e' }}>60–79% — Needs Attention</strong>, <strong style={{ color: '#991b1b' }}>&lt;60% — At Risk</strong>. Click a cell to drill down into the underlying KPI data.</p>

            <h3 className="sub-title"><span className="sub-num">11.3</span> JEESP-AR Chart</h3>
            <p className="body">Tracks performance against the <strong>Joint External Evaluation of State Party Abilities for Reporting (JEESP-AR)</strong> framework indicators. Shows progress scores for each technical area assessed, enabling ECSA-HC to monitor compliance with international health security standards.</p>

            <h3 className="sub-title"><span className="sub-num">11.4</span> HEPRR Progress Chart</h3>
            <p className="body">Monitors progress on <strong>Health Emergency Preparedness, Response, and Resilience (HEPRR)</strong> indicators. Displays current scores against targets for each HEPRR domain.</p>

            <h3 className="sub-title"><span className="sub-num">11.5</span> WBN-o-Pipeline Table</h3>
            <p className="body">Lists World Bank No-Pipeline projects and their performance status. Columns include project name, directorate, budget, disbursement rate, and current status.</p>

            <h3 className="sub-title"><span className="sub-num">11.6</span> Reports Export Panel</h3>
            <table className="data-table no-break">
              <thead><tr><th>Report Type</th><th>Description</th></tr></thead>
              <tbody>
                {[
                  ['Staff Performance Summary', 'Individual staff performance scores across all KPIs and competencies'],
                  ['Directorate Scorecard', 'Aggregated BSC scores by directorate for the selected period'],
                  ['KPI Trend Report', 'Month-by-month KPI performance trends for the selected fiscal year'],
                  ['Evaluation Completion Report', 'Submission and approval rates by directorate and review period'],
                ]?.map(([type, desc]) => (
                  <tr key={type}><td><strong>{type}</strong></td><td>{desc}</td></tr>
                ))}
              </tbody>
            </table>
            <div className="step-box"><div className="step-num">1</div><div className="step-content"><div className="step-title">Select Report Parameters</div><div className="step-body">Choose the report type, date range, and directorate filter from the Export Reports tab.</div></div></div>
            <div className="step-box"><div className="step-num">2</div><div className="step-content"><div className="step-title">Generate &amp; Download</div><div className="step-body">Click <strong>Generate Report</strong>, then <strong>Download</strong> to save the file to your computer.</div></div></div>

            {/* ── SECTION 12: PERMISSIONS ── */}
            <h2 className="section-title">
              <span className="section-num-badge">12</span>
              Permissions
            </h2>
            <p className="body">The Permissions module allows HR Administrators and System Administrators to manage user roles and module access levels across the system.</p>

            <h3 className="sub-title"><span className="sub-num">12.2</span> Assigning Roles</h3>
            <div className="step-box"><div className="step-num">1</div><div className="step-content"><div className="step-title">Find the User</div><div className="step-body">Navigate to <strong>Permissions</strong> in the sidebar. Search for the user by name or email.</div></div></div>
            <div className="step-box"><div className="step-num">2</div><div className="step-content"><div className="step-title">Select and Assign the Role</div><div className="step-body">Click on the user's current role badge to open the role selector dropdown. Select the desired role and click <strong>Assign Role</strong>. The change takes effect immediately on the user's next page load.</div></div></div>

            <h3 className="sub-title"><span className="sub-num">12.3</span> Module Permission Matrix</h3>
            <p className="body">The Permission Matrix table shows access levels for each role across all system modules. Each module can be configured with the following permissions per role:</p>
            <div className="perm-grid">
              {[
                { label: 'View', bg: '#eff6ff', color: '#1e40af' },
                { label: 'Create', bg: '#f0fdf4', color: '#166534' },
                { label: 'Edit', bg: '#fffbeb', color: '#92400e' },
                { label: 'Delete', bg: '#fef2f2', color: '#991b1b' },
                { label: 'Approve', bg: '#f5f3ff', color: '#5b21b6' },
              ]?.map((p) => (
                <div key={p?.label} className="perm-badge" style={{ background: p?.bg, color: p?.color }}>{p?.label}</div>
              ))}
            </div>

            {/* ── SECTION 13: ADMIN DASHBOARD ── */}
            <h2 className="section-title">
              <span className="section-num-badge">13</span>
              Admin Dashboard
            </h2>

            <h3 className="sub-title"><span className="sub-num">13.1</span> Admin Overview</h3>
            <p className="body">The Admin Dashboard provides system administrators and HR Officers with a high-level operational view of the PMS, including user activity, system performance metrics, and pending administrative actions. Access is restricted to HR Administrators and System Administrators.</p>

            <h3 className="sub-title"><span className="sub-num">13.2</span> Appraisal Audit Trail</h3>
            <p className="body">The Appraisal Audit Trail records all significant actions taken within the system, providing a complete, tamper-evident log for compliance and governance purposes. The audit trail captures:</p>
            <ul className="body-list">
              <li>User login and logout events</li>
              <li>Workplan creation, modification, and deletion</li>
              <li>Self-assessment submissions</li>
              <li>Manager review actions (Save, Approve, Reject)</li>
              <li>Role and permission changes</li>
              <li>Staff record additions and edits</li>
            </ul>
            <p className="body">Audit records can be exported to Excel or PDF using the <strong>Export Audit Trail</strong> button. Filter by date range, user, action type, or module to narrow results.</p>

            <h3 className="sub-title"><span className="sub-num">13.3</span> System Health</h3>
            <p className="body">The System Health module provides real-time monitoring of the PMS infrastructure, including: database connection status, API response times and error rates, active user sessions, background job status, and storage usage.</p>
            <div className="info-box note">
              <div className="box-label">📝 Note</div>
              System Health is visible to System Administrators only. If you observe any red indicators, contact the ECSA-HC ICT Support team immediately.
            </div>

            {/* ── SECTION 14: TROUBLESHOOTING ── */}
            <h2 className="section-title">
              <span className="section-num-badge">14</span>
              Troubleshooting &amp; Support
            </h2>

            <h3 className="sub-title"><span className="sub-num">14.1</span> Common Issues</h3>
            <table className="data-table no-break">
              <thead><tr><th>Issue</th><th>Resolution</th></tr></thead>
              <tbody>
                {[
                  ['Cannot log in — "Invalid email or password" error', 'Verify your email address is correct. Ensure Caps Lock is not on. If you have forgotten your password, contact HR to reset it. After 3 failed attempts, your account may be locked — contact ICT Support.'],
                  ['Workplan not visible in Self-Assessment', 'Your workplan may not have been set up yet, or it may be in the wrong workflow stage. Contact your HR Officer to confirm your workplan has been created and is in the correct stage.'],
                  ['Cannot submit self-assessment — Submit button is greyed out', 'All steps must be completed before submission. Check that you have rated all KPIs, all competencies, and ticked the declaration checkbox on Step 6.'],
                  ['Dashboard shows no data', 'Ensure you are connected to the internet. Refresh the page (Ctrl+R / Cmd+R). If the issue persists, clear your browser cache and try again.'],
                  ['Cannot access a module — "Access Denied" message', 'Your role may not have permission to access that module. Contact your HR Officer to review your role assignment.'],
                  ['Report download not starting', 'Check that your browser is not blocking pop-ups or downloads. Allow downloads from the PMS domain in your browser settings.'],
                  ['Page loads slowly or times out', 'Check your internet connection. Large reports and analytics pages may take longer to load. If the issue persists, contact ICT Support.'],
                  ['ERR_INTERNET_DISCONNECTED', 'Check your network cables or Wi-Fi connection. Reconnect to your network and refresh the page. If on mobile data, check your signal strength.'],
                ]?.map(([issue, res]) => (
                  <tr key={issue}><td style={{ color: '#991b1b', fontWeight: 600, fontSize: '9pt' }}>❗ {issue}</td><td style={{ fontSize: '9pt' }}>✅ {res}</td></tr>
                ))}
              </tbody>
            </table>

            <h3 className="sub-title"><span className="sub-num">14.2</span> Contacting Support</h3>
            <p className="body">If you encounter an issue not covered in this manual, contact the ECSA-HC ICT Support team:</p>
            <table className="data-table no-break">
              <thead><tr><th>Contact Point</th><th>Details</th></tr></thead>
              <tbody>
                {[
                  ['Email', 'ict@ecsahc.int'],
                  ['System URL', 'https://pms.ecsahc.int'],
                  ['Office Hours', 'Monday – Friday, 08:00 – 17:00 EAT'],
                  ['Location', 'ECSA-HC Secretariat, Arusha, Tanzania'],
                ]?.map(([label, value]) => (
                  <tr key={label}><td><strong>{label}</strong></td><td>{value}</td></tr>
                ))}
              </tbody>
            </table>
            <div className="info-box tip">
              <div className="box-label">💡 Tip</div>
              When contacting support, please include: your full name, email address, the module you were using,
              a description of the issue, and a screenshot if possible. This helps the ICT team resolve your issue faster.
            </div>

            {/* ══════════════════════════════════════════════════════════
                APPENDICES
            ══════════════════════════════════════════════════════════ */}
            <h2 className="section-title">
              <span className="section-num-badge" style={{ background: '#4b5563' }}>A</span>
              Appendix A — Record of Changes
            </h2>
            <table className="appendix-table no-break">
              <thead><tr><th>Version</th><th>Date</th><th>Author</th><th>Description</th></tr></thead>
              <tbody>
                <tr><td><em>1.0</em></td><td><em>September 2026</em></td><td><em>ECSA-HC ICT Unit</em></td><td><em>1<sup>st</sup> Release — Initial publication of the ECSA-HC PMS User Manual</em></td></tr>
              </tbody>
            </table>

            <h2 className="section-title">
              <span className="section-num-badge" style={{ background: '#4b5563' }}>B</span>
              Appendix B — Glossary
            </h2>
            <table className="appendix-table no-break">
              <thead><tr><th>Term</th><th>Definition</th></tr></thead>
              <tbody>
                {[
                  ['BSC', 'Balanced Scorecard — A strategic planning and management framework that tracks performance across four perspectives: Financial, Customer, Internal Processes, and Learning & Growth.'],
                  ['CPD', 'Continuing Professional Development — Structured learning activities that maintain and develop professional skills and knowledge.'],
                  ['ECSA-HC', 'East, Central & Southern Africa Health Community — The regional intergovernmental organisation for health in East, Central, and Southern Africa.'],
                  ['HEPRR', 'Health Emergency Preparedness, Response, and Resilience — A framework for assessing and improving health emergency capabilities.'],
                  ['JEESP-AR', 'Joint External Evaluation of State Party Abilities for Reporting — An international framework for evaluating health security capacities.'],
                  ['KPI', 'Key Performance Indicator — A measurable value that demonstrates how effectively an individual or organisation is achieving key objectives.'],
                  ['PMS', 'Performance Management System — The ECSA-HC web-based platform for managing staff performance, evaluations, and professional development.'],
                  ['RLS', 'Row-Level Security — A database security feature that restricts which rows a user can access based on their role.'],
                  ['Workplan', 'A structured document that defines the KPIs, competencies, objectives, and targets for a staff member for a given review period.'],
                ]?.map(([term, def]) => (
                  <tr key={term}><td><strong>{term}</strong></td><td>{def}</td></tr>
                ))}
              </tbody>
            </table>

            <h2 className="section-title">
              <span className="section-num-badge" style={{ background: '#4b5563' }}>C</span>
              Appendix C — Support Contacts
            </h2>
            <table className="appendix-table no-break">
              <thead><tr><th>Name</th><th>Role</th><th>Contact</th></tr></thead>
              <tbody>
                <tr><td><strong>ECSA-HC ICT Support</strong></td><td>System Administration &amp; Technical Support</td><td>ict@ecsahc.int</td></tr>
                <tr><td><strong>HR &amp; Admin Officer</strong></td><td>User Account Management &amp; Role Assignments</td><td>hr@ecsahc.int</td></tr>
              </tbody>
            </table>

            <h2 className="section-title">
              <span className="section-num-badge" style={{ background: '#4b5563' }}>D</span>
              Appendix D — Approvals
            </h2>
            <table className="appendix-table no-break">
              <thead><tr><th>Name</th><th>Title</th><th>Signature</th><th>Date</th></tr></thead>
              <tbody>
                <tr>
                  <td>Director General</td>
                  <td>East, Central &amp; Southern Africa Health Community</td>
                  <td style={{ color: '#999', fontStyle: 'italic' }}>_______________________</td>
                  <td>September 2026</td>
                </tr>
                <tr>
                  <td>HR &amp; Admin Officer</td>
                  <td>ECSA-HC Secretariat</td>
                  <td style={{ color: '#999', fontStyle: 'italic' }}>_______________________</td>
                  <td>September 2026</td>
                </tr>
              </tbody>
            </table>

            {/* Document Footer */}
            <div style={{ marginTop: '48px', paddingTop: '20px', borderTop: '2px solid #1a3a5c', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/assets/images/ecsahc_web_logo1-1-1774467575072.png" alt="ECSA-HC Logo" style={{ width: '40px', height: '40px', objectFit: 'contain' }} />
                <div>
                  <div style={{ fontWeight: 700, color: '#1a3a5c', fontSize: '10pt' }}>ECSA-HC Performance Management System</div>
                  <div style={{ fontSize: '8pt', color: '#888' }}>User Manual — Version 1.0 — September 2026</div>
                </div>
              </div>
              <div style={{ textAlign: 'right', fontSize: '8pt', color: '#888' }}>
                <div>© 2026 East, Central &amp; Southern Africa Health Community</div>
                <div>All rights reserved. Internal use only.</div>
              </div>
            </div>

          </div>{/* end content-page */}
        </div>{/* end document */}
      </div>{/* end document-wrapper */}
    </>
  );
}
