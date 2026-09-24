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
  // Stable client ref — never recreated
  const supabaseRef = useRef(createClient());

  const cacheKey = `live-stats:${staffId ?? 'org'}`;

  const fetchLiveStats = useCallback(async (forceRefresh = false) => {
    const supabase = supabaseRef.current;

    // Return cached value immediately if available and not forcing refresh
    if (!forceRefresh) {
      const cached = cacheGet<LiveStats>(cacheKey);
      if (cached) {
        if (isMounted.current) setLiveStats(cached);
        return;
      }
    }

    try {
      // Run both queries in parallel, select only needed columns
      const [reviewsResult, staffResult] = await Promise.all([
        staffId
          ? supabase
              .from('mid_year_reviews')
              .select('review_status, supervisor_rating')
              .eq('staff_id', staffId)
          : supabase
              .from('mid_year_reviews')
              .select('review_status, supervisor_rating'),
        supabase
          .from('staff')
          .select('id', { count: 'exact', head: true })
          .eq('employment_status', 'active'),
      ]);

      if (!isMounted.current) return;

      const reviewList = reviewsResult.data || [];
      const total = reviewList.length;
      const submitted = reviewList.filter(r =>
        ['submitted', 'reviewed', 'approved'].includes(r.review_status)
      ).length;
      const approved = reviewList.filter(r => r.review_status === 'approved').length;
      const pending = reviewList.filter(r =>
        ['draft', 'submitted'].includes(r.review_status)
      ).length;
      const ratings = reviewList
        .filter(r => r.supervisor_rating != null)
        .map(r => r.supervisor_rating as number);
      const avgRating =
        ratings.length > 0
          ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
          : 0;

      const now = new Date();
      const timeStr = now.toISOString().slice(11, 19);

      const stats: LiveStats = {
        totalReviews: total,
        submitted,
        approved,
        avgRating,
        totalStaff: staffResult.count ?? 0,
        pendingReviews: pending,
        lastUpdated: timeStr,
      };

      cacheSet(cacheKey, stats, CACHE_TTL);
      setLiveStats(stats);
    } catch {
      // silently fail — keep previous stats
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
        { event: '*', schema: 'public', table: 'workplan_settings' },
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
