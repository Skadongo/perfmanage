import React from 'react';

interface ProgressBarProps {
  value: number;
  max?: number;
  colorClass?: string;
  height?: string;
  showLabel?: boolean;
  className?: string;
}

export default function ProgressBar({
  value,
  max = 100,
  colorClass = 'bg-primary',
  height = 'h-2',
  showLabel = false,
  className = '',
}: ProgressBarProps) {
  const pct = Math.min(100, Math.round((value / max) * 100));

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className={`flex-1 bg-muted rounded-full overflow-hidden ${height}`}>
        <div
          className={`${height} ${colorClass} rounded-full transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs font-600 text-muted-foreground tabular-nums w-8 text-right">{pct}%</span>
      )}
    </div>
  );
}