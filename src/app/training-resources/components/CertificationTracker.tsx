import React from 'react';
import ProgressBar from '@/components/ui/ProgressBar';
import Icon from '@/components/ui/AppIcon';

const CERTIFICATIONS = [
  {
    id: 'cert-001',
    name: 'ISO 9001:2015 Quality Management',
    owner: 'Org-wide',
    progress: 72,
    targetDate: '31 Dec 2026',
    status: 'in-progress' as const,
    color: 'bg-primary',
    responsible: 'Mr. Kwame Asante',
    notes: 'Gap analysis complete. Internal audit scheduled for May 2026.',
  },
  {
    id: 'cert-002',
    name: 'ISO 27001 Information Security',
    owner: 'ICT Department',
    progress: 65,
    targetDate: '31 Dec 2026',
    status: 'in-progress' as const,
    color: 'bg-violet-500',
    responsible: 'Fatuma Rashid',
    notes: 'Risk assessment complete. Controls implementation at 65%. Audit readiness training scheduled.',
  },
  {
    id: 'cert-003',
    name: 'ISO 21500 Project Management',
    owner: 'Programs Directorate',
    progress: 45,
    targetDate: '30 Jun 2027',
    status: 'in-progress' as const,
    color: 'bg-sky-500',
    responsible: 'Prosper Habimana',
    notes: 'Framework alignment in progress. Staff training on PM standards begins April 2026.',
  },
  {
    id: 'cert-004',
    name: 'CPA/ACCA Professional Status',
    owner: 'Finance Department',
    progress: 100,
    targetDate: 'Ongoing',
    status: 'completed' as const,
    color: 'bg-emerald-500',
    responsible: 'Dr. Salome Wanjiru',
    notes: '3 of 3 finance staff holding active CPA/ACCA status. Annual CPD maintained.',
  },
];

const STATUS_CONFIG = {
  'in-progress': { label: 'In Progress', bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200' },
  'completed': { label: 'Certified', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  'at-risk': { label: 'At Risk', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  'not-started': { label: 'Not Started', bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' },
};

export default function CertificationTracker() {
  return (
    <div className="bg-white rounded-xl border border-border shadow-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-700 text-foreground">ISO & Professional Certification Tracker</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Organizational certification roadmap · SP 9.16</p>
        </div>
      </div>
      <div className="space-y-4">
        {CERTIFICATIONS.map((cert) => {
          const config = STATUS_CONFIG[cert.status] ?? STATUS_CONFIG['not-started'];
          return (
            <div key={cert.id} className="p-4 border border-border rounded-lg hover:border-primary/30 transition-colors">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <p className="text-sm font-700 text-foreground">{cert.name}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{cert.owner} · Responsible: {cert.responsible}</p>
                </div>
                <span className={`text-[10px] font-600 px-2 py-0.5 rounded-full border ${config.bg} ${config.text} ${config.border} flex-shrink-0`}>
                  {config.label}
                </span>
              </div>
              <div className="flex items-center gap-3 mb-2">
                <ProgressBar value={cert.progress} colorClass={cert.color} height="h-2" className="flex-1" />
                <span className="text-xs font-700 tabular-nums text-muted-foreground w-10 text-right">{cert.progress}%</span>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-muted-foreground italic">{cert.notes}</p>
                <span className="text-[11px] text-muted-foreground flex items-center gap-1 flex-shrink-0 ml-2">
                  <Icon name="CalendarDaysIcon" size={11} />{cert.targetDate}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}