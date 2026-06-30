'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';


const WB_PROCESSES = [
  {
    id: 'wb-proc-001',
    process: 'Procurement Plan — Q2 2026',
    category: 'Procurement',
    submittedDate: '10 Mar 2026',
    expectedDecision: '25 Mar 2026',
    actualDecision: '',
    daysRemaining: 0,
    status: 'under-review' as const,
    priority: 'High',
    responsible: 'Dr. Salome Wanjiru',
    notes: 'Awaiting World Bank TTL review. All supporting documents submitted.',
  },
  {
    id: 'wb-proc-002',
    process: 'Environmental & Social Framework Clearance',
    category: 'Safeguards',
    submittedDate: '5 Mar 2026',
    expectedDecision: '23 Mar 2026',
    actualDecision: '',
    daysRemaining: -2,
    status: 'overdue' as const,
    priority: 'Critical',
    responsible: 'Prosper Habimana',
    notes: 'OVERDUE — 2 days past expected decision. Escalated to WB Country Manager.',
  },
  {
    id: 'wb-proc-003',
    process: 'Financial Management Report Q3 FY25',
    category: 'Financial Reporting',
    submittedDate: '28 Feb 2026',
    expectedDecision: '15 Mar 2026',
    actualDecision: '18 Mar 2026',
    daysRemaining: 0,
    status: 'approved' as const,
    priority: 'Medium',
    responsible: 'Dr. Salome Wanjiru',
    notes: 'Approved with minor comments. Q4 report due 31 May 2026.',
  },
  {
    id: 'wb-proc-004',
    process: 'Implementation Support Mission — H1 2026',
    category: 'Mission',
    submittedDate: '15 Jan 2026',
    expectedDecision: '28 Feb 2026',
    actualDecision: '3 Mar 2026',
    daysRemaining: 0,
    status: 'approved' as const,
    priority: 'High',
    responsible: 'Mr. Kwame Asante',
    notes: 'Mission approved. Scheduled for 12–16 May 2026. PIU preparing aide-mémoire.',
  },
  {
    id: 'wb-proc-005',
    process: 'Consultant TOR — Regional M&E Specialist',
    category: 'Recruitment',
    submittedDate: '20 Mar 2026',
    expectedDecision: '10 Apr 2026',
    actualDecision: '',
    daysRemaining: 16,
    status: 'submitted' as const,
    priority: 'Medium',
    responsible: 'Amara Mensah',
    notes: 'TOR submitted for No Objection. Awaiting WB procurement team acknowledgment.',
  },
  {
    id: 'wb-proc-006',
    process: 'Annual Work Plan & Budget — FY 2026',
    category: 'Planning',
    submittedDate: '15 Oct 2025',
    expectedDecision: '30 Nov 2025',
    actualDecision: '2 Dec 2025',
    daysRemaining: 0,
    status: 'approved' as const,
    priority: 'High',
    responsible: 'Mr. Kwame Asante',
    notes: 'AWP approved. Budget absorption currently at 76%.',
  },
];

const STATUS_CONFIG = {
  'under-review': { label: 'Under Review', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  'overdue': { label: 'Overdue', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  'approved': { label: 'Approved', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  'submitted': { label: 'Submitted', bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200' },
  'rejected': { label: 'Rejected', bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300' },
};

const PRIORITY_COLORS: Record<string, string> = {
  'Critical': 'text-red-700 font-800',
  'High': 'text-amber-700 font-700',
  'Medium': 'text-muted-foreground',
};

export default function WBNoPipelineTable() {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="bg-white rounded-xl border border-border shadow-card overflow-hidden">
      <div className="flex items-center justify-between p-5 border-b border-border">
        <div>
          <h3 className="text-sm font-700 text-foreground">World Bank No Objection Pipeline</h3>
          <p className="text-xs text-muted-foreground mt-0.5">HEPRR-MPA AFE Program · Approval process tracker</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] bg-red-50 text-red-700 border border-red-200 px-2 py-1 rounded-md font-600">
            {WB_PROCESSES.filter(p => p.status === 'overdue').length} Overdue
          </span>
          <span className="text-[11px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-1 rounded-md font-600">
            {WB_PROCESSES.filter(p => p.status === 'under-review' || p.status === 'submitted').length} Pending
          </span>
        </div>
      </div>
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-4 py-3 text-[11px] font-600 uppercase tracking-wider text-muted-foreground">Process / Document</th>
              <th className="text-left px-4 py-3 text-[11px] font-600 uppercase tracking-wider text-muted-foreground whitespace-nowrap">Category</th>
              <th className="text-left px-4 py-3 text-[11px] font-600 uppercase tracking-wider text-muted-foreground whitespace-nowrap">Submitted</th>
              <th className="text-left px-4 py-3 text-[11px] font-600 uppercase tracking-wider text-muted-foreground whitespace-nowrap">Expected Decision</th>
              <th className="text-left px-4 py-3 text-[11px] font-600 uppercase tracking-wider text-muted-foreground whitespace-nowrap">Actual Decision</th>
              <th className="text-left px-4 py-3 text-[11px] font-600 uppercase tracking-wider text-muted-foreground whitespace-nowrap">Priority</th>
              <th className="text-left px-4 py-3 text-[11px] font-600 uppercase tracking-wider text-muted-foreground whitespace-nowrap">Responsible</th>
              <th className="text-left px-4 py-3 text-[11px] font-600 uppercase tracking-wider text-muted-foreground whitespace-nowrap">Status</th>
              <th className="px-4 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {WB_PROCESSES.map((proc, idx) => {
              const config = STATUS_CONFIG[proc.status] ?? STATUS_CONFIG['submitted'];
              return (
                <React.Fragment key={proc.id}>
                  <tr
                    className={`border-b border-border transition-colors cursor-pointer ${
                      idx % 2 === 0 ? 'bg-white' : 'bg-muted/10'
                    } hover:bg-muted/40 ${proc.status === 'overdue' ? 'bg-red-50/50' : ''}`}
                    onClick={() => setExpandedId(expandedId === proc.id ? null : proc.id)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {proc.status === 'overdue' && <Icon name="ExclamationTriangleIcon" size={14} className="text-red-500 flex-shrink-0" />}
                        <span className="font-600 text-foreground">{proc.process}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{proc.category}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{proc.submittedDate}</td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      <span className={proc.daysRemaining < 0 ? 'text-red-600 font-600' : 'text-muted-foreground'}>{proc.expectedDecision}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {proc.actualDecision || <span className="text-muted-foreground/50">—</span>}
                    </td>
                    <td className={`px-4 py-3 text-xs whitespace-nowrap ${PRIORITY_COLORS[proc.priority] ?? 'text-muted-foreground'}`}>{proc.priority}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{proc.responsible}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-600 px-2 py-0.5 rounded-full border ${config.bg} ${config.text} ${config.border}`}>
                        {config.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Icon name={expandedId === proc.id ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={14} className="text-muted-foreground" />
                    </td>
                  </tr>
                  {expandedId === proc.id && (
                    <tr key={`${proc.id}-expanded`} className="border-b border-border bg-muted/10">
                      <td colSpan={9} className="px-4 py-3">
                        <div className="flex items-start gap-2 text-sm">
                          <Icon name="InformationCircleIcon" size={15} className="text-primary flex-shrink-0 mt-0.5" />
                          <p className="text-muted-foreground">{proc.notes}</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}