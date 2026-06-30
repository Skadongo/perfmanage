'use client';

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,  } from 'recharts';

const DATA = [
  { domain: 'Legal Framework', baseline: 62, current: 82, target: 90 },
  { domain: 'IHR Coordination', baseline: 55, current: 74, target: 85 },
  { domain: 'Surveillance', baseline: 48, current: 68, target: 80 },
  { domain: 'Laboratory', baseline: 52, current: 71, target: 75 },
  { domain: 'Rapid Response', baseline: 41, current: 63, target: 80 },
  { domain: 'Health Emergency', baseline: 38, current: 59, target: 75 },
  { domain: 'Communication', baseline: 61, current: 79, target: 85 },
  { domain: 'Points of Entry', baseline: 45, current: 65, target: 75 },
];

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-border rounded-lg p-3 shadow-elevated text-xs">
        <p className="font-700 text-foreground mb-2">{label}</p>
        {payload.map((p, i) => (
          <div key={`hep-tt-${i}`} className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="text-muted-foreground capitalize">{p.name}:</span>
            <span className="font-700 tabular-nums">{p.value}</span>
          </div>
        ))}
        {payload[0] && payload[1] && (
          <p className="text-emerald-600 font-600 mt-1">+{payload[1].value - payload[0].value} pts improvement</p>
        )}
      </div>
    );
  }
  return null;
};

export default function HEPRRProgressChart() {
  return (
    <div className="bg-white rounded-xl border border-border shadow-card p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-700 text-foreground">HEPRR-MPA Indicator Progress</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Baseline vs Current Score (0–100) · AFE Program Year 2</p>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-slate-300 inline-block" />Baseline</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-primary inline-block" />Current</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={DATA} margin={{ top: 4, right: 4, left: -20, bottom: 40 }} barSize={14} barGap={2}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(215,15%,88%)" vertical={false} />
          <XAxis
            dataKey="domain"
            tick={{ fontSize: 10, fontFamily: 'DM Sans', fill: 'hsl(215,15%,48%)' }}
            axisLine={false}
            tickLine={false}
            angle={-35}
            textAnchor="end"
            interval={0}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 11, fontFamily: 'DM Sans', fill: 'hsl(215,15%,48%)' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(215,15%,94%)' }} />
          <ReferenceLine y={74} stroke="#e8a838" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: 'Prog. 74%', position: 'right', fontSize: 9, fill: '#e8a838' }} />
          <Bar dataKey="baseline" fill="#cbd5e1" radius={[3, 3, 0, 0]} name="Baseline" />
          <Bar dataKey="current" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} name="Current" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}