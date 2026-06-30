'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { toast } from 'sonner';

const TRAININGS = [
  {
    id: 'train-001',
    title: 'PMS Fundamentals — Understanding the Importance of Performance Management',
    category: 'PMS Core',
    deliveryMode: 'E-Learning',
    duration: '3h 30min',
    mandatory: true,
    enrolled: true,
    completed: false,
    completionRate: 68,
    facilitator: 'ECSA-HC HR Unit',
    targetRoles: ['All Staff'],
    description: 'Covers the purpose, benefits, and process of the ECSA-HC Performance Management System including BSC perspectives, KPI setting, and review cycles.',
    nextSession: '1 Apr 2026',
    rating: 4.6,
  },
  {
    id: 'train-002',
    title: 'Effective Evaluation Skills — How to Conduct & Receive Performance Reviews',
    category: 'PMS Core',
    deliveryMode: 'Blended',
    duration: '6h',
    mandatory: true,
    enrolled: true,
    completed: false,
    completionRate: 45,
    facilitator: 'External Consultant',
    targetRoles: ['All Supervisors', 'Directors'],
    description: 'Practical training on conducting fair, evidence-based evaluations. Covers rating standards, bias avoidance, constructive feedback delivery, and appeals process.',
    nextSession: '3 Apr 2026',
    rating: 4.8,
  },
  {
    id: 'train-003',
    title: 'Setting SMART Performance Targets — BSC-Aligned KPI Development',
    category: 'KPI Setting',
    deliveryMode: 'Workshop',
    duration: '4h',
    mandatory: true,
    enrolled: false,
    completed: false,
    completionRate: 0,
    facilitator: 'Mr. Kwame Asante',
    targetRoles: ['All Staff'],
    description: 'Hands-on workshop for developing SMART KPIs aligned to the four BSC perspectives and ECSA-HC Strategic Plan 2024–2034 priorities.',
    nextSession: '8 Apr 2026',
    rating: 4.7,
  },
  {
    id: 'train-004',
    title: 'ISO 27001 Information Security — Requirements & Audit Readiness',
    category: 'ISO Certification',
    deliveryMode: 'In-Person',
    duration: '8h',
    mandatory: false,
    enrolled: true,
    completed: false,
    completionRate: 0,
    facilitator: 'External Auditor (BSI)',
    targetRoles: ['Senior ICT Officer', 'Directors'],
    description: 'Full-day training covering ISO 27001:2022 requirements, information security risk management, and preparation for certification audit.',
    nextSession: '8 Apr 2026',
    rating: 4.9,
  },
  {
    id: 'train-005',
    title: 'Finance for Non-Finance Personnel — Budgets, Cost Recovery & Reporting',
    category: 'Finance Literacy',
    deliveryMode: 'E-Learning',
    duration: '2h 45min',
    mandatory: false,
    enrolled: false,
    completed: false,
    completionRate: 0,
    facilitator: 'Dr. Salome Wanjiru',
    targetRoles: ['All Non-Finance Staff'],
    description: 'Practical introduction to budget management, cost allocation to grants, financial reporting requirements, and understanding audit findings.',
    nextSession: 'Self-paced',
    rating: 4.5,
  },
  {
    id: 'train-006',
    title: 'Defensive Driving & Fleet Safety — ECSA-HC Vehicle Management Standards',
    category: 'Operations',
    deliveryMode: 'In-Person',
    duration: '4h',
    mandatory: true,
    enrolled: false,
    completed: false,
    completionRate: 0,
    facilitator: 'Certified Driving Instructor',
    targetRoles: ['Driver'],
    description: 'Annual mandatory refresher covering defensive driving techniques, incident reporting procedures, GPS fleet system, and ECSA branding standards.',
    nextSession: '15 Apr 2026',
    rating: 4.3,
  },
  {
    id: 'train-007',
    title: 'Health Diplomacy & Protocol — Engaging Member States and Partners',
    category: 'Diplomacy',
    deliveryMode: 'Workshop',
    duration: '6h',
    mandatory: false,
    enrolled: true,
    completed: true,
    completionRate: 100,
    facilitator: 'Prosper Habimana',
    targetRoles: ['Director of Programs', 'Directors', 'Receptionists'],
    description: 'Covers diplomatic protocol for ECSA-HC events, Member State engagement best practices, and communication standards for regional health partnerships.',
    nextSession: 'Completed',
    rating: 4.7,
  },
  {
    id: 'train-008',
    title: 'ERP System Training — Finance, HR & Storeroom Modules',
    category: 'Digital Systems',
    deliveryMode: 'Blended',
    duration: '5h',
    mandatory: true,
    enrolled: true,
    completed: false,
    completionRate: 55,
    facilitator: 'ICT Department',
    targetRoles: ['Finance Officer', 'HR & Admin Officer', 'Receptionist'],
    description: 'Comprehensive ERP training covering financial transactions, HR records management, inventory tracking, and report generation. Prerequisite for 100% ERP adoption KPI.',
    nextSession: 'Self-paced',
    rating: 4.2,
  },
];

const CATEGORIES = ['All', 'PMS Core', 'KPI Setting', 'ISO Certification', 'Finance Literacy', 'Operations', 'Diplomacy', 'Digital Systems'];
const MODES = ['All Modes', 'E-Learning', 'Workshop', 'In-Person', 'Blended'];

export default function TrainingCatalog() {
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [modeFilter, setModeFilter] = useState('All Modes');
  const [mandatoryOnly, setMandatoryOnly] = useState(false);

  const filtered = TRAININGS.filter(t => {
    const matchCat = categoryFilter === 'All' || t.category === categoryFilter;
    const matchMode = modeFilter === 'All Modes' || t.deliveryMode === modeFilter;
    const matchMand = !mandatoryOnly || t.mandatory;
    return matchCat && matchMode && matchMand;
  });

  const handleEnroll = (id: string, title: string) => {
    // Backend integration point: POST /api/training/enroll
    toast.success(`Enrolled in "${title}"`, { description: 'You will receive a confirmation email with details.' });
  };

  const MODE_COLORS: Record<string, string> = {
    'E-Learning': 'bg-sky-50 text-sky-700 border-sky-200',
    'Workshop': 'bg-violet-50 text-violet-700 border-violet-200',
    'In-Person': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'Blended': 'bg-amber-50 text-amber-700 border-amber-200',
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex gap-1 flex-wrap">
          {CATEGORIES.map((cat) => (
            <button
              key={`cat-${cat}`}
              onClick={() => setCategoryFilter(cat)}
              className={`px-2.5 py-1 text-[11px] font-600 rounded-md transition-colors ${
                categoryFilter === cat ? 'bg-primary text-white' : 'bg-white border border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        <select
          value={modeFilter}
          onChange={(e) => setModeFilter(e.target.value)}
          className="px-3 py-1.5 text-xs bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          {MODES.map(m => <option key={`mode-${m}`} value={m}>{m}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-xs font-600 text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={mandatoryOnly}
            onChange={(e) => setMandatoryOnly(e.target.checked)}
            className="rounded accent-primary"
          />
          Mandatory only
        </label>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3 gap-4">
        {filtered.map((training) => (
          <div
            key={training.id}
            className={`bg-white rounded-xl border shadow-card p-5 flex flex-col gap-3 transition-shadow hover:shadow-elevated ${
              training.completed ? 'border-emerald-200' : 'border-border'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-wrap gap-1.5">
                <span className={`text-[10px] font-600 px-2 py-0.5 rounded-full border ${MODE_COLORS[training.deliveryMode] ?? 'bg-muted text-muted-foreground border-border'}`}>
                  {training.deliveryMode}
                </span>
                {training.mandatory && (
                  <span className="text-[10px] font-600 px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">Mandatory</span>
                )}
                {training.completed && (
                  <span className="text-[10px] font-600 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                    <Icon name="CheckBadgeIcon" size={10} />Completed
                  </span>
                )}
              </div>
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <Icon name="StarIcon" size={12} className="text-amber-400" />
                <span className="text-[11px] font-700 tabular-nums text-muted-foreground">{training.rating}</span>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-700 text-foreground leading-snug">{training.title}</h4>
              <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed line-clamp-2">{training.description}</p>
            </div>

            <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1"><Icon name="ClockIcon" size={12} />{training.duration}</span>
              <span className="flex items-center gap-1"><Icon name="UserIcon" size={12} />{training.facilitator}</span>
              <span className="flex items-center gap-1"><Icon name="CalendarDaysIcon" size={12} />{training.nextSession}</span>
            </div>

            <div className="flex flex-wrap gap-1">
              {training.targetRoles.slice(0, 3).map((role) => (
                <span key={`role-tag-${training.id}-${role}`} className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-500">{role}</span>
              ))}
            </div>

            {training.enrolled && !training.completed && training.completionRate > 0 && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] text-muted-foreground">Progress</span>
                  <span className="text-[11px] font-700 tabular-nums text-primary">{training.completionRate}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-1.5">
                  <div className="h-1.5 bg-primary rounded-full transition-all" style={{ width: `${training.completionRate}%` }} />
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-1 border-t border-border mt-auto">
              {training.completed ? (
                <button className="flex-1 py-2 text-xs font-600 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-center gap-1">
                  <Icon name="ArrowDownTrayIcon" size={13} />
                  Download Certificate
                </button>
              ) : training.enrolled ? (
                <button className="flex-1 py-2 text-xs font-600 text-white bg-primary rounded-lg hover:bg-primary/90 transition-all active:scale-95 flex items-center justify-center gap-1">
                  <Icon name="PlayIcon" size={13} />
                  {training.completionRate > 0 ? 'Continue' : 'Start Training'}
                </button>
              ) : (
                <button
                  onClick={() => handleEnroll(training.id, training.title)}
                  className="flex-1 py-2 text-xs font-600 text-primary border border-primary/30 rounded-lg hover:bg-primary/5 transition-all active:scale-95 flex items-center justify-center gap-1"
                >
                  <Icon name="PlusIcon" size={13} />
                  Enrol
                </button>
              )}
              <button className="px-3 py-2 text-xs font-600 text-muted-foreground border border-border rounded-lg hover:bg-muted transition-colors" aria-label="View details">
                <Icon name="EyeIcon" size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}