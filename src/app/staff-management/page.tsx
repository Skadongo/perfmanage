'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { ROLE_HIERARCHY } from '@/contexts/AuthContext';
import { useStaffCache } from '@/hooks/useStaffCache';

interface Department {
  id: string;
  name: string;
  description: string | null;
}

interface StaffMember {
  id: string;
  serial_number: number | null;
  full_name: string;
  job_title: string;
  department_id: string | null;
  supervisor_name: string | null;
  supervisor_id: string | null;
  employment_status: string;
  email: string | null;
  system_role: string | null;
  departments?: { name: string } | null;
  supervisor?: { full_name: string; job_title: string } | null;
}

// Role definitions with display labels and system_role keys
const SYSTEM_ROLES: { value: string; label: string; role: string; level: number }[] = [
  { value: 'executive_director', label: 'Director General', role: 'admin', level: 100 },
  { value: 'deputy_director', label: 'Director (Operations & Institutional Dev.)', role: 'admin', level: 90 },
  { value: 'hr_admin_officer', label: 'HR / Admin Officer', role: 'manager', level: 80 },
  { value: 'programme_manager', label: 'Programme Manager', role: 'manager', level: 70 },
  { value: 'finance_manager', label: 'Finance Manager', role: 'manager', level: 70 },
  { value: 'programme_officer', label: 'Programme Officer', role: 'staff', level: 50 },
  { value: 'finance_officer', label: 'Finance Officer', role: 'staff', level: 50 },
  { value: 'admin_officer', label: 'Admin Officer', role: 'staff', level: 50 },
  { value: 'project_coordinator', label: 'Project Coordinator', role: 'staff', level: 40 },
  { value: 'staff_member', label: 'Staff Member', role: 'staff', level: 30 },
];

function getRoleLabel(systemRole: string | null | undefined): string {
  if (!systemRole) return 'Staff Member';
  return SYSTEM_ROLES.find((r) => r.value === systemRole)?.label ?? systemRole.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function getRoleBadgeColor(systemRole: string | null | undefined): string {
  const level = ROLE_HIERARCHY[systemRole ?? 'staff_member'] ?? 30;
  if (level >= 90) return 'bg-violet-100 text-violet-700 border-violet-200';
  if (level >= 80) return 'bg-sky-100 text-sky-700 border-sky-200';
  if (level >= 70) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (level >= 50) return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-gray-100 text-gray-600 border-gray-200';
}

const DEPT_COLORS: Record<string, string> = {
  'Director General\'s Office': 'bg-violet-100 text-violet-700 border-violet-200',
  'Programmes': 'bg-sky-100 text-sky-700 border-sky-200',
  'Finance': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'Operations & Institutional Development': 'bg-amber-100 text-amber-700 border-amber-200',
  'MPA Project': 'bg-rose-100 text-rose-700 border-rose-200',
  'COSECSA': 'bg-indigo-100 text-indigo-700 border-indigo-200',
  'ECSACONM': 'bg-teal-100 text-teal-700 border-teal-200',
  'CANECSA': 'bg-orange-100 text-orange-700 border-orange-200',
  'ECSACOG': 'bg-pink-100 text-pink-700 border-pink-200',
};

const DEPT_ICONS: Record<string, string> = {
  'Director General\'s Office': 'EcsaHealthSystemIcon',
  'Programmes': 'EcsaHealthIcon',
  'Finance': 'BanknotesIcon',
  'Operations & Institutional Development': 'EcsaSettingsIcon',
  'MPA Project': 'EcsaEvaluationIcon',
  'COSECSA': 'EcsaTrainingIcon',
  'ECSACONM': 'EcsaStaffIcon',
  'CANECSA': 'BeakerIcon',
  'ECSACOG': 'EcsaEvaluationIcon',
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();
}

function getAvatarColor(name: string): string {
  const colors = [
    'bg-violet-500', 'bg-sky-500', 'bg-emerald-500', 'bg-amber-500',
    'bg-rose-500', 'bg-indigo-500', 'bg-teal-500', 'bg-orange-500',
    'bg-pink-500', 'bg-cyan-500', 'bg-blue-500', 'bg-green-500',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

// ─── Toast ───────────────────────────────────────────────────────────────────

interface ToastProps {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}

function Toast({ message, type, onClose }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-600 transition-all animate-in slide-in-from-bottom-4 ${
      type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
    }`}>
      <Icon name={type === 'success' ? 'EcsaSuccessIcon' : 'EcsaErrorIcon'} size={18} />
      <span>{message}</span>
      <button onClick={onClose} className="ml-1 opacity-60 hover:opacity-100">
        <Icon name="EcsaCloseIcon" size={14} />
      </button>
    </div>
  );
}

// ─── Create Staff Modal ───────────────────────────────────────────────────────

interface CreateStaffModalProps {
  departments: Department[];
  allStaff: StaffMember[];
  onClose: () => void;
  onCreated: (staff: StaffMember) => void;
}

function CreateStaffModal({ departments, allStaff, onClose, onCreated }: CreateStaffModalProps) {
  const [form, setForm] = useState({
    full_name: '',
    job_title: '',
    department_id: '',
    supervisor_id: '',
    serial_number: '',
    employment_status: 'active',
    email: '',
    system_role: 'staff_member',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedSupervisor = allStaff.find((s) => s.id === form.supervisor_id);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.full_name.trim() || !form.job_title.trim()) {
      setError('Full name and job title are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const payload: Record<string, unknown> = {
        full_name: form.full_name.trim(),
        job_title: form.job_title.trim(),
        employment_status: form.employment_status,
        department_id: form.department_id || null,
        supervisor_id: form.supervisor_id || null,
        supervisor_name: selectedSupervisor?.full_name ?? null,
        serial_number: form.serial_number ? parseInt(form.serial_number, 10) : null,
        email: form.email.trim() || null,
        system_role: form.system_role || 'staff_member',
      };
      const { data, error: insertError } = await supabase
        .from('staff')
        .insert(payload)
        .select(`*, departments(name), supervisor:supervisor_id(full_name, job_title)`)
        .single();
      if (insertError) throw insertError;
      onCreated(data as StaffMember);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create staff record.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Icon name="EcsaUserAddIcon" size={18} className="text-primary" />
            </div>
            <div>
              <h2 className="text-base font-700 text-foreground">Add New Staff</h2>
              <p className="text-xs text-muted-foreground">Create a new staff record</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
            <Icon name="EcsaCloseIcon" size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-start gap-2">
              <Icon name="EcsaErrorIcon" size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-600 text-foreground mb-1.5">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.full_name}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                placeholder="e.g. JANE MARY DOE"
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                required
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-600 text-foreground mb-1.5">
                Job Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.job_title}
                onChange={(e) => setForm((f) => ({ ...f, job_title: e.target.value }))}
                placeholder="e.g. Programme Officer"
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                required
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-600 text-foreground mb-1.5">Email Address</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="e.g. jane.doe@ecsahc.org"
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-600 text-foreground mb-1.5">System Role</label>
              <select
                value={form.system_role}
                onChange={(e) => setForm((f) => ({ ...f, system_role: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
              >
                {SYSTEM_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              <p className="text-[10px] text-muted-foreground mt-1">Determines access level within the system</p>
            </div>

            <div>
              <label className="block text-xs font-600 text-foreground mb-1.5">Directorate/Cluster</label>
              <select
                value={form.department_id}
                onChange={(e) => setForm((f) => ({ ...f, department_id: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
              >
                <option value="">— None —</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-600 text-foreground mb-1.5">Staff No.</label>
              <input
                type="number"
                value={form.serial_number}
                onChange={(e) => setForm((f) => ({ ...f, serial_number: e.target.value }))}
                placeholder="e.g. 58"
                min={1}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-600 text-foreground mb-1.5">Supervisor</label>
              <select
                value={form.supervisor_id}
                onChange={(e) => setForm((f) => ({ ...f, supervisor_id: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
              >
                <option value="">— None —</option>
                {allStaff.map((s) => (
                  <option key={s.id} value={s.id}>{s.full_name} · {s.job_title}</option>
                ))}
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-600 text-foreground mb-1.5">Employment Status</label>
              <div className="flex gap-3">
                {['active', 'inactive', 'on_leave'].map((status) => (
                  <label key={status} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="employment_status"
                      value={status}
                      checked={form.employment_status === status}
                      onChange={(e) => setForm((f) => ({ ...f, employment_status: e.target.value }))}
                      className="accent-primary"
                    />
                    <span className="text-xs text-foreground capitalize">{status.replace('_', ' ')}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-border mt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-600 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-sm font-600 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {saving && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {saving ? 'Creating…' : 'Create Staff'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Edit Staff Modal ─────────────────────────────────────────────────────────

interface EditStaffModalProps {
  staff: StaffMember;
  departments: Department[];
  allStaff: StaffMember[];
  onClose: () => void;
  onUpdated: (staff: StaffMember) => void;
}

function EditStaffModal({ staff, departments, allStaff, onClose, onUpdated }: EditStaffModalProps) {
  const [form, setForm] = useState({
    full_name: staff.full_name,
    job_title: staff.job_title,
    department_id: staff.department_id ?? '',
    supervisor_id: staff.supervisor_id ?? '',
    serial_number: staff.serial_number?.toString() ?? '',
    employment_status: staff.employment_status ?? 'active',
    email: staff.email ?? '',
    system_role: staff.system_role ?? 'staff_member',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedSupervisor = allStaff.find((s) => s.id === form.supervisor_id);
  const supervisorOptions = allStaff.filter((s) => s.id !== staff.id);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.full_name.trim() || !form.job_title.trim()) {
      setError('Full name and job title are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const payload: Record<string, unknown> = {
        full_name: form.full_name.trim(),
        job_title: form.job_title.trim(),
        employment_status: form.employment_status,
        department_id: form.department_id || null,
        supervisor_id: form.supervisor_id || null,
        supervisor_name: selectedSupervisor?.full_name ?? null,
        serial_number: form.serial_number ? parseInt(form.serial_number, 10) : null,
        email: form.email.trim() || null,
        system_role: form.system_role || 'staff_member',
      };
      const { data, error: updateError } = await supabase
        .from('staff')
        .update(payload)
        .eq('id', staff.id)
        .select(`*, departments(name), supervisor:supervisor_id(full_name, job_title)`)
        .single();
      if (updateError) throw updateError;
      onUpdated(data as StaffMember);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update staff record.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-full ${getAvatarColor(staff.full_name)} flex items-center justify-center flex-shrink-0`}>
              <span className="text-white text-xs font-700">{getInitials(staff.full_name)}</span>
            </div>
            <div>
              <h2 className="text-base font-700 text-foreground">Edit Staff Details</h2>
              <p className="text-xs text-muted-foreground truncate max-w-[220px]">{staff.full_name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
            <Icon name="EcsaCloseIcon" size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-start gap-2">
              <Icon name="EcsaErrorIcon" size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-600 text-foreground mb-1.5">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.full_name}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                required
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-600 text-foreground mb-1.5">
                Job Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.job_title}
                onChange={(e) => setForm((f) => ({ ...f, job_title: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                required
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-600 text-foreground mb-1.5">Email Address</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="e.g. jane.doe@ecsahc.org"
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-600 text-foreground mb-1.5">System Role</label>
              <select
                value={form.system_role}
                onChange={(e) => setForm((f) => ({ ...f, system_role: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
              >
                {SYSTEM_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              <p className="text-[10px] text-muted-foreground mt-1">Determines access level within the system</p>
            </div>

            <div>
              <label className="block text-xs font-600 text-foreground mb-1.5">Directorate/Cluster</label>
              <select
                value={form.department_id}
                onChange={(e) => setForm((f) => ({ ...f, department_id: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
              >
                <option value="">— None —</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-600 text-foreground mb-1.5">Staff No.</label>
              <input
                type="number"
                value={form.serial_number}
                onChange={(e) => setForm((f) => ({ ...f, serial_number: e.target.value }))}
                min={1}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-600 text-foreground mb-1.5">Supervisor</label>
              <select
                value={form.supervisor_id}
                onChange={(e) => setForm((f) => ({ ...f, supervisor_id: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
              >
                <option value="">— None —</option>
                {supervisorOptions.map((s) => (
                  <option key={s.id} value={s.id}>{s.full_name} · {s.job_title}</option>
                ))}
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-600 text-foreground mb-1.5">Employment Status</label>
              <div className="flex gap-3">
                {['active', 'inactive', 'on_leave'].map((status) => (
                  <label key={status} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="edit_employment_status"
                      value={status}
                      checked={form.employment_status === status}
                      onChange={(e) => setForm((f) => ({ ...f, employment_status: e.target.value }))}
                      className="accent-primary"
                    />
                    <span className="text-xs text-foreground capitalize">{status.replace('_', ' ')}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-border mt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-600 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-sm font-600 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {saving && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Manage Access Modal (Role + Password Reset) ──────────────────────────────

interface ManageAccessModalProps {
  staff: StaffMember;
  onClose: () => void;
  onUpdated: (staff: StaffMember) => void;
  showToast: (msg: string, type: 'success' | 'error') => void;
}

function ManageAccessModal({ staff, onClose, onUpdated, showToast }: ManageAccessModalProps) {
  const [selectedRole, setSelectedRole] = useState(staff.system_role ?? 'staff_member');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [savingRole, setSavingRole] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasEmail = !!staff.email;

  async function handleSaveRole(e: React.FormEvent) {
    e.preventDefault();
    if (!hasEmail) {
      setError('This staff member does not have an email address. Add an email first to assign a system role.');
      return;
    }
    setSavingRole(true);
    setError(null);
    try {
      const supabase = createClient();
      const roleEntry = SYSTEM_ROLES.find((r) => r.value === selectedRole);
      const roleValue = roleEntry?.role ?? 'staff';

      // Update staff table system_role
      const { data, error: updateError } = await supabase
        .from('staff')
        .update({ system_role: selectedRole })
        .eq('id', staff.id)
        .select(`*, departments(name), supervisor:supervisor_id(full_name, job_title)`)
        .single();
      if (updateError) throw updateError;

      // Also update user_profiles if the user has an auth account
      const { error: rpcError } = await supabase.rpc('assign_staff_role', {
        p_email: staff.email,
        p_system_role: selectedRole,
        p_role: roleValue,
      });
      if (rpcError) {
        // Non-fatal: user may not have an auth account yet
        console.warn('Could not update user_profiles role:', rpcError.message);
      }

      onUpdated(data as StaffMember);
      showToast(`Role updated to "${getRoleLabel(selectedRole)}" for ${staff.full_name}.`, 'success');
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update role.');
    } finally {
      setSavingRole(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!hasEmail) {
      setError('This staff member does not have an email address. Add an email first to reset their password.');
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setSavingPassword(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: rpcError } = await supabase.rpc('admin_reset_staff_password', {
        p_email: staff.email,
        p_new_password: newPassword,
      });
      if (rpcError) throw rpcError;
      if (!data) {
        throw new Error('Staff member not found in the authentication system. They may not have logged in yet.');
      }
      setNewPassword('');
      setConfirmPassword('');
      showToast(`Password reset successfully for ${staff.full_name}. They will be prompted to change it on next login.`, 'success');
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to reset password.');
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-full ${getAvatarColor(staff.full_name)} flex items-center justify-center flex-shrink-0`}>
              <span className="text-white text-xs font-700">{getInitials(staff.full_name)}</span>
            </div>
            <div>
              <h2 className="text-base font-700 text-foreground">Manage Access</h2>
              <p className="text-xs text-muted-foreground truncate max-w-[220px]">{staff.full_name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
            <Icon name="EcsaCloseIcon" size={18} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Email info banner */}
          {!hasEmail && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <Icon name="EcsaWarningIcon" size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-600 text-amber-800">No email address on record</p>
                <p className="text-xs text-amber-700 mt-0.5">Edit this staff member to add an email before assigning roles or resetting passwords.</p>
              </div>
            </div>
          )}

          {hasEmail && (
            <div className="bg-muted/40 rounded-xl p-3 flex items-center gap-3">
              <Icon name="EcsaEmailIcon" size={15} className="text-muted-foreground flex-shrink-0" />
              <div>
                <p className="text-[10px] font-600 uppercase tracking-wider text-muted-foreground">Login Email</p>
                <p className="text-sm font-600 text-foreground">{staff.email}</p>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-start gap-2">
              <Icon name="EcsaErrorIcon" size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}

          {/* ── Role Assignment ── */}
          <div className="border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-muted/30 border-b border-border flex items-center gap-2">
              <Icon name="EcsaPermissionsIcon" size={15} className="text-primary" />
              <h3 className="text-sm font-700 text-foreground">Role & Privileges</h3>
            </div>
            <form onSubmit={handleSaveRole} className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-600 text-foreground mb-1.5">Assign System Role</label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                >
                  {SYSTEM_ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label} (Level {r.level})</option>
                  ))}
                </select>
              </div>

              {/* Role privileges summary */}
              <div className="bg-muted/30 rounded-lg p-3 space-y-1.5">
                <p className="text-[10px] font-700 uppercase tracking-wider text-muted-foreground">Privileges for selected role</p>
                {(() => {
                  const level = ROLE_HIERARCHY[selectedRole] ?? 30;
                  const privileges = [];
                  if (level >= 100) privileges.push('Full system access · All admin features');
                  if (level >= 90) privileges.push('Permissions management · Staff management');
                  if (level >= 80) privileges.push('HR admin · Staff import · Admin dashboard');
                  if (level >= 70) privileges.push('Manager reviews · Team performance data');
                  if (level >= 50) privileges.push('Self-assessment · Evaluation reviews · Analytics');
                  if (level >= 30) privileges.push('Self-assessment · Personal dashboard');
                  return privileges.map((p, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                      <span className="text-xs text-foreground">{p}</span>
                    </div>
                  ));
                })()}
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={savingRole || !hasEmail}
                  className="px-4 py-2 text-sm font-600 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {savingRole && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  {savingRole ? 'Saving…' : 'Save Role'}
                </button>
              </div>
            </form>
          </div>

          {/* ── Password Reset ── */}
          <div className="border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-muted/30 border-b border-border flex items-center gap-2">
              <Icon name="EcsaLockIcon" size={15} className="text-amber-600" />
              <h3 className="text-sm font-700 text-foreground">Reset Password</h3>
            </div>
            <form onSubmit={handleResetPassword} className="p-4 space-y-3">
              <p className="text-xs text-muted-foreground">
                Set a new temporary password. The staff member will be required to change it on their next login.
              </p>
              <div>
                <label className="block text-xs font-600 text-foreground mb-1.5">New Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    className="w-full px-3 py-2 pr-10 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <Icon name={showPassword ? 'EcsaEyeOffIcon' : 'EcsaEyeIcon'} size={15} />
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-600 text-foreground mb-1.5">Confirm Password</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                />
              </div>
              {newPassword && confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-red-600 flex items-center gap-1">
                  <Icon name="EcsaErrorIcon" size={12} /> Passwords do not match
                </p>
              )}
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={savingPassword || !hasEmail || !newPassword || !confirmPassword}
                  className="px-4 py-2 text-sm font-600 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {savingPassword && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  {savingPassword ? 'Resetting…' : 'Reset Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Remove from Department Modal ────────────────────────────────────────────

interface RemoveFromDeptModalProps {
  staff: StaffMember;
  onClose: () => void;
  onRemoved: (updatedStaff: StaffMember) => void;
}

function RemoveFromDeptModal({ staff, onClose, onRemoved }: RemoveFromDeptModalProps) {
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deptName = staff.departments?.name ?? 'Unknown Directorate/Cluster';

  async function handleRemove() {
    setRemoving(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: updateError } = await supabase
        .from('staff')
        .update({ department_id: null })
        .eq('id', staff.id)
        .select(`*, departments(name), supervisor:supervisor_id(full_name, job_title)`)
        .single();
      if (updateError) throw updateError;
      onRemoved(data as StaffMember);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to remove staff from department.');
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
              <Icon name="EcsaUserRemoveIcon" size={18} className="text-amber-600" />
            </div>
            <h2 className="text-base font-700 text-foreground">Remove from Directorate/Cluster</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
            <Icon name="EcsaCloseIcon" size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-start gap-2">
              <Icon name="EcsaErrorIcon" size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}

          <div className="flex items-center gap-3 bg-muted/40 rounded-xl p-4">
            <div className={`w-10 h-10 rounded-full ${getAvatarColor(staff.full_name)} flex items-center justify-center flex-shrink-0`}>
              <span className="text-white text-xs font-700">{getInitials(staff.full_name)}</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-700 text-foreground truncate">{staff.full_name}</p>
              <p className="text-xs text-muted-foreground truncate">{staff.job_title}</p>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-1">
            <p className="text-sm font-600 text-amber-800">
              Remove from <span className="font-700">{deptName}</span>?
            </p>
            <p className="text-xs text-amber-700">
              This staff member will be unassigned from their current directorate/cluster. Their other details will remain unchanged.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-600 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleRemove}
            disabled={removing}
            className="px-5 py-2 text-sm font-600 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {removing && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {removing ? 'Removing…' : 'Remove from Directorate/Cluster'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Staff Card ───────────────────────────────────────────────────────────────

interface StaffCardProps {
  staff: StaffMember;
  onClick: (s: StaffMember) => void;
  onEdit: (s: StaffMember) => void;
  onRemoveDept: (s: StaffMember) => void;
  onManageAccess: (s: StaffMember) => void;
}

function StaffCard({ staff, onClick, onEdit, onRemoveDept, onManageAccess }: StaffCardProps) {
  const deptName = staff.departments?.name ?? 'Unknown';
  const colorClass = DEPT_COLORS[deptName] ?? 'bg-gray-100 text-gray-700 border-gray-200';
  const avatarColor = getAvatarColor(staff.full_name);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="relative w-full text-left bg-white border border-border rounded-xl p-4 hover:shadow-md hover:border-primary/30 transition-all duration-150 group">
      <button onClick={() => onClick(staff)} className="w-full text-left">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-full ${avatarColor} flex items-center justify-center flex-shrink-0`}>
            <span className="text-white text-xs font-700">{getInitials(staff.full_name)}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-600 text-foreground truncate group-hover:text-primary transition-colors pr-6">
              {staff.full_name}
            </p>
            <p className="text-[11px] text-muted-foreground truncate mt-0.5">{staff.job_title}</p>
            {staff.email && (
              <p className="text-[10px] text-muted-foreground/70 truncate mt-0.5">{staff.email}</p>
            )}
            {staff.supervisor_name && (
              <p className="text-[10px] text-muted-foreground/70 truncate mt-1 flex items-center gap-1">
                <Icon name="EcsaChevronUpIcon" size={9} className="flex-shrink-0" />
                {staff.supervisor_name}
              </p>
            )}
          </div>
          {staff.serial_number && (
            <span className="text-[10px] font-600 text-muted-foreground/50 tabular-nums font-mono flex-shrink-0">
              #{staff.serial_number}
            </span>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className={`inline-flex items-center text-[10px] font-600 px-2 py-0.5 rounded-full border ${colorClass}`}>
            {deptName}
          </span>
          {staff.system_role && staff.system_role !== 'staff_member' && (
            <span className={`inline-flex items-center text-[10px] font-600 px-2 py-0.5 rounded-full border ${getRoleBadgeColor(staff.system_role)}`}>
              {getRoleLabel(staff.system_role)}
            </span>
          )}
        </div>
      </button>

      {/* Action menu */}
      <div className="absolute top-3 right-3">
        <button
          onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
          className="p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-muted text-muted-foreground transition-all"
          title="Actions"
        >
          <Icon name="EcsaMoreIcon" size={15} />
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 top-7 z-20 bg-white border border-border rounded-xl shadow-lg py-1 min-w-[170px]">
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onEdit(staff); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-600 text-foreground hover:bg-muted transition-colors"
              >
                <Icon name="EcsaEditIcon" size={14} className="text-primary" />
                Edit Details
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onManageAccess(staff); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-600 text-foreground hover:bg-muted transition-colors"
              >
                <Icon name="EcsaPermissionsIcon" size={14} className="text-violet-600" />
                Manage Access
              </button>
              {staff.department_id && (
                <button
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onRemoveDept(staff); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-600 text-amber-700 hover:bg-amber-50 transition-colors"
                >
                  <Icon name="EcsaUserRemoveIcon" size={14} />
                  Remove from Directorate
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Staff Detail Modal ───────────────────────────────────────────────────────

interface StaffDetailModalProps {
  staff: StaffMember | null;
  allStaff: StaffMember[];
  onClose: () => void;
  onEdit: (s: StaffMember) => void;
  onRemoveDept: (s: StaffMember) => void;
  onManageAccess: (s: StaffMember) => void;
}

function StaffDetailModal({ staff, allStaff, onClose, onEdit, onRemoveDept, onManageAccess }: StaffDetailModalProps) {
  if (!staff) return null;

  const deptName = staff.departments?.name ?? 'Unknown';
  const colorClass = DEPT_COLORS[deptName] ?? 'bg-gray-100 text-gray-700 border-gray-200';
  const avatarColor = getAvatarColor(staff.full_name);
  const directReports = allStaff.filter((s) => s.supervisor_id === staff.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-border">
          <div className="flex items-start gap-4">
            <div className={`w-14 h-14 rounded-full ${avatarColor} flex items-center justify-center flex-shrink-0`}>
              <span className="text-white text-lg font-700">{getInitials(staff.full_name)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-700 text-foreground">{staff.full_name}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">{staff.job_title}</p>
              {staff.email && (
                <p className="text-xs text-muted-foreground mt-0.5">{staff.email}</p>
              )}
              <div className="flex flex-wrap gap-1.5 mt-2">
                <span className={`inline-flex items-center text-[10px] font-600 px-2 py-0.5 rounded-full border ${colorClass}`}>
                  {deptName}
                </span>
                <span className={`inline-flex items-center text-[10px] font-600 px-2 py-0.5 rounded-full border ${getRoleBadgeColor(staff.system_role)}`}>
                  {getRoleLabel(staff.system_role)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => { onClose(); onEdit(staff); }}
                className="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition-colors"
                title="Edit staff"
              >
                <Icon name="EcsaEditIcon" size={16} />
              </button>
              <button
                onClick={() => { onClose(); onManageAccess(staff); }}
                className="p-1.5 rounded-lg hover:bg-violet-50 text-violet-600 transition-colors"
                title="Manage access"
              >
                <Icon name="EcsaPermissionsIcon" size={16} />
              </button>
              {staff.department_id && (
                <button
                  onClick={() => { onClose(); onRemoveDept(staff); }}
                  className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-600 transition-colors"
                  title="Remove from department"
                >
                  <Icon name="EcsaUserRemoveIcon" size={16} />
                </button>
              )}
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
              >
                <Icon name="EcsaCloseIcon" size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-muted/40 rounded-lg p-3">
              <p className="text-[10px] font-600 uppercase tracking-wider text-muted-foreground mb-1">Staff No.</p>
              <p className="text-sm font-700 font-mono text-foreground">
                {staff.serial_number ? `#${staff.serial_number}` : '—'}
              </p>
            </div>
            <div className="bg-muted/40 rounded-lg p-3">
              <p className="text-[10px] font-600 uppercase tracking-wider text-muted-foreground mb-1">Status</p>
              <span className="inline-flex items-center gap-1 text-xs font-600 text-emerald-700">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                {staff.employment_status ?? 'Active'}
              </span>
            </div>
          </div>

          {/* Email & Role */}
          <div className="grid grid-cols-1 gap-3">
            <div className="bg-muted/40 rounded-lg p-3">
              <p className="text-[10px] font-600 uppercase tracking-wider text-muted-foreground mb-1">Email</p>
              <p className="text-sm text-foreground">{staff.email ?? '—'}</p>
            </div>
            <div className="bg-muted/40 rounded-lg p-3">
              <p className="text-[10px] font-600 uppercase tracking-wider text-muted-foreground mb-1">System Role</p>
              <span className={`inline-flex items-center text-xs font-600 px-2 py-0.5 rounded-full border ${getRoleBadgeColor(staff.system_role)}`}>
                {getRoleLabel(staff.system_role)}
              </span>
            </div>
          </div>

          {staff.supervisor_name && (
            <div>
              <p className="text-[10px] font-600 uppercase tracking-wider text-muted-foreground mb-2">Reports To</p>
              <div className="flex items-center gap-3 bg-muted/30 rounded-lg p-3">
                {staff.supervisor ? (
                  <>
                    <div className={`w-8 h-8 rounded-full ${getAvatarColor(staff.supervisor.full_name)} flex items-center justify-center flex-shrink-0`}>
                      <span className="text-white text-xs font-700">{getInitials(staff.supervisor.full_name)}</span>
                    </div>
                    <div>
                      <p className="text-sm font-600 text-foreground">{staff.supervisor.full_name}</p>
                      <p className="text-[11px] text-muted-foreground">{staff.supervisor.job_title}</p>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-2">
                    <Icon name="EcsaMentorIcon" size={16} className="text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">{staff.supervisor_name}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {directReports.length > 0 && (
            <div>
              <p className="text-[10px] font-600 uppercase tracking-wider text-muted-foreground mb-2">
                Direct Reports ({directReports.length})
              </p>
              <div className="space-y-2">
                {directReports.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 bg-muted/20 rounded-lg p-2.5">
                    <div className={`w-7 h-7 rounded-full ${getAvatarColor(r.full_name)} flex items-center justify-center flex-shrink-0`}>
                      <span className="text-white text-[10px] font-700">{getInitials(r.full_name)}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-600 text-foreground truncate">{r.full_name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{r.job_title}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type ModalMode = 'create' | 'edit' | 'remove_dept' | 'manage_access' | null;

interface ToastState {
  message: string;
  type: 'success' | 'error';
}

export default function StaffManagementPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'department'>('department');
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [editTarget, setEditTarget] = useState<StaffMember | null>(null);
  const [removeDeptTarget, setRemoveDeptTarget] = useState<StaffMember | null>(null);
  const [accessTarget, setAccessTarget] = useState<StaffMember | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  // Pagination for grid view
  const [gridPage, setGridPage] = useState(0);
  const GRID_PAGE_SIZE = 20;

  const { getStaff, invalidateCache } = useStaffCache();

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
  }, []);

  useEffect(() => {
    async function fetchData() {
      try {
        const supabase = createClient();
        // Parallelize departments + staff fetch; staff uses cache
        const [deptRes, staffData] = await Promise.all([
          supabase.from('departments').select('id, name, description').order('name'),
          getStaff(),
        ]);
        if (deptRes.error) throw deptRes.error;
        setDepartments(deptRes.data ?? []);
        // Map CachedStaffMember → StaffMember shape expected by existing UI
        setStaff(
          staffData.map((s) => ({
            ...s,
            departments: s.department_name ? { name: s.department_name } : null,
            supervisor: null,
          })) as unknown as StaffMember[]
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to load staff data';
        setError(msg);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [getStaff]);

  // ── CRUD handlers ──────────────────────────────────────────────────────────

  function handleCreated(newStaff: StaffMember) {
    invalidateCache();
    setStaff((prev) => [...prev, newStaff].sort((a, b) => (a.serial_number ?? 999) - (b.serial_number ?? 999)));
    setModalMode(null);
    showToast(`${newStaff.full_name} added successfully.`, 'success');
  }

  function handleUpdated(updated: StaffMember) {
    invalidateCache();
    setStaff((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    setModalMode(null);
    setEditTarget(null);
    showToast(`${updated.full_name} updated successfully.`, 'success');
  }

  function handleRemovedFromDept(updated: StaffMember) {
    invalidateCache();
    setStaff((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    setModalMode(null);
    setRemoveDeptTarget(null);
    showToast(`${updated.full_name} removed from department.`, 'success');
  }

  function openEdit(s: StaffMember) {
    setEditTarget(s);
    setModalMode('edit');
  }

  function openRemoveDept(s: StaffMember) {
    setRemoveDeptTarget(s);
    setModalMode('remove_dept');
  }

  function openManageAccess(s: StaffMember) {
    setAccessTarget(s);
    setModalMode('manage_access');
  }

  function closeModal() {
    setModalMode(null);
    setEditTarget(null);
    setRemoveDeptTarget(null);
    setAccessTarget(null);
  }

  // ── Derived data ───────────────────────────────────────────────────────────

  const filteredStaff = useMemo(() => {
    setGridPage(0); // reset pagination on filter change
    return staff.filter((s) => {
      const matchesSearch =
        !search ||
        s.full_name.toLowerCase().includes(search.toLowerCase()) ||
        s.job_title.toLowerCase().includes(search.toLowerCase()) ||
        (s.supervisor_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (s.email ?? '').toLowerCase().includes(search.toLowerCase());
      const matchesDept = selectedDept === 'all' || s.department_id === selectedDept;
      return matchesSearch && matchesDept;
    });
  }, [staff, search, selectedDept]);

  // Paginated slice for grid view
  const paginatedGridStaff = useMemo(() => {
    const start = gridPage * GRID_PAGE_SIZE;
    return filteredStaff.slice(start, start + GRID_PAGE_SIZE);
  }, [filteredStaff, gridPage]);

  const totalGridPages = Math.ceil(filteredStaff.length / GRID_PAGE_SIZE);

  const staffByDepartment = useMemo(() => {
    const map: Record<string, { dept: Department; members: StaffMember[] }> = {};
    departments.forEach((d) => { map[d.id] = { dept: d, members: [] }; });
    filteredStaff.forEach((s) => {
      if (s.department_id && map[s.department_id]) {
        map[s.department_id].members.push(s);
      }
    });
    return Object.values(map).filter((g) => g.members.length > 0);
  }, [departments, filteredStaff]);

  const stats = useMemo(() => ({
    total: staff.length,
    departments: departments.length,
    filtered: filteredStaff.length,
    supervisors: staff.filter((s) => staff.some((x) => x.supervisor_id === s.id)).length,
  }), [staff, departments, filteredStaff]);

  return (
    <AppLayout
      pageTitle="Staff Management"
      pageSubtitle={`ECSA-HC Staff Directory · As of October 2024 · ${stats.total} Staff Members`}
      actions={
        <div className="flex items-center gap-2">
          <span className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-lg border border-border">
            <Icon name="EcsaStaffIcon" size={13} className="text-muted-foreground" />
            {stats.total} Staff
          </span>
          <button
            onClick={() => setModalMode('create')}
            className="btn-brand"
          >
            <Icon name="EcsaUserAddIcon" size={15} />
            <span className="hidden sm:inline">Add Staff</span>
          </button>
        </div>
      }
    >
      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Staff', value: stats.total, sub: 'As of Oct 2024', color: 'text-foreground', bg: 'bg-white' },
          { label: 'Directorates/Clusters', value: stats.departments, sub: 'Units & Projects', color: 'text-sky-700', bg: 'bg-sky-50' },
          { label: 'Supervisors', value: stats.supervisors, sub: 'With direct reports', color: 'text-violet-700', bg: 'bg-violet-50' },
          { label: 'Showing', value: stats.filtered, sub: 'Matching filters', color: 'text-emerald-700', bg: 'bg-emerald-50' },
        ].map((s) => (
          <div key={s.label} className={`${s.bg} rounded-xl border border-border shadow-sm p-4`}>
            <p className="text-[11px] font-600 uppercase tracking-wider text-muted-foreground">{s.label}</p>
            <p className={`text-2xl font-700 mt-1 tabular-nums font-mono ${s.color}`}>{s.value}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Filters & Controls */}
      <div className="bg-white border border-border rounded-xl p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Icon name="EcsaSearchIcon" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name, title, email or supervisor…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-border rounded-lg bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <Icon name="EcsaCloseIcon" size={14} />
              </button>
            )}
          </div>

          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="text-sm border border-border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors min-w-[200px]"
          >
            <option value="all">All Directorates/Clusters</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>

          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            <button
              onClick={() => setViewMode('department')}
              className={`px-3 py-1.5 rounded-md text-xs font-600 transition-colors ${
                viewMode === 'department' ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              By Directorate
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 rounded-md text-xs font-600 transition-colors ${
                viewMode === 'grid' ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All Staff
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">Loading staff directory…</p>
          </div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <Icon name="EcsaWarningIcon" size={24} className="text-red-500 mx-auto mb-2" />
          <p className="text-sm font-600 text-red-700">Failed to load staff data</p>
          <p className="text-xs text-red-500 mt-1">{error}</p>
        </div>
      ) : filteredStaff.length === 0 ? (
        <div className="bg-white border border-border rounded-xl p-12 text-center">
          <Icon name="EcsaStaffIcon" size={32} className="text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-600 text-muted-foreground">No staff found</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Try adjusting your search or filter</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {paginatedGridStaff.map((s) => (
              <StaffCard
                key={s.id}
                staff={s}
                onClick={setSelectedStaff}
                onEdit={openEdit}
                onRemoveDept={openRemoveDept}
                onManageAccess={openManageAccess}
              />
            ))}
          </div>
          {totalGridPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground">
                Showing {gridPage * GRID_PAGE_SIZE + 1}–{Math.min((gridPage + 1) * GRID_PAGE_SIZE, filteredStaff.length)} of {filteredStaff.length} staff
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setGridPage((p) => Math.max(0, p - 1))}
                  disabled={gridPage === 0}
                  className="px-3 py-1.5 text-xs font-600 border border-border rounded-lg hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <span className="text-xs text-muted-foreground px-2">
                  Page {gridPage + 1} of {totalGridPages}
                </span>
                <button
                  onClick={() => setGridPage((p) => Math.min(totalGridPages - 1, p + 1))}
                  disabled={gridPage >= totalGridPages - 1}
                  className="px-3 py-1.5 text-xs font-600 border border-border rounded-lg hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {staffByDepartment.map(({ dept, members }) => {
            const deptColor = DEPT_COLORS[dept.name] ?? 'bg-gray-100 text-gray-700 border-gray-200';
            const deptIcon = DEPT_ICONS[dept.name] ?? 'BuildingOfficeIcon';
            return (
              <div key={dept.id} className="bg-white border border-border rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-border bg-muted/20 flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${deptColor}`}>
                    <Icon name={deptIcon as Parameters<typeof Icon>[0]['name']} size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-700 text-foreground">{dept.name}</h3>
                    {dept.description && (
                      <p className="text-[11px] text-muted-foreground truncate">{dept.description}</p>
                    )}
                  </div>
                  <span className="text-xs font-600 text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                    {members.length} staff
                  </span>
                </div>
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {members.map((s) => (
                    <StaffCard
                      key={s.id}
                      staff={s}
                      onClick={setSelectedStaff}
                      onEdit={openEdit}
                      onRemoveDept={openRemoveDept}
                      onManageAccess={openManageAccess}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modals ── */}
      {selectedStaff && modalMode === null && (
        <StaffDetailModal
          staff={selectedStaff}
          allStaff={staff}
          onClose={() => setSelectedStaff(null)}
          onEdit={(s) => { setSelectedStaff(null); openEdit(s); }}
          onRemoveDept={(s) => { setSelectedStaff(null); openRemoveDept(s); }}
          onManageAccess={(s) => { setSelectedStaff(null); openManageAccess(s); }}
        />
      )}

      {modalMode === 'create' && (
        <CreateStaffModal
          departments={departments}
          allStaff={staff}
          onClose={closeModal}
          onCreated={handleCreated}
        />
      )}

      {modalMode === 'edit' && editTarget && (
        <EditStaffModal
          staff={editTarget}
          departments={departments}
          allStaff={staff}
          onClose={closeModal}
          onUpdated={handleUpdated}
        />
      )}

      {modalMode === 'remove_dept' && removeDeptTarget && (
        <RemoveFromDeptModal
          staff={removeDeptTarget}
          onClose={closeModal}
          onRemoved={handleRemovedFromDept}
        />
      )}

      {modalMode === 'manage_access' && accessTarget && (
        <ManageAccessModal
          staff={accessTarget}
          onClose={closeModal}
          onUpdated={handleUpdated}
          showToast={showToast}
        />
      )}

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </AppLayout>
  );
}
