'use client';

import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import HEPRRProgressChart from './components/HEPRRProgressChart';
import JEESPARChart from './components/JEESPARChart';
import WBNoPipelineTable from './components/WBNoPipelineTable';
import BSCScorecardMatrix from './components/BSCScorecardMatrix';
import KPIYearOnYearChart from './components/KPIYearOnYearChart';
import ReportsExportPanel from './components/ReportsExportPanel';
import DataValidationPanel from './components/DataValidationPanel';
import KPIStaffDrillDown from './components/KPIStaffDrillDown';
import Icon from '@/components/ui/AppIcon';
import { Toaster, toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import RoleGuard from '@/components/RoleGuard';

const TABS = [
  { id: 'overview', label: 'Overview', icon: 'EcsaPerformanceIcon' },
  { id: 'frameworks', label: 'External Frameworks', icon: 'EcsaFrameworkIcon' },
  { id: 'scorecard', label: 'BSC Scorecard', icon: 'EcsaBSCIcon' },
  { id: 'reports', label: 'Export Reports', icon: 'EcsaReportIcon' },
  { id: 'data-quality', label: 'Data Quality', icon: 'EcsaCapacityIcon' },
];

interface ReviewSummary {
  total: number;
  approved: number;
  submitted: number;
  avgScore: number;
  byRole: Record<string, { avgSup: number; avgSelf: number; submissionRate: number; approvalRate: number; count: number }>;
}

const ROLE_LABELS: Record<string, string> = {
  executive_director: 'Executive Director',
  deputy_director: 'Deputy Director',
  programme_manager: 'Programme Manager',
  finance_manager: 'Finance Manager',
  hr_admin_officer: 'HR & Admin Officer',
  programme_officer: 'Programme Officer',
  finance_officer: 'Finance Officer',
  admin_officer: 'Admin Officer',
  project_coordinator: 'Project Coordinator',
};

export default function AnalyticsReportsPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [drillMetric, setDrillMetric] = useState<{
    id: string; label: string; value: string; sub: string; color: string; icon: string; bg: string;
  } | null>(null);

  useEffect(() => {
    async function fetchSummary() {
      try {
        const supabase = createClient();
        const { data: reviews, error } = await supabase
          .from('mid_year_reviews')
          .select('review_status, supervisor_rating, self_rating, staff:staff_id(system_role)');

        if (error) throw error;

        if (!reviews || reviews.length === 0) {
          setSummary({ total: 0, approved: 0, submitted: 0, avgScore: 0, byRole: {} });
          return;
        }

        const total = reviews.length;
        let approvedCount = 0;
        let submittedCount = 0;
        let supRatingSum = 0;
        let supRatingCount = 0;

        // Single-pass aggregation — compute totals and per-role buckets simultaneously
        const roleMap: Record<string, {
          supSum: number; supCount: number;
          selfSum: number; selfCount: number;
          subCount: number; appCount: number; total: number;
        }> = {};

        for (const r of reviews as Array<{
          review_status: string;
          supervisor_rating: number | null;
          self_rating: number | null;
          staff: { system_role: string | null } | null;
        }>) {
          const isApproved = r.review_status === 'approved';
          const isSubmitted = ['submitted', 'reviewed', 'approved'].includes(r.review_status);

          if (isApproved) approvedCount++;
          if (isSubmitted) submittedCount++;
          if (r.supervisor_rating != null) {
            supRatingSum += r.supervisor_rating;
            supRatingCount++;
          }

          const role = r.staff?.system_role || 'unknown';
          if (role === 'unknown') continue;

          if (!roleMap[role]) {
            roleMap[role] = { supSum: 0, supCount: 0, selfSum: 0, selfCount: 0, subCount: 0, appCount: 0, total: 0 };
          }
          const bucket = roleMap[role];
          bucket.total++;
          if (isSubmitted) bucket.subCount++;
          if (isApproved) bucket.appCount++;
          if (r.supervisor_rating != null) { bucket.supSum += r.supervisor_rating; bucket.supCount++; }
          if (r.self_rating != null) { bucket.selfSum += r.self_rating; bucket.selfCount++; }
        }

        const avgScore = supRatingCount > 0
          ? Math.round((supRatingSum / supRatingCount) * 20 * 10) / 10
          : 0;

        const byRole: ReviewSummary['byRole'] = {};
        for (const [role, b] of Object.entries(roleMap)) {
          byRole[role] = {
            avgSup: b.supCount > 0 ? Math.round((b.supSum / b.supCount) * 20 * 10) / 10 : 0,
            avgSelf: b.selfCount > 0 ? Math.round((b.selfSum / b.selfCount) * 20 * 10) / 10 : 0,
            submissionRate: b.total > 0 ? Math.min(100, Math.round((b.subCount / b.total) * 100)) : 0,
            approvalRate: b.total > 0 ? Math.min(100, Math.round((b.appCount / b.total) * 100)) : 0,
            count: b.total,
          };
        }

        setSummary({ total, approved: approvedCount, submitted: submittedCount, avgScore, byRole });
      } catch {
        // silently fail — summary strip will show static fallback
      } finally {
        setSummaryLoading(false);
      }
    }
    fetchSummary();
  }, []);

  const bscScore = summary
    ? (summary.avgScore > 0 ? summary.avgScore : 0)
    : 0;

  const submissionPct = summary && summary.total > 0
    ? Math.min(100, Math.round((summary.submitted / summary.total) * 100))
    : 0;

  const approvalPct = summary && summary.total > 0
    ? Math.min(100, Math.round((summary.approved / summary.total) * 100))
    : 0;

  const roleEntries = summary ? Object.entries(summary.byRole).slice(0, 6) : [];

  const SUMMARY_STATS = [
    {
      id: 'astat-heprr',
      label: 'HEPRR-MPA Implementation',
      value: '74%',
      sub: 'of planned activities · AFE Yr 2',
      color: 'text-primary',
      icon: 'EcsaPermissionsIcon',
      bg: 'bg-primary/5',
      trend: '+4% vs H1',
      positive: true,
    },
    {
      id: 'astat-jee',
      label: 'Avg JEE Score',
      value: '3.1 / 5',
      sub: '13 IHR core capacities',
      color: 'text-violet-700',
      icon: 'EcsaRegionIcon',
      bg: 'bg-violet-50',
      trend: '+0.2 vs last JEE',
      positive: true,
    },
    {
      id: 'astat-reviews',
      label: 'Review Submission Rate',
      value: summaryLoading ? '—' : `${submissionPct}%`,
      sub: summaryLoading ? 'Loading…' : `${summary?.submitted ?? 0} of ${summary?.total ?? 0} reviews submitted`,
      color: submissionPct >= 80 ? 'text-emerald-700' : submissionPct >= 60 ? 'text-amber-700' : 'text-red-700',
      icon: 'EcsaEvaluationIcon',
      bg: submissionPct >= 80 ? 'bg-emerald-50' : submissionPct >= 60 ? 'bg-amber-50' : 'bg-red-50',
      trend: `${approvalPct}% approved`,
      positive: approvalPct >= 50,
    },
    {
      id: 'astat-bsc',
      label: 'Avg Supervisor Rating',
      value: summaryLoading ? '—' : `${bscScore.toFixed(1)}`,
      sub: summaryLoading ? 'Loading…' : `Across ${summary?.total ?? 0} reviews`,
      color: bscScore >= 70 ? 'text-emerald-700' : bscScore >= 55 ? 'text-amber-700' : 'text-red-700',
      icon: 'EcsaCapacityIcon',
      bg: bscScore >= 70 ? 'bg-emerald-50' : bscScore >= 55 ? 'bg-amber-50' : 'bg-red-50',
      trend: bscScore >= 70 ? 'On track' : 'Needs attention',
      positive: bscScore >= 70,
    },
  ];

  return (
    <RoleGuard minLevel={70} message="Analytics & Reports is restricted to Managers, HR Officers, and Directors.">
      <AppLayout
        pageTitle="Analytics & Reports"
        pageSubtitle="Evidence-based performance intelligence · HEPRR-MPA · JEE/SPAR · World Bank · BSC"
        actions={
          <div className="flex items-center gap-2">
            <span className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-lg border border-border">
              <Icon name="EcsaCalendarIcon" size={13} />
              Q1 FY2026
            </span>
            <button className="btn-brand">
              <Icon name="EcsaExportIcon" size={14} className="text-white" />
              <span className="hidden sm:inline">Export All</span>
            </button>
          </div>
        }
      >
        <Toaster position="bottom-right" richColors />

        {/* Summary strip — clickable for drill-down */}
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-4 gap-4 mb-6">
          {SUMMARY_STATS.map((s) => (
            <button
              key={s.id}
              onClick={() => setDrillMetric({ id: s.id, label: s.label, value: s.value, sub: s.sub, color: s.color, icon: s.icon, bg: s.bg })}
              className="bg-white rounded-xl border border-border shadow-card p-4 text-left hover:shadow-elevated hover:border-primary/30 active:scale-[0.99] transition-all focus:outline-none focus:ring-2 focus:ring-primary/30 group"
              aria-label={`Drill down into ${s.label}`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center flex-shrink-0`}>
                  <Icon name={s.icon as Parameters<typeof Icon>[0]['name']} size={18} className={s.color} />
                </div>
                <span className={`text-[10px] font-600 px-1.5 py-0.5 rounded-full ${s.positive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                  {s.trend}
                </span>
              </div>
              <p className="text-[11px] font-600 uppercase tracking-wider text-muted-foreground">{s.label}</p>
              <p className={`text-xl font-700 tabular-nums font-mono mt-0.5 ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{s.sub}</p>
              <p className="text-[10px] text-primary mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                <Icon name="UsersIcon" size={10} className="text-primary" />
                Click to drill down →
              </p>
            </button>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border mb-6 overflow-x-auto scrollbar-thin">
          {TABS.map((tab) => (
            <button
              key={`atab-${tab.id}`}
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

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-2 gap-6">
              <KPIYearOnYearChart />
              <HEPRRProgressChart />
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-2 gap-6">
              <JEESPARChart />
              <div className="bg-white rounded-xl border border-border shadow-card p-5">
                <h3 className="text-sm font-700 text-foreground mb-4">Key Insights — Q1 FY2026</h3>
                <div className="space-y-3">
                  {[
                    {
                      id: 'insight-001',
                      type: 'positive',
                      title: 'CSI Exceeds Target',
                      detail: 'Customer Satisfaction Index reached 67.4% vs 65% target. Member State engagement programs are yielding measurable results.',
                      icon: 'EcsaProgressIcon',
                    },
                    {
                      id: 'insight-002',
                      type: 'warning',
                      title: 'Cost Recovery Below 10% Threshold',
                      detail: 'Cost recovery stands at 7.8% vs 10% target. Finance Officer and DoF must accelerate grant recovery documentation.',
                      icon: 'EcsaWarningIcon',
                    },
                    {
                      id: 'insight-003',
                      type: 'warning',
                      title: 'Data Warehouse Project At Risk',
                      detail: 'Regional Data Warehouse at 42% completion vs 100% Q1 target (SP 6.2). ICT Officer requires resource escalation.',
                      icon: 'EcsaClusterIcon',
                    },
                    {
                      id: 'insight-004',
                      type: 'positive',
                      title: 'HEPRR-MPA 74% Implementation',
                      detail: 'Program implementation on track at 74% with 76% financial absorption. ESF clearance overdue — requires urgent WB escalation.',
                      icon: 'EcsaPermissionsIcon',
                    },
                    {
                      id: 'insight-005',
                      type: 'info',
                      title: 'Governance Index 1.8% Below Target',
                      detail: 'Corporate Governance Index at 58.2% vs 60% target. DoID to present corrective action plan at next HMC session.',
                      icon: 'EcsaDirectorateIcon',
                    },
                  ].map((insight) => (
                    <div
                      key={insight.id}
                      className={`flex items-start gap-3 p-3 rounded-lg border ${
                        insight.type === 'positive' ? 'bg-emerald-50 border-emerald-200' :
                        insight.type === 'warning'? 'bg-amber-50 border-amber-200' : 'bg-sky-50 border-sky-200'
                      }`}
                    >
                      <Icon
                        name={insight.icon as Parameters<typeof Icon>[0]['name']}
                        size={16}
                        className={
                          insight.type === 'positive' ? 'text-emerald-600 flex-shrink-0 mt-0.5' :
                          insight.type === 'warning'? 'text-amber-600 flex-shrink-0 mt-0.5' : 'text-sky-600 flex-shrink-0 mt-0.5'
                        }
                      />
                      <div>
                        <p className={`text-xs font-700 ${
                          insight.type === 'positive' ? 'text-emerald-800' :
                          insight.type === 'warning'? 'text-amber-800' : 'text-sky-800'
                        }`}>{insight.title}</p>
                        <p className={`text-[11px] mt-0.5 leading-relaxed ${
                          insight.type === 'positive' ? 'text-emerald-700' :
                          insight.type === 'warning'? 'text-amber-700' : 'text-sky-700'
                        }`}>{insight.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* External Frameworks Tab */}
        {activeTab === 'frameworks' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-2 gap-6">
              <HEPRRProgressChart />
              <JEESPARChart />
            </div>
            <WBNoPipelineTable />

            {/* SPAR Domain Detail */}
            <div className="bg-white rounded-xl border border-border shadow-card p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-700 text-foreground">SPAR — IHR Core Capacity Detail</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">State Party Annual Reporting · 13 Capacities · Score 0–100</p>
                </div>
                <span className="text-[11px] bg-primary/10 text-primary px-2 py-1 rounded-md font-600">Avg Score: 62.5</span>
              </div>
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left px-3 py-2.5 font-600 text-muted-foreground uppercase tracking-wider">IHR Core Capacity</th>
                      <th className="text-center px-3 py-2.5 font-600 text-muted-foreground uppercase tracking-wider">SPAR Score</th>
                      <th className="text-center px-3 py-2.5 font-600 text-muted-foreground uppercase tracking-wider">JEE Score</th>
                      <th className="text-center px-3 py-2.5 font-600 text-muted-foreground uppercase tracking-wider">Target</th>
                      <th className="text-left px-3 py-2.5 font-600 text-muted-foreground uppercase tracking-wider">Progress</th>
                      <th className="text-left px-3 py-2.5 font-600 text-muted-foreground uppercase tracking-wider">HEPRR-MPA Link</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { id: 'spar-01', capacity: 'Legislation & Financing', spar: 76, jee: 3.8, target: 80, heprr: 'IHR Legal Framework Indicator' },
                      { id: 'spar-02', capacity: 'IHR Coordination & NFP', spar: 64, jee: 3.2, target: 75, heprr: 'Coordination Mechanism' },
                      { id: 'spar-03', capacity: 'Zoonotic Events', spar: 52, jee: 2.6, target: 65, heprr: 'One Health Platform' },
                      { id: 'spar-04', capacity: 'Food Safety', spar: 50, jee: 2.5, target: 65, heprr: 'Food Safety Systems' },
                      { id: 'spar-05', capacity: 'Laboratory', spar: 60, jee: 3.0, target: 70, heprr: 'Laboratory Diagnostic Capacity' },
                      { id: 'spar-06', capacity: 'Surveillance', spar: 58, jee: 2.9, target: 75, heprr: 'Surveillance & Detection' },
                      { id: 'spar-07', capacity: 'Human Resources', spar: 68, jee: 3.4, target: 75, heprr: 'HRH Capacity Building' },
                      { id: 'spar-08', capacity: 'National Health Emergency Framework', spar: 54, jee: 2.7, target: 70, heprr: 'Emergency Preparedness Plan' },
                      { id: 'spar-09', capacity: 'Health Service Provision', spar: 62, jee: 3.1, target: 70, heprr: 'Health Systems Strengthening' },
                      { id: 'spar-10', capacity: 'Risk Communication', spar: 70, jee: 3.5, target: 75, heprr: 'Communication & Advocacy' },
                      { id: 'spar-11', capacity: 'Points of Entry', spar: 56, jee: 2.8, target: 65, heprr: 'Cross-border Health Surveillance' },
                      { id: 'spar-12', capacity: 'Chemical Events', spar: 64, jee: 3.2, target: 70, heprr: 'Chemical Safety Protocols' },
                      { id: 'spar-13', capacity: 'Radiation Emergencies', spar: 60, jee: 3.0, target: 65, heprr: 'Radiation Response Capacity' },
                    ].map((row, idx) => (
                      <tr
                        key={row.id}
                        className={`border-b border-border last:border-0 ${idx % 2 === 0 ? 'bg-white' : 'bg-muted/10'} hover:bg-muted/30 transition-colors`}
                      >
                        <td className="px-3 py-2.5 font-500 text-foreground">{row.capacity}</td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={`font-700 tabular-nums font-mono ${row.spar >= row.target ? 'text-emerald-700' : row.spar >= row.target - 15 ? 'text-amber-700' : 'text-red-600'}`}>
                            {row.spar}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className="font-700 tabular-nums font-mono text-violet-700">{row.jee}/5</span>
                        </td>
                        <td className="px-3 py-2.5 text-center text-muted-foreground tabular-nums">{row.target}</td>
                        <td className="px-3 py-2.5 min-w-[120px]">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-muted rounded-full h-1.5">
                              <div
                                className={`h-1.5 rounded-full ${row.spar >= row.target ? 'bg-emerald-500' : row.spar >= row.target - 15 ? 'bg-amber-400' : 'bg-red-400'}`}
                                style={{ width: `${(row.spar / 100) * 100}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">{row.heprr}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* BSC Scorecard Tab */}
        {activeTab === 'scorecard' && (
          <div className="space-y-6">
            <BSCScorecardMatrix />
            <KPIYearOnYearChart />

            {/* Role-level KPI summary — live data */}
            <div className="bg-white rounded-xl border border-border shadow-card p-5">
              <h3 className="text-sm font-700 text-foreground mb-4">Role KPI Achievement by Perspective</h3>
              {summaryLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : roleEntries.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">No review data available</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-3 gap-4">
                  {roleEntries.map(([role, stats]) => {
                    const finance = stats.avgSup;
                    const customer = Math.round((stats.avgSup + stats.avgSelf) / 2);
                    const process = Math.round(stats.submissionRate * 0.5 + stats.avgSelf * 0.5);
                    const capacity = Math.round(stats.approvalRate * 0.4 + stats.avgSup * 0.6);
                    return (
                      <div key={`role-card-${role}`} className="p-4 border border-border rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-sm font-700 text-foreground">{ROLE_LABELS[role] || role}</p>
                          <span className="text-[10px] text-muted-foreground">{stats.count} reviews</span>
                        </div>
                        <div className="space-y-2">
                          {[
                            { label: 'Finance', value: finance, color: 'bg-primary' },
                            { label: 'Customer', value: customer, color: 'bg-teal-500' },
                            { label: 'Process', value: process, color: process < 55 ? 'bg-red-400' : process < 70 ? 'bg-amber-400' : 'bg-sky-500' },
                            { label: 'Capacity', value: capacity, color: 'bg-violet-500' },
                          ].map((bar) => (
                            <div key={`${role}-bar-${bar.label}`} className="flex items-center gap-2">
                              <span className="text-[10px] text-muted-foreground w-14 flex-shrink-0">{bar.label}</span>
                              <div className="flex-1 bg-muted rounded-full h-1.5">
                                <div className={`h-1.5 ${bar.color} rounded-full`} style={{ width: `${Math.min(bar.value, 100)}%` }} />
                              </div>
                              <span className="text-[10px] font-700 tabular-nums text-foreground w-7 text-right">{bar.value}</span>
                            </div>
                          ))}
                        </div>
                        <div className="mt-3 pt-3 border-t border-border space-y-1">
                          <p className="text-[10px] text-emerald-700 flex items-center gap-1">
                            <Icon name="EcsaProgressIcon" size={10} />
                            Submission rate: {stats.submissionRate}%
                          </p>
                          <p className={`text-[10px] flex items-center gap-1 ${stats.approvalRate >= 50 ? 'text-emerald-700' : 'text-amber-700'}`}>
                            <Icon name={stats.approvalRate >= 50 ? 'EcsaSuccessIcon' : 'EcsaWarningIcon'} size={10} />
                            Approval rate: {stats.approvalRate}%
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Export Reports Tab */}
        {activeTab === 'reports' && (
          <div className="space-y-6">
            {/* Quick export options */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { id: 'qexp-pdf', label: 'Full Performance Report', format: 'PDF', icon: 'EcsaReportIcon', color: 'text-red-600', bg: 'bg-red-50' },
                { id: 'qexp-xlsx', label: 'KPI Data Export', format: 'XLSX', icon: 'EcsaBSCIcon', color: 'text-emerald-600', bg: 'bg-emerald-50' },
                { id: 'qexp-ppt', label: 'Executive Summary', format: 'PPTX', icon: 'EcsaPerformanceIcon', color: 'text-amber-600', bg: 'bg-amber-50' },
                { id: 'qexp-csv', label: 'Raw KPI Data', format: 'CSV', icon: 'EcsaClusterIcon', color: 'text-sky-600', bg: 'bg-sky-50' },
              ].map((exp) => (
                <button
                  key={exp.id}
                  onClick={() => toast.success(`Exporting ${exp.label} as ${exp.format}`)}
                  className="bg-white border border-border rounded-xl p-4 flex flex-col items-center gap-2 hover:shadow-card hover:border-primary/30 transition-all active:scale-95 group"
                >
                  <div className={`w-10 h-10 rounded-lg ${exp.bg} flex items-center justify-center`}>
                    <Icon name={exp.icon as Parameters<typeof Icon>[0]['name']} size={20} className={exp.color} />
                  </div>
                  <p className="text-xs font-600 text-foreground text-center leading-snug">{exp.label}</p>
                  <span className={`text-[10px] font-700 px-2 py-0.5 rounded-full ${exp.bg} ${exp.color}`}>{exp.format}</span>
                </button>
              ))}
            </div>

            <ReportsExportPanel />

            {/* Scheduled reports */}
            <div className="bg-white rounded-xl border border-border shadow-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-700 text-foreground">Scheduled Report Delivery</h3>
                <button className="text-xs font-600 text-primary border border-primary/30 px-3 py-1.5 rounded-lg hover:bg-primary/5 transition-colors flex items-center gap-1.5">
                  <Icon name="EcsaScheduleIcon" size={13} />
                  Schedule Report
                </button>
              </div>
              <div className="space-y-2">
                {[
                  { id: 'sched-001', report: 'Monthly KPI Dashboard Summary', frequency: 'Monthly — 1st of each month', recipients: 'DG, Directors', nextRun: '1 Apr 2026', active: true },
                  { id: 'sched-002', report: 'World Bank No Objection Status Update', frequency: 'Weekly — Every Monday', recipients: 'DoF, DoID, Dir. Programs', nextRun: '30 Mar 2026', active: true },
                  { id: 'sched-003', report: 'CPD Compliance Alert', frequency: 'Bi-weekly — Staff At Risk', recipients: 'HR Officer, Supervisors', nextRun: '7 Apr 2026', active: true },
                  { id: 'sched-004', report: 'HEPRR-MPA Indicator Snapshot', frequency: 'Quarterly — End of quarter', recipients: 'World Bank TTL, DG', nextRun: '30 Jun 2026', active: false },
                ].map((sched, idx) => (
                  <div
                    key={sched.id}
                    className={`flex items-center gap-4 p-3 rounded-lg border ${idx % 2 === 0 ? 'bg-white border-border' : 'bg-muted/10 border-border'} hover:border-primary/30 transition-colors`}
                  >
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${sched.active ? 'bg-emerald-500' : 'bg-muted-foreground'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-700 text-foreground">{sched.report}</p>
                      <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground flex-wrap">
                        <span>{sched.frequency}</span>
                        <span>→ {sched.recipients}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[11px] text-muted-foreground">Next: {sched.nextRun}</span>
                      <span className={`text-[10px] font-600 px-2 py-0.5 rounded-full ${sched.active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-50 text-slate-600 border border-slate-200'}`}>
                        {sched.active ? 'Active' : 'Paused'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Data Quality Tab */}
        {activeTab === 'data-quality' && (
          <DataValidationPanel />
        )}

        {/* KPI Staff Drill-Down Modal */}
        <KPIStaffDrillDown metric={drillMetric} onClose={() => setDrillMetric(null)} />
      </AppLayout>
    </RoleGuard>
  );
}