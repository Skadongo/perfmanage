'use client';

import React, { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend,
} from 'recharts';
import Icon from '@/components/ui/AppIcon';

interface ReviewRecord {
  id: string;
  staffName: string;
  role: string;
  department?: string;
  reviewType: string;
  status: string;
  selfScore: number;
  supervisorScore: number;
  overallProgress: number;
}

interface ReviewStatsDashboardProps {
  reviews: ReviewRecord[];
}

const STATUS_COLORS: Record<string, string> = {
  approved: '#10b981',
  submitted: '#3b82f6',
  'in-progress': '#f59e0b',
  pending: '#94a3b8',
  overdue: '#ef4444',
};

const STATUS_LABELS: Record<string, string> = {
  approved: 'Approved',
  submitted: 'Submitted',
  'in-progress': 'In Progress',
  pending: 'Pending',
  overdue: 'Overdue',
};

const ROLE_DEPT_MAP: Record<string, string> = {
  'Director General': 'Executive Office',
  'Director of Finance': 'Finance & Admin',
  'Finance Officer': 'Finance & Admin',
  'HR & Admin Officer': 'Finance & Admin',
  'Receptionist': 'Finance & Admin',
  'Driver': 'Finance & Admin',
  'Director of Programs': 'Programmes',
  'Senior ICT Officer': 'ICT',
  'DoID': 'Institutional Development',
};

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-border rounded-lg shadow-lg p-3 text-xs">
        <p className="font-700 text-foreground mb-1.5">{label}</p>
        {payload.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
            <span className="text-muted-foreground">{p.name}:</span>
            <span className="font-700 text-foreground">{p.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function ReviewStatsDashboard({ reviews }: ReviewStatsDashboardProps) {
  // Completion status breakdown
  const statusBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    reviews.forEach(r => {
      counts[r.status] = (counts[r.status] || 0) + 1;
    });
    return Object.entries(counts).map(([status, count]) => ({
      status: STATUS_LABELS[status] || status,
      count,
      color: STATUS_COLORS[status] || '#94a3b8',
      rawStatus: status,
    }));
  }, [reviews]);

  // By role breakdown
  const roleBreakdown = useMemo(() => {
    const map: Record<string, { total: number; completed: number; overdue: number }> = {};
    reviews.forEach(r => {
      if (!map[r.role]) map[r.role] = { total: 0, completed: 0, overdue: 0 };
      map[r.role].total++;
      if (r.status === 'approved' || r.status === 'submitted') map[r.role].completed++;
      if (r.status === 'overdue') map[r.role].overdue++;
    });
    return Object.entries(map).map(([role, data]) => ({
      role: role.length > 20 ? role.slice(0, 18) + '…' : role,
      fullRole: role,
      ...data,
      pending: data.total - data.completed - data.overdue,
    }));
  }, [reviews]);

  // By department breakdown
  const deptBreakdown = useMemo(() => {
    const map: Record<string, { total: number; completed: number; overdue: number; inProgress: number }> = {};
    reviews.forEach(r => {
      const dept = r.department || ROLE_DEPT_MAP[r.role] || 'Other';
      if (!map[dept]) map[dept] = { total: 0, completed: 0, overdue: 0, inProgress: 0 };
      map[dept].total++;
      if (r.status === 'approved' || r.status === 'submitted') map[dept].completed++;
      else if (r.status === 'overdue') map[dept].overdue++;
      else if (r.status === 'in-progress') map[dept].inProgress++;
    });
    return Object.entries(map).map(([dept, data]) => ({
      dept,
      ...data,
      pending: data.total - data.completed - data.overdue - data.inProgress,
    }));
  }, [reviews]);

  // Avg scores by role
  const avgScoreByRole = useMemo(() => {
    const map: Record<string, { selfTotal: number; supTotal: number; count: number }> = {};
    reviews.forEach(r => {
      if (r.selfScore > 0 || r.supervisorScore > 0) {
        if (!map[r.role]) map[r.role] = { selfTotal: 0, supTotal: 0, count: 0 };
        if (r.selfScore > 0) map[r.role].selfTotal += r.selfScore;
        if (r.supervisorScore > 0) map[r.role].supTotal += r.supervisorScore;
        map[r.role].count++;
      }
    });
    return Object.entries(map).map(([role, d]) => ({
      role: role.length > 20 ? role.slice(0, 18) + '…' : role,
      fullRole: role,
      selfAvg: d.count > 0 ? parseFloat((d.selfTotal / d.count).toFixed(2)) : 0,
      supAvg: d.count > 0 ? parseFloat((d.supTotal / d.count).toFixed(2)) : 0,
    }));
  }, [reviews]);

  const completionRate = reviews.length > 0
    ? Math.round((reviews.filter(r => r.status === 'approved' || r.status === 'submitted').length / reviews.length) * 100)
    : 0;

  return (
    <div className="space-y-5">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <Icon name="ChartBarIcon" size={18} className="text-primary" />
        <h3 className="text-sm font-700 text-foreground">Summary Statistics Dashboard</h3>
        <span className="text-xs text-muted-foreground ml-1">— {reviews.length} reviews analysed</span>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {statusBreakdown.map((s) => (
          <div key={`kpi-${s.rawStatus}`} className="bg-white rounded-xl border border-border shadow-card p-3 flex flex-col gap-1">
            <span className="text-[10px] font-600 uppercase tracking-wider text-muted-foreground">{s.status}</span>
            <span className="text-2xl font-700 tabular-nums font-mono" style={{ color: s.color }}>{s.count}</span>
            <span className="text-[10px] text-muted-foreground">{reviews.length > 0 ? Math.round((s.count / reviews.length) * 100) : 0}% of total</span>
          </div>
        ))}
        <div className="bg-primary/5 rounded-xl border border-primary/20 shadow-card p-3 flex flex-col gap-1">
          <span className="text-[10px] font-600 uppercase tracking-wider text-primary/70">Completion Rate</span>
          <span className="text-2xl font-700 tabular-nums font-mono text-primary">{completionRate}%</span>
          <span className="text-[10px] text-muted-foreground">Submitted + Approved</span>
        </div>
      </div>

      {/* Charts row 1: Status + Department */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Status distribution */}
        <div className="bg-white rounded-xl border border-border shadow-card p-4">
          <p className="text-xs font-700 uppercase tracking-wider text-muted-foreground mb-4">Completion Status Distribution</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={statusBreakdown} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="status" tick={{ fontSize: 10, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" name="Reviews" radius={[4, 4, 0, 0]}>
                {statusBreakdown.map((entry, index) => (
                  <Cell key={`cell-status-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Department breakdown */}
        <div className="bg-white rounded-xl border border-border shadow-card p-4">
          <p className="text-xs font-700 uppercase tracking-wider text-muted-foreground mb-4">Reviews by Department</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={deptBreakdown} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="dept" tick={{ fontSize: 9, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="completed" name="Completed" fill="#10b981" radius={[2, 2, 0, 0]} stackId="a" />
              <Bar dataKey="inProgress" name="In Progress" fill="#f59e0b" radius={[0, 0, 0, 0]} stackId="a" />
              <Bar dataKey="overdue" name="Overdue" fill="#ef4444" radius={[0, 0, 0, 0]} stackId="a" />
              <Bar dataKey="pending" name="Pending" fill="#94a3b8" radius={[2, 2, 0, 0]} stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts row 2: Role breakdown + Avg scores */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Role completion */}
        <div className="bg-white rounded-xl border border-border shadow-card p-4">
          <p className="text-xs font-700 uppercase tracking-wider text-muted-foreground mb-4">Reviews by Role</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={roleBreakdown} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: '#64748b' }} allowDecimals={false} />
              <YAxis type="category" dataKey="role" tick={{ fontSize: 9, fill: '#64748b' }} width={100} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="completed" name="Completed" fill="#10b981" stackId="b" />
              <Bar dataKey="pending" name="Pending" fill="#94a3b8" stackId="b" />
              <Bar dataKey="overdue" name="Overdue" fill="#ef4444" radius={[0, 4, 4, 0]} stackId="b" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Avg scores by role */}
        <div className="bg-white rounded-xl border border-border shadow-card p-4">
          <p className="text-xs font-700 uppercase tracking-wider text-muted-foreground mb-4">Average Scores by Role (Self vs Supervisor)</p>
          {avgScoreByRole.length === 0 ? (
            <div className="flex items-center justify-center h-[220px] text-sm text-muted-foreground">No scored reviews yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={avgScoreByRole} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis type="category" dataKey="role" tick={{ fontSize: 9, fill: '#64748b' }} width={100} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="selfAvg" name="Self Avg" fill="#38bdf8" radius={[0, 2, 2, 0]} />
                <Bar dataKey="supAvg" name="Supervisor Avg" fill="#6366f1" radius={[0, 2, 2, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
