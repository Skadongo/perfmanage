import React from 'react';
import AppLayout from '@/components/AppLayout';
import CPDProgressTable from './components/CPDProgressTable';
import TrainingCatalog from './components/TrainingCatalog';
import CertificationTracker from './components/CertificationTracker';
import GuidanceDocuments from './components/GuidanceDocuments';
import { Toaster } from 'sonner';
import Icon from '@/components/ui/AppIcon';

export default function TrainingResourcesPage() {
  return (
    <AppLayout
      pageTitle="Training & Resources"
      pageSubtitle="CPD tracking, training catalog, ISO certifications, and guidance documents"
      actions={
        <button className="btn-brand">
          <Icon name="EcsaExportIcon" size={14} className="text-white" />
          <span className="hidden sm:inline">Export CPD Report</span>
        </button>
      }
    >
      <Toaster position="bottom-right" richColors />
      <div className="space-y-8">
        {/* Summary KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-4 gap-4">
          {[
            { id: 'tstat-cpd', label: 'Org CPD Completion', value: '84.7%', sub: 'Target: 100% by Dec', color: 'text-primary', icon: 'EcsaTrainingIcon', bg: 'bg-primary/5' },
            { id: 'tstat-ontrack', label: 'Staff On Track', value: '5 / 8', sub: '62.5% of workforce', color: 'text-emerald-700', icon: 'EcsaApprovedIcon', bg: 'bg-emerald-50' },
            { id: 'tstat-atrisk', label: 'CPD At Risk', value: '3', sub: 'Boniface, Emmanuel, Zawadi', color: 'text-amber-700', icon: 'EcsaWarningIcon', bg: 'bg-amber-50' },
            { id: 'tstat-certs', label: 'ISO Certifications', value: '1 / 4', sub: 'CPA/ACCA complete', color: 'text-violet-700', icon: 'EcsaCertIcon', bg: 'bg-violet-50' },
          ].map((s) => (
            <div key={s.id} className="bg-white rounded-xl border border-border shadow-card p-4 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center flex-shrink-0`}>
                <Icon name={s.icon as Parameters<typeof Icon>[0]['name']} size={18} className={s.color} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-600 uppercase tracking-wider text-muted-foreground truncate">{s.label}</p>
                <p className={`text-xl font-700 tabular-nums font-mono ${s.color}`}>{s.value}</p>
                <p className="text-[10px] text-muted-foreground truncate">{s.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CPD Tracker */}
        <section>
          <h2 className="text-xs font-600 uppercase tracking-wider text-muted-foreground mb-3">CPD Progress by Staff</h2>
          <CPDProgressTable />
        </section>

        {/* ISO Certifications */}
        <section>
          <h2 className="text-xs font-600 uppercase tracking-wider text-muted-foreground mb-3">Certification Tracker</h2>
          <CertificationTracker />
        </section>

        {/* Training Catalog */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-600 uppercase tracking-wider text-muted-foreground">Training Catalog</h2>
            <span className="text-[11px] text-muted-foreground">{8} programs available</span>
          </div>
          <TrainingCatalog />
        </section>

        {/* Guidance Documents */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-600 uppercase tracking-wider text-muted-foreground">Guidance Documents & Templates</h2>
          </div>
          <GuidanceDocuments />
        </section>
      </div>
    </AppLayout>
  );
}