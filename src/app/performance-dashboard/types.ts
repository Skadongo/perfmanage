/**
 * Shared types for the Performance Dashboard.
 * Extracted here to avoid circular imports between lazy-loaded components
 * and the page that statically imports these types.
 */

export interface DrillDownFilter {
  type: 'metric' | 'bsc-perspective' | 'kpi-trend';
  label: string;
  subLabel?: string;
  value?: number;
  status?: 'on-track' | 'at-risk' | 'overdue' | 'alert';
  color?: string;
}
