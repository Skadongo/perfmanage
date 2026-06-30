'use client';

import React from 'react';
import Icon from '@/components/ui/AppIcon';

export default function CPDProgressTable() {
  return (
    <div className="bg-white rounded-xl border border-border shadow-card overflow-hidden">
      <div className="flex items-center justify-between p-5 border-b border-border">
        <div>
          <h3 className="text-sm font-700 text-foreground">CPD Completion Tracker</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Annual Continuous Professional Development</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-1 rounded-md font-600">
            0 Completed
          </span>
          <span className="text-[11px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-1 rounded-md font-600">
            0 At Risk
          </span>
        </div>
      </div>
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Icon name="AcademicCapIcon" size={32} className="text-muted-foreground/40" />
        <p className="text-sm font-600 text-foreground">No CPD records found</p>
        <p className="text-xs text-muted-foreground text-center max-w-xs">
          Staff CPD progress will appear here once records are added to the system.
        </p>
      </div>
    </div>
  );
}