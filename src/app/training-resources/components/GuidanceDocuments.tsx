'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { toast } from 'sonner';

const DOCUMENTS = [
  {
    id: 'doc-001',
    title: 'PMS User Guide — Staff Edition',
    category: 'PMS Guidance',
    type: 'PDF',
    size: '2.4 MB',
    updatedDate: '15 Jan 2026',
    description: 'Complete guide for staff on using PerfManage: setting workplans, logging KPI progress, completing self-evaluations, and understanding review outcomes.',
    icon: 'DocumentTextIcon',
    iconBg: 'bg-primary/10',
    iconColor: 'text-primary',
    downloads: 34,
  },
  {
    id: 'doc-002',
    title: 'Performance Rating Standards & Definitions',
    category: 'PMS Guidance',
    type: 'PDF',
    size: '1.1 MB',
    updatedDate: '15 Jan 2026',
    description: 'Official rating scale definitions (1–5), behavioral anchors for each level, and guidance on applying ratings consistently across BSC perspectives.',
    icon: 'StarIcon',
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    downloads: 58,
  },
  {
    id: 'doc-003',
    title: 'Self-Evaluation Template — Mid-Year Review',
    category: 'Templates',
    type: 'DOCX',
    size: '0.8 MB',
    updatedDate: '1 Mar 2026',
    description: 'Structured template for mid-year self-evaluation with pre-populated BSC perspective sections, KPI evidence fields, and development goals.',
    icon: 'ClipboardDocumentCheckIcon',
    iconBg: 'bg-sky-50',
    iconColor: 'text-sky-600',
    downloads: 41,
  },
  {
    id: 'doc-004',
    title: 'Self-Evaluation Template — Annual Review',
    category: 'Templates',
    type: 'DOCX',
    size: '1.0 MB',
    updatedDate: '1 Mar 2026',
    description: 'Annual review self-evaluation template with full KPI achievement summary, year-over-year comparison, and professional development plan section.',
    icon: 'ClipboardDocumentCheckIcon',
    iconBg: 'bg-sky-50',
    iconColor: 'text-sky-600',
    downloads: 29,
  },
  {
    id: 'doc-005',
    title: 'ECSA-HC KPI Catalogue by Role (FY 2025–2026)',
    category: 'KPI Reference',
    type: 'XLSX',
    size: '0.6 MB',
    updatedDate: '1 Oct 2025',
    description: 'Complete KPI catalogue for all 9 organizational roles organized by BSC perspective, strategic priority, and performance target. Reference for workplan setting.',
    icon: 'TableCellsIcon',
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    downloads: 87,
  },
  {
    id: 'doc-006',
    title: 'Rewards & Sanctions Policy — Objective Criteria Framework',
    category: 'Policy',
    type: 'PDF',
    size: '1.8 MB',
    updatedDate: '1 Jan 2026',
    description: 'Official policy document outlining objective criteria for performance-based rewards (bonuses, recognition) and sanctions (PIPs, disciplinary actions).',
    icon: 'DocumentTextIcon',
    iconBg: 'bg-violet-50',
    iconColor: 'text-violet-600',
    downloads: 52,
  },
  {
    id: 'doc-007',
    title: 'HEPRR-MPA Program Framework — Indicator Reference',
    category: 'External Frameworks',
    type: 'PDF',
    size: '4.2 MB',
    updatedDate: '30 Sep 2025',
    description: 'World Bank HEPRR-MPA Results Framework for the AFE Program. Includes PDO and intermediate results indicators, data sources, and reporting schedules.',
    icon: 'GlobeAltIcon',
    iconBg: 'bg-teal-50',
    iconColor: 'text-teal-600',
    downloads: 23,
  },
  {
    id: 'doc-008',
    title: 'JEE/SPAR Assessment Guide — IHR Core Capacities',
    category: 'External Frameworks',
    type: 'PDF',
    size: '3.1 MB',
    updatedDate: '15 Aug 2025',
    description: 'WHO guide to Joint External Evaluation and State Party Annual Reporting. Covers 13 IHR core capacities, scoring methodology, and linkage to HEPRR-MPA indicators.',
    icon: 'ShieldCheckIcon',
    iconBg: 'bg-red-50',
    iconColor: 'text-red-500',
    downloads: 19,
  },
];

const CATEGORIES = ['All', 'PMS Guidance', 'Templates', 'KPI Reference', 'Policy', 'External Frameworks'];
const TYPE_COLORS: Record<string, string> = {
  'PDF': 'bg-red-50 text-red-700 border-red-200',
  'DOCX': 'bg-sky-50 text-sky-700 border-sky-200',
  'XLSX': 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export default function GuidanceDocuments() {
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [search, setSearch] = useState('');

  const filtered = DOCUMENTS.filter(d => {
    const matchCat = categoryFilter === 'All' || d.category === categoryFilter;
    const matchSearch = search === '' || d.title.toLowerCase().includes(search.toLowerCase()) || d.description.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const handleDownload = (title: string) => {
    // Backend integration point: GET /api/documents/:id/download
    toast.success(`Downloading "${title}"`);
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Icon name="MagnifyingGlassIcon" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search guidance documents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {CATEGORIES.map((cat) => (
            <button
              key={`doccat-${cat}`}
              onClick={() => setCategoryFilter(cat)}
              className={`px-2.5 py-1.5 text-[11px] font-600 rounded-md transition-colors ${
                categoryFilter === cat ? 'bg-primary text-white' : 'bg-white border border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Document list */}
      <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-2 gap-3">
        {filtered.map((doc) => (
          <div key={doc.id} className="bg-white rounded-xl border border-border shadow-card p-4 flex items-start gap-3 hover:shadow-elevated transition-shadow group">
            <div className={`w-10 h-10 rounded-lg ${doc.iconBg} flex items-center justify-center flex-shrink-0`}>
              <Icon name={doc.icon as Parameters<typeof Icon>[0]['name']} size={20} className={doc.iconColor} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-sm font-700 text-foreground leading-snug group-hover:text-primary transition-colors">{doc.title}</h4>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <span className={`text-[10px] font-600 px-1.5 py-0.5 rounded border ${TYPE_COLORS[doc.type] ?? 'bg-muted text-muted-foreground border-border'}`}>{doc.type}</span>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed line-clamp-2">{doc.description}</p>
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span>{doc.size}</span>
                  <span>Updated {doc.updatedDate}</span>
                  <span className="flex items-center gap-0.5"><Icon name="ArrowDownTrayIcon" size={10} />{doc.downloads}</span>
                </div>
                <button
                  onClick={() => handleDownload(doc.title)}
                  className="text-[11px] font-600 text-primary hover:text-primary/80 transition-colors flex items-center gap-1 opacity-0 group-hover:opacity-100"
                >
                  <Icon name="ArrowDownTrayIcon" size={12} />
                  Download
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-12 bg-white rounded-xl border border-border">
          <Icon name="DocumentTextIcon" size={32} className="text-muted-foreground" />
          <p className="text-sm font-600 text-foreground">No documents found</p>
          <p className="text-xs text-muted-foreground">Try adjusting your search or category filter</p>
        </div>
      )}
    </div>
  );
}