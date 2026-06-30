'use client';

import React from 'react';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip,  } from 'recharts';

const DATA = [
  { capacity: 'Legislation', jee: 3.8, spar: 76 },
  { capacity: 'Coordination', jee: 3.2, spar: 64 },
  { capacity: 'Surveillance', jee: 2.9, spar: 58 },
  { capacity: 'Response', jee: 2.7, spar: 54 },
  { capacity: 'Preparedness', jee: 3.1, spar: 62 },
  { capacity: 'Risk Comms', jee: 3.5, spar: 70 },
  { capacity: 'Human Resources', jee: 3.4, spar: 68 },
  { capacity: 'Laboratory', jee: 3.0, spar: 60 },
  { capacity: 'Points of Entry', jee: 2.8, spar: 56 },
  { capacity: 'Zoonotic Events', jee: 2.6, spar: 52 },
  { capacity: 'Food Safety', jee: 2.5, spar: 50 },
  { capacity: 'Chemical Events', jee: 3.2, spar: 64 },
  { capacity: 'Radiation', jee: 3.0, spar: 60 },
];

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-border rounded-lg p-3 shadow-elevated text-xs">
        <p className="font-700 text-foreground mb-1">{label}</p>
        {payload.map((p, i) => (
          <div key={`jee-tt-${i}`} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="text-muted-foreground">{p.name}:</span>
            <span className="font-700 tabular-nums">{p.value}{p.name === 'JEE Score' ? '/5' : ''}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function JEESPARChart() {
  return (
    <div className="bg-white rounded-xl border border-border shadow-card p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-700 text-foreground">JEE / SPAR — 13 IHR Core Capacities</h3>
          <p className="text-xs text-muted-foreground mt-0.5">JEE Score (1–5) and SPAR Score (0–100) · Latest Assessment</p>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-primary inline-block" />JEE</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />SPAR</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <RadarChart data={DATA} margin={{ top: 10, right: 30, left: 30, bottom: 10 }}>
          <PolarGrid stroke="hsl(215,15%,88%)" />
          <PolarAngleAxis dataKey="capacity" tick={{ fontSize: 9, fontFamily: 'DM Sans', fill: 'hsl(215,15%,48%)' }} />
          <PolarRadiusAxis angle={90} domain={[0, 5]} tick={{ fontSize: 9, fill: 'hsl(215,15%,48%)' }} />
          <Tooltip content={<CustomTooltip />} />
          <Radar name="JEE Score" dataKey="jee" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.15} strokeWidth={2} />
          <Radar name="SPAR (÷20)" dataKey={(d) => d.spar / 20} stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.1} strokeWidth={1.5} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}