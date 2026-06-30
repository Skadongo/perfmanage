'use client';

import React from 'react';
import Icon from '@/components/ui/AppIcon';

export default function MentorDirectory() {
  return (
    <div className="bg-white rounded-xl border border-border shadow-card">
      <div className="flex items-center justify-between p-5 border-b border-border">
        <div>
          <h3 className="text-sm font-700 text-foreground">Mentor Directory</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Role-matched mentors for professional development</p>
        </div>
        <span className="text-[11px] bg-muted text-muted-foreground border border-border px-2 py-1 rounded-md font-600">
          0 Available
        </span>
      </div>
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Icon name="UserGroupIcon" size={32} className="text-muted-foreground/40" />
        <p className="text-sm font-600 text-foreground">No mentors registered</p>
        <p className="text-xs text-muted-foreground text-center max-w-xs">
          Staff registered as mentors will appear here once added to the system.
        </p>
      </div>
    </div>
  );
}