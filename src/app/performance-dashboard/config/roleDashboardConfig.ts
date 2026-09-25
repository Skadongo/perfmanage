/**
 * Role-based dashboard configuration.
 * Controls which hero metrics, charts, and sections are visible per system role.
 */

export type DashboardRole = 'staff_member' | 'supervisor' | 'hr_officer' | 'director' | 'admin' | 'default';

export interface RoleDashboardConfig {
  /** Human-readable label shown in the dashboard header */
  roleLabel: string;
  /** Accent colour class for the role badge */
  roleBadgeClass: string;
  /** Which hero metric cards to show (by metric id) */
  visibleMetrics: string[];
  /** Whether the hero (large) KPI card is shown */
  showHeroMetric: boolean;
  /** Whether the KPI Trend chart is visible */
  showKPITrendChart: boolean;
  /** Whether the BSC Perspective chart is visible */
  showBSCChart: boolean;
  /** Whether the External Framework Indicators section is visible */
  showFrameworkIndicators: boolean;
  /** Whether the At-Risk Staff table is visible */
  showAtRiskTable: boolean;
  /** Whether the Activity Feed is visible */
  showActivityFeed: boolean;
  /** Whether the Strategic Plan section is visible */
  showStrategicPlan: boolean;
  /** Whether the live KPI strip (top stats row) is visible */
  showLiveStrip: boolean;
  /** Custom subtitle shown under the page title */
  dashboardSubtitle: string;
  /** Live strip metric labels to show (subset of all strip items) */
  liveStripMetrics: Array<'totalReviews' | 'submitted' | 'approved' | 'avgRating' | 'totalStaff' | 'pendingReviews'>;
  /**
   * Data scope:
   * - 'self'       → only the logged-in staff member's own records * -'direct'→ only direct reports of the logged-in supervisor * -'org'        → full organisation view
   */
  dataScope: 'self' | 'direct' | 'org';
}

/** Map from systemRole string → DashboardRole bucket */
export function resolveRoleBucket(systemRole: string): DashboardRole {
  if (['executive_director', 'deputy_director'].includes(systemRole)) return 'director';
  if (['hr_admin_officer'].includes(systemRole)) return 'hr_officer';
  if (['admin'].includes(systemRole)) return 'admin';
  if (['staff_member', 'project_coordinator', 'admin_officer'].includes(systemRole)) return 'staff_member';
  // programme_manager, finance_manager → supervisor (direct-reports view)
  if (['programme_manager', 'finance_manager'].includes(systemRole)) return 'supervisor';
  // programme_officer, finance_officer → staff view
  if (['programme_officer', 'finance_officer'].includes(systemRole)) return 'staff_member';
  return 'default';
}

const CONFIGS: Record<DashboardRole, RoleDashboardConfig> = {
  /** ── Staff Member ── sees ONLY their own KPIs and feedback */
  staff_member: {
    roleLabel: 'My Performance',
    roleBadgeClass: 'text-sky-700 bg-sky-50 border-sky-200',
    visibleMetrics: ['metric-review-completion', 'metric-avg-rating'],
    showHeroMetric: false,
    showKPITrendChart: true,
    showBSCChart: false,
    showFrameworkIndicators: false,
    showAtRiskTable: false,
    showActivityFeed: true,
    showStrategicPlan: false,
    showLiveStrip: true,
    dashboardSubtitle: 'Your personal performance overview · FY 2025–2026',
    liveStripMetrics: ['submitted', 'approved', 'avgRating', 'pendingReviews'],
    dataScope: 'self',
  },

  /** ── Supervisor / Manager ── sees direct reports only */
  supervisor: {
    roleLabel: 'Team Performance',
    roleBadgeClass: 'text-indigo-700 bg-indigo-50 border-indigo-200',
    visibleMetrics: [
      'metric-review-completion',
      'metric-avg-rating',
      'metric-cpd-completion',
    ],
    showHeroMetric: true,
    showKPITrendChart: true,
    showBSCChart: true,
    showFrameworkIndicators: false,
    showAtRiskTable: true,
    showActivityFeed: true,
    showStrategicPlan: false,
    showLiveStrip: true,
    dashboardSubtitle: 'Your direct reports · Supervisor Dashboard',
    liveStripMetrics: ['submitted', 'approved', 'avgRating', 'pendingReviews'],
    dataScope: 'direct',
  },

  /** ── HR Officer ── full org-wide view, staff management focus */
  hr_officer: {
    roleLabel: 'HR Officer View',
    roleBadgeClass: 'text-violet-700 bg-violet-50 border-violet-200',
    visibleMetrics: [
      'metric-kpi-achievement',
      'metric-review-completion',
      'metric-cpd-completion',
      'metric-avg-rating',
      'metric-total-staff',
    ],
    showHeroMetric: true,
    showKPITrendChart: true,
    showBSCChart: true,
    showFrameworkIndicators: false,
    showAtRiskTable: true,
    showActivityFeed: true,
    showStrategicPlan: false,
    showLiveStrip: true,
    dashboardSubtitle: 'Organisation-wide performance · HR Officer Dashboard',
    liveStripMetrics: ['totalReviews', 'submitted', 'approved', 'avgRating'],
    dataScope: 'org',
  },

  /** ── Director ── strategic view with all sections, org-wide health */
  director: {
    roleLabel: 'Director View',
    roleBadgeClass: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    visibleMetrics: [
      'metric-kpi-achievement',
      'metric-review-completion',
      'metric-cpd-completion',
      'metric-avg-rating',
      'metric-total-staff',
    ],
    showHeroMetric: true,
    showKPITrendChart: true,
    showBSCChart: true,
    showFrameworkIndicators: true,
    showAtRiskTable: true,
    showActivityFeed: true,
    showStrategicPlan: true,
    showLiveStrip: true,
    dashboardSubtitle: 'Organisation-wide health · Executive Dashboard',
    liveStripMetrics: ['totalReviews', 'submitted', 'approved', 'avgRating', 'totalStaff', 'pendingReviews'],
    dataScope: 'org',
  },

  /** ── Admin ── full access identical to director + system metrics */
  admin: {
    roleLabel: 'Admin View',
    roleBadgeClass: 'text-rose-700 bg-rose-50 border-rose-200',
    visibleMetrics: [
      'metric-kpi-achievement',
      'metric-review-completion',
      'metric-cpd-completion',
      'metric-avg-rating',
      'metric-total-staff',
    ],
    showHeroMetric: true,
    showKPITrendChart: true,
    showBSCChart: true,
    showFrameworkIndicators: true,
    showAtRiskTable: true,
    showActivityFeed: true,
    showStrategicPlan: true,
    showLiveStrip: true,
    dashboardSubtitle: 'Full system overview · Administrator Dashboard',
    liveStripMetrics: ['totalReviews', 'submitted', 'approved', 'avgRating', 'totalStaff', 'pendingReviews'],
    dataScope: 'org',
  },

  /** ── Default (fallback) ── same as HR Officer */
  default: {
    roleLabel: 'Performance Dashboard',
    roleBadgeClass: 'text-muted-foreground bg-muted border-border',
    visibleMetrics: [
      'metric-kpi-achievement',
      'metric-review-completion',
      'metric-cpd-completion',
      'metric-avg-rating',
      'metric-total-staff',
    ],
    showHeroMetric: true,
    showKPITrendChart: true,
    showBSCChart: true,
    showFrameworkIndicators: false,
    showAtRiskTable: true,
    showActivityFeed: true,
    showStrategicPlan: false,
    showLiveStrip: true,
    dashboardSubtitle: 'Q1 2026 · Last updated 25 Mar 2026, 08:14 EAT',
    liveStripMetrics: ['totalReviews', 'submitted', 'approved', 'avgRating'],
    dataScope: 'org',
  },
};

export function getRoleDashboardConfig(role: DashboardRole): RoleDashboardConfig {
  return CONFIGS[role] ?? CONFIGS.default;
}
