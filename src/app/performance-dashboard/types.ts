export interface DrillDownFilter {
  type: 'metric' | 'bsc-perspective' | 'kpi-trend';
  label: string;
  subLabel?: string;
  value?: number;
  status?: 'on-track' | 'at-risk' | 'overdue' | 'alert';
  color?: string;
}
