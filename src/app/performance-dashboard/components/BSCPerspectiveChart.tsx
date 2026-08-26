'use client';

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts';
import type { DrillDownFilter } from './StaffDrillDownModal';

const DATA = [
  { perspective: 'Finance', shortLabel: 'Finance', score: 68.5, target: 80, color: '#1a5f7a' },
  { perspective: 'Customer / Ops', shortLabel: 'Customer', score: 74.2, target: 80, color: '#0ea5c8' },
  { perspective: 'Business Process', shortLabel: 'Process', score: 71.8, target: 80, color: '#6366f1' },
  { perspective: 'Org. Capacity', shortLabel: 'Capacity', score: 79.1, target: 80, color: '#10b981' },
];

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: typeof DATA[0]; value: number }> }) => {
  if (active && payload && payload.length) {
    const d = payload[0].payload;
    return (
      <div className="bg-white border border-border rounded-lg p-3 shadow-elevated text-sm">
        <p className="font-700 text-foreground mb-1">{d.perspective}</p>
        <p className="text-muted-foreground">Score: <span className="font-700 text-foreground tabular-nums">{d.score}%</span></p>
        <p className="text-muted-foreground">Target: <span className="font-600 tabular-nums">{d.target}%</span></p>
        <p className={`font-600 mt-1 ${d.score >= d.target ? 'text-emerald-600' : 'text-amber-600'}`}>
          {d.score >= d.target ? `+${(d.score - d.target).toFixed(1)}% above` : `${(d.score - d.target).toFixed(1)}% below target`}
        </p>
        <p className="text-[11px] text-muted-foreground mt-1.5 border-t border-border pt-1.5">Click to view staff →</p>
      </div>
    );
  }
  return null;
};

interface Props {
  onBarClick: (filter: DrillDownFilter) => void;
}

export default function BSCPerspectiveChart({ onBarClick }: Props) {
  const handleBarClick = (data: typeof DATA[0]) => {
    onBarClick({
      type: 'bsc-perspective',
      label: `BSC: ${data.perspective}`,
      subLabel: `Score: ${data.score}% · Target: ${data.target}%`,
      value: data.score,
      color: data.color,
    });
  };

  return (
    <div className="bg-white rounded-xl border border-border shadow-card p-5 h-full">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-700 text-foreground">BSC Perspective Scores</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Q1 2026 — All Roles Combined · <span className="text-primary font-500">Click bar to drill down</span></p>
        </div>
        <span className="text-[11px] bg-muted text-muted-foreground px-2 py-1 rounded-md font-500">Target: 80%</span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart
          data={DATA}
          margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
          barSize={32}
          style={{ cursor: 'pointer' }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(215,15%,88%)" vertical={false} />
          <XAxis
            dataKey="shortLabel"
            tick={{ fontSize: 11, fontFamily: 'DM Sans', fill: 'hsl(215,15%,48%)' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 11, fontFamily: 'DM Sans', fill: 'hsl(215,15%,48%)' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(215,15%,94%)' }} />
          <ReferenceLine y={80} stroke="#e8a838" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: 'Target', position: 'right', fontSize: 10, fill: '#e8a838' }} />
          <Bar dataKey="score" radius={[4, 4, 0, 0]} onClick={(data) => handleBarClick(data as typeof DATA[0])}>
            {DATA.map((entry, index) => (
              <Cell key={`bsc-cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}