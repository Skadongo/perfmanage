'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';

interface KPITemplate {
  id: string;
  name: string;
  category: string;
  perspective: string;
  weight: number;
  unit: string;
  target: string;
  description: string;
  active: boolean;
}

const PERSPECTIVES = ['Financial', 'Customer', 'Internal Process', 'Learning & Growth'];
const CATEGORIES = ['Strategic', 'Operational', 'Developmental', 'Compliance'];

const INITIAL_TEMPLATES: KPITemplate[] = [
  { id: 'k1', name: 'Programme Delivery Rate', category: 'Strategic', perspective: 'Customer', weight: 20, unit: '%', target: '90', description: 'Percentage of planned programme activities delivered on time', active: true },
  { id: 'k2', name: 'Budget Utilisation', category: 'Operational', perspective: 'Financial', weight: 15, unit: '%', target: '95', description: 'Percentage of approved budget utilised within fiscal year', active: true },
  { id: 'k3', name: 'Staff Training Hours', category: 'Developmental', perspective: 'Learning & Growth', weight: 10, unit: 'Hours', target: '40', description: 'Total CPD hours completed per staff member annually', active: true },
  { id: 'k4', name: 'Report Submission Timeliness', category: 'Compliance', perspective: 'Internal Process', weight: 15, unit: '%', target: '100', description: 'Percentage of reports submitted by deadline', active: false },
];

interface KPIFormData {
  name: string;
  category: string;
  perspective: string;
  weight: number;
  unit: string;
  target: string;
  description: string;
}

const EMPTY_FORM: KPIFormData = {
  name: '', category: 'Strategic', perspective: 'Financial', weight: 10, unit: '%', target: '', description: '',
};

const PERSPECTIVE_COLORS: Record<string, string> = {
  'Financial': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'Customer': 'bg-sky-100 text-sky-700 border-sky-200',
  'Internal Process': 'bg-amber-100 text-amber-700 border-amber-200',
  'Learning & Growth': 'bg-violet-100 text-violet-700 border-violet-200',
};

export default function KPITemplatesTab() {
  const [templates, setTemplates] = useState<KPITemplate[]>(INITIAL_TEMPLATES);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<KPIFormData>(EMPTY_FORM);
  const [filterPerspective, setFilterPerspective] = useState<string>('All');
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const filtered = templates.filter((t) => {
    if (filterPerspective !== 'All' && t.perspective !== filterPerspective) return false;
    if (filterCategory !== 'All' && t.category !== filterCategory) return false;
    return true;
  });

  function openAdd() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(t: KPITemplate) {
    setEditId(t.id);
    setForm({ name: t.name, category: t.category, perspective: t.perspective, weight: t.weight, unit: t.unit, target: t.target, description: t.description });
    setShowForm(true);
  }

  function handleSave() {
    if (!form.name || !form.target) return;
    if (editId) {
      setTemplates((prev) => prev.map((t) => (t.id === editId ? { ...t, ...form } : t)));
    } else {
      setTemplates((prev) => [...prev, { id: `k-${Date.now()}`, ...form, active: true }]);
    }
    setShowForm(false);
    setEditId(null);
    setForm(EMPTY_FORM);
  }

  function toggleActive(id: string) {
    setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, active: !t.active } : t)));
  }

  function handleDelete(id: string) {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    setConfirmDeleteId(null);
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <h3 className="text-base font-700 text-foreground">KPI Templates</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {templates.filter((t) => t.active).length} active / {templates.length} total templates
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-600 hover:bg-primary/90 transition-colors self-start sm:self-auto"
        >
          <Icon name="PlusIcon" size={16} />
          Add Template
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select
          value={filterPerspective}
          onChange={(e) => setFilterPerspective(e.target.value)}
          className="border border-border rounded-lg px-3 py-1.5 text-xs font-500 focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
        >
          <option value="All">All Perspectives</option>
          {PERSPECTIVES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="border border-border rounded-lg px-3 py-1.5 text-xs font-500 focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
        >
          <option value="All">All Categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white border border-border rounded-xl p-5 shadow-sm">
          <h4 className="text-sm font-700 text-foreground mb-4">{editId ? 'Edit KPI Template' : 'New KPI Template'}</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-600 text-foreground mb-1">KPI Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Programme Delivery Rate"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-xs font-600 text-foreground mb-1">BSC Perspective</label>
              <select
                value={form.perspective}
                onChange={(e) => setForm((f) => ({ ...f, perspective: e.target.value }))}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {PERSPECTIVES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-600 text-foreground mb-1">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-600 text-foreground mb-1">Weight (%)</label>
              <input
                type="number"
                min={1}
                max={100}
                value={form.weight}
                onChange={(e) => setForm((f) => ({ ...f, weight: Number(e.target.value) }))}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-xs font-600 text-foreground mb-1">Unit</label>
              <input
                type="text"
                value={form.unit}
                onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                placeholder="%, Hours, Count…"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-xs font-600 text-foreground mb-1">Target Value</label>
              <input
                type="text"
                value={form.target}
                onChange={(e) => setForm((f) => ({ ...f, target: e.target.value }))}
                placeholder="e.g. 90"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-600 text-foreground mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
                placeholder="Brief description of this KPI…"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleSave}
              disabled={!form.name || !form.target}
              className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-600 hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {editId ? 'Save Changes' : 'Create Template'}
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

      {/* Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((t) => (
          <div
            key={t.id}
            className={`bg-white border rounded-xl p-4 transition-all ${t.active ? 'border-border' : 'border-border opacity-60'}`}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-700 text-foreground truncate">{t.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{t.description}</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => openEdit(t)} className="p-1.5 rounded-md text-muted-foreground hover:bg-muted transition-colors">
                  <Icon name="PencilSquareIcon" size={14} />
                </button>
                {confirmDeleteId === t.id ? (
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleDelete(t.id)} className="px-2 py-0.5 text-xs bg-red-600 text-white rounded font-600">Confirm</button>
                    <button onClick={() => setConfirmDeleteId(null)} className="px-2 py-0.5 text-xs border border-border rounded font-500">Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDeleteId(t.id)} className="p-1.5 rounded-md text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-colors">
                    <Icon name="TrashIcon" size={14} />
                  </button>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-3">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-600 border ${PERSPECTIVE_COLORS[t.perspective] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                {t.perspective}
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-600 border bg-muted text-muted-foreground border-border">
                {t.category}
              </span>
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span><span className="font-700 text-foreground">{t.weight}%</span> weight</span>
                <span>Target: <span className="font-700 text-foreground">{t.target} {t.unit}</span></span>
              </div>
              <button
                onClick={() => toggleActive(t.id)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${t.active ? 'bg-primary' : 'bg-gray-200'}`}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${t.active ? 'translate-x-4' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="md:col-span-2 xl:col-span-3 text-center py-10 text-muted-foreground text-sm">
            No KPI templates match the selected filters.
          </div>
        )}
      </div>
    </div>
  );
}
