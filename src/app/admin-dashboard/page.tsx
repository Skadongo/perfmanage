'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import AppLayout from '@/components/AppLayout';
import RoleGuard from '@/components/RoleGuard';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import * as XLSX from 'xlsx';
import { formatDateShort } from '@/lib/dateUtils';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'staff' | 'roles' | 'passwords' | 'bsc' | 'import';

interface AdminUser {
  user_id: string;
  email: string;
  full_name: string;
  system_role: string;
  role: string;
  department: string;
  job_title: string;
  is_active: boolean;
  must_change_password: boolean;
  staff_id: string | null;
  staff_email: string | null;
  staff_job_title: string | null;
  created_at: string;
  last_sign_in: string | null;
}

interface AuditLog {
  id: string;
  user_id: string | null;
  email: string;
  event_type: string;
  ip_address: string | null;
  success: boolean;
  failure_reason: string | null;
  created_at: string;
}

interface BSCPerspective {
  id: string;
  name: string;
  description: string;
  weight: number;
  sort_order: number;
  is_active: boolean;
  color: string;
  created_at: string;
  updated_at: string;
}

interface ImportRow {
  serial_number: string;
  full_name: string;
  job_title: string;
  department_name: string;
  supervisor_name: string;
  employment_status: string;
  bsc_perspective?: string;
  self_rating?: string;
  supervisor_rating?: string;
  _errors: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SYSTEM_ROLES = [
  { value: 'executive_director',  label: 'Director General',       userRole: 'admin' },
  { value: 'deputy_director',     label: 'Director of Operations',  userRole: 'admin' },
  { value: 'hr_admin_officer',    label: 'HR & Admin Officer',      userRole: 'admin' },
  { value: 'programme_manager',   label: 'Programme Manager',       userRole: 'manager' },
  { value: 'finance_manager',     label: 'Finance Manager',         userRole: 'manager' },
  { value: 'programme_officer',   label: 'Programme Officer',       userRole: 'staff' },
  { value: 'finance_officer',     label: 'Finance Officer',         userRole: 'staff' },
  { value: 'admin_officer',       label: 'Admin Officer',           userRole: 'staff' },
  { value: 'project_coordinator', label: 'Project Coordinator',     userRole: 'staff' },
];

const ROLE_COLORS: Record<string, string> = {
  executive_director:  'bg-violet-100 text-violet-700',
  deputy_director:     'bg-indigo-100 text-indigo-700',
  hr_admin_officer:    'bg-amber-100 text-amber-700',
  programme_manager:   'bg-sky-100 text-sky-700',
  finance_manager:     'bg-emerald-100 text-emerald-700',
  programme_officer:   'bg-blue-100 text-blue-700',
  finance_officer:     'bg-teal-100 text-teal-700',
  admin_officer:       'bg-orange-100 text-orange-700',
  project_coordinator: 'bg-rose-100 text-rose-700',
};

const IMPORT_TEMPLATE_COLS = [
  'serial_number', 'full_name', 'job_title', 'department_name',
  'supervisor_name', 'employment_status', 'bsc_perspective', 'self_rating', 'supervisor_rating',
];

// ─── Utility ──────────────────────────────────────────────────────────────────

function norm(v: unknown): string { return String(v ?? '').trim(); }

function initials(name: string): string {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 4500); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-500 max-w-sm
      ${type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
      <Icon name={type === 'success' ? 'CheckCircleIcon' : 'ExclamationCircleIcon'} size={18} />
      <span className="flex-1">{message}</span>
      <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100 flex-shrink-0"><Icon name="XMarkIcon" size={14} /></button>
    </div>
  );
}

// ─── Confirm Modal ────────────────────────────────────────────────────────────

function ConfirmModal({ title, message, confirmLabel, confirmClass, onConfirm, onCancel }: {
  title: string; message: string; confirmLabel: string;
  confirmClass?: string; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h3 className="text-base font-700 text-foreground mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg border border-border text-sm font-500 hover:bg-muted transition-colors">Cancel</button>
          <button onClick={onConfirm} className={`px-4 py-2 rounded-lg text-sm font-600 text-white transition-colors ${confirmClass || 'bg-primary hover:bg-primary/90'}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Role Edit Modal ──────────────────────────────────────────────────────────

function RoleEditModal({ user, onSave, onClose, saving }: {
  user: AdminUser; onSave: (userId: string, systemRole: string, role: string) => void;
  onClose: () => void; saving: boolean;
}) {
  const [selectedRole, setSelectedRole] = useState(user.system_role);

  const handleSave = () => {
    const roleConfig = SYSTEM_ROLES.find(r => r.value === selectedRole);
    if (roleConfig) onSave(user.user_id, roleConfig.value, roleConfig.userRole);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-700 text-foreground">Edit Role Assignment</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><Icon name="XMarkIcon" size={18} /></button>
        </div>
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl mb-4">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <span className="text-primary text-sm font-700">{initials(user.full_name)}</span>
          </div>
          <div>
            <p className="text-sm font-600 text-foreground">{user.full_name}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>
        <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl mb-4">
          <Icon name="EnvelopeIcon" size={15} className="text-blue-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700">An email notification will be sent to this staff member informing them of the role change.</p>
        </div>
        <div className="mb-5">
          <label className="block text-xs font-600 text-muted-foreground uppercase tracking-wider mb-2">System Role</label>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {SYSTEM_ROLES.map(r => (
              <label key={r.value} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all
                ${selectedRole === r.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40 hover:bg-muted/30'}`}>
                <input type="radio" name="role" value={r.value} checked={selectedRole === r.value}
                  onChange={() => setSelectedRole(r.value)} className="accent-primary" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-600 text-foreground">{r.label}</p>
                  <p className="text-xs text-muted-foreground capitalize">{r.userRole} access level</p>
                </div>
                {selectedRole === r.value && <Icon name="CheckCircleIcon" size={16} className="text-primary flex-shrink-0" />}
              </label>
            ))}
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} disabled={saving} className="px-4 py-2 rounded-lg border border-border text-sm font-500 hover:bg-muted transition-colors disabled:opacity-50">Cancel</button>
          <button onClick={handleSave} disabled={saving || selectedRole === user.system_role}
            className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-600 hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2">
            {saving && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            Save & Notify
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── BSC Perspective Form Modal ───────────────────────────────────────────────

function BSCPerspectiveModal({ perspective, onSave, onClose, saving }: {
  perspective: BSCPerspective | null;
  onSave: (data: Partial<BSCPerspective>) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState({
    name: perspective?.name || '',
    description: perspective?.description || '',
    weight: perspective?.weight ?? 25,
    sort_order: perspective?.sort_order ?? 0,
    is_active: perspective?.is_active ?? true,
    color: perspective?.color || '#3B82F6',
  });

  const isEdit = !!perspective;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ ...form, id: perspective?.id });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-700 text-foreground">{isEdit ? 'Edit' : 'Add'} BSC Perspective</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><Icon name="XMarkIcon" size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-600 text-muted-foreground uppercase tracking-wider mb-1.5">Perspective Name *</label>
            <input required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Financial, Stakeholder…"
              className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
          </div>
          <div>
            <label className="block text-xs font-600 text-muted-foreground uppercase tracking-wider mb-1.5">Description</label>
            <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              rows={2} placeholder="Brief description of this perspective…"
              className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-600 text-muted-foreground uppercase tracking-wider mb-1.5">Weight (%)</label>
              <input type="number" min={0} max={100} step={0.5} required value={form.weight}
                onChange={e => setForm(p => ({ ...p, weight: parseFloat(e.target.value) || 0 }))}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
            </div>
            <div>
              <label className="block text-xs font-600 text-muted-foreground uppercase tracking-wider mb-1.5">Sort Order</label>
              <input type="number" min={0} value={form.sort_order}
                onChange={e => setForm(p => ({ ...p, sort_order: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-600 text-muted-foreground uppercase tracking-wider mb-1.5">Colour</label>
              <div className="flex items-center gap-2">
                <input type="color" value={form.color} onChange={e => setForm(p => ({ ...p, color: e.target.value }))}
                  className="w-10 h-9 rounded border border-border cursor-pointer p-0.5" />
                <span className="text-xs text-muted-foreground font-mono">{form.color}</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-600 text-muted-foreground uppercase tracking-wider mb-1.5">Status</label>
              <label className="flex items-center gap-2 cursor-pointer mt-2">
                <input type="checkbox" checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))}
                  className="w-4 h-4 accent-primary" />
                <span className="text-sm text-foreground">Active</span>
              </label>
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} disabled={saving}
              className="px-4 py-2 rounded-lg border border-border text-sm font-500 hover:bg-muted transition-colors disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={saving || !form.name.trim()}
              className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-600 hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2">
              {saving && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {isEdit ? 'Save Changes' : 'Add Perspective'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Staff Tab ────────────────────────────────────────────────────────────────

function StaffTab({ users, loading, onToggleActive, onForceReset, actionLoading }: {
  users: AdminUser[]; loading: boolean;
  onToggleActive: (userId: string, isActive: boolean) => void;
  onForceReset: (userId: string, name: string, email: string) => void;
  actionLoading: string | null;
}) {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');

  const filtered = users.filter(u => {
    const matchSearch = !search || u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) || u.job_title.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || (filterStatus === 'active' ? u.is_active : !u.is_active);
    return matchSearch && matchStatus;
  });

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Icon name="MagnifyingGlassIcon" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="text" placeholder="Search by name, email or job title…" value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
        </div>
        <div className="flex gap-2">
          {(['all', 'active', 'inactive'] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3 py-2 rounded-lg text-xs font-600 capitalize transition-colors
                ${filterStatus === s ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>{s}</button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: 'Total Users', value: users.length, color: 'text-foreground', bg: 'bg-muted/50' },
          { label: 'Active', value: users.filter(u => u.is_active).length, color: 'text-emerald-700', bg: 'bg-emerald-50' },
          { label: 'Pending Reset', value: users.filter(u => u.must_change_password).length, color: 'text-amber-700', bg: 'bg-amber-50' },
        ].map(stat => (
          <div key={stat.label} className={`${stat.bg} rounded-xl p-3 text-center`}>
            <p className={`text-xl font-700 ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="text-left px-4 py-3 text-xs font-700 uppercase tracking-wider text-muted-foreground">Staff Member</th>
              <th className="text-left px-4 py-3 text-xs font-700 uppercase tracking-wider text-muted-foreground hidden md:table-cell">Role</th>
              <th className="text-left px-4 py-3 text-xs font-700 uppercase tracking-wider text-muted-foreground hidden lg:table-cell">Last Login</th>
              <th className="text-center px-4 py-3 text-xs font-700 uppercase tracking-wider text-muted-foreground">Status</th>
              <th className="text-right px-4 py-3 text-xs font-700 uppercase tracking-wider text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-10 text-muted-foreground text-sm">No staff records found.</td></tr>
            ) : filtered.map(user => (
              <tr key={user.user_id} className="hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-primary text-xs font-700">{initials(user.full_name)}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-600 text-foreground truncate">{user.full_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-600 ${ROLE_COLORS[user.system_role] || 'bg-slate-100 text-slate-600'}`}>
                    {SYSTEM_ROLES.find(r => r.value === user.system_role)?.label || user.system_role}
                  </span>
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <span className="text-xs text-muted-foreground">
                    {user.last_sign_in ? formatDateShort(user.last_sign_in) : 'Never'}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex flex-col items-center gap-1">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-600
                      ${user.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${user.is_active ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                    {user.must_change_password && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-600 bg-amber-100 text-amber-700">
                        <Icon name="KeyIcon" size={10} /> Reset Pending
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => onToggleActive(user.user_id, !user.is_active)} disabled={actionLoading === user.user_id}
                      title={user.is_active ? 'Deactivate account' : 'Activate account'}
                      className={`p-1.5 rounded-lg border text-xs font-500 transition-colors disabled:opacity-50
                        ${user.is_active ? 'border-rose-200 text-rose-600 hover:bg-rose-50' : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'}`}>
                      <Icon name={user.is_active ? 'NoSymbolIcon' : 'CheckCircleIcon'} size={14} />
                    </button>
                    <button onClick={() => onForceReset(user.user_id, user.full_name, user.email)}
                      disabled={actionLoading === user.user_id || user.must_change_password}
                      title="Force password reset on next login"
                      className="p-1.5 rounded-lg border border-amber-200 text-amber-600 hover:bg-amber-50 transition-colors disabled:opacity-40">
                      <Icon name="KeyIcon" size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground mt-3">Showing {filtered.length} of {users.length} staff accounts</p>
    </div>
  );
}

// ─── Role Assignments Tab ─────────────────────────────────────────────────────

function RoleAssignmentsTab({ users, loading, onEditRole, actionLoading }: {
  users: AdminUser[]; loading: boolean;
  onEditRole: (user: AdminUser) => void;
  actionLoading: string | null;
}) {
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');

  const filtered = users.filter(u => {
    const matchSearch = !search || u.full_name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = filterRole === 'all' || u.system_role === filterRole;
    return matchSearch && matchRole;
  });

  const grouped = SYSTEM_ROLES.map(r => ({
    ...r,
    members: filtered.filter(u => u.system_role === r.value),
  })).filter(g => g.members.length > 0);

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div>
      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl mb-5">
        <Icon name="EnvelopeIcon" size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-600 text-blue-800">Automatic Email Notifications</p>
          <p className="text-xs text-blue-700 mt-0.5">Staff members are automatically notified by email when their role is changed. Notifications are sent via Supabase Auth.</p>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Icon name="MagnifyingGlassIcon" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="text" placeholder="Search staff…" value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
        </div>
        <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
          className="px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20">
          <option value="all">All Roles</option>
          {SYSTEM_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </div>
      {grouped.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Icon name="UsersIcon" size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No users match your search.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(group => (
            <div key={group.value} className="rounded-xl border border-border overflow-hidden">
              <div className={`flex items-center gap-3 px-4 py-3 bg-muted/30`}>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-700 ${ROLE_COLORS[group.value] || 'bg-slate-100 text-slate-600'}`}>
                  {group.label}
                </span>
                <span className="text-xs text-muted-foreground">{group.members.length} {group.members.length === 1 ? 'member' : 'members'}</span>
              </div>
              <div className="divide-y divide-border">
                {group.members.map(user => (
                  <div key={user.user_id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-primary text-xs font-700">{initials(user.full_name)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-600 text-foreground truncate">{user.full_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {!user.is_active && <span className="text-xs text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full font-500">Inactive</span>}
                      <button onClick={() => onEditRole(user)} disabled={actionLoading === user.user_id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-500 hover:bg-muted hover:border-primary/30 transition-colors disabled:opacity-50">
                        <Icon name="PencilSquareIcon" size={12} />
                        Edit Role
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Password Reset Tab ───────────────────────────────────────────────────────

function PasswordResetTab({ users, loading, onForceReset, actionLoading }: {
  users: AdminUser[]; loading: boolean;
  onForceReset: (userId: string, name: string, email: string) => void;
  actionLoading: string | null;
}) {
  const [search, setSearch] = useState('');
  const pending = users.filter(u => u.must_change_password);
  const filtered = users.filter(u =>
    !search || u.full_name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div>
      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl mb-5">
        <Icon name="EnvelopeIcon" size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-600 text-amber-800">Email Notification on Reset</p>
          <p className="text-xs text-amber-700 mt-0.5">
            When you force a password reset, the staff member is automatically emailed via Supabase Auth to notify them of the required action. No manual follow-up needed.
          </p>
        </div>
      </div>
      {pending.length > 0 && (
        <div className="mb-5">
          <h3 className="text-sm font-700 text-foreground mb-3 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-xs flex items-center justify-center font-700">{pending.length}</span>
            Pending Password Resets
          </h3>
          <div className="space-y-2">
            {pending.map(user => (
              <div key={user.user_id} className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-amber-700 text-xs font-700">{initials(user.full_name)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-600 text-foreground">{user.full_name}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
                <span className="text-xs text-amber-700 font-500 bg-amber-100 px-2 py-1 rounded-lg">Awaiting reset</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="relative mb-4">
        <Icon name="MagnifyingGlassIcon" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input type="text" placeholder="Search staff to force password reset…" value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
      </div>
      <div className="space-y-2">
        {filtered.map(user => (
          <div key={user.user_id} className="flex items-center gap-3 p-3 bg-white border border-border rounded-xl hover:border-primary/30 transition-colors">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-primary text-xs font-700">{initials(user.full_name)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-600 text-foreground">{user.full_name}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
            <div className="flex items-center gap-2">
              {user.must_change_password && <span className="text-xs text-amber-700 font-500 bg-amber-100 px-2 py-1 rounded-lg">Reset pending</span>}
              <button onClick={() => onForceReset(user.user_id, user.full_name, user.email)}
                disabled={actionLoading === user.user_id || user.must_change_password}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-600 hover:bg-amber-600 transition-colors disabled:opacity-40">
                {actionLoading === user.user_id
                  ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Icon name="KeyIcon" size={12} />}
                Force Reset
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── BSC Perspectives Tab ─────────────────────────────────────────────────────

function BSCPerspectivesTab({ supabase, showToast }: {
  supabase: ReturnType<typeof createClient>;
  showToast: (msg: string, type: 'success' | 'error') => void;
}) {
  const [perspectives, setPerspectives] = useState<BSCPerspective[]>([]);
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState<BSCPerspective | null | 'new'>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<BSCPerspective | null>(null);

  const fetchPerspectives = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('admin_get_bsc_perspectives');
      if (error) throw error;
      setPerspectives((data as BSCPerspective[]) || []);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to load BSC perspectives', 'error');
    } finally {
      setLoading(false);
    }
  }, [supabase, showToast]);

  useEffect(() => { fetchPerspectives(); }, [fetchPerspectives]);

  const totalWeight = perspectives.reduce((sum, p) => sum + (p.is_active ? p.weight : 0), 0);

  const handleSave = async (data: Partial<BSCPerspective>) => {
    setSaving(true);
    try {
      const { error } = await supabase.rpc('admin_upsert_bsc_perspective', {
        p_id: data.id || null,
        p_name: data.name || '',
        p_description: data.description || '',
        p_weight: data.weight ?? 25,
        p_sort_order: data.sort_order ?? 0,
        p_is_active: data.is_active ?? true,
        p_color: data.color || '#3B82F6',
      });
      if (error) throw error;
      showToast(data.id ? 'Perspective updated successfully' : 'Perspective added successfully', 'success');
      setEditModal(null);
      fetchPerspectives();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to save perspective', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p: BSCPerspective) => {
    setDeleteConfirm(null);
    try {
      const { error } = await supabase.rpc('admin_delete_bsc_perspective', { p_id: p.id });
      if (error) throw error;
      showToast('Perspective deleted', 'success');
      fetchPerspectives();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to delete perspective', 'error');
    }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-sm font-700 text-foreground">BSC Perspectives Configuration</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Configure the Balanced Scorecard perspectives used in performance evaluations.</p>
        </div>
        <button onClick={() => setEditModal('new')}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-600 hover:bg-primary/90 transition-colors">
          <Icon name="PlusIcon" size={15} />
          Add Perspective
        </button>
      </div>

      {/* Weight indicator */}
      <div className={`flex items-center gap-3 p-3 rounded-xl mb-5 border ${Math.abs(totalWeight - 100) < 0.01 ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
        <Icon name={Math.abs(totalWeight - 100) < 0.01 ? 'CheckCircleIcon' : 'ExclamationTriangleIcon'} size={16}
          className={Math.abs(totalWeight - 100) < 0.01 ? 'text-emerald-600' : 'text-amber-600'} />
        <p className={`text-xs font-600 ${Math.abs(totalWeight - 100) < 0.01 ? 'text-emerald-700' : 'text-amber-700'}`}>
          Active perspectives total weight: <strong>{totalWeight.toFixed(1)}%</strong>
          {Math.abs(totalWeight - 100) >= 0.01 && ' — weights should sum to 100%'}
        </p>
      </div>

      <div className="space-y-3">
        {perspectives.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Icon name="ChartBarIcon" size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No BSC perspectives configured yet.</p>
            <p className="text-xs mt-1">Add perspectives to use in performance evaluations.</p>
          </div>
        ) : perspectives.map(p => (
          <div key={p.id} className={`flex items-center gap-4 p-4 rounded-xl border transition-colors ${p.is_active ? 'bg-white border-border' : 'bg-muted/30 border-border/50 opacity-60'}`}>
            <div className="w-3 h-10 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-sm font-700 text-foreground">{p.name}</p>
                {!p.is_active && <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">Inactive</span>}
              </div>
              {p.description && <p className="text-xs text-muted-foreground truncate">{p.description}</p>}
            </div>
            <div className="flex items-center gap-4 flex-shrink-0">
              <div className="text-center">
                <p className="text-lg font-700 text-foreground">{p.weight}%</p>
                <p className="text-xs text-muted-foreground">Weight</p>
              </div>
              <div className="text-center">
                <p className="text-sm font-600 text-muted-foreground">#{p.sort_order}</p>
                <p className="text-xs text-muted-foreground">Order</p>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => setEditModal(p)}
                  className="p-1.5 rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                  <Icon name="PencilSquareIcon" size={14} />
                </button>
                <button onClick={() => setDeleteConfirm(p)}
                  className="p-1.5 rounded-lg border border-rose-200 text-rose-500 hover:bg-rose-50 transition-colors">
                  <Icon name="TrashIcon" size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editModal && (
        <BSCPerspectiveModal
          perspective={editModal === 'new' ? null : editModal}
          onSave={handleSave}
          onClose={() => setEditModal(null)}
          saving={saving}
        />
      )}
      {deleteConfirm && (
        <ConfirmModal
          title="Delete Perspective"
          message={`Are you sure you want to delete "${deleteConfirm.name}"? This cannot be undone.`}
          confirmLabel="Delete"
          confirmClass="bg-rose-600 hover:bg-rose-700"
          onConfirm={() => handleDelete(deleteConfirm)}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  );
}

// ─── Performance Data Import Tab ──────────────────────────────────────────────

function PerformanceImportTab({ supabase, showToast }: {
  supabase: ReturnType<typeof createClient>;
  showToast: (msg: string, type: 'success' | 'error') => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [status, setStatus] = useState<'idle' | 'parsing' | 'ready' | 'importing' | 'done' | 'error'>('idle');
  const [importResult, setImportResult] = useState<{ inserted: number; skipped: number; errors: string[] } | null>(null);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [staffList, setStaffList] = useState<{ id: string; full_name: string }[]>([]);

  useEffect(() => {
    supabase.from('departments').select('id, name').then(({ data }) => setDepartments(data || []));
    supabase.from('staff').select('id, full_name').then(({ data }) => setStaffList(data || []));
  }, [supabase]);

  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const sampleData = [
      IMPORT_TEMPLATE_COLS,
      ['1', 'JANE MARY DOE', 'Programme Officer', 'Programmes', 'ANDREW NKHULO SILUMESII', 'active', 'Financial', '4', '3'],
      ['2', 'JOHN SMITH', 'Finance Officer', 'Finance', 'LILLIANE BRENDA NAMUTEBI NJUBA', 'active', 'Stakeholder', '3', '4'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(sampleData);
    ws['!cols'] = IMPORT_TEMPLATE_COLS.map(() => ({ wch: 24 }));
    XLSX.utils.book_append_sheet(wb, ws, 'Performance Import');
    XLSX.writeFile(wb, 'performance_data_template.xlsx');
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus('parsing');
    setRows([]);
    setImportResult(null);

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });

      const parsed: ImportRow[] = raw.map((r, idx) => {
        const row: ImportRow = {
          serial_number: norm(r['serial_number'] ?? r['Serial Number'] ?? idx + 1),
          full_name: norm(r['full_name'] ?? r['Full Name'] ?? ''),
          job_title: norm(r['job_title'] ?? r['Job Title'] ?? ''),
          department_name: norm(r['department_name'] ?? r['Department'] ?? ''),
          supervisor_name: norm(r['supervisor_name'] ?? r['Supervisor'] ?? ''),
          employment_status: norm(r['employment_status'] ?? r['Status'] ?? 'active'),
          bsc_perspective: norm(r['bsc_perspective'] ?? r['BSC Perspective'] ?? ''),
          self_rating: norm(r['self_rating'] ?? r['Self Rating'] ?? ''),
          supervisor_rating: norm(r['supervisor_rating'] ?? r['Supervisor Rating'] ?? ''),
          _errors: [],
        };
        if (!row.full_name) row._errors.push('full_name is required');
        if (!row.job_title) row._errors.push('job_title is required');
        return row;
      });

      setRows(parsed);
      setStatus('ready');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to parse file', 'error');
      setStatus('error');
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleImport = async () => {
    const validRows = rows.filter(r => r._errors.length === 0);
    if (validRows.length === 0) { showToast('No valid rows to import', 'error'); return; }

    setStatus('importing');
    let inserted = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const row of validRows) {
      try {
        // Parse ratings — clamp to 1-5 or use 0 (treated as null in RPC)
        const selfRating = Math.min(5, Math.max(0, parseInt(row.self_rating || '0', 10) || 0));
        const supervisorRating = Math.min(5, Math.max(0, parseInt(row.supervisor_rating || '0', 10) || 0));

        const { data, error } = await supabase.rpc('admin_upsert_performance_data', {
          p_full_name:         row.full_name,
          p_job_title:         row.job_title,
          p_department_name:   row.department_name || '',
          p_supervisor_name:   row.supervisor_name || '',
          p_employment_status: row.employment_status || 'active',
          p_serial_number:     parseInt(row.serial_number, 10) || null,
          p_bsc_perspective:   row.bsc_perspective || '',
          p_self_rating:       selfRating,
          p_supervisor_rating: supervisorRating,
          p_review_year:       2026,
          p_review_period:     'mid-year',
        });

        if (error) {
          errors.push(`${row.full_name}: ${error.message}`);
          skipped++;
        } else {
          const result = data as { success: boolean; error?: string };
          if (!result?.success) {
            errors.push(`${row.full_name}: ${result?.error || 'Unknown error'}`);
            skipped++;
          } else {
            inserted++;
          }
        }
      } catch (err: unknown) {
        errors.push(`${row.full_name}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        skipped++;
      }
    }

    setImportResult({ inserted, skipped, errors });
    setStatus('done');
    if (inserted > 0) showToast(`Import complete: ${inserted} records persisted to staff & mid-year reviews`, 'success');
    else showToast(`Import finished with ${errors.length} error(s)`, 'error');
  };

  const errorRows = rows.filter(r => r._errors.length > 0);
  const validRows = rows.filter(r => r._errors.length === 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-sm font-700 text-foreground">Performance Data Import</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Seed initial staff and performance data from an Excel file.</p>
        </div>
        <button onClick={downloadTemplate}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-500 hover:bg-muted transition-colors">
          <Icon name="ArrowDownTrayIcon" size={15} />
          Download Template
        </button>
      </div>

      {/* Upload zone */}
      {status === 'idle' || status === 'error' ? (
        <label className="flex flex-col items-center justify-center gap-3 p-10 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/40 hover:bg-muted/20 transition-colors">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Icon name="ArrowUpTrayIcon" size={22} className="text-primary" />
          </div>
          <div className="text-center">
            <p className="text-sm font-600 text-foreground">Click to upload Excel file</p>
            <p className="text-xs text-muted-foreground mt-1">.xlsx or .xls files supported</p>
          </div>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" />
        </label>
      ) : status === 'parsing' ? (
        <div className="flex items-center justify-center py-16 gap-3">
          <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Parsing file…</p>
        </div>
      ) : null}

      {/* Preview */}
      {(status === 'ready' || status === 'done') && rows.length > 0 && (
        <div>
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { label: 'Total Rows', value: rows.length, color: 'text-foreground', bg: 'bg-muted/50' },
              { label: 'Valid', value: validRows.length, color: 'text-emerald-700', bg: 'bg-emerald-50' },
              { label: 'Errors', value: errorRows.length, color: 'text-rose-700', bg: 'bg-rose-50' },
            ].map(stat => (
              <div key={stat.label} className={`${stat.bg} rounded-xl p-3 text-center`}>
                <p className={`text-xl font-700 ${stat.color}`}>{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Import result */}
          {importResult && (
            <div className={`flex items-start gap-3 p-4 rounded-xl border mb-4 ${importResult.errors.length === 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
              <Icon name={importResult.errors.length === 0 ? 'CheckCircleIcon' : 'ExclamationTriangleIcon'} size={18}
                className={importResult.errors.length === 0 ? 'text-emerald-600' : 'text-amber-600'} />
              <div>
                <p className="text-sm font-600">{importResult.inserted} records imported, {importResult.skipped} skipped</p>
                {importResult.errors.slice(0, 3).map((e, i) => <p key={i} className="text-xs text-rose-600 mt-0.5">{e}</p>)}
              </div>
            </div>
          )}

          {/* Table preview */}
          <div className="overflow-x-auto rounded-xl border border-border mb-4">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-left px-3 py-2.5 font-700 uppercase tracking-wider text-muted-foreground">#</th>
                  <th className="text-left px-3 py-2.5 font-700 uppercase tracking-wider text-muted-foreground">Name</th>
                  <th className="text-left px-3 py-2.5 font-700 uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Job Title</th>
                  <th className="text-left px-3 py-2.5 font-700 uppercase tracking-wider text-muted-foreground hidden md:table-cell">Department</th>
                  <th className="text-left px-3 py-2.5 font-700 uppercase tracking-wider text-muted-foreground hidden lg:table-cell">BSC Perspective</th>
                  <th className="text-center px-3 py-2.5 font-700 uppercase tracking-wider text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.slice(0, 50).map((row, i) => (
                  <tr key={i} className={`hover:bg-muted/20 ${row._errors.length > 0 ? 'bg-rose-50/50' : ''}`}>
                    <td className="px-3 py-2 text-muted-foreground">{row.serial_number || i + 1}</td>
                    <td className="px-3 py-2 font-500 text-foreground">{row.full_name || <span className="text-rose-500 italic">missing</span>}</td>
                    <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell">{row.job_title}</td>
                    <td className="px-3 py-2 text-muted-foreground hidden md:table-cell">{row.department_name}</td>
                    <td className="px-3 py-2 text-muted-foreground hidden lg:table-cell">{row.bsc_perspective}</td>
                    <td className="px-3 py-2 text-center">
                      {row._errors.length > 0 ? (
                        <span title={row._errors.join(', ')} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-600 bg-rose-100 text-rose-700">
                          <Icon name="ExclamationCircleIcon" size={10} /> Error
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-600 bg-emerald-100 text-emerald-700">
                          <Icon name="CheckCircleIcon" size={10} /> OK
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 50 && <p className="text-xs text-muted-foreground text-center py-2">Showing first 50 of {rows.length} rows</p>}
          </div>

          <div className="flex items-center gap-3">
            {status !== 'done' && (
              <button onClick={handleImport} disabled={validRows.length === 0 || status === 'importing'}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-white text-sm font-600 hover:bg-primary/90 transition-colors disabled:opacity-50">
                {status === 'importing'
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Importing…</>
                  : <><Icon name="ArrowUpTrayIcon" size={15} /> Import {validRows.length} Records</>}
              </button>
            )}
            <button onClick={() => { setRows([]); setStatus('idle'); setImportResult(null); }}
              className="px-4 py-2.5 rounded-lg border border-border text-sm font-500 hover:bg-muted transition-colors">
              {status === 'done' ? 'Import Another File' : 'Clear'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const supabase = createClient();
  const { getDisplayName } = useAuth();

  const [activeTab, setActiveTab] = useState<Tab>('staff');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    title: string; message: string; confirmLabel: string;
    confirmClass?: string; onConfirm: () => void;
  } | null>(null);
  const [roleEditUser, setRoleEditUser] = useState<AdminUser | null>(null);
  const [roleSaving, setRoleSaving] = useState(false);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('admin_get_all_users');
      if (error) throw error;
      setUsers((data as AdminUser[]) || []);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to load staff records', 'error');
    } finally {
      setLoading(false);
    }
  }, [supabase, showToast]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // Send email notification via Resend edge function
  const sendEmailNotification = async (
    userId: string,
    email: string,
    type: 'password_reset' | 'role_change',
    options?: { recipientName?: string; newRole?: string; resetLink?: string }
  ) => {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      // Call the Resend edge function
      const edgeResponse = await fetch(`${supabaseUrl}/functions/v1/send-staff-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          type,
          recipientEmail: email,
          recipientName: options?.recipientName,
          newRole: options?.newRole,
          resetLink: options?.resetLink,
        }),
      });

      if (!edgeResponse.ok) {
        const errData = await edgeResponse.json().catch(() => ({}));
        console.error('Resend edge function error:', errData);
      }

      // Log the notification in DB
      await supabase.rpc('admin_log_email_notification', {
        p_recipient_user_id: userId,
        p_recipient_email: email,
        p_email_type: type,
        p_subject: type === 'password_reset' ?'Action Required: Reset Your ECSA-HC PMS Password' :'Your ECSA-HC PMS Role Has Been Updated',
        p_body_preview: type === 'password_reset' ?'An administrator has requested a password reset for your account.'
          : `Your system role has been updated to: ${options?.newRole || 'a new role'}.`,
        p_status: edgeResponse.ok ? 'sent' : 'failed',
      });
    } catch {
      // Email notification failure is non-blocking
    }
  };

  const handleToggleActive = (userId: string, newActive: boolean) => {
    const user = users.find(u => u.user_id === userId);
    setConfirmModal({
      title: newActive ? 'Activate Account' : 'Deactivate Account',
      message: `Are you sure you want to ${newActive ? 'activate' : 'deactivate'} ${user?.full_name}'s account?`,
      confirmLabel: newActive ? 'Activate' : 'Deactivate',
      confirmClass: newActive ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700',
      onConfirm: async () => {
        setConfirmModal(null);
        setActionLoading(userId);
        try {
          const { error } = await supabase.rpc('admin_toggle_user_active', { target_user_id: userId, new_is_active: newActive });
          if (error) throw error;
          setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, is_active: newActive } : u));
          showToast(`Account ${newActive ? 'activated' : 'deactivated'} successfully`, 'success');
        } catch (err: unknown) {
          showToast(err instanceof Error ? err.message : 'Action failed', 'error');
        } finally {
          setActionLoading(null);
        }
      },
    });
  };

  const handleForceReset = (userId: string, name: string, email: string) => {
    setConfirmModal({
      title: 'Force Password Reset',
      message: `${name} will be required to change their password on their next login. An email notification will be sent to ${email}.`,
      confirmLabel: 'Force Reset & Notify',
      confirmClass: 'bg-amber-500 hover:bg-amber-600',
      onConfirm: async () => {
        setConfirmModal(null);
        setActionLoading(userId);
        try {
          const { error } = await supabase.rpc('admin_force_password_reset', { target_user_id: userId });
          if (error) throw error;
          setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, must_change_password: true } : u));
          // Send email notification via Resend
          await sendEmailNotification(userId, email, 'password_reset', {
            recipientName: name,
            resetLink: `${process.env.NEXT_PUBLIC_SITE_URL || window.location.origin}/auth/callback`,
          });
          showToast('Password reset flag set and email notification sent.', 'success');
        } catch (err: unknown) {
          showToast(err instanceof Error ? err.message : 'Action failed', 'error');
        } finally {
          setActionLoading(null);
        }
      },
    });
  };

  const handleSaveRole = async (userId: string, systemRole: string, role: string) => {
    setRoleSaving(true);
    try {
      const { error } = await supabase.rpc('admin_update_user_role', {
        target_user_id: userId,
        new_system_role: systemRole,
        new_role: role,
      });
      if (error) throw error;
      const user = users.find(u => u.user_id === userId);
      const roleLabel = SYSTEM_ROLES.find(r => r.value === systemRole)?.label || systemRole;
      setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, system_role: systemRole, role } : u));
      setRoleEditUser(null);
      // Send email notification via Resend
      if (user?.email) {
        await sendEmailNotification(userId, user.email, 'role_change', {
          recipientName: user.full_name,
          newRole: roleLabel,
        });
      }
      showToast('Role updated and email notification sent.', 'success');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to update role', 'error');
    } finally {
      setRoleSaving(false);
    }
  };

  const TABS: { key: Tab; label: string; icon: string; count?: number }[] = [
    { key: 'staff',     label: 'Staff Records',    icon: 'UsersIcon',          count: users.length },
    { key: 'roles',     label: 'Role Assignments', icon: 'ShieldCheckIcon' },
    { key: 'passwords', label: 'Password Reset',   icon: 'KeyIcon',            count: users.filter(u => u.must_change_password).length || undefined },
    { key: 'bsc',       label: 'BSC Perspectives', icon: 'ChartBarIcon' },
    { key: 'import',    label: 'Data Import',      icon: 'ArrowUpTrayIcon' },
  ];

  return (
    <AppLayout>
      <RoleGuard minLevel={80} message="Admin Dashboard requires HR Admin Officer or Director-level access.">
        <div className="p-6 max-w-7xl mx-auto">

          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="p-2 bg-primary/10 rounded-xl">
                  <Icon name="ShieldCheckIcon" size={20} className="text-primary" />
                </div>
                <h1 className="text-xl font-700 text-foreground">Admin Dashboard</h1>
                <span className="px-2 py-0.5 bg-rose-100 text-rose-700 text-xs font-700 rounded-full">Restricted</span>
              </div>
              <p className="text-sm text-muted-foreground ml-10">
                Manage staff, assign roles, configure BSC perspectives, and import performance data.
              </p>
            </div>
            <button onClick={fetchUsers} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm font-500 hover:bg-muted transition-colors">
              <Icon name="ArrowPathIcon" size={15} />
              Refresh
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-muted/50 rounded-xl mb-6 overflow-x-auto">
            {TABS.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-600 whitespace-nowrap transition-all flex-1 justify-center
                  ${activeTab === tab.key
                    ? 'bg-white text-primary shadow-sm border border-border/50'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/50'}`}>
                <Icon name={tab.icon as Parameters<typeof Icon>[0]['name']} size={15} />
                <span className="hidden sm:inline">{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span className={`text-xs font-700 rounded-full px-1.5 py-0.5 leading-none
                    ${activeTab === tab.key ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="bg-white rounded-2xl border border-border p-5 shadow-sm">
            {activeTab === 'staff' && (
              <StaffTab users={users} loading={loading}
                onToggleActive={handleToggleActive}
                onForceReset={handleForceReset}
                actionLoading={actionLoading} />
            )}
            {activeTab === 'roles' && (
              <RoleAssignmentsTab users={users} loading={loading}
                onEditRole={setRoleEditUser}
                actionLoading={actionLoading} />
            )}
            {activeTab === 'passwords' && (
              <PasswordResetTab users={users} loading={loading}
                onForceReset={handleForceReset}
                actionLoading={actionLoading} />
            )}
            {activeTab === 'bsc' && (
              <BSCPerspectivesTab supabase={supabase} showToast={showToast} />
            )}
            {activeTab === 'import' && (
              <PerformanceImportTab supabase={supabase} showToast={showToast} />
            )}
          </div>
        </div>

        {/* Modals */}
        {confirmModal && (
          <ConfirmModal
            title={confirmModal.title}
            message={confirmModal.message}
            confirmLabel={confirmModal.confirmLabel}
            confirmClass={confirmModal.confirmClass}
            onConfirm={confirmModal.onConfirm}
            onCancel={() => setConfirmModal(null)}
          />
        )}
        {roleEditUser && (
          <RoleEditModal
            user={roleEditUser}
            onSave={handleSaveRole}
            onClose={() => setRoleEditUser(null)}
            saving={roleSaving}
          />
        )}
        {toast && (
          <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
        )}
      </RoleGuard>
    </AppLayout>
  );
}
