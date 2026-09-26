'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cacheGet, cacheSet } from '@/lib/cache';

export interface LiveStats {
  totalReviews: number;
  submitted: number;
  approved: number;
  avgRating: number;
  totalStaff: number;
  pendingReviews: number;
  lastUpdated: string;
}

interface UseRealtimeDashboardOptions {
  /** staffId to scope data for Staff Member role — null means fetch org-wide */
  staffId?: string | null;
  onStaffChange?: () => void;
  onRoleChange?: () => void;
  onPerformanceChange?: () => void;
}

interface UseRealtimeDashboardReturn {
  liveStats: LiveStats | null;
  realtimeActive: boolean;
  refreshKey: number;
  refetch: () => void;
}

const CACHE_TTL = 30_000; // 30 s — short enough to feel live, long enough to avoid hammering DB

/** Derive the current fiscal year string, e.g. "2025-2026" */
function getCurrentReviewYear(): number {
  return new Date().getFullYear();
}

export function useRealtimeDashboard({
  staffId,
  onStaffChange,
  onRoleChange,
  onPerformanceChange,
}: UseRealtimeDashboardOptions = {}): UseRealtimeDashboardReturn {
  const [liveStats, setLiveStats] = useState<LiveStats | null>(null);
  const [realtimeActive, setRealtimeActive] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const isMounted = useRef(true);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFetching = useRef(false);
  // Stable client ref — never recreated
  const supabaseRef = useRef(createClient());

  const cacheKey = `live-stats:${staffId ?? 'org'}`;

  const fetchLiveStats = useCallback(async (forceRefresh = false) => {
    // Prevent concurrent fetches that cause Supabase auth lock contention
    if (isFetching.current) return;

    const supabase = supabaseRef.current;

    // Return cached value immediately if available and not forcing refresh
    if (!forceRefresh) {
      const cached = cacheGet<LiveStats>(cacheKey);
      if (cached) {
        if (isMounted.current) setLiveStats(cached);
        return;
      }
    }

    isFetching.current = true;
    try {
      const currentYear = getCurrentReviewYear();

      if (staffId) {
        // Fix 1: Use mv_staff_dashboard_summary materialized view for staff-scoped queries
        // Accuracy gap: scope totalReviews to current review year
        const [mvResult, staffResult, currentYearResult] = await Promise.all([
          supabase
            .from('mv_staff_dashboard_summary')
            .select('*')
            .eq('staff_id', staffId)
            .maybeSingle(),
          supabase
            .from('staff')
            .select('id', { count: 'exact', head: true })
            .eq('employment_status', 'active'),
          // Accuracy gap fix: scope totalReviews to current period
          supabase
            .from('mid_year_reviews')
            .select('review_status, supervisor_rating', { count: 'exact' })
            .eq('staff_id', staffId)
            .eq('review_year', currentYear),
        ]);

        if (!isMounted.current) return;

        const mv = mvResult.data;
        const currentYearReviews = currentYearResult.data || [];
        const currentTotal = currentYearResult.count ?? currentYearReviews.length;

        const now = new Date();
        const h = String(now.getHours()).padStart(2, '0');
        const m = String(now.getMinutes()).padStart(2, '0');
        const s = String(now.getSeconds()).padStart(2, '0');
        const timeStr = `${h}:${m}:${s}`;

        const stats: LiveStats = {
          // Accuracy gap: use current-year count for totalReviews
          totalReviews: currentTotal,
          submitted: mv ? Number(mv.submitted_reviews) : 0,
          approved: mv ? Number(mv.approved_reviews) : 0,
          avgRating: mv?.avg_supervisor_rating ? Number(mv.avg_supervisor_rating) : 0,
          totalStaff: staffResult.count ?? 0,
          pendingReviews: mv ? Number(mv.pending_reviews) : 0,
          lastUpdated: timeStr,
        };

        cacheSet(cacheKey, stats, CACHE_TTL);
        if (isMounted.current) setLiveStats(stats);
      } else {
        // Fix 1: Use mv_dashboard_summary materialized view for org-wide queries
        // Accuracy gap: scope totalReviews to current period
        const [mvResult, staffResult, currentYearResult] = await Promise.all([
          supabase
            .from('mv_dashboard_summary')
            .select('*')
            .maybeSingle(),
          supabase
            .from('staff')
            .select('id', { count: 'exact', head: true })
            .eq('employment_status', 'active'),
          // Accuracy gap fix: scope totalReviews to current review year
          supabase
            .from('mid_year_reviews')
            .select('id', { count: 'exact', head: true })
            .eq('review_year', currentYear),
        ]);

        if (!isMounted.current) return;

        const mv = mvResult.data;
        const currentTotal = currentYearResult.count ?? 0;

        const now = new Date();
        const h = String(now.getHours()).padStart(2, '0');
        const m = String(now.getMinutes()).padStart(2, '0');
        const s = String(now.getSeconds()).padStart(2, '0');
        const timeStr = `${h}:${m}:${s}`;

        const stats: LiveStats = {
          // Accuracy gap: use current-year count for totalReviews
          totalReviews: currentTotal,
          submitted: mv ? Number(mv.submitted_reviews) : 0,
          approved: mv ? Number(mv.approved_reviews) : 0,
          avgRating: mv?.avg_supervisor_rating ? Number(mv.avg_supervisor_rating) : 0,
          totalStaff: staffResult.count ?? 0,
          pendingReviews: mv ? Number(mv.pending_reviews) : 0,
          lastUpdated: timeStr,
        };

        cacheSet(cacheKey, stats, CACHE_TTL);
        if (isMounted.current) setLiveStats(stats);
      }
    } catch {
      // silently fail — keep previous stats
    } finally {
      isFetching.current = false;
    }
  }, [staffId, cacheKey]);

  // Debounced version to prevent rapid re-fetches on burst DB changes (500 ms window)
  const debouncedFetch = useCallback(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      fetchLiveStats(true); // force refresh on realtime event
      setRefreshKey(k => k + 1);
    }, 500);
  }, [fetchLiveStats]);

  const refetch = useCallback(() => {
    fetchLiveStats(true);
    setRefreshKey(k => k + 1);
  }, [fetchLiveStats]);

  useEffect(() => {
    isMounted.current = true;
    fetchLiveStats();

    const supabase = supabaseRef.current;

    // Single merged channel for all dashboard tables — reduces Supabase connections
    const dashboardChannel = supabase
      .channel('rt-dashboard')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'mid_year_reviews' },
        () => {
          debouncedFetch();
          onPerformanceChange?.();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'staff' },
        () => {
          debouncedFetch();
          onStaffChange?.();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'user_profiles' },
        payload => {
          const newRow = payload.new as Record<string, unknown>;
          const oldRow = payload.old as Record<string, unknown>;
          if (newRow?.system_role !== oldRow?.system_role || newRow?.role !== oldRow?.role) {
            onRoleChange?.();
          }
          setRefreshKey(k => k + 1);
        }
      )
      .subscribe(status => {
        if (isMounted.current) setRealtimeActive(status === 'SUBSCRIBED');
      });

    return () => {
      isMounted.current = false;
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      // Unsubscribe and remove channel on unmount
      supabase.removeChannel(dashboardChannel);
    };
  }, [fetchLiveStats, debouncedFetch, onStaffChange, onRoleChange, onPerformanceChange]);

  return { liveStats, realtimeActive, refreshKey, refetch };
}
