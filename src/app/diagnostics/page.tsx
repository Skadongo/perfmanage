'use client';

import React, { useState, useEffect, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Finding {
  rule: string;
  category: string;
  severity: 'error' | 'warning';
  line: number;
  col: number;
  snippet: string;
  message: string;
}

interface ScanSummary {
  totalErrors: number;
  totalWarnings: number;
  filesAffected: number;
  filesScanned: number;
  scannedAt: string;
}

interface ScanResult {
  summary: ScanSummary;
  results: Record<string, Finding[]>;
}

type FilterSeverity = 'all' | 'error' | 'warning';
type FilterCategory = 'all' | 'Dynamic Dates' | 'Locale Formatting' | 'Random Values' | 'Browser APIs';

const CATEGORY_COLORS: Record<string, string> = {
  'Dynamic Dates': 'bg-orange-100 text-orange-700 border-orange-200',
  'Locale Formatting': 'bg-purple-100 text-purple-700 border-purple-200',
  'Random Values': 'bg-blue-100 text-blue-700 border-blue-200',
  'Browser APIs': 'bg-rose-100 text-rose-700 border-rose-200',
};

const CATEGORY_ICONS: Record<string, string> = {
  'Dynamic Dates': 'CalendarDaysIcon',
  'Locale Formatting': 'GlobeAltIcon',
  'Random Values': 'CpuChipIcon',
  'Browser APIs': 'ComputerDesktopIcon',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatScannedAt(iso: string): string {
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`;
  } catch {
    return iso;
  }
}

function getScreenName(filePath: string): string {
  const parts = filePath.replace(/\\/g, '/').split('/');
  const appIdx = parts.indexOf('app');
  if (appIdx !== -1 && parts[appIdx + 1]) {
    return parts[appIdx + 1];
  }
  return parts[parts.length - 1];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white border border-border rounded-xl p-4 flex flex-col gap-1">
      <span className={`text-2xl font-700 tabular-nums ${color}`}>{value}</span>
      <span className="text-xs text-muted-foreground font-500">{label}</span>
    </div>
  );
}

function FindingRow({ finding }: { finding: Finding }) {
  const isError = finding.severity === 'error';
  return (
    <div className={`flex gap-3 py-2.5 px-3 rounded-lg border ${isError ? 'bg-red-50/60 border-red-100' : 'bg-amber-50/60 border-amber-100'}`}>
      <div className="flex-shrink-0 mt-0.5">
        {isError
          ? <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-100"><Icon name="XMarkIcon" size={12} className="text-red-600" /></span>
          : <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100"><Icon name="ExclamationTriangleIcon" size={12} className="text-amber-600" /></span>
        }
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className={`text-[10px] font-700 uppercase tracking-wide px-1.5 py-0.5 rounded border ${CATEGORY_COLORS[finding.category] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
            {finding.category}
          </span>
          <span className={`text-[10px] font-600 px-1.5 py-0.5 rounded ${isError ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
            {finding.severity}
          </span>
          <span className="text-[10px] font-500 text-muted-foreground font-mono">
            Line {finding.line}:{finding.col}
          </span>
          <span className="text-[10px] font-500 text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
            {finding.rule}
          </span>
        </div>
        <p className="text-xs text-foreground font-500 mb-1">{finding.message}</p>
        <code className="block text-[11px] font-mono text-muted-foreground bg-white/80 border border-border rounded px-2 py-1 truncate">
          {finding.snippet}
        </code>
      </div>
    </div>
  );
}

function FileBlock({ filePath, findings, filterSeverity, filterCategory }: {
  filePath: string;
  findings: Finding[];
  filterSeverity: FilterSeverity;
  filterCategory: FilterCategory;
}) {
  const [expanded, setExpanded] = useState(true);

  const filtered = findings.filter(f => {
    if (filterSeverity !== 'all' && f.severity !== filterSeverity) return false;
    if (filterCategory !== 'all' && f.category !== filterCategory) return false;
    return true;
  });

  if (filtered.length === 0) return null;

  const errorCount = filtered.filter(f => f.severity === 'error').length;
  const warnCount = filtered.filter(f => f.severity === 'warning').length;
  const screenName = getScreenName(filePath);

  return (
    <div className="bg-white border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors text-left"
      >
        <Icon name="DocumentTextIcon" size={16} className="text-muted-foreground flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-600 text-foreground truncate">{filePath}</p>
          <p className="text-[11px] text-muted-foreground capitalize">{screenName.replace(/-/g, ' ')}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {errorCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] font-600 text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full">
              <Icon name="XMarkIcon" size={10} /> {errorCount}
            </span>
          )}
          {warnCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] font-600 text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full">
              <Icon name="ExclamationTriangleIcon" size={10} /> {warnCount}
            </span>
          )}
          <Icon name={expanded ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={14} className="text-muted-foreground" />
        </div>
      </button>
      {expanded && (
        <div className="px-4 pb-4 flex flex-col gap-2 border-t border-border pt-3">
          {filtered.map((f, idx) => (
            <FindingRow key={`${f.rule}-${f.line}-${idx}`} finding={f} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DiagnosticsPage() {
  const { profile, loading: authLoading } = useAuth();
  const router = useRouter();

  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<FilterSeverity>('all');
  const [filterCategory, setFilterCategory] = useState<FilterCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Access guard — superuser only
  useEffect(() => {
    if (!authLoading && profile && profile.systemRole !== 'superuser') {
      router.replace('/performance-dashboard');
    }
  }, [authLoading, profile, router]);

  const runScan = useCallback(async () => {
    setScanning(true);
    setError(null);
    try {
      const res = await fetch('/api/diagnostics/hydration');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `HTTP ${res.status}`);
      }
      const data: ScanResult = await res.json();
      setScanResult(data);
    } catch (err: any) {
      setError(err?.message || 'Scan failed');
    } finally {
      setScanning(false);
    }
  }, []);

  // Show nothing while auth is loading or if not superuser
  if (authLoading) {
    return (
      <AppLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (!profile || profile.systemRole !== 'superuser') {
    return null;
  }

  // ── Derived data ────────────────────────────────────────────────────────────
  const allFiles = scanResult ? Object.keys(scanResult.results) : [];

  const filteredFiles = allFiles.filter(fp => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return fp.toLowerCase().includes(q) ||
      scanResult!.results[fp].some(f =>
        f.rule.includes(q) || f.category.toLowerCase().includes(q) || f.message.toLowerCase().includes(q)
      );
  });

  const categoryBreakdown: Record<string, { errors: number; warnings: number }> = {};
  if (scanResult) {
    for (const findings of Object.values(scanResult.results)) {
      for (const f of findings) {
        if (!categoryBreakdown[f.category]) categoryBreakdown[f.category] = { errors: 0, warnings: 0 };
        if (f.severity === 'error') categoryBreakdown[f.category].errors++;
        else categoryBreakdown[f.category].warnings++;
      }
    }
  }

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Icon name="BugAntIcon" size={18} className="text-primary" />
              </div>
              <h1 className="text-xl font-700 text-foreground">SSR Diagnostics</h1>
              <span className="text-[10px] font-700 uppercase tracking-widest bg-primary/10 text-primary px-2 py-0.5 rounded-full">Superuser</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Static analysis for hydration trigger violations across all screens
            </p>
          </div>
          <button
            onClick={runScan}
            disabled={scanning}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-600 hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex-shrink-0"
          >
            {scanning
              ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Scanning…</>
              : <><Icon name="MagnifyingGlassIcon" size={16} /> Run Scan</>
            }
          </button>
        </div>

        {/* Error state */}
        {error && (
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
            <Icon name="ExclamationCircleIcon" size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-600 text-red-700">Scan failed</p>
              <p className="text-xs text-red-600 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!scanResult && !scanning && !error && (
          <div className="bg-white border border-border rounded-xl p-12 flex flex-col items-center gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
              <Icon name="BugAntIcon" size={32} className="text-muted-foreground" />
            </div>
            <div>
              <p className="text-base font-600 text-foreground mb-1">No scan results yet</p>
              <p className="text-sm text-muted-foreground max-w-sm">
                Click <strong>Run Scan</strong> to analyse all TypeScript/TSX files under <code className="font-mono text-xs bg-muted px-1 rounded">src/</code> for SSR hydration trigger violations.
              </p>
            </div>
            <button
              onClick={runScan}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-600 hover:bg-primary/90 transition-colors"
            >
              <Icon name="MagnifyingGlassIcon" size={16} /> Run First Scan
            </button>
          </div>
        )}

        {/* Scanning skeleton */}
        {scanning && (
          <div className="bg-white border border-border rounded-xl p-8 flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-600 text-foreground">Scanning source files…</p>
            <p className="text-xs text-muted-foreground">Checking all .ts / .tsx files under src/ for hydration triggers</p>
          </div>
        )}

        {/* Results */}
        {scanResult && !scanning && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <SummaryCard label="Errors" value={scanResult.summary.totalErrors} color="text-red-600" />
              <SummaryCard label="Warnings" value={scanResult.summary.totalWarnings} color="text-amber-600" />
              <SummaryCard label="Files Affected" value={scanResult.summary.filesAffected} color="text-foreground" />
              <SummaryCard label="Files Scanned" value={scanResult.summary.filesScanned} color="text-muted-foreground" />
            </div>

            {/* Scan meta */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Icon name="ClockIcon" size={12} />
                Scanned at {formatScannedAt(scanResult.summary.scannedAt)}
              </span>
              <span className="flex items-center gap-1">
                <Icon name="FolderIcon" size={12} />
                Scope: <code className="font-mono bg-muted px-1 rounded">src/</code>
              </span>
            </div>

            {/* All-clear */}
            {scanResult.summary.filesAffected === 0 && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <Icon name="CheckCircleIcon" size={22} className="text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-700 text-emerald-700">No hydration triggers found</p>
                  <p className="text-xs text-emerald-600 mt-0.5">All {scanResult.summary.filesScanned} scanned files are clean.</p>
                </div>
              </div>
            )}

            {/* Category breakdown */}
            {Object.keys(categoryBreakdown).length > 0 && (
              <div className="bg-white border border-border rounded-xl p-4">
                <p className="text-xs font-700 uppercase tracking-widest text-muted-foreground mb-3">Breakdown by Category</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {Object.entries(categoryBreakdown).map(([cat, counts]) => (
                    <button
                      key={cat}
                      onClick={() => setFilterCategory(filterCategory === cat ? 'all' : cat as FilterCategory)}
                      className={`flex flex-col gap-1.5 p-3 rounded-lg border transition-all text-left ${
                        filterCategory === cat
                          ? 'border-primary bg-primary/5 ring-1 ring-primary/20' :'border-border hover:border-primary/30 hover:bg-muted/40'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <Icon name={CATEGORY_ICONS[cat] as any || 'CpuChipIcon'} size={14} className="text-muted-foreground" />
                        <span className="text-[11px] font-600 text-foreground">{cat}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {counts.errors > 0 && <span className="text-[11px] font-700 text-red-600">{counts.errors}E</span>}
                        {counts.warnings > 0 && <span className="text-[11px] font-700 text-amber-600">{counts.warnings}W</span>}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Filters */}
            {scanResult.summary.filesAffected > 0 && (
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Icon name="MagnifyingGlassIcon" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search files, rules, or messages…"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
                <div className="flex gap-2">
                  {(['all', 'error', 'warning'] as FilterSeverity[]).map(s => (
                    <button
                      key={s}
                      onClick={() => setFilterSeverity(s)}
                      className={`px-3 py-2 text-xs font-600 rounded-lg border transition-colors capitalize ${
                        filterSeverity === s
                          ? 'bg-primary text-white border-primary' :'bg-white text-muted-foreground border-border hover:border-primary/40'
                      }`}
                    >
                      {s === 'all' ? 'All' : s === 'error' ? '✖ Errors' : '⚠ Warnings'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* File list */}
            {filteredFiles.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground font-500">
                  Showing {filteredFiles.length} of {allFiles.length} affected file{allFiles.length !== 1 ? 's' : ''}
                  {filterCategory !== 'all' && <> · filtered by <strong>{filterCategory}</strong></>}
                  {filterSeverity !== 'all' && <> · {filterSeverity}s only</>}
                </p>
                {filteredFiles.map(fp => (
                  <FileBlock
                    key={fp}
                    filePath={fp}
                    findings={scanResult.results[fp]}
                    filterSeverity={filterSeverity}
                    filterCategory={filterCategory}
                  />
                ))}
              </div>
            )}

            {filteredFiles.length === 0 && allFiles.length > 0 && (
              <div className="bg-white border border-border rounded-xl p-8 text-center">
                <p className="text-sm text-muted-foreground">No results match the current filters.</p>
                <button
                  onClick={() => { setFilterSeverity('all'); setFilterCategory('all'); setSearchQuery(''); }}
                  className="mt-3 text-xs text-primary font-600 hover:underline"
                >
                  Clear filters
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
