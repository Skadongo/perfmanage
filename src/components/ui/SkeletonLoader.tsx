'use client';

import React from 'react';

// ── Generic pulse block ────────────────────────────────────────────────────
function Pulse({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-muted/60 rounded-lg ${className}`} />;
}

// ── Metric card skeleton (used in dashboard) ───────────────────────────────
export function MetricCardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white border border-border rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <Pulse className="h-4 w-24" />
            <Pulse className="h-8 w-8 rounded-lg" />
          </div>
          <Pulse className="h-8 w-16" />
          <Pulse className="h-2 w-full rounded-full" />
          <Pulse className="h-3 w-32" />
        </div>
      ))}
    </div>
  );
}

// ── Table row skeleton ─────────────────────────────────────────────────────
export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-white border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="grid gap-4 px-4 py-3 border-b border-border bg-muted/30"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {Array.from({ length: cols }).map((_, i) => (
          <Pulse key={i} className="h-3 w-full" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="grid gap-4 px-4 py-3 border-b border-border last:border-0"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: cols }).map((_, c) => (
            <Pulse key={c} className={`h-4 ${c === 0 ? 'w-3/4' : 'w-full'}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Card list skeleton (workplan / review list) ────────────────────────────
export function CardListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white border border-border rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Pulse className="h-5 w-48" />
            <Pulse className="h-6 w-20 rounded-full" />
          </div>
          <Pulse className="h-3 w-64" />
          <div className="flex gap-3">
            <Pulse className="h-3 w-24" />
            <Pulse className="h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Form skeleton (self-assessment workplan selector) ──────────────────────
export function FormSkeleton() {
  return (
    <div className="space-y-4">
      <Pulse className="h-5 w-40" />
      <Pulse className="h-10 w-full" />
      <Pulse className="h-5 w-32" />
      <Pulse className="h-10 w-full" />
      <div className="flex gap-3">
        <Pulse className="h-10 w-28" />
        <Pulse className="h-10 w-28" />
      </div>
    </div>
  );
}

// ── Chart skeleton ─────────────────────────────────────────────────────────
export function ChartSkeleton({ height = 240 }: { height?: number }) {
  // Pre-computed stable bar heights to avoid Math.random() in render (hydration-safe)
  const barHeights = [45, 72, 58, 88, 35, 65, 80, 50];
  return (
    <div className="bg-white border border-border rounded-xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <Pulse className="h-4 w-32" />
        <Pulse className="h-6 w-20 rounded-full" />
      </div>
      <div className="flex items-end gap-2" style={{ height }}>
        {barHeights.map((h, i) => (
          <Pulse
            key={i}
            className="flex-1"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Page-level full skeleton ───────────────────────────────────────────────
export function PageSkeleton() {
  return (
    <div className="space-y-5 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Pulse className="h-6 w-48" />
          <Pulse className="h-4 w-64" />
        </div>
        <Pulse className="h-9 w-28 rounded-lg" />
      </div>
      <MetricCardSkeleton count={4} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
      <TableSkeleton rows={5} cols={5} />
    </div>
  );
}
