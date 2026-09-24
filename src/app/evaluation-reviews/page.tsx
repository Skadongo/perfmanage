'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import AppLayout from '@/components/AppLayout';
import ReviewTable from './components/ReviewTable';
import ReviewStatsDashboard from './components/ReviewStatsDashboard';
import WorkplanSettingForm from './components/WorkplanSettingForm';
import SelfEvaluationForm from './components/SelfEvaluationForm';
import SupervisorReviewForm from './components/SupervisorReviewForm';
import WorkflowProgressPanel from './components/WorkflowProgressPanel';
import WorkplanListView from './components/WorkplanListView';
import WorkplanBulkUpload from './components/WorkplanBulkUpload';
import WorkplanDocumentImport from './components/WorkplanDocumentImport';
import { Toaster, toast } from 'sonner';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { cachedFetch, TTL_WORKPLAN_LIST, TTL_DASHBOARD_METRICS } from '@/lib/cache';

interface ReviewSummary {
  id: string;
  staffName: string;
  role: string;
  department: string;
  reviewType: string;
  status: string;
  selfScore: number;
  supervisorScore: number;
  overallProgress: number;
}

interface WorkflowStageCounts {
  workplanPending: number;
  workplanApproved: number;
  midYearPending: number;
  midYearApproved: number;
  endYearPending: number;
  endYearApproved: number;
  total: number;
}

type ActiveForm = null | 'workplan' | 'mid-year' | 'end-year';
type UploadModal = null | 'bulk-upload' | 'doc-import';

function mapStatus(dbStatus: string): string {
  const map: Record<string, string> = {
    draft: 'pending',
    submitted: 'submitted',
    reviewed: 'in-progress',
    approved: 'approved',
    rejected: 'overdue'
  };
  return map[dbStatus] ?? 'pending';
}

function computeProgress(status: string, selfRating: number, supervisorRating: number): number {
  if (status === 'approved') return 100;
  if (status === 'submitted' && selfRating > 0) return 75;
  if (status === 'in-progress' && selfRating > 0) return 50;
  return 0;
}

export default function EvaluationReviewsPage() {
  const [activeForm, setActiveForm] = useState<ActiveForm>(null);
  const [uploadModal, setUploadModal] = useState<UploadModal>(null);
  const [importDropdownOpen, setImportDropdownOpen] = useState(false);
  const [workplanPrefill, setWorkplanPrefill] = useState<{
    staffId: string;
    staffName: string;
    jobTitle: string;
    supervisorId: string;
    supervisorName: string;
    fiscalYear: string;
    perspectivesObjectives: any[];
  } | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'supervisor-review' | 'upload-workplan'>('overview');
  const [reviewsSummary, setReviewsSummary] = useState<ReviewSummary[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [stageCounts, setStageCounts] = useState<WorkflowStageCounts>({
    workplanPending: 0,
    workplanApproved: 0,
    midYearPending: 0,
    midYearApproved: 0,
    endYearPending: 0,
    endYearApproved: 0,
    total: 0
  });
  const [stageLoading, setStageLoading] = useState(true);
  const [workplanInitiated, setWorkplanInitiated] = useState(false);

  // Stable supabase client ref — prevents re-creation on every render
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;
  const isMounted = useRef(true);

  const fetchStageCounts = useCallback(async (forceRefresh = false) => {
    setStageLoading(true);
    try {
      const data = await cachedFetch<{ workflow_stage: string }[]>(
        'eval-stage-counts',
        async () => {
          const { data: rows } = await supabase
            .from('workplan_settings')
            // Only fetch the column we need for counting
            .select('workflow_stage')
            .eq('status', 'signed');
          return rows ?? [];
        },
        forceRefresh ? 0 : TTL_WORKPLAN_LIST
      );

      const counts: WorkflowStageCounts = {
        workplanPending: 0,
        workplanApproved: 0,
        midYearPending: 0,
        midYearApproved: 0,
        endYearPending: 0,
        endYearApproved: 0,
        total: data.length
      };

      for (const row of data) {
        switch (row.workflow_stage) {
          case 'workplan_pending': counts.workplanPending++; break;
          case 'workplan_approved': counts.workplanApproved++; break;
          case 'mid_year_pending': counts.midYearPending++; break;
          case 'mid_year_approved': counts.midYearApproved++; break;
          case 'end_year_pending': counts.endYearPending++; break;
          case 'end_year_approved': counts.endYearApproved++; break;
        }
      }

      if (isMounted.current) setStageCounts(counts);
    } catch (err) {
      console.error('Failed to fetch stage counts:', err);
    } finally {
      if (isMounted.current) setStageLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    isMounted.current = true;

    async function fetchSummary() {
      setStatsLoading(true);
      try {
        const mapped = await cachedFetch<ReviewSummary[]>(
          'eval-reviews-summary',
          async () => {
            const { data, error } = await supabase
              .from('mid_year_reviews')
              // Limit columns — only what the summary display needs
              .select(`
                id,
                review_status,
                review_period,
                self_rating,
                supervisor_rating,
                staff:staff_id (
                  full_name,
                  job_title,
                  departments:department_id ( name )
                ),
                timeline:timeline_id (
                  review_period
                )
              `);

            if (error) throw error;

            return (data ?? []).map((row: Record<string, unknown>) => {
              const staffRow = row.staff as Record<string, unknown> | null;
              const deptRow = staffRow?.departments as Record<string, unknown> | null;
              const timelineRow = row.timeline as Record<string, unknown> | null;

              const selfRating = row.self_rating as number ?? 0;
              const supervisorRating = row.supervisor_rating as number ?? 0;
              const dbStatus = row.review_status as string ?? 'draft';
              const uiStatus = mapStatus(dbStatus);

              const reviewPeriod = timelineRow?.review_period as string ?? row.review_period as string ?? 'mid-year';
              const reviewType = reviewPeriod === 'annual' ? 'Annual Review' : 'Mid-Year Review';

              return {
                id: row.id as string,
                staffName: staffRow?.full_name as string ?? 'Unknown',
                role: staffRow?.job_title as string ?? '—',
                department: deptRow?.name as string ?? '—',
                reviewType,
                status: uiStatus,
                selfScore: selfRating,
                supervisorScore: supervisorRating,
                overallProgress: computeProgress(uiStatus, selfRating, supervisorRating)
              };
            });
          },
          TTL_DASHBOARD_METRICS
        );

        if (isMounted.current) setReviewsSummary(mapped);
      } catch (err) {
        console.error('Failed to fetch review summary:', err);
      } finally {
        if (isMounted.current) setStatsLoading(false);
      }
    }

    // Run both fetches in parallel
    Promise.all([fetchSummary(), fetchStageCounts()]);

    return () => { isMounted.current = false; };
  }, [fetchStageCounts, supabase]);

  // Memoize derived stats to avoid recalculation on every render
  const { totalReviews, submittedApproved, inProgress, overdue, submittedPct } = useMemo(() => {
    const total = reviewsSummary.length;
    const submitted = reviewsSummary.filter((r) => r.status === 'submitted' || r.status === 'approved').length;
    const inProg = reviewsSummary.filter((r) => r.status === 'in-progress').length;
    const ovd = reviewsSummary.filter((r) => r.status === 'overdue').length;
    const pct = total > 0 ? (submitted / total * 100).toFixed(1) : '0';
    return { totalReviews: total, submittedApproved: submitted, inProgress: inProg, overdue: ovd, submittedPct: pct };
  }, [reviewsSummary]);

  function handleFormSubmit() {
    setActiveForm(null);
    setWorkplanPrefill(null);
    setWorkplanInitiated(false);
    // Force-refresh stage counts after form submission
    fetchStageCounts(true);
    toast?.success('Saved successfully and routed for processing.');
  }

  // ── Stage status helpers ──────────────────────────────────────────────────
  // mid-year window is unlocked (open for all staff)
  const midYearAvailable = true;
  // end-year is available if any workplan is in mid_year_approved or later
  const endYearAvailable = stageCounts.midYearApproved > 0 || stageCounts.endYearPending > 0 || stageCounts.endYearApproved > 0;

  function getStageStatusBadge(stageKey: 'workplan' | 'mid-year' | 'end-year') {
    if (stageLoading) return null;
    if (stageKey === 'workplan') {
      if (stageCounts.workplanApproved > 0 || stageCounts.midYearPending > 0 || stageCounts.midYearApproved > 0 || stageCounts.endYearApproved > 0) {
        return { label: `${stageCounts.workplanApproved + stageCounts.midYearPending + stageCounts.midYearApproved + stageCounts.endYearPending + stageCounts.endYearApproved} Approved`, color: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
      }
      if (stageCounts.workplanPending > 0) {
        return { label: `${stageCounts.workplanPending} Pending Approval`, color: 'bg-amber-100 text-amber-700 border-amber-200' };
      }
      return { label: 'Not Started', color: 'bg-muted/50 text-muted-foreground border-border' };
    }
    if (stageKey === 'mid-year') {
      if (stageCounts.midYearApproved > 0 || stageCounts.endYearPending > 0 || stageCounts.endYearApproved > 0) {
        return { label: `${stageCounts.midYearApproved + stageCounts.endYearPending + stageCounts.endYearApproved} Approved`, color: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
      }
      if (stageCounts.midYearPending > 0) {
        return { label: `${stageCounts.midYearPending} Pending Approval`, color: 'bg-amber-100 text-amber-700 border-amber-200' };
      }
      if (!midYearAvailable) {
        return { label: 'Locked — Workplan Required', color: 'bg-red-50 text-red-600 border-red-200' };
      }
      return { label: `${stageCounts.workplanApproved} Ready`, color: 'bg-sky-100 text-sky-700 border-sky-200' };
    }
    if (stageKey === 'end-year') {
      if (stageCounts.endYearApproved > 0) {
        return { label: `${stageCounts.endYearApproved} Complete`, color: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
      }
      if (stageCounts.endYearPending > 0) {
        return { label: `${stageCounts.endYearPending} Pending Approval`, color: 'bg-amber-100 text-amber-700 border-amber-200' };
      }
      if (!endYearAvailable) {
        return { label: 'Locked — Mid-Year Required', color: 'bg-red-50 text-red-600 border-red-200' };
      }
      return { label: `${stageCounts.midYearApproved} Ready`, color: 'bg-violet-100 text-violet-700 border-violet-200' };
    }
    return null;
  }

  // ── Workflow stage cards ──────────────────────────────────────────────────
  const workflowStages = [
  {
    key: 'workplan' as const,
    stage: '1',
    title: 'Appraisal Plan Setting',
    subtitle: 'Beginning of Year',
    description: 'Set perspectives, objectives, and KPIs. Both staff and supervisor sign off. Supervisor approval unlocks the Mid-Year evaluation.',
    icon: 'EcsaDocIcon',
    color: 'border-primary/30 bg-primary/5',
    badgeColor: 'bg-primary/10 text-primary',
    btnColor: 'bg-primary hover:bg-primary/90',
    btnLabel: 'Start Workplan',
    timing: 'July – August',
    locked: false
  },
  {
    key: 'mid-year' as const,
    stage: '2',
    title: 'Mid-Year Self-Evaluation',
    subtitle: 'Mid-Year Review',
    description: 'Staff evaluates against the approved workplan objectives and KPIs. Requires supervisor-approved workplan. Supervisor approval unlocks End-Year.',
    icon: 'EcsaMidYearIcon',
    color: midYearAvailable ? 'border-sky-200 bg-sky-50' : 'border-border bg-muted/20',
    badgeColor: midYearAvailable ? 'bg-sky-100 text-sky-700' : 'bg-muted/50 text-muted-foreground',
    btnColor: midYearAvailable ? 'bg-sky-600 hover:bg-sky-700' : 'bg-muted text-muted-foreground cursor-not-allowed',
    btnLabel: midYearAvailable ? 'Start Mid-Year Eval' : 'Locked',
    timing: 'December – January',
    locked: !midYearAvailable
  },
  {
    key: 'end-year' as const,
    stage: '3',
    title: 'End-Year Self-Evaluation',
    subtitle: 'Annual Review',
    description: 'Final self-assessment against all workplan objectives. Requires approved Mid-Year evaluation. Objectives and KPIs carry forward automatically.',
    icon: 'EcsaApprovedIcon',
    color: endYearAvailable ? 'border-violet-200 bg-violet-50' : 'border-border bg-muted/20',
    badgeColor: endYearAvailable ? 'bg-violet-100 text-violet-700' : 'bg-muted/50 text-muted-foreground',
    btnColor: endYearAvailable ? 'bg-violet-600 hover:bg-violet-700' : 'bg-muted text-muted-foreground cursor-not-allowed',
    btnLabel: endYearAvailable ? 'Start End-Year Eval' : 'Locked',
    timing: 'May – June',
    locked: !endYearAvailable
  }];


  // ── Modal title/subtitle per form ─────────────────────────────────────────
  const formMeta: Record<string, {title: string;subtitle: string;icon: string;}> = {
    workplan: { title: 'Performance Appraisal Form', subtitle: 'Beginning of Year · Jul 2025 – Jun 2026', icon: 'EcsaDocIcon' },
    'mid-year': { title: 'Mid-Year Self-Evaluation Form', subtitle: 'Mid-Year Review · Jul 2025 – Jun 2026', icon: 'EcsaMidYearIcon' },
    'end-year': { title: 'End-Year Self-Evaluation Form', subtitle: 'Annual Review · Jul 2025 – Jun 2026', icon: 'EcsaApprovedIcon' }
  };

  return (
    <AppLayout
      pageTitle="Evaluation & Reviews"
      pageSubtitle="Mid-Year & Annual Performance Review Management · Jul 2025 – Jun 2026"
      actions={
      <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setUploadModal('bulk-upload')}
            className="flex items-center gap-1.5 text-xs font-600 text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition-colors"
          >
            <Icon name="EcsaImportIcon" size={13} className="text-emerald-600" />
            <span className="hidden sm:inline">Import Excel / CSV</span>
            <span className="sm:hidden">Excel</span>
          </button>
          <button
            type="button"
            onClick={() => setUploadModal('doc-import')}
            className="flex items-center gap-1.5 text-xs font-600 text-violet-700 bg-violet-50 border border-violet-200 px-3 py-1.5 rounded-lg hover:bg-violet-100 transition-colors"
          >
            <Icon name="EcsaDocIcon" size={13} className="text-violet-600" />
            <span className="hidden sm:inline">Import Word / PDF</span>
            <span className="sm:hidden">Word</span>
          </button>
          <button
          onClick={() => setActiveForm('workplan')}
          className="btn-brand">

            <Icon name="EcsaNewIcon" size={14} className="text-white" />
            <span className="hidden sm:inline">New Appraisal Form</span>
          </button>
        </div>
      }>

      <Toaster position="bottom-right" richColors />

      {/* ── Workplan Form Modal ── */}
      {activeForm &&
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setActiveForm(null); setWorkplanPrefill(null); }} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden animate-fade-in">
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-white">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon name={formMeta[activeForm]?.icon as any} size={16} className="text-primary" />
                </div>
                <div>
                  <h2 className="text-sm font-700 text-foreground">{formMeta[activeForm]?.title}</h2>
                  <p className="text-xs text-muted-foreground">ECSA-HC · {formMeta[activeForm]?.subtitle}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {activeForm === 'workplan' && (
                  <>
                    <button
                      type="button"
                      onClick={() => setUploadModal('bulk-upload')}
                      className="flex items-center gap-1.5 text-xs font-600 text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition-colors"
                    >
                      <Icon name="EcsaImportIcon" size={13} className="text-emerald-600" />
                      <span className="hidden sm:inline">Import Excel / CSV</span>
                      <span className="sm:hidden">Excel</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setUploadModal('doc-import')}
                      className="flex items-center gap-1.5 text-xs font-600 text-violet-700 bg-violet-50 border border-violet-200 px-3 py-1.5 rounded-lg hover:bg-violet-100 transition-colors"
                    >
                      <Icon name="EcsaDocIcon" size={13} className="text-violet-600" />
                      <span className="hidden sm:inline">Import Word / PDF</span>
                      <span className="sm:hidden">Word</span>
                    </button>
                  </>
                )}
                <button
                onClick={() => { setActiveForm(null); setWorkplanPrefill(null); }}
                className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Close form">
                  <Icon name="XMarkIcon" size={18} />
                </button>
              </div>
            </div>
            {/* Form content */}
            <div className="flex-1 overflow-y-auto flex flex-col">
              {activeForm === 'workplan' &&
            <WorkplanSettingForm
              onClose={() => { setActiveForm(null); setWorkplanPrefill(null); setWorkplanInitiated(false); }}
              onSubmit={handleFormSubmit}
              onWorkplanReady={() => setWorkplanInitiated(true)}
              onImportExcel={() => { setUploadModal('bulk-upload'); }}
              onImportWord={() => { setUploadModal('doc-import'); }}
              prefillData={workplanPrefill}
            />
            }
              {(activeForm === 'mid-year' || activeForm === 'end-year') &&
            <SelfEvaluationForm
              reviewPeriod={activeForm === 'end-year' ? 'annual' : 'mid-year'}
              onClose={() => setActiveForm(null)}
              onSubmit={handleFormSubmit} />

            }
            </div>
          </div>
        </div>
      }

      {/* ── Bulk Upload Modal ── */}
      {uploadModal === 'bulk-upload' && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setUploadModal(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden animate-fade-in">
            <WorkplanBulkUpload
              onClose={() => setUploadModal(null)}
              onComplete={() => {
                setUploadModal(null);
                fetchStageCounts(true);
              }}
            />
          </div>
        </div>
      )}

      {/* ── Document Import Modal ── */}
      {uploadModal === 'doc-import' && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setUploadModal(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[95vh] flex flex-col overflow-hidden animate-fade-in">
            <WorkplanDocumentImport
              onClose={() => setUploadModal(null)}
              onPrefill={(data) => {
                setWorkplanPrefill(data);
                setUploadModal(null);
                setActiveForm('workplan');
                toast.success('Document parsed — form pre-filled. Review and save.');
              }}
            />
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* ── Always-visible Import Actions Bar ── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white border border-border rounded-xl px-4 py-3 shadow-card">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Icon name="EcsaImportIcon" size={16} className="text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-700 text-foreground">Import Workplan Data</p>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Use the ECSA-HC Individual Performance Contract format (Performance_contract_Template).
                Upload Excel/CSV for bulk data or Word/PDF to auto-parse objectives.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setUploadModal('bulk-upload')}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 text-xs font-600 text-emerald-700 bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-lg hover:bg-emerald-100 active:scale-95 transition-all"
            >
              <Icon name="EcsaImportIcon" size={14} className="text-emerald-600 flex-shrink-0" />
              Import Excel / CSV
            </button>
            <button
              type="button"
              onClick={() => setUploadModal('doc-import')}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 text-xs font-600 text-violet-700 bg-violet-50 border border-violet-200 px-4 py-2 rounded-lg hover:bg-violet-100 active:scale-95 transition-all"
            >
              <Icon name="EcsaDocIcon" size={14} className="text-violet-600 flex-shrink-0" />
              Import Word / PDF
            </button>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-4 gap-4">
          {[
          { id: 'stat-total', label: 'Total Reviews', value: statsLoading ? '…' : String(totalReviews), sub: 'Jul 2025 – Jun 2026', color: 'text-foreground', bg: 'bg-white' },
          { id: 'stat-submitted', label: 'Submitted / Approved', value: statsLoading ? '…' : String(submittedApproved), sub: statsLoading ? '—' : `${submittedPct}% of total`, color: 'text-emerald-700', bg: 'bg-emerald-50' },
          { id: 'stat-progress', label: 'In Progress', value: statsLoading ? '…' : String(inProgress), sub: 'Self-eval underway', color: 'text-sky-700', bg: 'bg-sky-50' },
          { id: 'stat-overdue', label: 'Overdue', value: statsLoading ? '…' : String(overdue), sub: 'Immediate action needed', color: 'text-red-700', bg: 'bg-red-50' }]?.
          map((s) =>
          <div key={s?.id} className={`${s?.bg} rounded-xl border border-border shadow-card p-4`}>
              <p className="text-[11px] font-600 uppercase tracking-wider text-muted-foreground">{s?.label}</p>
              <p className={`text-2xl font-700 mt-1 tabular-nums font-mono ${s?.color}`}>{s?.value}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{s?.sub}</p>
            </div>
          )}
        </div>

        {/* ── 3-Stage Workflow Cards ── */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Icon name="EcsaWorkflowIcon" size={16} className="text-primary" />
            <h2 className="text-sm font-700 text-foreground">Evaluation Workflow</h2>
            <span className="text-xs text-muted-foreground">· Three-stage annual performance cycle with supervisor approval gates</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {workflowStages.map((stage, idx) => {
              const statusBadge = getStageStatusBadge(stage.key);
              return (
                <div key={stage.key} className={`rounded-xl border p-5 space-y-3 ${stage.color} ${stage.locked ? 'opacity-70' : ''}`}>
                  {/* Stage badge + connector */}
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-800 px-2.5 py-1 rounded-full ${stage.badgeColor}`}>
                      Stage {stage.stage}
                    </span>
                    {idx < workflowStages.length - 1 &&
                    <Icon name="EcsaChevronRightIcon" size={12} className="text-muted-foreground hidden md:block" />
                    }
                    <span className="text-[10px] text-muted-foreground ml-auto">{stage.timing}</span>
                  </div>

                  {/* Icon + title */}
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-white/70 border border-white shadow-sm flex items-center justify-center flex-shrink-0">
                      {stage.locked ?
                      <Icon name="EcsaLockedIcon" size={16} className="text-muted-foreground/60" /> :
                      <Icon name={stage.icon as any} size={18} className="text-foreground/70" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-700 text-foreground">{stage.title}</h3>
                      <p className="text-[11px] text-muted-foreground">{stage.subtitle}</p>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-muted-foreground leading-relaxed">{stage.description}</p>

                  {/* Live status badge */}
                  {statusBadge && !stageLoading &&
                  <div className={`inline-flex items-center gap-1 text-[10px] font-600 px-2 py-0.5 rounded-full border ${statusBadge.color}`}>
                      <div className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                      {statusBadge.label}
                    </div>
                  }
                  {stageLoading &&
                  <div className="h-5 w-24 bg-muted/40 rounded-full animate-pulse" />
                  }

                  {/* CTA */}
                  <button
                    onClick={() => !stage.locked && setActiveForm(stage.key)}
                    disabled={stage.locked}
                    className={`w-full flex items-center justify-center gap-1.5 text-xs font-600 text-white px-3 py-2 rounded-lg transition-all active:scale-95 ${stage.btnColor}`}>

                    {stage.locked ?
                    <><Icon name="EcsaLockedIcon" size={13} /> {stage.btnLabel}</> :
                    <><Icon name="EcsaNewIcon" size={13} /> {stage.btnLabel}</>
                    }
                  </button>
                </div>);

            })}
          </div>

          {/* Workflow legend */}
          <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Icon name="EcsaChevronRightIcon" size={11} className="text-primary" />
              Each stage requires supervisor approval to unlock the next
            </span>
            <span className="flex items-center gap-1.5">
              <Icon name="EcsaDocIcon" size={11} className="text-primary" />
              Objectives & KPIs carry forward from the approved workplan
            </span>
          </div>
        </div>

        {/* Rating standards reference */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Icon name="EcsaInfoIcon" size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-700 text-amber-800 mb-1">Rating Standards Reference</p>
              <div className="flex flex-wrap gap-3 text-xs">
                {[
                { score: '5', label: 'Outstanding', desc: 'Significantly exceeds all expectations' },
                { score: '4', label: 'Exceeds Expectations', desc: 'Consistently above target' },
                { score: '3', label: 'Meets Expectations', desc: 'Achieves all agreed targets' },
                { score: '2', label: 'Needs Improvement', desc: 'Partially meets expectations' },
                { score: '1', label: 'Unsatisfactory', desc: 'Does not meet minimum standards' }]?.
                map((r) =>
                <span key={`rating-${r?.score}`} className="flex items-center gap-1.5 text-amber-800">
                    <span className="font-800 text-amber-900">{r?.score} — {r?.label}:</span> {r?.desc}
                    <span className="text-amber-300 last:hidden">·</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="w-full overflow-x-auto">
          <div className="flex items-center gap-1 bg-muted/30 border border-border rounded-xl p-1 min-w-max">
            {[
            { key: 'overview', label: 'Overview & All Reviews', icon: 'EcsaCapacityIcon' },
            { key: 'supervisor-review', label: 'Supervisor Review Form', icon: 'EcsaEvaluationIcon' },
            { key: 'upload-workplan', label: 'Upload Workplan', icon: 'EcsaImportIcon' }].
            map((tab) =>
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as 'overview' | 'supervisor-review' | 'upload-workplan')}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-600 rounded-lg transition-all whitespace-nowrap ${
              activeTab === tab.key ?
              'bg-white text-primary shadow-sm border border-border' :
              'text-muted-foreground hover:text-foreground'}`
              }>
                <Icon name={tab.icon} size={14} />
                {tab.label}
              </button>
            )}
          </div>
        </div>

        {/* Tab content */}
        {activeTab === 'overview' && (
          <>
            {/* Workflow Progress Panel — real-time stage data */}
            <WorkflowProgressPanel />

            <div className="bg-muted/20 rounded-xl border border-border p-5">
              {statsLoading ?
            <div className="flex items-center justify-center py-12">
                  <Icon name="EcsaRefreshIcon" size={24} className="text-primary animate-spin" />
                </div> :

            <ReviewStatsDashboard reviews={reviewsSummary} />
            }
            </div>

            {/* Paginated workplan list with fiscal-year accordion */}
            <div className="bg-white rounded-xl border border-border shadow-card p-5">
              <WorkplanListView onOpenWorkplan={() => setActiveForm('workplan')} />
            </div>

            <ReviewTable />
          </>
        )}

        {activeTab === 'supervisor-review' && (
          <div className="bg-white rounded-xl border border-border shadow-card p-5">
            <SupervisorReviewForm />
          </div>
        )}

        {/* ── Upload Workplan Tab ── */}
        {activeTab === 'upload-workplan' && (
          <div className="space-y-4">
            {/* Header */}
            <div className="bg-white rounded-xl border border-border shadow-card px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Icon name="EcsaImportIcon" size={20} className="text-primary" />
                </div>
                <div>
                  <h2 className="text-sm font-700 text-foreground">Upload Workplan</h2>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    Import your ECSA-HC Individual Performance Contract workplan data using the standard template
                    (<span className="font-600 text-foreground/70">Performance_contract_Template</span>).
                    Choose the format that matches your file.
                  </p>
                </div>
              </div>
            </div>

            {/* Two full-width import cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Import Excel / CSV Card */}
              <button
                type="button"
                onClick={() => setUploadModal('bulk-upload')}
                className="group text-left bg-white rounded-xl border-2 border-emerald-200 hover:border-emerald-400 shadow-card hover:shadow-md transition-all active:scale-[0.99] p-6 flex flex-col gap-4 w-full"
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 group-hover:bg-emerald-100 flex items-center justify-center flex-shrink-0 transition-colors">
                    <Icon name="EcsaImportIcon" size={28} className="text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-base font-700 text-foreground">Import Excel / CSV</p>
                    <p className="text-xs text-emerald-700 font-600 mt-0.5">.xlsx · .xls · .csv</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Upload a spreadsheet file following the ECSA-HC Performance Contract template.
                  Bulk-import multiple staff objectives, KPIs, and targets in one step.
                  Ideal for HR administrators managing large teams.
                </p>
                <div className="flex flex-wrap gap-2 mt-auto">
                  {['Bulk import', 'Multiple staff', 'Objectives & KPIs', 'Auto-mapped columns'].map((tag) => (
                    <span key={tag} className="text-[10px] font-600 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-1.5 text-xs font-700 text-emerald-700 group-hover:gap-2.5 transition-all">
                  <Icon name="EcsaImportIcon" size={14} className="text-emerald-600" />
                  Click to upload Excel / CSV
                  <Icon name="EcsaChevronRightIcon" size={12} className="text-emerald-500 ml-auto" />
                </div>
              </button>

              {/* Import Word / PDF Card */}
              <button
                type="button"
                onClick={() => setUploadModal('doc-import')}
                className="group text-left bg-white rounded-xl border-2 border-violet-200 hover:border-violet-400 shadow-card hover:shadow-md transition-all active:scale-[0.99] p-6 flex flex-col gap-4 w-full"
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-violet-50 border border-violet-200 group-hover:bg-violet-100 flex items-center justify-center flex-shrink-0 transition-colors">
                    <Icon name="EcsaDocIcon" size={28} className="text-violet-600" />
                  </div>
                  <div>
                    <p className="text-base font-700 text-foreground">Import Word / PDF</p>
                    <p className="text-xs text-violet-700 font-600 mt-0.5">.docx · .doc · .pdf</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Upload a Word document or PDF of the ECSA-HC Individual Performance Contract.
                  The system will auto-parse objectives and KPIs and pre-fill the appraisal form
                  for your review before saving.
                </p>
                <div className="flex flex-wrap gap-2 mt-auto">
                  {['Auto-parse', 'Pre-fill form', 'Review before save', 'Single staff'].map((tag) => (
                    <span key={tag} className="text-[10px] font-600 px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-1.5 text-xs font-700 text-violet-700 group-hover:gap-2.5 transition-all">
                  <Icon name="EcsaDocIcon" size={14} className="text-violet-600" />
                  Click to upload Word / PDF
                  <Icon name="EcsaChevronRightIcon" size={12} className="text-violet-500 ml-auto" />
                </div>
              </button>
            </div>

            {/* Format guidance note */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
              <Icon name="EcsaInfoIcon" size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 leading-relaxed">
                <span className="font-700">Template required:</span> Files must follow the ECSA-HC Individual Performance Contract format
                (<span className="font-600">Performance_contract_Template</span>). Columns and sections must match the standard template
                for successful import. Contact HR for the latest template version.
              </p>
            </div>
          </div>
        )}
      </div>
    </AppLayout>);

}