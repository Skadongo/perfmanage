'use client';

import React, { useState } from 'react';

const STRATEGIC_OBJECTIVES = [
  {
    id: 1,
    cluster: 'CHS',
    color: 'bg-sky-50 border-sky-200 text-sky-800',
    dot: 'bg-sky-500',
    title: 'Human Resources for Health',
    description: 'Facilitate building of HRH capacity in Member States and the Secretariat through high-quality training, accreditation, and research.',
    kpis: ['% increase in competency levels', 'Accredited training sites', 'Master Trainers pool growth'],
    timeline: '2024–2034',
  },
  {
    id: 2,
    cluster: 'HSCD',
    color: 'bg-teal-50 border-teal-200 text-teal-800',
    dot: 'bg-teal-500',
    title: 'Strengthening Health Systems',
    description: 'Strengthen health systems in Member States towards attainment of Universal Health Coverage (UHC).',
    kpis: ['Member States supported with UHC milestones', 'Healthcare workers trained in governance', 'Countries adopting patient-centred strategies'],
    timeline: '2024–2034',
  },
  {
    id: 3,
    cluster: 'FHID',
    color: 'bg-rose-50 border-rose-200 text-rose-800',
    dot: 'bg-rose-500',
    title: 'RMNCAH Strategies',
    description: 'Support development and implementation of Reproductive, Maternal, Newborn, Child and Adolescent Health strategies.',
    kpis: ['Countries supported in RMNCAH', 'Multi-stakeholder platforms established', 'Accountability scorecards in use'],
    timeline: '2024–2034',
  },
  {
    id: 4,
    cluster: 'MNFSN',
    color: 'bg-orange-50 border-orange-200 text-orange-800',
    dot: 'bg-orange-500',
    title: 'NCDs, Mental Health & Nutrition',
    description: 'Promote reduction of NCDs, mental health conditions, injuries, and all forms of malnutrition across the region.',
    kpis: ['Countries with integrated NCD services', 'HCW trained in mental health', 'Nutrition strategies adopted'],
    timeline: '2024–2034',
  },
  {
    id: 5,
    cluster: 'FHID',
    color: 'bg-purple-50 border-purple-200 text-purple-800',
    dot: 'bg-purple-500',
    title: 'Communicable Diseases & Climate',
    description: 'Promote reduction of communicable/infectious diseases and address effects of climate change on health.',
    kpis: ['HIV/TB/Malaria morbidity reduction', 'Cross-border surveillance systems', 'AMR surveillance reports'],
    timeline: '2025–2034',
  },
  {
    id: 6,
    cluster: 'KMME',
    color: 'bg-indigo-50 border-indigo-200 text-indigo-800',
    dot: 'bg-indigo-500',
    title: 'Knowledge Generation & Management',
    description: 'Strengthen knowledge generation, management and utilization to inform decision-making and programming.',
    kpis: ['Regional data warehouse operational', 'Research publications & policy briefs', 'Webinars and conferences convened'],
    timeline: '2024–2027',
  },
  {
    id: 7,
    cluster: 'DG/DOID',
    color: 'bg-cyan-50 border-cyan-200 text-cyan-800',
    dot: 'bg-cyan-500',
    title: 'Strategic Partnerships',
    description: 'Foster regional health policy agenda, strategic partnerships and collaboration towards SDGs and international commitments.',
    kpis: ['MoUs with SADC, Africa CDC, EAC', 'Private sector agreements signed', 'HMC resolutions implemented'],
    timeline: '2025–2034',
  },
  {
    id: 8,
    cluster: 'DOF/BDU',
    color: 'bg-amber-50 border-amber-200 text-amber-800',
    dot: 'bg-amber-500',
    title: 'Financial Sustainability',
    description: 'Improve financial sustainability for the ECSA-HC Secretariat through diversified revenue and resource mobilisation.',
    kpis: ['≥10% cost recovery from new grants', '≥3 grants > $1,000,000 acquired', '≥3 new Member States by 2034'],
    timeline: '2024–2034',
  },
  {
    id: 9,
    cluster: 'DG/DOID',
    color: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    dot: 'bg-emerald-500',
    title: 'Corporate Governance',
    description: 'Strengthen Secretariat capacity to provide oversight and implement good corporate governance and digital transformation.',
    kpis: ['Automated performance management system', 'HR Unit established by 2025', 'Digital hub & ERP system adopted'],
    timeline: '2024–2034',
  },
];

const PILLARS = [
  { icon: '👁️', label: 'Enhanced Visibility & Relevance' },
  { icon: '💰', label: 'Improved Financial Sustainability' },
  { icon: '🤝', label: 'Strengthened Value to Member States' },
  { icon: '💻', label: 'Efficiency Through Technology' },
  { icon: '🌐', label: 'Collaboration & Partnership' },
];

const CORE_VALUES = ['Trust', 'Transparency', 'Equity', 'Respect', 'Diversity'];

export default function StrategicPlanSection() {
  const [expandedObj, setExpandedObj] = useState<number | null>(null);

  return (
    <section className="space-y-4">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-card">
        {/* Decorative accent bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-accent to-primary opacity-80" />
        <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-700 text-foreground leading-tight">ECSA-HC Strategic Plan 2024–2034</h2>
              <p className="text-xs text-muted-foreground mt-0.5">East, Central and Southern Africa Health Community · 9 Member States</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-500 text-primary bg-primary/8 border border-primary/20 px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" />
              10-Year Roadmap
            </span>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-500 text-accent-foreground bg-accent/15 border border-accent/30 px-2.5 py-1 rounded-full">
              9 Strategic Objectives
            </span>
          </div>
        </div>

        {/* Vision & Mission */}
        <div className="px-5 pb-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-lg bg-primary/5 border border-primary/15 p-3.5">
            <p className="text-[10px] font-700 uppercase tracking-widest text-primary mb-1.5">Vision</p>
            <p className="text-xs text-foreground leading-relaxed italic">
              "To be a Leader in Health in the ECSA region, contributing towards the attainment of the highest standard of social well-being, physical and mental health for all people in the region."
            </p>
          </div>
          <div className="rounded-lg bg-accent/8 border border-accent/20 p-3.5">
            <p className="text-[10px] font-700 uppercase tracking-widest text-accent-foreground mb-1.5">Mission</p>
            <p className="text-xs text-foreground leading-relaxed italic">
              "ECSA-HC promotes the highest standards of health through advocacy, capacity building, brokerage, coordination, inter-sectoral collaboration and harmonization of health policies and programmes."
            </p>
          </div>
        </div>

        {/* Core Values strip */}
        <div className="px-5 pb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-600 uppercase tracking-wider text-muted-foreground mr-1">Core Values:</span>
            {CORE_VALUES?.map((v) => (
              <span key={v} className="text-[11px] font-500 text-foreground bg-secondary border border-border px-2 py-0.5 rounded-md">
                {v}
              </span>
            ))}
          </div>
        </div>
      </div>
      {/* Five Key Pillars */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <h3 className="text-xs font-600 uppercase tracking-wider text-muted-foreground">Five Strategic Pillars</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {PILLARS?.map((p, i) => (
            <div
              key={i}
              className="rounded-lg border border-border bg-card px-3 py-2.5 flex flex-col items-start gap-1.5 hover:border-primary/30 hover:bg-primary/3 transition-colors"
            >
              <span className="text-lg leading-none">{p?.icon}</span>
              <p className="text-[11px] font-500 text-foreground leading-snug">{p?.label}</p>
            </div>
          ))}
        </div>
      </div>
      {/* Nine Strategic Objectives */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <h3 className="text-xs font-600 uppercase tracking-wider text-muted-foreground">Nine Strategic Objectives</h3>
          <span className="text-[11px] text-muted-foreground">Click an objective to view KPIs</span>
        </div>

        {/* Bento-style asymmetric grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {STRATEGIC_OBJECTIVES?.map((obj) => {
            const isExpanded = expandedObj === obj?.id;
            return (
              <div
                key={obj?.id}
                className={`rounded-lg border bg-card cursor-pointer transition-all duration-200 ${
                  isExpanded ? 'ring-2 ring-primary/30 shadow-sm' : 'hover:shadow-sm hover:border-primary/25'
                } ${obj?.id === 1 ? 'sm:col-span-2 lg:col-span-1' : ''}`}
                onClick={() => setExpandedObj(isExpanded ? null : obj?.id)}
              >
                <div className="p-3.5">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-700 text-white ${obj?.dot}`}>
                        {obj?.id}
                      </span>
                      <span className={`text-[10px] font-600 px-1.5 py-0.5 rounded border ${obj?.color}`}>
                        {obj?.cluster}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground font-mono flex-shrink-0">{obj?.timeline}</span>
                  </div>
                  <h4 className="text-xs font-600 text-foreground mb-1 leading-snug">{obj?.title}</h4>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{obj?.description}</p>

                  {/* Expanded KPIs */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-border space-y-1.5">
                      <p className="text-[10px] font-700 uppercase tracking-wider text-muted-foreground mb-2">Key Performance Indicators</p>
                      {obj?.kpis?.map((kpi, ki) => (
                        <div key={ki} className="flex items-start gap-2">
                          <span className={`flex-shrink-0 w-1.5 h-1.5 rounded-full mt-1.5 ${obj?.dot}`} />
                          <p className="text-[11px] text-foreground leading-snug">{kpi}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {/* Expand indicator */}
                <div className="px-3.5 pb-2.5 flex items-center gap-1">
                  <svg
                    className={`w-3 h-3 text-muted-foreground transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                  <span className="text-[10px] text-muted-foreground">{isExpanded ? 'Hide KPIs' : 'View KPIs'}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {/* Implementation Framework */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-xs font-600 uppercase tracking-wider text-muted-foreground mb-3">Implementation & M&E Framework</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {[
            { level: 'L5', label: '10-Year Strategic Plan', sub: '3-year operational cycles' },
            { level: 'L4', label: 'Annual Work Plans', sub: 'Reviewed & reset annually' },
            { level: 'L3', label: 'Semi-Annual Reviews', sub: 'Reported to governance' },
            { level: 'L2', label: 'Quarterly Reports', sub: 'Secretariat-produced' },
            { level: 'L1', label: 'Monthly Meetings', sub: 'Management progress review' },
          ]?.map((item) => (
            <div key={item?.level} className="rounded-lg bg-secondary/60 border border-border px-3 py-2.5 text-center">
              <span className="text-[10px] font-700 text-primary font-mono block mb-1">{item?.level}</span>
              <p className="text-[11px] font-600 text-foreground leading-snug">{item?.label}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{item?.sub}</p>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
          A dedicated <span className="font-600 text-foreground">Strategy Monitoring Committee</span> (3 ECSA-HC managers + rotating employee representatives) oversees plan execution and reports to the Board Directorate. A mid-term review is scheduled at the 5-year mark.
        </p>
      </div>
    </section>
  );
}
