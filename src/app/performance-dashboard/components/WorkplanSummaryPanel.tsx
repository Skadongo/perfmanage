'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { cachedFetch, TTL_WORKPLAN_LIST, TTL_DASHBOARD_METRICS } from '@/lib/cache';

// ── Types ─────────────────────────────────────────────────────────────────────

interface KPIRow {
  id: string;
  perspective: string;
  objective: string;
  activities: string;
  kpi: string;
  target: string;
  weight: number;
}

interface CompetencyRow {
  id: string;
  name: string;
  description: string;
  weight: number;
}

/** Lightweight list record — no heavy JSON columns */
interface WorkplanListRecord {
  id: string;
  fiscal_year: string;
  review_year: number;
  status: string;
  workflow_stage: string;
  staff_signature: string | null;
  staff_signed_at: string | null;
  staff: { full_name: string; job_title: string; email: string | null } | null;
  supervisor: { full_name: string; job_title: string } | null;
}

/** Full record with JSON detail — fetched only when a row is expanded */
interface WorkplanDetailRecord extends WorkplanListRecord {
  perspectives_objectives: KPIRow[];
  general_competencies: CompetencyRow[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STAGE_LABELS: Record<string, string> = {
  workplan_pending: 'Workplan Pending',
  workplan_approved: 'Workplan Approved',
  mid_year_pending: 'Mid-Year Pending',
  mid_year_approved: 'Mid-Year Approved',
  end_year_pending: 'End-Year Pending',
  end_year_approved: 'End-Year Complete',
};

const STAGE_COLORS: Record<string, string> = {
  workplan_pending: 'bg-amber-100 text-amber-700 border-amber-200',
  workplan_approved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  mid_year_pending: 'bg-sky-100 text-sky-700 border-sky-200',
  mid_year_approved: 'bg-teal-100 text-teal-700 border-teal-200',
  end_year_pending: 'bg-violet-100 text-violet-700 border-violet-200',
  end_year_approved: 'bg-green-100 text-green-700 border-green-200',
};

// ── Fetchers ──────────────────────────────────────────────────────────────────

/** Lightweight list fetch — excludes heavy JSON columns */
async function fetchWorkplanList(): Promise<WorkplanListRecord[]> {
  return cachedFetch(
    'workplan-summary-list',
    async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('workplan_settings')
        .select(`
          id,
          fiscal_year,
          review_year,
          status,
          workflow_stage,
          staff_signature,
          staff_signed_at,
          staff:staff_id ( full_name, job_title, email ),
          supervisor:supervisor_id ( full_name, job_title )
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      return (data ?? []).map((row: any) => ({
        id: row.id,
        fiscal_year: row.fiscal_year,
        review_year: row.review_year,
        status: row.status,
        workflow_stage: row.workflow_stage,
        staff_signature: row.staff_signature,
        staff_signed_at: row.staff_signed_at,
        staff: row.staff ?? null,
        supervisor: row.supervisor ?? null,
      }));
    },
    TTL_WORKPLAN_LIST
  );
}

/** Detail fetch — only called when a row is expanded */
async function fetchWorkplanDetail(id: string): Promise<WorkplanDetailRecord | null> {
  return cachedFetch(
    `workplan-detail:${id}`,
    async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('workplan_settings')
        .select(`
          id,
          fiscal_year,
          review_year,
          status,
          workflow_stage,
          staff_signature,
          staff_signed_at,
          perspectives_objectives,
          general_competencies,
          staff:staff_id ( full_name, job_title, email ),
          supervisor:supervisor_id ( full_name, job_title )
        `)
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return {
        id: data.id,
        fiscal_year: data.fiscal_year,
        review_year: data.review_year,
        status: data.status,
        workflow_stage: data.workflow_stage,
        staff_signature: data.staff_signature,
        staff_signed_at: data.staff_signed_at,
        perspectives_objectives: Array.isArray(data.perspectives_objectives) ? data.perspectives_objectives : [],
        general_competencies: Array.isArray(data.general_competencies) ? data.general_competencies : [],
        staff: (data as any).staff ?? null,
        supervisor: (data as any).supervisor ?? null,
      };
    },
    TTL_DASHBOARD_METRICS
  );
}

// ── Expanded detail sub-component ─────────────────────────────────────────────

function WorkplanDetail({ id }: { id: string }) {
  const { data: wp, isLoading } = useSWR(
    ['workplan-detail', id],
    () => fetchWorkplanDetail(id),
    { revalidateOnFocus: false, dedupingInterval: 120_000 }
  );

  if (isLoading || !wp) {
    return (
      <div className="border-t border-border px-4 py-6 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const kpiTotal = wp.perspectives_objectives.reduce((s, k) => s + (k.weight ?? 0), 0);
  const compTotal = wp.general_competencies.reduce((s, c) => s + (c.weight ?? 0), 0);

  return (
    <div className="border-t border-border px-4 pb-5 pt-4 space-y-5">
      {/* Meta info */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-muted/30 rounded-lg p-2.5">
          <p className="text-[10px] font-600 uppercase tracking-wider text-muted-foreground mb-0.5">Staff</p>
          <p className="text-xs font-600 text-foreground">{wp.staff?.full_name ?? '—'}</p>
        </div>
        <div className="bg-muted/30 rounded-lg p-2.5">
          <p className="text-[10px] font-600 uppercase tracking-wider text-muted-foreground mb-0.5">Supervisor</p>
          <p className="text-xs font-600 text-foreground">{wp.supervisor?.full_name ?? '—'}</p>
        </div>
        <div className="bg-muted/30 rounded-lg p-2.5">
          <p className="text-[10px] font-600 uppercase tracking-wider text-muted-foreground mb-0.5">Fiscal Year</p>
          <p className="text-xs font-600 text-foreground">{wp.fiscal_year}</p>
        </div>
        <div className="bg-muted/30 rounded-lg p-2.5">
          <p className="text-[10px] font-600 uppercase tracking-wider text-muted-foreground mb-0.5">Signed By</p>
          <p className="text-xs font-600 text-foreground">{wp.staff_signature ?? '—'}</p>
        </div>
      </div>

      {/* Part 1: Scorecard KPIs */}
      {wp.perspectives_objectives.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-700 uppercase tracking-wider text-foreground flex items-center gap-1.5">
              <Icon name="ChartBarIcon" size={13} className="text-primary" />
              Part 1 — Scorecard Performance (80%)
            </h4>
            <span className="text-[11px] text-muted-foreground">
              Total weight: <span className="font-700 text-foreground">{kpiTotal}</span>
            </span>
          </div>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/40 border-b border-border">
                  <th className="text-left px-3 py-2 font-600 text-muted-foreground w-8">#</th>
                  <th className="text-left px-3 py-2 font-600 text-muted-foreground">KPI / Indicator</th>
                  <th className="text-left px-3 py-2 font-600 text-muted-foreground">Activities</th>
                  <th className="text-left px-3 py-2 font-600 text-muted-foreground">Target</th>
                  <th className="text-center px-3 py-2 font-600 text-muted-foreground w-16">Weight</th>
                </tr>
              </thead>
              <tbody>
                {wp.perspectives_objectives.map((kpi, idx) => (
                  <tr key={kpi.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-muted/20'}>
                    <td className="px-3 py-2 text-muted-foreground font-600">{idx + 1}</td>
                    <td className="px-3 py-2">
                      <p className="font-600 text-foreground leading-snug">{kpi.kpi}</p>
                      <p className="text-muted-foreground mt-0.5 text-[11px]">{kpi.perspective}</p>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground leading-snug max-w-xs">{kpi.activities}</td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1 bg-sky-50 text-sky-700 border border-sky-200 rounded-md px-2 py-0.5 font-600 text-[11px]">
                        <Icon name="FlagIcon" size={10} />
                        {kpi.target}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary font-700 text-[11px]">
                        {kpi.weight}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Part 2: General Competencies */}
      {wp.general_competencies.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-700 uppercase tracking-wider text-foreground flex items-center gap-1.5">
              <Icon name="UserGroupIcon" size={13} className="text-violet-600" />
              Part 2 — General Competencies (20%)
            </h4>
            <span className="text-[11px] text-muted-foreground">
              Total weight: <span className="font-700 text-foreground">{compTotal}</span>
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {wp.general_competencies.map((comp) => (
              <div key={comp.id} className="border border-border rounded-lg p-3 bg-muted/20">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-700 text-foreground">{comp.name}</p>
                  <span className="text-[11px] font-700 text-violet-700 bg-violet-50 border border-violet-200 rounded-full px-2 py-0.5">
                    {comp.weight}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">{comp.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weight summary bar */}
      <div className="flex items-center gap-4 bg-muted/30 rounded-lg px-4 py-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm bg-primary inline-block" />
          <span className="text-muted-foreground">Scorecard KPIs:</span>
          <span className="font-700 text-foreground">{kpiTotal} pts (80%)</span>
        </div>
        <div className="w-px h-4 bg-border" />
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm bg-violet-500 inline-block" />
          <span className="text-muted-foreground">Competencies:</span>
          <span className="font-700 text-foreground">{compTotal} pts (20%)</span>
        </div>
        <div className="w-px h-4 bg-border" />
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Total:</span>
          <span className="font-700 text-foreground">{kpiTotal + compTotal} pts</span>
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function WorkplanSummaryPanel() {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: workplans, isLoading, error } = useSWR(
    'workplan-summary-list',
    fetchWorkplanList,
    {
      revalidateOnFocus: false,
      dedupingInterval: 120_000,
      onSuccess: (data) => {
        // Auto-expand first record only on initial load
        if (data.length > 0 && expandedId === null) {
          setExpandedId(data[0].id);
        }
      },
    }
  );

  if (isLoading) {
    return (
      <div className="card p-5 space-y-3 animate-pulse">
        <div className="h-4 bg-muted/60 rounded w-1/3" />
        <div className="h-3 bg-muted/40 rounded w-2/3" />
        <div className="h-24 bg-muted/30 rounded" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-5 flex items-center gap-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl">
        <Icon name="ExclamationCircleIcon" size={16} className="text-red-500 flex-shrink-0" />
        <span>{error?.message ?? 'Failed to load workplan data'}</span>
      </div>
    );
  }

  if (!workplans || workplans.length === 0) {
    return (
      <div className="card p-6 text-center text-sm text-muted-foreground">
        <Icon name="DocumentTextIcon" size={32} className="mx-auto mb-2 text-muted-foreground/50" />
        <p>No workplan records found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {workplans.map((wp) => {
        const isExpanded = expandedId === wp.id;
        const stageClass = STAGE_COLORS[wp.workflow_stage] ?? 'bg-gray-100 text-gray-700 border-gray-200';
        const stageLabel = STAGE_LABELS[wp.workflow_stage] ?? wp.workflow_stage;

        return (
          <div key={wp.id} className="card border border-border rounded-xl overflow-hidden">
            {/* Header row */}
            <button
              onClick={() => setExpandedId(isExpanded ? null : wp.id)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Icon name="DocumentTextIcon" size={16} className="text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-600 text-foreground truncate">
                    {wp.staff?.full_name ?? 'Unknown Staff'}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {wp.staff?.job_title ?? ''} · {wp.fiscal_year}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                <span className={`text-[11px] font-600 px-2 py-0.5 rounded-full border ${stageClass}`}>
                  {stageLabel}
                </span>
                <Icon
                  name={isExpanded ? 'ChevronUpIcon' : 'ChevronDownIcon'}
                  size={16}
                  className="text-muted-foreground"
                />
              </div>
            </button>

            {/* Expanded detail — fetched lazily only when opened */}
            {isExpanded && <WorkplanDetail id={wp.id} />}
          </div>
        );
      })}
    </div>
  );
}
