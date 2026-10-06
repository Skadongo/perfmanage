'use client';

import React, { useState, useEffect, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import RoleGuard from '@/components/RoleGuard';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FiscalYear {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

interface KpiTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  weight: number;
  targetValue: string;
  unit: string;
  isActive: boolean;
  applicableRoles: string[];
}

interface WorkflowStage {
  id: string;
  name: string;
  description: string;
  stageOrder: number;
  stageType: string;
  requiredRole: string;
  isActive: boolean;
  deadlineDays: number | null;
}

interface StaffRoleRow {
  systemRole: string;
  label: string;
  level: number;
  count: number;
}

type TabId = 'fiscal-years' | 'kpi-templates' | 'staff-roles' | 'workflows';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'fiscal-years',  label: 'Fiscal Years',   icon: '📅' },
  { id: 'kpi-templates', label: 'KPI Templates',  icon: '🎯' },
  { id: 'staff-roles',   label: 'Staff Roles',    icon: '👥' },
  { id: 'workflows',     label: 'Workflows',      icon: '🔄' },
];

const ROLE_LABELS: Record<string, { label: string; level: number }> = {
  executive_director: { label: 'Executive Director',       level: 100 },
  deputy_director:    { label: 'Deputy Director',          level: 90  },
  hr_admin_officer:   { label: 'HR & Admin Officer',       level: 80  },
  programme_manager:  { label: 'Programme Manager',        level: 70  },
  finance_manager:    { label: 'Finance Manager',          level: 70  },
  programme_officer:  { label: 'Programme Officer',        level: 50  },
  finance_officer:    { label: 'Finance Officer',          level: 50  },
  admin_officer:      { label: 'Admin Officer',            level: 50  },
  project_coordinator:{ label: 'Project Coordinator',      level: 40  },
};

const KPI_CATEGORIES = ['general', 'programme', 'finance', 'hr', 'admin'];
const STAGE_TYPES     = ['submission', 'approval', 'assessment', 'review', 'verification', 'archive'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toFiscalYear(row: any): FiscalYear {
  return {
    id:        row.id,
    label:     row.label,
    startDate: row.start_date,
    endDate:   row.end_date,
    isActive:  row.is_active,
  };
}

function toKpiTemplate(row: any): KpiTemplate {
  return {
    id:               row.id,
    name:             row.name,
    description:      row.description || '',
    category:         row.category,
    weight:           Number(row.weight),
    targetValue:      row.target_value || '',
    unit:             row.unit || '',
    isActive:         row.is_active,
    applicableRoles:  row.applicable_roles || [],
  };
}

function toWorkflowStage(row: any): WorkflowStage {
  return {
    id:           row.id,
    name:         row.name,
    description:  row.description || '',
    stageOrder:   row.stage_order,
    stageType:    row.stage_type,
    requiredRole: row.required_role || '',
    isActive:     row.is_active,
    deadlineDays: row.deadline_days ?? null,
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-lg font-700 text-foreground">{title}</h2>
      <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
    </div>
  );
}

function SaveButton({ saving, onClick, label = 'Save Changes' }: { saving: boolean; onClick: () => void; label?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={saving}
      className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-600 hover:bg-primary/90 disabled:opacity-60 transition-colors"
    >
      {saving ? (
        <>
          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          Saving…
        </>
      ) : label}
    </button>
  );
}

function Toast({ message, type }: { message: string; type: 'success' | 'error' }) {
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-500 ${
      type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
    }`}>
      {type === 'success' ? '✓' : '✕'} {message}
    </div>
  );
}

// ─── Fiscal Years Tab ─────────────────────────────────────────────────────────

function FiscalYearsTab() {
  const supabase = createClient();
  const { user } = useAuth();
  const [rows, setRows]       = useState<FiscalYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [toast, setToast]     = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [form, setForm]       = useState({ label: '', startDate: '', endDate: '', isActive: false });
  const [editId, setEditId]   = useState<string | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('fiscal_years')
      .select('*')
      .order('start_date', { ascending: false });
    if (!error && data) setRows(data.map(toFiscalYear));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel('fiscal_years_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fiscal_years' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const resetForm = () => { setForm({ label: '', startDate: '', endDate: '', isActive: false }); setEditId(null); };

  const handleEdit = (row: FiscalYear) => {
    setForm({ label: row.label, startDate: row.startDate, endDate: row.endDate, isActive: row.isActive });
    setEditId(row.id);
  };

  const handleSave = async () => {
    if (!form.label.trim() || !form.startDate || !form.endDate) {
      showToast('Please fill in all required fields.', 'error');
      return;
    }
    setSaving(true);
    const payload = {
      label:      form.label.trim(),
      start_date: form.startDate,
      end_date:   form.endDate,
      is_active:  form.isActive,
      created_by: user?.id ?? null,
      updated_at: new Date().toISOString(),
    };
    const { error } = editId
      ? await supabase.from('fiscal_years').update(payload).eq('id', editId)
      : await supabase.from('fiscal_years').insert(payload);
    setSaving(false);
    if (error) { showToast(error.message, 'error'); return; }
    showToast(editId ? 'Fiscal year updated.' : 'Fiscal year added.', 'success');
    resetForm();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this fiscal year?')) return;
    const { error } = await supabase.from('fiscal_years').delete().eq('id', id);
    if (error) showToast(error.message, 'error');
    else showToast('Fiscal year deleted.', 'success');
  };

  const handleSetActive = async (id: string) => {
    await supabase.from('fiscal_years').update({ is_active: false, updated_at: new Date().toISOString() }).neq('id', id);
    await supabase.from('fiscal_years').update({ is_active: true,  updated_at: new Date().toISOString() }).eq('id', id);
    showToast('Active fiscal year updated.', 'success');
  };

  return (
    <div>
      {toast && <Toast {...toast} />}
      <SectionHeader title="Fiscal Years" subtitle="Define and manage fiscal year periods used across the performance management system." />

      {/* Form */}
      <div className="bg-muted/40 border border-border rounded-xl p-5 mb-6">
        <h3 className="text-sm font-600 text-foreground mb-4">{editId ? 'Edit Fiscal Year' : 'Add Fiscal Year'}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-600 text-muted-foreground mb-1">Label <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={form.label}
              onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
              placeholder="e.g. FY 2026-2027"
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="block text-xs font-600 text-muted-foreground mb-1">Start Date <span className="text-red-500">*</span></label>
            <input
              type="date"
              value={form.startDate}
              onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="block text-xs font-600 text-muted-foreground mb-1">End Date <span className="text-red-500">*</span></label>
            <input
              type="date"
              value={form.endDate}
              onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="flex items-end gap-2">
            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
                className="w-4 h-4 rounded border-border text-primary"
              />
              Set as Active
            </label>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <SaveButton saving={saving} onClick={handleSave} label={editId ? 'Update' : 'Add Fiscal Year'} />
          {editId && (
            <button onClick={resetForm} className="px-4 py-2 text-sm border border-border rounded-lg text-muted-foreground hover:bg-muted transition-colors">
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
          <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          Loading fiscal years…
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground uppercase tracking-wide">Label</th>
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground uppercase tracking-wide">Start</th>
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground uppercase tracking-wide">End</th>
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground uppercase tracking-wide">Status</th>
                <th className="text-right px-4 py-3 text-xs font-600 text-muted-foreground uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">No fiscal years configured yet.</td></tr>
              ) : rows.map(row => (
                <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-500 text-foreground">{row.label}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.startDate}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.endDate}</td>
                  <td className="px-4 py-3">
                    {row.isActive ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-600 bg-emerald-50 text-emerald-700 border border-emerald-200">
                        ● Active
                      </span>
                    ) : (
                      <button
                        onClick={() => handleSetActive(row.id)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-500 bg-muted text-muted-foreground border border-border hover:bg-primary/10 hover:text-primary transition-colors"
                      >
                        Set Active
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => handleEdit(row)} className="text-xs text-primary hover:underline font-500">Edit</button>
                      <button onClick={() => handleDelete(row.id)} className="text-xs text-red-500 hover:underline font-500">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── KPI Templates Tab ────────────────────────────────────────────────────────

function KpiTemplatesTab() {
  const supabase = createClient();
  const { user } = useAuth();
  const [rows, setRows]       = useState<KpiTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [toast, setToast]     = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [editId, setEditId]   = useState<string | null>(null);
  const [form, setForm]       = useState({
    name: '', description: '', category: 'general', weight: '', targetValue: '', unit: '', isActive: true, applicableRoles: [] as string[],
  });

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('kpi_templates').select('*').order('category').order('name');
    if (!error && data) setRows(data.map(toKpiTemplate));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel('kpi_templates_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kpi_templates' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const resetForm = () => {
    setForm({ name: '', description: '', category: 'general', weight: '', targetValue: '', unit: '', isActive: true, applicableRoles: [] });
    setEditId(null);
  };

  const handleEdit = (row: KpiTemplate) => {
    setForm({
      name: row.name, description: row.description, category: row.category,
      weight: String(row.weight), targetValue: row.targetValue, unit: row.unit,
      isActive: row.isActive, applicableRoles: row.applicableRoles,
    });
    setEditId(row.id);
  };

  const toggleRole = (role: string) => {
    setForm(f => ({
      ...f,
      applicableRoles: f.applicableRoles.includes(role)
        ? f.applicableRoles.filter(r => r !== role)
        : [...f.applicableRoles, role],
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) { showToast('KPI name is required.', 'error'); return; }
    setSaving(true);
    const payload = {
      name:             form.name.trim(),
      description:      form.description.trim(),
      category:         form.category,
      weight:           parseFloat(form.weight) || 0,
      target_value:     form.targetValue.trim(),
      unit:             form.unit.trim(),
      is_active:        form.isActive,
      applicable_roles: form.applicableRoles,
      created_by:       user?.id ?? null,
      updated_at:       new Date().toISOString(),
    };
    const { error } = editId
      ? await supabase.from('kpi_templates').update(payload).eq('id', editId)
      : await supabase.from('kpi_templates').insert(payload);
    setSaving(false);
    if (error) { showToast(error.message, 'error'); return; }
    showToast(editId ? 'KPI template updated.' : 'KPI template added.', 'success');
    resetForm();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this KPI template?')) return;
    const { error } = await supabase.from('kpi_templates').delete().eq('id', id);
    if (error) showToast(error.message, 'error');
    else showToast('KPI template deleted.', 'success');
  };

  return (
    <div>
      {toast && <Toast {...toast} />}
      <SectionHeader title="KPI Templates" subtitle="Define reusable KPI templates that staff can select when building their workplans." />

      <div className="bg-muted/40 border border-border rounded-xl p-5 mb-6">
        <h3 className="text-sm font-600 text-foreground mb-4">{editId ? 'Edit KPI Template' : 'Add KPI Template'}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-600 text-muted-foreground mb-1">KPI Name <span className="text-red-500">*</span></label>
            <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Programme Delivery Rate"
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div>
            <label className="block text-xs font-600 text-muted-foreground mb-1">Category</label>
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/30">
              {KPI_CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-600 text-muted-foreground mb-1">Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2} placeholder="Brief description of this KPI…"
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
          </div>
          <div>
            <label className="block text-xs font-600 text-muted-foreground mb-1">Weight (%)</label>
            <input type="number" min="0" max="100" value={form.weight} onChange={e => setForm(f => ({ ...f, weight: e.target.value }))}
              placeholder="e.g. 25"
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-600 text-muted-foreground mb-1">Target Value</label>
              <input type="text" value={form.targetValue} onChange={e => setForm(f => ({ ...f, targetValue: e.target.value }))}
                placeholder="e.g. 90"
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div className="w-28">
              <label className="block text-xs font-600 text-muted-foreground mb-1">Unit</label>
              <input type="text" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                placeholder="%, days…"
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-600 text-muted-foreground mb-2">Applicable Roles</label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(ROLE_LABELS).map(([key, val]) => (
                <button key={key} type="button" onClick={() => toggleRole(key)}
                  className={`px-3 py-1 rounded-full text-xs font-500 border transition-colors ${
                    form.applicableRoles.includes(key)
                      ? 'bg-primary text-white border-primary' :'bg-white text-muted-foreground border-border hover:border-primary/50'
                  }`}>
                  {val.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="kpi-active" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
              className="w-4 h-4 rounded border-border text-primary" />
            <label htmlFor="kpi-active" className="text-sm text-foreground cursor-pointer">Active</label>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <SaveButton saving={saving} onClick={handleSave} label={editId ? 'Update' : 'Add KPI Template'} />
          {editId && (
            <button onClick={resetForm} className="px-4 py-2 text-sm border border-border rounded-lg text-muted-foreground hover:bg-muted transition-colors">Cancel</button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
          <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          Loading KPI templates…
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground uppercase tracking-wide">Name</th>
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground uppercase tracking-wide">Category</th>
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground uppercase tracking-wide">Weight</th>
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground uppercase tracking-wide">Target</th>
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground uppercase tracking-wide">Status</th>
                <th className="text-right px-4 py-3 text-xs font-600 text-muted-foreground uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">No KPI templates configured yet.</td></tr>
              ) : rows.map(row => (
                <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-500 text-foreground">{row.name}</p>
                    {row.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{row.description}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs font-500 bg-sky-50 text-sky-700 border border-sky-200 capitalize">{row.category}</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{row.weight}%</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.targetValue}{row.unit ? ` ${row.unit}` : ''}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-600 border ${
                      row.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-muted text-muted-foreground border-border'
                    }`}>
                      {row.isActive ? '● Active' : '○ Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => handleEdit(row)} className="text-xs text-primary hover:underline font-500">Edit</button>
                      <button onClick={() => handleDelete(row.id)} className="text-xs text-red-500 hover:underline font-500">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Staff Roles Tab ──────────────────────────────────────────────────────────

function StaffRolesTab() {
  const supabase = createClient();
  const [roleCounts, setRoleCounts] = useState<Record<string, number>>({});
  const [loading, setLoading]       = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('staff').select('system_role');
    const counts: Record<string, number> = {};
    data?.forEach((row: any) => {
      const r = row.system_role || 'staff_member';
      counts[r] = (counts[r] || 0) + 1;
    });
    setRoleCounts(counts);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel('staff_roles_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const roleRows: StaffRoleRow[] = Object.entries(ROLE_LABELS)
    .map(([key, val]) => ({ systemRole: key, label: val.label, level: val.level, count: roleCounts[key] || 0 }))
    .sort((a, b) => b.level - a.level);

  return (
    <div>
      <SectionHeader title="Staff Roles" subtitle="Overview of the 9 system roles and their current staff counts. Role assignments are managed via Staff Management." />

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
          <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          Loading role data…
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {roleRows.map(row => (
            <div key={row.systemRole} className="bg-white border border-border rounded-xl p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-sm font-600 text-foreground">{row.label}</p>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">{row.systemRole}</p>
                </div>
                <span className="text-2xl font-700 text-primary tabular-nums">{row.count}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${Math.min(100, (row.level / 120) * 100)}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground">Level {row.level}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
        <p className="font-600 mb-1">ℹ️ Role Assignment</p>
        <p>To assign or change a staff member&apos;s role, go to <strong>Staff Management</strong> and edit the individual staff record. Role changes take effect immediately on next login.</p>
      </div>
    </div>
  );
}

// ─── Workflows Tab ────────────────────────────────────────────────────────────

function WorkflowsTab() {
  const supabase = createClient();
  const { user } = useAuth();
  const [rows, setRows]       = useState<WorkflowStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [toast, setToast]     = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [editId, setEditId]   = useState<string | null>(null);
  const [form, setForm]       = useState({
    name: '', description: '', stageOrder: '', stageType: 'review', requiredRole: '', isActive: true, deadlineDays: '',
  });

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('workflow_stages').select('*').order('stage_order');
    if (!error && data) setRows(data.map(toWorkflowStage));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel('workflow_stages_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workflow_stages' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const resetForm = () => {
    setForm({ name: '', description: '', stageOrder: '', stageType: 'review', requiredRole: '', isActive: true, deadlineDays: '' });
    setEditId(null);
  };

  const handleEdit = (row: WorkflowStage) => {
    setForm({
      name: row.name, description: row.description, stageOrder: String(row.stageOrder),
      stageType: row.stageType, requiredRole: row.requiredRole, isActive: row.isActive,
      deadlineDays: row.deadlineDays != null ? String(row.deadlineDays) : '',
    });
    setEditId(row.id);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.stageOrder) { showToast('Name and stage order are required.', 'error'); return; }
    setSaving(true);
    const payload = {
      name:          form.name.trim(),
      description:   form.description.trim(),
      stage_order:   parseInt(form.stageOrder) || 0,
      stage_type:    form.stageType,
      required_role: form.requiredRole || null,
      is_active:     form.isActive,
      deadline_days: form.deadlineDays ? parseInt(form.deadlineDays) : null,
      created_by:    user?.id ?? null,
      updated_at:    new Date().toISOString(),
    };
    const { error } = editId
      ? await supabase.from('workflow_stages').update(payload).eq('id', editId)
      : await supabase.from('workflow_stages').insert(payload);
    setSaving(false);
    if (error) { showToast(error.message, 'error'); return; }
    showToast(editId ? 'Workflow stage updated.' : 'Workflow stage added.', 'success');
    resetForm();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this workflow stage?')) return;
    const { error } = await supabase.from('workflow_stages').delete().eq('id', id);
    if (error) showToast(error.message, 'error');
    else showToast('Workflow stage deleted.', 'success');
  };

  return (
    <div>
      {toast && <Toast {...toast} />}
      <SectionHeader title="Workflow Stages" subtitle="Configure the sequential stages of the performance appraisal workflow." />

      <div className="bg-muted/40 border border-border rounded-xl p-5 mb-6">
        <h3 className="text-sm font-600 text-foreground mb-4">{editId ? 'Edit Workflow Stage' : 'Add Workflow Stage'}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-600 text-muted-foreground mb-1">Stage Name <span className="text-red-500">*</span></label>
            <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Supervisor Approval"
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div>
            <label className="block text-xs font-600 text-muted-foreground mb-1">Stage Order <span className="text-red-500">*</span></label>
            <input type="number" min="1" value={form.stageOrder} onChange={e => setForm(f => ({ ...f, stageOrder: e.target.value }))}
              placeholder="e.g. 1"
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-600 text-muted-foreground mb-1">Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2} placeholder="What happens at this stage…"
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
          </div>
          <div>
            <label className="block text-xs font-600 text-muted-foreground mb-1">Stage Type</label>
            <select value={form.stageType} onChange={e => setForm(f => ({ ...f, stageType: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/30">
              {STAGE_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-600 text-muted-foreground mb-1">Required Role</label>
            <select value={form.requiredRole} onChange={e => setForm(f => ({ ...f, requiredRole: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/30">
              <option value="">— Any Role —</option>
              {Object.entries(ROLE_LABELS).map(([key, { label }]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-600 text-muted-foreground mb-1">Deadline (days)</label>
            <input type="number" min="1" value={form.deadlineDays} onChange={e => setForm(f => ({ ...f, deadlineDays: e.target.value }))}
              placeholder="e.g. 7"
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="wf-active" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
              className="w-4 h-4 rounded border-border text-primary" />
            <label htmlFor="wf-active" className="text-sm text-foreground cursor-pointer">Active</label>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <SaveButton saving={saving} onClick={handleSave} label={editId ? 'Update' : 'Add Stage'} />
          {editId && (
            <button onClick={resetForm} className="px-4 py-2 text-sm border border-border rounded-lg text-muted-foreground hover:bg-muted transition-colors">Cancel</button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
          <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          Loading workflow stages…
        </div>
      ) : (
        <div className="space-y-2">
          {rows.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">No workflow stages configured yet.</div>
          ) : rows.map((row, idx) => (
            <div key={row.id} className="flex items-center gap-4 bg-white border border-border rounded-xl px-4 py-3 hover:shadow-sm transition-shadow">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-primary text-sm font-700">{row.stageOrder}</span>
              </div>
              {idx < rows.length - 1 && (
                <div className="absolute left-[2.25rem] mt-8 w-0.5 h-4 bg-border" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-600 text-foreground">{row.name}</p>
                  <span className="px-2 py-0.5 rounded-full text-xs font-500 bg-indigo-50 text-indigo-700 border border-indigo-200 capitalize">{row.stageType}</span>
                  {!row.isActive && <span className="px-2 py-0.5 rounded-full text-xs font-500 bg-muted text-muted-foreground border border-border">Inactive</span>}
                </div>
                {row.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{row.description}</p>}
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  {row.requiredRole && <span>Role: {ROLE_LABELS[row.requiredRole]?.label || row.requiredRole}</span>}
                  {row.deadlineDays && <span>Deadline: {row.deadlineDays} days</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => handleEdit(row)} className="text-xs text-primary hover:underline font-500">Edit</button>
                <button onClick={() => handleDelete(row.id)} className="text-xs text-red-500 hover:underline font-500">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function HRConfigurationPage() {
  const [activeTab, setActiveTab] = useState<TabId>('fiscal-years');

  return (
    <AppLayout>
      <RoleGuard minLevel={80} message="HR Configuration is restricted to HR Officers and Directors.">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
          {/* Page Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-700 text-foreground">HR Configuration</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage fiscal years, KPI templates, staff roles, and appraisal workflow stages.
            </p>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-muted/50 p-1 rounded-xl mb-6 overflow-x-auto">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-500 whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? 'bg-white text-foreground shadow-sm font-600'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="bg-white border border-border rounded-2xl p-6">
            {activeTab === 'fiscal-years'  && <FiscalYearsTab />}
            {activeTab === 'kpi-templates' && <KpiTemplatesTab />}
            {activeTab === 'staff-roles'   && <StaffRolesTab />}
            {activeTab === 'workflows'     && <WorkflowsTab />}
          </div>
        </div>
      </RoleGuard>
    </AppLayout>
  );
}
