'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { toast } from 'sonner';

const REPORT_TEMPLATES = [
  {
    id: 'rpt-001',
    title: 'Q1 FY2026 Organizational Performance Report',
    description: 'Full BSC scorecard, KPI achievement by role, at-risk summary, and framework indicator status.',
    format: 'PDF',
    pages: 24,
    lastGenerated: '25 Mar 2026',
    icon: 'DocumentChartBarIcon',
    iconBg: 'bg-primary/10',
    iconColor: 'text-primary',
  },
  {
    id: 'rpt-002',
    title: 'HEPRR-MPA Semi-Annual Progress Report',
    description: 'World Bank reporting template with PDO indicators, financial absorption rate, and implementation milestones.',
    format: 'DOCX',
    pages: 18,
    lastGenerated: '1 Mar 2026',
    icon: 'ShieldCheckIcon',
    iconBg: 'bg-teal-50',
    iconColor: 'text-teal-600',
  },
  {
    id: 'rpt-003',
    title: 'Staff CPD & Training Compliance Report',
    description: 'Individual CPD completion status, certification progress, training hours logged, and compliance gaps.',
    format: 'XLSX',
    pages: 6,
    lastGenerated: '20 Mar 2026',
    icon: 'AcademicCapIcon',
    iconBg: 'bg-violet-50',
    iconColor: 'text-violet-600',
  },
  {
    id: 'rpt-004',
    title: 'Mid-Year Review Completion Status Report',
    description: 'Review submission status by staff and role, overdue reviews, self vs supervisor score comparison.',
    format: 'PDF',
    pages: 12,
    lastGenerated: '25 Mar 2026',
    icon: 'ClipboardDocumentCheckIcon',
    iconBg: 'bg-sky-50',
    iconColor: 'text-sky-600',
  },
  {
    id: 'rpt-005',
    title: 'JEE/SPAR Capacity Assessment Summary',
    description: '13 IHR core capacities with JEE and SPAR scores, trend analysis, and HEPRR-MPA indicator linkage.',
    format: 'PDF',
    pages: 16,
    lastGenerated: '15 Mar 2026',
    icon: 'GlobeAltIcon',
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
  },
  {
    id: 'rpt-006',
    title: 'Financial Performance & Audit Readiness Report',
    description: 'Budget variance, cost recovery rate, ERP adoption, audit findings summary, and ISO compliance status.',
    format: 'PDF',
    pages: 20,
    lastGenerated: '28 Feb 2026',
    icon: 'BanknotesIcon',
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
  },
];

const FORMAT_COLORS: Record<string, string> = {
  'PDF': 'bg-red-50 text-red-700 border-red-200',
  'DOCX': 'bg-sky-50 text-sky-700 border-sky-200',
  'XLSX': 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export default function ReportsExportPanel() {
  const [generating, setGenerating] = useState<string | null>(null);

  const handleGenerate = async (id: string, title: string) => {
    setGenerating(id);
    // Backend integration point: POST /api/reports/generate
    await new Promise(r => setTimeout(r, 1200));
    setGenerating(null);
    toast.success(`Report generated: "${title}"`, { description: 'Your report is ready to download.' });
  };

  return (
    <div className="bg-white rounded-xl border border-border shadow-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-700 text-foreground">Report Templates & Export</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Generate audit-ready reports for stakeholders and funders</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-3 gap-3">
        {REPORT_TEMPLATES.map((rpt) => (
          <div key={rpt.id} className="p-4 border border-border rounded-lg hover:border-primary/30 hover:shadow-card transition-all group">
            <div className="flex items-start gap-3 mb-3">
              <div className={`w-9 h-9 rounded-lg ${rpt.iconBg} flex items-center justify-center flex-shrink-0`}>
                <Icon name={rpt.icon as Parameters<typeof Icon>[0]['name']} size={18} className={rpt.iconColor} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={`text-[10px] font-600 px-1.5 py-0.5 rounded border ${FORMAT_COLORS[rpt.format] ?? 'bg-muted text-muted-foreground border-border'}`}>{rpt.format}</span>
                  <span className="text-[10px] text-muted-foreground">{rpt.pages} pages</span>
                </div>
                <p className="text-xs font-700 text-foreground leading-snug">{rpt.title}</p>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed mb-3">{rpt.description}</p>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Icon name="ClockIcon" size={10} />
                Last: {rpt.lastGenerated}
              </span>
              <button
                onClick={() => handleGenerate(rpt.id, rpt.title)}
                disabled={generating === rpt.id}
                className="text-[11px] font-600 text-white bg-primary px-3 py-1.5 rounded-md hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-60 flex items-center gap-1.5 min-w-[100px] justify-center"
              >
                {generating === rpt.id ? (
                  <>
                    <Icon name="ArrowPathIcon" size={12} className="animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Icon name="ArrowDownTrayIcon" size={12} />
                    Generate
                  </>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}