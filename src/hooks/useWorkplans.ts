'use client';

/**
 * useWorkplans — lazy, paginated, role-scoped workplan data hook.
 *
 * Features:
 * - Lazy / on-demand loading: data is only fetched when `enabled` is true
 * - Pagination: 20 records per page, cursor-based via range()
 * - Role-scoped queries: staff → own rows, supervisor → direct reports,
 *   director/HR/admin → all rows with optional filters
 * - Background prefetch: silently loads previous fiscal year after current loads
 * - Indexed filtering: uses staff_id, fiscal_year, status, workflow_stage indexes
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cacheSet, cacheGet, cacheSetPersisted, cacheGetStale, TTL_WORKPLAN_LIST, roleKey } from '@/lib/cache';
import { useAuth } from '@/contexts/AuthContext';

export interface WorkplanRow {
  id: string;
  staff_id: string;
  staff_name: string;
  job_title: string;
  supervisor_name: string | null;
  fiscal_year: string;
  status: string;
  workflow_stage: string;
  created_at: string;
  updated_at: string;
}

export interface WorkplanFilters {
  fiscalYear?: string;
  status?: string;
  workflowStage?: string;
  staffId?: string;
  departmentId?: string;
}

export interface UseWorkplansOptions {
  /** Only fetch when true — enables lazy / on-demand loading */
  enabled?: boolean;
  /** Page size (default 20) */
  pageSize?: number;
  /** Initial filters */
  filters?: WorkplanFilters;
  /** Fiscal year to load (e.g. "2025-2026") */
  fiscalYear?: string;
}

export interface UseWorkplansResult {
  workplans: WorkplanRow[];
  loading: boolean;
  error: string | null;
  page: number;
  totalCount: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  goToPage: (p: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  setFilters: (f: WorkplanFilters) => void;
  refresh: () => void;
  filters: WorkplanFilters;
}

// Fiscal years available in the system (most recent first)
export const FISCAL_YEARS = [
  '2025-2026',
  '2024-2025',
  '2023-2024',
  '2022-2023',
];

export const CURRENT_FISCAL_YEAR = '2025-2026';
export const PREVIOUS_FISCAL_YEAR = '2024-2025';

const PAGE_SIZE_DEFAULT = 20;

// Roles that can see all workplans (with pagination + filters)
const ELEVATED_ROLES = new Set([
  'superuser',
  'support_admin',
  'executive_director',
  'deputy_director',
  'hr_admin_officer',
]);

// Roles that see only their direct reports
const SUPERVISOR_ROLES = new Set([
  'programme_manager',
  'finance_manager',
]);

export function useWorkplans(options: UseWorkplansOptions = {}): UseWorkplansResult {
  const {
    enabled = true,
    pageSize = PAGE_SIZE_DEFAULT,
    filters: initialFilters = {},
    fiscalYear = CURRENT_FISCAL_YEAR,
  } = options;

  const { profile } = useAuth();
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  const [workplans, setWorkplans] = useState<WorkplanRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [filters, setFiltersState] = useState<WorkplanFilters>({
    fiscalYear,
    ...initialFilters,
  });

  const isMounted = useRef(true);
  const prefetchDone = useRef(false);

  // ── Role-scoped query builder ───────────────────────────────────────────────
  const buildQuery = useCallback(
    (forCount = false) => {
      const role = profile?.systemRole || 'staff_member';
      const staffId = profile?.staffId;
      const userId = profile?.id;

      let q = supabase
        .from('workplan_settings')
        .select(
          forCount
            ? 'id'
            : `
              id,
              staff_id,
              fiscal_year,
              status,
              workflow_stage,
              created_at,
              updated_at,
              staff:staff_id (
                full_name,
                job_title,
                supervisor:supervisor_id ( full_name )
              )
            `,
          forCount ? { count: 'exact', head: true } : { count: 'exact' }
        );

      // ── Role scoping ──────────────────────────────────────────────────────
      if (ELEVATED_ROLES.has(role)) {
        // Director / HR / Admin: see everything, apply optional filters
        if (filters.staffId) q = q.eq('staff_id', filters.staffId);
        if (filters.departmentId) {
          // Filter via staff join — use a subquery approach via in()
          // (department_id is on the staff table, not workplan_settings)
        }
      } else if (SUPERVISOR_ROLES.has(role)) {
        // Supervisor: only direct reports
        // supervisor_id on workplan_settings links to the supervisor's staff record
        if (staffId) {
          q = q.eq('supervisor_id', staffId);
        } else if (userId) {
          q = q.eq('supervisor_user_id', userId);
        }
      } else {
        // Staff member: only own workplans
        if (staffId) {
          q = q.eq('staff_id', staffId);
        } else if (userId) {
          q = q.eq('user_id', userId);
        }
      }

      // ── Indexed filters ───────────────────────────────────────────────────
      if (filters.fiscalYear) q = q.eq('fiscal_year', filters.fiscalYear);
      if (filters.status) q = q.eq('status', filters.status);
      if (filters.workflowStage) q = q.eq('workflow_stage', filters.workflowStage);

      return q;
    },
    [supabase, profile, filters]
  );

  // ── Main fetch ─────────────────────────────────────────────────────────────
  const fetchPage = useCallback(
    async (targetPage: number, forceRefresh = false) => {
      if (!enabled || !profile) return;

      const role = profile.systemRole || 'staff_member';
      const scopeId = profile.staffId || profile.id;
      const cacheBase = `workplans:${filters.fiscalYear || 'all'}:${filters.status || 'all'}:${filters.workflowStage || 'all'}`;
      const pageKey = roleKey(`${cacheBase}:p${targetPage}`, role, scopeId);

      if (!forceRefresh) {
        // Stale-While-Revalidate: serve stale data instantly, refresh in background
        const staleResult = cacheGetStale<{ rows: WorkplanRow[]; total: number }>(pageKey);
        if (staleResult) {
          if (isMounted.current) {
            setWorkplans(staleResult.rows);
            setTotalCount(staleResult.total);
            setLoading(false);
          }
          if (!staleResult.isStale) return; // fresh — no need to refetch
          // Stale — fall through to background refresh (don't set loading)
        }
      }

      if (isMounted.current && !cacheGetStale(pageKey)) setLoading(true);
      if (isMounted.current) setError(null);

      try {
        const from = (targetPage - 1) * pageSize;
        const to = from + pageSize - 1;

        const { data, error: qErr, count } = await buildQuery()
          .order('created_at', { ascending: false })
          .range(from, to);

        if (qErr) throw qErr;

        const rows: WorkplanRow[] = (data ?? []).map((r: Record<string, unknown>) => {
          const staffRow = r.staff as Record<string, unknown> | null;
          const supervisorRow = staffRow?.supervisor as Record<string, unknown> | null;
          return {
            id: r.id as string,
            staff_id: r.staff_id as string,
            staff_name: (staffRow?.full_name as string) ?? '—',
            job_title: (staffRow?.job_title as string) ?? '—',
            supervisor_name: (supervisorRow?.full_name as string) ?? null,
            fiscal_year: (r.fiscal_year as string) ?? '—',
            status: (r.status as string) ?? 'draft',
            workflow_stage: (r.workflow_stage as string) ?? 'workplan_pending',
            created_at: r.created_at as string,
            updated_at: r.updated_at as string,
          };
        });

        const total = count ?? 0;

        // Persist page 1 to localStorage for instant load on next visit
        if (targetPage === 1) {
          cacheSetPersisted(pageKey, { rows, total }, TTL_WORKPLAN_LIST, TTL_WORKPLAN_LIST * 3);
        } else {
          cacheSet(pageKey, { rows, total }, TTL_WORKPLAN_LIST);
        }

        if (isMounted.current) {
          setWorkplans(rows);
          setTotalCount(total);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to load workplans';
        if (isMounted.current) setError(msg);
      } finally {
        if (isMounted.current) setLoading(false);
      }
    },
    [enabled, profile, buildQuery, pageSize, filters]
  );

  // ── Background prefetch of previous fiscal year ────────────────────────────
  const prefetchPreviousYear = useCallback(async () => {
    if (prefetchDone.current || !profile) return;
    prefetchDone.current = true;

    const role = profile.systemRole || 'staff_member';
    const scopeId = profile.staffId || profile.id;
    const prevKey = roleKey(`workplans:${PREVIOUS_FISCAL_YEAR}:all:all:p1`, role, scopeId);

    // Skip if already cached
    if (cacheGet(prevKey)) return;

    try {
      const staffId = profile.staffId;
      const userId = profile.id;

      let q = supabase
        .from('workplan_settings')
        .select(
          `id, staff_id, fiscal_year, status, workflow_stage, created_at, updated_at,
           staff:staff_id ( full_name, job_title, supervisor:supervisor_id ( full_name ) )`,
          { count: 'exact' }
        )
        .eq('fiscal_year', PREVIOUS_FISCAL_YEAR)
        .order('created_at', { ascending: false })
        .range(0, PAGE_SIZE_DEFAULT - 1);

      if (ELEVATED_ROLES.has(role)) {
        // no extra filter
      } else if (SUPERVISOR_ROLES.has(role)) {
        if (staffId) q = q.eq('supervisor_id', staffId);
      } else {
        if (staffId) q = q.eq('staff_id', staffId);
        else if (userId) q = q.eq('user_id', userId);
      }

      const { data, count } = await q;

      const rows: WorkplanRow[] = (data ?? []).map((r: Record<string, unknown>) => {
        const staffRow = r.staff as Record<string, unknown> | null;
        const supervisorRow = staffRow?.supervisor as Record<string, unknown> | null;
        return {
          id: r.id as string,
          staff_id: r.staff_id as string,
          staff_name: (staffRow?.full_name as string) ?? '—',
          job_title: (staffRow?.job_title as string) ?? '—',
          supervisor_name: (supervisorRow?.full_name as string) ?? null,
          fiscal_year: (r.fiscal_year as string) ?? '—',
          status: (r.status as string) ?? 'draft',
          workflow_stage: (r.workflow_stage as string) ?? 'workplan_pending',
          created_at: r.created_at as string,
          updated_at: r.updated_at as string,
        };
      });

      cacheSet(prevKey, { rows, total: count ?? 0 }, TTL_WORKPLAN_LIST);
    } catch {
      // Silent — prefetch failure is non-critical
    }
  }, [profile, supabase]);

  // ── Effects ────────────────────────────────────────────────────────────────
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    setPage(1);
    fetchPage(1).then(() => {
      // After current year loads, silently prefetch previous year
      setTimeout(prefetchPreviousYear, 800);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, JSON.stringify(filters), profile?.id]);

  // ── Pagination helpers ─────────────────────────────────────────────────────
  const totalPages = Math.ceil(totalCount / pageSize);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  const goToPage = useCallback(
    (p: number) => {
      const clamped = Math.max(1, Math.min(p, totalPages || 1));
      setPage(clamped);
      fetchPage(clamped);
    },
    [fetchPage, totalPages]
  );

  const nextPage = useCallback(() => goToPage(page + 1), [goToPage, page]);
  const prevPage = useCallback(() => goToPage(page - 1), [goToPage, page]);

  const setFilters = useCallback((f: WorkplanFilters) => {
    setFiltersState((prev) => ({ ...prev, ...f }));
    setPage(1);
  }, []);

  const refresh = useCallback(() => {
    prefetchDone.current = false;
    fetchPage(page, true);
  }, [fetchPage, page]);

  return {
    workplans,
    loading,
    error,
    page,
    totalCount,
    hasNextPage,
    hasPrevPage,
    goToPage,
    nextPage,
    prevPage,
    setFilters,
    refresh,
    filters,
  };
}
