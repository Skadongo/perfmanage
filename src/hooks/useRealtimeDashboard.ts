'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

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
  // Debounce timer ref to avoid rapid re-fetches on burst DB changes
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchLiveStats = useCallback(async () => {
    const supabase = createClient();
    try {
      let reviewsQuery = supabase
        .from('mid_year_reviews')
        .select('review_status, supervisor_rating, staff_id');

      if (staffId) {
        reviewsQuery = reviewsQuery.eq('staff_id', staffId);
      }

      const [reviewsResult, staffResult] = await Promise.all([
        reviewsQuery,
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
      const timeStr = now.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      setLiveStats({
        totalReviews: total,
        submitted,
        approved,
        avgRating,
        totalStaff: staffResult.count ?? 0,
        pendingReviews: pending,
        lastUpdated: timeStr,
      });
    } catch {
      // silently fail — keep previous stats
    }
  }, [staffId]);

  // Debounced version to prevent rapid re-fetches on burst changes
  const debouncedFetch = useCallback(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      fetchLiveStats();
      setRefreshKey(k => k + 1);
    }, 500);
  }, [fetchLiveStats]);

  const refetch = useCallback(() => {
    fetchLiveStats();
    setRefreshKey(k => k + 1);
  }, [fetchLiveStats]);

  useEffect(() => {
    isMounted.current = true;
    fetchLiveStats();

    const supabase = createClient();

    // Channel 1: mid_year_reviews — performance data changes
    const reviewsChannel = supabase
      .channel('rt-dashboard-reviews')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'mid_year_reviews' },
        () => {
          debouncedFetch();
          onPerformanceChange?.();
        }
      )
      .subscribe(status => {
        if (isMounted.current) setRealtimeActive(status === 'SUBSCRIBED');
      });

    // Channel 2: staff + user_profiles — staff/role updates (merged to reduce connections)
    const staffChannel = supabase
      .channel('rt-dashboard-staff')
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
      .subscribe();

    return () => {
      isMounted.current = false;
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      supabase.removeChannel(reviewsChannel);
      supabase.removeChannel(staffChannel);
    };
  }, [fetchLiveStats, debouncedFetch, onStaffChange, onRoleChange, onPerformanceChange]);

  return { liveStats, realtimeActive, refreshKey, refetch };
}
