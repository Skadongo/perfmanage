import { MetricCardSkeleton, ChartSkeleton, TableSkeleton } from '@/components/ui/SkeletonLoader';

export default function PerformanceDashboardLoading() {
  return (
    <div className="space-y-6 p-4 lg:p-6">
      {/* Metric strip — 6 cards */}
      <MetricCardSkeleton count={6} />
      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
      {/* Table */}
      <TableSkeleton />
    </div>
  );
}
