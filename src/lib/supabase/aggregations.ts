/**
 * Shared aggregation utilities.
 * Centralises the repeated stats computations (avg ratings, submission rates,
 * status counts) so components don't each re-implement the same logic.
 */

import type { ReviewRow } from './queries';

export interface ReviewStats {
  total: number;
  submitted: number;
  approved: number;
  /**
   * Pending = draft OR submitted (not yet approved/reviewed).
   * This is the canonical definition used across all consumers:
   *   - mv_dashboard_summary.pending_reviews
   *   - useRealtimeDashboard live strip
   *   - DashboardMetricCards
   * Do NOT redefine inline — always use aggregateReviewStats() or
   * the PENDING_STATUSES constant below.
   */
  pending: number;
  /** Staff who have not yet created a review record at all */
  notStarted: number;
  avgSupervisorRating: number;
  avgSelfRating: number;
  submissionRate: number;
  approvalRate: number;
}

/**
 * Canonical set of review_status values that count as "pending".
 * Import this wherever you need to filter/count pending reviews so the
 * definition stays consistent across the codebase.
 */
export const PENDING_STATUSES = ['draft', 'submitted'] as const;

/**
 * Compute top-level review stats from a list of review rows.
 *
 * @param reviews       - Review rows for the current period
 * @param totalStaff    - Total active staff in scope (used to compute notStarted).
 *                        Pass 0 or omit if not available.
 */
export function aggregateReviewStats(reviews: ReviewRow[], totalStaff = 0): ReviewStats {
  const total = reviews.length;
  if (total === 0) {
    return {
      total: 0,
      submitted: 0,
      approved: 0,
      pending: 0,
      notStarted: Math.max(0, totalStaff - total),
      avgSupervisorRating: 0,
      avgSelfRating: 0,
      submissionRate: 0,
      approvalRate: 0,
    };
  }

  let submitted = 0;
  let approved = 0;
  let pending = 0;
  const supRatings: number[] = [];
  const selfRatings: number[] = [];

  for (const r of reviews) {
    const isSubmitted = ['submitted', 'reviewed', 'approved'].includes(r.review_status);
    const isApproved = r.review_status === 'approved';
    // Use canonical PENDING_STATUSES — single source of truth
    const isPending = (PENDING_STATUSES as readonly string[]).includes(r.review_status);

    if (isSubmitted) submitted++;
    if (isApproved) approved++;
    if (isPending) pending++;
    if (r.supervisor_rating != null) supRatings.push(r.supervisor_rating);
    if (r.self_rating != null) selfRatings.push(r.self_rating);
  }

  const avg = (arr: number[]) =>
    arr.length > 0 ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : 0;

  // notStarted = staff who have no review record yet
  const notStarted = Math.max(0, totalStaff - total);

  return {
    total,
    submitted,
    approved,
    pending,
    notStarted,
    avgSupervisorRating: avg(supRatings),
    avgSelfRating: avg(selfRatings),
    submissionRate: Math.round((submitted / total) * 100),
    approvalRate: Math.round((approved / total) * 100),
  };
}

/**
 * Break down reviews by a string field (e.g. review_status, review_period).
 */
export function computeReviewBreakdown(
  reviews: ReviewRow[],
  field: keyof ReviewRow
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const r of reviews) {
    const val = String(r[field] ?? 'unknown');
    counts[val] = (counts[val] || 0) + 1;
  }
  return counts;
}

/**
 * Group reviews by year+period key (e.g. "Mid 2025") and compute per-group stats.
 */
export function groupReviewsByPeriod(reviews: ReviewRow[]): Record<string, ReviewStats> {
  const groups: Record<string, ReviewRow[]> = {};

  for (const r of reviews) {
    const label = r.review_period === 'mid-year'
      ? `Mid ${r.review_year}`
      : `End ${r.review_year}`;
    if (!groups[label]) groups[label] = [];
    groups[label].push(r);
  }

  const result: Record<string, ReviewStats> = {};
  for (const [label, rows] of Object.entries(groups)) {
    result[label] = aggregateReviewStats(rows);
  }
  return result;
}
