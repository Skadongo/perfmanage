import React from 'react';
import ProgressBar from '@/components/ui/ProgressBar';
import Icon from '@/components/ui/AppIcon';

const HEPRR_INDICATORS = [
  { id: 'heprr-01', label: 'IHR Core Capacities — Legal Framework', value: 82, target: 85, status: 'on-track' as const },
  { id: 'heprr-02', label: 'Emergency Preparedness Plan', value: 74, target: 80, status: 'at-risk' as const },
  { id: 'heprr-03', label: 'Surveillance & Detection', value: 68, target: 75, status: 'at-risk' as const },
  { id: 'heprr-04', label: 'Laboratory Diagnostic Capacity', value: 71, target: 70, status: 'on-track' as const },
  { id: 'heprr-05', label: 'Rapid Response Teams', value: 63, target: 75, status: 'overdue' as const },
];

const WB_PROCESSES = [
  { id: 'wb-01', label: 'Procurement Plan No Objection', stage: 'Under Review', daysRemaining: 5, urgent: false },
  { id: 'wb-02', label: 'Environmental & Social Framework', stage: 'Awaiting Clearance', daysRemaining: 2, urgent: true },
  { id: 'wb-03', label: 'Financial Management Report Q3', stage: 'Submitted', daysRemaining: 0, urgent: false },
  { id: 'wb-04', label: 'Implementation Support Mission', stage: 'Approved', daysRemaining: 0, urgent: false },
];

const JEE_SPAR = [
  { id: 'jee-01', domain: 'Prevent', jeeScore: 3.8, sparScore: 74, target: 80 },
  { id: 'jee-02', domain: 'Detect', jeeScore: 3.2, sparScore: 64, target: 75 },
  { id: 'jee-03', domain: 'Respond', jeeScore: 2.9, sparScore: 58, target: 70 },
  { id: 'jee-04', domain: 'IHR Related', jeeScore: 3.5, sparScore: 70, target: 75 },
];

const STATUS_COLORS = {
  'on-track': 'text-emerald-600',
  'at-risk': 'text-amber-600',
  'overdue': 'text-red-600',
};

const PROGRESS_COLORS = {
  'on-track': 'bg-emerald-500',
  'at-risk': 'bg-amber-400',
  'overdue': 'bg-red-400',
};

export default function FrameworkIndicators() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* HEPRR-MPA */}
      <div className="bg-white rounded-xl border border-border shadow-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon name="ShieldCheckIcon" size={15} className="text-primary" />
          </div>
          <div>
            <h3 className="text-xs font-700 text-foreground">HEPRR-MPA Indicators</h3>
            <p className="text-[10px] text-muted-foreground">World Bank — AFE Program</p>
          </div>
          <span className="ml-auto text-[10px] font-700 bg-primary/10 text-primary px-2 py-0.5 rounded-full">74% impl.</span>
        </div>
        <div className="space-y-3">
          {HEPRR_INDICATORS.map((ind) => (
            <div key={ind.id}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-[11px] text-foreground font-500 leading-tight pr-2 flex-1">{ind.label}</p>
                <span className={`text-[11px] font-700 tabular-nums ${STATUS_COLORS[ind.status]}`}>{ind.value}%</span>
              </div>
              <ProgressBar value={ind.value} colorClass={PROGRESS_COLORS[ind.status]} height="h-1" />
            </div>
          ))}
        </div>
      </div>

      {/* World Bank No Objection */}
      <div className="bg-white rounded-xl border border-border shadow-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
            <Icon name="DocumentCheckIcon" size={15} className="text-amber-600" />
          </div>
          <div>
            <h3 className="text-xs font-700 text-foreground">World Bank No Objection</h3>
            <p className="text-[10px] text-muted-foreground">Approval pipeline status</p>
          </div>
        </div>
        <div className="space-y-2.5">
          {WB_PROCESSES.map((proc) => (
            <div key={proc.id} className={`p-3 rounded-lg border ${proc.urgent ? 'border-red-200 bg-red-50' : 'border-border bg-muted/30'}`}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-[11px] font-600 text-foreground leading-tight flex-1">{proc.label}</p>
                {proc.urgent && <Icon name="ExclamationTriangleIcon" size={13} className="text-red-500 flex-shrink-0 mt-0.5" />}
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <span className={`text-[10px] font-600 px-1.5 py-0.5 rounded-full ${
                  proc.stage === 'Approved' ? 'bg-emerald-50 text-emerald-700' :
                  proc.stage === 'Submitted'? 'bg-sky-50 text-sky-700' : proc.urgent ?'bg-red-100 text-red-700' : 'bg-amber-50 text-amber-700'
                }`}>{proc.stage}</span>
                {proc.daysRemaining > 0 && (
                  <span className={`text-[10px] font-500 ${proc.urgent ? 'text-red-600 font-700' : 'text-muted-foreground'}`}>
                    {proc.daysRemaining}d remaining
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* JEE / SPAR */}
      <div className="bg-white rounded-xl border border-border shadow-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center">
            <Icon name="GlobeAltIcon" size={15} className="text-violet-600" />
          </div>
          <div>
            <h3 className="text-xs font-700 text-foreground">JEE / SPAR Results</h3>
            <p className="text-[10px] text-muted-foreground">IHR Core Capacity Scores</p>
          </div>
        </div>
        <div className="space-y-3">
          {JEE_SPAR.map((item) => (
            <div key={item.id}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-[11px] font-600 text-foreground">{item.domain}</p>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="text-muted-foreground">JEE <span className="font-700 text-foreground tabular-nums">{item.jeeScore}/5</span></span>
                  <span className="text-muted-foreground">SPAR <span className="font-700 text-foreground tabular-nums">{item.sparScore}</span></span>
                </div>
              </div>
              <ProgressBar
                value={item.sparScore}
                colorClass={item.sparScore >= item.target ? 'bg-violet-500' : 'bg-amber-400'}
                height="h-1.5"
              />
              <p className="text-[10px] text-muted-foreground mt-0.5">Target: {item.target}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}