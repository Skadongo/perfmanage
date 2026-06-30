'use client';

import React, { useState, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import DashboardMetricCards from './components/DashboardMetricCards';
import BSCPerspectiveChart from './components/BSCPerspectiveChart';
import KPITrendChart from './components/KPITrendChart';
import FrameworkIndicators from './components/FrameworkIndicators';
import AtRiskStaffTable from './components/AtRiskStaffTable';
import ActivityFeed from './components/ActivityFeed';
import StaffDrillDownModal, { type DrillDownFilter } from './components/StaffDrillDownModal';
import Icon from '@/components/ui/AppIcon';
import StrategicPlanSection from './components/StrategicPlanSection';
import { useAuth } from '@/contexts/AuthContext';
import { useRealtimeDashboard, type LiveStats } from '@/hooks/useRealtimeDashboard';
import {
  resolveRoleBucket,
  getRoleDashboardConfig,
  type RoleDashboardConfig,
} from './config/roleDashboardConfig';

// ── Live strip metric definitions ──────────────────────────────────────────
interface StripItem {
  key: keyof LiveStats;
  label: string;
  color: string;
  bg: string;
  format?: (v: number) => string;
  sub: (stats: LiveStats) => string;
}

const ALL_STRIP_ITEMS: StripItem[] = [
  {
    key: 'totalReviews',
    label: 'Total Reviews',
    color: 'text-foreground',
    bg: 'bg-muted/40',
    sub: () => 'All periods',
  },
  {
    key: 'submitted',
    label: 'Submitted',
    color: 'text-sky-700',
    bg: 'bg-sky-50',
    sub: (s) => {
      const pct = s.totalReviews > 0 ? Math.round((s.submitted / s.totalReviews) * 100) : 0;
      return `${pct}% rate`;
    },
  },
  {
    key: 'approved',
    label: 'Approved',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    sub: () => 'Fully approved',
  },
  {
    key: 'avgRating',
    label: 'Avg Sup Rating',
    color: 'text-violet-700',
    bg: 'bg-violet-50',
    format: (v) => (v > 0 ? `${v}/5` : '—'),
    sub: (s) => `Updated ${s.lastUpdated}`,
  },
  {
    key: 'totalStaff',
    label: 'Active Staff',
    color: 'text-teal-700',
    bg: 'bg-teal-50',
    sub: () => 'In system',
  },
  {
    key: 'pendingReviews',
    label: 'Pending',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    sub: () => 'Awaiting action',
  },
];

// ── Role notification banner ────────────────────────────────────────────────
function RoleChangeBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
      <Icon name="BellAlertIcon" size={16} className="text-amber-600 flex-shrink-0" />
      <span className="flex-1 font-500">
        Your role or a staff member&apos;s role was just updated. Dashboard data has been refreshed.
      </span>
      <button
        onClick={onDismiss}
        className="text-amber-600 hover:text-amber-800 transition-colors"
        aria-label="Dismiss"
      >
        <Icon name="XMarkIcon" size={16} />
      </button>
    </div>
  );
}

// ── Staff update banner ─────────────────────────────────────────────────────
function StaffUpdateBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="flex items-center gap-3 bg-sky-50 border border-sky-200 rounded-xl px-4 py-3 text-sm text-sky-800">
      <Icon name="UsersIcon" size={16} className="text-sky-600 flex-shrink-0" />
      <span className="flex-1 font-500">Staff records updated — dashboard synced in real time.</span>
      <button
        onClick={onDismiss}
        className="text-sky-600 hover:text-sky-800 transition-colors"
        aria-label="Dismiss"
      >
        <Icon name="XMarkIcon" size={16} />
      </button>
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────
export default function PerformanceDashboardPage() {
  const { profile } = useAuth();

  // Resolve role bucket and config
  const systemRole = profile?.systemRole ?? 'default';
  const roleBucket = resolveRoleBucket(systemRole);
  const config: RoleDashboardConfig = getRoleDashboardConfig(roleBucket);

  // For staff_member, scope data to their own staffId
  const scopedStaffId = roleBucket === 'staff_member' ? (profile?.staffId ?? null) : null;

  // Notification banners
  const [showRoleBanner, setShowRoleBanner] = useState(false);
  const [showStaffBanner, setShowStaffBanner] = useState(false);

  const handleRoleChange = useCallback(() => {
    setShowRoleBanner(true);
    setTimeout(() => setShowRoleBanner(false), 8000);
  }, []);

  const handleStaffChange = useCallback(() => {
    setShowStaffBanner(true);
    setTimeout(() => setShowStaffBanner(false), 6000);
  }, []);

  // Real-time hook
  const { liveStats, realtimeActive, refreshKey } = useRealtimeDashboard({
    staffId: scopedStaffId,
    onRoleChange: handleRoleChange,
    onStaffChange: handleStaffChange,
  });

  const [drillFilter, setDrillFilter] = useState<DrillDownFilter | null>(null);

  const handleDrillDown = (filter: DrillDownFilter) => setDrillFilter(filter);
  const handleCloseModal = () => setDrillFilter(null);

  // Build live strip items based on role config
  const stripItems = ALL_STRIP_ITEMS.filter(item =>
    config.liveStripMetrics.includes(item.key as typeof config.liveStripMetrics[number])
  );

  return (
    <AppLayout
      pageTitle={config.roleLabel}
      pageSubtitle={config.dashboardSubtitle}
      actions={
        <div className="flex items-center gap-2">
          {/* Role badge */}
          <span
            className={`hidden sm:flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border font-600 ${config.roleBadgeClass}`}
          >
            <Icon name="UserCircleIcon" size={12} />
            {profile?.fullName
              ? profile.fullName.split(' ')[0]
              : config.roleLabel}
          </span>

          {/* Live indicator */}
          <span
            className={`hidden sm:flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              realtimeActive
                ? 'text-emerald-700 bg-emerald-50 border-emerald-200' :'text-muted-foreground bg-muted border-border'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full inline-block ${
                realtimeActive ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground'
              }`}
            />
            {realtimeActive ? 'Live' : 'Connecting…'}
          </span>

          <button className="btn-brand">
            <Icon name="EcsaExportIcon" size={14} className="text-white" />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      }
    >
      <div className="space-y-5">

        {/* Role-change notification banners */}
        {showRoleBanner && <RoleChangeBanner onDismiss={() => setShowRoleBanner(false)} />}
        {showStaffBanner && <StaffUpdateBanner onDismiss={() => setShowStaffBanner(false)} />}

        {/* Live KPI strip */}
        {config.showLiveStrip && liveStats && (
          <div className={`grid gap-3 ${
            stripItems.length <= 2 ? 'grid-cols-2' :
            stripItems.length === 3 ? 'grid-cols-3': 'grid-cols-2 sm:grid-cols-4'
          }`}>
            {stripItems.map((item) => {
              const raw = liveStats[item.key] as number;
              const display = item.format ? item.format(raw) : String(raw);
              return (
                <div
                  key={item.key}
                  className={`${item.bg} rounded-xl p-3 border border-border/50`}
                >
                  <p className={`text-xl font-700 tabular-nums font-mono ${item.color}`}>
                    {display}
                  </p>
                  <p className="text-[11px] font-600 text-foreground mt-0.5">{item.label}</p>
                  <p className="text-[10px] text-muted-foreground">{item.sub(liveStats)}</p>
                </div>
              );
            })}
          </div>
        )}

        {/* Section: Strategic Plan — Directors + Staff Members */}
        {config.showStrategicPlan && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-600 uppercase tracking-wider text-muted-foreground">
                Strategic Plan 2024–2034
              </h2>
              <span className="text-[11px] text-muted-foreground">ECSA-HC · 10-Year Roadmap</span>
            </div>
            <StrategicPlanSection />
          </section>
        )}

        {/* Section: Hero Metrics */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-600 uppercase tracking-wider text-muted-foreground">
              Key Performance Indicators
            </h2>
            <span className="text-[11px] text-muted-foreground">FY 2025–2026 · Balanced Scorecard</span>
          </div>
          <DashboardMetricCards
            onMetricClick={handleDrillDown}
            visibleMetricIds={config.visibleMetrics}
            showHeroMetric={config.showHeroMetric}
            staffId={scopedStaffId}
            key={`metrics-${refreshKey}`}
          />
        </section>

        {/* Section: Charts */}
        {(config.showKPITrendChart || config.showBSCChart) && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-600 uppercase tracking-wider text-muted-foreground">
                Trend Analysis
              </h2>
              <span className="text-[11px] text-primary flex items-center gap-1">
                <Icon name="EcsaKPIIcon" size={12} className="text-primary" />
                Click charts to drill down
              </span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {config.showKPITrendChart && (
                <KPITrendChart onPointClick={handleDrillDown} key={`kpi-${refreshKey}`} />
              )}
              {config.showBSCChart && (
                <BSCPerspectiveChart onBarClick={handleDrillDown} key={`bsc-${refreshKey}`} />
              )}
            </div>
          </section>
        )}

        {/* Section: External Framework Indicators — Directors + Admins only */}
        {config.showFrameworkIndicators && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-600 uppercase tracking-wider text-muted-foreground">
                External Framework Indicators
              </h2>
              <span className="text-[11px] text-muted-foreground">
                HEPRR-MPA · World Bank · JEE/SPAR
              </span>
            </div>
            <FrameworkIndicators />
          </section>
        )}

        {/* Section: At-Risk Table + Activity Feed */}
        {(config.showAtRiskTable || config.showActivityFeed) && (
          <section>
            <div
              className={`grid gap-4 ${
                config.showAtRiskTable && config.showActivityFeed
                  ? 'grid-cols-1 xl:grid-cols-3' :'grid-cols-1'
              }`}
            >
              {config.showAtRiskTable && (
                <div className={config.showActivityFeed ? 'xl:col-span-2' : ''}>
                  <AtRiskStaffTable key={`risk-${refreshKey}`} />
                </div>
              )}
              {config.showActivityFeed && (
                <div>
                  <ActivityFeed key={`feed-${refreshKey}`} />
                </div>
              )}
            </div>
          </section>
        )}
      </div>

      {/* Staff Drill-Down Modal */}
      <StaffDrillDownModal filter={drillFilter} onClose={handleCloseModal} />
    </AppLayout>
  );
}