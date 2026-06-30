'use client';

import React, { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import FeedbackFeed from './components/FeedbackFeed';
import MentorDirectory from './components/MentorDirectory';
import PeerExchangePanel from './components/PeerExchangePanel';
import UpcomingSessionsPanel from './components/UpcomingSessionsPanel';
import GiveFeedbackModal from './components/GiveFeedbackModal';
import Icon from '@/components/ui/AppIcon';
import { Toaster } from 'sonner';

export default function FeedbackMentorshipPage() {
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('feedback');

  const TABS = [
    { id: 'feedback', label: 'Feedback Stream', icon: 'EcsaFeedbackIcon' },
    { id: 'mentors', label: 'Mentor Directory', icon: 'EcsaMentorIcon' },
    { id: 'peer', label: 'Peer Exchange', icon: 'EcsaPeerIcon' },
    { id: 'sessions', label: 'Upcoming Sessions', icon: 'EcsaCalendarIcon' },
  ];

  return (
    <AppLayout
      pageTitle="Feedback & Mentorship"
      pageSubtitle="Continuous feedback, mentorship matching, and peer knowledge exchange"
      actions={
        <button
          onClick={() => setFeedbackModalOpen(true)}
          className="btn-brand"
        >
          <Icon name="EcsaNewIcon" size={14} className="text-white" />
          <span className="hidden sm:inline">Give Feedback</span>
        </button>
      }
    >
      <Toaster position="bottom-right" richColors />
      <GiveFeedbackModal open={feedbackModalOpen} onClose={() => setFeedbackModalOpen(false)} />

      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-4 gap-4 mb-6">
        {[
          { id: 'fstat-given', label: 'Feedback Given', value: '0', sub: 'This quarter', icon: 'EcsaFeedbackIcon', color: 'text-primary', bg: 'bg-primary/5' },
          { id: 'fstat-pending', label: 'Pending Acknowledgment', value: '0', sub: 'No pending actions', icon: 'EcsaPendingIcon', color: 'text-amber-600', bg: 'bg-amber-50' },
          { id: 'fstat-mentors', label: 'Active Mentorships', value: '0', sub: 'No active mentorships', icon: 'EcsaStaffIcon', color: 'text-violet-600', bg: 'bg-violet-50' },
          { id: 'fstat-sessions', label: 'Sessions This Month', value: '0', sub: 'No sessions planned', icon: 'EcsaCalendarIcon', color: 'text-emerald-600', bg: 'bg-emerald-50' },
        ].map((s) => (
          <div key={s.id} className="bg-white rounded-xl border border-border shadow-card p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center flex-shrink-0`}>
              <Icon name={s.icon as Parameters<typeof Icon>[0]['name']} size={18} className={s.color} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-600 uppercase tracking-wider text-muted-foreground truncate">{s.label}</p>
              <p className={`text-xl font-700 tabular-nums font-mono ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-muted-foreground">{s.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border mb-6 overflow-x-auto scrollbar-thin">
        {TABS.map((tab) => (
          <button
            key={`tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-600 whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-primary text-primary' :'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon name={tab.icon as Parameters<typeof Icon>[0]['name']} size={15} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'feedback' && <FeedbackFeed />}
      {activeTab === 'mentors' && <MentorDirectory />}
      {activeTab === 'peer' && <PeerExchangePanel />}
      {activeTab === 'sessions' && <UpcomingSessionsPanel />}
    </AppLayout>
  );
}