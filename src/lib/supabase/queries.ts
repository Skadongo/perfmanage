/**
 * Shared Supabase query utilities.
 * Centralises the most-repeated DB queries so each component
 * calls one function instead of duplicating the select/filter logic.
 */

import { createClient } from '@/lib/supabase/client';

export interface ReviewRow {
  id: string;
  review_status: string;
  supervisor_rating: number | null;
  self_rating: number | null;
  review_year: number | null;
  review_period: string | null;
  staff_id: string | null;
  supervisor_id: string | null;
}

export interface WorkplanRow {
  id: string;
  status: string;
  workflow_stage: string;
  staff_id: string | null;
}

/**
 * Fetch mid_year_reviews with optional staff/supervisor scoping.
 * Selects only the columns needed for aggregation.
 */
export async function fetchReviewsData(opts?: {
  staffId?: string | null;
  supervisorId?: string | null;
}): Promise<ReviewRow[]> {
  const supabase = createClient();
  let query = supabase
    .from('mid_year_reviews')
    .select('id, review_status, supervisor_rating, self_rating, review_year, review_period, staff_id, supervisor_id');

  if (opts?.staffId) {
    query = query.eq('staff_id', opts.staffId);
  } else if (opts?.supervisorId) {
    query = query.eq('supervisor_id', opts.supervisorId);
  }

  const { data } = await query;
  return data ?? [];
}

/**
 * Fetch workplan_settings rows (status + workflow_stage) for counting.
 */
export async function fetchWorkplansData(opts?: {
  staffId?: string | null;
  status?: string;
}): Promise<WorkplanRow[]> {
  const supabase = createClient();
  let query = supabase
    .from('workplan_settings')
    .select('id, status, workflow_stage, staff_id');

  if (opts?.status) {
    query = query.eq('status', opts.status);
  }
  if (opts?.staffId) {
    query = query.eq('staff_id', opts.staffId);
  }

  const { data } = await query;
  return data ?? [];
}

/**
 * Fetch the count of active staff members.
 * Optionally scoped to a supervisor's direct reports.
 */
export async function fetchStaffCount(opts?: {
  supervisorId?: string | null;
}): Promise<number> {
  const supabase = createClient();
  let query = supabase
    .from('staff')
    .select('id', { count: 'exact', head: true })
    .eq('employment_status', 'active');

  if (opts?.supervisorId) {
    query = query.eq('supervisor_id', opts.supervisorId);
  }

  const { count } = await query;
  return count ?? 0;
}
