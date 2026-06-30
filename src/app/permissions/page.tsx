'use client';

import React, { useState, useEffect, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import RoleGuard from '@/components/RoleGuard';

// ─── Types ────────────────────────────────────────────────────────────────────

type StaffRole =
  | 'executive_director' |'deputy_director' |'programme_manager' |'finance_manager' |'hr_admin_officer' |'programme_officer' |'finance_officer' |'admin_officer' |'project_coordinator';

interface RolePermission {
  id: string;
  role_name: StaffRole;
  screen_name: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_approve: boolean;
  updated_at: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<StaffRole, { label: string; color: string; bg: string; icon: string; description: string }> = {
  executive_director:  { label: 'Director General',  color: 'text-violet-700',  bg: 'bg-violet-50 border-violet-200',  icon: 'BuildingOffice2Icon',         description: 'Full system access and final approval authority' },
  deputy_director:     { label: 'Director of Operations and Institutional Development',     color: 'text-indigo-700',  bg: 'bg-indigo-50 border-indigo-200',  icon: 'UserCircleIcon',              description: 'Broad access with approval rights for reviews' },
  programme_manager:   { label: 'Programme Manager',   color: 'text-sky-700',     bg: 'bg-sky-50 border-sky-200',        icon: 'HeartIcon',                   description: 'Manages programme staff and approves their reviews' },
  finance_manager:     { label: 'Finance Manager',     color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200',icon: 'BanknotesIcon',               description: 'Manages finance team and approves their reviews' },
  hr_admin_officer:    { label: 'HR & Admin Officer',  color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200',    icon: 'UsersIcon',                   description: 'Manages staff records and system permissions' },
  programme_officer:   { label: 'Programme Officer',   color: 'text-blue-700',    bg: 'bg-blue-50 border-blue-200',      icon: 'ClipboardDocumentCheckIcon',  description: 'Submits own reviews, views programme content' },
  finance_officer:     { label: 'Finance Officer',     color: 'text-teal-700',    bg: 'bg-teal-50 border-teal-200',      icon: 'CalculatorIcon',              description: 'Submits own reviews, limited screen access' },
  admin_officer:       { label: 'Admin Officer',       color: 'text-orange-700',  bg: 'bg-orange-50 border-orange-200',  icon: 'Cog6ToothIcon',               description: 'Submits own reviews, limited screen access' },
  project_coordinator: { label: 'Project Coordinator', color: 'text-rose-700',    bg: 'bg-rose-50 border-rose-200',      icon: 'FolderOpenIcon',              description: 'Submits own reviews, views project content' },
};

const SCREENS = [
  { key: 'performance-dashboard', label: 'Performance Dashboard', icon: 'ChartBarIcon' },
  { key: 'evaluation-reviews',    label: 'Evaluation & Reviews',  icon: 'ClipboardDocumentCheckIcon' },
  { key: 'mid-year-reviews',      label: 'Mid-Year Reviews',      icon: 'ClipboardDocumentListIcon' },
  { key: 'feedback-mentorship',   label: 'Feedback & Mentorship', icon: 'ChatBubbleLeftRightIcon' },
  { key: 'training-resources',    label: 'Training & Resources',  icon: 'AcademicCapIcon' },
  { key: 'staff-management',      label: 'Staff Management',      icon: 'UsersIcon' },
  { key: 'analytics-reports',     label: 'Analytics & Reports',   icon: 'PresentationChartLineIcon' },
  { key: 'permissions',           label: 'Permissions',           icon: 'ShieldCheckIcon' },
];

const PERMISSION_KEYS: Array<keyof Pick<RolePermission, 'can_view' | 'can_create' | 'can_edit' | 'can_delete' | 'can_approve'>> = [
  'can_view', 'can_create', 'can_edit', 'can_delete', 'can_approve',
];

const PERM_LABELS: Record<string, string> = {
  can_view: 'View', can_create: 'Create', can_edit: 'Edit', can_delete: 'Delete', can_approve: 'Approve',
};

const PERM_COLORS: Record<string, string> = {
  can_view: 'text-blue-600', can_create: 'text-emerald-600', can_edit: 'text-amber-600', can_delete: 'text-rose-600', can_approve: 'text-violet-600',
};

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-500
      ${type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
      <Icon name={type === 'success' ? 'CheckCircleIcon' : 'ExclamationCircleIcon'} size={18} />
      {message}
      <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100"><Icon name="XMarkIcon" size={14} /></button>
    </div>
  );
}

// ─── Permission Toggle ────────────────────────────────────────────────────────

function PermToggle({
  value, onChange, permKey, disabled,
}: { value: boolean; onChange: (v: boolean) => void; permKey: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!value)}
      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all border
        ${value
          ? `${PERM_COLORS[permKey]} bg-white border-current/30 shadow-sm`
          : 'text-slate-300 bg-slate-50 border-slate-200 hover:border-slate-300'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-105'}`}
      title={`${value ? 'Revoke' : 'Grant'} ${PERM_LABELS[permKey]}`}
    >
      <Icon name={value ? 'CheckIcon' : 'MinusIcon'} size={14} />
    </button>
  );
}

// ─── Role Card ────────────────────────────────────────────────────────────────

interface RoleCardProps {
  role: StaffRole;
  permissions: RolePermission[];
  onToggle: (role: StaffRole, screen: string, perm: string, value: boolean) => void;
  saving: boolean;
}

function RoleCard({ role, permissions, onToggle, saving }: RoleCardProps) {
  const cfg = ROLE_CONFIG[role];
  const [expanded, setExpanded] = useState(false);

  const permMap = permissions.reduce((acc, p) => {
    acc[p.screen_name] = p;
    return acc;
  }, {} as Record<string, RolePermission>);

  const totalGranted = permissions.reduce((sum, p) =>
    sum + PERMISSION_KEYS.filter(k => p[k]).length, 0
  );
  const totalPossible = SCREENS.length * PERMISSION_KEYS.length;

  return (
    <div className={`rounded-xl border ${cfg.bg} overflow-hidden`}>
      {/* Role Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:opacity-90 transition-opacity"
      >
        <div className={`p-2.5 rounded-xl bg-white/70 ${cfg.color}`}>
          <Icon name={cfg.icon as Parameters<typeof Icon>[0]['name']} size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`font-700 text-sm ${cfg.color}`}>{cfg.label}</p>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{cfg.description}</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-right">
            <p className={`text-sm font-700 ${cfg.color}`}>{totalGranted}</p>
            <p className="text-[10px] text-muted-foreground">of {totalPossible} perms</p>
          </div>
          {/* Mini permission summary */}
          <div className="hidden sm:flex gap-1">
            {PERMISSION_KEYS.map(k => {
              const count = permissions.filter(p => p[k]).length;
              return (
                <div key={k} className="text-center" title={`${PERM_LABELS[k]}: ${count}/${SCREENS.length} screens`}>
                  <div className={`w-6 h-6 rounded flex items-center justify-center text-[9px] font-700
                    ${count === SCREENS.length ? 'bg-white/80 ' + PERM_COLORS[k] : count > 0 ? 'bg-white/50 text-muted-foreground' : 'bg-white/20 text-slate-300'}`}>
                    {count}
                  </div>
                </div>
              );
            })}
          </div>
          <Icon name={expanded ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={16} className="text-muted-foreground" />
        </div>
      </button>

      {/* Expanded Permission Grid */}
      {expanded && (
        <div className="border-t border-white/50 bg-white/60 px-5 py-4">
          {/* Header row */}
          <div className="grid gap-2 mb-3" style={{ gridTemplateColumns: '1fr repeat(5, 2rem)' }}>
            <p className="text-[10px] font-700 uppercase tracking-wider text-muted-foreground">Screen</p>
            {PERMISSION_KEYS.map(k => (
              <p key={k} className={`text-[10px] font-700 uppercase tracking-wider text-center ${PERM_COLORS[k]}`}>
                {PERM_LABELS[k][0]}
              </p>
            ))}
          </div>
          {/* Screen rows */}
          <div className="space-y-2">
            {SCREENS.map(screen => {
              const perm = permMap[screen.key];
              return (
                <div key={screen.key} className="grid gap-2 items-center py-1.5 px-2 rounded-lg hover:bg-white/50 transition-colors" style={{ gridTemplateColumns: '1fr repeat(5, 2rem)' }}>
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon name={screen.icon as Parameters<typeof Icon>[0]['name']} size={13} className="text-muted-foreground flex-shrink-0" />
                    <span className="text-xs font-500 text-foreground truncate">{screen.label}</span>
                  </div>
                  {PERMISSION_KEYS.map(k => (
                    <div key={k} className="flex justify-center">
                      {perm ? (
                        <PermToggle
                          value={perm[k]}
                          permKey={k}
                          disabled={saving}
                          onChange={(v) => onToggle(role, screen.key, k, v)}
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center">
                          <Icon name="MinusIcon" size={12} className="text-slate-300" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t border-white/50">
            {PERMISSION_KEYS.map(k => (
              <div key={k} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className={`w-3 h-3 rounded ${PERM_COLORS[k]} bg-white border border-current/30`} />
                {PERM_LABELS[k]}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PermissionsPage() {
  const supabase = createClient();
  const [permissions, setPermissions] = useState<RolePermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [selectedRole, setSelectedRole] = useState<StaffRole | 'all'>('all');

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
  }, []);

  const fetchPermissions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('role_permissions')
        .select('*')
        .order('role_name')
        .order('screen_name');
      if (error) throw error;
      setPermissions((data as RolePermission[]) || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load permissions');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => { fetchPermissions(); }, [fetchPermissions]);

  const handleToggle = useCallback(async (role: StaffRole, screen: string, permKey: string, value: boolean) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('role_permissions')
        .update({ [permKey]: value, updated_at: new Date().toISOString() })
        .eq('role_name', role)
        .eq('screen_name', screen);
      if (error) throw error;

      setPermissions(prev => prev.map(p =>
        p.role_name === role && p.screen_name === screen
          ? { ...p, [permKey]: value }
          : p
      ));
      showToast(`${PERM_LABELS[permKey]} ${value ? 'granted' : 'revoked'} for ${ROLE_CONFIG[role].label}`, 'success');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to update permission', 'error');
    } finally {
      setSaving(false);
    }
  }, [supabase, showToast]);

  const roles = Object.keys(ROLE_CONFIG) as StaffRole[];
  const filteredRoles = selectedRole === 'all' ? roles : [selectedRole];

  // Summary stats
  const totalPerms = permissions.filter(p => PERMISSION_KEYS.some(k => p[k])).length;
  const totalPossible = roles.length * SCREENS.length;

  return (
    <RoleGuard
      minLevel={90}
      message="Only the Director General and the Director of Operations and Institutional Development can access this page."
    >
      <AppLayout>
        <div className="p-6 max-w-[1400px] mx-auto">
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-700 text-foreground">Role Permissions</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Configure screen access and action rights for each of the 9 staff roles</p>
            </div>
            <div className="flex items-center gap-2 px-4 py-2.5 bg-white rounded-xl border border-border text-sm">
              <Icon name="ShieldCheckIcon" size={16} className="text-primary" />
              <span className="font-600 text-foreground">{totalPerms}</span>
              <span className="text-muted-foreground">/ {totalPossible} permissions active</span>
            </div>
          </div>

          {/* Info Banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4 flex gap-3 mb-6">
            <Icon name="InformationCircleIcon" size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-600">RLS-Enforced Permissions</p>
              <p className="mt-0.5 text-blue-700">These permissions are enforced at the database level via Supabase Row Level Security policies. Changes take effect immediately across all sessions.</p>
            </div>
          </div>

          {/* Permission Legend */}
          <div className="bg-white rounded-xl border border-border px-5 py-4 mb-6">
            <p className="text-xs font-700 uppercase tracking-wider text-muted-foreground mb-3">Permission Types</p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {PERMISSION_KEYS.map(k => (
                <div key={k} className="flex items-start gap-2">
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 bg-white border ${PERM_COLORS[k]} border-current/30`}>
                    <Icon name="CheckIcon" size={12} />
                  </div>
                  <div>
                    <p className={`text-xs font-700 ${PERM_COLORS[k]}`}>{PERM_LABELS[k]}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {k === 'can_view' ? 'Access the screen' :
                       k === 'can_create' ? 'Create new records' :
                       k === 'can_edit' ? 'Modify existing records' :
                       k === 'can_delete'? 'Remove records' : 'Approve submissions'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Role Filter */}
          <div className="flex flex-wrap gap-2 mb-5">
            <button
              onClick={() => setSelectedRole('all')}
              className={`px-3 py-2 rounded-xl text-xs font-600 border transition-colors
                ${selectedRole === 'all' ? 'bg-primary text-white border-primary' : 'bg-white border-border text-muted-foreground hover:bg-muted'}`}
            >
              All Roles ({roles.length})
            </button>
            {roles.map(role => {
              const cfg = ROLE_CONFIG[role];
              return (
                <button
                  key={role}
                  onClick={() => setSelectedRole(role)}
                  className={`px-3 py-2 rounded-xl text-xs font-600 border transition-colors
                    ${selectedRole === role ? 'bg-primary text-white border-primary' : 'bg-white border-border text-muted-foreground hover:bg-muted'}`}
                >
                  {cfg.label}
                </button>
              );
            })}
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Icon name="ArrowPathIcon" size={24} className="animate-spin text-primary" />
              <span className="ml-3 text-muted-foreground">Loading permissions...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Icon name="ExclamationTriangleIcon" size={32} className="text-rose-400 mb-3" />
              <p className="text-foreground font-600">Failed to load permissions</p>
              <p className="text-sm text-muted-foreground mt-1">{error}</p>
              <button onClick={fetchPermissions} className="mt-4 px-4 py-2 bg-primary text-white rounded-lg text-sm font-600">Retry</button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRoles.map(role => (
                <RoleCard
                  key={role}
                  role={role}
                  permissions={permissions.filter(p => p.role_name === role)}
                  onToggle={handleToggle}
                  saving={saving}
                />
              ))}
            </div>
          )}
        </div>

        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </AppLayout>
    </RoleGuard>
  );
}
