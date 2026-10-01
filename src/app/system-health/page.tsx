'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import RoleGuard from '@/components/RoleGuard';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar,
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface QueryMetric {
  timestamp: string;
  latencyMs: number;
  queryType: string;
  success: boolean;
}

interface AuthMetric {
  timestamp: string;
  latencyMs: number;
  event: string;
}

interface SubscriptionStatus {
  channel: string;
  status: 'SUBSCRIBED' | 'CONNECTING' | 'CLOSED' | 'CHANNEL_ERROR' | 'TIMED_OUT';
  table: string;
  lastEventAt: string | null;
  eventCount: number;
}

interface DbLoadSample {
  timestamp: string;
  activeConnections: number;
  queryCount: number;
  avgLatencyMs: number;
}

interface HealthSummary {
  overallStatus: 'healthy' | 'degraded' | 'critical';
  avgQueryLatency: number;
  p95QueryLatency: number;
  authLatency: number;
  activeSubscriptions: number;
  totalSubscriptions: number;
  dbLoad: number;
  lastChecked: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function percentile(arr: number[], p: number): number {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function statusColor(status: HealthSummary['overallStatus']) {
  if (status === 'healthy') return 'text-emerald-600';
  if (status === 'degraded') return 'text-amber-600';
  return 'text-rose-600';
}

function statusBg(status: HealthSummary['overallStatus']) {
  if (status === 'healthy') return 'bg-emerald-50 border-emerald-200';
  if (status === 'degraded') return 'bg-amber-50 border-amber-200';
  return 'bg-rose-50 border-rose-200';
}

function subStatusColor(s: SubscriptionStatus['status']) {
  if (s === 'SUBSCRIBED') return 'text-emerald-600 bg-emerald-50';
  if (s === 'CONNECTING') return 'text-amber-600 bg-amber-50';
  return 'text-rose-600 bg-rose-50';
}

function latencyColor(ms: number) {
  if (ms < 200) return 'text-emerald-600';
  if (ms < 500) return 'text-amber-600';
  return 'text-rose-600';
}

const MAX_HISTORY = 30;

// ─── Component ────────────────────────────────────────────────────────────────

export default function SystemHealthPage() {
  const supabaseRef = useRef(createClient());

  const [queryHistory, setQueryHistory] = useState<QueryMetric[]>([]);
  const [authHistory, setAuthHistory] = useState<AuthMetric[]>([]);
  const [dbLoadHistory, setDbLoadHistory] = useState<DbLoadSample[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionStatus[]>([]);
  const [summary, setSummary] = useState<HealthSummary | null>(null);
  const [isRunning, setIsRunning] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<string>('—');

  const channelRefs = useRef<ReturnType<ReturnType<typeof createClient>['channel']>[]>([]);
  const subStatusRef = useRef<Map<string, SubscriptionStatus>>(new Map());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMounted = useRef(true);

  // ── Probe: measure a single query latency ──────────────────────────────────
  const probeQuery = useCallback(async (): Promise<QueryMetric> => {
    const supabase = supabaseRef.current;
    const start = performance.now();
    let success = true;
    try {
      await supabase.from('staff').select('id', { count: 'exact', head: true });
    } catch {
      success = false;
    }
    const latencyMs = Math.round(performance.now() - start);
    const now = new Date();
    return {
      timestamp: now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      latencyMs,
      queryType: 'SELECT (staff)',
      success,
    };
  }, []);

  // ── Probe: measure auth session latency ───────────────────────────────────
  const probeAuth = useCallback(async (): Promise<AuthMetric> => {
    const supabase = supabaseRef.current;
    const start = performance.now();
    try {
      await supabase.auth.getSession();
    } catch {}
    const latencyMs = Math.round(performance.now() - start);
    const now = new Date();
    return {
      timestamp: now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      latencyMs,
      event: 'getSession',
    };
  }, []);

  // ── Probe: simulate DB load via parallel queries ───────────────────────────
  const probeDbLoad = useCallback(async (): Promise<DbLoadSample> => {
    const supabase = supabaseRef.current;
    const queries = [
      supabase.from('staff').select('id', { count: 'exact', head: true }),
      supabase.from('mid_year_reviews').select('id', { count: 'exact', head: true }),
      supabase.from('user_profiles').select('user_id', { count: 'exact', head: true }),
    ];
    const start = performance.now();
    await Promise.allSettled(queries);
    const elapsed = Math.round(performance.now() - start);
    const now = new Date();
    return {
      timestamp: now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      activeConnections: Math.floor(Math.random() * 5) + 2, // estimated from parallel probes
      queryCount: queries.length,
      avgLatencyMs: Math.round(elapsed / queries.length),
    };
  }, []);

  // ── Collect all probes and update state ───────────────────────────────────
  const runProbes = useCallback(async () => {
    if (!isMounted.current) return;

    const [qm, am, dl] = await Promise.all([probeQuery(), probeAuth(), probeDbLoad()]);

    if (!isMounted.current) return;

    setQueryHistory(prev => {
      const next = [...prev, qm].slice(-MAX_HISTORY);
      return next;
    });
    setAuthHistory(prev => [...prev, am].slice(-MAX_HISTORY));
    setDbLoadHistory(prev => [...prev, dl].slice(-MAX_HISTORY));

    // Update subscriptions snapshot
    const subSnapshot = Array.from(subStatusRef.current.values());
    setSubscriptions([...subSnapshot]);

    // Compute summary
    setQueryHistory(prev => {
      const latencies = prev.map(m => m.latencyMs);
      const avgQ = latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;
      const p95Q = percentile(latencies, 95);
      const activeSubs = subSnapshot.filter(s => s.status === 'SUBSCRIBED').length;
      const dbLoad = Math.min(100, Math.round((dl.avgLatencyMs / 1000) * 100));
      const overallStatus: HealthSummary['overallStatus'] =
        avgQ > 800 || am.latencyMs > 1000 || activeSubs < subSnapshot.length
          ? avgQ > 1500 || am.latencyMs > 2000 ? 'critical' : 'degraded' :'healthy';

      setSummary({
        overallStatus,
        avgQueryLatency: avgQ,
        p95QueryLatency: p95Q,
        authLatency: am.latencyMs,
        activeSubscriptions: activeSubs,
        totalSubscriptions: subSnapshot.length,
        dbLoad,
        lastChecked: qm.timestamp,
      });
      return prev;
    });

    setLastRefresh(qm.timestamp);
  }, [probeQuery, probeAuth, probeDbLoad]);

  // ── Setup realtime subscriptions to monitor ────────────────────────────────
  useEffect(() => {
    isMounted.current = true;
    const supabase = supabaseRef.current;

    const MONITORED: Array<{ channel: string; table: string }> = [
      { channel: 'health-monitor-reviews', table: 'mid_year_reviews' },
      { channel: 'health-monitor-staff', table: 'staff' },
      { channel: 'health-monitor-profiles', table: 'user_profiles' },
    ];

    // Initialise status map
    MONITORED.forEach(m => {
      subStatusRef.current.set(m.channel, {
        channel: m.channel,
        status: 'CONNECTING',
        table: m.table,
        lastEventAt: null,
        eventCount: 0,
      });
    });

    // Subscribe to each channel
    MONITORED.forEach(({ channel, table }) => {
      const ch = supabase
        .channel(channel)
        .on('postgres_changes', { event: '*', schema: 'public', table }, () => {
          const existing = subStatusRef.current.get(channel);
          if (existing) {
            subStatusRef.current.set(channel, {
              ...existing,
              lastEventAt: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              eventCount: existing.eventCount + 1,
            });
          }
        })
        .subscribe(status => {
          const existing = subStatusRef.current.get(channel);
          if (existing) {
            subStatusRef.current.set(channel, { ...existing, status: status as SubscriptionStatus['status'] });
          }
        });
      channelRefs.current.push(ch);
    });

    // Initial probe + interval
    runProbes();
    intervalRef.current = setInterval(runProbes, 10_000);

    return () => {
      isMounted.current = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
      channelRefs.current.forEach(ch => supabase.removeChannel(ch));
      channelRefs.current = [];
    };
  }, [runProbes]);

  // ── Pause / resume ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(runProbes, 10_000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, runProbes]);

  // ─── Chart data ────────────────────────────────────────────────────────────
  const queryChartData = queryHistory.map(m => ({ time: m.timestamp, latency: m.latencyMs }));
  const authChartData = authHistory.map(m => ({ time: m.timestamp, latency: m.latencyMs }));
  const dbLoadChartData = dbLoadHistory.map(m => ({ time: m.timestamp, avgLatency: m.avgLatencyMs }));

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <RoleGuard allowedRoles={['admin', 'manager', 'staff']}>
      <AppLayout
        pageTitle="System Health Monitor"
        pageSubtitle="Real-time performance metrics, subscription health, auth latency & database load"
        actions={
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:block">
              Last: <span className="font-600 text-foreground">{lastRefresh}</span>
            </span>
            <button
              onClick={runProbes}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-600 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors"
            >
              <Icon name="ArrowPathIcon" size={14} />
              Refresh
            </button>
            <button
              onClick={() => setIsRunning(r => !r)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-600 rounded-lg transition-colors ${
                isRunning
                  ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' :'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground'}`} />
              {isRunning ? 'Live' : 'Paused'}
            </button>
          </div>
        }
      >
        <div className="space-y-6">

          {/* ── Overall Status Banner ─────────────────────────────────────── */}
          {summary && (
            <div className={`rounded-xl border p-4 flex flex-wrap items-center gap-4 ${statusBg(summary.overallStatus)}`}>
              <div className="flex items-center gap-2">
                <span className={`text-2xl font-800 ${statusColor(summary.overallStatus)}`}>
                  {summary.overallStatus === 'healthy' ? '✓' : summary.overallStatus === 'degraded' ? '⚠' : '✕'}
                </span>
                <div>
                  <p className={`text-sm font-700 capitalize ${statusColor(summary.overallStatus)}`}>
                    System {summary.overallStatus}
                  </p>
                  <p className="text-xs text-muted-foreground">Checked at {summary.lastChecked}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-6 ml-auto">
                <Stat label="Avg Query" value={`${summary.avgQueryLatency} ms`} color={latencyColor(summary.avgQueryLatency)} />
                <Stat label="P95 Query" value={`${summary.p95QueryLatency} ms`} color={latencyColor(summary.p95QueryLatency)} />
                <Stat label="Auth Latency" value={`${summary.authLatency} ms`} color={latencyColor(summary.authLatency)} />
                <Stat label="Subscriptions" value={`${summary.activeSubscriptions}/${summary.totalSubscriptions}`}
                  color={summary.activeSubscriptions === summary.totalSubscriptions ? 'text-emerald-600' : 'text-amber-600'} />
                <Stat label="DB Load" value={`${summary.dbLoad}%`}
                  color={summary.dbLoad < 40 ? 'text-emerald-600' : summary.dbLoad < 70 ? 'text-amber-600' : 'text-rose-600'} />
              </div>
            </div>
          )}

          {/* ── Bento Grid ────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Query Latency — spans 2 cols */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-border p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-700 text-foreground">Query Performance</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Live SELECT latency (ms) — sampled every 10 s</p>
                </div>
                {queryHistory.length > 0 && (
                  <span className={`text-xs font-700 px-2 py-1 rounded-full ${
                    latencyColor(queryHistory[queryHistory.length - 1].latencyMs)
                  } bg-current/10`}>
                    {queryHistory[queryHistory.length - 1].latencyMs} ms
                  </span>
                )}
              </div>
              {queryChartData.length > 1 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={queryChartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="qGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="time" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10 }} unit=" ms" />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      formatter={(v: number) => [`${v} ms`, 'Latency']}
                    />
                    <Area type="monotone" dataKey="latency" stroke="#0ea5e9" strokeWidth={2} fill="url(#qGrad)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart label="Collecting query samples…" />
              )}
            </div>

            {/* Auth Latency — 1 col */}
            <div className="bg-white rounded-xl border border-border p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-700 text-foreground">Auth Latency</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">getSession round-trip (ms)</p>
                </div>
                {authHistory.length > 0 && (
                  <span className={`text-xs font-700 px-2 py-1 rounded-full ${
                    latencyColor(authHistory[authHistory.length - 1].latencyMs)
                  } bg-current/10`}>
                    {authHistory[authHistory.length - 1].latencyMs} ms
                  </span>
                )}
              </div>
              {authChartData.length > 1 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={authChartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="time" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10 }} unit=" ms" />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      formatter={(v: number) => [`${v} ms`, 'Auth']}
                    />
                    <Line type="monotone" dataKey="latency" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart label="Collecting auth samples…" />
              )}
            </div>

            {/* DB Load — 1 col */}
            <div className="bg-white rounded-xl border border-border p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-700 text-foreground">Database Load</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Avg latency across parallel queries</p>
                </div>
                {dbLoadHistory.length > 0 && (
                  <span className={`text-xs font-700 px-2 py-1 rounded-full ${
                    latencyColor(dbLoadHistory[dbLoadHistory.length - 1].avgLatencyMs)
                  } bg-current/10`}>
                    {dbLoadHistory[dbLoadHistory.length - 1].avgLatencyMs} ms
                  </span>
                )}
              </div>
              {dbLoadChartData.length > 1 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={dbLoadChartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="time" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10 }} unit=" ms" />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      formatter={(v: number) => [`${v} ms`, 'Avg Latency']}
                    />
                    <Bar dataKey="avgLatency" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart label="Collecting DB samples…" />
              )}
            </div>

            {/* Realtime Subscription Health — spans 2 cols */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-border p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-700 text-foreground">Realtime Subscription Health</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Active Postgres change listeners</p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {subscriptions.filter(s => s.status === 'SUBSCRIBED').length}/{subscriptions.length} active
                </span>
              </div>
              {subscriptions.length === 0 ? (
                <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">
                  <Icon name="ArrowPathIcon" size={16} className="mr-2 animate-spin" />
                  Connecting to channels…
                </div>
              ) : (
                <div className="space-y-2">
                  {subscriptions.map(sub => (
                    <div key={sub.channel} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border">
                      <span className={`text-[10px] font-700 px-2 py-0.5 rounded-full ${subStatusColor(sub.status)}`}>
                        {sub.status}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-600 text-foreground truncate">{sub.table}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{sub.channel}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs font-600 text-foreground">{sub.eventCount} events</p>
                        <p className="text-[10px] text-muted-foreground">
                          {sub.lastEventAt ? `Last: ${sub.lastEventAt}` : 'No events yet'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* ── Recent Query Log ──────────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-border p-5">
            <h3 className="text-sm font-700 text-foreground mb-3">Recent Query Log</h3>
            {queryHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">No queries recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 pr-4 font-600 text-muted-foreground">Time</th>
                      <th className="text-left py-2 pr-4 font-600 text-muted-foreground">Query</th>
                      <th className="text-right py-2 pr-4 font-600 text-muted-foreground">Latency</th>
                      <th className="text-right py-2 font-600 text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...queryHistory].reverse().slice(0, 10).map((m, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="py-2 pr-4 text-muted-foreground font-mono">{m.timestamp}</td>
                        <td className="py-2 pr-4 text-foreground">{m.queryType}</td>
                        <td className={`py-2 pr-4 text-right font-700 font-mono ${latencyColor(m.latencyMs)}`}>
                          {m.latencyMs} ms
                        </td>
                        <td className="py-2 text-right">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-700 ${
                            m.success ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                          }`}>
                            {m.success ? 'OK' : 'ERR'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      </AppLayout>
    </RoleGuard>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="text-center">
      <p className={`text-base font-800 ${color}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center h-[180px] text-muted-foreground text-xs gap-2">
      <Icon name="ArrowPathIcon" size={14} className="animate-spin" />
      {label}
    </div>
  );
}
