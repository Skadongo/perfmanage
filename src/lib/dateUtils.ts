/**
 * Deterministic date formatters — produce identical output on server (Node.js)
 * and client (browser) by using UTC arithmetic instead of locale-dependent APIs.
 * Safe to call in JSX render paths without causing hydration mismatches.
 */

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG  = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * Format an ISO date string as "DD Mon YYYY" (e.g. "15 Jun 2026").
 * Returns '—' for null/undefined/empty input.
 */
export function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const day   = d.getUTCDate().toString().padStart(2, '0');
  const month = MONTHS_SHORT[d.getUTCMonth()];
  const year  = d.getUTCFullYear();
  return `${day} ${month} ${year}`;
}

/**
 * Format an ISO date string as "D Month YYYY" (e.g. "15 June 2026").
 * Returns '—' for null/undefined/empty input.
 */
export function formatDateLong(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const day   = d.getUTCDate();
  const month = MONTHS_LONG[d.getUTCMonth()];
  const year  = d.getUTCFullYear();
  return `${day} ${month} ${year}`;
}

/**
 * Format an ISO date string as "D Mon" (e.g. "15 Jun").
 * Returns '—' for null/undefined/empty input.
 */
export function formatDateMonthDay(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return `${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]}`;
}

/**
 * Format an ISO date string as "DD/MM/YYYY" (e.g. "15/06/2026").
 * Returns '—' for null/undefined/empty input.
 */
export function formatDateNumeric(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const day   = d.getUTCDate().toString().padStart(2, '0');
  const month = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  const year  = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Format an ISO datetime string as "DD Mon YYYY, HH:MM" (e.g. "15 Jun 2026, 14:30").
 * Returns '—' for null/undefined/empty input.
 */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const day    = d.getUTCDate().toString().padStart(2, '0');
  const month  = MONTHS_SHORT[d.getUTCMonth()];
  const year   = d.getUTCFullYear();
  const hour   = d.getUTCHours().toString().padStart(2, '0');
  const minute = d.getUTCMinutes().toString().padStart(2, '0');
  return `${day} ${month} ${year}, ${hour}:${minute}`;
}
