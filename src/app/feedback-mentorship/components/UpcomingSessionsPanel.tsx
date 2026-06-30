import React from 'react';
import Icon from '@/components/ui/AppIcon';

export default function UpcomingSessionsPanel() {
  return (
    <div className="bg-white rounded-xl border border-border shadow-card">
      <div className="flex items-center justify-between p-5 border-b border-border">
        <h3 className="text-sm font-700 text-foreground">Upcoming Sessions</h3>
        <button className="text-[11px] text-primary font-600 hover:underline">View calendar</button>
      </div>
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <Icon name="CalendarDaysIcon" size={32} className="text-muted-foreground/40" />
        <p className="text-sm font-600 text-foreground">No upcoming sessions</p>
        <p className="text-xs text-muted-foreground text-center max-w-xs">
          Scheduled mentorship and training sessions will appear here.
        </p>
      </div>
    </div>
  );
}