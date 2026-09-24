'use client';

import React, { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import Icon from '@/components/ui/AppIcon';
import FiscalYearsTab from './components/FiscalYearsTab';
import KPITemplatesTab from './components/KPITemplatesTab';
import StaffRolesTab from './components/StaffRolesTab';
import EvaluationWorkflowsTab from './components/EvaluationWorkflowsTab';

type TabId = 'fiscal-years' | 'kpi-templates' | 'staff-roles' | 'evaluation-workflows';

interface Tab {
  id: TabId;
  label: string;
  icon: string;
  description: string;
}

const TABS: Tab[] = [
  {
    id: 'fiscal-years',
    label: 'Fiscal Years',
    icon: 'CalendarDaysIcon',
    description: 'Define and manage performance fiscal year cycles',
  },
  {
    id: 'kpi-templates',
    label: 'KPI Templates',
    icon: 'ClipboardDocumentListIcon',
    description: 'Configure reusable KPI templates for staff appraisals',
  },
  {
    id: 'staff-roles',
    label: 'Staff Roles',
    icon: 'UsersIcon',
    description: 'Manage role definitions and access levels',
  },
  {
    id: 'evaluation-workflows',
    label: 'Evaluation Workflows',
    icon: 'ArrowPathIcon',
    description: 'Set up multi-stage evaluation and approval workflows',
  },
];

export default function HRConfigurationPage() {
  const [activeTab, setActiveTab] = useState<TabId>('fiscal-years');

  const activeTabData = TABS.find((t) => t.id === activeTab)!;

  return (
    <AppLayout
      pageTitle="HR Configuration"
      pageSubtitle="Centrally configure fiscal years, KPI templates, staff roles, and evaluation workflows"
    >
      {/* Page header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Icon name="Cog6ToothIcon" size={20} className="text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-700 text-foreground">HR Configuration Centre</h2>
            <p className="text-xs text-muted-foreground">
              Manage system-wide performance management settings for ECSA-HC
            </p>
          </div>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="bg-white rounded-xl border border-border overflow-hidden mb-6">
        <div className="flex overflow-x-auto scrollbar-thin border-b border-border">
          {TABS.map((tab) => {
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-500 whitespace-nowrap transition-all border-b-2 flex-shrink-0
                  ${isActive
                    ? 'border-primary text-primary bg-primary/5' :'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
              >
                <Icon
                  name={tab.icon as Parameters<typeof Icon>[0]['name']}
                  size={16}
                  className={isActive ? 'text-primary' : 'text-muted-foreground'}
                />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Active tab description strip */}
        <div className="px-5 py-2.5 bg-muted/30 border-b border-border flex items-center gap-2">
          <Icon
            name={activeTabData.icon as Parameters<typeof Icon>[0]['name']}
            size={14}
            className="text-primary flex-shrink-0"
          />
          <p className="text-xs text-muted-foreground">{activeTabData.description}</p>
        </div>
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'fiscal-years' && <FiscalYearsTab />}
        {activeTab === 'kpi-templates' && <KPITemplatesTab />}
        {activeTab === 'staff-roles' && <StaffRolesTab />}
        {activeTab === 'evaluation-workflows' && <EvaluationWorkflowsTab />}
      </div>
    </AppLayout>
  );
}
