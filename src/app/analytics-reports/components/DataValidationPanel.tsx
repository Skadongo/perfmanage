'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';

// Stable singleton — avoids re-creating the client on every render
const supabase = createClient();

interface StaffRecord {
  id: string;
  full_name: string;
  job_title: string;
  system_role: string | null;
  supervisor_id: string | null;
  supervisor_name: string | null;
  department_id: string | null;
  employment_status: string | null;
}

interface Department {
  id: string;
  name: string;
}

interface ValidationIssue {
  staffId: string;
  staffName: string;
  jobTitle: string;
  issue: string;
  severity: 'critical' | 'warning' | 'info';
}

interface ValidationSummary {
  totalStaff: number;
  missingSupervisor: ValidationIssue[];
  incompleteRole: ValidationIssue[];
  orphanedDepartment: ValidationIssue[];
  missingDepartment: ValidationIssue[];
  completenessScore: number;
}

const SEVERITY_CONFIG = {
  critical: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-100 text-red-700', dot: 'bg-red-500', label: 'Critical' },
  warning: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500', label: 'Warning' },
  info: { bg: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-700', badge: 'bg-sky-100 text-sky-700', dot: 'bg-sky-500', label: 'Info' },
};

type FilterKey = 'all' | 'missingSupervisor' | 'incompleteRole' | 'orphanedDepartment' | 'missingDepartment';

export default function DataValidationPanel() {
  const [validation, setValidation] = useState<ValidationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [expandedIssue, setExpandedIssue] = useState<string | null>(null);

  const fetchValidation = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [staffRes, deptRes] = await Promise.all([
        supabase
          .from('staff')
          .select('id, full_name, job_title, system_role, supervisor_id, supervisor_name, department_id, employment_status')
          .eq('employment_status', 'active'),
        supabase.from('departments').select('id, name'),
      ]);

      if (staffRes.error) throw staffRes.error;
      if (deptRes.error) throw deptRes.error;

      const staffList: StaffRecord[] = staffRes.data || [];
      const departments: Department[] = deptRes.data || [];
      const deptIds = new Set(departments.map((d) => d.id));

      const missingSupervisor: ValidationIssue[] = [];
      const incompleteRole: ValidationIssue[] = [];
      const orphanedDepartment: ValidationIssue[] = [];
      const missingDepartment: ValidationIssue[] = [];

      staffList.forEach((s) => {
        if (!s.supervisor_id && !s.supervisor_name) {
          missingSupervisor.push({
            staffId: s.id,
            staffName: s.full_name,
            jobTitle: s.job_title,
            issue: 'No supervisor assigned',
            severity: 'critical',
          });
        }
        if (!s.system_role) {
          incompleteRole.push({
            staffId: s.id,
            staffName: s.full_name,
            jobTitle: s.job_title,
            issue: 'System role not assigned',
            severity: 'critical',
          });
        }
        if (!s.department_id) {
          missingDepartment.push({
            staffId: s.id,
            staffName: s.full_name,
            jobTitle: s.job_title,
            issue: 'No department assigned',
            severity: 'warning',
          });
        } else if (!deptIds.has(s.department_id)) {
          orphanedDepartment.push({
            staffId: s.id,
            staffName: s.full_name,
            jobTitle: s.job_title,
            issue: `Department ID references a non-existent department`,
            severity: 'critical',
          });
        }
      });

      const totalStaff = staffList.length;
      const totalIssues =
        missingSupervisor.length + incompleteRole.length + orphanedDepartment.length + missingDepartment.length;
      const maxPossibleIssues = totalStaff * 4;
      const completenessScore =
        totalStaff === 0 ? 100 : Math.round(((maxPossibleIssues - totalIssues) / maxPossibleIssues) * 100);

      setValidation({
        totalStaff,
        missingSupervisor,
        incompleteRole,
        orphanedDepartment,
        missingDepartment,
        completenessScore,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load validation data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchValidation();
  }, [fetchValidation]);

  const getFilteredIssues = (): ValidationIssue[] => {
    if (!validation) return [];
    switch (activeFilter) {
      case 'missingSupervisor': return validation.missingSupervisor;
      case 'incompleteRole': return validation.incompleteRole;
      case 'orphanedDepartment': return validation.orphanedDepartment;
      case 'missingDepartment': return validation.missingDepartment;
      default:
        return [
          ...validation.missingSupervisor,
          ...validation.incompleteRole,
          ...validation.orphanedDepartment,
          ...validation.missingDepartment,
        ];
    }
  };

  const scoreColor =
    !validation ? 'text-muted-foreground'
    : validation.completenessScore >= 90 ? 'text-emerald-700'
    : validation.completenessScore >= 70 ? 'text-amber-700' :'text-red-700';

  const scoreBarColor =
    !validation ? 'bg-muted'
    : validation.completenessScore >= 90 ? 'bg-emerald-500'
    : validation.completenessScore >= 70 ? 'bg-amber-400' :'bg-red-500';

  const filters: { key: FilterKey; label: string; count: number; icon: string }[] = validation
    ? [
        { key: 'all', label: 'All Issues', count: validation.missingSupervisor.length + validation.incompleteRole.length + validation.orphanedDepartment.length + validation.missingDepartment.length, icon: 'EcsaWarningIcon' },
        { key: 'missingSupervisor', label: 'Missing Supervisors', count: validation.missingSupervisor.length, icon: 'EcsaStaffIcon' },
        { key: 'incompleteRole', label: 'Incomplete Roles', count: validation.incompleteRole.length, icon: 'EcsaPermissionsIcon' },
        { key: 'orphanedDepartment', label: 'Orphaned Records', count: validation.orphanedDepartment.length, icon: 'EcsaClusterIcon' },
        { key: 'missingDepartment', label: 'Dept. Assignments', count: validation.missingDepartment.length, icon: 'EcsaDirectorateIcon' },
      ]
    : [];

  const filteredIssues = getFilteredIssues();

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white rounded-xl border border-border shadow-card p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-sm font-700 text-foreground">Staff Setup Completeness</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Live validation of supervisor assignments, role configurations, and department mappings
            </p>
          </div>
          <button
            onClick={fetchValidation}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs font-600 text-primary border border-primary/30 px-3 py-1.5 rounded-lg hover:bg-primary/5 transition-colors disabled:opacity-50"
          >
            <Icon name="EcsaRefreshIcon" size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-24">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
            <Icon name="EcsaWarningIcon" size={16} className="text-red-600 flex-shrink-0" />
            <p className="text-xs text-red-700">{error}</p>
          </div>
        ) : validation ? (
          <>
            {/* Score + summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
              {/* Completeness score */}
              <div className="col-span-2 sm:col-span-1 bg-muted/30 rounded-lg p-3 flex flex-col items-center justify-center border border-border">
                <p className="text-[10px] font-600 uppercase tracking-wider text-muted-foreground mb-1">Setup Score</p>
                <p className={`text-2xl font-700 tabular-nums font-mono ${scoreColor}`}>
                  {validation.completenessScore}%
                </p>
                <div className="w-full bg-muted rounded-full h-1.5 mt-2">
                  <div
                    className={`h-1.5 rounded-full transition-all ${scoreBarColor}`}
                    style={{ width: `${validation.completenessScore}%` }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">{validation.totalStaff} active staff</p>
              </div>

              {/* Issue cards */}
              {[
                { label: 'Missing Supervisors', count: validation.missingSupervisor.length, icon: 'EcsaStaffIcon', severity: 'critical' as const },
                { label: 'Incomplete Roles', count: validation.incompleteRole.length, icon: 'EcsaPermissionsIcon', severity: 'critical' as const },
                { label: 'Orphaned Records', count: validation.orphanedDepartment.length, icon: 'EcsaClusterIcon', severity: 'critical' as const },
                { label: 'Dept. Assignments', count: validation.missingDepartment.length, icon: 'EcsaDirectorateIcon', severity: 'warning' as const },
              ].map((card) => {
                const cfg = SEVERITY_CONFIG[card.count > 0 ? card.severity : 'info'];
                return (
                  <div
                    key={card.label}
                    className={`rounded-lg p-3 border ${card.count > 0 ? `${cfg.bg} ${cfg.border}` : 'bg-emerald-50 border-emerald-200'}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Icon
                        name={card.icon as Parameters<typeof Icon>[0]['name']}
                        size={14}
                        className={card.count > 0 ? cfg.text : 'text-emerald-600'}
                      />
                      <p className="text-[10px] font-600 uppercase tracking-wider text-muted-foreground leading-tight">{card.label}</p>
                    </div>
                    <p className={`text-xl font-700 tabular-nums font-mono ${card.count > 0 ? cfg.text : 'text-emerald-700'}`}>
                      {card.count}
                    </p>
                    <p className="text-[10px] mt-0.5 text-muted-foreground">
                      {card.count === 0 ? '✓ All clear' : `staff affected`}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Filter pills */}
            <div className="flex flex-wrap gap-2 mb-4">
              {filters.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setActiveFilter(f.key)}
                  className={`flex items-center gap-1.5 text-xs font-600 px-3 py-1.5 rounded-full border transition-colors ${
                    activeFilter === f.key
                      ? 'bg-primary text-white border-primary' :'bg-white text-muted-foreground border-border hover:border-primary/40 hover:text-foreground'
                  }`}
                >
                  <Icon name={f.icon as Parameters<typeof Icon>[0]['name']} size={12} />
                  {f.label}
                  <span
                    className={`ml-0.5 text-[10px] font-700 px-1.5 py-0.5 rounded-full ${
                      activeFilter === f.key
                        ? 'bg-white/20 text-white'
                        : f.count > 0
                        ? 'bg-red-100 text-red-700' :'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {f.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Issue list */}
            {filteredIssues.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
                  <Icon name="EcsaSuccessIcon" size={20} className="text-emerald-600" />
                </div>
                <p className="text-sm font-600 text-emerald-700">No issues found</p>
                <p className="text-xs text-muted-foreground">All staff records in this category are complete</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[420px] overflow-y-auto scrollbar-thin pr-1">
                {filteredIssues.map((issue, idx) => {
                  const cfg = SEVERITY_CONFIG[issue.severity];
                  const key = `${issue.staffId}-${issue.issue}`;
                  const isExpanded = expandedIssue === key;
                  return (
                    <div
                      key={`${key}-${idx}`}
                      className={`rounded-lg border ${cfg.bg} ${cfg.border} overflow-hidden`}
                    >
                      <button
                        onClick={() => setExpandedIssue(isExpanded ? null : key)}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left"
                      >
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-700 text-foreground truncate">{issue.staffName}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{issue.jobTitle}</p>
                        </div>
                        <span className={`text-[10px] font-600 px-2 py-0.5 rounded-full flex-shrink-0 ${cfg.badge}`}>
                          {cfg.label}
                        </span>
                        <Icon
                          name={isExpanded ? 'EcsaCollapseIcon' : 'EcsaExpandIcon'}
                          size={14}
                          className="text-muted-foreground flex-shrink-0"
                        />
                      </button>
                      {isExpanded && (
                        <div className={`px-4 pb-3 border-t ${cfg.border}`}>
                          <div className="pt-3 space-y-1.5">
                            <div className="flex items-start gap-2">
                              <Icon name="EcsaWarningIcon" size={13} className={`${cfg.text} flex-shrink-0 mt-0.5`} />
                              <p className={`text-xs ${cfg.text} font-500`}>{issue.issue}</p>
                            </div>
                            <p className="text-[11px] text-muted-foreground pl-5">
                              Navigate to <span className="font-600">Staff Management</span> to resolve this issue.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Footer note */}
            {filteredIssues.length > 0 && (
              <p className="text-[11px] text-muted-foreground mt-3 flex items-center gap-1.5">
                <Icon name="EcsaInfoIcon" size={12} />
                Showing {filteredIssues.length} issue{filteredIssues.length !== 1 ? 's' : ''} · Active staff only · Resolve via Staff Management
              </p>
            )}
          </>
        ) : null}
      </div>

      {/* Department coverage breakdown */}
      {validation && !loading && (
        <div className="bg-white rounded-xl border border-border shadow-card p-5">
          <h3 className="text-sm font-700 text-foreground mb-1">Validation Checklist</h3>
          <p className="text-xs text-muted-foreground mb-4">Staff setup requirements across all active records</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              {
                label: 'Supervisor Assigned',
                passed: validation.totalStaff - validation.missingSupervisor.length,
                total: validation.totalStaff,
                icon: 'EcsaStaffIcon',
                description: 'Staff with a valid supervisor linked',
              },
              {
                label: 'System Role Set',
                passed: validation.totalStaff - validation.incompleteRole.length,
                total: validation.totalStaff,
                icon: 'EcsaPermissionsIcon',
                description: 'Staff with a system role assigned',
              },
              {
                label: 'Department Assigned',
                passed: validation.totalStaff - validation.missingDepartment.length,
                total: validation.totalStaff,
                icon: 'EcsaDirectorateIcon',
                description: 'Staff mapped to a department',
              },
              {
                label: 'Valid Dept. Reference',
                passed: validation.totalStaff - validation.orphanedDepartment.length,
                total: validation.totalStaff,
                icon: 'EcsaClusterIcon',
                description: 'Department IDs resolve to existing records',
              },
            ].map((check) => {
              const pct = check.total > 0 ? Math.round((check.passed / check.total) * 100) : 100;
              const barColor = pct === 100 ? 'bg-emerald-500' : pct >= 80 ? 'bg-amber-400' : 'bg-red-500';
              const textColor = pct === 100 ? 'text-emerald-700' : pct >= 80 ? 'text-amber-700' : 'text-red-700';
              return (
                <div key={check.label} className="p-3 border border-border rounded-lg">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <Icon name={check.icon as Parameters<typeof Icon>[0]['name']} size={14} className="text-muted-foreground" />
                      <p className="text-xs font-700 text-foreground">{check.label}</p>
                    </div>
                    <span className={`text-xs font-700 tabular-nums font-mono ${textColor}`}>
                      {check.passed}/{check.total}
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5 mb-1.5">
                    <div className={`h-1.5 rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-[10px] text-muted-foreground">{check.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
