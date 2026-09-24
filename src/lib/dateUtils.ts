/**
 * dateUtils.ts — Server/client-safe date formatting utilities.
 *
 * All functions produce identical output on the server (Node.js) and in the
 * browser, eliminating React hydration mismatches caused by locale-dependent
 * APIs such as `.toLocaleString()`, `.toLocaleDateString()`,
 * `.toLocaleTimeString()`, and `Intl.*`.
 *
 * Formatting is done manually using UTC-based getters so the output is
 * deterministic regardless of the runtime locale or timezone.
 */

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/**
 * Parses a value into a Date, returning null for invalid/empty input.
 */
function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Formats a date as "DD Mon YYYY" (e.g. "24 Sep 2026").
 * Equivalent to `toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })`.
 *
 * @param value - ISO string, Date object, or null/undefined
 * @param fallback - returned when value is empty/invalid (default "—")
 */
export function formatDate(value: string | Date | null | undefined, fallback = '—'): string {
  const d = toDate(value);
  if (!d) return fallback;
  return `${pad2(d.getUTCDate())} ${MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/**
 * Formats a date as "D Month YYYY" (e.g. "24 September 2026").
 * Equivalent to `toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' })`.
 */
export function formatDateLong(value: string | Date | null | undefined, fallback = '—'): string {
  const d = toDate(value);
  if (!d) return fallback;
  return `${d.getUTCDate()} ${MONTHS_LONG[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/**
 * Formats a date as "D Mon" (e.g. "24 Sep") — no year.
 * Equivalent to `toLocaleDateString('en-GB', { day:'numeric', month:'short' })`.
 */
export function formatDateShort(value: string | Date | null | undefined, fallback = '—'): string {
  const d = toDate(value);
  if (!d) return fallback;
  return `${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]}`;
}

/**
 * Formats a date+time as "DD Mon YYYY, HH:MM" (e.g. "24 Sep 2026, 14:30").
 * Equivalent to `toLocaleString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })`.
 */
export function formatDateTime(value: string | Date | null | undefined, fallback = '—'): string {
  const d = toDate(value);
  if (!d) return fallback;
  return `${pad2(d.getUTCDate())} ${MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}

/**
 * Formats a date+time as "D Month YYYY, HH:MM" (e.g. "24 September 2026, 14:30").
 * Equivalent to `toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' })`.
 */
export function formatDateTimeLong(value: string | Date | null | undefined, fallback = '—'): string {
  const d = toDate(value);
  if (!d) return fallback;
  return `${d.getUTCDate()} ${MONTHS_LONG[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}

/**
 * Formats a time as "HH:MM:SS" (e.g. "14:30:05").
 * Equivalent to `toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit', second:'2-digit' })`.
 * Safe alternative to `toISOString().slice(11,19)` — uses UTC getters.
 */
export function formatTime(value: string | Date | null | undefined, fallback = '—'): string {
  const d = toDate(value);
  if (!d) return fallback;
  return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}`;
}

/**
 * Returns the current UTC time as "HH:MM:SS".
 * Safe to call on both server and client — use inside useEffect for live clocks.
 */
export function formatNowTime(): string {
  return formatTime(new Date());
}
