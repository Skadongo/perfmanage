'use client';

import React, { useState, useCallback, lazy, Suspense } from 'react';
import AppLayout from '@/components/AppLayout';
import Icon from '@/components/ui/AppIcon';
import { ChartSkeleton, MetricCardSkeleton, TableSkeleton } from '@/components/ui/SkeletonLoader';
import { useAuth } from '@/contexts/AuthContext';
import { useRealtimeDashboard, type LiveStats } from '@/hooks/useRealtimeDashboard';
import {
  resolveRoleBucket,
  getRoleDashboardConfig,
  type RoleDashboardConfig,
} from './config/roleDashboardConfig';
import type { DrillDownFilter } from './components/StaffDrillDownModal';

// ── Lazy-load heavy dashboard widgets ──────────────────────────────────────
const DashboardMetricCards  = lazy(() => import('./components/DashboardMetricCards'));
const BSCPerspectiveChart   = lazy(() => import('./components/BSCPerspectiveChart'));
const KPITrendChart         = lazy(() => import('./components/KPITrendChart'));
const FrameworkIndicators   = lazy(() => import('./components/FrameworkIndicators'));
const AtRiskStaffTable      = lazy(() => import('./components/AtRiskStaffTable'));
const ActivityFeed          = lazy(() => import('./components/ActivityFeed'));
const StaffDrillDownModal   = lazy(() => import('./components/StaffDrillDownModal'));
const StrategicPlanSection  = lazy(() => import('./components/StrategicPlanSection'));

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
      <button onClick={onDismiss} className="text-amber-600 hover:text-amber-800 transition-colors" aria-label="Dismiss">
        <Icon name="XMarkIcon" size={16} />
      </button>
    </div>
  );
}

function StaffUpdateBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="flex items-center gap-3 bg-sky-50 border border-sky-200 rounded-xl px-4 py-3 text-sm text-sky-800">
      <Icon name="UsersIcon" size={16} className="text-sky-600 flex-shrink-0" />
      <span className="flex-1 font-500">Staff records updated — dashboard synced in real time.</span>
      <button onClick={onDismiss} className="text-sky-600 hover:text-sky-800 transition-colors" aria-label="Dismiss">
        <Icon name="XMarkIcon" size={16} />
      </button>
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────
export default function PerformanceDashboardPage() {
  const { profile } = useAuth();

  const systemRole = profile?.systemRole ?? 'default';
  const roleBucket = resolveRoleBucket(systemRole);
  const config: RoleDashboardConfig = getRoleDashboardConfig(roleBucket);

  const scopedStaffId = roleBucket === 'staff_member' ? (profile?.staffId ?? null) : null;

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

  const { liveStats, realtimeActive, refreshKey } = useRealtimeDashboard({
    staffId: scopedStaffId,
    onRoleChange: handleRoleChange,
    onStaffChange: handleStaffChange,
  });

  const [drillFilter, setDrillFilter] = useState<DrillDownFilter | null>(null);
  const handleDrillDown = (filter: DrillDownFilter) => setDrillFilter(filter);
  const handleCloseModal = () => setDrillFilter(null);

  const stripItems = ALL_STRIP_ITEMS.filter(item =>
    config.liveStripMetrics.includes(item.key as typeof config.liveStripMetrics[number])
  );

  return (
    <AppLayout
      pageTitle={config.roleLabel}
      pageSubtitle={config.dashboardSubtitle}
      actions={
        <div className="flex items-center gap-2">
          <span className={`hidden sm:flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border font-600 ${config.roleBadgeClass}`}>
            <Icon name="UserCircleIcon" size={12} />
            {profile?.fullName ? profile.fullName.split(' ')[0] : config.roleLabel}
          </span>
          <span className={`hidden sm:flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
            realtimeActive
              ? 'text-emerald-700 bg-emerald-50 border-emerald-200' :'text-muted-foreground bg-muted border-border'
          }`}>
            <span className={`w-2 h-2 rounded-full inline-block ${realtimeActive ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground'}`} />
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
        {showRoleBanner && <RoleChangeBanner onDismiss={() => setShowRoleBanner(false)} />}
        {showStaffBanner && <StaffUpdateBanner onDismiss={() => setShowStaffBanner(false)} />}

        {/* Live KPI strip */}
        {config.showLiveStrip && liveStats && (
          <div className={`grid gap-2 sm:gap-3 ${
            stripItems.length <= 2 ? 'grid-cols-2' :
            stripItems.length === 3 ? 'grid-cols-3': 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6'
          }`}>
            {stripItems.map((item) => {
              const raw = liveStats[item.key] as number;
              const display = item.format ? item.format(raw) : String(raw);
              return (
                <div key={item.key} className={`${item.bg} rounded-xl p-2.5 sm:p-3 border border-border/50`}>
                  <p className={`text-lg sm:text-xl font-700 tabular-nums font-mono ${item.color}`}>{display}</p>
                  <p className="text-[11px] font-600 text-foreground mt-0.5 truncate">{item.label}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{item.sub(liveStats)}</p>
                </div>
              );
            })}
          </div>
        )}

        {/* Strategic Plan — lazy loaded */}
        {config.showStrategicPlan && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-600 uppercase tracking-wider text-muted-foreground">Strategic Plan 2024–2034</h2>
              <span className="text-[11px] text-muted-foreground">ECSA-HC · 10-Year Roadmap</span>
            </div>
            <Suspense fallback={<div className="animate-pulse bg-muted/40 rounded-xl h-32" />}>
              <StrategicPlanSection />
            </Suspense>
          </section>
        )}

        {/* Hero Metrics — each widget loads independently */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-600 uppercase tracking-wider text-muted-foreground">Key Performance Indicators</h2>
            <span className="text-[11px] text-muted-foreground">FY 2025–2026 · Balanced Scorecard</span>
          </div>
          <Suspense fallback={<MetricCardSkeleton count={config.showHeroMetric ? 6 : 4} />}>
            <DashboardMetricCards
              onMetricClick={handleDrillDown}
              visibleMetricIds={config.visibleMetrics}
              showHeroMetric={config.showHeroMetric}
              staffId={scopedStaffId}
              systemRole={systemRole}
              key={`metrics-${refreshKey}`}
            />
          </Suspense>
        </section>

        {/* Charts — each loads independently */}
        {(config.showKPITrendChart || config.showBSCChart) && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-600 uppercase tracking-wider text-muted-foreground">Trend Analysis</h2>
              <span className="text-[11px] text-primary flex items-center gap-1">
                <Icon name="EcsaKPIIcon" size={12} className="text-primary" />
                Click charts to drill down
              </span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {config.showKPITrendChart && (
                <Suspense fallback={<ChartSkeleton height={240} />}>
                  <KPITrendChart onPointClick={handleDrillDown} key={`kpi-${refreshKey}`} />
                </Suspense>
              )}
              {config.showBSCChart && (
                <Suspense fallback={<ChartSkeleton height={240} />}>
                  <BSCPerspectiveChart onBarClick={handleDrillDown} key={`bsc-${refreshKey}`} />
                </Suspense>
              )}
            </div>
          </section>
        )}

        {/* Framework Indicators — lazy loaded */}
        {config.showFrameworkIndicators && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-600 uppercase tracking-wider text-muted-foreground">External Framework Indicators</h2>
              <span className="text-[11px] text-muted-foreground">HEPRR-MPA · World Bank · JEE/SPAR</span>
            </div>
            <Suspense fallback={<ChartSkeleton height={180} />}>
              <FrameworkIndicators />
            </Suspense>
          </section>
        )}

        {/* At-Risk Table + Activity Feed — each loads independently */}
        {(config.showAtRiskTable || config.showActivityFeed) && (
          <section>
            <div className={`grid gap-4 ${
              config.showAtRiskTable && config.showActivityFeed ? 'grid-cols-1 xl:grid-cols-3' : 'grid-cols-1'
            }`}>
              {config.showAtRiskTable && (
                <div className={config.showActivityFeed ? 'xl:col-span-2' : ''}>
                  <Suspense fallback={<TableSkeleton rows={5} cols={5} />}>
                    <AtRiskStaffTable key={`risk-${refreshKey}`} />
                  </Suspense>
                </div>
              )}
              {config.showActivityFeed && (
                <div>
                  <Suspense fallback={<div className="animate-pulse bg-muted/40 rounded-xl h-64" />}>
                    <ActivityFeed key={`feed-${refreshKey}`} />
                  </Suspense>
                </div>
              )}
            </div>
          </section>
        )}
      </div>

      {/* Staff Drill-Down Modal — only rendered when needed */}
      {drillFilter && (
        <Suspense fallback={null}>
          <StaffDrillDownModal filter={drillFilter} onClose={handleCloseModal} />
        </Suspense>
      )}
    </AppLayout>
  );
}