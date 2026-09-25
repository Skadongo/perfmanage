import { MetricCardSkeleton, TableSkeleton } from '@/components/ui/SkeletonLoader';

export default function EvaluationReviewsLoading() {
  return (
    <div className="space-y-6 p-4 lg:p-6">
      <MetricCardSkeleton count={4} />
      <TableSkeleton />
    </div>
  );
}
