/**
 * Centralised constants and mapping utilities.
 * Replaces duplicate ROLE_LABELS, ROLE_DEPT_MAP, STATUS_COLORS,
 * STATUS_LABELS, and mapStatus definitions scattered across 5+ files.
 */

// ─── Role display labels ──────────────────────────────────────────────────────

export const ROLE_LABELS: Record<string, string> = {
  executive_director: 'Executive Director',
  deputy_director: 'Deputy Director',
  programme_manager: 'Programme Manager',
  finance_manager: 'Finance Manager',
  hr_admin_officer: 'HR & Admin Officer',
  programme_officer: 'Programme Officer',
  finance_officer: 'Finance Officer',
  admin_officer: 'Admin Officer',
  project_coordinator: 'Project Coordinator',
};

// ─── Role → department mapping ────────────────────────────────────────────────

export const ROLE_DEPT_MAP: Record<string, string> = {
  'Director General': 'Executive Office',
  'Director of Finance': 'Finance & Admin',
  'Finance Officer': 'Finance & Admin',
  'HR & Admin Officer': 'Finance & Admin',
  'Receptionist': 'Finance & Admin',
  'Driver': 'Finance & Admin',
  'Director of Programs': 'Programmes',
  'Senior ICT Officer': 'ICT',
  'DoID': 'Institutional Development',
};

// ─── Review status display ────────────────────────────────────────────────────

export const STATUS_LABELS: Record<string, string> = {
  approved: 'Approved',
  submitted: 'Submitted',
  'in-progress': 'In Progress',
  pending: 'Pending',
  overdue: 'Overdue',
  draft: 'Draft',
  reviewed: 'Reviewed',
  rejected: 'Rejected',
};

export const STATUS_COLORS: Record<string, string> = {
  approved: '#10b981',
  submitted: '#3b82f6',
  'in-progress': '#f59e0b',
  pending: '#94a3b8',
  overdue: '#ef4444',
  draft: '#94a3b8',
  reviewed: '#f59e0b',
  rejected: '#ef4444',
};

// ─── DB status → UI status mapping ───────────────────────────────────────────

export type UIReviewStatus = 'pending' | 'in-progress' | 'submitted' | 'approved' | 'overdue' | 'draft' | 'reviewed' | 'rejected';

const STATUS_MAP: Record<string, UIReviewStatus> = {
  draft: 'pending',
  submitted: 'submitted',
  reviewed: 'in-progress',
  approved: 'approved',
  rejected: 'overdue',
};

/**
 * Map a DB review_status value to the UI status string.
 * Replaces the duplicate mapStatus() functions in evaluation-reviews/page.tsx,
 * ReviewTable.tsx, and ReviewDetailModal.tsx.
 */
export function mapStatus(dbStatus: string): UIReviewStatus {
  return STATUS_MAP[dbStatus] ?? 'pending';
}

/**
 * Compute overall progress percentage from review status and ratings.
 */
export function computeProgress(
  status: UIReviewStatus,
  selfRating: number,
  supervisorRating: number
): number {
  if (status === 'approved') return 100;
  if (status === 'submitted' && selfRating > 0) return 75;
  if (status === 'in-progress' && selfRating > 0) return 50;
  return 0;
}

// ─── Roles with full org-wide access ─────────────────────────────────────────

export const FULL_ACCESS_ROLES = ['executive_director', 'deputy_director', 'hr_admin_officer'];
