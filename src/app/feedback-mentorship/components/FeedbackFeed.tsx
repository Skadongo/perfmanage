'use client';

import React, { useState } from 'react';

import Icon from '@/components/ui/AppIcon';

const TYPE_COLORS = {
  supervisor: 'bg-primary/10 text-primary',
  peer: 'bg-violet-50 text-violet-700',
  upward: 'bg-teal-50 text-teal-700',
  system: 'bg-amber-50 text-amber-700',
};

const TYPE_LABELS = {
  supervisor: 'Supervisor → Staff',
  peer: 'Peer Feedback',
  upward: 'Upward Feedback',
  system: 'System Alert',
};

export default function FeedbackFeed() {
  const [filter, setFilter] = useState('All');

  return (
    <div className="bg-white rounded-xl border border-border shadow-card">
      <div className="flex items-center justify-between p-5 border-b border-border">
        <div>
          <h3 className="text-sm font-700 text-foreground">Feedback Stream</h3>
          <p className="text-xs text-muted-foreground mt-0.5">All feedback</p>
        </div>
        <div className="flex gap-1 flex-wrap">
          {['All', 'Supervisor', 'Peer', 'Upward', 'System']?.map((f) => (
            <button
              key={`filter-${f}`}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 text-[11px] font-600 rounded-md transition-colors ${
                filter === f ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Icon name="ChatBubbleLeftRightIcon" size={32} className="text-muted-foreground/40" />
        <p className="text-sm font-600 text-foreground">No feedback yet</p>
        <p className="text-xs text-muted-foreground text-center max-w-xs">
          Feedback submitted through the system will appear here.
        </p>
      </div>
    </div>
  );
}