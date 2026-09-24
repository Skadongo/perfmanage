'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import AppLayout from '@/components/AppLayout';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { exportAuditToPDF, exportAuditToExcel } from './AuditComplianceExport';
import RoleGuard from '@/components/RoleGuard';
import { formatDate, formatDateTime } from '@/lib/dateUtils';

interface AuditRecord {
  form_type: string;
  id: string;
  staff_id: string;
  staff_name: string;
  job_title: string;
  period_label: string;
  review_year: number;
  status: string;
  workflow_stage: string | null;
  version: number;
  form_submitted_at: string | null;
  created_at: string;
  updated_at: string;
  overall_self_score: number | null;
  overall_supervisor_score: number | null;
}

type FilterType = 'all' | 'workplan' | 'evaluation';
type FilterStatus = 'all' | 'draft' | 'submitted' | 'approved' | 'rejected';

function getStatusBadge(status: string) {
  const map: Record<string, string> = {
    draft: 'bg-amber-100 text-amber-700 border border-amber-200',
    submitted: 'bg-blue-100 text-blue-700 border border-blue-200',
    approved: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    rejected: 'bg-rose-100 text-rose-700 border border-rose-200',
    'Mid-Year Review': 'bg-sky-100 text-sky-700 border border-sky-200',
    'End-Year Review': 'bg-violet-100 text-violet-700 border border-violet-200',
    'Annual Review': 'bg-indigo-100 text-indigo-700 border border-indigo-200',
  };
  return map[status] ?? 'bg-muted text-muted-foreground border border-border';
}

function getFormTypeBadge(type: string) {
  return type === 'workplan' ?'bg-teal-100 text-teal-700 border border-teal-200' :'bg-purple-100 text-purple-700 border border-purple-200';
}

function getInitials(name: string): string {
  return (name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();
}

function getAvatarColor(name: string): string {
  const colors = [
    'bg-violet-500', 'bg-sky-500', 'bg-emerald-500', 'bg-amber-500',
    'bg-rose-500', 'bg-indigo-500', 'bg-teal-500', 'bg-orange-500',
    'bg-pink-500', 'bg-cyan-500', 'bg-blue-500', 'bg-green-500',
  ];
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export default function AppraisalAuditTrailPage() {
  const [records, setRecords] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterYear, setFilterYear] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [exporting, setExporting] = useState<'pdf' | 'excel' | null>(null);

  // Stable supabase client ref
  const supabaseRef = useRef(createClient());

  const fetchAuditTrail = useCallback(async () => {
    const supabase = supabaseRef.current;
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('appraisal_audit_trail')
        .select('*')
        .order('updated_at', { ascending: false });

      if (err) throw err;
      setRecords((data as AuditRecord[]) ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load audit trail');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAuditTrail();
  }, [fetchAuditTrail]);

  const years = Array.from(new Set(records.map((r) => String(r.review_year)).filter(Boolean))).sort().reverse();

  const filtered = records.filter((r) => {
    const matchSearch =
      !search ||
      (r.staff_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (r.job_title ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (r.period_label ?? '').toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === 'all' || r.form_type === filterType;
    const matchStatus = filterStatus === 'all' || (r.status ?? '').toLowerCase() === filterStatus;
    const matchYear = filterYear === 'all' || String(r.review_year) === filterYear;
    return matchSearch && matchType && matchStatus && matchYear;
  });

  // Summary stats
  const totalRecords = records.length;
  const workplanCount = records.filter((r) => r.form_type === 'workplan').length;
  const evaluationCount = records.filter((r) => r.form_type === 'evaluation').length;
  const approvedCount = records.filter((r) => (r.status ?? '').toLowerCase() === 'approved').length;
  const submittedCount = records.filter((r) => (r.status ?? '').toLowerCase() === 'submitted').length;
  const draftCount = records.filter((r) => (r.status ?? '').toLowerCase() === 'draft').length;

  const handleExportPDF = async () => {
    setExporting('pdf');
    try {
      const dateStr = new Date().toISOString().slice(0, 10); // hydration-ok
      await exportAuditToPDF(
        filtered,
        { type: filterType, status: filterStatus, year: filterYear },
        `appraisal-compliance-report-${dateStr}.pdf`
      );
    } finally {
      setExporting(null);
    }
  };

  const handleExportExcel = async () => {
    setExporting('excel');
    try {
      const dateStr = new Date().toISOString().slice(0, 10); // hydration-ok
      await exportAuditToExcel(
        filtered,
        { type: filterType, status: filterStatus, year: filterYear },
        `appraisal-compliance-report-${dateStr}.xlsx`
      );
    } finally {
      setExporting(null);
    }
  };

  return (
    <RoleGuard minLevel={80} message="Appraisal Audit Trail is restricted to HR Officers and Directors only.">
      <AppLayout>
        <div className="min-h-screen bg-background">
          {/* Page Header */}
          <div className="bg-white border-b border-border px-6 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Icon name="ClipboardDocumentListIcon" size={20} className="text-primary" />
                </div>
                <div>
                  <h1 className="text-xl font-700 text-foreground">Appraisal Audit Trail</h1>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Submission history, version changes, signatures &amp; compliance records
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Export Excel */}
                <button
                  onClick={handleExportExcel}
                  disabled={exporting !== null || filtered.length === 0}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-emerald-200 bg-emerald-50 text-sm font-500 text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {exporting === 'excel' ? (
                    <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Icon name="TableCellsIcon" size={15} className="text-emerald-600" />
                  )}
                  {exporting === 'excel' ? 'Exporting…' : 'Export Excel'}
                </button>

                {/* Export PDF */}
                <button
                  onClick={handleExportPDF}
                  disabled={exporting !== null || filtered.length === 0}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-rose-200 bg-rose-50 text-sm font-500 text-rose-700 hover:bg-rose-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {exporting === 'pdf' ? (
                    <div className="w-4 h-4 border-2 border-rose-600 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Icon name="DocumentArrowDownIcon" size={15} className="text-rose-600" />
                  )}
                  {exporting === 'pdf' ? 'Exporting…' : 'Export PDF'}
                </button>

                <button
                  onClick={fetchAuditTrail}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-500 text-muted-foreground hover:bg-muted transition-colors"
                >
                  <Icon name="ArrowPathIcon" size={15} />
                  Refresh
                </button>
              </div>
            </div>
          </div>

          <div className="px-6 py-6 space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: 'Total Records', value: totalRecords, color: 'text-foreground', bg: 'bg-white', icon: 'ClipboardDocumentListIcon' },
                { label: 'Workplans', value: workplanCount, color: 'text-teal-700', bg: 'bg-teal-50', icon: 'DocumentTextIcon' },
                { label: 'Evaluations', value: evaluationCount, color: 'text-purple-700', bg: 'bg-purple-50', icon: 'EcsaEvaluationIcon' },
                { label: 'Approved', value: approvedCount, color: 'text-emerald-700', bg: 'bg-emerald-50', icon: 'CheckCircleIcon' },
                { label: 'Submitted', value: submittedCount, color: 'text-blue-700', bg: 'bg-blue-50', icon: 'PaperAirplaneIcon' },
                { label: 'Draft', value: draftCount, color: 'text-amber-700', bg: 'bg-amber-50', icon: 'PencilSquareIcon' },
              ].map((card) => (
                <div key={card.label} className={`${card.bg} border border-border rounded-xl p-4 flex flex-col gap-1`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-500 text-muted-foreground">{card.label}</span>
                    <Icon name={card.icon as Parameters<typeof Icon>[0]['name']} size={14} className={card.color} />
                  </div>
                  <span className={`text-2xl font-700 ${card.color}`}>{loading ? '—' : card.value}</span>
                </div>
              ))}
            </div>

            {/* Filters */}
            <div className="bg-white border border-border rounded-xl p-4">
              <div className="flex flex-wrap gap-3 items-center">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px]">
                  <Icon name="MagnifyingGlassIcon" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search by name, role, or period…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>

                {/* Form Type */}
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as FilterType)}
                  className="px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  <option value="all">All Types</option>
                  <option value="workplan">Workplan</option>
                  <option value="evaluation">Evaluation</option>
                </select>

                {/* Status */}
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
                  className="px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  <option value="all">All Statuses</option>
                  <option value="draft">Draft</option>
                  <option value="submitted">Submitted</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>

                {/* Year */}
                <select
                  value={filterYear}
                  onChange={(e) => setFilterYear(e.target.value)}
                  className="px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  <option value="all">All Years</option>
                  {years.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>

                {/* Result count */}
                <span className="text-sm text-muted-foreground ml-auto">
                  {loading ? 'Loading…' : `${filtered.length} record${filtered.length !== 1 ? 's' : ''}`}
                </span>
              </div>
            </div>

            {/* Table */}
            <div className="bg-white border border-border rounded-xl overflow-hidden">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-muted-foreground">Loading audit trail…</p>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <Icon name="ExclamationCircleIcon" size={32} className="text-rose-400" />
                  <p className="text-sm text-rose-600 font-500">{error}</p>
                  <button onClick={fetchAuditTrail} className="text-sm text-primary underline">Retry</button>
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <Icon name="ClipboardDocumentListIcon" size={32} className="text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">No audit records found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="text-left px-4 py-3 font-600 text-muted-foreground text-xs uppercase tracking-wide">Staff</th>
                        <th className="text-left px-4 py-3 font-600 text-muted-foreground text-xs uppercase tracking-wide">Form Type</th>
                        <th className="text-left px-4 py-3 font-600 text-muted-foreground text-xs uppercase tracking-wide">Period</th>
                        <th className="text-left px-4 py-3 font-600 text-muted-foreground text-xs uppercase tracking-wide">Status</th>
                        <th className="text-left px-4 py-3 font-600 text-muted-foreground text-xs uppercase tracking-wide">Version</th>
                        <th className="text-left px-4 py-3 font-600 text-muted-foreground text-xs uppercase tracking-wide">Submitted</th>
                        <th className="text-left px-4 py-3 font-600 text-muted-foreground text-xs uppercase tracking-wide">Last Updated</th>
                        <th className="text-left px-4 py-3 font-600 text-muted-foreground text-xs uppercase tracking-wide">Scores</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filtered.map((record) => {
                        const isExpanded = expandedId === record.id + record.form_type;
                        return (
                          <React.Fragment key={`${record.form_type}-${record.id}`}>
                            <tr
                              className="hover:bg-muted/30 transition-colors cursor-pointer"
                              onClick={() =>
                                setExpandedId(isExpanded ? null : record.id + record.form_type)
                              }
                            >
                              {/* Staff */}
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <div
                                    className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-700 flex-shrink-0 ${getAvatarColor(record.staff_name ?? '')}`}
                                  >
                                    {getInitials(record.staff_name ?? '—')}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-600 text-foreground truncate max-w-[160px]">
                                      {record.staff_name ?? '—'}
                                    </p>
                                    <p className="text-xs text-muted-foreground truncate max-w-[160px]">
                                      {record.job_title ?? '—'}
                                    </p>
                                  </div>
                                </div>
                              </td>

                              {/* Form Type */}
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-600 capitalize ${getFormTypeBadge(record.form_type)}`}>
                                  {record.form_type}
                                </span>
                              </td>

                              {/* Period */}
                              <td className="px-4 py-3">
                                <span className="text-foreground font-500">{record.period_label ?? record.review_year ?? '—'}</span>
                              </td>

                              {/* Status */}
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-600 capitalize ${getStatusBadge((record.status ?? '').toLowerCase())}`}>
                                  {record.status ?? '—'}
                                </span>
                              </td>

                              {/* Version */}
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1.5">
                                  <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                                    <span className="text-[10px] font-700 text-primary">v{record.version ?? 1}</span>
                                  </div>
                                  <span className="text-xs text-muted-foreground">rev {record.version ?? 1}</span>
                                </div>
                              </td>

                              {/* Submitted */}
                              <td className="px-4 py-3 text-muted-foreground text-xs">
                                {formatDate(record.form_submitted_at)}
                              </td>

                              {/* Last Updated */}
                              <td className="px-4 py-3 text-muted-foreground text-xs">
                                {formatDateTime(record.updated_at)}
                              </td>

                              {/* Scores */}
                              <td className="px-4 py-3">
                                {record.overall_self_score != null || record.overall_supervisor_score != null ? (
                                  <div className="flex flex-col gap-0.5">
                                    {record.overall_self_score != null && (
                                      <span className="text-xs text-muted-foreground">
                                        Self: <span className="font-600 text-foreground">{Number(record.overall_self_score).toFixed(2)}</span>
                                      </span>
                                    )}
                                    {record.overall_supervisor_score != null && (
                                      <span className="text-xs text-muted-foreground">
                                        Supv: <span className="font-600 text-foreground">{Number(record.overall_supervisor_score).toFixed(2)}</span>
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </td>

                              {/* Expand toggle */}
                              <td className="px-4 py-3">
                                <Icon
                                  name={isExpanded ? 'ChevronUpIcon' : 'ChevronDownIcon'}
                                  size={16}
                                  className="text-muted-foreground"
                                />
                              </td>
                            </tr>

                            {/* Expanded Detail Row */}
                            {isExpanded && (
                              <tr className="bg-muted/20">
                                <td colSpan={9} className="px-6 py-4">
                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                    {/* Submission History */}
                                    <div className="bg-white rounded-lg border border-border p-4">
                                      <div className="flex items-center gap-2 mb-3">
                                        <Icon name="ClockIcon" size={14} className="text-primary" />
                                        <span className="text-xs font-700 text-foreground uppercase tracking-wide">Submission History</span>
                                      </div>
                                      <div className="space-y-2 text-xs">
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">Created</span>
                                          <span className="font-500 text-foreground">{formatDateTime(record.created_at)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">Submitted</span>
                                          <span className="font-500 text-foreground">{formatDateTime(record.form_submitted_at)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">Last Updated</span>
                                          <span className="font-500 text-foreground">{formatDateTime(record.updated_at)}</span>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Version Changes */}
                                    <div className="bg-white rounded-lg border border-border p-4">
                                      <div className="flex items-center gap-2 mb-3">
                                        <Icon name="ArrowPathIcon" size={14} className="text-primary" />
                                        <span className="text-xs font-700 text-foreground uppercase tracking-wide">Version Changes</span>
                                      </div>
                                      <div className="space-y-2 text-xs">
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">Current Version</span>
                                          <span className="font-700 text-primary">v{record.version ?? 1}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">Review Year</span>
                                          <span className="font-500 text-foreground">{record.review_year ?? '—'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">Workflow Stage</span>
                                          <span className="font-500 text-foreground capitalize">{record.workflow_stage ?? '—'}</span>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Signatures */}
                                    <div className="bg-white rounded-lg border border-border p-4">
                                      <div className="flex items-center gap-2 mb-3">
                                        <Icon name="PencilSquareIcon" size={14} className="text-primary" />
                                        <span className="text-xs font-700 text-foreground uppercase tracking-wide">Signatures</span>
                                      </div>
                                      <div className="space-y-2 text-xs">
                                        {record.form_type === 'evaluation' ? (
                                          <>
                                            <div className="flex items-center justify-between">
                                              <span className="text-muted-foreground">Staff</span>
                                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-600 ${record.form_submitted_at ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>
                                                {record.form_submitted_at ? 'Signed' : 'Pending'}
                                              </span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                              <span className="text-muted-foreground">Supervisor</span>
                                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-600 ${(record.status ?? '').toLowerCase() === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>
                                                {(record.status ?? '').toLowerCase() === 'approved' ? 'Signed' : 'Pending'}
                                              </span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                              <span className="text-muted-foreground">HR</span>
                                              <span className="px-2 py-0.5 rounded-full text-[10px] font-600 bg-muted text-muted-foreground">Pending</span>
                                            </div>
                                          </>
                                        ) : (
                                          <>
                                            <div className="flex items-center justify-between">
                                              <span className="text-muted-foreground">Staff</span>
                                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-600 ${record.form_submitted_at ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>
                                                {record.form_submitted_at ? 'Signed' : 'Pending'}
                                              </span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                              <span className="text-muted-foreground">Supervisor</span>
                                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-600 ${(record.status ?? '').toLowerCase() === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>
                                                {(record.status ?? '').toLowerCase() === 'approved' ? 'Signed' : 'Pending'}
                                              </span>
                                            </div>
                                          </>
                                        )}
                                      </div>
                                    </div>

                                    {/* Compliance */}
                                    <div className="bg-white rounded-lg border border-border p-4">
                                      <div className="flex items-center gap-2 mb-3">
                                        <Icon name="ShieldCheckIcon" size={14} className="text-primary" />
                                        <span className="text-xs font-700 text-foreground uppercase tracking-wide">Compliance</span>
                                      </div>
                                      <div className="space-y-2 text-xs">
                                        <div className="flex items-center justify-between">
                                          <span className="text-muted-foreground">Form Submitted</span>
                                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-600 ${record.form_submitted_at ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                            {record.form_submitted_at ? '✓ Yes' : '✗ No'}
                                          </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                          <span className="text-muted-foreground">Status</span>
                                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-600 capitalize ${getStatusBadge((record.status ?? '').toLowerCase())}`}>
                                            {record.status ?? '—'}
                                          </span>
                                        </div>
                                        {record.overall_self_score != null && (
                                          <div className="flex items-center justify-between">
                                            <span className="text-muted-foreground">Self Score</span>
                                            <span className="font-600 text-foreground">{Number(record.overall_self_score).toFixed(2)}</span>
                                          </div>
                                        )}
                                        {record.overall_supervisor_score != null && (
                                          <div className="flex items-center justify-between">
                                            <span className="text-muted-foreground">Supv Score</span>
                                            <span className="font-600 text-foreground">{Number(record.overall_supervisor_score).toFixed(2)}</span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </AppLayout>
    </RoleGuard>
  );
}
