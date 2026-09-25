/**
 * Pre-built cached query helpers.
 * Wraps the shared query utilities with cachedFetch so components
 * get caching for free without repeating the boilerplate.
 */

import { cachedFetch, TTL_DASHBOARD_METRICS, TTL_WORKPLAN_LIST, TTL_STAFF_LIST } from '@/lib/cache';
import { fetchReviewsData, fetchWorkplansData, fetchStaffCount, type ReviewRow, type WorkplanRow } from './queries';
import { aggregateReviewStats, type ReviewStats } from './aggregations';

/**
 * Cached review stats — used by dashboard metric cards and analytics pages.
 */
export async function getCachedReviewStats(opts?: {
  staffId?: string | null;
  supervisorId?: string | null;
  forceRefresh?: boolean;
}): Promise<ReviewStats> {
  const scopeKey = opts?.staffId ?? opts?.supervisorId ?? 'org';
  const cacheKey = `review-stats:${scopeKey}`;
  return cachedFetch(
    cacheKey,
    async () => {
      const rows = await fetchReviewsData(opts);
      return aggregateReviewStats(rows);
    },
    opts?.forceRefresh ? 0 : TTL_DASHBOARD_METRICS
  );
}

/**
 * Cached raw review rows — used by charts that need per-row data.
 */
export async function getCachedReviewRows(opts?: {
  staffId?: string | null;
  supervisorId?: string | null;
  forceRefresh?: boolean;
}): Promise<ReviewRow[]> {
  const scopeKey = opts?.staffId ?? opts?.supervisorId ?? 'org';
  const cacheKey = `review-rows:${scopeKey}`;
  return cachedFetch(
    cacheKey,
    () => fetchReviewsData(opts),
    opts?.forceRefresh ? 0 : TTL_DASHBOARD_METRICS
  );
}

/**
 * Cached workplan counts — used by evaluation-reviews page workflow panel.
 */
export async function getCachedWorkplanCounts(opts?: {
  staffId?: string | null;
  status?: string;
  forceRefresh?: boolean;
}): Promise<WorkplanRow[]> {
  const scopeKey = `${opts?.staffId ?? 'org'}:${opts?.status ?? 'all'}`;
  const cacheKey = `workplan-counts:${scopeKey}`;
  return cachedFetch(
    cacheKey,
    () => fetchWorkplansData(opts),
    opts?.forceRefresh ? 0 : TTL_WORKPLAN_LIST
  );
}

/**
 * Cached active staff count.
 */
export async function getCachedStaffCount(opts?: {
  supervisorId?: string | null;
  forceRefresh?: boolean;
}): Promise<number> {
  const scopeKey = opts?.supervisorId ?? 'org';
  const cacheKey = `staff-count:${scopeKey}`;
  return cachedFetch(
    cacheKey,
    () => fetchStaffCount(opts),
    opts?.forceRefresh ? 0 : TTL_STAFF_LIST
  );
}
