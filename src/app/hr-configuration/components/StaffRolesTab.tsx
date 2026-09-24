'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';

interface StaffRole {
  id: string;
  value: string;
  label: string;
  accessLevel: 'admin' | 'manager' | 'staff' | 'readonly';
  level: number;
  canApprove: boolean;
  canReview: boolean;
  canExport: boolean;
  description: string;
  staffCount: number;
}

const INITIAL_ROLES: StaffRole[] = [
  { id: 'r1', value: 'executive_director', label: 'Director General', accessLevel: 'admin', level: 100, canApprove: true, canReview: true, canExport: true, description: 'Full system access. Final approval authority for all appraisals.', staffCount: 1 },
  { id: 'r2', value: 'deputy_director', label: 'Director (Operations & Institutional Dev.)', accessLevel: 'admin', level: 90, canApprove: true, canReview: true, canExport: true, description: 'Senior management access. Approves departmental appraisals.', staffCount: 1 },
  { id: 'r3', value: 'hr_admin_officer', label: 'HR / Admin Officer', accessLevel: 'manager', level: 80, canApprove: true, canReview: true, canExport: true, description: 'HR management access. Configures system settings and manages staff.', staffCount: 2 },
  { id: 'r4', value: 'programme_manager', label: 'Programme Manager', accessLevel: 'manager', level: 70, canApprove: true, canReview: true, canExport: false, description: 'Reviews and approves direct reports\' appraisals.', staffCount: 4 },
  { id: 'r5', value: 'finance_manager', label: 'Finance Manager', accessLevel: 'manager', level: 70, canApprove: true, canReview: true, canExport: false, description: 'Reviews and approves finance team appraisals.', staffCount: 1 },
  { id: 'r6', value: 'programme_officer', label: 'Programme Officer', accessLevel: 'staff', level: 50, canApprove: false, canReview: false, canExport: false, description: 'Standard staff access. Submits self-assessments and workplans.', staffCount: 18 },
  { id: 'r7', value: 'finance_officer', label: 'Finance Officer', accessLevel: 'staff', level: 50, canApprove: false, canReview: false, canExport: false, description: 'Standard staff access for finance team members.', staffCount: 5 },
  { id: 'r8', value: 'staff_member', label: 'Staff Member', accessLevel: 'staff', level: 30, canApprove: false, canReview: false, canExport: false, description: 'Basic staff access. Can submit self-assessments only.', staffCount: 16 },
];

const ACCESS_LEVEL_COLORS: Record<StaffRole['accessLevel'], string> = {
  admin: 'bg-violet-100 text-violet-700 border-violet-200',
  manager: 'bg-sky-100 text-sky-700 border-sky-200',
  staff: 'bg-amber-100 text-amber-700 border-amber-200',
  readonly: 'bg-gray-100 text-gray-500 border-gray-200',
};

interface RoleFormData {
  label: string;
  value: string;
  accessLevel: StaffRole['accessLevel'];
  level: number;
  canApprove: boolean;
  canReview: boolean;
  canExport: boolean;
  description: string;
}

const EMPTY_FORM: RoleFormData = {
  label: '', value: '', accessLevel: 'staff', level: 30, canApprove: false, canReview: false, canExport: false, description: '',
};

export default function StaffRolesTab() {
  const [roles, setRoles] = useState<StaffRole[]>(INITIAL_ROLES);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<RoleFormData>(EMPTY_FORM);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function openAdd() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(r: StaffRole) {
    setEditId(r.id);
    setForm({ label: r.label, value: r.value, accessLevel: r.accessLevel, level: r.level, canApprove: r.canApprove, canReview: r.canReview, canExport: r.canExport, description: r.description });
    setShowForm(true);
  }

  function handleSave() {
    if (!form.label || !form.value) return;
    if (editId) {
      setRoles((prev) => prev.map((r) => (r.id === editId ? { ...r, ...form } : r)));
    } else {
      setRoles((prev) => [...prev, { id: `r-${Date.now()}`, ...form, staffCount: 0 }]);
    }
    setShowForm(false);
    setEditId(null);
    setForm(EMPTY_FORM);
  }

  const sorted = [...roles].sort((a, b) => b.level - a.level);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-700 text-foreground">Staff Roles & Permissions</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{roles.length} roles defined</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-600 hover:bg-primary/90 transition-colors"
        >
          <Icon name="PlusIcon" size={16} />
          Add Role
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white border border-border rounded-xl p-5 shadow-sm">
          <h4 className="text-sm font-700 text-foreground mb-4">{editId ? 'Edit Role' : 'New Role'}</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-600 text-foreground mb-1">Display Label</label>
              <input
                type="text"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="e.g. Programme Manager"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-xs font-600 text-foreground mb-1">System Key</label>
              <input
                type="text"
                value={form.value}
                onChange={(e) => setForm((f) => ({ ...f, value: e.target.value.toLowerCase().replace(/\s+/g, '_') }))}
                placeholder="e.g. programme_manager"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-600 text-foreground mb-1">Access Level</label>
              <select
                value={form.accessLevel}
                onChange={(e) => setForm((f) => ({ ...f, accessLevel: e.target.value as StaffRole['accessLevel'] }))}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="staff">Staff</option>
                <option value="readonly">Read Only</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-600 text-foreground mb-1">Hierarchy Level (1–100)</label>
              <input
                type="number"
                min={1}
                max={100}
                value={form.level}
                onChange={(e) => setForm((f) => ({ ...f, level: Number(e.target.value) }))}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-600 text-foreground mb-1">Description</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Brief description of this role's responsibilities"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-600 text-foreground mb-2">Permissions</label>
              <div className="flex flex-wrap gap-4">
                {([['canApprove', 'Can Approve Appraisals'], ['canReview', 'Can Review Staff'], ['canExport', 'Can Export Data']] as [keyof RoleFormData, string][]).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form[key] as boolean}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.checked }))}
                      className="w-4 h-4 rounded border-border text-primary focus:ring-primary/30"
                    />
                    <span className="text-sm text-foreground">{label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleSave}
              disabled={!form.label || !form.value}
              className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-600 hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {editId ? 'Save Changes' : 'Create Role'}
            </button>
            <button
              onClick={() => { setShowForm(false); setEditId(null); }}
              className="px-4 py-2 border border-border rounded-lg text-sm font-500 text-muted-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Roles list */}
      <div className="space-y-2">
        {sorted.map((role) => {
          const isExpanded = expandedId === role.id;
          return (
            <div key={role.id} className="bg-white border border-border rounded-xl overflow-hidden">
              <div
                className="flex items-center gap-3 px-5 py-3.5 cursor-pointer hover:bg-muted/20 transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : role.id)}
              >
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-primary text-xs font-700">{role.level}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-700 text-foreground truncate">{role.label}</p>
                  <p className="text-xs text-muted-foreground font-mono">{role.value}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-600 border ${ACCESS_LEVEL_COLORS[role.accessLevel]}`}>
                    {role.accessLevel.charAt(0).toUpperCase() + role.accessLevel.slice(1)}
                  </span>
                  <span className="text-xs text-muted-foreground hidden md:block">{role.staffCount} staff</span>
                  <Icon name={isExpanded ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={16} className="text-muted-foreground" />
                </div>
              </div>
              {isExpanded && (
                <div className="px-5 pb-4 border-t border-border bg-muted/10">
                  <p className="text-xs text-muted-foreground mt-3 mb-3">{role.description}</p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {role.canApprove && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-600 bg-emerald-50 text-emerald-700 border border-emerald-200"><Icon name="CheckIcon" size={11} />Approve</span>}
                    {role.canReview && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-600 bg-sky-50 text-sky-700 border border-sky-200"><Icon name="EyeIcon" size={11} />Review</span>}
                    {role.canExport && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-600 bg-amber-50 text-amber-700 border border-amber-200"><Icon name="ArrowDownTrayIcon" size={11} />Export</span>}
                    {!role.canApprove && !role.canReview && !role.canExport && (
                      <span className="text-xs text-muted-foreground">Self-assessment only</span>
                    )}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); openEdit(role); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs font-600 text-foreground hover:bg-muted transition-colors"
                  >
                    <Icon name="PencilSquareIcon" size={13} />
                    Edit Role
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
