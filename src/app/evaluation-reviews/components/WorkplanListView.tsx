'use client';

/**
 * WorkplanListView — paginated, filterable workplan list with fiscal-year accordion.
 *
 * - Paginated table (20 per page) sorted by fiscal year
 * - Fiscal-year accordion: only the active year expands and fetches data
 * - Role-scoped: staff see own, supervisors see direct reports, directors see all
 * - Indexed filtering: fiscal_year, status, workflow_stage
 * - Background prefetch of previous year for instant switching
 */

import React, { useState, useMemo } from 'react';
import Icon from '@/components/ui/AppIcon';
import StatusBadge from '@/components/ui/StatusBadge';
import {
  useWorkplans,
  FISCAL_YEARS,
  CURRENT_FISCAL_YEAR,
  WorkplanFilters,
  WorkplanRow,
} from '@/hooks/useWorkplans';
import { useAuth } from '@/contexts/AuthContext';

// ── Status display helpers ─────────────────────────────────────────────────────
const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  signed: 'Signed',
  approved: 'Approved',
  rejected: 'Rejected',
};

const STAGE_LABELS: Record<string, string> = {
  workplan_pending: 'Workplan Pending',
  workplan_approved: 'Workplan Approved',
  mid_year_pending: 'Mid-Year Pending',
  mid_year_approved: 'Mid-Year Approved',
  end_year_pending: 'End-Year Pending',
  end_year_approved: 'End-Year Complete',
};

const STAGE_COLORS: Record<string, string> = {
  workplan_pending: 'bg-amber-100 text-amber-700',
  workplan_approved: 'bg-emerald-100 text-emerald-700',
  mid_year_pending: 'bg-sky-100 text-sky-700',
  mid_year_approved: 'bg-teal-100 text-teal-700',
  end_year_pending: 'bg-violet-100 text-violet-700',
  end_year_approved: 'bg-green-100 text-green-700',
};

// ── Fiscal Year Accordion Panel ────────────────────────────────────────────────
interface FiscalYearPanelProps {
  fiscalYear: string;
  isOpen: boolean;
  onToggle: () => void;
  onOpenWorkplan?: (row: WorkplanRow) => void;
}

function FiscalYearPanel({ fiscalYear, isOpen, onToggle, onOpenWorkplan }: FiscalYearPanelProps) {
  const [statusFilter, setStatusFilter] = useState('');
  const [stageFilter, setStageFilter] = useState('');

  const filters: WorkplanFilters = useMemo(
    () => ({
      fiscalYear,
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(stageFilter ? { workflowStage: stageFilter } : {}),
    }),
    [fiscalYear, statusFilter, stageFilter]
  );

  const {
    workplans,
    loading,
    error,
    page,
    totalCount,
    hasNextPage,
    hasPrevPage,
    nextPage,
    prevPage,
    goToPage,
    refresh,
  } = useWorkplans({
    enabled: isOpen,   // lazy: only fetch when accordion is open
    filters,
    fiscalYear,
  });

  const totalPages = Math.ceil(totalCount / 20);

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      {/* Accordion header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-3.5 bg-white hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Icon
            name={isOpen ? 'EcsaChevronDownIcon' : 'EcsaChevronRightIcon'}
            size={14}
            className="text-muted-foreground"
          />
          <div className="flex items-center gap-2">
            <Icon name="EcsaDocIcon" size={15} className="text-primary" />
            <span className="text-sm font-700 text-foreground">
              Fiscal Year {fiscalYear}
            </span>
            {fiscalYear === CURRENT_FISCAL_YEAR && (
              <span className="text-[10px] font-600 px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                Current
              </span>
            )}
          </div>
        </div>
        {isOpen && !loading && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {totalCount} workplan{totalCount !== 1 ? 's' : ''}
          </span>
        )}
        {isOpen && loading && (
          <div className="w-16 h-4 bg-muted/40 rounded animate-pulse" />
        )}
      </button>

      {/* Accordion body — only rendered when open */}
      {isOpen && (
        <div className="border-t border-border bg-white">
          {/* Filters row */}
          <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-border bg-muted/10">
            <Icon name="EcsaFilterIcon" size={13} className="text-muted-foreground" />
            <span className="text-xs text-muted-foreground font-600">Filter:</span>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs border border-border rounded-lg px-2.5 py-1.5 bg-white text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
            >
              <option value="">All Statuses</option>
              {Object.entries(STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>

            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="text-xs border border-border rounded-lg px-2.5 py-1.5 bg-white text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
            >
              <option value="">All Stages</option>
              {Object.entries(STAGE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>

            {(statusFilter || stageFilter) && (
              <button
                onClick={() => { setStatusFilter(''); setStageFilter(''); }}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <Icon name="XMarkIcon" size={12} />
                Clear
              </button>
            )}

            <button
              onClick={refresh}
              className="ml-auto text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <Icon name="EcsaRefreshIcon" size={13} />
              Refresh
            </button>
          </div>

          {/* Error state */}
          {error && (
            <div className="px-5 py-4 text-sm text-red-600 flex items-center gap-2">
              <Icon name="EcsaAlertIcon" size={15} />
              {error}
            </div>
          )}

          {/* Loading skeleton */}
          {loading && (
            <div className="divide-y divide-border">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-3.5 animate-pulse">
                  <div className="w-32 h-3.5 bg-muted/50 rounded" />
                  <div className="w-24 h-3.5 bg-muted/40 rounded" />
                  <div className="w-20 h-3.5 bg-muted/30 rounded ml-auto" />
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && workplans.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
              <Icon name="EcsaDocIcon" size={28} className="opacity-30" />
              <p className="text-sm">No workplans found for {fiscalYear}</p>
              {(statusFilter || stageFilter) && (
                <p className="text-xs">Try clearing the filters above</p>
              )}
            </div>
          )}

          {/* Data table */}
          {!loading && workplans.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/20">
                    <th className="text-left px-5 py-2.5 font-600 text-muted-foreground">Staff Member</th>
                    <th className="text-left px-4 py-2.5 font-600 text-muted-foreground">Job Title</th>
                    <th className="text-left px-4 py-2.5 font-600 text-muted-foreground">Supervisor</th>
                    <th className="text-left px-4 py-2.5 font-600 text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-2.5 font-600 text-muted-foreground">Stage</th>
                    <th className="text-left px-4 py-2.5 font-600 text-muted-foreground">Updated</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {workplans.map((row) => (
                    <WorkplanTableRow
                      key={row.id}
                      row={row}
                      onOpen={onOpenWorkplan}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!loading && totalCount > 20 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-muted/10">
              <span className="text-xs text-muted-foreground">
                Page {page} of {totalPages} · {totalCount} total
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={prevPage}
                  disabled={!hasPrevPage}
                  className="p-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Icon name="EcsaChevronLeftIcon" size={13} />
                </button>

                {/* Page number buttons (show up to 5) */}
                {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
                  const startPage = Math.max(1, Math.min(page - 2, totalPages - 4));
                  const p = startPage + i;
                  if (p > totalPages) return null;
                  return (
                    <button
                      key={p}
                      onClick={() => goToPage(p)}
                      className={`w-7 h-7 rounded-md text-xs font-600 transition-colors ${
                        p === page
                          ? 'bg-primary text-white' :'border border-border text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}

                <button
                  onClick={nextPage}
                  disabled={!hasNextPage}
                  className="p-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Icon name="EcsaChevronRightIcon" size={13} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Individual row ─────────────────────────────────────────────────────────────
interface WorkplanTableRowProps {
  row: WorkplanRow;
  onOpen?: (row: WorkplanRow) => void;
}

function WorkplanTableRow({ row, onOpen }: WorkplanTableRowProps) {
  const stageColor = STAGE_COLORS[row.workflow_stage] ?? 'bg-muted/50 text-muted-foreground';
  const stageLabel = STAGE_LABELS[row.workflow_stage] ?? row.workflow_stage;

  const updatedDate = row.updated_at
    ? new Date(row.updated_at).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '—';

  return (
    <tr className="hover:bg-muted/10 transition-colors group">
      <td className="px-5 py-3 font-600 text-foreground">{row.staff_name}</td>
      <td className="px-4 py-3 text-muted-foreground">{row.job_title}</td>
      <td className="px-4 py-3 text-muted-foreground">{row.supervisor_name ?? '—'}</td>
      <td className="px-4 py-3">
        <StatusBadge status={row.status} />
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center text-[10px] font-600 px-2 py-0.5 rounded-full ${stageColor}`}>
          {stageLabel}
        </span>
      </td>
      <td className="px-4 py-3 text-muted-foreground tabular-nums">{updatedDate}</td>
      <td className="px-4 py-3">
        {onOpen && (
          <button
            onClick={() => onOpen(row)}
            className="opacity-0 group-hover:opacity-100 text-xs text-primary hover:underline transition-opacity"
          >
            View
          </button>
        )}
      </td>
    </tr>
  );
}

// ── Main WorkplanListView ──────────────────────────────────────────────────────
interface WorkplanListViewProps {
  onOpenWorkplan?: (row: WorkplanRow) => void;
}

export default function WorkplanListView({ onOpenWorkplan }: WorkplanListViewProps) {
  const { profile } = useAuth();
  const [openYear, setOpenYear] = useState<string>(CURRENT_FISCAL_YEAR);

  const isElevated = ['superuser', 'support_admin', 'executive_director', 'deputy_director', 'hr_admin_officer'].includes(
    profile?.systemRole ?? ''
  );

  const toggleYear = (year: string) => {
    setOpenYear((prev) => (prev === year ? '' : year));
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="EcsaWorkflowIcon" size={16} className="text-primary" />
          <h3 className="text-sm font-700 text-foreground">Workplan Records</h3>
          {isElevated && (
            <span className="text-[10px] text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-full">
              All staff · paginated
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Icon name="EcsaInfoIcon" size={12} />
          Click a year to expand · 20 records per page
        </div>
      </div>

      {/* Fiscal year accordions */}
      <div className="space-y-2">
        {FISCAL_YEARS.map((year) => (
          <FiscalYearPanel
            key={year}
            fiscalYear={year}
            isOpen={openYear === year}
            onToggle={() => toggleYear(year)}
            onOpenWorkplan={onOpenWorkplan}
          />
        ))}
      </div>
    </div>
  );
}
