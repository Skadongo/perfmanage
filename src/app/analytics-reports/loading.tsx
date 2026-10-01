import { ChartSkeleton, TableSkeleton } from '@/components/ui/SkeletonLoader';

export default function AnalyticsReportsLoading() {
  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
      <TableSkeleton />
    </div>
  );
}
